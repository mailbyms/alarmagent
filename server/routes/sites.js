const express = require('express');
const router = express.Router();

module.exports = (dbConfig) => {
  // GET /api/sites - list all sites
  router.get('/', async (req, res) => {
    let conn;
    try {
      const mysql = require('mysql2/promise');
      conn = await mysql.createConnection(dbConfig);
      const [rows] = await conn.execute('SELECT id, name, home_url, login_steps, created_at FROM sites ORDER BY id DESC');
      // parse login_steps if stored as JSON string
      const list = rows.map(r => ({
        ...r,
        login_steps: typeof r.login_steps === 'string' && r.login_steps ? JSON.parse(r.login_steps) : r.login_steps
      }));
      res.json(list);
    } catch (e) {
      console.error('GET /api/sites error', e.message);
      res.status(500).json({ error: e.message });
    } finally {
      if (conn) await conn.end();
    }
  });

  // GET /api/sites/:id
  router.get('/:id', async (req, res) => {
    const id = req.params.id;
    let conn;
    try {
      const mysql = require('mysql2/promise');
      conn = await mysql.createConnection(dbConfig);
      const [rows] = await conn.execute('SELECT id, name, home_url, login_steps, created_at FROM sites WHERE id = ?', [id]);
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const r = rows[0];
      r.login_steps = typeof r.login_steps === 'string' && r.login_steps ? JSON.parse(r.login_steps) : r.login_steps;
      res.json(r);
    } catch (e) {
      console.error('GET /api/sites/:id error', e.message);
      res.status(500).json({ error: e.message });
    } finally {
      if (conn) await conn.end();
    }
  });

  // POST /api/sites - create
  router.post('/', async (req, res) => {
    const { name, home_url, login_steps } = req.body || {};
    if (!name || !home_url) return res.status(400).json({ error: 'name and home_url required' });
    let conn;
    try {
      const mysql = require('mysql2/promise');
      conn = await mysql.createConnection(dbConfig);
      const ls = login_steps && typeof login_steps !== 'string' ? JSON.stringify(login_steps) : (login_steps || null);
      const [result] = await conn.execute('INSERT INTO sites (name, home_url, login_steps, created_at) VALUES (?, ?, ?, ?)', [name, home_url, ls, new Date()]);
      res.json({ id: result.insertId });
    } catch (e) {
      console.error('POST /api/sites error', e.message);
      res.status(500).json({ error: e.message });
    } finally {
      if (conn) await conn.end();
    }
  });

  // PUT /api/sites/:id - update
  router.put('/:id', async (req, res) => {
    const id = req.params.id;
    const { name, home_url, login_steps } = req.body || {};
    let conn;
    try {
      const mysql = require('mysql2/promise');
      conn = await mysql.createConnection(dbConfig);
      const ls = login_steps && typeof login_steps !== 'string' ? JSON.stringify(login_steps) : (login_steps || null);
      await conn.execute('UPDATE sites SET name=?, home_url=?, login_steps=? WHERE id=?', [name, home_url, ls, id]);
      res.json({ ok: true });
    } catch (e) {
      console.error('PUT /api/sites/:id error', e.message);
      res.status(500).json({ error: e.message });
    } finally {
      if (conn) await conn.end();
    }
  });

  // DELETE /api/sites/:id
  router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    let conn;
    try {
      const mysql = require('mysql2/promise');
      conn = await mysql.createConnection(dbConfig);
      await conn.execute('DELETE FROM sites WHERE id=?', [id]);
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE /api/sites/:id error', e.message);
      res.status(500).json({ error: e.message });
    } finally {
      if (conn) await conn.end();
    }
  });

  return router;
};
