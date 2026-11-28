import type { IncomingMessage, ServerResponse } from 'node:http';

const VISIT_COUNT_KEY = 'avengers_doomsday_visits';
const VISIT_MOBILE_KEY = 'avengers_doomsday_visits_mobile';
const VISIT_DESKTOP_KEY = 'avengers_doomsday_visits_desktop';
const UPSTREAM_TIMEOUT_MS = 5000;
const BOT_UA_PATTERN =
  /(?:bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|telegram|discord|preview|lighthouse|pagespeed)/i;
const MOBILE_UA_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

type DeviceCategory = 'mobile' | 'desktop';

function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function redisCommand<T = unknown>(
  url: string,
  token: string,
  commandParts: (string | number)[]
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commandParts),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Redis REST error: ${res.status}`);
    }

    const data = (await res.json()) as { result?: T; error?: string };
    if (data.error) {
      throw new Error(`Redis command error: ${data.error}`);
    }
    return data.result as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readOptionalDeviceHint(req: IncomingMessage): Promise<DeviceCategory | null> {
  const preParsed = (req as IncomingMessage & { body?: unknown }).body;
  if (preParsed && typeof preParsed === 'object') {
    const hint = (preParsed as { deviceType?: unknown }).deviceType;
    return hint === 'mobile' || hint === 'desktop' ? hint : null;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > 1024) return null;
    chunks.push(buf);
  }

  if (chunks.length === 0) return null;
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { deviceType?: unknown };
    return parsed?.deviceType === 'mobile' || parsed?.deviceType === 'desktop'
      ? parsed.deviceType
      : null;
  } catch {
    return null;
  }
}

function detectDeviceCategory(
  req: IncomingMessage,
  userAgent: string,
  clientHint: DeviceCategory | null
): DeviceCategory {
  if (req.headers['sec-ch-ua-mobile'] === '?1') return 'mobile';
  if (MOBILE_UA_PATTERN.test(userAgent)) return 'mobile';
  if (clientHint) return clientHint;
  return 'desktop';
}

function toSafeCount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function setNoStoreHeaders(res: ServerResponse): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  setNoStoreHeaders(res);

  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const redis = getRedisConfig();

  if (method === 'GET') {
    if (!redis) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ total: 0, mobile: 0, desktop: 0, source: 'local' }));
      return;
    }

    try {
      const counts = await redisCommand<(string | number | null)[] | null>(redis.url, redis.token, [
        'MGET',
        VISIT_COUNT_KEY,
        VISIT_MOBILE_KEY,
        VISIT_DESKTOP_KEY,
      ]);
      const [rawTotal, rawMobile, rawDesktop] = Array.isArray(counts) ? counts : [];
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          total: toSafeCount(rawTotal),
          mobile: toSafeCount(rawMobile),
          desktop: toSafeCount(rawDesktop),
          source: 'redis',
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch visits';
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: message }));
    }
    return;
  }

  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].trim() : '';
  if (!userAgent || BOT_UA_PATTERN.test(userAgent)) {
    res.statusCode = 204;
    res.setHeader('X-Visit-Recorded', '0');
    res.end();
    return;
  }

  if (!redis) {
    res.statusCode = 204;
    res.setHeader('X-Visit-Recorded', '0');
    res.end();
    return;
  }

  try {
    const clientHint = await readOptionalDeviceHint(req);
    const device = detectDeviceCategory(req, userAgent, clientHint);
    const deviceKey = device === 'mobile' ? VISIT_MOBILE_KEY : VISIT_DESKTOP_KEY;

    await Promise.all([
      redisCommand(redis.url, redis.token, ['INCR', VISIT_COUNT_KEY]),
      redisCommand(redis.url, redis.token, ['INCR', deviceKey]),
    ]);

    res.statusCode = 204;
    res.setHeader('X-Visit-Recorded', '1');
    res.setHeader('X-Visit-Device', device);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record visit';
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: message }));
  }
}
