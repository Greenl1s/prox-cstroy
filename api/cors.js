const YANDEX_OAUTH_TOKEN = 'y0__wgBEK3T6dMDGIXTRCCQwt-NGDD38tqJCP5ZytMKwuD_9zAzbbcQKjP-W14M'; 
const WRITE_SECRET = 'mySecretKey123';
const FILE_PATH = '/Учет.xlsx';

export default async function handler(req, res) {
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

    // Если запрос к API Яндекс.Диска – добавляем OAuth-токен
    if (targetUrl.includes('cloud-api.yandex.net')) {
      headers['Authorization'] = 'OAuth ' + YANDEX_OAUTH_TOKEN;
    }

    // Передаём секретный ключ, если он есть
    const secret = req.headers['x-write-secret'];
    if (secret) {
      headers['X-Write-Secret'] = secret;
    }

    // Выполняем запрос к целевому серверу
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    // Определяем, бинарный ли это файл
    const contentType = response.headers.get('content-type') || '';
    const isBinary = contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
                     contentType.includes('application/octet-stream') ||
                     targetUrl.includes('downloader.disk.yandex.ru');

    if (isBinary) {
      // Для бинарных данных используем arrayBuffer и отправляем как Buffer
      const buffer = await response.arrayBuffer();
      res.status(response.status)
         .setHeader('Content-Type', contentType)
         .setHeader('Content-Length', buffer.byteLength)
         .setHeader('Content-Encoding', 'identity')
         .send(Buffer.from(buffer));
    } else {
      // Для JSON или текста
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
