import { Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../utils/sound';

interface NavbarProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function Navbar({ soundEnabled, onToggleSound }: NavbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-emerald-500/10 bg-[#020503]/55 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-[clamp(1rem,3vw,1.5rem)] pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <a
          href="#overview"
          onClick={() => soundEngine.playUiCue(260)}
          className="flex min-h-[38px] items-center gap-2 sm:gap-2.5 focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          <span className="inline-flex flex-col gap-[2px] select-none">
            <span
              aria-label="UPTTI"
              className="flex w-full justify-between px-[2px] sm:px-[3px] font-sans text-[6.5px] sm:text-[7.5px] font-extrabold leading-none text-[#52b77a] uppercase drop-shadow-[0_0_8px_rgba(22,101,52,0.75)]"
            >
              <span>U</span>
              <span>P</span>
              <span>T</span>
              <span>T</span>
              <span>I</span>
            </span>
            <span className="font-marvel text-[24px] sm:text-[28px] font-bold leading-[0.82] tracking-[0.04em] uppercase bg-gradient-to-b from-white via-white via-60% to-[#52b77a] bg-clip-text text-transparent [filter:drop-shadow(0_2px_8px_rgba(22,101,52,0.55))]">
              KANPUR
            </span>
          </span>
          <span
            aria-hidden="true"
            className="font-sans text-xs sm:text-sm font-black text-[#52b77a] drop-shadow-[0_0_8px_rgba(22,101,52,0.7)] select-none"
          >
            ×
          </span>
          <img
            src="/assets/svg/marvel-logo.svg"
            alt="Marvel Logo"
            className="h-7 w-auto sm:h-8"
          />
        </a>

        <button
          type="button"
          onClick={onToggleSound}
          aria-label={soundEnabled ? 'Mute ambient score' : 'Enable ambient score'}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-950/50 px-3.5 py-2 text-[10px] font-semibold tracking-[0.2em] text-emerald-200 uppercase transition hover:border-emerald-400/60 hover:bg-emerald-900/40 focus-visible:outline-2 focus-visible:outline-emerald-400"
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
