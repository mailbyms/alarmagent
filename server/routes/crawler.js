const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

module.exports = (dbConfig) => {
  // GET /api/crawler/tasks - 获取所有爬虫任务记录（分页）
  router.get('/tasks', async (req, res) => {
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

  // GET /api/crawler/shots - 获取指定任务的截图列表
  router.get('/shots', async (req, res) => {
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

  return router;
};