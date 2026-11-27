import { useEffect } from 'react';

const VISIT_API_URL = '/api/visit';
const VISIT_STORAGE_KEY = 'doomsday_site_visited';
const VISIT_TIMEOUT_MS = 5000;
const IDLE_FALLBACK_DELAY_MS = 1500;

let sessionDispatched = false;

function hasVisitedBefore(): boolean {
  try {
    return localStorage.getItem(VISIT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markVisited(): void {
  try {
    localStorage.setItem(VISIT_STORAGE_KEY, '1');
  } catch {
    // Ignore storage access errors
  }
}

export function useVisitTracker(): void {
  useEffect(() => {
    if (sessionDispatched || hasVisitedBefore()) return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const recordVisit = async () => {
      if (cancelled || sessionDispatched || hasVisitedBefore()) return;
      sessionDispatched = true;

      const controller = new AbortController();
      const abortTimer = window.setTimeout(() => controller.abort(), VISIT_TIMEOUT_MS);

      try {
        const res = await fetch(VISIT_API_URL, {
          method: 'POST',
          cache: 'no-store',
          keepalive: true,
          signal: controller.signal,
        });

        // 204 ensures only the real serverless API marks the visit (not Vite's 200 HTML fallback)
        if (res.status === 204) {
          markVisited();
        }
      } catch {
        // Silently ignore network errors so visit tracking never affects the app
      } finally {
        window.clearTimeout(abortTimer);
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(() => {
        void recordVisit();
      }, { timeout: 3000 });
    } else {
      timeoutHandle = window.setTimeout(() => {
        void recordVisit();
      }, IDLE_FALLBACK_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, []);
}
