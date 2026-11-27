import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GroupSizeOption,
  PublicWatchlistEntry,
  RsvpSubmission,
  WatchDateOption,
} from '../types/watchlist';
import {
  normalizeNameKey,
  readStorageJson,
  readStorageString,
  removeStorage,
  sanitizeText,
  writeStorage,
} from '../utils/common';

const API_INTERESTED_URL = '/api/interested';
const ABACUS_GET_URL = 'https://abacus.jasoncameron.dev/get/avengers-doomsday-campus/interested';
const ABACUS_HIT_URL = 'https://abacus.jasoncameron.dev/hit/avengers-doomsday-campus/interested';
const VOTED_STORAGE_KEY = 'doomsday_campus_interested';
const PENDING_VOTE_STORAGE_KEY = 'doomsday_campus_pending_vote';
const COUNT_STORAGE_KEY = 'doomsday_campus_interested_count';
const RSVP_STORAGE_KEY = 'doomsday_campus_rsvp';
const ROSTER_STORAGE_KEY = 'doomsday_campus_roster';
const FETCH_TIMEOUT_MS = 5000;
const MIN_AUTO_REFRESH_INTERVAL_MS = 2500;
const MODAL_POLL_INTERVAL_MS = 10000;
const BACKGROUND_POLL_INTERVAL_MS = 30000;

type ApiSource = 'redis' | 'abacus' | 'unknown';

interface ApiResponse {
  count?: unknown;
  entries?: unknown;
  entry?: unknown;
  source?: unknown;
}

interface UseWatchlistOptions {
  activeModalOpen?: boolean;
}

function parseSingleEntry(item: unknown): PublicWatchlistEntry | null {
  if (typeof item !== 'object' || item === null) return null;
  const candidate = item as Partial<PublicWatchlistEntry>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    (candidate.watchDate !== 'dec-17' && candidate.watchDate !== 'after-17')
  ) {
    return null;
  }

  const trimmedName = sanitizeText(candidate.name, 40);
  if (!trimmedName) return null;

  const trimmedInfo = sanitizeText(candidate.info, 60);
  return {
    id: candidate.id,
    name: trimmedName,
    watchDate: candidate.watchDate,
    groupSize:
      candidate.groupSize === 'plus-one' || candidate.groupSize === 'squad'
        ? candidate.groupSize
        : 'solo',
    info: trimmedInfo || undefined,
    createdAt:
      typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
  };
}

function parseStoredRsvp(raw: unknown): RsvpSubmission | null {
  const base = parseSingleEntry(raw);
  if (!base) return null;
  const candidate = raw as Partial<RsvpSubmission>;
  const contact = sanitizeText(candidate.contact, 80);
  return {
    ...base,
    ...(contact ? { contact } : {}),
    synced: candidate.synced === true,
  };
}

function parseEntries(raw: unknown): PublicWatchlistEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: PublicWatchlistEntry[] = [];
  for (const item of raw) {
    const parsed = parseSingleEntry(item);
    if (parsed) {
      valid.push(parsed);
    }
  }
  return valid;
}

function deduplicateRoster(entries: PublicWatchlistEntry[]): PublicWatchlistEntry[] {
  if (entries.length <= 1) {
    return entries.filter((e) => normalizeNameKey(e.name).length > 0);
  }

  // Precompute timestamps once (O(N)) rather than parsing inside comparator (O(N log N))
  const withTime = entries.map((entry) => {
    const ts = Date.parse(entry.createdAt);
    return { entry, ts: Number.isFinite(ts) ? ts : 0 };
  });
  withTime.sort((a, b) => b.ts - a.ts);

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const unique: PublicWatchlistEntry[] = [];

  for (const { entry } of withTime) {
    const nameKey = normalizeNameKey(entry.name);
    if (!nameKey || seenIds.has(entry.id) || seenNames.has(nameKey)) {
      continue;
    }
    seenIds.add(entry.id);
    seenNames.add(nameKey);
    unique.push(entry);
  }

  return unique;
}

function toPublicEntry(rsvp: RsvpSubmission): PublicWatchlistEntry {
  return {
    id: rsvp.id,
    name: rsvp.name,
    watchDate: rsvp.watchDate,
    groupSize: rsvp.groupSize,
    ...(rsvp.info ? { info: rsvp.info } : {}),
    createdAt: rsvp.createdAt,
  };
}

async function fetchWatchlistState(
  signal: AbortSignal
): Promise<{ count: number | null; entries: PublicWatchlistEntry[]; source: ApiSource }> {
  try {
    const apiRes = await fetch(`${API_INTERESTED_URL}?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal,
    });
    const contentType = apiRes.headers.get('content-type') || '';
    if (apiRes.ok && contentType.includes('application/json')) {
      const data = (await apiRes.json()) as ApiResponse;
      const count =
        typeof data.count === 'number' && Number.isFinite(data.count) ? data.count : null;
      const source: ApiSource =
        data.source === 'redis' ? 'redis' : data.source === 'abacus' ? 'abacus' : 'unknown';
      return { count, entries: deduplicateRoster(parseEntries(data.entries)), source };
    }
  } catch (err) {
    if (signal.aborted) throw err;
  }

  const fallbackRes = await fetch(ABACUS_GET_URL, { cache: 'no-store', signal });
  if (fallbackRes.status === 404) {
    return { count: 0, entries: [], source: 'abacus' };
  }
  if (!fallbackRes.ok) {
    return { count: null, entries: [], source: 'unknown' };
  }
  const fallbackData = (await fallbackRes.json()) as { value?: unknown };
  const count =
    typeof fallbackData.value === 'number' && Number.isFinite(fallbackData.value)
      ? fallbackData.value
      : null;
  return { count, entries: [], source: 'abacus' };
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

export function useWatchlist(options: UseWatchlistOptions = {}) {
  const { activeModalOpen = false } = options;

  const [interested, setInterested] = useState<boolean>(
    () => readStorageString(VOTED_STORAGE_KEY) === 'true'
  );

  const [interestCount, setInterestCount] = useState<number>(() => {
    const saved = Number(readStorageString(COUNT_STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
  });

  const [rsvp, setRsvp] = useState<RsvpSubmission | null>(() =>
    parseStoredRsvp(readStorageJson<unknown>(RSVP_STORAGE_KEY))
  );

  const [entries, setEntries] = useState<PublicWatchlistEntry[]>(() =>
    deduplicateRoster(parseEntries(readStorageJson<unknown>(ROSTER_STORAGE_KEY)))
  );

  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const interestedRef = useRef(interested);
  interestedRef.current = interested;
  const interestCountRef = useRef(interestCount);
  interestCountRef.current = interestCount;
  const rsvpRef = useRef<RsvpSubmission | null>(rsvp);
  rsvpRef.current = rsvp;
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;
  const refreshInFlightRef = useRef(false);
  const unsyncedSyncInFlightRef = useRef(false);
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

  const updateRsvpState = useCallback((nextRsvp: RsvpSubmission | null) => {
    rsvpRef.current = nextRsvp;
    if (!unmountedRef.current) {
      setRsvp(nextRsvp);
    }
    if (nextRsvp) {
      writeStorage(RSVP_STORAGE_KEY, JSON.stringify(nextRsvp));
    }
  }, []);

  const syncUnsyncedRsvp = useCallback(
    async (pendingRsvp: RsvpSubmission) => {
      if (unsyncedSyncInFlightRef.current || submittingRef.current || unmountedRef.current) return;
      unsyncedSyncInFlightRef.current = true;

      const hasPendingVote = readStorageString(PENDING_VOTE_STORAGE_KEY) === '1';
      const { controller, cleanup } = createTrackedRequest();

      try {
        const res = await fetch(API_INTERESTED_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: pendingRsvp.id,
            name: pendingRsvp.name,
            watchDate: pendingRsvp.watchDate,
            groupSize: pendingRsvp.groupSize,
            info: pendingRsvp.info ?? '',
            contact: pendingRsvp.contact ?? '',
            incrementCount: hasPendingVote,
          }),
          cache: 'no-store',
          signal: controller.signal,
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json') && !unmountedRef.current) {
          const result = (await res.json()) as ApiResponse;
          if (hasPendingVote) {
            removeStorage(PENDING_VOTE_STORAGE_KEY);
          }

          const serverEntry = parseSingleEntry(result.entry);
          if (serverEntry) {
            updateRsvpState({
              ...pendingRsvp,
              id: serverEntry.id,
              createdAt: serverEntry.createdAt,
              synced: result.source === 'redis',
            });
          }
          if (result.source === 'redis') {
            const next = deduplicateRoster(parseEntries(result.entries));
            setEntries(next);
            writeStorage(ROSTER_STORAGE_KEY, JSON.stringify(next));
          }
          if (typeof result.count === 'number' && Number.isFinite(result.count)) {
            interestCountRef.current = result.count;
            setInterestCount(result.count);
            writeStorage(COUNT_STORAGE_KEY, String(result.count));
          }
        }
      } catch {
        // Retry on next refresh if offline
      } finally {
        cleanup();
        unsyncedSyncInFlightRef.current = false;
      }
    },
    [createTrackedRequest, updateRsvpState]
  );

  const refresh = useCallback(
    async (force = false) => {
      if (submittingRef.current || refreshInFlightRef.current || unmountedRef.current) return;
      if (!force && Date.now() - lastFetchAtRef.current < MIN_AUTO_REFRESH_INTERVAL_MS) {
        return;
      }

      refreshInFlightRef.current = true;
      setRefreshing(true);

      const { controller, cleanup } = createTrackedRequest();

      try {
        // Flush any queued standalone vote before reading latest count
        if (readStorageString(PENDING_VOTE_STORAGE_KEY) === '1' && !rsvpRef.current) {
          try {
            const syncedCount = await incrementServerCount(controller.signal);
            if (typeof syncedCount === 'number') {
              removeStorage(PENDING_VOTE_STORAGE_KEY);
            }
          } catch {
            // Will retry on next refresh
          }
        }

        const { count, entries: serverEntries, source } = await fetchWatchlistState(
          controller.signal
        );
        if (unmountedRef.current) return;

        lastFetchAtRef.current = Date.now();

        if (typeof count === 'number') {
          interestCountRef.current = count;
          setInterestCount(count);
          writeStorage(COUNT_STORAGE_KEY, String(count));
        }

        if (source === 'redis') {
          const currentRsvp = rsvpRef.current;
          let nextEntries = serverEntries;

          if (currentRsvp) {
            const currentNameKey = normalizeNameKey(currentRsvp.name);
            const matched = serverEntries.find(
              (item) => item.id === currentRsvp.id || normalizeNameKey(item.name) === currentNameKey
            );

            if (matched) {
              removeStorage(PENDING_VOTE_STORAGE_KEY);
              if (currentRsvp.id !== matched.id || currentRsvp.synced !== true) {
                updateRsvpState({
                  ...currentRsvp,
                  id: matched.id,
                  createdAt: matched.createdAt,
                  synced: true,
                });
              }
            } else if (currentRsvp.synced === false) {
              nextEntries = deduplicateRoster([toPublicEntry(currentRsvp), ...serverEntries]);
              void syncUnsyncedRsvp(currentRsvp);
            }
          }

          setEntries(nextEntries);
          writeStorage(ROSTER_STORAGE_KEY, JSON.stringify(nextEntries));
        } else if (serverEntries.length > 0) {
          setEntries((prev) => {
            const merged = deduplicateRoster([...serverEntries, ...prev]);
            writeStorage(ROSTER_STORAGE_KEY, JSON.stringify(merged));
            return merged;
          });
        }
      } catch {
        // Keep local fallback state when offline or timed out
      } finally {
        cleanup();
        refreshInFlightRef.current = false;
        if (!unmountedRef.current) {
          setRefreshing(false);
        }
      }
    },
    [createTrackedRequest, syncUnsyncedRsvp, updateRsvpState]
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
      if (e.key === ROSTER_STORAGE_KEY && e.newValue) {
        try {
          setEntries(deduplicateRoster(parseEntries(JSON.parse(e.newValue))));
        } catch {
          // Ignore malformed storage payload
        }
      } else if (e.key === COUNT_STORAGE_KEY && e.newValue) {
        const nextCount = Number(e.newValue);
        if (Number.isFinite(nextCount) && nextCount >= 0) {
          interestCountRef.current = nextCount;
          setInterestCount(nextCount);
        }
      } else if (e.key === RSVP_STORAGE_KEY && e.newValue) {
        try {
          const parsed = parseStoredRsvp(JSON.parse(e.newValue));
          if (parsed) {
            rsvpRef.current = parsed;
            setRsvp(parsed);
          }
        } catch {
          // Ignore malformed storage payload
        }
      } else if (e.key === VOTED_STORAGE_KEY) {
        const nextVoted = e.newValue === 'true';
        interestedRef.current = nextVoted;
        setInterested(nextVoted);
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

  // Refresh immediately when a watchlist/RSVP modal opens, and poll while open or visible
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

  const markInterested = useCallback(() => {
    if (interestedRef.current) return;

    interestedRef.current = true;
    const nextCount = interestCountRef.current + 1;
    interestCountRef.current = nextCount;

    setInterested(true);
    setInterestCount(nextCount);
    writeStorage(VOTED_STORAGE_KEY, 'true');
    writeStorage(COUNT_STORAGE_KEY, String(nextCount));
    writeStorage(PENDING_VOTE_STORAGE_KEY, '1');

    const { controller, cleanup } = createTrackedRequest();

    incrementServerCount(controller.signal)
      .then((count) => {
        if (typeof count === 'number') {
          removeStorage(PENDING_VOTE_STORAGE_KEY);
          if (!unmountedRef.current) {
            interestCountRef.current = count;
            setInterestCount(count);
            writeStorage(COUNT_STORAGE_KEY, String(count));
          }
        }
      })
      .catch(() => {
        // Pending vote flag remains in storage for automatic retry
      })
      .finally(() => {
        cleanup();
      });
  }, [createTrackedRequest]);

  const submitRsvp = useCallback(
    async (data: {
      name: string;
      watchDate: WatchDateOption;
      groupSize: GroupSizeOption;
      info: string;
      contact: string;
    }) => {
      setSubmitting(true);
      submittingRef.current = true;

      const hasPendingVote = readStorageString(PENDING_VOTE_STORAGE_KEY) === '1';
      const shouldIncrement = !interestedRef.current || hasPendingVote;
      const prevRsvp = rsvpRef.current;
      const cleanName = sanitizeText(data.name, 40);
      const cleanInfo = sanitizeText(data.info, 60);
      const cleanContact = sanitizeText(data.contact, 80);

      const localEntry: RsvpSubmission = {
        id: prevRsvp?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        watchDate: data.watchDate,
        groupSize: data.groupSize,
        ...(cleanInfo ? { info: cleanInfo } : {}),
        ...(cleanContact ? { contact: cleanContact } : {}),
        createdAt: new Date().toISOString(),
        synced: false,
      };

      const wasInterested = interestedRef.current;
      interestedRef.current = true;
      setInterested(true);
      writeStorage(VOTED_STORAGE_KEY, 'true');
      updateRsvpState(localEntry);

      const newNameKey = normalizeNameKey(localEntry.name);
      const oldNameKey = prevRsvp ? normalizeNameKey(prevRsvp.name) : '';

      setEntries((prev) => {
        const withoutOld = prev.filter((item) => {
          const itemKey = normalizeNameKey(item.name);
          return (
            item.id !== localEntry.id &&
            itemKey !== newNameKey &&
            (!oldNameKey || itemKey !== oldNameKey)
          );
        });
        const next = deduplicateRoster([toPublicEntry(localEntry), ...withoutOld]);
        writeStorage(ROSTER_STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      if (!wasInterested) {
        const nextCount = interestCountRef.current + 1;
        interestCountRef.current = nextCount;
        setInterestCount(nextCount);
        writeStorage(COUNT_STORAGE_KEY, String(nextCount));
      }

      const { controller, cleanup } = createTrackedRequest();

      try {
        const res = await fetch(API_INTERESTED_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: localEntry.id,
            watchDate: data.watchDate,
            groupSize: data.groupSize,
            info: cleanInfo,
            contact: cleanContact,
            name: cleanName,
            incrementCount: shouldIncrement,
          }),
          cache: 'no-store',
          signal: controller.signal,
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json') && !unmountedRef.current) {
          const result = (await res.json()) as ApiResponse;
          lastFetchAtRef.current = Date.now();
          removeStorage(PENDING_VOTE_STORAGE_KEY);

          if (typeof result.count === 'number' && Number.isFinite(result.count)) {
            interestCountRef.current = result.count;
            setInterestCount(result.count);
            writeStorage(COUNT_STORAGE_KEY, String(result.count));
          }

          const serverEntry = parseSingleEntry(result.entry);
          if (serverEntry) {
            updateRsvpState({
              ...localEntry,
              id: serverEntry.id,
              createdAt: serverEntry.createdAt,
              synced: result.source === 'redis',
            });
          }

          const serverEntries = deduplicateRoster(parseEntries(result.entries));
          if (result.source === 'redis') {
            setEntries(serverEntries);
            writeStorage(ROSTER_STORAGE_KEY, JSON.stringify(serverEntries));
          } else if (serverEntries.length > 0) {
            setEntries((prev) => {
              const merged = deduplicateRoster([...serverEntries, ...prev]);
              writeStorage(ROSTER_STORAGE_KEY, JSON.stringify(merged));
              return merged;
            });
          }
        }
      } catch {
        // Local optimistic entry already saved with synced: false for retry
      } finally {
        cleanup();
        submittingRef.current = false;
        if (!unmountedRef.current) {
          setSubmitting(false);
        }
      }
    },
    [createTrackedRequest, updateRsvpState]
  );

  return {
    interested,
    interestCount,
    rsvp,
    entries,
    submitting,
    refreshing,
    refresh,
    markInterested,
    submitRsvp,
  };
}
