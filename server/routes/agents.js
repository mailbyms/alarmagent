const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// This module exports a function that takes dbConfig and returns the router
module.exports = (dbConfig) => {
  /**
   * @swagger
   * /api/agents:
   *   get:
   *     summary: 获取智能体列表
   *     description: 获取所有智能体或根据 UUID 查询特定智能体，支持分页。
   *     parameters:
   *       - in: query
   *         name: uuid
   *         schema:
   *           type: string
   *         description: 智能体的唯一标识符
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: 页码
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 10
   *         description: 每页返回的数量
   *     responses:
   *       200:
   *         description: 成功获取智能体列表
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 list:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       idx:
   *                         type: integer
   *                       uuid:
   *                         type: string
   *                       name:
   *                         type: string
   *                       icon:
   *                         type: string
   *                       description:
   *                         type: string
   *                       status:
   *                         type: string
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                       updated_at:
   *                         type: string
   *                         format: date-time
   *                       screenshot_count:
   *                         type: integer
   *                       workflow:
   *                         type: string
   *                 total:
   *                   type: integer
   *                   description: 总记录数
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
  router.get('/', async (req, res) => {
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

  /**
   * /api/agents:
   *   post:
   *     summary: 新增智能体
   *     description: 创建一个新的智能体。
   */
  router.post('/', async (req, res) => {
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

  // DELETE /api/agents/:uuid - 删除智能体
  router.delete('/:uuid', async (req, res) => {
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

  // POST /api/agents/:uuid/name - 更新智能体名称
  router.post('/:uuid/name', async (req, res) => {
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

  // POST /api/agents/:uuid/workflow - 保存/更新指定智能体的 workflow 字段
  router.post('/:uuid/workflow', async (req, res) => {
    const { uuid } = req.params;
    const { workflow } = req.body;
    if (!uuid || !workflow) {
      return res.status(400).json({ error: 'uuid和workflow为必填项' });
    }
    try {
      const conn = await mysql.createConnection(dbConfig);
      const [result] = await conn.execute(
        'UPDATE agents SET workflow = ? WHERE uuid = ?',
        [workflow, uuid]
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

  return router;
};