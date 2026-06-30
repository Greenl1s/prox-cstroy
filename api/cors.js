const YANDEX_OAUTH_TOKEN = 'y0__wgBEK3T6dMDGIXTRCCQwt-NGDD38tqJCP5ZytMKwuD_9zAzbbcQKjP-W14M'; 
const WRITE_SECRET = 'mySecretKey123';

export default async function handler(req, res) {
  // CORS-заголовки для всех ответов
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Write-Secret, Authorization');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    // Проверяем, является ли запрос запросом к API Яндекс.Диска для получения upload URL
    const isYandexUploadApi = targetUrl.includes('cloud-api.yandex.net/v1/disk/resources/upload');

    // Готовим заголовки для проксируемого запроса
    let headers = {
      'User-Agent': 'Mozilla/5.0'
    };

    // Для запросов к API Яндекс.Диска (GET upload URL) добавляем Authorization
    if (isYandexUploadApi && req.method === 'GET') {
      // Используем токен из прокси (не из клиента)
      headers['Authorization'] = 'OAuth ' + YANDEX_OAUTH_TOKEN;
    }

    // Если клиент передал X-Write-Secret – передаём его дальше (для PUT)
    const secret = req.headers['x-write-secret'];
    if (secret) {
      headers['X-Write-Secret'] = secret;
    }

    // Проксируем запрос
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    // Если ответ от Яндекс.Диска – возвращаем JSON
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // Иначе возвращаем как текст (для файлов)
    const data = await response.text();
    res.status(response.status)
       .setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
       .send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}
