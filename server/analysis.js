require('dotenv').config();
const https = require('https');

/**
 * Analyzes an image for alarm information using the Qwen-VL model via ModelScope API.
 * @param {string} imageBase64 The Base64 encoded image string.
 * @returns {Promise<object>} A promise that resolves to the analysis result object.
 */
async function analyzeImage(imageBase64) {
  const prompt = "这是一个监控系统截图，请仔细分析图片中是否存在任何形式的告警、警告或错误信息。如果存在，请用JSON格式返回，包含字段 'alarm_detected': true 和 'alarm_description': '对告警信息的描述'。如果不存在任何告警信息，请返回JSON格式，包含字段 'alarm_detected': false。";
  
  const postData = JSON.stringify({
    model: "Qwen/Qwen2.5-VL-72B-Instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBase64}`
            }
          }
        ]
      }
    ]
  });

  const options = {
    hostname: 'api-inference.modelscope.cn',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MODELSCOPE_API_KEY}`,
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('Raw Model API Response:', data); // Add this line for debugging
        try {
          const responseBody = JSON.parse(data);
          if (responseBody.choices && responseBody.choices[0]) {
            const content = responseBody.choices[0].message.content;
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
              resolve(JSON.parse(jsonMatch[1]));
            } else {
              resolve(JSON.parse(content));
            }
          } else {
            reject(new Error('Invalid response structure from model API: ' + data));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

module.exports = { analyzeImage };