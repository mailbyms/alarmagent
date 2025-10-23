const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { analyzeImage, recognizeCaptcha, analyzeImageWithPrompt } = require('../analysisService');

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
ensureDir(SESSIONS_DIR);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = (dbConfig, isDev) => {

  async function executeWorkflow(workflow, uuid, sendProgress) {
    let taskId = null;
    let conn = null;
    const startTime = new Date();
    let browser, context, page;
    let taskStatus = 'success';
    let taskResult = [];
    let endTime = null;

    try {
      conn = await mysql.createConnection(dbConfig);

      // 如果传入的工作流为空，则从数据库中查询
      if (!workflow || !workflow.d || !Array.isArray(workflow.d)) {
        if (!uuid) {
          sendProgress({ error: '缺少智能体uuid，无法获取工作流' });
          return { status: 'failed', error: '缺少智能体uuid，无法获取工作流' };
        }
        try {
          const [agentRows] = await conn.execute('SELECT workflow FROM agents WHERE uuid = ? LIMIT 1', [uuid]);
          // 打印出数据库获取的工作流内容
          console.log('Loaded workflow from DB for agent', uuid, agentRows && agentRows[0] && agentRows[0].workflow);

          if (agentRows && agentRows.length > 0 && agentRows[0].workflow) {
            workflow = JSON.parse(agentRows[0].workflow);
            if (!workflow || !workflow.d || !Array.isArray(workflow.d)) {
              sendProgress({ error: '数据库中工作流格式错误' });
              return { status: 'failed', error: '数据库中工作流格式错误' };
            }
          } else {
            sendProgress({ error: '未找到对应智能体的工作流' });
            return { status: 'failed', error: '未找到对应智能体的工作流' };
          }
        } catch (err) {
          sendProgress({ error: '查询工作流失败: ' + err.message });
          return { status: 'failed', error: '查询工作流失败: ' + err.message };
        }
      }

      const [result] = await conn.execute(
        'INSERT INTO crawler_task (agent_uuid, workflow_json, start_time, status) VALUES (?, ?, ?, ?)',
        [uuid, JSON.stringify(workflow), startTime, 'running']
      );
      taskId = result.insertId;
    } catch (err) {
      sendProgress({ error: '任务入库失败: ' + err.message });
      if (conn) await conn.end();
      return { status: 'failed', error: '任务入库失败: ' + err.message };
    }

    const nodes = workflow.d;
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });
    const begin = nodes.find(n => n.type === 'begin');
    if (!begin) {
      sendProgress({ error: '未找到 begin 节点' });
      if (conn) await conn.end();
      return { status: 'failed', error: '未找到 begin 节点' };
    }

    // If begin node has a siteId attribute, fetch site info and insert a loginweb node after begin
    try {
      const beginSiteId = (begin.a && begin.a.siteId) || begin.siteId || (begin.attrs && begin.attrs.siteId);
      if (beginSiteId) {
        try {
          const [siteRows] = await conn.execute('SELECT id, name, home_url, login_steps FROM sites WHERE id = ? LIMIT 1', [beginSiteId]);
          if (siteRows && siteRows.length > 0) {
            const site = siteRows[0];
            // parse login_steps if stored as string
            let loginSteps = site.login_steps;
            try { if (typeof loginSteps === 'string' && loginSteps) loginSteps = JSON.parse(loginSteps); } catch (e) { /* ignore */ }

            // create a new login node using site info
            const loginNodeId = `login_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
            const loginNode = {
              id: loginNodeId,
              type: 'loginweb',
              p: {
                displayName: '登录网站',
              },              
              // attributes expected by loginweb handling in test runner
              a: {
                siteId: beginSiteId,
                homeUrl: site.home_url,
                url: (loginSteps && loginSteps.url) || site.home_url || '',
                usernameSelector: loginSteps && loginSteps.usernameSelector || '',
                username: loginSteps && loginSteps.username || '',
                passwordSelector: loginSteps && loginSteps.passwordSelector || '',
                password: loginSteps && loginSteps.password || '',
                useCaptcha: !!(loginSteps && loginSteps.useCaptcha),
                captchaImageSelector: loginSteps && loginSteps.captchaImageSelector || '',
                captchaInputSelector: loginSteps && loginSteps.captchaInputSelector || ''
              },
              // give it an empty wires array which we'll set to begin's previous wires
              wires: []
            };

            // preserve original begin outgoing wires
            const origWires = Array.isArray(begin.wires) ? JSON.parse(JSON.stringify(begin.wires)) : (begin.wires || []);

            // set begin.wires to point to the login node
            begin.wires = [[loginNodeId]];

            // set loginNode.wires to original targets
            loginNode.wires = origWires;

            // insert loginNode into nodes array and nodeMap
            nodes.push(loginNode);
            nodeMap[loginNodeId] = loginNode;
            //sendProgress({ info: `Inserted login node ${loginNodeId} for site ${site.id}` });
          }
        } catch (qe) {
          console.warn('Failed to load site for begin.siteId', qe && qe.message);
        }
      }
    } catch (outerErr) {
      console.warn('Error while trying to insert login node:', outerErr && outerErr.message);
    }

    const ordered = [];
    const visited = new Set();
    function visit(node) {
      if (!node || visited.has(node.id)) return;
      ordered.push(node);
      visited.add(node.id);
      if (Array.isArray(node.wires)) {
        node.wires.forEach(arr => {
          if (Array.isArray(arr)) {
            arr.forEach(id => { if (typeof id === 'string') visit(nodeMap[id]); });
          } else if (typeof arr === 'string') {
            visit(nodeMap[arr]);
          }
        });
      } else if (typeof arr === 'string') {
        visit(nodeMap[arr]);
      }
    }
    visit(begin);

    try {
      for (const node of ordered) {
        let result = { id: node.id, type: node.type, displayName: node.p && node.p.displayName };
        let stepFailed = false;
        try {
          if (node.type === 'loginweb') {
            const { siteId, homeUrl, url, usernameSelector, passwordSelector, username, password, useCaptcha, captchaImageSelector, captchaInputSelector } = node.a || {};
            const sessionPath = path.join(SESSIONS_DIR, 'sessions.json');
            let loggedIn = false;

            console.log(`[Workflow Test][loginweb][${node.id}] Starting login process.`);
            browser = await chromium.launch({ headless: false });

            // 1. Create context, loading session if it exists
            const contextOptions = {
              viewport: { width: 1920, height: 1080 },
              ignoreHTTPSErrors: true
            };

            if (fs.existsSync(sessionPath)) {
              console.log(`[Workflow Test][loginweb][${node.id}] Found session file, attempting to restore session from ${sessionPath}`);
              contextOptions.storageState = sessionPath; // Playwright handles reading the file
            }

            context = await browser.newContext(contextOptions);
            page = await context.newPage();

            // 2. Validate session for the current site
            try {
              console.log(`[Workflow Test][loginweb][${node.id}] Navigating to home URL ${homeUrl} to check login status.`);
              await page.goto(homeUrl, { waitUntil: 'networkidle', timeout: 15000 });
              const currentUrl = page.url();
              console.log(`[Workflow Test][loginweb][${node.id}] Current URL is ${currentUrl}`);

              if (!currentUrl.includes('/login')) {
                loggedIn = true;
                result.status = 'loginweb done (session restored)';
                console.log(`[Workflow Test][loginweb][${node.id}] Session is valid for ${homeUrl}. Skipping login.`);
                if (conn && siteId) {
                  try {
                    await conn.execute('UPDATE sites SET last_login_at = ? WHERE id = ?', [new Date(), siteId]);
                    console.log(`[Workflow Test][loginweb][${node.id}] Updated last_login_at for site ${siteId}`);
                  } catch (dbErr) {
                    console.error(`[Workflow Test][loginweb][${node.id}] Failed to update last_login_at for site ${siteId}: ${dbErr.message}`);
                  }
                }
              } else {
                console.log(`[Workflow Test][loginweb][${node.id}] Session is invalid for ${homeUrl} (redirected to login page).`);
              }
            } catch (e) {
              console.error(`[Workflow Test][loginweb][${node.id}] Error validating session for ${homeUrl}: ${e.message}. Proceeding with fresh login.`);
            }

            // 3. If not logged in, perform fresh login
            if (!loggedIn) {
              console.log(`[Workflow Test][loginweb][${node.id}] No valid session found. Performing fresh login to ${url}.`);
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

              if (useCaptcha && captchaImageSelector && captchaInputSelector) {
                console.log(`[Workflow Test][loginweb][${node.id}] Captcha enabled. Selector: ${captchaImageSelector}`);
                const captchaElement = page.locator(captchaImageSelector);
                await captchaElement.waitFor({ state: 'visible', timeout: 10000 });
                const captchaBuffer = await captchaElement.screenshot();
                const captchaBase64 = captchaBuffer.toString('base64');
                const analysisResult = await recognizeCaptcha(captchaBase64);
                const rawCaptchaCode = (analysisResult && analysisResult.text) ? analysisResult.text.trim() : '';
                const captchaCode = rawCaptchaCode.toUpperCase();
                console.log(`[Workflow Test][loginweb][${node.id}] Recognized captcha code: ${rawCaptchaCode}, filling with: ${captchaCode}`);
                try {
                  if (conn && taskId) {
                    await conn.execute(
                      'INSERT INTO captcha_shot (task_id, created_at, image_base64, recognized_text, raw_text) VALUES (?, ?, ?, ?, ?)',
                      [taskId, new Date(), captchaBase64, captchaCode, rawCaptchaCode]
                    );
                  }
                } catch (imgErr) {
                  console.error('Failed to save captcha shot to DB:', imgErr.message);
                }
                if (captchaCode) {
                  console.log(`[Workflow Test][loginweb][${node.id}] Filling captcha "${captchaCode}" in selector: ${captchaInputSelector}`);
                  await page.fill(captchaInputSelector, captchaCode);
                  await page.waitForTimeout(500);
                }
              }
              if (usernameSelector && username) {
                console.log(`[Workflow Test][loginweb][${node.id}] Filling username in selector: ${usernameSelector}`);
                await page.locator(usernameSelector).waitFor({ state: 'visible', timeout: 10000 });
                await page.fill(usernameSelector, username);
              }
              if (passwordSelector && password) {
                console.log(`[Workflow Test][loginweb][${node.id}] Filling password in selector: ${passwordSelector}`);
                await page.locator(passwordSelector).waitFor({ state: 'visible', timeout: 10000 });
                await page.fill(passwordSelector, password);
              }

              console.log(`[Workflow Test][loginweb][${node.id}] Pressing Enter to submit login form at ${new Date().toLocaleString()}`);
              await page.keyboard.press('Enter');

              await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => console.log('networkidle timeout, proceeding anyway'));
              // TODO 注意这里要等几秒（后续优化），上面的 page.waitForLoadState 可能不够
              await page.waitForTimeout(3000); // wait a bit for any redirects

              // 4. Verify login success and save session
              console.log(`[Workflow Test][loginweb][${node.id}] Verifying login success by navigating to home URL: ${homeUrl}`);
              await page.goto(homeUrl, { waitUntil: 'networkidle', timeout: 15000 });
              const finalUrl = page.url();
              console.log(`[Workflow Test][loginweb][${node.id}] Final URL after navigating to home is: ${finalUrl}`);

              if (!finalUrl.includes('/login')) {
                console.log(`[Workflow Test][loginweb][${node.id}] Login successful.`);
                if (conn && siteId) {
                  try {
                    await conn.execute('UPDATE sites SET last_login_at = ? WHERE id = ?', [new Date(), siteId]);
                    console.log(`[Workflow Test][loginweb][${node.id}] Updated last_login_at for site ${siteId}`);
                  } catch (dbErr) {
                    console.error(`[Workflow Test][loginweb][${node.id}] Failed to update last_login_at for site ${siteId}: ${dbErr.message}`);
                  }
                }
                try {
                  // This overwrites the file with the new combined storage state
                  await context.storageState({ path: sessionPath });
                  console.log(`[Workflow Test][loginweb][${node.id}] Session state saved to ${sessionPath}`);
                  result.status = 'loginweb done (new session saved)';
                } catch (e) {
                  console.error(`[Workflow Test][loginweb][${node.id}] Failed to save session state: ${e.message}`);
                  result.status = 'loginweb done (session save failed)';
                }
              } else {
                console.error(`[Workflow Test][loginweb][${node.id}] Login verification failed. Final URL is ${finalUrl}`);
                throw new Error(`Login verification failed: redirected back to a login page.`);
              }
            }
          } else if (node.type === 'openwebpage') {
            const { url } = node.a || {};
            if (page && url) {
              console.log(`[Workflow Test][openwebpage][${node.id}] Opening URL: ${url} at ${new Date().toLocaleString()}`);
              await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
              console.log(`[Workflow Test][openwebpage][${node.id}] networkidle at ${new Date().toLocaleString()}`);
              result.status = 'openwebpage done';
            } else {
              result.status = 'skip (no page or url)';
            }
          } else if (node.type === 'delay') {
            const { delay } = node.a || {};
            if (page && delay) {
              console.log(`[Workflow Test][delay][${node.id}] Waiting for ${delay}ms`);
              await page.waitForTimeout(Number(delay));
              result.status = `delay ${delay}ms done`;
            } else {
              result.status = 'skip (no page or delay)';
            }
          } else if (node.type === 'screenshot') {
            if (page) {
              console.log(`[Workflow Test][screenshot][${node.id}] Taking full page screenshot.`);
              const ts = Date.now();
              let imgBuffer;
              let shotPath = path.join('shots', `${ts}.png`);
              if (isDev) {
                ensureDir('shots');
                await page.screenshot({ path: shotPath, fullPage: true });
                imgBuffer = fs.readFileSync(shotPath);
                result.status = 'screenshot saved';
                result.shotPath = shotPath;
              } else {
                imgBuffer = await page.screenshot({ fullPage: true });
                result.status = 'screenshot saved';
              }
              const { vlm_prompt } = node.a || {};
              try {
                const imgBase64 = imgBuffer.toString('base64');
                let vlmResult = null;

                if (vlm_prompt) {
                  console.log(`[Workflow Test][screenshot][${node.id}] VLM prompt found, analyzing image...`);
                  try {
                    vlmResult = await analyzeImageWithPrompt(imgBase64, vlm_prompt);
                    result.status += ' (vlm analysis done)';
                    result.vlmResult = vlmResult;
                  } catch (vlmErr) {
                    console.error(`[Workflow Test][screenshot][${node.id}] VLM analysis failed:`, vlmErr.message);
                    result.status += ' (vlm analysis failed)';
                  }
                }

                if (conn && taskId) {
                  await conn.execute(
                    'INSERT INTO crawler_shot (task_id, created_at, image_base64, vlm_result) VALUES (?, ?, ?, ?)',
                    [taskId, new Date(), imgBase64, vlmResult ? JSON.stringify(vlmResult) : null]
                  );
                }
              } catch (imgErr) {
                result.status += ' (db save failed: ' + imgErr.message + ')';
              }
            } else {
              result.status = 'skip (no page)';
            }
          } else if (node.type === 'click') {
            const { selector, clickType } = node.a || {};
            if (page && selector) {
              console.log(`[Workflow Test][click][${node.id}] Performing ${clickType || 'left'} click on selector: ${selector}`);
              await page.locator(selector).waitFor({ state: 'visible', timeout: 10000 });
              if (clickType === 'right') {
                await page.click(selector, { button: 'right' });
              } else if (clickType === 'double') {
                await page.dblclick(selector);
              } else {
                await page.click(selector);
              }
              result.status = 'click done';
            } else {
              result.status = 'skip (no page or selector)';
            }
          } else if (node.type === 'hoverclick') {
            const { selector, clickSelector } = node.a || {};
            if (page && selector && clickSelector) {
              console.log(`[Workflow Test][hoverclick][${node.id}] Hovering over selector: ${selector}`);
              const hoverElement = page.locator(selector).first();
              await hoverElement.waitFor({ state: 'visible', timeout: 10000 });
              await hoverElement.hover();
              console.log(`[Workflow Test][hoverclick][${node.id}] Clicking on selector: ${clickSelector}`);
              await page.locator(clickSelector).waitFor({ state: 'visible', timeout: 10000 });
              await page.click(clickSelector);
              result.status = 'hoverclick done';
            } else {
              result.status = 'skip (no page, selector or clickSelector)';
            }
          } else if (node.type === 'input') {
            const { selector, text } = node.a || {};
            if (page && selector && text !== undefined) {
              console.log(`[Workflow Test][input][${node.id}] Typing text "${text}" into selector: ${selector}`);
              await page.locator(selector).waitFor({ state: 'visible', timeout: 10000 });
              await page.fill(selector, text);
              result.status = 'input done';
            } else {
              result.status = 'skip (no page, selector or text)';
            }
          } else {
            result.status = 'skip (not implemented)';
          }
        } catch (stepErr) {
          result.status = 'error: ' + stepErr.message;
          taskStatus = 'failed';
          stepFailed = true;
        }
        sendProgress(result);
        taskResult.push(result);
        if (stepFailed) {
          break;
        }
      }
      if (browser) await browser.close();
      endTime = new Date();
      if (conn && taskId) {
        await conn.execute(
          'UPDATE crawler_task SET end_time=?, status=?, result=? WHERE id=?',
          [endTime, taskStatus, JSON.stringify(taskResult), taskId]
        );
      }
      return { status: taskStatus, result: taskResult, taskId: taskId };
    } catch (e) {
      if (browser) await browser.close();
      endTime = new Date();
      taskStatus = 'failed';
      if (conn && taskId) {
        await conn.execute(
          'UPDATE crawler_task SET end_time=?, status=?, result=? WHERE id=?',
          [endTime, taskStatus, JSON.stringify({ error: e.message }), taskId]
        );
      }
      return { status: taskStatus, error: e.message, taskId: taskId };
    } finally {
      if (conn) await conn.end();
    }
  }

  // GET /api/workflow/crawler/test - 仅用于提示用户应使用POST方法
  router.get('/crawler/test', (req, res) => {
    res.status(405).end('请使用 POST');
  });

  // POST /api/workflow/crawler/test - 执行工作流测试
  router.post('/crawler/test', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    function sendSSE(data) {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      } catch (e) {
        console.error('sendSSE error:', e && e.message);
      }
    }

    let uuid = req.body.uuid;
    let workflow = req.body.workflow;

    if (!uuid) {
      sendSSE({ error: '缺少智能体uuid' });
      res.end();
      return;
    }

    const executionResult = await executeWorkflow(workflow, uuid, sendSSE);

    if (executionResult.status === 'failed') {
      sendSSE({ error: executionResult.error });
    } else {
      sendSSE({ done: true });
    }
    res.end();
  });

  // POST /api/workflow/execute - 执行单个工作流并返回结果
  router.post('/execute', async (req, res) => {
    let uuid = req.body.uuid;
    let workflow = req.body.workflow;

    if (!uuid) {
      return res.status(400).json({ error: '缺少智能体uuid' });
    }

    const collectedResults = [];
    function collectProgress(data) {
      collectedResults.push(data);
    }

    const executionResult = await executeWorkflow(workflow, uuid, collectProgress);

    if (executionResult.status === 'failed') {
      return res.status(500).json({ error: executionResult.error, details: collectedResults });
    } else {
      return res.json({ status: executionResult.status, result: executionResult.result, taskId: executionResult.taskId, details: collectedResults });
    }
  });

  return router;
};
