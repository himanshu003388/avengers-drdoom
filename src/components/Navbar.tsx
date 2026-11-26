import { Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../utils/sound';

interface NavbarProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onResetHome?: () => void;
}

export function Navbar({ soundEnabled, onToggleSound, onResetHome }: NavbarProps) {
  return (
    <header className="relative z-40 shrink-0 border-b border-emerald-500/10 bg-[#020503]/90 md:bg-[#020503]/60 md:backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-[clamp(0.75rem,3vw,1.5rem)] pb-[clamp(0.4rem,1dvh,0.75rem)] pt-[max(clamp(0.4rem,1dvh,0.75rem),env(safe-area-inset-top))]">
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            soundEngine.playUiCue(260);
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
          onClick={onToggleSound}
          aria-label={soundEnabled ? 'Mute ambient score' : 'Enable ambient score'}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/50 px-[clamp(0.7rem,2.2vw,0.875rem)] py-1.5 text-[clamp(0.5625rem,1.4vw,0.625rem)] font-semibold tracking-[0.18em] text-emerald-200 uppercase transition hover:border-emerald-400/60 hover:bg-emerald-900/40 focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          {soundEnabled ? (
            <>
              <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Audio On</span>
            </>
          ) : (
            <>
              <VolumeX className="h-3.5 w-3.5 text-emerald-200/60" />
              <span>Audio Off</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
