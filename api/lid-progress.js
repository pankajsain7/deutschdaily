const { createHash, randomBytes, randomUUID } = require('node:crypto');

const COOKIE = '__Host-dd_lid';
const RETENTION_SECONDS = 60 * 60 * 24 * 365;
const MAX_PROGRESS_BYTES = 3 * 1024 * 1024;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const REVISION = /^[a-f0-9-]{36}$/;

const SAVE_PROGRESS = `
local previous = redis.call('HGET', KEYS[1], 'revision') or ''
if previous ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'revision', ARGV[2], 'data', ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 1
`;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function cookieToken(req) {
  const pair = (req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(COOKIE + '='));
  const token = pair?.slice(COOKIE.length + 1);
  return TOKEN.test(token) ? token : null;
}

function validData(data) {
  return data?.version === 1 && Array.isArray(data.rounds) && Array.isArray(data.parkedPractices)
    && Array.isArray(data.savedQuestionIds) && data.savedQuestionIds.length <= 310
    && data.savedQuestionIds.every(id => typeof id === 'string' && /^(?:de-\d{3}|bw-\d{2})$/.test(id));
}

async function redis(redisUrl, redisToken, command) {
  const response = await fetch(redisUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error('Redis request failed');
  const payload = await response.json();
  if (payload.error || !Object.hasOwn(payload, 'result')) throw new Error('Redis command failed');
  return payload.result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.headers['x-deutschdaily-sync'] !== '1'
    || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) {
    return json(res, 403, { error: 'same-origin requests only' });
  }
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    return json(res, 405, { error: 'method not allowed' });
  }
  const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (process.env.DEUTSCHDAILY_PROGRESS_SYNC !== '1' || !redisUrl || !redisToken) {
    return json(res, 503, { error: 'sync unavailable' });
  }
  let token = cookieToken(req);
  if (!token) {
    const connect = req.method === 'GET' && new URL(req.url, 'https://deutschdaily.local').searchParams.get('connect') === '1';
    if (!connect) {
      res.statusCode = req.method === 'GET' ? 204 : 401;
      return res.end();
    }
    token = randomBytes(32).toString('base64url');
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${RETENTION_SECONDS}`);
    const profile = createHash('sha256').update(token).digest('hex');
    return json(res, 200, { profile, revision: null, data: null });
  }

  const profile = createHash('sha256').update(token).digest('hex');
  const key = 'deutschdaily:lid:v1:' + profile;
  try {
    if (req.method === 'GET') {
      const [revision, data] = await redis(redisUrl, redisToken, ['HMGET', key, 'revision', 'data']);
      return json(res, 200, { profile, revision, data: data === null ? null : JSON.parse(data) });
    }

    let input;
    try {
      input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return json(res, 400, { error: 'invalid JSON' });
    }
    if (!validData(input?.data) || !(input.revision === null || REVISION.test(input.revision))) {
      return json(res, 400, { error: 'invalid progress' });
    }
    const data = JSON.stringify(input.data);
    if (Buffer.byteLength(data) > MAX_PROGRESS_BYTES) {
      return json(res, 413, { error: 'progress is too large to sync' });
    }
    const saved = await redis(redisUrl, redisToken, [
      'EVAL', SAVE_PROGRESS, '1', key, input.revision ?? '', randomUUID(), data, String(RETENTION_SECONDS),
    ]);
    if (saved !== 1) return json(res, 409, { error: 'progress changed' });
    res.statusCode = 204;
    return res.end();
  } catch {
    return json(res, 502, { error: 'progress storage unavailable' });
  }
};
