import { useEffect, useState } from 'react';
import { computeReleaseCountdown } from '../utils/atmosphere';

const RELEASE_TARGET_MS = new Date(2026, 11, 17, 0, 0, 0).getTime();

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

export function CountdownTimer() {
  const [countdown, setCountdown] = useState(() =>
    computeReleaseCountdown(Date.now(), RELEASE_TARGET_MS)
  );

  useEffect(() => {
    const update = () => {
      if (!document.hidden) {
        setCountdown(computeReleaseCountdown(Date.now(), RELEASE_TARGET_MS));
      }
    };

    const interval = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pageshow', update);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pageshow', update);
    };
  }, []);

  if (countdown.isReleased) {
    return (
      <div data-testid="release-countdown" className="py-2 text-center">
        <p className="doom-timer-cutout text-4xl font-bold tracking-wider uppercase sm:text-6xl md:text-7xl">
          In Theaters Now
        </p>
      </div>
    );
  }

  const units = [
    { label: 'Days', value: padTwo(countdown.days) },
    { label: 'Hours', value: padTwo(countdown.hours) },
    { label: 'Minutes', value: padTwo(countdown.minutes) },
    { label: 'Seconds', value: padTwo(countdown.seconds) },
  ];

  return (
    <div
      data-testid="release-countdown"
      className="mx-auto flex w-full max-w-5xl flex-col items-center text-center"
    >
      <p className="mb-[clamp(0.375rem,1.2dvh,0.75rem)] text-[clamp(0.6875rem,1.8vw,0.9375rem)] font-bold tracking-[clamp(0.16em,0.4vw,0.26em)] text-white/80 uppercase">
        In Theaters December 17
      </p>

      <div className="flex flex-nowrap items-baseline justify-center gap-x-[clamp(0.2rem,1.3vw,1rem)]">
        {units.map((unit, index) => (
          <div key={unit.label} className="flex items-baseline gap-x-[clamp(0.2rem,1.3vw,1rem)]">
            <div className="flex w-[clamp(3.75rem,19vw,9.5rem)] shrink-0 flex-col items-center">
              <span className="doom-timer-cutout w-full text-center text-[clamp(2.25rem,min(10vw,9.5dvh),6.25rem)] font-bold leading-none tracking-tight tabular-nums">
                {unit.value}
              </span>
              <span className="doom-timer-label mt-[clamp(0.25rem,0.8dvh,0.5rem)] text-[clamp(0.625rem,1.8vw,0.9375rem)] font-bold tracking-[clamp(0.1em,0.28vw,0.24em)] uppercase">
                {unit.label}
              </span>
            </div>

            {index < units.length - 1 && (
              <span
                aria-hidden="true"
                className="doom-timer-cutout w-[clamp(0.75rem,2.6vw,2rem)] shrink-0 self-start pt-0.5 text-center text-[clamp(1.75rem,min(8vw,7.5dvh),5rem)] font-bold leading-none opacity-80"
              >
                :
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
