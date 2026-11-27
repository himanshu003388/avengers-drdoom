import { Check, ChevronDown, Flame, Play, UserPlus, Users } from 'lucide-react';
import type { CharacterProfile } from '../data/characters';
import type { RsvpSubmission } from '../types/watchlist';
import { CountdownTimer } from './CountdownTimer';

interface HeroSectionProps {
  activeCharacter: CharacterProfile;
  characters: CharacterProfile[];
  interested: boolean;
  interestCount: number;
  rsvp: RsvpSubmission | null;
  rosterCount: number;
  onSurgeAtmosphere: () => void;
  onOpenTrailer: () => void;
  onOpenInterest: () => void;
  onOpenWatchlist: () => void;
  onStepDossier: (direction: 1 | -1) => void;
}

export function HeroSection({
  activeCharacter,
  characters,
  interested,
  interestCount,
  rsvp,
  rosterCount,
  onSurgeAtmosphere,
  onOpenTrailer,
  onOpenInterest,
  onOpenWatchlist,
  onStepDossier,
}: HeroSectionProps) {
  const handleInterestedClick = () => {
    onSurgeAtmosphere();
    onOpenInterest();
  };

  const interestedLabel = rsvp
    ? `On the List · ${rsvp.watchDate === 'dec-17' ? 'Dec 17' : 'After 17'}`
    : interested
      ? 'Add Your Name'
      : 'I am Interested';

  const displayCount = Math.max(interestCount, rosterCount);

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

        <div className="mt-[clamp(1rem,3.2dvh,3rem)] w-full">
          <CountdownTimer />
        </div>

        {/* Theatrical CTAs */}
        <div className="mt-[clamp(0.5rem,1.6dvh,1.5rem)] flex w-full flex-col items-center justify-center gap-[clamp(0.45rem,1.4dvh,0.75rem)] md:flex-row md:flex-wrap md:gap-[clamp(0.5rem,1.8vw,0.875rem)]">
          {/* Row 1 on mobile: Watch Trailer + Interested always stay on one line */}
          <div className="flex w-full flex-nowrap items-center justify-center gap-[clamp(0.35rem,1.6vw,0.875rem)] md:w-auto">
            <button
              type="button"
              onMouseEnter={onSurgeAtmosphere}
              onClick={() => {
                onOpenTrailer();
              }}
              style={{
                borderColor: `${activeCharacter.accentHex}80`,
                backgroundColor: `${activeCharacter.accentHex}26`,
                boxShadow: `0 0 24px ${activeCharacter.accentHex}33, inset 0 0 14px ${activeCharacter.accentHex}1f`,
              }}
              className="group inline-flex min-h-[clamp(2.25rem,8vw,2.625rem)] shrink-0 items-center justify-center gap-[clamp(0.3rem,1.2vw,0.5rem)] whitespace-nowrap rounded-full border px-[clamp(0.6rem,2.8vw,1.4rem)] py-[clamp(0.38rem,1dvh,0.625rem)] text-[clamp(0.54rem,2.4vw,0.75rem)] font-bold tracking-[clamp(0.06em,0.22vw,0.18em)] text-white uppercase transition-all duration-300 ease-out hover:-translate-y-0.5 hover:brightness-125 active:scale-[0.98] md:backdrop-blur-md focus-visible:outline-2 focus-visible:outline-white/75"
            >
              <Play
                className="h-[clamp(0.75rem,3vw,0.875rem)] w-[clamp(0.75rem,3vw,0.875rem)] shrink-0 transition-transform duration-300 group-hover:scale-110"
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
              className={`inline-flex min-h-[clamp(2.25rem,8vw,2.625rem)] shrink-0 items-center justify-center gap-[clamp(0.3rem,1.2vw,0.5rem)] whitespace-nowrap rounded-full border px-[clamp(0.6rem,2.8vw,1.25rem)] py-[clamp(0.38rem,1dvh,0.625rem)] text-[clamp(0.54rem,2.4vw,0.75rem)] font-semibold tracking-[clamp(0.05em,0.2vw,0.16em)] uppercase transition-all duration-300 ease-out hover:-translate-y-0.5 hover:brightness-125 active:scale-[0.98] md:backdrop-blur-md focus-visible:outline-2 focus-visible:outline-white/75 ${
                interested ? 'text-white' : 'text-white/85 hover:text-white'
              }`}
            >
              {rsvp ? (
                <Check
                  className="h-[clamp(0.75rem,3vw,0.875rem)] w-[clamp(0.75rem,3vw,0.875rem)] shrink-0"
                  style={{ color: activeCharacter.accentHex }}
                />
              ) : interested ? (
                <UserPlus
                  className="h-[clamp(0.75rem,3vw,0.875rem)] w-[clamp(0.75rem,3vw,0.875rem)] shrink-0"
                  style={{ color: activeCharacter.accentHex }}
                />
              ) : (
                <Flame
                  className="h-[clamp(0.75rem,3vw,0.875rem)] w-[clamp(0.75rem,3vw,0.875rem)] shrink-0"
                  style={{ color: activeCharacter.accentHex }}
                />
              )}
              <span>{interestedLabel}</span>
              {displayCount > 0 && (
                <span
                  className="shrink-0 rounded-full px-[clamp(0.35rem,1.4vw,0.5rem)] py-0.5 text-[clamp(0.55rem,2.1vw,0.625rem)] font-bold tracking-normal tabular-nums transition-colors duration-500"
                  style={{
                    backgroundColor: `${activeCharacter.accentHex}33`,
                    color: activeCharacter.accentHex,
                  }}
                >
                  {displayCount}
                </span>
              )}
            </button>
          </div>

          {/* Row 2 on mobile: Who's Going */}
          <button
            type="button"
            onClick={() => {
              onOpenWatchlist();
            }}
            style={{
              borderColor: `${activeCharacter.accentHex}38`,
              backgroundColor: 'rgba(6, 8, 6, 0.72)',
            }}
            className="inline-flex min-h-[clamp(2.2rem,7.8vw,2.625rem)] shrink-0 items-center justify-center gap-[clamp(0.3rem,1.2vw,0.5rem)] whitespace-nowrap rounded-full border px-[clamp(0.75rem,3vw,1.15rem)] py-[clamp(0.38rem,1dvh,0.625rem)] text-[clamp(0.56rem,2.4vw,0.75rem)] font-semibold tracking-[clamp(0.06em,0.2vw,0.14em)] text-white/80 uppercase transition-all duration-300 ease-out hover:-translate-y-0.5 hover:brightness-125 hover:text-white active:scale-[0.98] md:backdrop-blur-md focus-visible:outline-2 focus-visible:outline-white/75"
          >
            <Users
              className="h-[clamp(0.75rem,3vw,0.875rem)] w-[clamp(0.75rem,3vw,0.875rem)] shrink-0"
              style={{ color: activeCharacter.accentHex }}
            />
            <span>Who&apos;s Going</span>
            {rosterCount > 0 && (
              <span
                className="shrink-0 rounded-full px-[clamp(0.35rem,1.4vw,0.5rem)] py-0.5 text-[clamp(0.55rem,2.1vw,0.625rem)] font-bold tracking-normal tabular-nums"
                style={{
                  backgroundColor: `${activeCharacter.accentHex}29`,
                  color: activeCharacter.accentHex,
                }}
              >
                {rosterCount}
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
