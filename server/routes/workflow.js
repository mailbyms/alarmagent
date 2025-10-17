const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { analyzeImage, recognizeCaptcha } = require('../analysisService');

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
ensureDir(SESSIONS_DIR);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = (dbConfig, isDev) => {
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
        // SSE requires each event to be terminated by a blank line
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        // flush if available (some environments support res.flush)
        if (typeof res.flush === 'function') res.flush();
      } catch (e) {
        console.error('sendSSE error:', e && e.message);
      }
    }

    let uuid, workflow;
    if (req.body && req.body.workflow && req.body.uuid) {
      uuid = req.body.uuid;
      workflow = req.body.workflow;
    } else {
      workflow = req.body;
      uuid = req.body.uuid;
    }
    if (!uuid) {
      sendSSE({ error: '缺少智能体uuid' });
      res.end();
      return;
    }
    if (!workflow || !workflow.d || !Array.isArray(workflow.d)) {
      sendSSE({ error: '参数格式错误，需包含 d 节点数组' });
      res.end();
      return;
    }
    const nodes = workflow.d;

    let taskId = null;
    let conn = null;
    const startTime = new Date();
    try {
      conn = await mysql.createConnection(dbConfig);
      const [result] = await conn.execute(
        'INSERT INTO crawler_task (agent_uuid, workflow_json, start_time, status) VALUES (?, ?, ?, ?)',
        [uuid, JSON.stringify(workflow), startTime, 'running']
      );
      taskId = result.insertId;
    } catch (err) {
      sendSSE({ error: '任务入库失败: ' + err.message });
      res.end();
      if (conn) await conn.end();
      return;
    }
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });
    const begin = nodes.find(n => n.type === 'begin');
    if (!begin) {
      sendSSE({ error: '未找到 begin 节点' });
      res.end();
      return;
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
            //sendSSE({ info: `Inserted login node ${loginNodeId} for site ${site.id}` });
          }
        } catch (qe) {
          console.warn('Failed to load site for begin.siteId', qe && qe.message);
        }
      }
    } catch (outerErr) {
      console.warn('Error while trying to insert login node:', outerErr && outerErr.message);
    }

    // 以json形式打印出最终的节点列表
    //console.log('Final workflow nodes:', JSON.stringify(nodes, null, 2));
    
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

    let browser, context, page;
    let taskStatus = 'success';
    let taskResult = [];
    let endTime = null;
    try {
      for (const node of ordered) {
        let result = { id: node.id, type: node.type, displayName: node.p && node.p.displayName };
        try {
          if (node.type === 'loginweb') {
            const { homeUrl, url, usernameSelector, passwordSelector, username, password, useCaptcha, captchaImageSelector, captchaInputSelector } = node.a || {};
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

              // 4. Verify login success and save session
              console.log(`[Workflow Test][loginweb][${node.id}] Verifying login success by navigating to home URL: ${homeUrl}`);
              await page.goto(homeUrl, { waitUntil: 'networkidle', timeout: 15000 });
              const finalUrl = page.url();
              console.log(`[Workflow Test][loginweb][${node.id}] Final URL after navigating to home is: ${finalUrl}`);

              if (!finalUrl.includes('/login')) {
                console.log(`[Workflow Test][loginweb][${node.id}] Login successful.`);
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
              try {
                const imgBase64 = imgBuffer.toString('base64');
                if (conn && taskId) {
                  await conn.execute(
                    'INSERT INTO crawler_shot (task_id, created_at, image_base64) VALUES (?, ?, ?)',
                    [taskId, new Date(), imgBase64]
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
        }
        sendSSE(result);
        taskResult.push(result);
      }
      if (browser) await browser.close();
      endTime = new Date();
      if (conn && taskId) {
        await conn.execute(
          'UPDATE crawler_task SET end_time=?, status=?, result=? WHERE id=?',
          [endTime, taskStatus, JSON.stringify(taskResult), taskId]
        );
      }
      sendSSE({ done: true });
      res.end();
      if (conn) await conn.end();
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
      sendSSE({ error: e.message });
      res.end();
      if (conn) await conn.end();
    }
  });

  return router;
};
