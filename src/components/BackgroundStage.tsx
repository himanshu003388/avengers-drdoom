import { useEffect, useRef, useState } from 'react';
import type { CharacterProfile } from '../data/characters';
import { computeParallax3D } from '../utils/atmosphere';
import { ThorLightning } from './ThorLightning';

interface BackgroundStageProps {
  characters: CharacterProfile[];
  activeCharacterId: string;
  activeCharacterOverride?: CharacterProfile;
  paused?: boolean;
}

export function BackgroundStage({
  characters,
  activeCharacterId,
  activeCharacterOverride,
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

  const activeCharacter =
    activeCharacterOverride ??
    characters.find((c) => c.id === activeCharacterId) ??
    characters[0];

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const sync = () => setIsLowSpecViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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
      if (document.hidden) {
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
      if (!rafId && !document.hidden) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
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
      if (!document.hidden && (Math.abs(targetX - currentX) >= 0.002 || Math.abs(targetY - currentY) >= 0.002)) {
        scheduleTick();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointercancel', handlePointerLeave, { passive: true });
    document.documentElement.addEventListener('mouseleave', handlePointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onVisibilityChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointercancel', handlePointerLeave);
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onVisibilityChange);
    };
  }, []);

  const stageCharacters =
    activeCharacterOverride &&
    !characters.some((c) => c.id === activeCharacterOverride.id)
      ? [...characters, activeCharacterOverride]
      : characters;
  const isThor = activeCharacter.id === 'scarlet-nexus';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#020503]"
      aria-hidden="true"
      data-testid="background-stage"
      data-active-character={activeCharacterId}
      data-depth-mode="3d-detached-parallax"
    >
      {/* Layer 1: Deep Counter-Parallax Latverian Backlight & Soft Volumetric Glow */}
      <div
        ref={deepPlaneRef}
        className="absolute inset-0 will-change-transform"
        style={{
          transform: 'translate3d(0px, 0px, -40px) scale(1.12)',
          background: `
            radial-gradient(ellipse 48% 54% at 52% 40%, ${activeCharacter.accentHex}38 0%, rgba(16, 84, 44, 0.28) 42%, rgba(2, 5, 3, 0) 74%),
            radial-gradient(ellipse 88% 68% at 50% 92%, rgba(22, 118, 60, 0.26) 0%, rgba(2, 5, 3, 0) 72%),
            linear-gradient(180deg, #020503 0%, #041209 48%, #020503 100%)
          `,
        }}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] aspect-video w-[max(128vw,92dvh)] -translate-x-1/2 -translate-y-1/2 md:w-[max(110vw,200dvh)]"
          style={{
            maskImage:
              'radial-gradient(ellipse 58% 58% at 50% 50%, black 42%, rgba(0, 0, 0, 0.72) 68%, transparent 96%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 58% 58% at 50% 50%, black 42%, rgba(0, 0, 0, 0.72) 68%, transparent 96%)',
          }}
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
            className="pointer-events-none h-full w-full object-cover object-center opacity-75 mix-blend-lighten"
          />
        </div>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 75% 65% at 50% var(--stage-center-y), rgba(2, 5, 3, 0.14) 0%, rgba(2, 5, 3, 0.58) 72%, rgba(2, 5, 3, 0.92) 100%)',
          }}
        />

        {/* Soft volumetric emerald plumes (gradient-feathered without expensive CSS blur) */}
        <div
          className="animate-doom-fume-drift pointer-events-none absolute inset-0 will-change-transform"
          style={{
            background: `
              radial-gradient(ellipse 52% 44% at 32% 74%, rgba(22, 132, 66, 0.28) 0%, rgba(10, 56, 28, 0.1) 48%, transparent 74%),
              radial-gradient(ellipse 56% 46% at 68% 72%, rgba(34, 170, 88, 0.24) 0%, rgba(10, 56, 28, 0.1) 48%, transparent 74%),
              radial-gradient(ellipse 64% 38% at 50% 88%, rgba(28, 152, 76, 0.3) 0%, rgba(6, 36, 18, 0.12) 54%, transparent 80%)
            `,
          }}
        />

        {/* Breathing glowing core aura behind subject silhouette */}
        <div
          className="animate-doom-bg-breathe pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(15rem,64vmin,42rem)] w-[clamp(15rem,64vmin,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-full will-change-transform transition-colors duration-500"
          style={{
            background: `radial-gradient(circle, ${activeCharacter.accentHex}44 0%, ${activeCharacter.accentHex}20 36%, ${activeCharacter.accentHex}0a 58%, transparent 74%)`,
          }}
        />

        {/* Rotating volumetric light rays behind subject (desktop fine-pointer only) */}
        {!isLowSpecViewport && (
          <div
            className="animate-doom-rays-spin pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(22rem,92vmin,58rem)] w-[clamp(22rem,92vmin,58rem)] rounded-full opacity-40 mix-blend-screen will-change-transform"
            style={{
              background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${activeCharacter.accentHex}2a 18deg, transparent 42deg, transparent 88deg, ${activeCharacter.accentHex}22 112deg, transparent 142deg, transparent 196deg, ${activeCharacter.accentHex}28 224deg, transparent 258deg, transparent 304deg, ${activeCharacter.accentHex}1e 332deg, transparent 360deg)`,
              maskImage: 'radial-gradient(circle, black 12%, rgba(0,0,0,0.6) 42%, transparent 70%)',
              WebkitMaskImage:
                'radial-gradient(circle, black 12%, rgba(0,0,0,0.6) 42%, transparent 70%)',
            }}
          />
        )}

        {/* Expanding energy rings behind subject */}
        <div
          className="animate-doom-ring-expand pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(13rem,54vmin,34rem)] w-[clamp(13rem,54vmin,34rem)] rounded-full border will-change-transform transition-colors duration-500"
          style={{
            borderColor: `${activeCharacter.accentHex}4d`,
          }}
        />

        {/* Concentric architectural halo rings */}
        <div
          className="pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(17rem,74vmin,47rem)] w-[clamp(17rem,74vmin,47rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed transition-colors duration-500"
          style={{ borderColor: `${activeCharacter.accentHex}30` }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(14.5rem,64vmin,40rem)] w-[clamp(14.5rem,64vmin,40rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors duration-500"
          style={{
            borderColor: `${activeCharacter.accentHex}47`,
            boxShadow: `0 0 64px ${activeCharacter.accentHex}2e, inset 0 0 54px ${activeCharacter.accentHex}24`,
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(10.5rem,45vmin,28rem)] w-[clamp(10.5rem,45vmin,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors duration-500"
          style={{ borderColor: `${activeCharacter.accentHex}38` }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[var(--stage-center-y)] h-[clamp(8.5rem,36vmin,22.5rem)] w-[clamp(8.5rem,36vmin,22.5rem)] -translate-x-1/2 -translate-y-1/2 rotate-45 border transition-colors duration-500"
          style={{ borderColor: `${activeCharacter.accentHex}2b` }}
        />

        {/* Soft flanking energy orbs (feathered gradients without CSS blur filter) */}
        <div
          className="animate-doom-glow pointer-events-none absolute left-[18%] top-[52%] h-[clamp(9rem,26vmin,16rem)] w-[clamp(9rem,26vmin,16rem)] rounded-full transition-colors duration-500 sm:left-[24%]"
          style={{
            background: `radial-gradient(circle, ${activeCharacter.accentHex}33 0%, transparent 70%)`,
          }}
        />
        <div
          className="animate-doom-glow pointer-events-none absolute right-[18%] top-[50%] h-[clamp(9.5rem,28vmin,17rem)] w-[clamp(9.5rem,28vmin,17rem)] rounded-full transition-colors duration-500 sm:right-[24%]"
          style={{
            animationDelay: '-2s',
            background: `radial-gradient(circle, ${activeCharacter.accentHex}2b 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* Optional Thor lightning layer (crossfades smoothly when Thor dossier is selected) */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-[900ms] ease-in-out ${
          isThor ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <ThorLightning active={isThor} phase="blue" paused={paused} />
      </div>

      {/* Layer 2: Detached 3D Subject Plane (all dossiers pre-mounted for instant crossfade) */}
      <div
        ref={subjectPlaneRef}
        className="absolute inset-0 will-change-transform"
        style={{
          transform:
            'perspective(1050px) rotateX(0deg) rotateY(0deg) translate3d(0px, 0px, 32px) scale(1.04)',
          transformStyle: 'preserve-3d',
        }}
      >
        {stageCharacters.map((character) => {
          const isActive = character.id === activeCharacter.id;
          const charHasFailed = Boolean(failedImages[character.id]);
          const charIsCutout = Boolean(character.isCutout);

          return (
            <div
              key={character.id}
              className={`absolute inset-0 transition-opacity duration-[900ms] ease-in-out will-change-[opacity] ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {!charHasFailed && character.imageUrl ? (
                <div
                  className="absolute left-1/2 top-[var(--stage-center-y)] h-[min(48dvh,92vw)] w-[min(164vw,86dvh)] -translate-x-1/2 -translate-y-1/2 md:h-[min(66dvh,78vw)] md:w-[min(122vw,120dvh)] lg:h-[min(87dvh,74vw)] lg:w-[min(106vw,156dvh)]"
                  style={
                    charIsCutout
                      ? {
                          maskImage: 'linear-gradient(to bottom, black 62%, transparent 97%)',
                          WebkitMaskImage:
                            'linear-gradient(to bottom, black 62%, transparent 97%)',
                        }
                      : {
                          maskImage:
                            'radial-gradient(ellipse 68% 68% at 50% 48%, black 52%, transparent 96%)',
                          WebkitMaskImage:
                            'radial-gradient(ellipse 68% 68% at 50% 48%, black 52%, transparent 96%)',
                        }
                  }
                >
                  <div
                    data-doom-zoom={character.id === 'doctor-doom' ? 'true' : undefined}
                    className={`h-full w-full will-change-transform motion-reduce:transition-none ${
                      character.id === 'doctor-doom' && isActive
                        ? ''
                        : 'transition-transform duration-[900ms] ease-out'
                    }`}
                    style={
                      character.id === 'doctor-doom' && isThor
                        ? { transform: 'translate3d(0, 0, 0) scale(1.11)' }
                        : undefined
                    }
                  >
                    <img
                      src={character.imageUrl}
                      srcSet={character.imageSrcSet}
                      sizes={character.imageSizes}
                      alt=""
                      width={1600}
                      height={900}
                      loading="eager"
                      decoding="async"
                      fetchPriority={isActive ? 'high' : 'low'}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({
                          ...prev,
                          [character.id]: true,
                        }))
                      }
                      style={
                        charIsCutout ? { filter: 'contrast(1.05) brightness(1.03)' } : undefined
                      }
                      className={`h-full w-full object-contain object-center ${
                        character.imageScaleClass ?? ''
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
                    style={{
                      borderColor: character.accentHex,
                      boxShadow: `0 0 70px ${character.accentHex}33, inset 0 0 48px ${character.accentHex}22`,
                    }}
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

      {/* Layer 3: Static Pre-Painted Rim-Light Sheen (translated on GPU only) */}
      <div
        ref={sheenPlaneRef}
        className="pointer-events-none absolute -inset-1/4 mix-blend-screen will-change-transform"
        style={{
          background: `radial-gradient(circle 480px at 50% var(--stage-center-y), ${activeCharacter.accentHex}22 0%, ${activeCharacter.accentHex}0a 45%, rgba(2, 5, 3, 0) 76%)`,
        }}
      />

      {/* Contrast scrims keeping Doctor Doom clear */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020503]/20 via-transparent to-[#020503]/85" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#020503]/35 via-transparent to-[#020503]/35" />
    </div>
  );
}
