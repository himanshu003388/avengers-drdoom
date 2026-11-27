import { ExternalLink, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';

const TRAILER_VIDEO_ID = 'WwXD5OTlyHg';
const TRAILER_EMBED_URL = `https://www.youtube.com/embed/${TRAILER_VIDEO_ID}?autoplay=1&rel=0&playsinline=1`;
const TRAILER_POSTER_URL = `https://i.ytimg.com/vi/${TRAILER_VIDEO_ID}/hqdefault.jpg`;

interface TrailerModalProps {
  open: boolean;
  onClose: () => void;
}

export function TrailerModal({ open, onClose }: TrailerModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [posterHidden, setPosterHidden] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useModalBehavior(open, onClose, panelRef);

  useEffect(() => {
    if (!open) {
      setIframeLoaded(false);
      setPosterHidden(false);
      setSlowLoad(false);
      return;
    }

    const slowTimer = window.setTimeout(() => {
      setSlowLoad(true);
    }, 6000);

    return () => {
      window.clearTimeout(slowTimer);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trailer-modal-title"
      className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/92 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="animate-modal-panel doom-hud-card relative max-h-[calc(100dvh-2rem)] w-full max-w-5xl touch-pan-y overflow-y-auto rounded-2xl border border-emerald-500/30 !bg-[#050c08] shadow-[0_0_60px_rgba(34,197,94,0.2)] focus:outline-none md:!backdrop-blur-none"
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
              href={`https://youtu.be/${TRAILER_VIDEO_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/60 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-emerald-200 uppercase transition hover:border-emerald-400/60 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              <span>YouTube</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close trailer modal"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-950/60 text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-900/60 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative aspect-video w-full overflow-hidden bg-[#030705]">
          {!iframeLoaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-4">
              {!posterHidden && (
                <img
                  src={TRAILER_POSTER_URL}
                  alt="Avengers: Doomsday Trailer Thumbnail"
                  onError={() => setPosterHidden(true)}
                  className="absolute inset-0 h-full w-full object-cover opacity-40"
                />
              )}
              <div className="relative z-10 flex items-center gap-2.5 rounded-full border border-emerald-500/35 bg-black/80 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-emerald-200 uppercase shadow-lg">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" aria-hidden="true" />
                <span>Loading Trailer…</span>
              </div>

              {slowLoad && (
                <a
                  href={`https://youtu.be/${TRAILER_VIDEO_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-950/85 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-emerald-100 uppercase transition hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400"
                >
                  <span>Open Directly on YouTube</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          )}

          <iframe
            className={`relative z-20 h-full w-full transition-opacity duration-300 ${
              iframeLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            src={TRAILER_EMBED_URL}
            title="Avengers: Doomsday Official Trailer"
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
}
