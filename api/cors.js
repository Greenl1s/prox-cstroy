const YANDEX_OAUTH_TOKEN = 'y0__wgBEK3T6dMDGMuvQiCp95HVFzD38tqJCD_9zO1sUwHlVUnaAOeiJ_uRkBA1';
const WRITE_SECRET = 'mySecretKey123';
const FILE_PATH = '/Учёт.xlsx';

export default async function handler(req, res) {
  // Добавляем CORS-заголовки к любому ответу
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Write-Secret');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Получаем целевой URL из параметра
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    // Подготавливаем заголовки для проксируемого запроса
    const headers = {
      'User-Agent': 'Mozilla/5.0'
    };
    // Если есть секрет – передаём его дальше (для Яндекс.Диска)
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

    // Получаем данные ответа
    const data = await response.text();

    // Возвращаем ответ с правильным Content-Type
    res.status(response.status)
       .setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
       .send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}
