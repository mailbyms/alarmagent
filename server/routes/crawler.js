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

  /**
   * @swagger
   * /api/crawler/shot/{shotId}:
   *   get:
   *     summary: 根据shotId获取截图图像
   *     description: 通过在crawler_shot表中存储的shotId获取Base64编码的截图图像数据。
   *     parameters:
   *       - in: path
   *         name: shotId
   *         required: true
   *         schema:
   *           type: integer
   *         description: 截图在crawler_shot表中的ID
   *     responses:
   *       200:
   *         description: 成功获取截图图像
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 image_base64:
   *                   type: string
   *                   description: Base64编码的图像数据
   *       404:
   *         description: 未找到对应的截图图像
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *       500:
   *         description: 服务器错误
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   */
  router.get('/shot/:shotId', async (req, res) => {
    let conn;
    try {
      conn = await mysql.createConnection(dbConfig);
      const { shotId } = req.params;
      const [rows] = await conn.execute('SELECT image_base64 FROM crawler_shot WHERE id = ?', [shotId]);

      if (rows.length > 0) {
        res.json({ image_base64: rows[0].image_base64 });
      } else {
        res.status(404).json({ error: 'Image not found' });
      }
    } catch (err) {
      console.error('Error fetching image:', err);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (conn) await conn.end();
    }
  });

  return router;
};