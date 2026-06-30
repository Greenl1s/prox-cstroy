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
    // 1. Проверяем, является ли запрос PUT (загрузка файла)
    const isPut = req.method === 'PUT';
    const isYandexDownload = targetUrl.includes('downloader.disk.yandex.ru');

    // 2. Для PUT-запросов (загрузка файла) НЕ добавляем Content-Type, чтобы не менять данные
    const headers = {
      'User-Agent': 'Mozilla/5.0'
    };

    // Для запросов к API Яндекс.Диска (GET) добавляем авторизацию
    if (targetUrl.includes('cloud-api.yandex.net')) {
      headers['Authorization'] = 'OAuth ' + YANDEX_OAUTH_TOKEN;
    }

    // Если клиент передал X-Write-Secret – передаём его дальше
    const secret = req.headers['x-write-secret'];
    if (secret) {
      headers['X-Write-Secret'] = secret;
    }

    // 3. Для PUT запросов используем 'raw' body (ArrayBuffer) и НЕ указываем Content-Type
    let body = undefined;
    if (isPut) {
      // Читаем сырые бинарные данные
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      body = Buffer.concat(buffers);
      // Важно: не добавляем Content-Type, чтобы не переопределять его в PUT запросе
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = req.body;
    }

    // 4. Выполняем запрос к целевому серверу
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    // 5. Для PUT запросов (загрузка) просто возвращаем статус без чтения тела
    if (isPut) {
      // Получаем текст ошибки, если есть
      const text = await response.text();
      if (!response.ok) {
        console.error('Upload failed:', response.status, text);
        return res.status(response.status).json({ error: 'Upload failed: ' + text });
      }
      return res.status(200).json({ ok: true });
    }

    // 6. Для GET запросов (скачивание) – обрабатываем как обычно
    const contentType = response.headers.get('content-type') || '';
    const isBinary = contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
                     contentType.includes('application/octet-stream') ||
                     targetUrl.includes('downloader.disk.yandex.ru');

    if (isBinary) {
      const buffer = await response.arrayBuffer();
      res.status(response.status)
         .setHeader('Content-Type', contentType)
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
