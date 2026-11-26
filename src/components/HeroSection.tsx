import { Check, ChevronDown, Flame, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CharacterProfile } from '../data/characters';
import { soundEngine } from '../utils/sound';
import { CountdownTimer } from './CountdownTimer';

const COUNTER_GET_URL = 'https://api.counterapi.dev/v1/avengers-doomsday-campus/interested';
const COUNTER_UP_URL = 'https://api.counterapi.dev/v1/avengers-doomsday-campus/interested/up';
const VOTED_STORAGE_KEY = 'doomsday_campus_interested';
const COUNT_STORAGE_KEY = 'doomsday_campus_interested_count';

interface HeroSectionProps {
  activeCharacter: CharacterProfile;
  characters: CharacterProfile[];
  onSurgeAtmosphere: () => void;
  onOpenTrailer: () => void;
}

export function HeroSection({
  activeCharacter,
  characters,
  onSurgeAtmosphere,
  onOpenTrailer,
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
        // Keep local fallback count when offline
      });

    return () => controller.abort();
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

    fetch(COUNTER_UP_URL)
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
      });
  };

  const activeIndex = Math.max(
    0,
    characters.findIndex((c) => c.id === activeCharacter.id)
  );
  const eyebrowLeft =
    activeCharacter.id === 'doctor-doom' ? 'Marvel Studios' : activeCharacter.faction;

  return (
    <section
      id="overview"
      className="relative mx-auto flex h-dvh max-w-5xl flex-col items-center justify-end px-[clamp(1rem,4vw,2rem)] pb-[max(clamp(2.25rem,6.5dvh,3.75rem),env(safe-area-inset-bottom))] pt-[clamp(4.5rem,11dvh,6.5rem)] text-center lg:pb-[clamp(1.25rem,3.5dvh,2.25rem)]"
    >
      {/* Top-Left Netflix Series Style Active Dossier Title (one at a time, changes on scroll) */}
      <div
        key={activeCharacter.id}
        aria-live="polite"
        className="pointer-events-none fixed left-[clamp(1rem,3vw,2rem)] top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] z-30 text-left animate-[fadeIn_320ms_ease-out]"
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3.5 w-[3px] rounded-full transition-all duration-500"
            style={{
              backgroundColor: activeCharacter.accentHex,
              boxShadow: `0 0 12px ${activeCharacter.accentHex}`,
            }}
          />
          <span className="text-[10px] font-bold tracking-[0.28em] text-white/80 uppercase">
            {activeCharacter.faction} · {String(activeIndex + 1).padStart(2, '0')}/
            {String(characters.length).padStart(2, '0')}
          </span>
        </div>

        <h2
          className="mt-1 font-marvel text-[clamp(1.5rem,3.6vw,2.75rem)] font-bold leading-[0.95] tracking-[0.04em] text-white uppercase transition-all duration-500"
          style={{
            textShadow: `0 4px 20px rgba(0, 0, 0, 0.95), 0 0 26px ${activeCharacter.accentHex}55`,
          }}
        >
          {activeCharacter.name}
        </h2>

        <p
          className="mt-1 text-[10px] font-semibold tracking-[0.22em] uppercase transition-colors duration-500"
          style={{ color: activeCharacter.accentHex }}
        >
          {activeCharacter.role}
        </p>
      </div>

      <div className="flex w-full flex-col items-center">
        <p
          className="text-[clamp(0.625rem,1.5vw,0.75rem)] font-semibold tracking-[clamp(0.16em,0.35vw,0.26em)] uppercase transition-colors duration-500"
          style={{ color: activeCharacter.accentHex }}
        >
          {eyebrowLeft} <span aria-hidden="true" className="mx-1.5 opacity-45">·</span>{' '}
          {activeCharacter.name}
        </p>

        <h1 className="mt-2 flex max-w-full items-center justify-center px-4">
          <img
            src="/assets/aistudio/avengers-doomsday-logo.webp"
            alt="Marvel Studios' Avengers: Doomsday Movie Logo"
            draggable={false}
            loading="eager"
            className="h-[clamp(10.5rem,29dvh,21rem)] w-auto max-w-[min(96vw,56rem)] select-none object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.92)]"
          />
        </h1>

        <p className="mt-3 max-w-xl text-[clamp(0.75rem,1.6vw,0.875rem)] font-medium tracking-[0.12em] text-emerald-100/75 italic transition-opacity duration-300">
          &ldquo;{activeCharacter.quote}&rdquo;
        </p>

        <div className="mt-[clamp(1.25rem,3.5dvh,2.5rem)] w-full">
          <CountdownTimer />
        </div>

        {/* Theatrical CTAs */}
        <div className="mt-[clamp(1.125rem,2.8dvh,1.75rem)] flex w-full flex-wrap items-center justify-center gap-3 sm:gap-3.5">
          <button
            type="button"
            onMouseEnter={onSurgeAtmosphere}
            onClick={() => {
              soundEngine.playUiCue(320);
              onOpenTrailer();
            }}
            className="group inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-full border border-emerald-400/50 bg-emerald-600/20 px-6 py-2.5 text-[clamp(0.6875rem,1.4vw,0.75rem)] font-bold tracking-[0.2em] text-emerald-100 uppercase backdrop-blur-md transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-500/30 doom-glow-box hover:doom-glow-box-strong focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <Play className="h-3.5 w-3.5 fill-emerald-300 text-emerald-300 transition-transform duration-300 group-hover:scale-110" />
            <span>Watch Trailer</span>
          </button>

          <button
            type="button"
            onClick={handleInterestedClick}
            aria-pressed={interested}
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-[clamp(0.6875rem,1.4vw,0.75rem)] font-semibold tracking-[0.18em] uppercase backdrop-blur-md transition focus-visible:outline-2 focus-visible:outline-emerald-400 ${
              interested
                ? 'border-emerald-400/70 bg-emerald-500/25 text-white doom-glow-box'
                : 'border-emerald-500/25 bg-[#040a06]/70 text-emerald-200/85 hover:border-emerald-400/50 hover:text-emerald-100'
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

        <p className="mt-5 inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.28em] text-emerald-200/55 uppercase">
          <span>Scroll to see more</span>
          <ChevronDown className="h-3.5 w-3.5 animate-bounce text-emerald-400/80" />
        </p>
      </div>
    </section>
  );
}
