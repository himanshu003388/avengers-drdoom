/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Heart } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AtmosphericCanvas } from './components/AtmosphericCanvas';
import { BackgroundStage } from './components/BackgroundStage';
import { CinematicOverlay } from './components/CinematicOverlay';
import { CinematicPreloader } from './components/CinematicPreloader';
import { DoomsdayWebGLScene } from './components/DoomsdayWebGLScene';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HeroSection } from './components/HeroSection';
import { Navbar } from './components/Navbar';
import { CHARACTERS, type CharacterProfile } from './data/characters';
import { useLeaderboard } from './hooks/useLeaderboard';
import { useVisitTracker } from './hooks/useVisitTracker';
import { useWatchlist } from './hooks/useWatchlist';
import type { AtmosphereMode } from './utils/atmosphere';

const loadTrailerModal = () =>
  import('./components/TrailerModal').then((m) => ({ default: m.TrailerModal }));
const loadInterestModal = () =>
  import('./components/InterestModal').then((m) => ({ default: m.InterestModal }));
const loadWatchlistModal = () =>
  import('./components/WatchlistModal').then((m) => ({ default: m.WatchlistModal }));
const loadDoomsdayGameModal = () =>
  import('./components/DoomsdayGameModal').then((m) => ({ default: m.DoomsdayGameModal }));

const TrailerModal = lazy(loadTrailerModal);
const InterestModal = lazy(loadInterestModal);
const WatchlistModal = lazy(loadWatchlistModal);
const DoomsdayGameModal = lazy(loadDoomsdayGameModal);

function ModalFallback() {
  return (
    <div
      role="status"
      aria-label="Loading dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-400/25 border-t-emerald-400" />
    </div>
  );
}

export default function App() {
  useVisitTracker();
  const [preloaderDone, setPreloaderDone] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  const [atmosphereMode, setAtmosphereMode] = useState<AtmosphereMode>('smoke-and-embers');
  const [activeCharacterId, setActiveCharacterId] = useState<string>(CHARACTERS[0].id);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);

  const anyModalOpen = trailerOpen || interestModalOpen || watchlistOpen || gameOpen;
  const {
    interested,
    interestCount,
    rsvp,
    entries,
    submitting,
    refreshing: refreshingWatchlist,
    refresh: refreshWatchlist,
    markInterested,
    submitRsvp,
  } = useWatchlist({
    activeModalOpen: watchlistOpen || interestModalOpen,
  });
  const {
    playerName,
    setPlayerName,
    entries: leaderboardEntries,
    loading: loadingLeaderboard,
    submitting: submittingScore,
    refresh: refreshLeaderboard,
    submitScore,
  } = useLeaderboard(rsvp?.name, { activeModalOpen: gameOpen });

  const mainRef = useRef<HTMLElement | null>(null);
  const activeCharacterIdRef = useRef(activeCharacterId);
  activeCharacterIdRef.current = activeCharacterId;
  const surgeTimeoutRef = useRef<number | null>(null);
  const lastScrollSwitchRef = useRef<number>(0);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    mainScrollTop: number;
    consumed: boolean;
  } | null>(null);

  const activeCharacter: CharacterProfile =
    CHARACTERS.find((c) => c.id === activeCharacterId) ?? CHARACTERS[0];

  const triggerEmberSurge = useCallback(() => {
    setAtmosphereMode('ember-surge');
    if (surgeTimeoutRef.current) {
      window.clearTimeout(surgeTimeoutRef.current);
    }
    surgeTimeoutRef.current = window.setTimeout(() => {
      setAtmosphereMode('smoke-and-embers');
    }, 900);
  }, []);

  const stepDossier = useCallback(
    (direction: 1 | -1, cooldownMs = 680) => {
      const now = performance.now();
      if (now - lastScrollSwitchRef.current < cooldownMs) return false;
      lastScrollSwitchRef.current = now;

      const currentIndex = Math.max(
        0,
        CHARACTERS.findIndex((c) => c.id === activeCharacterIdRef.current)
      );
      const nextIndex = (currentIndex + direction + CHARACTERS.length) % CHARACTERS.length;
      const nextId = CHARACTERS[nextIndex].id;

      activeCharacterIdRef.current = nextId;
      setTransitionDirection(direction);
      setActiveCharacterId(nextId);
      triggerEmberSurge();
      return true;
    },
    [triggerEmberSurge]
  );

  const selectCharacter = useCallback(
    (id: string) => {
      const prevId = activeCharacterIdRef.current;
      if (prevId === id) return;
      const prevIdx = CHARACTERS.findIndex((c) => c.id === prevId);
      const nextIdx = CHARACTERS.findIndex((c) => c.id === id);
      activeCharacterIdRef.current = id;
      setTransitionDirection(nextIdx >= prevIdx ? 1 : -1);
      setActiveCharacterId(id);
      triggerEmberSurge();
    },
    [triggerEmberSurge]
  );

  // Idle-prefetch modal chunks so initial bundle stays small while opening modals feels instant
  useEffect(() => {
    const prefetch = () => {
      void loadTrailerModal();
      void loadInterestModal();
      void loadWatchlistModal();
      void loadDoomsdayGameModal();
    };

    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void })
      .cancelIdleCallback;

    if (typeof ric === 'function') {
      const id = ric(prefetch, { timeout: 2500 });
      return () => cic?.(id);
    }

    const timer = window.setTimeout(prefetch, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const WHEEL_THRESHOLD = 115;
    const WHEEL_COOLDOWN_MS = 740;
    const TOUCH_THRESHOLD = 48;
    const FLICK_MIN_DISTANCE = 22;
    const FLICK_MAX_MS = 260;
    const TOUCH_COOLDOWN_MS = 680;

    let wheelAccum = 0;
    let lastWheelAt = 0;

    const canMainScrollInDirection = (dir: 1 | -1) => {
      const main = mainRef.current;
      if (!main || main.scrollHeight <= main.clientHeight + 4) return false;
      if (dir > 0) {
        return main.scrollTop + main.clientHeight < main.scrollHeight - 4;
      }
      return main.scrollTop > 4;
    };

    const handleWheel = (e: WheelEvent) => {
      if (anyModalOpen || e.ctrlKey) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      const dx = e.deltaMode === 1 ? e.deltaX * 32 : e.deltaX;
      if (Math.abs(dy) < Math.abs(dx) || Math.abs(dy) < 2) return;

      const now = performance.now();
      if (now - lastScrollSwitchRef.current < WHEEL_COOLDOWN_MS) {
        // Discard residual trackpad inertia during cooldown
        wheelAccum = 0;
        lastWheelAt = now;
        return;
      }

      if (now - lastWheelAt > 240 || (wheelAccum !== 0 && Math.sign(dy) !== Math.sign(wheelAccum))) {
        wheelAccum = 0;
      }
      lastWheelAt = now;
      wheelAccum += dy;

      if (Math.abs(wheelAccum) >= WHEEL_THRESHOLD) {
        const dir: 1 | -1 = wheelAccum > 0 ? 1 : -1;
        if (canMainScrollInDirection(dir)) return;
        wheelAccum = 0;
        stepDossier(dir, WHEEL_COOLDOWN_MS);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (anyModalOpen || e.touches.length !== 1) {
        touchStartRef.current = null;
        return;
      }
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: performance.now(),
        mainScrollTop: mainRef.current?.scrollTop ?? 0,
        consumed: false,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      const start = touchStartRef.current;
      if (anyModalOpen || !start || start.consumed || e.touches.length !== 1) return;
      if (performance.now() - lastScrollSwitchRef.current < TOUCH_COOLDOWN_MS) return;

      const currentScrollTop = mainRef.current?.scrollTop ?? 0;
      if (Math.abs(currentScrollTop - start.mainScrollTop) > 4) {
        start.consumed = true;
        return;
      }

      const deltaX = start.x - e.touches[0].clientX;
      const deltaY = start.y - e.touches[0].clientY;
      const absY = Math.abs(deltaY);
      const absX = Math.abs(deltaX);

      if (absY >= TOUCH_THRESHOLD && absY > absX * 1.15) {
        const dir: 1 | -1 = deltaY > 0 ? 1 : -1;
        if (canMainScrollInDirection(dir)) return;
        start.consumed = true;
        stepDossier(dir, TOUCH_COOLDOWN_MS);
      }
    };

    const handleTouchCancel = () => {
      touchStartRef.current = null;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (anyModalOpen || !start || start.consumed || e.changedTouches.length === 0) return;

      const currentScrollTop = mainRef.current?.scrollTop ?? 0;
      if (Math.abs(currentScrollTop - start.mainScrollTop) > 4) return;

      const deltaX = start.x - e.changedTouches[0].clientX;
      const deltaY = start.y - e.changedTouches[0].clientY;
      const elapsedMs = performance.now() - start.time;
      const absY = Math.abs(deltaY);
      const absX = Math.abs(deltaX);

      const isQuickFlick = absY >= FLICK_MIN_DISTANCE && elapsedMs <= FLICK_MAX_MS;
      const meetsDistance = absY >= TOUCH_THRESHOLD || isQuickFlick;
      if (!meetsDistance || absY <= absX) return;

      const dir: 1 | -1 = deltaY > 0 ? 1 : -1;
      if (canMainScrollInDirection(dir)) return;
      stepDossier(dir, TOUCH_COOLDOWN_MS);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        stepDossier(1, 520);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        stepDossier(-1, 520);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchcancel', handleTouchCancel);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stepDossier, anyModalOpen]);

  useEffect(() => {
    return () => {
      if (surgeTimeoutRef.current) {
        window.clearTimeout(surgeTimeoutRef.current);
      }
    };
  }, []);

  const handlePreloaderComplete = useCallback(() => {
    setPreloaderDone(true);
  }, []);

  const handleOpenTrailer = useCallback(() => {
    setTrailerOpen(true);
  }, []);

  const handleCloseTrailer = useCallback(() => {
    setTrailerOpen(false);
  }, []);

  const handleResetHome = useCallback(() => {
    selectCharacter(CHARACTERS[0].id);
  }, [selectCharacter]);

  const handleOpenGame = useCallback(() => {
    setGameOpen(true);
  }, []);

  const handleCloseGame = useCallback(() => {
    setGameOpen(false);
  }, []);

  const handleOpenInterest = useCallback(() => {
    markInterested();
    setInterestModalOpen(true);
  }, [markInterested]);

  const handleCloseInterest = useCallback(() => {
    setInterestModalOpen(false);
  }, []);

  const handleOpenWatchlist = useCallback(() => {
    setWatchlistOpen(true);
  }, []);

  const handleCloseWatchlist = useCallback(() => {
    setWatchlistOpen(false);
  }, []);

  const handleRefreshWatchlist = useCallback(() => {
    void refreshWatchlist(true);
  }, [refreshWatchlist]);

  const handleRefreshLeaderboard = useCallback(
    () => refreshLeaderboard(true),
    [refreshLeaderboard]
  );

  const handleOpenRsvpFromWatchlist = useCallback(() => {
    markInterested();
    setInterestModalOpen(true);
  }, [markInterested]);

  const handleStepDossierClick = useCallback(
    (dir: 1 | -1) => {
      stepDossier(dir, 520);
    },
    [stepDossier]
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden overscroll-none bg-[#020503]">
      {!preloaderDone && <CinematicPreloader onComplete={handlePreloaderComplete} />}

      <ErrorBoundary silent>
        <BackgroundStage
          characters={CHARACTERS}
          activeCharacterId={activeCharacter.id}
          activeCharacterOverride={activeCharacter}
          transitionDirection={transitionDirection}
          paused={anyModalOpen}
        />
      </ErrorBoundary>

      <ErrorBoundary silent>
        <DoomsdayWebGLScene
          accentHex={activeCharacter.accentHex}
          mode={atmosphereMode}
          paused={anyModalOpen}
        />
      </ErrorBoundary>

      <ErrorBoundary silent>
        <AtmosphericCanvas
          mode={atmosphereMode}
          activeCharacter={activeCharacter}
          paused={anyModalOpen}
        />
      </ErrorBoundary>

      <ErrorBoundary silent>
        <CinematicOverlay />
      </ErrorBoundary>

      <Navbar onResetHome={handleResetHome} onOpenGame={handleOpenGame} />

      <main
        ref={mainRef}
        className="relative z-20 flex min-h-0 flex-1 touch-pan-y flex-col overflow-x-hidden overflow-y-auto"
        data-active-backdrop={activeCharacter.id}
      >
        <HeroSection
          activeCharacter={activeCharacter}
          characters={CHARACTERS}
          transitionDirection={transitionDirection}
          interested={interested}
          interestCount={interestCount}
          rsvp={rsvp}
          rosterCount={entries.length}
          onSurgeAtmosphere={triggerEmberSurge}
          onOpenTrailer={handleOpenTrailer}
          onOpenInterest={handleOpenInterest}
          onOpenWatchlist={handleOpenWatchlist}
          onStepDossier={handleStepDossierClick}
        />
      </main>

      {trailerOpen && (
        <ErrorBoundary silent>
          <Suspense fallback={<ModalFallback />}>
            <TrailerModal open={trailerOpen} onClose={handleCloseTrailer} />
          </Suspense>
        </ErrorBoundary>
      )}

      {interestModalOpen && (
        <ErrorBoundary silent>
          <Suspense fallback={<ModalFallback />}>
            <InterestModal
              open={interestModalOpen}
              accentHex={activeCharacter.accentHex}
              existingRsvp={rsvp}
              entries={entries}
              submitting={submitting}
              onClose={handleCloseInterest}
              onSubmit={submitRsvp}
              onOpenWatchlist={handleOpenWatchlist}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {watchlistOpen && (
        <ErrorBoundary silent>
          <Suspense fallback={<ModalFallback />}>
            <WatchlistModal
              open={watchlistOpen}
              accentHex={activeCharacter.accentHex}
              entries={entries}
              totalCount={interestCount}
              hasSubmittedRsvp={Boolean(rsvp)}
              currentRsvpName={rsvp?.name}
              refreshing={refreshingWatchlist}
              onRefresh={handleRefreshWatchlist}
              onClose={handleCloseWatchlist}
              onOpenRsvp={handleOpenRsvpFromWatchlist}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {gameOpen && (
        <ErrorBoundary silent>
          <Suspense fallback={<ModalFallback />}>
            <DoomsdayGameModal
              open={gameOpen}
              accentHex={activeCharacter.accentHex}
              characterName={activeCharacter.name}
              characterFaction={activeCharacter.faction}
              playerName={playerName}
              entries={leaderboardEntries}
              loadingLeaderboard={loadingLeaderboard}
              submittingScore={submittingScore}
              onPlayerNameChange={setPlayerName}
              onSubmitScore={submitScore}
              onRefreshLeaderboard={handleRefreshLeaderboard}
              onClose={handleCloseGame}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      <footer className="pointer-events-none relative z-30 shrink-0 select-none px-[clamp(0.75rem,3vw,2rem)] pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center md:pb-[max(0.875rem,env(safe-area-inset-bottom))] md:text-right">
        <p className="inline-flex items-center gap-1.5 text-[clamp(0.5625rem,1.2vw,0.625rem)] font-medium tracking-[0.2em] text-white/70 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          <span>Made with</span>
          <Heart className="h-3 w-3 fill-white text-white" aria-hidden="true" />
          <span>by Himanshu</span>
        </p>
      </footer>
    </div>
  );
}
