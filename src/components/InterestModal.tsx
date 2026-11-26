import { Calendar, Check, Lock, Sparkles, Users, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  GroupSizeOption,
  PublicWatchlistEntry,
  RsvpSubmission,
  WatchDateOption,
} from '../types/watchlist';
import { soundEngine } from '../utils/sound';

interface InterestModalProps {
  open: boolean;
  accentHex: string;
  existingRsvp: RsvpSubmission | null;
  entries: PublicWatchlistEntry[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    watchDate: WatchDateOption;
    groupSize: GroupSizeOption;
    info: string;
    contact: string;
  }) => Promise<void> | void;
  onOpenWatchlist: () => void;
}

const DATE_OPTIONS: { value: WatchDateOption; label: string; sub: string }[] = [
  { value: 'dec-17', label: 'On Dec 17', sub: 'Opening Day' },
  { value: 'after-17', label: 'After Dec 17', sub: 'Weekend / Later' },
];

const GROUP_OPTIONS: { value: GroupSizeOption; label: string }[] = [
  { value: 'solo', label: 'Just Me' },
  { value: 'plus-one', label: '+1 Friend' },
  { value: 'squad', label: 'Squad (3+)' },
];

export function InterestModal({
  open,
  accentHex,
  existingRsvp,
  entries,
  submitting,
  onClose,
  onSubmit,
  onOpenWatchlist,
}: InterestModalProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [watchDate, setWatchDate] = useState<WatchDateOption>('dec-17');
  const [groupSize, setGroupSize] = useState<GroupSizeOption>('solo');
  const [info, setInfo] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    if (existingRsvp) {
      setName(existingRsvp.name);
      setWatchDate(existingRsvp.watchDate);
      setGroupSize(existingRsvp.groupSize);
      setInfo(existingRsvp.info ?? '');
      setContact(existingRsvp.contact ?? '');
      setEditing(false);
    } else {
      setEditing(true);
    }
    setError('');
  }, [open, existingRsvp]);

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

  const showConfirmedPass = Boolean(existingRsvp) && !editing;
  const dec17Count = entries.filter((e) => e.watchDate === 'dec-17').length;
  const after17Count = entries.filter((e) => e.watchDate === 'after-17').length;
  const totalTagged = dec17Count + after17Count;
  const dec17Pct = totalTagged > 0 ? Math.round((dec17Count / totalTagged) * 100) : 50;

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name so others can see you on the watchlist.');
      return;
    }

    setError('');
    soundEngine.playUiCue(340);
    await onSubmit({
      name: trimmedName,
      watchDate,
      groupSize,
      info: info.trim(),
      contact: contact.trim(),
    });
    setEditing(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="interest-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/88 p-4"
      onClick={() => {
        soundEngine.playUiCue(220);
        onClose();
      }}
    >
      <div
        className="doom-hud-card relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border !bg-[#050c08] p-5 shadow-2xl sm:p-6"
        style={{
          borderColor: `${accentHex}55`,
          boxShadow: `0 0 54px ${accentHex}2a`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.26em] uppercase"
              style={{ color: accentHex }}
            >
              {showConfirmedPass ? 'Watchlist Confirmed' : 'Campus Screening RSVP'}
            </p>
            <h2
              id="interest-modal-title"
              className="mt-1 font-display text-base font-bold tracking-[0.14em] text-white uppercase sm:text-lg"
            >
              {showConfirmedPass ? "You're on the List" : 'Join the Watchlist'}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiCue(220);
              onClose();
            }}
            aria-label="Close RSVP modal"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:border-white/40 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/75"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showConfirmedPass && existingRsvp ? (
          <div className="mt-5 space-y-5">
            {/* Pass Card */}
            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: `${accentHex}4d`,
                backgroundColor: `${accentHex}12`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-white/60 uppercase">
                    Attendee
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-white">{existingRsvp.name}</p>
                  {existingRsvp.info && (
                    <p className="mt-0.5 text-xs text-white/70">{existingRsvp.info}</p>
                  )}
                </div>

                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-[0.14em] uppercase"
                  style={{
                    borderColor: `${accentHex}70`,
                    backgroundColor: `${accentHex}26`,
                    color: accentHex,
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  {existingRsvp.watchDate === 'dec-17' ? 'Dec 17' : 'After Dec 17'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs text-white/70">
                <Users className="h-3.5 w-3.5" style={{ color: accentHex }} />
                <span>
                  {GROUP_OPTIONS.find((g) => g.value === existingRsvp.groupSize)?.label ?? 'Just Me'}
                </span>
                <span className="text-white/30">•</span>
                <span>Visible on public watchlist</span>
              </div>
            </div>

            {/* Live Date Breakdown */}
            {totalTagged > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.14em] text-white/75 uppercase">
                  <span>On Dec 17 ({dec17Count})</span>
                  <span>After Dec 17 ({after17Count})</span>
                </div>
                <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${dec17Pct}%`, backgroundColor: accentHex }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiCue(260);
                  setEditing(true);
                }}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-white/80 uppercase transition hover:border-white/35 hover:text-white"
              >
                Edit Details
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiCue(300);
                    onClose();
                    onOpenWatchlist();
                  }}
                  style={{
                    borderColor: `${accentHex}80`,
                    backgroundColor: `${accentHex}26`,
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold tracking-[0.14em] text-white uppercase transition hover:brightness-125"
                >
                  <Users className="h-3.5 w-3.5" style={{ color: accentHex }} />
                  <span>See Who&apos;s Going ({entries.length})</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
            <p className="text-xs leading-relaxed text-white/70">
              Add your name and preferred date so fellow students can coordinate a group screening.
            </p>

            {/* Name */}
            <div>
              <label
                htmlFor="rsvp-name"
                className="block text-[11px] font-semibold tracking-[0.16em] text-white/85 uppercase"
              >
                Your Name <span className="text-emerald-400">*</span>
                <span className="ml-1.5 font-normal tracking-normal text-white/45 normal-case">
                  (shown publicly)
                </span>
              </label>
              <input
                id="rsvp-name"
                type="text"
                maxLength={40}
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/55 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-white/45 focus:outline-none"
              />
            </div>

            {/* Watch Date */}
            <div>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/85 uppercase">
                <Calendar className="h-3.5 w-3.5" style={{ color: accentHex }} />
                When do you want to watch?
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-2.5">
                {DATE_OPTIONS.map((option) => {
                  const selected = watchDate === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiCue(280);
                        setWatchDate(option.value);
                      }}
                      style={
                        selected
                          ? {
                              borderColor: accentHex,
                              backgroundColor: `${accentHex}24`,
                              boxShadow: `0 0 18px ${accentHex}28`,
                            }
                          : undefined
                      }
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        selected
                          ? 'text-white'
                          : 'border-white/15 bg-black/45 text-white/75 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold tracking-[0.08em] uppercase">
                        {option.label}
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/55">{option.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group Size */}
            <div>
              <span className="block text-[11px] font-semibold tracking-[0.16em] text-white/85 uppercase">
                Group Size
              </span>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {GROUP_OPTIONS.map((option) => {
                  const selected = groupSize === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiCue(280);
                        setGroupSize(option.value);
                      }}
                      style={
                        selected
                          ? {
                              borderColor: accentHex,
                              backgroundColor: `${accentHex}24`,
                            }
                          : undefined
                      }
                      className={`rounded-xl border px-2.5 py-2 text-center text-xs font-semibold transition ${
                        selected
                          ? 'text-white'
                          : 'border-white/15 bg-black/45 text-white/70 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <label
                htmlFor="rsvp-info"
                className="block text-[11px] font-semibold tracking-[0.16em] text-white/85 uppercase"
              >
                Basic Info
                <span className="ml-1.5 font-normal tracking-normal text-white/45 normal-case">
                  (optional, shown publicly)
                </span>
              </label>
              <input
                id="rsvp-info"
                type="text"
                maxLength={60}
                value={info}
                onChange={(e) => setInfo(e.target.value)}
                placeholder="e.g. CSE 3rd Year · Evening show preferred"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/55 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-white/45 focus:outline-none"
              />
            </div>

            {/* Private Gmail */}
            <div>
              <label
                htmlFor="rsvp-contact"
                className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/85 uppercase"
              >
                <Lock className="h-3 w-3 text-white/55" />
                <span>Gmail</span>
                <span className="font-normal tracking-normal text-white/45 normal-case">
                  (optional, kept private)
                </span>
              </label>
              <input
                id="rsvp-contact"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={80}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. yourname@gmail.com (never shown publicly)"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/55 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-white/45 focus:outline-none"
              />
            </div>

            {error && <p className="text-xs font-medium text-rose-400">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiCue(220);
                  if (existingRsvp) {
                    setEditing(false);
                  } else {
                    onClose();
                  }
                }}
                className="px-2 py-1.5 text-xs font-medium text-white/55 transition hover:text-white/85"
              >
                {existingRsvp ? 'Cancel' : 'Skip for now'}
              </button>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  borderColor: `${accentHex}99`,
                  backgroundColor: `${accentHex}33`,
                  boxShadow: `0 0 24px ${accentHex}33`,
                }}
                className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-bold tracking-[0.16em] text-white uppercase transition hover:brightness-125 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: accentHex }} />
                <span>
                  {submitting
                    ? 'Saving...'
                    : existingRsvp
                      ? 'Update Details'
                      : 'Add Me to Watchlist'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
