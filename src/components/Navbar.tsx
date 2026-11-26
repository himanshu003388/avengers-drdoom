import { Gamepad2 } from 'lucide-react';

interface NavbarProps {
  onResetHome?: () => void;
  onOpenGame: () => void;
}

export function Navbar({ onResetHome, onOpenGame }: NavbarProps) {
  return (
    <header className="relative z-40 shrink-0 border-b border-emerald-500/10 bg-[#020503]/90 md:bg-[#020503]/60 md:backdrop-blur-md">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-[clamp(0.75rem,3vw,1.5rem)] pb-[clamp(0.4rem,1dvh,0.75rem)] pt-[max(clamp(0.4rem,1dvh,0.75rem),env(safe-area-inset-top))]">
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            onResetHome?.();
          }}
          className="flex min-h-[38px] items-center gap-[clamp(0.375rem,1.2vw,0.625rem)] focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          <span className="inline-flex flex-col gap-[2px] select-none">
            <span
              aria-label="UPTTI"
              className="flex w-full justify-between px-[2px] font-sans text-[clamp(0.375rem,1vw,0.46875rem)] font-extrabold leading-none text-[#52b77a] uppercase drop-shadow-[0_0_8px_rgba(22,101,52,0.75)]"
            >
              <span>U</span>
              <span>P</span>
              <span>T</span>
              <span>T</span>
              <span>I</span>
            </span>
            <span className="font-marvel text-[clamp(1.35rem,3.6vw,1.8rem)] font-bold leading-[0.82] tracking-[0.04em] uppercase bg-gradient-to-b from-white via-white via-60% to-[#52b77a] bg-clip-text text-transparent [filter:drop-shadow(0_2px_8px_rgba(22,101,52,0.55))]">
              KANPUR
            </span>
          </span>
          <span
            aria-hidden="true"
            className="font-sans text-[clamp(0.75rem,1.8vw,0.875rem)] font-black text-[#52b77a] drop-shadow-[0_0_8px_rgba(22,101,52,0.7)] select-none"
          >
            ×
          </span>
          <img
            src="/assets/svg/marvel-logo.svg"
            alt="Marvel Logo"
            className="h-[clamp(1.5rem,4vw,2rem)] w-auto"
          />
        </a>

        <button
          type="button"
          onClick={onOpenGame}
          className="animate-play-btn-glow group relative inline-flex min-h-[38px] items-center gap-1.5 overflow-hidden rounded-full border border-emerald-400/50 bg-emerald-950/75 px-[clamp(0.75rem,2.4vw,1rem)] py-1.5 text-[clamp(0.5625rem,1.5vw,0.6875rem)] font-bold tracking-[0.16em] text-emerald-50 uppercase transition hover:scale-[1.03] hover:bg-emerald-900/70 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          <span
            aria-hidden="true"
            className="animate-play-btn-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent"
          />
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <Gamepad2 className="animate-play-icon-wiggle relative h-3.5 w-3.5 shrink-0 text-emerald-300 drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
          <span className="relative">Play Game</span>
        </button>

        {/* Mobile-only translucent cloud callout below navbar pointing up-right to Play Game */}
        <button
          type="button"
          onClick={onOpenGame}
          aria-label="Play Game and Top the Leaderboard"
          className="animate-play-callout-bob absolute right-[clamp(0.75rem,3vw,1.5rem)] top-full z-30 mt-2 flex items-center gap-1.5 rounded-2xl border border-emerald-400/30 bg-[#05110a]/65 px-2.5 py-1.5 text-left shadow-[0_8px_22px_rgba(0,0,0,0.55),0_0_16px_rgba(34,197,94,0.18)] backdrop-blur-md transition hover:border-emerald-300/60 hover:bg-[#06180d]/80 md:hidden"
        >
          <span className="max-w-[8.75rem] text-[9.5px] font-semibold leading-tight tracking-[0.03em] text-emerald-100/95">
            Play Game &amp; Top the Leaderboard
          </span>
          <svg
            viewBox="0 0 28 24"
            fill="none"
            className="h-5 w-6 shrink-0 text-emerald-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.65)]"
            aria-hidden="true"
          >
            <path
              d="M3 19C11 19 19 14 21 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="2.5 3"
            />
            <path
              d="M16.5 7.5L21 3.5L24.5 8.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
