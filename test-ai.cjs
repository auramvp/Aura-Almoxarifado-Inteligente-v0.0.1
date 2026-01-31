
const https = require('https');

const data = JSON.stringify({
  model: "google/gemma-2-27b-it",
  messages: [{ role: "user", content: "test" }]
});

const options = {
  hostname: 'openrouter.ai',
  path: '/api/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer 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',
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
