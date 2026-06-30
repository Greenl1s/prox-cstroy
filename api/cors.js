const YANDEX_OAUTH_TOKEN = 'y0__wgBEK3T6dMDGMuvQiCp95HVFzD38tqJCD_9zO1sUwHlVUnaAOeiJ_uRkBA1';
const WRITE_SECRET = 'mySecretKey123';
const FILE_PATH = '/Учёт.xlsx';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Write-Secret'
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Write-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const query = url.searchParams;

  try {
    // ----- ОБРАБОТКА СКАЧИВАНИЯ ФАЙЛА ПО public_key (прямой аналог Cloudflare Worker) -----
    if (pathname === '/download' && req.method === 'GET') {
      const publicKey = query.get('public_key');
      if (!publicKey) return res.status(400).json({ error: 'Missing public_key' });
      
      // 1. Получить href от Яндекс.Диска
      const apiUrl = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' + encodeURIComponent(publicKey);
      const apiResponse = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!apiResponse.ok) {
        const text = await apiResponse.text();
        return res.status(apiResponse.status).json({ error: 'Cannot get download URL: ' + text });
      }
      const data = await apiResponse.json();
      if (!data.href) {
        return res.status(502).json({ error: 'Yandex did not return href' });
      }

      // 2. Скачать файл по href (используя те же заголовки)
      const fileResponse = await fetch(data.href, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!fileResponse.ok) {
        const text = await fileResponse.text();
        return res.status(fileResponse.status).json({ error: 'Cannot download file: ' + text });
      }

      // 3. Вернуть файл клиенту
      const buffer = await fileResponse.arrayBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(Buffer.from(buffer));
      return;
    }

    // ----- ОБРАБОТКА УНИВЕРСАЛЬНОГО ПРОКСИ (GET /?url=...) -----
    const targetUrl = query.get('url');
    if (targetUrl) {
      if (req.method === 'GET') {
        // Просто проксируем запрос к целевому URL (для API и прочего)
        const response = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = await response.text();
        res.status(response.status).setHeader('Content-Type', response.headers.get('content-type') || 'text/plain').send(data);
        return;
      }

      if (req.method === 'PUT') {
        // PUT для загрузки файла (обработка как в Cloudflare Worker)
        const secret = req.headers['x-write-secret'];
        if (secret !== WRITE_SECRET) {
          return res.status(401).json({ error: 'Unauthorized: invalid secret' });
        }
        // Здесь логика для PUT, но она не используется для скачивания, так что оставим как есть.
        // ...
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
