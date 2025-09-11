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

// 启动服务
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
