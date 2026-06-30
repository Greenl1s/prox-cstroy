const YANDEX_OAUTH_TOKEN = 'y0__wgBEK3T6dMDGIXTRCCQwt-NGDD38tqJCP5ZytMKwuD_9zAzbbcQKjP-W14M'; 
const WRITE_SECRET = 'mySecretKey123';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Write-Secret, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0'
    };
    if (targetUrl.includes('cloud-api.yandex.net')) {
      headers['Authorization'] = 'OAuth ' + YANDEX_OAUTH_TOKEN;
    }
    const secret = req.headers['x-write-secret'];
    if (secret) {
      headers['X-Write-Secret'] = secret;
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    // Для бинарных файлов (Excel) – возвращаем как Buffer
    const contentType = response.headers.get('content-type') || '';
    const isBinary = contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
                     contentType.includes('application/octet-stream') ||
                     targetUrl.includes('downloader.disk.yandex.ru');

    if (isBinary) {
      const buffer = await response.arrayBuffer();
      // Отключаем сжатие и возвращаем бинарные данные
      res.status(response.status)
         .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
         .setHeader('Content-Length', buffer.byteLength)
         .setHeader('Content-Encoding', 'identity')
         .send(Buffer.from(buffer));
    } else {
      const data = await response.text();
      res.status(response.status)
         .setHeader('Content-Type', contentType || 'application/json')
         .send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}
