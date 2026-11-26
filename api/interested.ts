import type { IncomingMessage, ServerResponse } from 'node:http';

const COUNTER_KEY = 'avengers_doomsday_interested';
const ROSTER_KEY = 'avengers_doomsday_roster';
const PRIVATE_CONTACTS_KEY = 'avengers_doomsday_contacts';
const ABACUS_NAMESPACE = 'avengers-doomsday-campus';
const ABACUS_KEY = 'interested';
const UPSTREAM_TIMEOUT_MS = 5000;
const MAX_ROSTER_ITEMS = 250;

type WatchDateOption = 'dec-17' | 'after-17';
type GroupSizeOption = 'solo' | 'plus-one' | 'squad';

interface PublicWatchlistEntry {
  id: string;
  name: string;
  watchDate: WatchDateOption;
  groupSize: GroupSizeOption;
  info?: string;
  createdAt: string;
}

interface CounterResult {
  count: number;
  entries: PublicWatchlistEntry[];
  source: 'redis' | 'abacus';
  entry?: PublicWatchlistEntry;
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

async function redisCommand<T = unknown>(
  url: string,
  token: string,
  commandParts: (string | number)[]
): Promise<T> {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandParts),
  });

  if (!res.ok) {
    throw new Error(`Redis REST error: ${res.status}`);
  }

  const data = (await res.json()) as { result?: T; error?: string };
  if (data.error) {
    throw new Error(`Redis command error: ${data.error}`);
  }
  return data.result as T;
}

async function getRedisRoster(url: string, token: string): Promise<PublicWatchlistEntry[]> {
  const rawList = await redisCommand<string[] | null>(url, token, [
    'LRANGE',
    ROSTER_KEY,
    0,
    MAX_ROSTER_ITEMS - 1,
  ]);

  if (!Array.isArray(rawList)) return [];

  const entries: PublicWatchlistEntry[] = [];
  for (const item of rawList) {
    try {
      const parsed = JSON.parse(item) as Partial<PublicWatchlistEntry>;
      if (
        typeof parsed.id === 'string' &&
        typeof parsed.name === 'string' &&
        (parsed.watchDate === 'dec-17' || parsed.watchDate === 'after-17')
      ) {
        entries.push({
          id: parsed.id,
          name: parsed.name,
          watchDate: parsed.watchDate,
          groupSize:
            parsed.groupSize === 'plus-one' || parsed.groupSize === 'squad'
              ? parsed.groupSize
              : 'solo',
          info: typeof parsed.info === 'string' && parsed.info ? parsed.info : undefined,
          createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
        });
      }
    } catch {
      // Skip malformed entry
    }
  }
  return entries;
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

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > 16 * 1024) {
      throw new Error('Request body too large');
    }
    chunks.push(buf);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  const parsed = JSON.parse(raw);
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
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
    const redis = getRedisConfig();

    if (method === 'GET') {
      if (redis) {
        const [rawCount, entries] = await Promise.all([
          redisCommand<string | number | null>(redis.url, redis.token, ['GET', COUNTER_KEY]),
          getRedisRoster(redis.url, redis.token),
        ]);
        const parsedCount = Number(rawCount ?? 0);
        const count = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0;
        const result: CounterResult = {
          count: Math.max(count, entries.length),
          entries,
          source: 'redis',
        };
        sendJson(res, 200, result);
        return;
      }

      const count = await queryAbacus('GET');
      sendJson(res, 200, { count, entries: [], source: 'abacus' } satisfies CounterResult);
      return;
    }

    const body = await readJsonBody(req);
    const hasRsvpPayload = typeof body.name === 'string' && body.name.trim().length > 0;

    if (!hasRsvpPayload) {
      if (redis) {
        const [newCount, entries] = await Promise.all([
          redisCommand<number>(redis.url, redis.token, ['INCR', COUNTER_KEY]),
          getRedisRoster(redis.url, redis.token),
        ]);
        sendJson(res, 200, {
          count: Math.max(Number(newCount) || 0, entries.length),
          entries,
          source: 'redis',
        } satisfies CounterResult);
        return;
      }

      const count = await queryAbacus('POST');
      sendJson(res, 200, { count, entries: [], source: 'abacus' } satisfies CounterResult);
      return;
    }

    const name = sanitizeText(body.name, 40);
    if (!name) {
      sendJson(res, 400, { error: 'Name is required' });
      return;
    }

    const watchDate: WatchDateOption = body.watchDate === 'after-17' ? 'after-17' : 'dec-17';
    const groupSize: GroupSizeOption =
      body.groupSize === 'plus-one' || body.groupSize === 'squad' ? body.groupSize : 'solo';
    const info = sanitizeText(body.info, 60);
    const contact = sanitizeText(body.contact, 80);
    const incrementCount = body.incrementCount !== false;

    const entry: PublicWatchlistEntry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      watchDate,
      groupSize,
      ...(info ? { info } : {}),
      createdAt: new Date().toISOString(),
    };

    if (redis) {
      const tasks: Promise<unknown>[] = [
        redisCommand(redis.url, redis.token, ['LPUSH', ROSTER_KEY, JSON.stringify(entry)]),
        redisCommand(redis.url, redis.token, ['LTRIM', ROSTER_KEY, 0, MAX_ROSTER_ITEMS - 1]),
      ];

      if (contact) {
        tasks.push(
          redisCommand(redis.url, redis.token, [
            'LPUSH',
            PRIVATE_CONTACTS_KEY,
            JSON.stringify({ ...entry, contact }),
          ])
        );
      }

      if (incrementCount) {
        tasks.push(redisCommand(redis.url, redis.token, ['INCR', COUNTER_KEY]));
      }

      await Promise.all(tasks);

      const [rawCount, entries] = await Promise.all([
        redisCommand<string | number | null>(redis.url, redis.token, ['GET', COUNTER_KEY]),
        getRedisRoster(redis.url, redis.token),
      ]);
      const parsedCount = Number(rawCount ?? 0);
      const count = Math.max(Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0, entries.length);

      sendJson(res, 200, {
        count,
        entries,
        entry,
        source: 'redis',
      } satisfies CounterResult);
      return;
    }

    const count = await queryAbacus(incrementCount ? 'POST' : 'GET');
    sendJson(res, 200, {
      count,
      entries: [entry],
      entry,
      source: 'abacus',
    } satisfies CounterResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update interest counter';
    sendJson(res, 502, { error: message });
  }
}
