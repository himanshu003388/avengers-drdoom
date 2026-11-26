import type { IncomingMessage, ServerResponse } from 'node:http';

const LEADERBOARD_SCORES_KEY = 'avengers_doomsday_game_scores';
const LEADERBOARD_PLAYERS_KEY = 'avengers_doomsday_game_players';
const UPSTREAM_TIMEOUT_MS = 5000;
const MAX_LEADERBOARD_ENTRIES = 20;

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  bestCombo: number;
  popped: number;
  updatedAt: string;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  source: 'redis' | 'local';
  isNewBest?: boolean;
  entry?: LeaderboardEntry;
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

function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 32);
}

function normalizePlayerKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseStoredEntry(raw: string | null): LeaderboardEntry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LeaderboardEntry>;
    if (
      typeof parsed.name === 'string' &&
      typeof parsed.score === 'number' &&
      Number.isFinite(parsed.score)
    ) {
      return {
        id: typeof parsed.id === 'string' ? parsed.id : normalizePlayerKey(parsed.name),
        name: parsed.name,
        score: Math.max(0, Math.floor(parsed.score)),
        bestCombo:
          typeof parsed.bestCombo === 'number' && Number.isFinite(parsed.bestCombo)
            ? Math.max(1, Math.floor(parsed.bestCombo))
            : 1,
        popped:
          typeof parsed.popped === 'number' && Number.isFinite(parsed.popped)
            ? Math.max(0, Math.floor(parsed.popped))
            : 0,
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function getTopLeaderboard(url: string, token: string): Promise<LeaderboardEntry[]> {
  const rawMembers = await redisCommand<string[] | null>(url, token, [
    'ZREVRANGE',
    LEADERBOARD_SCORES_KEY,
    0,
    MAX_LEADERBOARD_ENTRIES - 1,
    'WITHSCORES',
  ]);

  if (!Array.isArray(rawMembers) || rawMembers.length === 0) return [];

  const keys: string[] = [];
  const scoresByKey = new Map<string, number>();

  for (let i = 0; i < rawMembers.length; i += 2) {
    const key = rawMembers[i];
    const score = Number(rawMembers[i + 1] ?? 0);
    if (typeof key === 'string' && key) {
      keys.push(key);
      scoresByKey.set(key, Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0);
    }
  }

  if (keys.length === 0) return [];

  const rawDetails = await redisCommand<(string | null)[] | null>(url, token, [
    'HMGET',
    LEADERBOARD_PLAYERS_KEY,
    ...keys,
  ]);

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const parsed = parseStoredEntry(Array.isArray(rawDetails) ? rawDetails[i] ?? null : null);
    if (parsed) {
      entries.push(parsed);
    } else {
      entries.push({
        id: key,
        name: key,
        score: scoresByKey.get(key) ?? 0,
        bestCombo: 1,
        popped: 0,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return entries.sort((a, b) => b.score - a.score);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > 8192) {
      throw new Error('Request payload too large');
    }
    chunks.push(buf);
  }
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
      if (!redis) {
        sendJson(res, 200, { entries: [], source: 'local' } satisfies LeaderboardResponse);
        return;
      }

      const entries = await getTopLeaderboard(redis.url, redis.token);
      sendJson(res, 200, { entries, source: 'redis' } satisfies LeaderboardResponse);
      return;
    }

    const body = await readJsonBody(req);
    const name = sanitizeName(body.name);
    if (!name) {
      sendJson(res, 400, { error: 'Player name is required' });
      return;
    }

    const rawScore = Number(body.score);
    const score = Number.isFinite(rawScore) ? Math.min(50000, Math.max(0, Math.floor(rawScore))) : 0;
    const rawCombo = Number(body.bestCombo);
    const bestCombo = Number.isFinite(rawCombo) ? Math.min(20, Math.max(1, Math.floor(rawCombo))) : 1;
    const rawPopped = Number(body.popped);
    const popped = Number.isFinite(rawPopped) ? Math.min(1000, Math.max(0, Math.floor(rawPopped))) : 0;

    const key = normalizePlayerKey(name);
    const candidate: LeaderboardEntry = {
      id: key,
      name,
      score,
      bestCombo,
      popped,
      updatedAt: new Date().toISOString(),
    };

    if (!redis) {
      sendJson(res, 200, {
        entries: [candidate],
        entry: candidate,
        isNewBest: true,
        source: 'local',
      } satisfies LeaderboardResponse);
      return;
    }

    const existingRaw = await redisCommand<string | null>(redis.url, redis.token, [
      'HGET',
      LEADERBOARD_PLAYERS_KEY,
      key,
    ]);
    const existing = parseStoredEntry(existingRaw);
    const isNewBest = !existing || score > existing.score;

    if (isNewBest) {
      await Promise.all([
        redisCommand(redis.url, redis.token, ['ZADD', LEADERBOARD_SCORES_KEY, score, key]),
        redisCommand(redis.url, redis.token, [
          'HSET',
          LEADERBOARD_PLAYERS_KEY,
          key,
          JSON.stringify(candidate),
        ]),
      ]);
    }

    const entries = await getTopLeaderboard(redis.url, redis.token);
    sendJson(res, 200, {
      entries,
      entry: isNewBest ? candidate : existing,
      isNewBest,
      source: 'redis',
    } satisfies LeaderboardResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update leaderboard';
    sendJson(res, 502, { error: message });
  }
}
