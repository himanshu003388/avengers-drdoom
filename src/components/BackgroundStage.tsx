import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CharacterProfile } from '../data/characters';
import { computeParallax3D } from '../utils/atmosphere';
import { ThorLightning } from './ThorLightning';

interface BackgroundStageProps {
  characters: CharacterProfile[];
  activeCharacterId: string;
  activeCharacterOverride?: CharacterProfile;
  transitionDirection?: 1 | -1;
  paused?: boolean;
}

interface BackgroundTheme {
  baseHex: string;
  midHex: string;
  vignetteRgb: string;
}

const CHARACTER_BACKGROUNDS: Record<string, BackgroundTheme> = {
  'doctor-doom': {
    baseHex: '#020503',
    midHex: '#05160b',
    vignetteRgb: '2, 5, 3',
  },
  'scarlet-nexus': {
    baseHex: '#060501',
    midHex: '#1f1703',
    vignetteRgb: '6, 5, 1',
  },
  'captain-america': {
    baseHex: '#030601',
    midHex: '#101d04',
    vignetteRgb: '3, 6, 1',
  },
  'mister-fantastic': {
    baseHex: '#02050a',
    midHex: '#05192e',
    vignetteRgb: '2, 5, 10',
  },
};

function getBackgroundTheme(character: CharacterProfile): BackgroundTheme {
  return (
    CHARACTER_BACKGROUNDS[character.id] ?? {
      baseHex: '#020503',
      midHex: '#05160b',
      vignetteRgb: '2, 5, 3',
    }
  );
}

const SINGLE_RADIAL_MASK: CSSProperties = {
  maskImage:
    'radial-gradient(ellipse 60% 58% at 50% 45%, black 46%, rgba(0, 0, 0, 0.72) 74%, transparent 97%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 60% 58% at 50% 45%, black 46%, rgba(0, 0, 0, 0.72) 74%, transparent 97%)',
};

const THOR_VERTICAL_MASK: CSSProperties = {
  maskImage:
    'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.45) 3%, black 7%, black 68%, rgba(0, 0, 0, 0.65) 85%, transparent 99%)',
  WebkitMaskImage:
    'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.45) 3%, black 7%, black 68%, rgba(0, 0, 0, 0.65) 85%, transparent 99%)',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskSize: '100% 100%',
  WebkitMaskSize: '100% 100%',
};

const GEOMETRY_MASK: CSSProperties = {
  maskImage:
    'radial-gradient(ellipse 58% 58% at 50% 50%, black 42%, rgba(0, 0, 0, 0.72) 68%, transparent 96%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 58% 58% at 50% 50%, black 42%, rgba(0, 0, 0, 0.72) 68%, transparent 96%)',
};

const THOR_SIDE_FADE_MASK: CSSProperties = {
  maskImage:
    'linear-gradient(to right, transparent 0%, transparent 7%, rgba(0, 0, 0, 0.08) 10%, rgba(0, 0, 0, 0.25) 14%, rgba(0, 0, 0, 0.52) 18%, rgba(0, 0, 0, 0.8) 22.5%, black 27%, black 73%, rgba(0, 0, 0, 0.8) 77.5%, rgba(0, 0, 0, 0.52) 82%, rgba(0, 0, 0, 0.25) 86%, rgba(0, 0, 0, 0.08) 90%, transparent 93%, transparent 100%)',
  WebkitMaskImage:
    'linear-gradient(to right, transparent 0%, transparent 7%, rgba(0, 0, 0, 0.08) 10%, rgba(0, 0, 0, 0.25) 14%, rgba(0, 0, 0, 0.52) 18%, rgba(0, 0, 0, 0.8) 22.5%, black 27%, black 73%, rgba(0, 0, 0, 0.8) 77.5%, rgba(0, 0, 0, 0.52) 82%, rgba(0, 0, 0, 0.25) 86%, rgba(0, 0, 0, 0.08) 90%, transparent 93%, transparent 100%)',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskSize: '100% 100%',
  WebkitMaskSize: '100% 100%',
};

const CAPTAIN_SIDE_FADE_MASK: CSSProperties = {
  maskImage:
    'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.18) 5%, rgba(0, 0, 0, 0.6) 11%, black 18%, black 82%, rgba(0, 0, 0, 0.6) 89%, rgba(0, 0, 0, 0.18) 95%, transparent 100%)',
  WebkitMaskImage:
    'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.18) 5%, rgba(0, 0, 0, 0.6) 11%, black 18%, black 82%, rgba(0, 0, 0, 0.6) 89%, rgba(0, 0, 0, 0.18) 95%, transparent 100%)',
};

const MISTER_FANTASTIC_BOTTOM_MASK: CSSProperties = {
  maskImage:
    'linear-gradient(to bottom, black 0%, black 54%, rgba(0, 0, 0, 0.65) 68%, transparent 83%)',
  WebkitMaskImage:
    'linear-gradient(to bottom, black 0%, black 54%, rgba(0, 0, 0, 0.65) 68%, transparent 83%)',
};

const MISTER_FANTASTIC_OUTER_MASK: CSSProperties = {
  maskImage:
    'linear-gradient(to bottom, transparent 0%, black 4%, black 70%, rgba(0, 0, 0, 0.55) 86%, transparent 99%)',
  WebkitMaskImage:
    'linear-gradient(to bottom, transparent 0%, black 4%, black 70%, rgba(0, 0, 0, 0.55) 86%, transparent 99%)',
};

const CHARACTER_IMAGE_DIMENSIONS: Record<
  string,
  {
    width: number;
    height: number;
    exactBounds?: boolean;
    imgMask?: CSSProperties;
    outerMask?: CSSProperties;
  }
> = {
  'doctor-doom': { width: 1600, height: 900 },
  'scarlet-nexus': {
    width: 1024,
    height: 576,
    exactBounds: true,
    imgMask: THOR_SIDE_FADE_MASK,
    outerMask: THOR_VERTICAL_MASK,
  },
  'captain-america': {
    width: 695,
    height: 493,
    exactBounds: true,
    imgMask: CAPTAIN_SIDE_FADE_MASK,
  },
  'mister-fantastic': {
    width: 618,
    height: 1024,
    exactBounds: true,
    imgMask: MISTER_FANTASTIC_BOTTOM_MASK,
    outerMask: MISTER_FANTASTIC_OUTER_MASK,
  },
};

export const BackgroundStage = memo(function BackgroundStage({
  characters,
  activeCharacterId,
  activeCharacterOverride,
  transitionDirection = 1,
  paused = false,
}: BackgroundStageProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isLowSpecViewport, setIsLowSpecViewport] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches
      : false
  );
  const deepPlaneRef = useRef<HTMLDivElement | null>(null);
  const subjectPlaneRef = useRef<HTMLDivElement | null>(null);
  const sheenPlaneRef = useRef<HTMLDivElement | null>(null);
  const preloadedIdsRef = useRef<Set<string>>(new Set());
  const preloadedImgsRef = useRef<HTMLImageElement[]>([]);
  const pausedRef = useRef<boolean>(paused);
  const resumeParallaxRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) {
      resumeParallaxRef.current?.();
    }
  }, [paused]);

  const stageCharacters =
    activeCharacterOverride &&
      !characters.some((c) => c.id === activeCharacterOverride.id)
      ? [...characters, activeCharacterOverride]
      : characters;

  const activeCharacter =
    activeCharacterOverride ??
    stageCharacters.find((c) => c.id === activeCharacterId) ??
    stageCharacters[0];

  const [trackedId, setTrackedId] = useState(activeCharacter.id);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [hasSwitched, setHasSwitched] = useState(false);

  if (activeCharacter.id !== trackedId) {
    setExitingId(trackedId);
    setTrackedId(activeCharacter.id);
    setHasSwitched(true);
  }

  useEffect(() => {
    if (!exitingId) return;
    const timer = window.setTimeout(() => {
      setExitingId(null);
    }, 760);
    return () => window.clearTimeout(timer);
  }, [exitingId, trackedId]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const sync = () => setIsLowSpecViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Pre-decode adjacent & remaining characters once in idle time for zero-hitch forward & backward switching
  useEffect(() => {
    const len = stageCharacters.length;
    const idx = stageCharacters.findIndex((c) => c.id === activeCharacter.id);
    if (idx === -1 || len < 2) return;

    preloadedIdsRef.current.add(activeCharacter.id);

    const candidateIndices = [
      (idx + 1) % len,
      (idx - 1 + len) % len,
      ...Array.from({ length: len }, (_, i) => i),
    ];
    const toPreload: CharacterProfile[] = [];
    const queued = new Set<string>();

    for (const i of candidateIndices) {
      const char = stageCharacters[i];
      if (!char?.imageUrl || preloadedIdsRef.current.has(char.id) || queued.has(char.id)) continue;
      queued.add(char.id);
      toPreload.push(char);
    }

    if (toPreload.length === 0) return;

    let cancelled = false;
    const preload = () => {
      if (cancelled) return;
      for (const char of toPreload) {
        preloadedIdsRef.current.add(char.id);
        const img = new Image();
        img.decoding = 'async';
        if (char.imageSrcSet) img.srcset = char.imageSrcSet;
        if (char.imageSrcSet && char.imageSizes) img.sizes = char.imageSizes;
        img.src = char.imageUrl;
        preloadedImgsRef.current.push(img);
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {});
        }
      }
    };

    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void })
      .cancelIdleCallback;

    if (typeof ric === 'function') {
      const id = ric(preload, { timeout: 600 });
      return () => {
        cancelled = true;
        cic?.(id);
      };
    }

    const timer = window.setTimeout(preload, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeCharacter.id, stageCharacters]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia('(pointer: fine) and (hover: hover)').matches;
    if (prefersReducedMotion || !isFinePointer) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (document.hidden || pausedRef.current) {
        rafId = 0;
        return;
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const ease = 1 - Math.exp(-6.5 * dt);

      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;

      const p = computeParallax3D(currentX, currentY);

      if (deepPlaneRef.current) {
        deepPlaneRef.current.style.transform = `translate3d(${p.backdropTranslateX}px, ${p.backdropTranslateY}px, -40px) scale(1.12)`;
      }

      if (subjectPlaneRef.current) {
        subjectPlaneRef.current.style.transform = `perspective(1050px) rotateX(${p.rotateX}deg) rotateY(${p.rotateY}deg) translate3d(${p.subjectTranslateX}px, ${p.subjectTranslateY}px, 32px) scale(1.04)`;
      }

      if (sheenPlaneRef.current) {
        const shiftX = (p.sheenXPercent - 50) * 0.45;
        const shiftY = (p.sheenYPercent - 42) * 0.45;
        sheenPlaneRef.current.style.transform = `translate3d(${shiftX}%, ${shiftY}%, 0)`;
      }

      const settled =
        Math.abs(targetX - currentX) < 0.002 && Math.abs(targetY - currentY) < 0.002;
      if (settled) {
        rafId = 0;
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const scheduleTick = () => {
      if (!rafId && !document.hidden && !pausedRef.current) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };
    resumeParallaxRef.current = () => {
      if (Math.abs(targetX - currentX) >= 0.002 || Math.abs(targetY - currentY) >= 0.002) {
        scheduleTick();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || pausedRef.current) return;
      const w = window.innerWidth || 1440;
      const h = window.innerHeight || 900;
      targetX = (e.clientX / w - 0.5) * 2;
      targetY = (e.clientY / h - 0.5) * 2;
      scheduleTick();
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
      scheduleTick();
    };

    const onVisibilityChange = () => {
      if (
        !document.hidden &&
        !pausedRef.current &&
        (Math.abs(targetX - currentX) >= 0.002 || Math.abs(targetY - currentY) >= 0.002)
      ) {
        scheduleTick();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointercancel', handlePointerLeave, { passive: true });
    document.documentElement.addEventListener('mouseleave', handlePointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onVisibilityChange);

    return () => {
      resumeParallaxRef.current = null;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointercancel', handlePointerLeave);
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onVisibilityChange);
    };
  }, []);

  const exitingCharacter =
    exitingId && exitingId !== activeCharacter.id
      ? stageCharacters.find((c) => c.id === exitingId) ?? null
      : null;

  const mountedCharacters = exitingCharacter
    ? [exitingCharacter, activeCharacter]
    : [activeCharacter];

  const activeTheme = getBackgroundTheme(activeCharacter);
  const isThorActive = activeCharacter.id === 'scarlet-nexus';
  const isThorExiting = exitingCharacter?.id === 'scarlet-nexus';
  const showThorLightning = isThorActive || isThorExiting;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${paused ? 'doom-stage-paused' : ''
        }`}
      aria-hidden="true"
      data-testid="background-stage"
      data-active-character={activeCharacterId}
      data-depth-mode="3d-detached-parallax"
      style={
        {
          backgroundColor: activeTheme.baseHex,
          '--dossier-dir': transitionDirection,
        } as CSSProperties
      }
    >
      {/* Layer 1: Deep Counter-Parallax Backdrop & Character-Matched Volumetric Glow */}
      <div
        ref={deepPlaneRef}
        className={`absolute inset-0 ${isLowSpecViewport ? '' : 'will-change-transform'}`}
        style={{
          transform: isLowSpecViewport ? undefined : 'translate3d(0px, 0px, -40px) scale(1.12)',
        }}
      >
        {/* Opaque base backdrop: outgoing stays at opacity 1 behind incoming fading 0->1 so there is zero brightness dip */}
        {mountedCharacters.map((character) => {
          const isExiting = exitingCharacter?.id === character.id;
          const theme = getBackgroundTheme(character);
          const animClass = !isExiting && hasSwitched ? 'animate-dossier-fade-in' : '';

          return (
            <div
              key={`base-${character.id}`}
              className={`pointer-events-none absolute inset-0 ${animClass}`}
              style={{
                background: `
                  radial-gradient(ellipse 52% 56% at 50% 42%, ${character.accentHex}3b 0%, ${character.accentHex}1c 44%, transparent 74%),
                  radial-gradient(ellipse 84% 64% at 50% 90%, ${character.accentHex}2e 0%, transparent 72%),
                  linear-gradient(180deg, ${theme.baseHex} 0%, ${theme.midHex} 48%, ${theme.baseHex} 100%)
                `,
              }}
            />
          );
        })}

        {/* Sacred geometry layer tinted to match the active character via mix-blend-color */}
        <div
          className={`pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] aspect-video w-[max(128vw,92dvh)] -translate-x-1/2 -translate-y-1/2 mix-blend-lighten md:w-[max(110vw,200dvh)] ${isLowSpecViewport ? 'opacity-50' : 'opacity-72'
            }`}
          style={GEOMETRY_MASK}
        >
          <div
            className={`relative h-full w-full ${isLowSpecViewport ? '' : 'animate-doom-geometry-drift will-change-transform'
              }`}
            style={{ isolation: 'isolate' }}
          >
            <img
              src="/assets/aistudio/emerald-sacred-geometry-bg.webp"
              srcSet="/assets/aistudio/emerald-sacred-geometry-bg-960.webp 960w, /assets/aistudio/emerald-sacred-geometry-bg.webp 1376w"
              sizes="100vw"
              alt=""
              width={1376}
              height={768}
              decoding="async"
              fetchPriority="low"
              className="pointer-events-none h-full w-full object-cover object-center"
            />

            {/* Recolors the geometry luminance to the exact character accentHex on both mobile & desktop */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ mixBlendMode: 'color' }}
            >
              {mountedCharacters.map((character) => {
                const isExiting = exitingCharacter?.id === character.id;
                const animClass = !isExiting && hasSwitched ? 'animate-dossier-fade-in' : '';
                return (
                  <div
                    key={`geo-tint-${character.id}`}
                    className={`pointer-events-none absolute inset-0 ${animClass}`}
                    style={{ backgroundColor: character.accentHex }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Character-matched vignette & foreground ambient aura/rings */}
        {mountedCharacters.map((character) => {
          const isExiting = exitingCharacter?.id === character.id;
          const theme = getBackgroundTheme(character);
          const animClass = isExiting
            ? 'animate-dossier-fade-out'
            : hasSwitched
              ? 'animate-dossier-fade-in'
              : '';

          return (
            <div
              key={`ambient-${character.id}`}
              className={`pointer-events-none absolute inset-0 ${animClass}`}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse 75% 65% at 50% var(--stage-center-y), rgba(${theme.vignetteRgb}, 0.08) 0%, rgba(${theme.vignetteRgb}, 0.56) 72%, rgba(${theme.vignetteRgb}, 0.92) 100%)`,
                }}
              />

              {/* Breathing glowing core aura behind subject silhouette */}
              <div
                className={`pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(15rem,64vmin,42rem)] w-[clamp(15rem,64vmin,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-full ${isLowSpecViewport ? '' : 'animate-doom-bg-breathe'
                  }`}
                style={{
                  background: `radial-gradient(circle, ${character.accentHex}42 0%, ${character.accentHex}1e 38%, transparent 72%)`,
                }}
              />

              {/* Rotating volumetric light rays behind subject (desktop only to save mobile GPU fillrate) */}
              {!isLowSpecViewport && (
                <div
                  className="animate-doom-rays-spin pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(22rem,92vmin,58rem)] w-[clamp(22rem,92vmin,58rem)] rounded-full opacity-35 mix-blend-screen"
                  style={{
                    background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${character.accentHex}2a 18deg, transparent 42deg, transparent 88deg, ${character.accentHex}22 112deg, transparent 142deg, transparent 196deg, ${character.accentHex}28 224deg, transparent 258deg, transparent 304deg, ${character.accentHex}1e 332deg, transparent 360deg)`,
                    maskImage:
                      'radial-gradient(circle, black 12%, rgba(0,0,0,0.6) 42%, transparent 70%)',
                    WebkitMaskImage:
                      'radial-gradient(circle, black 12%, rgba(0,0,0,0.6) 42%, transparent 70%)',
                  }}
                />
              )}

              {/* Expanding energy ring (desktop) */}
              {!isLowSpecViewport && (
                <div
                  className="animate-doom-ring-expand pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(13rem,54vmin,34rem)] w-[clamp(13rem,54vmin,34rem)] rounded-full border"
                  style={{ borderColor: `${character.accentHex}45` }}
                />
              )}

              {/* Concentric architectural halo rings */}
              <div
                className="pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(17rem,74vmin,47rem)] w-[clamp(17rem,74vmin,47rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
                style={{ borderColor: `${character.accentHex}2e` }}
              />
              <div
                className="pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(14.5rem,64vmin,40rem)] w-[clamp(14.5rem,64vmin,40rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{ borderColor: `${character.accentHex}44` }}
              />
              <div
                className="pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(10.5rem,45vmin,28rem)] w-[clamp(10.5rem,45vmin,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{ borderColor: `${character.accentHex}34` }}
              />
              {!isLowSpecViewport && (
                <div
                  className="pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(8.5rem,36vmin,22.5rem)] w-[clamp(8.5rem,36vmin,22.5rem)] -translate-x-1/2 -translate-y-1/2 rotate-45 border"
                  style={{ borderColor: `${character.accentHex}26` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Thor lightning layer: mounted ONLY while Thor is active or fading out so inactive dossiers consume 0 canvas memory */}
      {showThorLightning && (
        <div
          className={`pointer-events-none absolute inset-0 ${isThorActive ? 'animate-dossier-fade-in' : 'animate-dossier-fade-out'
            }`}
        >
          <ThorLightning active={showThorLightning} phase="yellow" paused={paused} />
        </div>
      )}

      {/* Layer 2: Detached 3D Subject Plane (only active + exiting mounted for minimal VRAM) */}
      <div
        ref={subjectPlaneRef}
        className={`absolute inset-0 ${isLowSpecViewport ? '' : 'will-change-transform'}`}
        style={
          isLowSpecViewport
            ? undefined
            : {
              transform:
                'perspective(1050px) rotateX(0deg) rotateY(0deg) translate3d(0px, 0px, 32px) scale(1.04)',
            }
        }
      >
        {mountedCharacters.map((character) => {
          const isExiting = exitingCharacter?.id === character.id;
          const isActive = !isExiting;
          const charHasFailed = Boolean(failedImages[character.id]);
          const imgMeta = CHARACTER_IMAGE_DIMENSIONS[character.id] ?? { width: 1600, height: 900 };
          const useExactBounds = Boolean(imgMeta.exactBounds);
          const animClass = isExiting
            ? 'animate-dossier-char-out'
            : hasSwitched
              ? 'animate-dossier-char-in'
              : '';

          return (
            <div
              key={character.id}
              className={`pointer-events-none absolute inset-0 will-change-[transform,opacity] ${animClass}`}
            >
              {!charHasFailed && character.imageUrl ? (
                <div
                  className="absolute left-1/2 top-[var(--stage-center-y)] h-[min(48dvh,92vw)] w-[min(164vw,86dvh)] -translate-x-1/2 -translate-y-1/2 md:h-[min(66dvh,78vw)] md:w-[min(122vw,120dvh)] lg:h-[min(87dvh,74vw)] lg:w-[min(106vw,156dvh)]"
                  style={imgMeta.outerMask ?? SINGLE_RADIAL_MASK}
                >
                  <div
                    className={`flex h-full w-full items-center justify-center ${
                      isActive ? 'animate-doom-character-float will-change-transform' : ''
                    }`}
                  >
                    <img
                      src={character.imageUrl}
                      srcSet={character.imageSrcSet}
                      sizes={character.imageSrcSet ? character.imageSizes : undefined}
                      alt=""
                      width={imgMeta.width}
                      height={imgMeta.height}
                      loading="eager"
                      decoding="async"
                      fetchPriority={isActive ? 'high' : 'low'}
                      referrerPolicy="no-referrer"
                      style={imgMeta.imgMask}
                      onError={() =>
                        setFailedImages((prev) => ({
                          ...prev,
                          [character.id]: true,
                        }))
                      }
                      className={`${useExactBounds ? 'h-full w-auto max-w-full' : 'h-full w-full'
                        } object-contain object-center ${character.imageScaleClass ?? ''
                        }`}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="relative h-full w-full"
                  style={{
                    background: `radial-gradient(circle at 50% var(--stage-center-y), ${character.accentHex}2a 0%, #07120b 48%, #020503 100%)`,
                  }}
                >
                  <div
                    className="absolute left-1/2 top-[var(--stage-center-y)] flex h-[clamp(10rem,34vmin,22rem)] w-[clamp(10rem,34vmin,22rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border opacity-45"
                    style={{ borderColor: character.accentHex }}
                  >
                    <span
                      className="px-4 text-center font-display text-[clamp(0.6875rem,1.8vw,0.875rem)] font-bold tracking-[0.34em] uppercase"
                      style={{ color: character.accentHex }}
                    >
                      {character.faction}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer 3: Rim-light sheen on desktop only (crossfaded via opacity) */}
      {!isLowSpecViewport && (
        <div
          ref={sheenPlaneRef}
          className="pointer-events-none absolute -inset-1/4 mix-blend-screen will-change-transform"
        >
          {mountedCharacters.map((character) => {
            const isExiting = exitingCharacter?.id === character.id;
            const animClass = isExiting
              ? 'animate-dossier-fade-out'
              : hasSwitched
                ? 'animate-dossier-fade-in'
                : '';
            return (
              <div
                key={`sheen-${character.id}`}
                className={`pointer-events-none absolute inset-0 ${animClass}`}
                style={{
                  background: `radial-gradient(circle 480px at 50% var(--stage-center-y), ${character.accentHex}24 0%, ${character.accentHex}0c 45%, rgba(0, 0, 0, 0) 76%)`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Neutral contrast scrims keeping active subject clear without green bias */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
    </div>
  );
});
