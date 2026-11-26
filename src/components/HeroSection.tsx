import { Check, ChevronDown, Flame, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CharacterProfile } from '../data/characters';
import { soundEngine } from '../utils/sound';
import { CountdownTimer } from './CountdownTimer';

const COUNTER_GET_URL = 'https://api.counterapi.dev/v1/avengers-doomsday-campus/interested';
const COUNTER_UP_URL = 'https://api.counterapi.dev/v1/avengers-doomsday-campus/interested/up';
const VOTED_STORAGE_KEY = 'doomsday_campus_interested';
const COUNT_STORAGE_KEY = 'doomsday_campus_interested_count';
const FETCH_TIMEOUT_MS = 5000;

interface HeroSectionProps {
  activeCharacter: CharacterProfile;
  characters: CharacterProfile[];
  onSurgeAtmosphere: () => void;
  onOpenTrailer: () => void;
  onStepDossier: (direction: 1 | -1) => void;
}

export function HeroSection({
  activeCharacter,
  characters,
  onSurgeAtmosphere,
  onOpenTrailer,
  onStepDossier,
}: HeroSectionProps) {
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

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(COUNTER_GET_URL, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number } | null) => {
        if (data && typeof data.count === 'number') {
          setInterestCount(data.count);
          try {
            localStorage.setItem(COUNT_STORAGE_KEY, String(data.count));
          } catch {
            // Ignore storage errors
          }
        }
      })
      .catch(() => {
        // Keep local fallback count when offline or timed out
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const handleInterestedClick = () => {
    soundEngine.playUiCue(340);
    onSurgeAtmosphere();

    if (interested) return;

    setInterested(true);
    const nextCount = interestCount + 1;
    setInterestCount(nextCount);

    try {
      localStorage.setItem(VOTED_STORAGE_KEY, 'true');
      localStorage.setItem(COUNT_STORAGE_KEY, String(nextCount));
    } catch {
      // Ignore storage errors
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(COUNTER_UP_URL, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number } | null) => {
        if (data && typeof data.count === 'number') {
          setInterestCount(data.count);
          try {
            localStorage.setItem(COUNT_STORAGE_KEY, String(data.count));
          } catch {
            // Ignore storage errors
          }
        }
      })
      .catch(() => {
        // Local optimistic count already applied
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
  };

  return (
    <section
      id="overview"
      className="relative mx-auto flex h-dvh max-w-5xl flex-col items-center justify-start overflow-hidden px-[clamp(0.75rem,3.5vw,2rem)] pb-[max(clamp(1.5rem,4dvh,2.75rem),env(safe-area-inset-bottom))] pt-[calc(var(--stage-center-y)+min(15dvh,27vw))] text-center md:justify-end md:pt-[clamp(4.5rem,11dvh,6.5rem)] md:pb-[clamp(1.25rem,3.5dvh,2.25rem)] lg:pb-[clamp(2.75rem,6dvh,4.25rem)] [@media(max-height:540px)]:justify-end [@media(max-height:540px)]:pt-14"
    >
      {/* Top-Left Fixed Active Dossier Readout (crossfades smoothly on scroll) */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed left-[clamp(0.75rem,3vw,2rem)] top-[max(4.15rem,calc(env(safe-area-inset-top)+3.45rem))] z-30 grid max-w-[min(56vw,16.5rem)] text-left sm:max-w-[19rem] lg:max-w-[20.5rem] [@media(max-height:610px)]:hidden"
      >
        {characters.map((character, index) => {
          const isActive = character.id === activeCharacter.id;
          return (
            <div
              key={character.id}
              aria-hidden={!isActive}
              className={`[grid-area:1/1] transition-opacity duration-700 ease-out will-change-[opacity] ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span
                  className="inline-block h-3.5 w-[3px] rounded-full"
                  style={{
                    backgroundColor: character.accentHex,
                    boxShadow: `0 0 12px ${character.accentHex}`,
                  }}
                />
                <span className="text-[clamp(0.5625rem,1.4vw,0.625rem)] font-bold tracking-[clamp(0.16em,0.3vw,0.28em)] text-white/85 uppercase">
                  {character.faction} · {String(index + 1).padStart(2, '0')}/
                  {String(characters.length).padStart(2, '0')}
                </span>
                <span className="hidden rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[8.5px] font-semibold tracking-[0.16em] text-white/75 uppercase sm:inline-block">
                  {character.threatLevel}
                </span>
              </div>

              <h2
                className="mt-1 font-marvel text-[clamp(1.15rem,3.5vw,2.75rem)] font-bold leading-[0.95] tracking-[0.04em] text-white uppercase"
                style={{
                  textShadow: `0 4px 20px rgba(0, 0, 0, 0.95), 0 0 26px ${character.accentHex}55`,
                }}
              >
                {character.name}
              </h2>

              <p
                className="mt-1 text-[clamp(0.5625rem,1.3vw,0.625rem)] font-semibold tracking-[0.18em] uppercase"
                style={{ color: character.accentHex }}
              >
                <span className="hidden sm:inline">{character.alias} · </span>
                {character.role}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex w-full flex-col items-center">
        <div className="grid w-full justify-items-center">
          {characters.map((character) => {
            const isActive = character.id === activeCharacter.id;
            const leftLabel =
              character.id === 'doctor-doom' ? 'Marvel Studios' : character.faction;
            return (
              <p
                key={character.id}
                aria-hidden={!isActive}
                className={`[grid-area:1/1] text-[clamp(0.5625rem,1.5vw,0.75rem)] font-semibold tracking-[clamp(0.14em,0.35vw,0.26em)] uppercase transition-opacity duration-700 ease-out will-change-[opacity] ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ color: character.accentHex }}
              >
                {leftLabel} <span aria-hidden="true" className="mx-1.5 opacity-45">·</span>{' '}
                {character.name}
              </p>
            );
          })}
        </div>

        <h1 className="mt-[clamp(0.25rem,0.8dvh,0.5rem)] flex max-w-full items-center justify-center px-2 sm:px-4">
          <img
            src="/assets/aistudio/avengers-doomsday-logo.webp"
            alt="Marvel Studios' Avengers: Doomsday Movie Logo"
            width={450}
            height={250}
            draggable={false}
            loading="eager"
            fetchPriority="high"
            className="h-[clamp(6.95rem,21.5dvh,13.25rem)] w-auto max-w-[min(98vw,75rem)] select-none object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.92)] md:h-[clamp(13.25rem,32dvh,26.5rem)] [@media(max-height:540px)]:h-[clamp(5.6rem,25dvh,9rem)]"
          />
        </h1>

        <div className="mt-[clamp(0.25rem,1dvh,0.625rem)] grid w-full max-w-xl justify-items-center px-2">
          {characters.map((character) => {
            const isActive = character.id === activeCharacter.id;
            return (
              <p
                key={character.id}
                aria-hidden={!isActive}
                className={`[grid-area:1/1] text-[clamp(0.6875rem,1.6vw,0.875rem)] font-medium tracking-[0.1em] text-emerald-100/75 italic transition-opacity duration-700 ease-out will-change-[opacity] ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              >
                &ldquo;{character.quote}&rdquo;
              </p>
            );
          })}
        </div>

        <div className="mt-[clamp(0.5rem,1.8dvh,2rem)] w-full">
          <CountdownTimer />
        </div>

        {/* Theatrical CTAs */}
        <div className="mt-[clamp(0.625rem,2dvh,1.75rem)] flex w-full flex-wrap items-center justify-center gap-[clamp(0.5rem,1.8vw,0.875rem)]">
          <button
            type="button"
            onMouseEnter={onSurgeAtmosphere}
            onClick={() => {
              soundEngine.playUiCue(320);
              onOpenTrailer();
            }}
            className="group inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-950/85 px-[clamp(1rem,3.5vw,1.5rem)] py-[clamp(0.5rem,1.2dvh,0.625rem)] text-[clamp(0.625rem,1.4vw,0.75rem)] font-bold tracking-[0.18em] text-emerald-100 uppercase transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-500/30 doom-glow-box hover:doom-glow-box-strong md:bg-emerald-600/20 md:backdrop-blur-md focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <Play className="h-3.5 w-3.5 fill-emerald-300 text-emerald-300 transition-transform duration-300 group-hover:scale-110" />
            <span>Watch Trailer</span>
          </button>

          <button
            type="button"
            onClick={handleInterestedClick}
            aria-pressed={interested}
            className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border px-[clamp(0.9rem,3.2vw,1.25rem)] py-[clamp(0.5rem,1.2dvh,0.625rem)] text-[clamp(0.625rem,1.4vw,0.75rem)] font-semibold tracking-[0.16em] uppercase transition md:backdrop-blur-md focus-visible:outline-2 focus-visible:outline-emerald-400 ${
              interested
                ? 'border-emerald-400/70 bg-emerald-900/75 text-white doom-glow-box md:bg-emerald-500/25'
                : 'border-emerald-500/25 bg-[#040a06]/85 text-emerald-200/85 hover:border-emerald-400/50 hover:text-emerald-100 md:bg-[#040a06]/70'
            }`}
          >
            {interested ? (
              <Check className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <Flame className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span>{interested ? 'Interested' : 'I am Interested'}</span>
            {interestCount > 0 && (
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold tracking-normal text-emerald-200 tabular-nums">
                {interestCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onStepDossier(1)}
          aria-label="Scroll or click to cycle character dossiers"
          className="mt-[clamp(0.375rem,1.5dvh,1.25rem)] inline-flex min-h-[36px] items-center gap-1.5 px-3 py-1 text-[clamp(0.5625rem,1.3vw,0.625rem)] font-semibold tracking-[0.24em] text-emerald-200/65 uppercase transition hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          <span>Scroll to switch dossier</span>
          <ChevronDown className="h-3.5 w-3.5 animate-bounce text-emerald-400/80" />
        </button>
      </div>
    </section>
  );
}
