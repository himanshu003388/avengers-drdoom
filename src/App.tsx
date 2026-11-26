/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Heart } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AtmosphericCanvas } from './components/AtmosphericCanvas';
import { BackgroundStage } from './components/BackgroundStage';
import { CinematicOverlay } from './components/CinematicOverlay';
import { CinematicPreloader } from './components/CinematicPreloader';
import { HeroSection } from './components/HeroSection';
import { Navbar } from './components/Navbar';
import { TrailerModal } from './components/TrailerModal';
import { CHARACTERS, type CharacterProfile } from './data/characters';
import type { AtmosphereMode } from './utils/atmosphere';
import { soundEngine } from './utils/sound';

const DoomsdayWebGLScene = lazy(() =>
  import('./components/DoomsdayWebGLScene').then((m) => ({ default: m.DoomsdayWebGLScene }))
);

export default function App() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [atmosphereMode, setAtmosphereMode] = useState<AtmosphereMode>('smoke-and-embers');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState<string>(CHARACTERS[0].id);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const surgeTimeoutRef = useRef<number | null>(null);
  const lastScrollSwitchRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);

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
    (direction: 1 | -1) => {
      const now = performance.now();
      if (now - lastScrollSwitchRef.current < 480) return;
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

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (trailerOpen) return;
      if (Math.abs(e.deltaY) < 18) return;
      stepDossier(e.deltaY > 0 ? 1 : -1);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (trailerOpen || e.touches.length === 0) return;
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (trailerOpen || touchStartYRef.current === null || e.changedTouches.length === 0) return;
      const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;
      touchStartYRef.current = null;
      if (Math.abs(deltaY) < 36) return;
      stepDossier(deltaY > 0 ? 1 : -1);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (trailerOpen) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        stepDossier(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        stepDossier(-1);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stepDossier, trailerOpen]);

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
    <div className="relative h-dvh overflow-hidden bg-[#020503]">
      {!preloaderDone && <CinematicPreloader onComplete={() => setPreloaderDone(true)} />}

      <BackgroundStage
        characters={CHARACTERS}
        activeCharacterId={activeCharacter.id}
        activeCharacterOverride={activeCharacter}
      />

      <Suspense fallback={null}>
        <DoomsdayWebGLScene accentHex={activeCharacter.accentHex} mode={atmosphereMode} />
      </Suspense>

      <AtmosphericCanvas mode={atmosphereMode} activeCharacter={activeCharacter} />
      <CinematicOverlay />

      <Navbar soundEnabled={soundEnabled} onToggleSound={handleToggleSound} />

      <main className="relative z-20 h-dvh" data-active-backdrop={activeCharacter.id}>
        <HeroSection
          activeCharacter={activeCharacter}
          characters={CHARACTERS}
          onSurgeAtmosphere={triggerEmberSurge}
          onOpenTrailer={handleOpenTrailer}
        />
      </main>

      <TrailerModal open={trailerOpen} onClose={() => setTrailerOpen(false)} />

      <div className="pointer-events-none fixed right-[clamp(1rem,3vw,2rem)] bottom-[max(0.875rem,env(safe-area-inset-bottom))] z-30 select-none">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-[0.2em] text-white/65 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          <span>Made with</span>
          <Heart className="h-3 w-3 fill-white text-white" aria-label="white heart" />
          <span>by Himanshu Sahani</span>
        </p>
      </div>
    </div>
  );
}
