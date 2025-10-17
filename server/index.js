require('dotenv').config();

// 判断是否开发模式
const isDev = process.env.NODE_ENV === 'development';

// ===== 依赖与工具导入 =====
const express = require('express');
const cors = require('cors');

// ===== Express App Setup =====
const app = express();
app.use(express.json());
app.use(cors());

// ===== 数据库连接配置 =====
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT
};

// ===== API Routers =====
const agentsRouter = require('./routes/agents')(dbConfig);
const workflowRouter = require('./routes/workflow')(dbConfig, isDev);
const crawlerRouter = require('./routes/crawler')(dbConfig);
const captchaRouter = require('./routes/captcha')(dbConfig);
const analysisRouter = require('./routes/analysis')(dbConfig);
const sitesRouter = require('./routes/sites')(dbConfig);

app.use('/api/agents', agentsRouter);
app.use('/api/workflow', workflowRouter);
app.use('/api/crawler', crawlerRouter);
app.use('/api/captcha', captchaRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/sites', sitesRouter);


// ===== 启动服务 =====
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});