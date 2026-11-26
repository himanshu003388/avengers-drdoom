import { useEffect, useState } from 'react';

interface CinematicPreloaderProps {
  onComplete: () => void;
}

export function CinematicPreloader({ onComplete }: CinematicPreloaderProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      onComplete();
      return;
    }

    let finished = false;
    let fadeTimer = 0;
    let doneTimer = 0;

    const triggerDismiss = () => {
      if (finished) return;
      finished = true;
      setFading(true);
      doneTimer = window.setTimeout(onComplete, 280);
    };

    if (document.readyState === 'complete') {
      fadeTimer = window.setTimeout(triggerDismiss, 260);
    } else {
      window.addEventListener('load', triggerDismiss, { once: true });
      fadeTimer = window.setTimeout(triggerDismiss, 550);
    }

    return () => {
      finished = true;
      window.removeEventListener('load', triggerDismiss);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020503] transition-opacity duration-300 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-label="Loading Avengers: Doomsday experience"
    >
      <div className="relative flex items-center justify-center">
        <div className="h-[clamp(5.5rem,18vw,7rem)] w-[clamp(5.5rem,18vw,7rem)] animate-spin rounded-full border border-emerald-500/25 border-t-emerald-400/80 [animation-duration:3s]" />
        <div className="absolute h-[clamp(4rem,13vw,5rem)] w-[clamp(4rem,13vw,5rem)] animate-spin rounded-full border border-emerald-400/20 border-b-emerald-300/70 [animation-direction:reverse] [animation-duration:2s]" />
        <span className="font-display text-[clamp(0.95rem,3vw,1.125rem)] font-extrabold tracking-[0.3em] text-emerald-400 doom-glow-text">
          DOOM
        </span>
      </div>

      <p className="mt-6 px-4 text-center text-[10px] font-semibold tracking-[0.36em] text-emerald-500/80 uppercase">
        Initializing Battleworld
      </p>

      <button
        type="button"
        onClick={() => {
          if (fading) return;
          setFading(true);
          window.setTimeout(onComplete, 200);
        }}
        className="mt-8 min-h-[40px] px-4 py-2 text-[10px] tracking-[0.25em] text-emerald-200/45 uppercase transition hover:text-emerald-300"
      >
        Skip Intro
      </button>
    </div>
  );
}
