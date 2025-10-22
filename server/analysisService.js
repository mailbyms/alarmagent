require('dotenv').config();
const https = require('https');
const http = require('http'); // Using http for ddddocr
const querystring = require('querystring');

// This function remains for calling the Qwen-VL model for alarm analysis
async function callModel(imageBase64, prompt) {
  const postData = JSON.stringify({
    model: "Qwen/Qwen2.5-VL-72B-Instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('Raw Model API Response:', data); // for debugging
        try {
          const responseBody = JSON.parse(data);
          if (responseBody.choices && responseBody.choices[0]) {
            resolve(responseBody.choices[0].message.content);
          } else {
            reject(new Error('Invalid response structure from model API: ' + data));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', (error) => { reject(error); });
    req.write(postData);
    req.end();
  });
}

/**
 * Analyzes an image for alarm information.
 */
async function analyzeImage(imageBase64) {
  const prompt = "这是一个监控系统截图，请仔细分析图片中是否存在任何形式的告警、警告或错误信息。如果存在，请用JSON格式返回，包含字段 'alarm_detected': true 和 'alarm_description': '对告警信息的描述'。如果不存在任何告警信息，请返回JSON格式，包含字段 'alarm_detected': false。";
  const content = await callModel(imageBase64, prompt);
  try {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse JSON from analyzeImage content:", content);
    throw new Error("Model did not return valid JSON for alarm analysis.");
  }
}

/**
 * Recognizes text from a captcha image using ddddocr-api.
 */
async function analyzeImageWithPrompt(imageBase64, prompt) {
  const content = await callModel(imageBase64, prompt);
  try {
    // Attempt to parse the content as JSON, looking for a markdown block first.
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    // If no markdown block, try to parse the whole content.
    return JSON.parse(content);
  } catch (e) {
    console.warn("Could not parse VLM response as JSON, returning raw content.", content);
    // If parsing fails, return the raw content string.
    return content;
  }
}

/**
 * Recognizes text from a captcha image using ddddocr-api.
 */
async function recognizeCaptcha(imageBase64) {
  const ddddocrApiUrl = process.env.DDDDOCR_API_URL || 'http://localhost:8000/ocr';
  
  const postData = querystring.stringify({
    image: imageBase64,
    probability: false,
    png_fix: false
  });

  const url = new URL(ddddocrApiUrl);

  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const responseBody = JSON.parse(data);
          if (responseBody && responseBody.code === 200 && responseBody.data) {
            // Keep the same return format as the previous implementation
            resolve({ text: responseBody.data });
          } else {
            reject(new Error('Invalid response from ddddocr API: ' + data));
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

module.exports = { analyzeImage, recognizeCaptcha, analyzeImageWithPrompt };
