// 基于 Node.js + Express + mysql2 的本地API服务
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

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
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT idx, uuid, name, description, status, created_at, updated_at, screenshot_count FROM agents ORDER BY idx DESC');
    await conn.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 启动服务
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
