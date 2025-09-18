require('dotenv').config();

// 判断是否开发模式
const isDev = process.env.NODE_ENV === 'development';

// ===== 爬虫相关依赖与工具导入 =====
const path = require('path');
const fs = require('fs');
// 保证目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
const { chromium } = require('playwright');

// 基于 Node.js + Express + mysql2 的本地API服务
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid'); // 顶部引入
const http = require('http');
const sharp = require('sharp');

const { analyzeImage, recognizeCaptcha } = require('./analysis');

const app = express();
app.use(express.json());
app.use(cors());

// 删除智能体
app.delete('/api/agents/:uuid', async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) return res.status(400).json({ error: '参数缺失' });
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [result] = await conn.execute('DELETE FROM agents WHERE uuid=?', [uuid]);
    await conn.end();
    if (result.affectedRows > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '未找到对应uuid' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新智能体名称
app.post('/api/agents/:uuid/name', async (req, res) => {
  const { uuid } = req.params;
  const { name } = req.body;
  if (!uuid || !name) return res.status(400).json({ error: '参数缺失' });
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [result] = await conn.execute('UPDATE agents SET name=?, updated_at=NOW() WHERE uuid=?', [name, uuid]);
    await conn.end();
    if (result.affectedRows > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '未找到对应uuid' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 保存/更新指定智能体的 workflow 字段
app.post('/api/agents/:uuid/workflow', async (req, res) => {
  const { uuid } = req.params;
  const { workflow } = req.body;
  if (!uuid || !workflow) {
    return res.status(400).json({ error: 'uuid和workflow为必填项' });
  }
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [result] = await conn.execute(
      'UPDATE agents SET workflow = ? WHERE uuid = ?',
      [JSON.stringify(workflow), uuid]
    );
    await conn.end();
    if (result.affectedRows > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '未找到对应uuid' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || '10.13.3.8',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'alarmagent',
  port: process.env.DB_PORT || 7306
};

// 获取所有智能体，支持分页
app.get('/api/agents', async (req, res) => {
  const { uuid, page, pageSize } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const size = Math.max(1, Math.min(100, parseInt(pageSize) || 10));
  const offset = (pageNum - 1) * size;
  try {
    const conn = await mysql.createConnection(dbConfig);
    let rows, total = 0;
    if (uuid) {
      [rows] = await conn.execute('SELECT idx, uuid, name, icon, description, status, created_at, updated_at, screenshot_count, workflow FROM agents WHERE uuid = ?', [uuid]);
      total = rows.length;
    } else {
      [rows] = await conn.execute('SELECT idx, uuid, name, icon, description, status, created_at, updated_at, screenshot_count, workflow FROM agents ORDER BY idx DESC LIMIT ? OFFSET ?', [size, offset]);
      const [[{ total: t } = { total: 0 }]] = await conn.execute('SELECT COUNT(*) as total FROM agents');
      total = t;
    }
    await conn.end();
    res.json({ list: rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增智能体
app.post('/api/agents', async (req, res) => {
  const { name, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const uuid = uuidv4();
  const now = new Date();
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute(
      'INSERT INTO agents (uuid, icon, name, description, status, created_at, updated_at, screenshot_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [uuid, icon || '🤖', name, description || '', 'running', now, now, 0]
    );
    await conn.end();
    res.json({ uuid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/workflow/crawler/test', (req, res) => {
  res.status(405).end('请使用 POST');
});

app.post('/api/workflow/crawler/test', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  function sendSSE(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // 支持新格式 { uuid, workflow }
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

  // ===== 任务入库 =====
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
  // 顺序遍历
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

          // CAPTCHA LOGIC START
          if (useCaptcha && captchaImageSelector && captchaInputSelector) {
            console.log(`[Workflow Test][loginweb][${node.id}] Captcha enabled. Selector: ${captchaImageSelector}`);
            const captchaElement = page.locator(captchaImageSelector);
            await captchaElement.waitFor({ state: 'visible', timeout: 10000 });
            
            const captchaBuffer = await captchaElement.screenshot();
            const captchaBase64 = captchaBuffer.toString('base64');
            
            // Call analysis service
            const analysisResult = await recognizeCaptcha(captchaBase64);
            const captchaCode = (analysisResult && analysisResult.text) ? analysisResult.text.trim() : '';
            console.log(`[Workflow Test][loginweb][${node.id}] Recognized captcha code: ${captchaCode}`);

            // Save screenshot and result to DB
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
          // CAPTCHA LOGIC END

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
            // 保存到数据库
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
    // 更新任务为成功
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
    // 更新任务为失败
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

// 获取所有爬虫任务记录，支持分页
app.get('/api/crawler/tasks', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize) || 10));
  const offset = (page - 1) * pageSize;
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(`
      SELECT
        t.id,
        t.agent_uuid,
        a.name as agent_name,
        t.workflow_json,
        t.start_time,
        t.end_time,
        t.status,
        t.result,
        t.analysis_result
      FROM
        crawler_task t
      LEFT JOIN
        agents a ON t.agent_uuid = a.uuid
      ORDER BY
        t.id DESC
      LIMIT ? OFFSET ?
    `, [pageSize, offset]);
    const [[{ total } = { total: 0 }]] = await conn.execute('SELECT COUNT(*) as total FROM crawler_task');
    await conn.end();
    res.json({ list: rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取指定任务的截图
app.get('/api/crawler/shots', async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.json([]);
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT id, task_id, created_at, image_base64 FROM crawler_shot WHERE task_id = ? ORDER BY id ASC', [taskId]);
    await conn.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/captcha/shots', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize) || 10));
  const offset = (page - 1) * pageSize;
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(
      'SELECT id, task_id, created_at, image_base64, recognized_text, raw_text FROM captcha_shot ORDER BY id DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
    const [[{ total } = { total: 0 }]] = await conn.execute('SELECT COUNT(*) as total FROM captcha_shot');
    await conn.end();
    res.json({ list: rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/captcha/shots/:id', async (req, res) => {
  const { id } = req.params;
  const { raw_text } = req.body;

  if (raw_text === undefined) {
    return res.status(400).json({ error: 'raw_text is required' });
  }

  try {
    const conn = await mysql.createConnection(dbConfig);
    const [result] = await conn.execute(
      'UPDATE captcha_shot SET raw_text = ? WHERE id = ?',
      [raw_text, id]
    );
    await conn.end();
    
    if (result.affectedRows > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Shot not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/captcha/backfill', async (req, res) => {
  res.status(202).json({ message: 'Captcha backfill task started. Check server logs for progress.' });

  (async () => {
    let processedCount = 0;
    let errorCount = 0;
    let conn = null;

    try {
      console.log('[Backfill] Starting captcha backfill process...');
      conn = await mysql.createConnection(dbConfig);

      const [recordsToProcess] = await conn.execute(
        "SELECT id, image_base64 FROM captcha_shot WHERE recognized_text IS NULL OR recognized_text = ''"
      );

      if (recordsToProcess.length === 0) {
        console.log('[Backfill] No records to process.');
        if (conn) await conn.end();
        return;
      }

      console.log(`[Backfill] Found ${recordsToProcess.length} records to process.`);

      for (const record of recordsToProcess) {
        try {
          console.log(`[Backfill] Processing record ID: ${record.id}`);
          const analysisResult = await recognizeCaptcha(record.image_base64);
          const recognizedText = (analysisResult && analysisResult.text) ? analysisResult.text.trim() : '';

          if (recognizedText) {
            await conn.execute(
              'UPDATE captcha_shot SET recognized_text = ?, raw_text = ? WHERE id = ?',
              [recognizedText, recognizedText, record.id]
            );
            console.log(`[Backfill] Updated record ID: ${record.id} with text: "${recognizedText}"`);
            processedCount++;
          } else {
            console.warn(`[Backfill] OCR returned no text for record ID: ${record.id}`);
          }
        } catch (err) {
          errorCount++;
          console.error(`[Backfill] Error processing record ID: ${record.id}`, err.message);
        }
        // Delay to be kind to the OCR API
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (e) {
      console.error('[Backfill] A critical error occurred during the backfill process:', e.message);
    } finally {
      if (conn) await conn.end();
      console.log(`[Backfill] Finished. Processed: ${processedCount}, Errors: ${errorCount}`);
    }
  })();
});

// Analyze the latest screenshot for a given task
app.post('/api/analysis/analyze-shots', async (req, res) => {
  const { taskId } = req.body;
  if (!taskId) {
    return res.status(400).json({ error: 'taskId is required' });
  }

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    // Fetch the most recent screenshot for the task
    const [shots] = await conn.execute(
      'SELECT image_base64 FROM crawler_shot WHERE task_id = ? ORDER BY id DESC LIMIT 1',
      [taskId]
    );

    if (shots.length === 0) {
      return res.status(404).json({ error: 'No screenshots found for this task.' });
    }

    const imageBase64 = shots[0].image_base64;

    // Perform analysis
    const analysisResult = await analyzeImage(imageBase64);

    // Update the task with the analysis result
    await conn.execute(
      'UPDATE crawler_task SET analysis_result = ? WHERE id = ?',
      [JSON.stringify(analysisResult), taskId]
    );

    res.json(analysisResult);

  } catch (err) {
    console.error('Error during analysis or DB operation:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  } finally {
    if (conn) {
      await conn.end();
    }
  }
});

app.post('/api/captcha/build-test-set', async (req, res) => {
  const count = req.body.count || 1000; // Allow specifying count via request body
  
  res.status(202).json({ message: `Task started to fetch ${count} captcha images. This will run in the background.` });

  // Run the long task without holding the request
  (async () => {
    let successCount = 0;
    let errorCount = 0;
    const url = 'http://112.17.84.56:47100/scooper-user/data/login/captcha';
    
    console.log(`[Build Test Set] Starting to fetch ${count} images...`);

    for (let i = 0; i < count; i++) {
      try {
        const imageBuffer = await new Promise((resolve, reject) => {
          http.get(url, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
          });
        });

        const pngBuffer = await sharp(imageBuffer).png().toBuffer();
        const pngBase64 = pngBuffer.toString('base64');

        const conn = await mysql.createConnection(dbConfig);
        await conn.execute(
          'INSERT INTO captcha_shot (task_id, created_at, image_base64, recognized_text) VALUES (?, ?, ?, ?)',
          [0, new Date(), pngBase64, null] // Using task_id=0 for test set
        );
        await conn.end();
        
        successCount++;
        console.log(`[Build Test Set] Successfully fetched and saved image ${i + 1}/${count}`);

      } catch (err) {
        errorCount++;
        console.error(`[Build Test Set] Failed to process image ${i + 1}/${count}:`, err.message);
      }
      // Add a small delay to avoid overwhelming the source server
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`[Build Test Set] Finished. Success: ${successCount}, Errors: ${errorCount}`);
  })();
});

// 启动服务
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

