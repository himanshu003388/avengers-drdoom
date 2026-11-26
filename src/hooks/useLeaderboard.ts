import { useCallback, useEffect, useState } from 'react';
import type { LeaderboardEntry } from '../types/game';

const API_LEADERBOARD_URL = '/api/leaderboard';
const LEADERBOARD_STORAGE_KEY = 'doomsday_game_leaderboard';
const PLAYER_NAME_STORAGE_KEY = 'doomsday_game_player_name';
const FETCH_TIMEOUT_MS = 5000;

interface ApiLeaderboardResponse {
  entries?: unknown;
  isNewBest?: unknown;
}

function normalizeNameKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseEntries(raw: unknown): LeaderboardEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: LeaderboardEntry[] = [];
  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as LeaderboardEntry).name === 'string' &&
      typeof (item as LeaderboardEntry).score === 'number' &&
      Number.isFinite((item as LeaderboardEntry).score)
    ) {
      const entry = item as LeaderboardEntry;
      valid.push({
        id: typeof entry.id === 'string' ? entry.id : normalizeNameKey(entry.name),
        name: entry.name,
        score: Math.max(0, Math.floor(entry.score)),
        bestCombo:
          typeof entry.bestCombo === 'number' && Number.isFinite(entry.bestCombo)
            ? Math.max(1, Math.floor(entry.bestCombo))
            : 1,
        popped:
          typeof entry.popped === 'number' && Number.isFinite(entry.popped)
            ? Math.max(0, Math.floor(entry.popped))
            : 0,
        updatedAt:
          typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString(),
      });
    }
  }
  return valid;
}

function mergeLeaderboard(
  serverEntries: LeaderboardEntry[],
  localEntries: LeaderboardEntry[]
): LeaderboardEntry[] {
  const byKey = new Map<string, LeaderboardEntry>();
  for (const entry of [...serverEntries, ...localEntries]) {
    const key = normalizeNameKey(entry.name);
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev || entry.score > prev.score) {
      byKey.set(key, entry);
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

export function useLeaderboard(defaultName?: string) {
  const [playerName, setPlayerNameState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // Ignore storage access errors
    }
    return defaultName ?? '';
  });

  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      if (raw) {
        return parseEntries(JSON.parse(raw)).sort((a, b) => b.score - a.score);
      }
    } catch {
      // Ignore storage access errors
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!playerName && defaultName) {
      setPlayerNameState(defaultName);
    }
  }, [defaultName, playerName]);

  const setPlayerName = useCallback((name: string) => {
    const trimmed = name.slice(0, 32);
    setPlayerNameState(trimmed);
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, trimmed.trim());
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    setLoading(true);
    try {
      const res = await fetch(API_LEADERBOARD_URL, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as ApiLeaderboardResponse;
        const serverEntries = parseEntries(data.entries);
        setEntries((prev) => {
          const merged = mergeLeaderboard(serverEntries, prev);
          try {
            localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // Ignore storage access errors
          }
          return merged;
        });
      }
    } catch {
      // Keep local entries when offline or unconfigured
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitScore = useCallback(
    async (payload: {
      name: string;
      score: number;
      bestCombo: number;
      popped: number;
    }): Promise<{ isNewBest: boolean }> => {
      const cleanName = payload.name.replace(/\s+/g, ' ').trim().slice(0, 32);
      if (!cleanName) return { isNewBest: false };

      setPlayerName(cleanName);

      const candidate: LeaderboardEntry = {
        id: normalizeNameKey(cleanName),
        name: cleanName,
        score: Math.max(0, Math.floor(payload.score)),
        bestCombo: Math.max(1, Math.floor(payload.bestCombo)),
        popped: Math.max(0, Math.floor(payload.popped)),
        updatedAt: new Date().toISOString(),
      };

      let localNewBest = true;
      setEntries((prev) => {
        const existing = prev.find((e) => normalizeNameKey(e.name) === candidate.id);
        localNewBest = !existing || candidate.score > existing.score;
        const merged = mergeLeaderboard([candidate], prev);
        try {
          localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // Ignore storage access errors
        }
        return merged;
      });

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      setSubmitting(true);

      try {
        const res = await fetch(API_LEADERBOARD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidate),
          cache: 'no-store',
          signal: controller.signal,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = (await res.json()) as ApiLeaderboardResponse;
          const serverEntries = parseEntries(data.entries);
          setEntries((prev) => {
            const merged = mergeLeaderboard(serverEntries, prev);
            try {
              localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(merged));
            } catch {
              // Ignore storage access errors
            }
            return merged;
          });
          return {
            isNewBest: typeof data.isNewBest === 'boolean' ? data.isNewBest : localNewBest,
          };
        }
      } catch {
        // Fallback to local state
      } finally {
        window.clearTimeout(timeoutId);
        setSubmitting(false);
      }

      return { isNewBest: localNewBest };
    },
    [setPlayerName]
  );

  return {
    playerName,
    setPlayerName,
    entries,
    loading,
    submitting,
    refresh,
    submitScore,
  };
}
