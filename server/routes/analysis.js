const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { analyzeImage } = require('../analysisService');

module.exports = (dbConfig) => {
  // POST /api/analysis/analyze-shots - 分析指定任务的最新截图
  router.post('/analyze-shots', async (req, res) => {
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

  return router;
};