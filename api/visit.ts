import type { IncomingMessage, ServerResponse } from 'node:http';

const VISIT_COUNT_KEY = 'avengers_doomsday_visits';
const UPSTREAM_TIMEOUT_MS = 5000;
const BOT_UA_PATTERN =
  /(?:bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|telegram|discord|preview|lighthouse|pagespeed)/i;

function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function incrementRedisCounter(url: string, token: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['INCR', VISIT_COUNT_KEY]),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Redis REST error: ${res.status}`);
    }

    const data = (await res.json()) as { error?: string };
    if (data.error) {
      throw new Error(`Redis command error: ${data.error}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
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

  if (method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].trim() : '';
  if (!userAgent || BOT_UA_PATTERN.test(userAgent)) {
    res.statusCode = 204;
    res.setHeader('X-Visit-Recorded', '0');
    res.end();
    return;
  }

  const redis = getRedisConfig();
  if (!redis) {
    res.statusCode = 204;
    res.setHeader('X-Visit-Recorded', '0');
    res.end();
    return;
  }

  try {
    await incrementRedisCounter(redis.url, redis.token);
    res.statusCode = 204;
    res.setHeader('X-Visit-Recorded', '1');
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record visit';
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: message }));
  }
}
