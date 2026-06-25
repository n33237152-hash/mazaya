const https = require('https');
const crypto = require('crypto');

exports.handler = async function(event) {
  // فقط POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { publicId } = body;
  if (!publicId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'publicId required' }) };
  }

  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey     = process.env.CLOUDINARY_API_KEY;
  const apiSecret  = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Cloudinary env vars missing' }) };
  }

  // توقيع الطلب
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign    = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const params = new URLSearchParams({
    public_id: publicId,
    timestamp:  String(timestamp),
    api_key:    apiKey,
    signature:  signature,
  });

  // إرسال طلب الحذف لـ Cloudinary
  const result = await new Promise((resolve, reject) => {
    const postData = params.toString();
    const req = https.request({
      hostname: 'api.cloudinary.com',
      path:     `/v1_1/${cloudName}/image/destroy`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
};
