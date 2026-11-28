import { useCallback, useEffect, useRef, useState } from 'react';
import type { LeaderboardEntry } from '../types/game';
import {
  normalizeNameKey,
  readStorageJson,
  readStorageString,
  sanitizeText,
  writeStorage,
} from '../utils/common';

const API_LEADERBOARD_URL = '/api/leaderboard';
const LEADERBOARD_STORAGE_KEY = 'doomsday_game_leaderboard';
const PENDING_SCORES_STORAGE_KEY = 'doomsday_game_pending_scores';
const PLAYER_NAME_STORAGE_KEY = 'doomsday_game_player_name';
const FETCH_TIMEOUT_MS = 5000;
const MIN_AUTO_REFRESH_INTERVAL_MS = 2500;
const MODAL_POLL_INTERVAL_MS = 10000;
const BACKGROUND_POLL_INTERVAL_MS = 30000;

interface ApiLeaderboardResponse {
  entries?: unknown;
  isNewBest?: unknown;
  source?: unknown;
}

interface UseLeaderboardOptions {
  activeModalOpen?: boolean;
}

function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return (
    b.score - a.score ||
    b.popped - a.popped ||
    b.bestCombo - a.bestCombo ||
    a.name.localeCompare(b.name)
  );
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
      const cleanName = sanitizeText(entry.name, 32);
      if (!cleanName) continue;
      valid.push({
        id: normalizeNameKey(cleanName),
        name: cleanName,
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
  primaryEntries: LeaderboardEntry[],
  secondaryEntries: LeaderboardEntry[]
): LeaderboardEntry[] {
  const byKey = new Map<string, LeaderboardEntry>();
  const all = [primaryEntries, secondaryEntries];
  for (const list of all) {
    for (const entry of list) {
      const key = normalizeNameKey(entry.name);
      if (!key) continue;
      const prev = byKey.get(key);
      if (!prev || compareLeaderboardEntries(entry, prev) < 0) {
        byKey.set(key, entry);
      }
    }
  }
  return Array.from(byKey.values()).sort(compareLeaderboardEntries);
}

function readStoredEntries(key: string): LeaderboardEntry[] {
  const raw = readStorageJson<unknown>(key);
  if (!raw) return [];
  return mergeLeaderboard(parseEntries(raw), []);
}

function upsertPendingScore(candidate: LeaderboardEntry): LeaderboardEntry[] {
  const current = readStoredEntries(PENDING_SCORES_STORAGE_KEY);
  const next = mergeLeaderboard([candidate], current);
  writeStorage(PENDING_SCORES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function removePendingScore(nameKey: string, syncedScore: number): void {
  const current = readStoredEntries(PENDING_SCORES_STORAGE_KEY);
  if (current.length === 0) return;
  const remaining = current.filter(
    (item) => !(normalizeNameKey(item.name) === nameKey && item.score <= syncedScore)
  );
  writeStorage(PENDING_SCORES_STORAGE_KEY, JSON.stringify(remaining));
}

export function useLeaderboard(defaultName?: string, options: UseLeaderboardOptions = {}) {
  const { activeModalOpen = false } = options;

  const [playerName, setPlayerNameState] = useState<string>(() => {
    const saved = readStorageString(PLAYER_NAME_STORAGE_KEY);
    if (saved) return saved;
    return defaultName ?? '';
  });

  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => {
    const cached = readStoredEntries(LEADERBOARD_STORAGE_KEY);
    const pending = readStoredEntries(PENDING_SCORES_STORAGE_KEY);
    return mergeLeaderboard(cached, pending);
  });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const entriesRef = useRef<LeaderboardEntry[]>(entries);
  entriesRef.current = entries;
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;
  const refreshInFlightRef = useRef(false);
  const pendingSyncInFlightRef = useRef(false);
  const mutationVersionRef = useRef(0);
  const lastFetchAtRef = useRef(0);
  const unmountedRef = useRef(false);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());

  const createTrackedRequest = useCallback((): {
    controller: AbortController;
    cleanup: () => void;
  } => {
    const controller = new AbortController();
    activeControllersRef.current.add(controller);
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return {
      controller,
      cleanup: () => {
        window.clearTimeout(timeoutId);
        activeControllersRef.current.delete(controller);
      },
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      for (const controller of activeControllersRef.current) {
        controller.abort();
      }
      activeControllersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!playerName && defaultName) {
      setPlayerNameState(defaultName);
    }
  }, [defaultName, playerName]);

  const setPlayerName = useCallback((name: string) => {
    const trimmed = name.slice(0, 32);
    setPlayerNameState(trimmed);
    writeStorage(PLAYER_NAME_STORAGE_KEY, trimmed.trim());
  }, []);

  const syncPendingScores = useCallback(
    async (serverEntries: LeaderboardEntry[]) => {
      if (pendingSyncInFlightRef.current || submittingRef.current || unmountedRef.current) return;
      const pending = readStoredEntries(PENDING_SCORES_STORAGE_KEY);
      if (pending.length === 0) return;

      const serverByKey = new Map<string, LeaderboardEntry>();
      for (const entry of serverEntries) {
        serverByKey.set(normalizeNameKey(entry.name), entry);
      }

      const toUpload: LeaderboardEntry[] = [];
      const stillPending: LeaderboardEntry[] = [];
      for (const item of pending) {
        const key = normalizeNameKey(item.name);
        const serverMatch = serverByKey.get(key);
        if (!serverMatch || serverMatch.score < item.score) {
          toUpload.push(item);
        }
      }

      if (toUpload.length === 0) {
        writeStorage(PENDING_SCORES_STORAGE_KEY, '[]');
        return;
      }

      pendingSyncInFlightRef.current = true;
      const requestVersion = mutationVersionRef.current;
      try {
        let latestServerEntries = serverEntries;
        for (const item of toUpload) {
          if (unmountedRef.current) break;
          const { controller, cleanup } = createTrackedRequest();
          try {
            const res = await fetch(API_LEADERBOARD_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
              cache: 'no-store',
              signal: controller.signal,
            });
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
              const data = (await res.json()) as ApiLeaderboardResponse;
              if (data.source === 'redis') {
                latestServerEntries = mergeLeaderboard(parseEntries(data.entries), []);
              } else {
                stillPending.push(item);
              }
            } else {
              stillPending.push(item);
            }
          } catch {
            stillPending.push(item);
          } finally {
            cleanup();
          }
        }

        writeStorage(PENDING_SCORES_STORAGE_KEY, JSON.stringify(stillPending));
        if (
          !unmountedRef.current &&
          !submittingRef.current &&
          mutationVersionRef.current === requestVersion
        ) {
          const merged = mergeLeaderboard(latestServerEntries, stillPending);
          entriesRef.current = merged;
          setEntries(merged);
          writeStorage(LEADERBOARD_STORAGE_KEY, JSON.stringify(merged));
        }
      } finally {
        pendingSyncInFlightRef.current = false;
      }
    },
    [createTrackedRequest]
  );

  const refresh = useCallback(
    async (force = false) => {
      if (submittingRef.current || refreshInFlightRef.current || unmountedRef.current) return;
      if (!force && Date.now() - lastFetchAtRef.current < MIN_AUTO_REFRESH_INTERVAL_MS) {
        return;
      }

      refreshInFlightRef.current = true;
      setLoading(true);
      const requestVersion = mutationVersionRef.current;

      const { controller, cleanup } = createTrackedRequest();

      try {
        const res = await fetch(`${API_LEADERBOARD_URL}?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        const contentType = res.headers.get('content-type') || '';
        if (
          res.ok &&
          contentType.includes('application/json') &&
          !unmountedRef.current &&
          !submittingRef.current &&
          mutationVersionRef.current === requestVersion
        ) {
          const data = (await res.json()) as ApiLeaderboardResponse;
          lastFetchAtRef.current = Date.now();
          const serverEntries = mergeLeaderboard(parseEntries(data.entries), []);

          if (data.source === 'redis') {
            const pending = readStoredEntries(PENDING_SCORES_STORAGE_KEY);
            const merged = mergeLeaderboard(serverEntries, pending);
            entriesRef.current = merged;
            setEntries(merged);
            writeStorage(LEADERBOARD_STORAGE_KEY, JSON.stringify(merged));
            if (pending.length > 0) {
              void syncPendingScores(serverEntries);
            }
          } else if (serverEntries.length > 0) {
            setEntries((prev) => {
              const merged = mergeLeaderboard(serverEntries, prev);
              entriesRef.current = merged;
              writeStorage(LEADERBOARD_STORAGE_KEY, JSON.stringify(merged));
              return merged;
            });
          }
        }
      } catch {
        // Keep local entries when offline or unconfigured
      } finally {
        cleanup();
        refreshInFlightRef.current = false;
        if (!unmountedRef.current) {
          setLoading(false);
        }
      }
    },
    [createTrackedRequest, syncPendingScores]
  );

  // Initial load + focus/visibility/online + cross-tab storage sync
  useEffect(() => {
    void refresh(true);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void refresh(false);
      }
    };

    const handleOnline = () => {
      void refresh(true);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LEADERBOARD_STORAGE_KEY && e.newValue) {
        try {
          const next = mergeLeaderboard(parseEntries(JSON.parse(e.newValue)), []);
          entriesRef.current = next;
          setEntries(next);
        } catch {
          // Ignore malformed storage payload
        }
      } else if (e.key === PLAYER_NAME_STORAGE_KEY && typeof e.newValue === 'string') {
        setPlayerNameState(e.newValue);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refresh]);

  // Refresh immediately when game modal opens, and poll while open or visible
  useEffect(() => {
    if (activeModalOpen) {
      void refresh(true);
    }

    const intervalMs = activeModalOpen ? MODAL_POLL_INTERVAL_MS : BACKGROUND_POLL_INTERVAL_MS;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh(false);
      }
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeModalOpen, refresh]);

  const submitScore = useCallback(
    async (payload: {
      name: string;
      score: number;
      bestCombo: number;
      popped: number;
    }): Promise<{ isNewBest: boolean }> => {
      const cleanName = sanitizeText(payload.name, 32);
      if (!cleanName) return { isNewBest: false };

      setPlayerName(cleanName);

      mutationVersionRef.current += 1;
      const candidate: LeaderboardEntry = {
        id: normalizeNameKey(cleanName),
        name: cleanName,
        score: Math.max(0, Math.floor(payload.score)),
        bestCombo: Math.max(1, Math.floor(payload.bestCombo)),
        popped: Math.max(0, Math.floor(payload.popped)),
        updatedAt: new Date().toISOString(),
      };

      const existing = entriesRef.current.find(
        (entry) => normalizeNameKey(entry.name) === candidate.id
      );
      const localNewBest = !existing || candidate.score > existing.score;

      const optimisticMerged = mergeLeaderboard([candidate], entriesRef.current);
      entriesRef.current = optimisticMerged;
      setEntries(optimisticMerged);
      writeStorage(LEADERBOARD_STORAGE_KEY, JSON.stringify(optimisticMerged));

      const { controller, cleanup } = createTrackedRequest();
      submittingRef.current = true;
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
        if (res.ok && contentType.includes('application/json') && !unmountedRef.current) {
          const data = (await res.json()) as ApiLeaderboardResponse;
          lastFetchAtRef.current = Date.now();
          const serverEntries = mergeLeaderboard(parseEntries(data.entries), []);

          if (data.source === 'redis') {
            removePendingScore(candidate.id, candidate.score);
            const pending = readStoredEntries(PENDING_SCORES_STORAGE_KEY);
            const merged = mergeLeaderboard(serverEntries, pending);
            entriesRef.current = merged;
            setEntries(merged);
            writeStorage(LEADERBOARD_STORAGE_KEY, JSON.stringify(merged));
            return {
              isNewBest: typeof data.isNewBest === 'boolean' ? data.isNewBest : localNewBest,
            };
          }

          upsertPendingScore(candidate);
          setEntries((prev) => {
            const merged = mergeLeaderboard(serverEntries, prev);
            entriesRef.current = merged;
            writeStorage(LEADERBOARD_STORAGE_KEY, JSON.stringify(merged));
            return merged;
          });
          return { isNewBest: localNewBest };
        }

        upsertPendingScore(candidate);
      } catch {
        // Save pending score so it syncs automatically once online
        upsertPendingScore(candidate);
      } finally {
        cleanup();
        submittingRef.current = false;
        if (!unmountedRef.current) {
          setSubmitting(false);
        }
      }

      return { isNewBest: localNewBest };
    },
    [createTrackedRequest, setPlayerName]
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
