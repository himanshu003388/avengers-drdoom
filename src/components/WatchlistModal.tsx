import { Calendar, Flame, RefreshCw, Users, X } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import type { PublicWatchlistEntry, WatchDateOption } from '../types/watchlist';

interface WatchlistModalProps {
  open: boolean;
  accentHex: string;
  entries: PublicWatchlistEntry[];
  totalCount: number;
  hasSubmittedRsvp: boolean;
  currentRsvpName?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onOpenRsvp: () => void;
}

type FilterTab = 'all' | WatchDateOption;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatGroupSize(groupSize: PublicWatchlistEntry['groupSize']): string | null {
  if (groupSize === 'plus-one') return '+1';
  if (groupSize === 'squad') return '3+';
  return null;
}

export function WatchlistModal({
  open,
  accentHex,
  entries,
  totalCount,
  hasSubmittedRsvp,
  currentRsvpName = '',
  refreshing = false,
  onRefresh,
  onClose,
  onOpenRsvp,
}: WatchlistModalProps) {
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

  const dec17Count = entries.filter((e) => e.watchDate === 'dec-17').length;
  const after17Count = entries.filter((e) => e.watchDate === 'after-17').length;
  const dec17Pct = entries.length > 0 ? Math.round((dec17Count / entries.length) * 100) : 50;
  const normalizedSelfName = currentRsvpName.toLowerCase().replace(/\s+/g, ' ').trim();
  const filteredEntries =
    filter === 'all' ? entries : entries.filter((entry) => entry.watchDate === filter);

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: entries.length },
    { id: 'dec-17', label: 'On Dec 17', count: dec17Count },
    { id: 'after-17', label: 'After Dec 17', count: after17Count },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="watchlist-modal-title"
      className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/88 p-3 sm:p-4"
      onClick={() => {
        onClose();
      }}
    >
      <div
        className="animate-modal-panel doom-hud-card relative flex min-h-[55dvh] max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border !bg-[#050c08] shadow-2xl sm:min-h-[26rem]"
        style={{
          borderColor: `${accentHex}55`,
          boxShadow: `0 0 54px ${accentHex}2a`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p
              className="flex items-center gap-1.5 truncate text-[10px] font-bold tracking-[0.22em] uppercase"
              style={{ color: accentHex }}
            >
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
                style={{ backgroundColor: accentHex, boxShadow: `0 0 8px ${accentHex}` }}
              />
              <span className="truncate">
                Public Campus Watchlist · {Math.max(totalCount, entries.length)} Interested
              </span>
            </p>
            <h2
              id="watchlist-modal-title"
              className="mt-0.5 font-display text-sm font-bold tracking-[0.14em] text-white uppercase sm:text-base"
            >
              Who&apos;s Going
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {onRefresh && (
              <button
                type="button"
                onClick={() => {
                  onRefresh();
                }}
                disabled={refreshing}
                aria-label="Refresh watchlist"
                title="Refresh watchlist"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:border-white/40 hover:bg-white/10 hover:text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-white/75"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
              }}
              aria-label="Close watchlist modal"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:border-white/40 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/75"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs (visible to everybody) */}
        <div className="border-b border-white/10 px-4 py-2.5 sm:px-5">
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2">
            {tabs.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setFilter(tab.id);
                  }}
                  style={
                    active
                      ? {
                          borderColor: `${accentHex}99`,
                          backgroundColor: `${accentHex}26`,
                          color: '#ffffff',
                          boxShadow: `0 0 16px ${accentHex}24`,
                        }
                      : undefined
                  }
                  className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.06em] uppercase transition-all duration-300 ease-out active:scale-95 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] sm:tracking-[0.12em] ${
                    active
                      ? ''
                      : 'border-white/15 bg-white/[0.03] text-white/65 hover:border-white/30 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums leading-none transition-colors duration-300 sm:text-[10px]"
                    style={
                      active
                        ? { backgroundColor: `${accentHex}33`, color: accentHex }
                        : { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }
                    }
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {entries.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${dec17Pct}%`, backgroundColor: accentHex }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/55">
                {dec17Pct}% Dec 17
              </span>
            </div>
          )}
        </div>

        {/* Public Entries Fluid Bubble List (visible to everybody) */}
        <div className="min-h-[16rem] flex-1 overflow-y-auto scroll-smooth px-4 py-4 sm:min-h-[18rem] sm:px-6">
          {filteredEntries.length === 0 ? (
            <div className="flex h-full min-h-[14rem] flex-col items-center justify-center text-center">
              <Users className="h-8 w-8 text-white/25" />
              <p className="mt-3 text-xs font-semibold text-white/80 sm:text-sm">
                {entries.length === 0
                  ? 'No names added yet — be the first!'
                  : 'No one has picked this date yet.'}
              </p>
              <p className="mt-1 max-w-xs text-[11px] text-white/50 sm:text-xs">
                Add your name and preferred watch date so other students can join your group.
              </p>
            </div>
          ) : (
            <ul key={filter} className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {filteredEntries.map((entry, idx) => {
                const groupLabel = formatGroupSize(entry.groupSize);
                const meta = [groupLabel, entry.info].filter(Boolean).join(' · ');
                const isDec17 = entry.watchDate === 'dec-17';
                const isSelf =
                  normalizedSelfName.length > 0 &&
                  entry.name.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedSelfName;
                const delayStyle = {
                  '--fluid-delay': `${Math.min(idx, 18) * 22}ms`,
                  ...(isSelf
                    ? {
                        borderColor: `${accentHex}75`,
                        backgroundColor: `${accentHex}1a`,
                        boxShadow: `0 0 18px ${accentHex}22`,
                      }
                    : {}),
                } as CSSProperties;

                return (
                  <li
                    key={entry.id}
                    title={meta ? `${entry.name} (${meta})` : entry.name}
                    style={delayStyle}
                    className={`animate-fluid-item inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 transition-all duration-300 ease-out hover:-translate-y-0.5 ${
                      isSelf
                        ? ''
                        : 'border-white/12 bg-white/[0.04] hover:border-white/30 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tracking-wider"
                      style={{
                        borderColor: `${accentHex}55`,
                        backgroundColor: `${accentHex}1f`,
                        color: accentHex,
                      }}
                    >
                      {getInitials(entry.name)}
                    </span>

                    <span className="truncate text-xs font-semibold text-white">
                      {entry.name}
                    </span>

                    {isSelf && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none"
                        style={{ backgroundColor: `${accentHex}33`, color: accentHex }}
                      >
                        You
                      </span>
                    )}

                    {meta && (
                      <span className="max-w-[9rem] truncate text-[10px] text-white/55">
                        {meta}
                      </span>
                    )}

                    <span
                      className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-[0.06em] uppercase"
                      style={
                        isDec17
                          ? {
                              backgroundColor: `${accentHex}24`,
                              color: accentHex,
                            }
                          : {
                              backgroundColor: 'rgba(255,255,255,0.08)',
                              color: 'rgba(255,255,255,0.78)',
                            }
                      }
                    >
                      <Calendar className="h-2.5 w-2.5" />
                      {isDec17 ? 'Dec 17' : 'After 17'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/40 px-4 py-2.5 sm:px-5">
          <p className="text-[10px] text-white/50">
            Names &amp; dates are public. Contact info is never shown.
          </p>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenRsvp();
            }}
            style={{
              borderColor: `${accentHex}80`,
              backgroundColor: `${accentHex}26`,
            }}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white uppercase transition hover:brightness-125"
          >
            <Flame className="h-3 w-3" style={{ color: accentHex }} />
            <span>{hasSubmittedRsvp ? 'My RSVP Pass' : 'Add Your Name'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
