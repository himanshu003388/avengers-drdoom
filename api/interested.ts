import type { IncomingMessage, ServerResponse } from 'node:http';

const COUNTER_KEY = 'avengers_doomsday_interested';
const ABACUS_NAMESPACE = 'avengers-doomsday-campus';
const ABACUS_KEY = 'interested';
const UPSTREAM_TIMEOUT_MS = 5000;

interface CounterResult {
  count: number;
  source: 'redis' | 'abacus';
}

function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function queryRedis(method: 'GET' | 'POST', url: string, token: string): Promise<number> {
  const command = method === 'POST' ? 'incr' : 'get';
  const res = await fetchWithTimeout(`${url}/${command}/${COUNTER_KEY}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Redis REST error: ${res.status}`);
  }

  const data = (await res.json()) as { result?: string | number | null };
  const parsed = Number(data.result ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function queryAbacus(method: 'GET' | 'POST'): Promise<number> {
  const action = method === 'POST' ? 'hit' : 'get';
  const res = await fetchWithTimeout(
    `https://abacus.jasoncameron.dev/${action}/${ABACUS_NAMESPACE}/${ABACUS_KEY}`
  );

  if (method === 'GET' && res.status === 404) {
    return 0;
  }

  if (!res.ok) {
    throw new Error(`Abacus API error: ${res.status}`);
  }

  const data = (await res.json()) as { value?: number };
  return typeof data.value === 'number' && Number.isFinite(data.value) ? data.value : 0;
}

async function getOrIncrementCount(method: 'GET' | 'POST'): Promise<CounterResult> {
  const redis = getRedisConfig();
  if (redis) {
    const count = await queryRedis(method, redis.url, redis.token);
    return { count, source: 'redis' };
  }

  const count = await queryAbacus(method);
  return { count, source: 'abacus' };
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();

  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const result = await getOrIncrementCount(method);
    sendJson(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update interest counter';
    sendJson(res, 502, { error: message });
  }
}
