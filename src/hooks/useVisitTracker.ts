import { useEffect } from 'react';

const VISIT_API_URL = '/api/visit';
const VISIT_TIMEOUT_MS = 5000;
const IDLE_FALLBACK_DELAY_MS = 1500;

let sessionDispatched = false;

function detectClientDeviceType(): 'mobile' | 'desktop' {
  if (typeof navigator !== 'undefined') {
    const navWithUaData = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    if (typeof navWithUaData.userAgentData?.mobile === 'boolean') {
      return navWithUaData.userAgentData.mobile ? 'mobile' : 'desktop';
    }
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent)) {
      return 'mobile';
    }
    // Catch iPadOS / touch-only tablets that report a desktop user agent
    if (
      navigator.maxTouchPoints > 1 &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)').matches
    ) {
      return 'mobile';
    }
  }
  return 'desktop';
}

export function useVisitTracker(): void {
  useEffect(() => {
    if (sessionDispatched) return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const recordVisit = async () => {
      if (cancelled || sessionDispatched) return;
      sessionDispatched = true;

      const controller = new AbortController();
      const abortTimer = window.setTimeout(() => controller.abort(), VISIT_TIMEOUT_MS);

      try {
        await fetch(VISIT_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceType: detectClientDeviceType() }),
          cache: 'no-store',
          keepalive: true,
          signal: controller.signal,
        });
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
