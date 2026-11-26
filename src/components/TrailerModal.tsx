import { ExternalLink, X } from 'lucide-react';
import { useEffect } from 'react';
import { soundEngine } from '../utils/sound';

interface TrailerModalProps {
  open: boolean;
  onClose: () => void;
}

export function TrailerModal({ open, onClose }: TrailerModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundEngine.playUiCue(220);
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trailer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/90 p-4 md:bg-black/85 md:backdrop-blur-md"
      onClick={() => {
        soundEngine.playUiCue(220);
        onClose();
      }}
    >
      <div
        className="doom-hud-card relative w-full max-w-5xl overflow-hidden rounded-2xl border border-emerald-500/30 shadow-[0_0_80px_rgba(34,197,94,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-emerald-500/15 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-bold tracking-[0.26em] text-emerald-400 uppercase">
              Theatrical Teaser · IMAX Presentation
            </p>
            <h2
              id="trailer-modal-title"
              className="font-display text-sm font-bold tracking-[0.16em] text-white uppercase sm:text-base"
            >
              Avengers: Doomsday
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://youtu.be/WwXD5OTlyHg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/60 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-emerald-200 uppercase transition hover:border-emerald-400/60 hover:text-white"
            >
              <span>YouTube</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiCue(220);
                onClose();
              }}
              aria-label="Close trailer modal"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-950/60 text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-900/60 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative aspect-video w-full bg-black">
          <iframe
            className="h-full w-full"
            src="https://www.youtube.com/embed/WwXD5OTlyHg?autoplay=1&rel=0"
            title="Avengers: Doomsday Official Trailer"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
