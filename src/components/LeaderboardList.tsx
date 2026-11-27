import { Crown, Medal, Trophy } from 'lucide-react';
import { memo, type CSSProperties } from 'react';
import type { LeaderboardEntry } from '../types/game';
import { normalizeNameKey } from '../utils/common';

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  currentPlayerName: string;
  accentHex: string;
  loading: boolean;
}

export const LeaderboardList = memo(function LeaderboardList({
  entries,
  currentPlayerName,
  accentHex,
  loading,
}: LeaderboardListProps) {
  const normalizedCurrent = normalizeNameKey(currentPlayerName);

  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">
          Syncing Arcade Rankings...
        </p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/25 px-4 py-7 text-center">
        <Trophy className="h-8 w-8 text-white/30" aria-hidden="true" />
        <p className="mt-2.5 text-sm font-bold tracking-[0.06em] text-white/85 uppercase">
          Arena Unclaimed
        </p>
        <p className="mt-1 max-w-xs text-xs text-white/60">
          Set the first high score on the campus scoreboard before the incursion hits.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((entry, idx) => {
        const isCurrent =
          normalizedCurrent.length > 0 && normalizeNameKey(entry.name) === normalizedCurrent;
        const rank = idx + 1;
        const isFirst = rank === 1;
        const rankColor =
          rank === 1
            ? '#facc15'
            : rank === 2
              ? '#e2e8f0'
              : rank === 3
                ? '#fb923c'
                : 'rgba(255,255,255,0.68)';

        const rowStyle: CSSProperties & { '--fluid-delay'?: string } = {
          '--fluid-delay': `${Math.min(idx, 15) * 20}ms`,
          ...(isCurrent
            ? {
                borderColor: `${accentHex}75`,
                backgroundColor: `${accentHex}17`,
                boxShadow: `inset 0 0 18px ${accentHex}16`,
              }
            : isFirst
              ? {
                  borderColor: 'rgba(250, 204, 21, 0.28)',
                  backgroundColor: 'rgba(250, 204, 21, 0.05)',
                }
              : {}),
        };

        return (
          <li
            key={entry.id}
            style={rowStyle}
            className={`animate-fluid-item flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 transition-colors duration-200 ${
              isCurrent || isFirst
                ? ''
                : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-label={`Rank ${rank}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-[11px] font-extrabold tabular-nums"
                style={{
                  color: rankColor,
                  borderColor: rank <= 3 ? `${rankColor}44` : undefined,
                }}
              >
                {rank === 1 ? (
                  <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                ) : rank <= 3 ? (
                  <Medal className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  rank
                )}
              </span>

              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-xs font-bold text-white sm:text-sm">
                  <span className="truncate">{entry.name}</span>
                  {isCurrent && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.08em] uppercase"
                      style={{ backgroundColor: `${accentHex}2e`, color: accentHex }}
                    >
                      You
                    </span>
                  )}
                </p>
                <p className="text-[10px] font-medium text-white/60 tabular-nums">
                  {entry.popped} popped · {entry.bestCombo}x max streak
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-baseline gap-1">
              <span
                className="font-marvel text-lg font-bold tracking-wider tabular-nums sm:text-xl"
                style={{ color: isFirst ? '#facc15' : accentHex }}
              >
                {entry.score}
              </span>
              <span className="text-[9px] font-bold tracking-widest text-white/55 uppercase">
                PTS
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
});
