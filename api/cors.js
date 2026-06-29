const YANDEX_OAUTH_TOKEN = 'y0__wgBEK3T6dMDGMuvQiCp95HVFzD38tqJCD_9zO1sUwHlVUnaAOeiJ_uRkBA1';
const WRITE_SECRET = 'mySecretKey123';
const FILE_PATH = '/Учёт.xlsx';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Write-Secret'
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    try {
      if (url.pathname === '/download' && request.method === 'GET') {
        return await downloadPublicFile(url);
      }
      if (url.pathname === '/upload' && request.method === 'PUT') {
        return await uploadPrivateFile(request);
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('Worker error:', error);
      return json({ error: error.message || 'Worker error' }, 500);
    }
  }
};

async function downloadPublicFile(url) {
  const publicKey = url.searchParams.get('public_key');
  if (!publicKey) return json({ error: 'Missing public_key' }, 400);

  const apiUrl = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' + encodeURIComponent(publicKey);
  const apiResponse = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!apiResponse.ok) {
    return proxyError(apiResponse, 'Cannot get download URL');
  }
  const data = await apiResponse.json();
  if (!data.href) {
    return json({ error: 'Yandex did not return href' }, 502);
  }
  const fileResponse = await fetch(data.href, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!fileResponse.ok) {
    return proxyError(fileResponse, 'Cannot download file');
  }
  return new Response(fileResponse.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Cache-Control': 'no-store'
    }
  });
}

async function uploadPrivateFile(request) {
  const secret = request.headers.get('X-Write-Secret');
  if (secret !== WRITE_SECRET) {
    return json({ error: 'Unauthorized: invalid secret' }, 401);
  }

  const uploadUrl = 'https://cloud-api.yandex.net/v1/disk/resources/upload?path=' + encodeURIComponent(FILE_PATH) + '&overwrite=true';
  const apiResponse = await fetch(uploadUrl, {
    headers: { 
      Authorization: 'OAuth ' + YANDEX_OAUTH_TOKEN,
      'User-Agent': 'Mozilla/5.0'
    }
  });
  if (!apiResponse.ok) {
    const text = await apiResponse.text();
    console.error('Yandex API error:', apiResponse.status, text);
    return json({ error: 'Yandex API error: ' + apiResponse.status + ' ' + text }, apiResponse.status);
  }
  const data = await apiResponse.json();
  if (!data.href) {
    console.error('Yandex did not return upload href', data);
    return json({ error: 'Yandex did not return upload href' }, 502);
  }

  const body = await request.arrayBuffer();
  const fileResponse = await fetch(data.href, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'User-Agent': 'Mozilla/5.0'
    },
    body: body
  });
  if (!fileResponse.ok) {
    const text = await fileResponse.text();
    console.error('Upload to Yandex failed:', fileResponse.status, text);
    return json({ error: 'Upload to Yandex failed: ' + fileResponse.status + ' ' + text }, fileResponse.status);
  }

  return json({ ok: true });
}

async function proxyError(response, fallback) {
  const body = await response.text().catch(() => '');
  return json({ error: body || fallback, status: response.status }, response.status || 502);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}