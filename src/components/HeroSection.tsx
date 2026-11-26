import { Check, ChevronDown, Flame, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CharacterProfile } from '../data/characters';
import { soundEngine } from '../utils/sound';
import { CountdownTimer } from './CountdownTimer';

const API_INTERESTED_URL = '/api/interested';
const ABACUS_GET_URL = 'https://abacus.jasoncameron.dev/get/avengers-doomsday-campus/interested';
const ABACUS_HIT_URL = 'https://abacus.jasoncameron.dev/hit/avengers-doomsday-campus/interested';
const VOTED_STORAGE_KEY = 'doomsday_campus_interested';
const COUNT_STORAGE_KEY = 'doomsday_campus_interested_count';
const FETCH_TIMEOUT_MS = 5000;

async function fetchInterestCount(
  mode: 'get' | 'increment',
  signal: AbortSignal
): Promise<number | null> {
  const method = mode === 'increment' ? 'POST' : 'GET';

  try {
    const apiRes = await fetch(API_INTERESTED_URL, {
      method,
      cache: 'no-store',
      signal,
    });
    const contentType = apiRes.headers.get('content-type') || '';
    if (apiRes.ok && contentType.includes('application/json')) {
      const data = (await apiRes.json()) as { count?: unknown };
      if (typeof data.count === 'number' && Number.isFinite(data.count)) {
        return data.count;
      }
    }
  } catch (err) {
    if (signal.aborted) throw err;
  }

  // Fallback for local Vite dev (where /api/* is not served)
  const fallbackUrl = mode === 'increment' ? ABACUS_HIT_URL : ABACUS_GET_URL;
  const fallbackRes = await fetch(fallbackUrl, { cache: 'no-store', signal });
  if (mode === 'get' && fallbackRes.status === 404) {
    return 0;
  }
  if (!fallbackRes.ok) {
    return null;
  }
  const fallbackData = (await fallbackRes.json()) as { value?: unknown };
  return typeof fallbackData.value === 'number' && Number.isFinite(fallbackData.value)
    ? fallbackData.value
    : null;
}

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

    fetchInterestCount('get', controller.signal)
      .then((count) => {
        if (typeof count === 'number') {
          setInterestCount(count);
          try {
            localStorage.setItem(COUNT_STORAGE_KEY, String(count));
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

    fetchInterestCount('increment', controller.signal)
      .then((count) => {
        if (typeof count === 'number') {
          setInterestCount(count);
          try {
            localStorage.setItem(COUNT_STORAGE_KEY, String(count));
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
      className="relative flex min-h-full w-full flex-col items-center justify-between px-[clamp(0.75rem,3vw,2rem)] pt-[clamp(0.5rem,1.5dvh,1.25rem)] pb-[clamp(0.375rem,1.5dvh,1.5rem)] text-center lg:pb-[clamp(0.75rem,2.5dvh,2.25rem)]"
    >
      {/* Top HUD Row: Active Dossier Readout (left) + Movie Logo on md+ (right) */}
      <h1 className="sr-only">Marvel Studios&apos; Avengers: Doomsday</h1>
      <div className="flex w-full shrink-0 items-start justify-between gap-4">
        <div
          aria-live="polite"
          className="pointer-events-none grid min-w-0 max-w-[min(78vw,17.5rem)] text-left sm:max-w-[19rem] lg:max-w-[20.5rem] [@media(max-height:540px)]:hidden"
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

        <div className="hidden shrink-0 items-center justify-end md:flex">
          <img
            src="/assets/aistudio/avengers-doomsday-logo.webp"
            alt="Marvel Studios' Avengers: Doomsday Movie Logo"
            width={450}
            height={250}
            draggable={false}
            loading="eager"
            fetchPriority="high"
            className="pointer-events-none h-[clamp(8.55rem,23.4dvh,17.1rem)] w-auto max-w-[min(48vw,38rem)] select-none object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.92)] lg:h-[clamp(10.35rem,27dvh,19.8rem)] lg:max-w-[min(52vw,42rem)] [@media(max-height:540px)]:h-[clamp(3.75rem,16dvh,5.5rem)]"
          />
        </div>
      </div>

      {/* Flexible Stage Window: lets background character art breathe when vertical space allows, compresses cleanly on small viewports */}
      <div className="min-h-[clamp(0.5rem,2dvh,2rem)] flex-1 [@media(max-height:540px)]:min-h-1" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-5xl shrink-0 flex-col items-center">
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

        <div className="mt-[clamp(0.2rem,0.7dvh,0.5rem)] flex max-w-full items-center justify-center px-2 sm:px-4 md:hidden">
          <img
            src="/assets/aistudio/avengers-doomsday-logo.webp"
            alt="Marvel Studios' Avengers: Doomsday Movie Logo"
            width={450}
            height={250}
            draggable={false}
            loading="eager"
            fetchPriority="high"
            className="h-[clamp(4.75rem,17dvh,11.5rem)] w-auto max-w-[min(92vw,34rem)] select-none object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.92)] [@media(max-height:540px)]:h-[clamp(3.25rem,15dvh,5rem)]"
          />
        </div>

        <div className="mt-[clamp(0.2rem,0.9dvh,0.625rem)] grid w-full max-w-xl justify-items-center px-2">
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

        <div className="mt-[clamp(0.375rem,1.4dvh,1.75rem)] w-full">
          <CountdownTimer />
        </div>

        {/* Theatrical CTAs */}
        <div className="mt-[clamp(0.5rem,1.6dvh,1.5rem)] flex w-full flex-wrap items-center justify-center gap-[clamp(0.45rem,1.8vw,0.875rem)]">
          <button
            type="button"
            onMouseEnter={onSurgeAtmosphere}
            onClick={() => {
              soundEngine.playUiCue(320);
              onOpenTrailer();
            }}
            style={{
              borderColor: `${activeCharacter.accentHex}80`,
              backgroundColor: `${activeCharacter.accentHex}26`,
              boxShadow: `0 0 24px ${activeCharacter.accentHex}33, inset 0 0 14px ${activeCharacter.accentHex}1f`,
            }}
            className="group inline-flex min-h-[38px] items-center justify-center gap-2 rounded-full border px-[clamp(0.9rem,3.2vw,1.5rem)] py-[clamp(0.4rem,1dvh,0.625rem)] text-[clamp(0.625rem,1.4vw,0.75rem)] font-bold tracking-[0.18em] text-white uppercase transition-all duration-500 hover:brightness-125 sm:min-h-[42px] md:backdrop-blur-md focus-visible:outline-2 focus-visible:outline-white/75"
          >
            <Play
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110"
              style={{
                color: activeCharacter.accentHex,
                fill: activeCharacter.accentHex,
              }}
            />
            <span>Watch Trailer</span>
          </button>

          <button
            type="button"
            onClick={handleInterestedClick}
            aria-pressed={interested}
            style={
              interested
                ? {
                    borderColor: `${activeCharacter.accentHex}b3`,
                    backgroundColor: `${activeCharacter.accentHex}33`,
                    boxShadow: `0 0 24px ${activeCharacter.accentHex}38, inset 0 0 14px ${activeCharacter.accentHex}22`,
                  }
                : {
                    borderColor: `${activeCharacter.accentHex}47`,
                    backgroundColor: 'rgba(6, 8, 6, 0.78)',
                  }
            }
            className={`inline-flex min-h-[38px] items-center justify-center gap-2 rounded-full border px-[clamp(0.85rem,3vw,1.25rem)] py-[clamp(0.4rem,1dvh,0.625rem)] text-[clamp(0.625rem,1.4vw,0.75rem)] font-semibold tracking-[0.16em] uppercase transition-all duration-500 hover:brightness-125 sm:min-h-[42px] md:backdrop-blur-md focus-visible:outline-2 focus-visible:outline-white/75 ${
              interested ? 'text-white' : 'text-white/85 hover:text-white'
            }`}
          >
            {interested ? (
              <Check className="h-3.5 w-3.5" style={{ color: activeCharacter.accentHex }} />
            ) : (
              <Flame className="h-3.5 w-3.5" style={{ color: activeCharacter.accentHex }} />
            )}
            <span>{interested ? 'Interested' : 'I am Interested'}</span>
            {interestCount > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-normal tabular-nums transition-colors duration-500"
                style={{
                  backgroundColor: `${activeCharacter.accentHex}33`,
                  color: activeCharacter.accentHex,
                }}
              >
                {interestCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onStepDossier(1)}
          aria-label="Scroll or click to cycle character dossiers"
          className="mt-[clamp(0.25rem,1.1dvh,1rem)] inline-flex min-h-[32px] items-center gap-1.5 px-3 py-1 text-[clamp(0.5625rem,1.3vw,0.625rem)] font-semibold tracking-[0.24em] text-emerald-200/65 uppercase transition hover:text-emerald-200 sm:min-h-[36px] focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          <span>Scroll to switch dossier</span>
          <ChevronDown className="h-3.5 w-3.5 animate-bounce text-emerald-400/80" />
        </button>
      </div>
    </section>
  );
}
