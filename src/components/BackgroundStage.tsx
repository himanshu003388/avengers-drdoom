import { useEffect, useRef, useState } from 'react';
import type { CharacterProfile } from '../data/characters';
import { computeParallax3D } from '../utils/atmosphere';

interface BackgroundStageProps {
  characters: CharacterProfile[];
  activeCharacterId: string;
  activeCharacterOverride?: CharacterProfile;
}

export function BackgroundStage({
  characters,
  activeCharacterId,
  activeCharacterOverride,
}: BackgroundStageProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const deepPlaneRef = useRef<HTMLDivElement | null>(null);
  const subjectPlaneRef = useRef<HTMLDivElement | null>(null);
  const sheenPlaneRef = useRef<HTMLDivElement | null>(null);

  const activeCharacter =
    activeCharacterOverride ??
    characters.find((c) => c.id === activeCharacterId) ??
    characters[0];

  const accentRef = useRef(activeCharacter.accentHex);
  useEffect(() => {
    accentRef.current = activeCharacter.accentHex;
  }, [activeCharacter.accentHex]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let hasPointer = false;
    let rafId = 0;

    const handlePointerMove = (e: PointerEvent) => {
      hasPointer = true;
      const w = window.innerWidth || 1440;
      const h = window.innerHeight || 900;
      targetX = (e.clientX / w - 0.5) * 2;
      targetY = (e.clientY / h - 0.5) * 2;
    };

    const handlePointerLeave = () => {
      hasPointer = false;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);

    const animate = (timeMs: number) => {
      if (!hasPointer) {
        targetX = Math.sin(timeMs * 0.00055) * 0.42;
        targetY = Math.cos(timeMs * 0.00042) * 0.28;
      }

      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;

      const p = computeParallax3D(currentX, currentY);

      if (deepPlaneRef.current) {
        deepPlaneRef.current.style.transform = `translate3d(${p.backdropTranslateX}px, ${p.backdropTranslateY}px, -40px) scale(1.14)`;
      }

      if (subjectPlaneRef.current) {
        subjectPlaneRef.current.style.transform = `perspective(1050px) rotateX(${p.rotateX}deg) rotateY(${p.rotateY}deg) translate3d(${p.subjectTranslateX}px, ${p.subjectTranslateY}px, 38px) scale(1.06)`;
      }

      if (sheenPlaneRef.current) {
        sheenPlaneRef.current.style.background = `radial-gradient(circle 540px at ${p.sheenXPercent}% ${p.sheenYPercent}%, ${accentRef.current}26 0%, ${accentRef.current}0d 45%, rgba(2, 5, 3, 0) 78%)`;
      }

      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden bg-[#020503]"
      aria-hidden="true"
      data-testid="background-stage"
      data-active-character={activeCharacterId}
      data-depth-mode="3d-detached-parallax"
    >
      {/* Layer 1: Deep Counter-Parallax Latverian Backlight, Background Fumes & Glowing Elements */}
      <div
        ref={deepPlaneRef}
        className="absolute inset-0 will-change-transform"
        style={{
          transform: 'translate3d(0px, 0px, -40px) scale(1.14)',
          background: `
            radial-gradient(ellipse 48% 54% at 52% 40%, ${activeCharacter.accentHex}38 0%, rgba(16, 84, 44, 0.30) 42%, rgba(2, 5, 3, 0) 74%),
            radial-gradient(ellipse 88% 68% at 50% 92%, rgba(22, 118, 60, 0.28) 0%, rgba(2, 5, 3, 0) 72%),
            linear-gradient(180deg, #020503 0%, #041209 48%, #020503 100%)
          `,
        }}
      >
        {/* Arcane emerald sacred geometry (hexagons, circles, squares) texture behind the PNG */}
        <img
          src="/assets/aistudio/emerald-sacred-geometry-bg.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-80 mix-blend-lighten"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 75% 65% at 50% 45%, rgba(2, 5, 3, 0.12) 0%, rgba(2, 5, 3, 0.58) 72%, rgba(2, 5, 3, 0.9) 100%)',
          }}
        />

        {/* Background volumetric emerald fumes behind the PNG */}
        <div
          className="animate-doom-fume-drift pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 52% 44% at 32% 74%, rgba(22, 132, 66, 0.35) 0%, rgba(10, 56, 28, 0.15) 48%, transparent 74%),
              radial-gradient(ellipse 56% 46% at 68% 72%, rgba(34, 170, 88, 0.31) 0%, rgba(10, 56, 28, 0.15) 48%, transparent 74%),
              radial-gradient(ellipse 64% 38% at 50% 88%, rgba(28, 152, 76, 0.39) 0%, rgba(6, 36, 18, 0.17) 54%, transparent 80%)
            `,
            filter: 'blur(34px)',
          }}
        />

        {/* Breathing glowing core aura behind subject's silhouette */}
        <div
          className="animate-doom-bg-breathe pointer-events-none absolute left-1/2 top-[42%] h-[clamp(300px,76vmin,680px)] w-[clamp(300px,76vmin,680px)] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen transition-colors duration-500"
          style={{
            background: `radial-gradient(circle, ${activeCharacter.accentHex}52 0%, ${activeCharacter.accentHex}28 34%, ${activeCharacter.accentHex}10 58%, transparent 74%)`,
            filter: 'blur(26px)',
          }}
        />

        {/* Rotating volumetric light rays behind the PNG */}
        <div
          className="animate-doom-rays-spin pointer-events-none absolute left-1/2 top-[40%] h-[clamp(380px,98vmin,920px)] w-[clamp(380px,98vmin,920px)] rounded-full opacity-45 mix-blend-screen"
          style={{
            background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${activeCharacter.accentHex}2c 18deg, transparent 42deg, transparent 88deg, ${activeCharacter.accentHex}24 112deg, transparent 142deg, transparent 196deg, ${activeCharacter.accentHex}2a 224deg, transparent 258deg, transparent 304deg, ${activeCharacter.accentHex}20 332deg, transparent 360deg)`,
            maskImage: 'radial-gradient(circle, black 12%, rgba(0,0,0,0.65) 42%, transparent 70%)',
            WebkitMaskImage:
              'radial-gradient(circle, black 12%, rgba(0,0,0,0.65) 42%, transparent 70%)',
            filter: 'blur(14px)',
          }}
        />

        {/* Glowing & growing expanding energy rings behind the PNG */}
        <div
          className="animate-doom-ring-expand pointer-events-none absolute left-1/2 top-[40%] h-[clamp(240px,62vmin,540px)] w-[clamp(240px,62vmin,540px)] rounded-full border transition-colors duration-500"
          style={{
            borderColor: `${activeCharacter.accentHex}59`,
            boxShadow: `0 0 44px ${activeCharacter.accentHex}4d, inset 0 0 36px ${activeCharacter.accentHex}38`,
          }}
        />
        <div
          className="animate-doom-ring-expand pointer-events-none absolute left-1/2 top-[40%] h-[clamp(240px,62vmin,540px)] w-[clamp(240px,62vmin,540px)] rounded-full border transition-colors duration-500"
          style={{
            animationDelay: '-3.5s',
            borderColor: `${activeCharacter.accentHex}4d`,
            boxShadow: `0 0 38px ${activeCharacter.accentHex}3d, inset 0 0 30px ${activeCharacter.accentHex}2e`,
          }}
        />

        {/* Concentric glowing architectural halo rings & arcane crest behind the detached cutout */}
        <div
          className="pointer-events-none absolute left-1/2 top-[39%] h-[clamp(320px,84vmin,760px)] w-[clamp(320px,84vmin,760px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed transition-colors duration-500"
          style={{
            borderColor: `${activeCharacter.accentHex}33`,
            boxShadow: `0 0 70px ${activeCharacter.accentHex}24`,
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[39%] h-[clamp(270px,72vmin,640px)] w-[clamp(270px,72vmin,640px)] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors duration-500"
          style={{
            borderColor: `${activeCharacter.accentHex}4d`,
            boxShadow: `0 0 110px ${activeCharacter.accentHex}42, inset 0 0 90px ${activeCharacter.accentHex}38`,
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[39%] h-[clamp(190px,50vmin,440px)] w-[clamp(190px,50vmin,440px)] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors duration-500"
          style={{
            borderColor: `${activeCharacter.accentHex}40`,
            boxShadow: `0 0 60px ${activeCharacter.accentHex}38, inset 0 0 48px ${activeCharacter.accentHex}29`,
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[39%] h-[clamp(155px,40vmin,360px)] w-[clamp(155px,40vmin,360px)] -translate-x-1/2 -translate-y-1/2 rotate-45 border transition-colors duration-500"
          style={{
            borderColor: `${activeCharacter.accentHex}2e`,
            boxShadow: `0 0 48px ${activeCharacter.accentHex}2e, inset 0 0 32px ${activeCharacter.accentHex}1f`,
          }}
        />

        {/* Soft glowing energy orbs flanking subject in the background */}
        <div
          className="animate-doom-glow pointer-events-none absolute left-[22%] top-[56%] h-[clamp(6rem,18vmin,11rem)] w-[clamp(6rem,18vmin,11rem)] rounded-full mix-blend-screen blur-3xl transition-colors duration-500 sm:left-[28%]"
          style={{ backgroundColor: `${activeCharacter.accentHex}33` }}
        />
        <div
          className="animate-doom-glow pointer-events-none absolute right-[22%] top-[54%] h-[clamp(6.5rem,20vmin,12rem)] w-[clamp(6.5rem,20vmin,12rem)] rounded-full mix-blend-screen blur-3xl transition-colors duration-500 sm:right-[28%]"
          style={{ animationDelay: '-2s', backgroundColor: `${activeCharacter.accentHex}2e` }}
        />
      </div>

      {/* Layer 2: Detached 3D Subject Plane (Cutout PNG floats forward in 3D space) */}
      <div
        ref={subjectPlaneRef}
        className="absolute inset-0 will-change-transform"
        style={{
          transform:
            'perspective(1050px) rotateX(0deg) rotateY(0deg) translate3d(0px, 0px, 38px) scale(1.06)',
          transformStyle: 'preserve-3d',
        }}
      >
        {characters.map((character) => {
          const isActive = character.id === activeCharacterId;
          const hasFailed = Boolean(failedImages[character.id]);
          const isCutout = Boolean(character.isCutout);
          const resolvedAccent = isActive ? activeCharacter.accentHex : character.accentHex;

          return (
            <div
              key={character.id}
              className={`absolute inset-0 transition-all duration-500 ease-out will-change-[opacity,transform] ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.03]'
                }`}
            >
              {!hasFailed && character.imageUrl ? (
                <div
                  className={
                    isCutout
                      ? 'absolute left-1/2 top-[38%] aspect-video w-[min(172vw,160dvh)] -translate-x-1/2 -translate-y-[44%] lg:inset-0 lg:top-0 lg:left-0 lg:aspect-auto lg:h-full lg:w-full lg:translate-x-0 lg:translate-y-0'
                      : 'h-full w-full'
                  }
                  style={
                    isCutout
                      ? {
                        maskImage: 'linear-gradient(to bottom, black 60%, transparent 96%)',
                        WebkitMaskImage:
                          'linear-gradient(to bottom, black 60%, transparent 96%)',
                      }
                      : undefined
                  }
                >
                  <img
                    src={character.imageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({
                        ...prev,
                        [character.id]: true,
                      }))
                    }
                    style={
                      isCutout
                        ? {
                          filter: `drop-shadow(0 24px 48px rgba(0, 0, 0, 0.96)) drop-shadow(0 0 46px ${resolvedAccent}78) contrast(1.06) brightness(1.04)`,
                        }
                        : undefined
                    }
                    className={`h-full w-full transition-[filter,transform] duration-500 ${isCutout
                      ? 'object-contain object-center lg:object-bottom lg:pt-12'
                      : 'object-cover object-[50%_22%]'
                      } ${character.imageScaleClass ?? ''}`}
                  />
                </div>
              ) : (
                <div
                  className="relative flex h-full w-full items-center justify-center"
                  style={{
                    background: `radial-gradient(circle at 50% 38%, ${character.accentHex}2a 0%, #07120b 48%, #020503 100%)`,
                  }}
                >
                  <div
                    className="h-72 w-72 rounded-full border opacity-25 sm:h-96 sm:w-96"
                    style={{
                      borderColor: character.accentHex,
                      boxShadow: `0 0 90px ${character.accentHex}33, inset 0 0 60px ${character.accentHex}22`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer 3: Dynamic 3D Specular Rim-Light Sheen */}
      <div
        ref={sheenPlaneRef}
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          background:
            'radial-gradient(circle 540px at 50% 42%, rgba(46, 184, 102, 0.14) 0%, rgba(18, 96, 48, 0.05) 45%, rgba(2, 5, 3, 0) 78%)',
        }}
      />

      {/* Measured obsidian-and-emerald contrast scrims keeping Doom's face clear */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020503]/20 via-transparent to-[#020503]/85" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#020503]/35 via-transparent to-[#020503]/35" />
    </div>
  );
}
