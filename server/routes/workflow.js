const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { analyzeImage, recognizeCaptcha } = require('../analysisService');

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
      res.write(`data: ${JSON.stringify(data)}

`);
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
            const { url, usernameSelector, passwordSelector, username, password, useCaptcha, captchaImageSelector, captchaInputSelector } = node.a || {};
            console.log(`[Workflow Test][loginweb][${node.id}] Opening URL: ${url}`);
            browser = await chromium.launch({ headless: true });
            context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
            page = await context.newPage();
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            if (useCaptcha && captchaImageSelector && captchaInputSelector) {
              console.log(`[Workflow Test][loginweb][${node.id}] Captcha enabled. Selector: ${captchaImageSelector}`);
              const captchaElement = page.locator(captchaImageSelector);
              await captchaElement.waitFor({ state: 'visible', timeout: 10000 });
              const captchaBuffer = await captchaElement.screenshot();
              const captchaBase64 = captchaBuffer.toString('base64');
              const analysisResult = await recognizeCaptcha(captchaBase64);
              const captchaCode = (analysisResult && analysisResult.text) ? analysisResult.text.trim() : '';
              console.log(`[Workflow Test][loginweb][${node.id}] Recognized captcha code: ${captchaCode}`);
              try {
                if (conn && taskId) {
                  await conn.execute(
                    'INSERT INTO captcha_shot (task_id, created_at, image_base64, recognized_text, raw_text) VALUES (?, ?, ?, ?, ?)',
                    [taskId, new Date(), captchaBase64, captchaCode, captchaCode]
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
            await page.keyboard.press('Enter');
            await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
            result.status = 'loginweb done';
          } else if (node.type === 'openwebpage') {
            const { url } = node.a || {};
            if (page && url) {
              console.log(`[Workflow Test][openwebpage][${node.id}] Opening URL: ${url}`);
              await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
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
