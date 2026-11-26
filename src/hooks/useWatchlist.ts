import { useCallback, useEffect, useState } from 'react';
import type {
  GroupSizeOption,
  PublicWatchlistEntry,
  RsvpSubmission,
  WatchDateOption,
} from '../types/watchlist';

const API_INTERESTED_URL = '/api/interested';
const ABACUS_GET_URL = 'https://abacus.jasoncameron.dev/get/avengers-doomsday-campus/interested';
const ABACUS_HIT_URL = 'https://abacus.jasoncameron.dev/hit/avengers-doomsday-campus/interested';
const VOTED_STORAGE_KEY = 'doomsday_campus_interested';
const COUNT_STORAGE_KEY = 'doomsday_campus_interested_count';
const RSVP_STORAGE_KEY = 'doomsday_campus_rsvp';
const ROSTER_STORAGE_KEY = 'doomsday_campus_roster';
const FETCH_TIMEOUT_MS = 5000;

interface ApiResponse {
  count?: unknown;
  entries?: unknown;
  entry?: unknown;
}

function parseEntries(raw: unknown): PublicWatchlistEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: PublicWatchlistEntry[] = [];
  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as PublicWatchlistEntry).id === 'string' &&
      typeof (item as PublicWatchlistEntry).name === 'string' &&
      ((item as PublicWatchlistEntry).watchDate === 'dec-17' ||
        (item as PublicWatchlistEntry).watchDate === 'after-17')
    ) {
      const entry = item as PublicWatchlistEntry;
      valid.push({
        id: entry.id,
        name: entry.name,
        watchDate: entry.watchDate,
        groupSize:
          entry.groupSize === 'plus-one' || entry.groupSize === 'squad' ? entry.groupSize : 'solo',
        info: typeof entry.info === 'string' && entry.info ? entry.info : undefined,
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
      });
    }
  }
  return valid;
}

function mergeRoster(
  serverEntries: PublicWatchlistEntry[],
  localEntries: PublicWatchlistEntry[]
): PublicWatchlistEntry[] {
  const map = new Map<string, PublicWatchlistEntry>();
  for (const entry of serverEntries) {
    map.set(entry.id, entry);
  }
  for (const entry of localEntries) {
    if (!map.has(entry.id)) {
      map.set(entry.id, entry);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function fetchInitialWatchlist(
  signal: AbortSignal
): Promise<{ count: number | null; entries: PublicWatchlistEntry[] }> {
  try {
    const apiRes = await fetch(API_INTERESTED_URL, {
      method: 'GET',
      cache: 'no-store',
      signal,
    });
    const contentType = apiRes.headers.get('content-type') || '';
    if (apiRes.ok && contentType.includes('application/json')) {
      const data = (await apiRes.json()) as ApiResponse;
      const count =
        typeof data.count === 'number' && Number.isFinite(data.count) ? data.count : null;
      return { count, entries: parseEntries(data.entries) };
    }
  } catch (err) {
    if (signal.aborted) throw err;
  }

  const fallbackRes = await fetch(ABACUS_GET_URL, { cache: 'no-store', signal });
  if (fallbackRes.status === 404) {
    return { count: 0, entries: [] };
  }
  if (!fallbackRes.ok) {
    return { count: null, entries: [] };
  }
  const fallbackData = (await fallbackRes.json()) as { value?: unknown };
  const count =
    typeof fallbackData.value === 'number' && Number.isFinite(fallbackData.value)
      ? fallbackData.value
      : null;
  return { count, entries: [] };
}

async function incrementServerCount(signal: AbortSignal): Promise<number | null> {
  try {
    const apiRes = await fetch(API_INTERESTED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'count' }),
      cache: 'no-store',
      signal,
    });
    const contentType = apiRes.headers.get('content-type') || '';
    if (apiRes.ok && contentType.includes('application/json')) {
      const data = (await apiRes.json()) as ApiResponse;
      if (typeof data.count === 'number' && Number.isFinite(data.count)) {
        return data.count;
      }
    }
  } catch (err) {
    if (signal.aborted) throw err;
  }

  const fallbackRes = await fetch(ABACUS_HIT_URL, { cache: 'no-store', signal });
  if (!fallbackRes.ok) return null;
  const fallbackData = (await fallbackRes.json()) as { value?: unknown };
  return typeof fallbackData.value === 'number' && Number.isFinite(fallbackData.value)
    ? fallbackData.value
    : null;
}

export function useWatchlist() {
  const [interested, setInterested] = useState<boolean>(() => {
    try {
      return localStorage.getItem(VOTED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [interestCount, setInterestCount] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(COUNT_STORAGE_KEY));
      return Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch {
      return 0;
    }
  });

  const [rsvp, setRsvp] = useState<RsvpSubmission | null>(() => {
    try {
      const raw = localStorage.getItem(RSVP_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as RsvpSubmission;
    } catch {
      return null;
    }
  });

  const [entries, setEntries] = useState<PublicWatchlistEntry[]>(() => {
    try {
      const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
      if (!raw) return [];
      return parseEntries(JSON.parse(raw));
    } catch {
      return [];
    }
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetchInitialWatchlist(controller.signal)
      .then(({ count, entries: serverEntries }) => {
        if (typeof count === 'number') {
          setInterestCount(count);
          try {
            localStorage.setItem(COUNT_STORAGE_KEY, String(count));
          } catch {
            // Ignore storage errors
          }
        }
        if (serverEntries.length > 0) {
          setEntries((prev) => {
            const merged = mergeRoster(serverEntries, prev);
            try {
              localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(merged));
            } catch {
              // Ignore storage errors
            }
            return merged;
          });
        }
      })
      .catch(() => {
        // Keep local fallback state when offline or timed out
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const markInterested = useCallback(() => {
    if (interested) return;

    setInterested(true);
    setInterestCount((prev) => {
      const next = prev + 1;
      try {
        localStorage.setItem(VOTED_STORAGE_KEY, 'true');
        localStorage.setItem(COUNT_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    incrementServerCount(controller.signal)
      .then((count) => {
        if (typeof count === 'number') {
          setInterestCount(count);
          try {
            localStorage.setItem(COUNT_STORAGE_KEY, String(count));
          } catch {
            // Ignore storage errors
          }
        }
      })
      .catch(() => {
        // Optimistic count already applied
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
  }, [interested]);

  const submitRsvp = useCallback(
    async (data: {
      name: string;
      watchDate: WatchDateOption;
      groupSize: GroupSizeOption;
      info: string;
      contact: string;
    }) => {
      setSubmitting(true);
      const shouldIncrement = !interested;

      const localEntry: RsvpSubmission = {
        id: rsvp?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: data.name,
        watchDate: data.watchDate,
        groupSize: data.groupSize,
        ...(data.info ? { info: data.info } : {}),
        ...(data.contact ? { contact: data.contact } : {}),
        createdAt: rsvp?.createdAt ?? new Date().toISOString(),
      };

      setInterested(true);
      setRsvp(localEntry);

      setEntries((prev) => {
        const withoutOld = prev.filter((item) => item.id !== localEntry.id);
        const publicEntry: PublicWatchlistEntry = {
          id: localEntry.id,
          name: localEntry.name,
          watchDate: localEntry.watchDate,
          groupSize: localEntry.groupSize,
          ...(localEntry.info ? { info: localEntry.info } : {}),
          createdAt: localEntry.createdAt,
        };
        const next = [publicEntry, ...withoutOld];
        try {
          localStorage.setItem(VOTED_STORAGE_KEY, 'true');
          localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify(localEntry));
          localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });

      if (shouldIncrement) {
        setInterestCount((prev) => {
          const next = prev + 1;
          try {
            localStorage.setItem(COUNT_STORAGE_KEY, String(next));
          } catch {
            // Ignore storage errors
          }
          return next;
        });
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const res = await fetch(API_INTERESTED_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            incrementCount: shouldIncrement,
          }),
          cache: 'no-store',
          signal: controller.signal,
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const result = (await res.json()) as ApiResponse;
          if (typeof result.count === 'number' && Number.isFinite(result.count)) {
            setInterestCount(result.count);
            try {
              localStorage.setItem(COUNT_STORAGE_KEY, String(result.count));
            } catch {
              // Ignore storage errors
            }
          }
          const serverEntries = parseEntries(result.entries);
          if (serverEntries.length > 0) {
            setEntries((prev) => {
              const merged = mergeRoster(serverEntries, prev);
              try {
                localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(merged));
              } catch {
                // Ignore storage errors
              }
              return merged;
            });
          }
        }
      } catch {
        // Local optimistic entry already saved
      } finally {
        window.clearTimeout(timeoutId);
        setSubmitting(false);
      }
    },
    [interested, rsvp]
  );

  return {
    interested,
    interestCount,
    rsvp,
    entries,
    submitting,
    markInterested,
    submitRsvp,
  };
}
