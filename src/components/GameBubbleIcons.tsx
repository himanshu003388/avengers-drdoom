import type { BubbleKind } from '../types/game';

interface BubbleIconProps {
  kind: BubbleKind;
  className?: string;
}

export function GameBubbleIcon({ kind, className = 'h-7 w-7' }: BubbleIconProps) {
  switch (kind) {
    case 'thor':
      // Mjolnir (Thor's Hammer) with subtle lightning edge
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <rect
            x="9"
            y="10"
            width="30"
            height="16"
            rx="3.5"
            fill="#cbd5e1"
            stroke="#facc15"
            strokeWidth="2.2"
          />
          <path d="M13 10L16 14H32L35 10" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M14 22H34" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
          <rect x="21.5" y="26" width="5" height="14" rx="1.8" fill="#92400e" stroke="#facc15" strokeWidth="1.5" />
          <path d="M21.5 31H26.5M21.5 35H26.5" stroke="#fde047" strokeWidth="1.2" />
          <path
            d="M39 7L36 12H40L37 17"
            stroke="#fde047"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'ironman':
      // Iron Man Helmet & glowing Arc Reactor eyes
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path
            d="M14 13C14 9.5 18 7 24 7C30 7 34 9.5 34 13L36 27C36 33 31 39 24 41C17 39 12 33 12 27L14 13Z"
            fill="#b91c1c"
            stroke="#fbbf24"
            strokeWidth="2"
          />
          <path
            d="M17 15L20 13H28L31 15L32 25L28 34H20L16 25L17 15Z"
            fill="#f59e0b"
          />
          <path d="M17.5 22L22 23.5L18 25L17.5 22Z" fill="#e0f2fe" />
          <path d="M30.5 22L26 23.5L30 25L30.5 22Z" fill="#e0f2fe" />
          <path d="M20 31.5H28" stroke="#991b1b" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'doom':
      // Doctor Doom Titanium Mask & Emerald Hood
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path
            d="M10 23C10 12 16 6 24 6C32 6 38 12 38 23L35 37C32 40 28 42 24 42C20 42 16 40 13 37L10 23Z"
            fill="#14532d"
            stroke="#22c55e"
            strokeWidth="2"
          />
          <path
            d="M15 17C15 13.5 19 11.5 24 11.5C29 11.5 33 13.5 33 17L32 30C31 34 28 37 24 38C20 37 17 34 16 30L15 17Z"
            fill="#94a3b8"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
          <path d="M17.5 21.5L22 22.8L18.5 24.2L17.5 21.5Z" fill="#22c55e" />
          <path d="M30.5 21.5L26 22.8L29.5 24.2L30.5 21.5Z" fill="#22c55e" />
          <path d="M19.5 30.5H28.5M21 33.5H27" stroke="#334155" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'bomb':
      // Red Incursion Bomb (instant loss hazard)
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path
            d="M27 14C28 10 31 8 35 8"
            stroke="#fca5a5"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="37" cy="8" r="2.6" fill="#fef08a" />
          <path d="M37 4V6M41 8H39M40 5L38.5 6.5" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="21" y="13" width="6" height="4" rx="1" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="1.5" />
          <circle
            cx="24"
            cy="28"
            r="13"
            fill="#991b1b"
            stroke="#ef4444"
            strokeWidth="2.4"
          />
          <path
            d="M19.5 23.5L28.5 32.5M28.5 23.5L19.5 32.5"
            stroke="#fecaca"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'avengers':
    default:
      // Iconic Avengers "A" Emblem
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <circle
            cx="24"
            cy="24"
            r="16"
            fill="#1e3a8a"
            stroke="#60a5fa"
            strokeWidth="2.2"
          />
          <path
            d="M25.5 11L15 36H20.5L22.6 30.5H29.5L31.4 36H36.5L25.5 11ZM24.2 26L26.3 20L28.2 26H24.2Z"
            fill="#f8fafc"
          />
          <path d="M18 28.5H33L31 25.5" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
