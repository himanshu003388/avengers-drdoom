import { useCallback, useEffect, useRef, useState } from 'react';

interface CinematicPreloaderProps {
  onComplete: () => void;
}

export function CinematicPreloader({ onComplete }: CinematicPreloaderProps) {
  const [fading, setFading] = useState(false);
  const finishedRef = useRef(false);
  const fadeTimerRef = useRef(0);
  const doneTimerRef = useRef(0);

  const triggerDismiss = useCallback(
    (fadeMs = 280) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      window.clearTimeout(fadeTimerRef.current);
      setFading(true);
      doneTimerRef.current = window.setTimeout(onComplete, fadeMs);
    },
    [onComplete]
  );

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      finishedRef.current = true;
      onComplete();
      return;
    }

    const handleLoad = () => triggerDismiss(280);

    if (document.readyState === 'complete') {
      fadeTimerRef.current = window.setTimeout(() => triggerDismiss(280), 260);
    } else {
      window.addEventListener('load', handleLoad, { once: true });
      fadeTimerRef.current = window.setTimeout(() => triggerDismiss(280), 550);
    }

    return () => {
      finishedRef.current = true;
      window.removeEventListener('load', handleLoad);
      window.clearTimeout(fadeTimerRef.current);
      window.clearTimeout(doneTimerRef.current);
    };
  }, [onComplete, triggerDismiss]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020503] transition-opacity duration-300 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      role="status"
      aria-label="Loading Avengers: Doomsday experience"
    >
      <div className="relative flex items-center justify-center" aria-hidden="true">
        <div className="motion-reduce:animate-none h-[clamp(5.5rem,18vw,7rem)] w-[clamp(5.5rem,18vw,7rem)] animate-spin rounded-full border border-emerald-500/25 border-t-emerald-400/80 [animation-duration:3s]" />
        <div className="motion-reduce:animate-none absolute h-[clamp(4rem,13vw,5rem)] w-[clamp(4rem,13vw,5rem)] animate-spin rounded-full border border-emerald-400/20 border-b-emerald-300/70 [animation-direction:reverse] [animation-duration:2s]" />
        <span className="font-display text-[clamp(0.95rem,3vw,1.125rem)] font-extrabold tracking-[0.3em] text-emerald-400 doom-glow-text">
          DOOM
        </span>
      </div>

      <p className="mt-6 px-4 text-center text-[10px] font-semibold tracking-[0.36em] text-emerald-400/85 uppercase">
        Initializing Battleworld
      </p>

      <button
        type="button"
        onClick={() => triggerDismiss(200)}
        className="mt-8 min-h-[40px] rounded-full px-4 py-2 text-[10px] font-semibold tracking-[0.25em] text-emerald-200/75 uppercase transition hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        Skip Intro
      </button>
    </div>
  );
}
