/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Heart } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AtmosphericCanvas } from './components/AtmosphericCanvas';
import { BackgroundStage } from './components/BackgroundStage';
import { CinematicOverlay } from './components/CinematicOverlay';
import { CinematicPreloader } from './components/CinematicPreloader';
import { DoomsdayWebGLScene } from './components/DoomsdayWebGLScene';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HeroSection } from './components/HeroSection';
import { Navbar } from './components/Navbar';
import { TrailerModal } from './components/TrailerModal';
import { CHARACTERS, type CharacterProfile } from './data/characters';
import type { AtmosphereMode } from './utils/atmosphere';
import { soundEngine } from './utils/sound';

export default function App() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [atmosphereMode, setAtmosphereMode] = useState<AtmosphereMode>('smoke-and-embers');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState<string>(CHARACTERS[0].id);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeCharacterIdRef = useRef<string>(activeCharacterId);
  activeCharacterIdRef.current = activeCharacterId;
  const surgeTimeoutRef = useRef<number | null>(null);
  const lastScrollSwitchRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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
    (direction: 1 | -1, cooldownMs = 1100) => {
      const now = performance.now();
      if (now - lastScrollSwitchRef.current < cooldownMs) return;
      lastScrollSwitchRef.current = now;

      setActiveCharacterId((prevId) => {
        const currentIndex = Math.max(
          0,
          CHARACTERS.findIndex((c) => c.id === prevId)
        );
        const nextIndex = (currentIndex + direction + CHARACTERS.length) % CHARACTERS.length;
        return CHARACTERS[nextIndex].id;
      });
      soundEngine.playUiCue(direction > 0 ? 310 : 250);
      triggerEmberSurge();
    },
    [triggerEmberSurge]
  );

  const selectCharacter = useCallback(
    (id: string) => {
      setActiveCharacterId((prevId) => {
        if (prevId === id) return prevId;
        soundEngine.playUiCue(300);
        triggerEmberSurge();
        return id;
      });
    },
    [triggerEmberSurge]
  );

  useEffect(() => {
    const WHEEL_THRESHOLD = 280;
    const TOUCH_THRESHOLD = 110;
    const MAX_EXTRA_SCALE = 0.11;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let wheelAccum = 0;
    let lastWheelAt = 0;
    let wheelResetTimer: number | null = null;
    let targetProgress = 0;
    let currentProgress = 0;
    let pendingSwitchToThor = false;
    let rafId = 0;
    let lastTime = performance.now();

    const getZoomEl = () =>
      containerRef.current?.querySelector<HTMLElement>('[data-doom-zoom="true"]') ?? null;

    const applyProgress = (progress: number) => {
      const zoomEl = getZoomEl();
      if (!zoomEl) return;
      const scale = 1 + progress * MAX_EXTRA_SCALE;
      zoomEl.style.transform = `translate3d(0, 0, 0) scale(${scale.toFixed(5)})`;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const speed = pendingSwitchToThor ? 9 : 6.5;
      const ease = 1 - Math.exp(-speed * dt);
      currentProgress += (targetProgress - currentProgress) * ease;

      if (Math.abs(targetProgress - currentProgress) < 0.0015) {
        currentProgress = targetProgress;
      }

      applyProgress(currentProgress);

      if (pendingSwitchToThor && currentProgress >= 0.99) {
        pendingSwitchToThor = false;
        wheelAccum = 0;
        targetProgress = 0;
        currentProgress = 0;
        rafId = 0;
        // Keep DOM transform at 1.11 so Doom stays zoomed while fading out into Thor
        applyProgress(1);
        stepDossier(1, 1200);
        return;
      }

      if (Math.abs(targetProgress - currentProgress) < 0.001) {
        rafId = 0;
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const setScrollProgress = (progress: number) => {
      const clamped = Math.min(1, Math.max(0, progress));
      if (prefersReducedMotion) {
        currentProgress = clamped;
        targetProgress = clamped;
        applyProgress(clamped);
        return;
      }
      targetProgress = clamped;
      if (!rafId) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const scheduleWheelReset = () => {
      if (wheelResetTimer !== null) {
        window.clearTimeout(wheelResetTimer);
      }
      wheelResetTimer = window.setTimeout(() => {
        if (!pendingSwitchToThor) {
          wheelAccum = 0;
          setScrollProgress(0);
        }
        wheelResetTimer = null;
      }, 550);
    };

    const triggerThorTransition = () => {
      if (wheelResetTimer !== null) {
        window.clearTimeout(wheelResetTimer);
        wheelResetTimer = null;
      }
      if (prefersReducedMotion || currentProgress >= 0.99) {
        wheelAccum = 0;
        targetProgress = 0;
        currentProgress = 0;
        applyProgress(1);
        stepDossier(1, 1200);
        return;
      }
      pendingSwitchToThor = true;
      setScrollProgress(1);
    };

    const handleWheel = (e: WheelEvent) => {
      if (trailerOpen || e.ctrlKey || pendingSwitchToThor) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      const dx = e.deltaMode === 1 ? e.deltaX * 32 : e.deltaX;
      if (Math.abs(dy) < Math.abs(dx)) return;

      const now = performance.now();
      if (now - lastWheelAt > 550) {
        wheelAccum = 0;
      }
      lastWheelAt = now;

      if (now - lastScrollSwitchRef.current < 1200) {
        wheelAccum = 0;
        return;
      }

      wheelAccum += dy;

      if (activeCharacterIdRef.current === 'doctor-doom' && wheelAccum > 0) {
        if (wheelAccum >= WHEEL_THRESHOLD) {
          triggerThorTransition();
          return;
        }
        setScrollProgress(wheelAccum / WHEEL_THRESHOLD);
        scheduleWheelReset();
      } else {
        if (activeCharacterIdRef.current === 'doctor-doom') {
          setScrollProgress(0);
        }
        if (Math.abs(wheelAccum) >= WHEEL_THRESHOLD) {
          const dir: 1 | -1 = wheelAccum > 0 ? 1 : -1;
          wheelAccum = 0;
          stepDossier(dir, 1200);
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (trailerOpen || pendingSwitchToThor || e.touches.length !== 1) {
        touchStartRef.current = null;
        if (!pendingSwitchToThor && activeCharacterIdRef.current === 'doctor-doom') {
          setScrollProgress(0);
        }
        return;
      }
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (trailerOpen || pendingSwitchToThor || !touchStartRef.current || e.touches.length !== 1) return;
      if (performance.now() - lastScrollSwitchRef.current < 1100) return;

      const deltaX = touchStartRef.current.x - e.touches[0].clientX;
      const deltaY = touchStartRef.current.y - e.touches[0].clientY;
      if (activeCharacterIdRef.current === 'doctor-doom' && deltaY > 0 && Math.abs(deltaY) >= Math.abs(deltaX)) {
        setScrollProgress(deltaY / TOUCH_THRESHOLD);
      } else if (activeCharacterIdRef.current === 'doctor-doom') {
        setScrollProgress(0);
      }
    };

    const handleTouchCancel = () => {
      touchStartRef.current = null;
      if (!pendingSwitchToThor && activeCharacterIdRef.current === 'doctor-doom') {
        setScrollProgress(0);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (trailerOpen || pendingSwitchToThor || !touchStartRef.current || e.changedTouches.length === 0) {
        touchStartRef.current = null;
        if (!pendingSwitchToThor && activeCharacterIdRef.current === 'doctor-doom') {
          setScrollProgress(0);
        }
        return;
      }
      const deltaX = touchStartRef.current.x - e.changedTouches[0].clientX;
      const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
      touchStartRef.current = null;

      if (Math.abs(deltaY) < TOUCH_THRESHOLD || Math.abs(deltaY) < Math.abs(deltaX)) {
        if (activeCharacterIdRef.current === 'doctor-doom') {
          setScrollProgress(0);
        }
        return;
      }

      if (activeCharacterIdRef.current === 'doctor-doom' && deltaY > 0) {
        triggerThorTransition();
      } else {
        stepDossier(deltaY > 0 ? 1 : -1, 1100);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (trailerOpen || e.metaKey || e.ctrlKey || e.altKey) return;
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
        stepDossier(1, 450);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        stepDossier(-1, 450);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (wheelResetTimer !== null) {
        window.clearTimeout(wheelResetTimer);
      }
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchcancel', handleTouchCancel);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stepDossier, trailerOpen]);

  useEffect(() => {
    if (activeCharacterId !== 'doctor-doom') return;
    const zoomEl = containerRef.current?.querySelector<HTMLElement>('[data-doom-zoom="true"]');
    if (zoomEl) {
      zoomEl.style.transform = 'translate3d(0, 0, 0) scale(1)';
    }
  }, [activeCharacterId]);

  useEffect(() => {
    return () => {
      if (surgeTimeoutRef.current) {
        window.clearTimeout(surgeTimeoutRef.current);
      }
      soundEngine.stop();
    };
  }, []);

  const handleToggleSound = () => {
    const enabled = soundEngine.toggle();
    setSoundEnabled(enabled);
    if (enabled) {
      triggerEmberSurge();
    }
  };

  const handleOpenTrailer = useCallback(() => {
    if (soundEnabled) {
      soundEngine.stop();
      setSoundEnabled(false);
    }
    setTrailerOpen(true);
  }, [soundEnabled]);

  return (
    <div
      ref={containerRef}
      className="relative h-dvh touch-none overflow-hidden overscroll-none bg-[#020503]"
    >
      {!preloaderDone && <CinematicPreloader onComplete={() => setPreloaderDone(true)} />}

      <ErrorBoundary silent>
        <BackgroundStage
          characters={CHARACTERS}
          activeCharacterId={activeCharacter.id}
          activeCharacterOverride={activeCharacter}
          paused={trailerOpen}
        />
      </ErrorBoundary>

      <ErrorBoundary silent>
        <DoomsdayWebGLScene
          accentHex={activeCharacter.accentHex}
          mode={atmosphereMode}
          paused={trailerOpen}
        />
      </ErrorBoundary>

      <ErrorBoundary silent>
        <AtmosphericCanvas
          mode={atmosphereMode}
          activeCharacter={activeCharacter}
          paused={trailerOpen}
        />
      </ErrorBoundary>

      <ErrorBoundary silent>
        <CinematicOverlay />
      </ErrorBoundary>

      <Navbar
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onResetHome={() => selectCharacter(CHARACTERS[0].id)}
      />

      <main className="relative z-20 h-dvh overflow-hidden" data-active-backdrop={activeCharacter.id}>
        <HeroSection
          activeCharacter={activeCharacter}
          characters={CHARACTERS}
          onSurgeAtmosphere={triggerEmberSurge}
          onOpenTrailer={handleOpenTrailer}
          onStepDossier={(dir) => stepDossier(dir, 450)}
        />
      </main>

      <TrailerModal open={trailerOpen} onClose={() => setTrailerOpen(false)} />

      <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 select-none text-center md:inset-x-auto md:right-[clamp(1rem,3vw,2rem)] md:bottom-[max(0.875rem,env(safe-area-inset-bottom))] md:text-right">
        <p className="inline-flex items-center gap-1.5 text-[clamp(0.5625rem,1.2vw,0.625rem)] font-medium tracking-[0.2em] text-white/65 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          <span>Made with</span>
          <Heart className="h-3 w-3 fill-white text-white" aria-label="white heart" />
          <span>by Himanshu Sahani</span>
        </p>
      </div>
    </div>
  );
}
