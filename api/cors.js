const YANDEX_OAUTH_TOKEN = 'y0__wgBEK3T6dMDGMuvQiCp95HVFzD38tqJCD_9zO1sUwHlVUnaAOeiJ_uRkBA1';
const WRITE_SECRET = 'mySecretKey123';
const FILE_PATH = '/Учёт.xlsx';

export default async function handler(req, res) {
  // Разрешаем CORS
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
    // ---- /download?public_key=... (старый формат) ----
    if (pathname === '/download' && req.method === 'GET') {
      const publicKey = query.get('public_key');
      if (!publicKey) return res.status(400).json({ error: 'Missing public_key' });
      const result = await downloadPublicFile(publicKey);
      // result — это Response объект с бинарными данными
      const buffer = await result.arrayBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.status(200).send(Buffer.from(buffer));
    }

    // ---- Универсальный формат ?url=... ----
    const targetUrl = query.get('url');
    if (targetUrl) {
      // GET — проксируем любой контент (включая бинарный)
      if (req.method === 'GET') {
        const response = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        // Получаем бинарные данные
        const buffer = await response.arrayBuffer();
        // Копируем Content-Type из ответа
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        return res.status(response.status).send(Buffer.from(buffer));
      }

      // PUT — загрузка файла
      if (req.method === 'PUT') {
        const secret = req.headers['x-write-secret'];
        if (secret !== WRITE_SECRET) {
          return res.status(401).json({ error: 'Unauthorized: invalid secret' });
        }
        // Если targetUrl — это ссылка на загрузку от Яндекс.Диска
        if (targetUrl.includes('download.disk.yandex.ru')) {
          const body = req.body;
          const putResponse = await fetch(targetUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'User-Agent': 'Mozilla/5.0'
            },
            body: body
          });
          if (!putResponse.ok) {
            const text = await putResponse.text();
            console.error('Upload to Yandex failed:', putResponse.status, text);
            return res.status(putResponse.status).json({ error: 'Upload to Yandex failed: ' + text });
          }
          return res.status(200).json({ ok: true });
        }
        return res.status(400).json({ error: 'Unsupported PUT target' });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function downloadPublicFile(publicKey) {
  const apiUrl = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' + encodeURIComponent(publicKey);
  const apiResponse = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!apiResponse.ok) {
    const text = await apiResponse.text();
    throw new Error('Cannot get download URL: ' + apiResponse.status + ' ' + text);
  }
  const data = await apiResponse.json();
  if (!data.href) {
    throw new Error('Yandex did not return href');
  }
  const fileResponse = await fetch(data.href, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!fileResponse.ok) {
    const text = await fileResponse.text();
    throw new Error('Cannot download file: ' + fileResponse.status + ' ' + text);
  }
  return fileResponse; // возвращаем Response объект
}
