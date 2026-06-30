const YANDEX_OAUTH_TOKEN = 'y0__wgBEK3T6dMDGMuvQiCp95HVFzD38tqJCD_9zO1sUwHlVUnaAOeiJ_uRkBA1'; 
const WRITE_SECRET = 'mySecretKey123';

// api/cors.js
export default async function handler(req, res) {
  // 1. Добавляем CORS-заголовки к ответу
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Write-Secret, Authorization');

  // 2. Обработка предварительного OPTIONS-запроса
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 3. Получаем целевой URL из параметра 'url'
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    // 4. Прокси-запрос: САМИ идём по адресу
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        // Если нужно, пробрасываем заголовки от клиента
        ...(req.headers['x-write-secret'] && { 'X-Write-Secret': req.headers['x-write-secret'] }),
      },
      // Передаём тело для PUT-запросов
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    // 5. Получаем данные ответа
    const data = await response.text();

    // 6. Возвращаем полученный ответ с правильным статусом и заголовками
    res.status(response.status)
       .setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
       .send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}
