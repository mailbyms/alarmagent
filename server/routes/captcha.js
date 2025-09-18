const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const http = require('http');
const sharp = require('sharp');
const { recognizeCaptcha } = require('../analysisService');

module.exports = (dbConfig) => {
  // GET /api/captcha/shots - 获取验证码识别历史记录（分页）
  router.get('/shots', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;
    try {
      const conn = await mysql.createConnection(dbConfig);
      const [rows] = await conn.execute(
        'SELECT id, task_id, created_at, image_base64, recognized_text, raw_text FROM captcha_shot ORDER BY id DESC LIMIT ? OFFSET ?',
        [pageSize, offset]
      );
      const [[{ total } = { total: 0 }]] = await conn.execute('SELECT COUNT(*) as total FROM captcha_shot');
      await conn.end();
      res.json({ list: rows, total });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/captcha/shots/:id - 更新指定ID的验证码记录的原始内容（人工校对）
  router.post('/shots/:id', async (req, res) => {
    const { id } = req.params;
    const { raw_text } = req.body;

    if (raw_text === undefined) {
      return res.status(400).json({ error: 'raw_text is required' });
    }

    try {
      const conn = await mysql.createConnection(dbConfig);
      const [result] = await conn.execute(
        'UPDATE captcha_shot SET raw_text = ? WHERE id = ?',
        [raw_text, id]
      );
      await conn.end();
      
      if (result.affectedRows > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Shot not found' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/captcha/backfill - 回填数据库中未被识别的验证码
  router.post('/backfill', async (req, res) => {
    res.status(202).json({ message: 'Captcha backfill task started. Check server logs for progress.' });

    (async () => {
      let processedCount = 0;
      let errorCount = 0;
      let conn = null;

      try {
        console.log('[Backfill] Starting captcha backfill process...');
        conn = await mysql.createConnection(dbConfig);

        const [recordsToProcess] = await conn.execute(
          "SELECT id, image_base64 FROM captcha_shot WHERE recognized_text IS NULL OR recognized_text = ''"
        );

        if (recordsToProcess.length === 0) {
          console.log('[Backfill] No records to process.');
          if (conn) await conn.end();
          return;
        }

        console.log(`[Backfill] Found ${recordsToProcess.length} records to process.`);

        for (const record of recordsToProcess) {
          try {
            console.log(`[Backfill] Processing record ID: ${record.id}`);
            const analysisResult = await recognizeCaptcha(record.image_base64);
            const recognizedText = (analysisResult && analysisResult.text) ? analysisResult.text.trim() : '';

            if (recognizedText) {
              await conn.execute(
                'UPDATE captcha_shot SET recognized_text = ?, raw_text = ? WHERE id = ?',
                [recognizedText, recognizedText, record.id]
              );
              console.log(`[Backfill] Updated record ID: ${record.id} with text: "${recognizedText}"`);
              processedCount++;
            } else {
              console.warn(`[Backfill] OCR returned no text for record ID: ${record.id}`);
            }
          } catch (err) {
            errorCount++;
            console.error(`[Backfill] Error processing record ID: ${record.id}`, err.message);
          }
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (e) {
        console.error('[Backfill] A critical error occurred during the backfill process:', e.message);
      } finally {
        if (conn) await conn.end();
        console.log(`[Backfill] Finished. Processed: ${processedCount}, Errors: ${errorCount}`);
      }
    })();
  });

  // POST /api/captcha/build-test-set - 构建验证码测试集
  router.post('/build-test-set', async (req, res) => {
    const count = req.body.count || 1000;
    
    res.status(202).json({ message: `Task started to fetch ${count} captcha images. This will run in the background.` });

    (async () => {
      let successCount = 0;
      let errorCount = 0;
      const url = 'http://112.17.84.56:47100/scooper-user/data/login/captcha';
      
      console.log(`[Build Test Set] Starting to fetch ${count} images...`);

      for (let i = 0; i < count; i++) {
        try {
          const imageBuffer = await new Promise((resolve, reject) => {
            http.get(url, (response) => {
              const chunks = [];
              response.on('data', (chunk) => chunks.push(chunk));
              response.on('end', () => resolve(Buffer.concat(chunks)));
              response.on('error', reject);
            });
          });

          const pngBuffer = await sharp(imageBuffer).png().toBuffer();
          const pngBase64 = pngBuffer.toString('base64');

          const conn = await mysql.createConnection(dbConfig);
          await conn.execute(
            'INSERT INTO captcha_shot (task_id, created_at, image_base64, recognized_text) VALUES (?, ?, ?, ?)',
            [0, new Date(), pngBase64, null]
          );
          await conn.end();
          
          successCount++;
          console.log(`[Build Test Set] Successfully fetched and saved image ${i + 1}/${count}`);

        } catch (err) {
          errorCount++;
          console.error(`[Build Test Set] Failed to process image ${i + 1}/${count}:`, err.message);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      console.log(`[Build Test Set] Finished. Success: ${successCount}, Errors: ${errorCount}`);
    })();
  });

  return router;
};