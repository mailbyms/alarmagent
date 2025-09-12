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

const app = express();
app.use(express.json());
app.use(cors());

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
  host: '10.13.3.8',
  user: 'root', // 修改为你的MySQL用户名
  password: 'root', // 修改为你的MySQL密码
  database: 'alarmagent', // 修改为你的数据库名
  port: 7306
};

// 获取所有智能体
app.get('/api/agents', async (req, res) => {
  const { uuid } = req.query;
  try {
    const conn = await mysql.createConnection(dbConfig);
    let rows;
    if (uuid) {
      [rows] = await conn.execute('SELECT idx, uuid, name, icon, description, status, created_at, updated_at, screenshot_count, workflow FROM agents WHERE uuid = ?', [uuid]);
    } else {
      [rows] = await conn.execute('SELECT idx, uuid, name, icon, description, status, created_at, updated_at, screenshot_count, workflow FROM agents ORDER BY idx DESC');
    }
    await conn.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增智能体

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

  const workflow = req.body;
  if (!workflow || !workflow.d || !Array.isArray(workflow.d)) {
    sendSSE({ error: '参数格式错误，需包含 d 节点数组' });
    res.end();
    return;
  }
  const nodes = workflow.d;
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
  try {
    for (const node of ordered) {
      let result = { id: node.id, type: node.type, displayName: node.p && node.p.displayName };
      try {
        if (node.type === 'loginweb') {
          const { url, usernameSelector, passwordSelector, username, password } = node.a || {};
          browser = await chromium.launch({ headless: true });
          context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
          page = await context.newPage();
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
          if (usernameSelector && username) {
            await page.locator(usernameSelector).waitFor({ state: 'visible', timeout: 10000 });
            await page.fill(usernameSelector, username);
          }
          if (passwordSelector && password) {
            await page.locator(passwordSelector).waitFor({ state: 'visible', timeout: 10000 });
            await page.fill(passwordSelector, password);
          }
          await page.keyboard.press('Enter');
          await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
          result.status = 'loginweb done';
        } else if (node.type === 'openwebpage') {
          const { url } = node.a || {};
          if (page && url) {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
            result.status = 'openwebpage done';
          } else {
            result.status = 'skip (no page or url)';
          }
        } else if (node.type === 'delay') {
          const { delay } = node.a || {};
          if (page && delay) {
            await page.waitForTimeout(Number(delay));
            result.status = `delay ${delay}ms done`;
          } else {
            result.status = 'skip (no page or delay)';
          }
        } else if (node.type === 'screenshot') {
          if (page) {
            const ts = Date.now();
            const shotPath = path.join('shots', `${ts}.png`);
            ensureDir('shots');
            await page.screenshot({ path: shotPath, fullPage: true });
            result.status = 'screenshot saved';
            result.shotPath = shotPath;
          } else {
            result.status = 'skip (no page)';
          }
        } else if (node.type === 'click') {
          const { selector, clickType } = node.a || {};
          if (page && selector) {
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
      }
      sendSSE(result);
    }
    if (browser) await browser.close();
    sendSSE({ done: true });
    res.end();
  } catch (e) {
    if (browser) await browser.close();
    sendSSE({ error: e.message });
    res.end();
  }
});

// 启动服务
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

