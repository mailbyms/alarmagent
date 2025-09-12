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


// 反序列化 workflow 并按连线顺序打印节点
app.post('/api/workflow/print', (req, res) => {
  const workflow = req.body;
  if (!workflow || !workflow.d || !Array.isArray(workflow.d)) {
    return res.status(400).json({ error: '参数格式错误，需包含 d 节点数组' });
  }
  const nodes = workflow.d;
  // 构建 id->node 映射
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });
  // 找到 begin 节点
  const begin = nodes.find(n => n.type === 'begin');
  if (!begin) {
    return res.status(400).json({ error: '未找到 begin 节点' });
  }
  // 按连线顺序遍历（适配 wires: [[id]] 结构）
  const ordered = [];
  const visited = new Set();
  function visit(node) {
    if (!node || visited.has(node.id)) return;
    ordered.push(node);
    visited.add(node.id);
    if (Array.isArray(node.wires)) {
      node.wires.forEach(arr => {
        if (Array.isArray(arr)) {
          arr.forEach(id => {
            if (typeof id === 'string') visit(nodeMap[id]);
          });
        } else if (typeof arr === 'string') {
          visit(nodeMap[arr]);
        }
      });
    }
  }
  visit(begin);
  // 打印节点，显示主属性
  ordered.forEach(n => {
    const main = `[${n.type}] id=${n.id} displayName=${n.p && n.p.displayName}`;
    const extra = n.a && Object.keys(n.a).length > 0 ? ` a=${JSON.stringify(n.a)}` : '';
    console.log(main + extra);
  });
  res.json({ ordered: ordered.map(n => ({ id: n.id, type: n.type, displayName: n.p && n.p.displayName, a: n.a })) });
});


// 按 workflow 顺序执行爬虫步骤
app.post('/api/workflow/crawler/test', async (req, res) => {
  const workflow = req.body;
  if (!workflow || !workflow.d || !Array.isArray(workflow.d)) {
    return res.status(400).json({ error: '参数格式错误，需包含 d 节点数组' });
  }
  const nodes = workflow.d;
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });
  const begin = nodes.find(n => n.type === 'begin');
  if (!begin) {
    return res.status(400).json({ error: '未找到 begin 节点' });
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

  // 执行爬虫步骤
  let browser, context, page;
  const stepResults = [];
  try {
    for (const node of ordered) {
      let result = { id: node.id, type: node.type, displayName: node.p && node.p.displayName };
      if (node.type === 'loginweb') {
        // 登录网站节点
        const { url, usernameSelector, passwordSelector, username, password } = node.a || {};
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
        page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        // 填写用户名
        if (usernameSelector && username) {
          await page.locator(usernameSelector).waitFor({ state: 'visible', timeout: 10000 });
          await page.fill(usernameSelector, username);
        }
        // 填写密码
        if (passwordSelector && password) {
          await page.locator(passwordSelector).waitFor({ state: 'visible', timeout: 10000 });
          await page.fill(passwordSelector, password);
        }
        // 提交表单（尝试回车或点击登录按钮）
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        result.status = 'loginweb done';
      } else if (node.type === 'openwebpage') {
        // 打开网页
        const { url } = node.a || {};
        if (page && url) {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
          result.status = 'openwebpage done';
        } else {
          result.status = 'skip (no page or url)';
        }
      } else if (node.type === 'delay') {
        // 等待
        const { delay } = node.a || {};
        if (page && delay) {
          await page.waitForTimeout(Number(delay));
          result.status = `delay ${delay}ms done`;
        } else {
          result.status = 'skip (no page or delay)';
        }
      } else if (node.type === 'screenshot') {
        // 截图
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
        // 点击
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
        // 输入
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
      stepResults.push(result);
    }
    if (browser) await browser.close();
    res.json({ steps: stepResults });
  } catch (e) {
    if (browser) await browser.close();
    res.status(500).json({ error: e.message, steps: stepResults });
  }
});

// 启动服务
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

