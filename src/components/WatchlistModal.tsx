import { Calendar, Flame, Lock, RefreshCw, Users, X } from 'lucide-react';
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import type { PublicWatchlistEntry, WatchDateOption } from '../types/watchlist';
import { normalizeNameKey } from '../utils/common';

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
  const panelRef = useRef<HTMLDivElement | null>(null);

  useModalBehavior(open, onClose, panelRef);

  const { dec17Count, after17Count, dec17Pct, filteredEntries } = useMemo(() => {
    let dec17 = 0;
    let after17 = 0;
    const filtered: PublicWatchlistEntry[] = [];
    for (const entry of entries) {
      if (entry.watchDate === 'dec-17') dec17++;
      else after17++;
      if (filter === 'all' || entry.watchDate === filter) {
        filtered.push(entry);
      }
    }
    return {
      dec17Count: dec17,
      after17Count: after17,
      dec17Pct: entries.length > 0 ? Math.round((dec17 / entries.length) * 100) : 50,
      filteredEntries: filtered,
    };
  }, [entries, filter]);

  if (!open) return null;

  const normalizedSelfName = normalizeNameKey(currentRsvpName);

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
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="animate-modal-panel doom-hud-card relative flex min-h-[55dvh] max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border !bg-[#050c08] shadow-2xl focus:outline-none sm:min-h-[26rem]"
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
                className="motion-reduce:animate-none inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
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
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Refresh watchlist"
                title="Refresh watchlist"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:border-white/40 hover:bg-white/10 hover:text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-white/75"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close watchlist modal"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:border-white/40 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/75"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {!hasSubmittedRsvp ? (
          <div className="flex min-h-[18rem] flex-1 flex-col items-center justify-center px-6 py-8 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border"
              style={{
                borderColor: `${accentHex}55`,
                backgroundColor: `${accentHex}1a`,
                boxShadow: `0 0 24px ${accentHex}24`,
              }}
            >
              <Lock className="h-5 w-5" style={{ color: accentHex }} aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-display text-sm font-bold tracking-[0.14em] text-white uppercase sm:text-base">
              Register Yourself First
            </h3>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/70 sm:text-sm">
              Add your name and preferred watch date to see who&apos;s going.
              {entries.length > 0 && (
                <span className="mt-1 block text-[11px] text-white/55">
                  {entries.length} {entries.length === 1 ? 'person is' : 'people are'} already on
                  the list.
                </span>
              )}
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
              className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-full border px-5 py-2 text-xs font-bold tracking-[0.14em] text-white uppercase transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-white/75"
            >
              <Flame className="h-3.5 w-3.5" style={{ color: accentHex }} aria-hidden="true" />
              <span>Register Yourself</span>
            </button>
          </div>
        ) : (
          <>
            {/* Filter Tabs */}
            <div className="border-b border-white/10 px-4 py-2.5 sm:px-5">
              <div
                role="tablist"
                aria-label="Filter attendees by watch date"
                className="flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2"
              >
                {tabs.map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(tab.id)}
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
                      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.06em] uppercase transition-all duration-300 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-white/75 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] sm:tracking-[0.12em] ${
                        active
                          ? ''
                          : 'border-white/15 bg-white/[0.03] text-white/70 hover:border-white/30 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums leading-none transition-colors duration-300 sm:text-[10px]"
                        style={
                          active
                            ? { backgroundColor: `${accentHex}33`, color: accentHex }
                            : { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.82)' }
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
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/65">
                    {dec17Pct}% Dec 17
                  </span>
                </div>
              )}
            </div>

            {/* Public Entries Fluid Bubble List */}
            <div
              role="tabpanel"
              className="min-h-[16rem] flex-1 touch-pan-y overflow-y-auto scroll-smooth px-4 py-4 sm:min-h-[18rem] sm:px-6"
            >
              {filteredEntries.length === 0 ? (
                <div className="flex h-full min-h-[14rem] flex-col items-center justify-center text-center">
                  <Users className="h-8 w-8 text-white/30" aria-hidden="true" />
                  <p className="mt-3 text-xs font-semibold text-white/85 sm:text-sm">
                    {entries.length === 0
                      ? 'No names added yet — be the first!'
                      : 'No one has picked this date yet.'}
                  </p>
                  <p className="mt-1 max-w-xs text-[11px] text-white/60 sm:text-xs">
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
                      normalizeNameKey(entry.name) === normalizedSelfName;
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
                          aria-hidden="true"
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
                          <span className="max-w-[9rem] truncate text-[10px] text-white/65">
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
                                  color: 'rgba(255,255,255,0.82)',
                                }
                          }
                        >
                          <Calendar className="h-2.5 w-2.5" aria-hidden="true" />
                          {isDec17 ? 'Dec 17' : 'After 17'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Footer CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/40 px-4 py-2.5 sm:px-5">
          <p className="text-[10px] text-white/60">
            Names &amp; dates are public. Contact info is never shown.
          </p>

          {hasSubmittedRsvp && (
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
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white uppercase transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-white/75"
            >
              <Flame className="h-3 w-3" style={{ color: accentHex }} aria-hidden="true" />
              <span>My RSVP Pass</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
