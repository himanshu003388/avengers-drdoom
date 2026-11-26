import { Flame, Gamepad2, Medal, Play, RotateCcw, ShieldAlert, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { BubbleKind, LeaderboardEntry } from '../types/game';
import { GameBubbleIcon } from './GameBubbleIcons';

interface DoomsdayGameModalProps {
  open: boolean;
  accentHex: string;
  playerName: string;
  entries: LeaderboardEntry[];
  loadingLeaderboard: boolean;
  submittingScore: boolean;
  onPlayerNameChange: (name: string) => void;
  onSubmitScore: (payload: {
    name: string;
    score: number;
    bestCombo: number;
    popped: number;
  }) => Promise<{ isNewBest: boolean }>;
  onRefreshLeaderboard: () => Promise<void>;
  onClose: () => void;
}

type GamePhase = 'lobby' | 'playing' | 'gameover';
type EndReason = 'time' | 'bomb';

interface ActiveBubble {
  id: number;
  kind: BubbleKind;
  xPct: number;
  yPct: number;
  speedY: number;
  swayAmp: number;
  swayFreq: number;
  phaseOffset: number;
  sizePx: number;
  points: number;
}

interface PopEffect {
  id: number;
  xPct: number;
  yPct: number;
  label: string;
  color: string;
}

const ROUND_SECONDS = 30;
const ROUND_DURATION_MS = ROUND_SECONDS * 1000;

const BUBBLE_META: Record<
  BubbleKind,
  { label: string; points: number; ringColor: string; bg: string; badge: string }
> = {
  avengers: {
    label: 'Avengers',
    points: 10,
    ringColor: '#60a5fa',
    bg: 'rgba(30, 58, 138, 0.35)',
    badge: '+10',
  },
  thor: {
    label: "Thor's Hammer",
    points: 15,
    ringColor: '#facc15',
    bg: 'rgba(133, 77, 14, 0.35)',
    badge: '+15',
  },
  ironman: {
    label: 'Iron Man',
    points: 20,
    ringColor: '#f59e0b',
    bg: 'rgba(153, 27, 27, 0.38)',
    badge: '+20',
  },
  doom: {
    label: 'Doctor Doom',
    points: 50,
    ringColor: '#22c55e',
    bg: 'rgba(20, 83, 45, 0.45)',
    badge: '+50',
  },
  bomb: {
    label: 'Red Bomb',
    points: 0,
    ringColor: '#ef4444',
    bg: 'rgba(127, 29, 29, 0.55)',
    badge: 'BOOM',
  },
};

function pickBubbleKind(progress: number): BubbleKind {
  const bombChance = 0.14 + progress * 0.12; // 14% -> 26% as round heats up
  const roll = Math.random();
  if (roll < bombChance) return 'bomb';

  const heroRoll = Math.random();
  if (heroRoll < 0.12) return 'doom';
  if (heroRoll < 0.36) return 'ironman';
  if (heroRoll < 0.66) return 'thor';
  return 'avengers';
}

function getBubbleSwayX(b: ActiveBubble): number {
  const sway = Math.sin((108 - b.yPct) * 0.034 * b.swayFreq + b.phaseOffset) * b.swayAmp;
  return Math.max(8, Math.min(92, b.xPct + sway));
}

function getBubbleTiltDeg(b: ActiveBubble): number {
  return Math.cos((108 - b.yPct) * 0.034 * b.swayFreq + b.phaseOffset) * 5;
}

function getBubbleTransform(b: ActiveBubble, arenaW: number, arenaH: number): string {
  const xPx = (getBubbleSwayX(b) / 100) * arenaW - b.sizePx * 0.5;
  const yPx = (b.yPct / 100) * arenaH - b.sizePx * 0.5;
  const tiltDeg = getBubbleTiltDeg(b);
  return `translate3d(${xPx.toFixed(1)}px, ${yPx.toFixed(1)}px, 0) rotate(${tiltDeg.toFixed(2)}deg)`;
}

function getMultiplier(streak: number): number {
  if (streak >= 8) return 3;
  if (streak >= 4) return 2;
  return 1;
}

function LeaderboardList({
  entries,
  currentPlayerName,
  accentHex,
  loading,
}: {
  entries: LeaderboardEntry[];
  currentPlayerName: string;
  accentHex: string;
  loading: boolean;
}) {
  const normalizedCurrent = currentPlayerName.toLowerCase().replace(/\s+/g, ' ').trim();

  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">
          Loading Leaderboard...
        </p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Trophy className="h-8 w-8 text-white/25" />
        <p className="mt-2.5 text-sm font-semibold text-white/80">No scores recorded yet</p>
        <p className="mt-1 max-w-xs text-xs text-white/50">
          Be the first on campus to set a high score before the incursion hits!
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((entry, idx) => {
        const isCurrent =
          normalizedCurrent.length > 0 &&
          entry.name.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedCurrent;
        const rank = idx + 1;
        const rankColor =
          rank === 1
            ? '#facc15'
            : rank === 2
              ? '#e2e8f0'
              : rank === 3
                ? '#fb923c'
                : 'rgba(255,255,255,0.6)';

        return (
          <li
            key={entry.id}
            style={
              isCurrent
                ? {
                    borderColor: `${accentHex}70`,
                    backgroundColor: `${accentHex}18`,
                  }
                : undefined
            }
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
              isCurrent ? '' : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-[11px] font-extrabold tabular-nums"
                style={{ color: rankColor }}
              >
                {rank <= 3 ? <Medal className="h-3.5 w-3.5" /> : rank}
              </span>

              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white sm:text-sm">
                  {entry.name}
                  {isCurrent && (
                    <span
                      className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                      style={{ backgroundColor: `${accentHex}30`, color: accentHex }}
                    >
                      You
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-white/50">
                  {entry.popped} popped · {entry.bestCombo}x max streak
                </p>
              </div>
            </div>

            <span
              className="shrink-0 font-marvel text-base font-bold tracking-wider tabular-nums sm:text-lg"
              style={{ color: rank === 1 ? '#facc15' : accentHex }}
            >
              {entry.score}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function DoomsdayGameModal({
  open,
  accentHex,
  playerName,
  entries,
  loadingLeaderboard,
  submittingScore,
  onPlayerNameChange,
  onSubmitScore,
  onRefreshLeaderboard,
  onClose,
}: DoomsdayGameModalProps) {
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [nameInput, setNameInput] = useState(playerName);
  const [nameError, setNameError] = useState('');

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestCombo, setBestCombo] = useState(1);
  const [poppedCount, setPoppedCount] = useState(0);
  const [timeLeftSec, setTimeLeftSec] = useState(ROUND_SECONDS);
  const [endReason, setEndReason] = useState<EndReason>('time');
  const [isNewBest, setIsNewBest] = useState(false);
  const [bombFlash, setBombFlash] = useState(false);

  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);
  const [popEffects, setPopEffects] = useState<PopEffect[]>([]);

  const bubblesRef = useRef<ActiveBubble[]>([]);
  const bubbleNodesRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const arenaSizeRef = useRef<{ w: number; h: number }>({ w: 420, h: 460 });
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const nextIdRef = useRef(1);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestComboRef = useRef(1);
  const poppedRef = useRef(0);
  const lastPopAtRef = useRef(0);
  const roundEndedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setPhase('lobby');
      setBombFlash(false);
      bubblesRef.current = [];
      setBubbles([]);
      setPopEffects([]);
      return;
    }

    setNameInput((prev) => (prev.trim() ? prev : playerName));
    setNameError('');
    void onRefreshLeaderboard();
  }, [open, playerName, onRefreshLeaderboard]);

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

  const finishRound = useCallback(
    async (reason: EndReason) => {
      if (roundEndedRef.current) return;
      roundEndedRef.current = true;

      setEndReason(reason);
      setPhase('gameover');
      bubblesRef.current = [];
      setBubbles([]);

      const cleanName = nameInput.replace(/\s+/g, ' ').trim();
      const result = await onSubmitScore({
        name: cleanName,
        score: scoreRef.current,
        bestCombo: bestComboRef.current,
        popped: poppedRef.current,
      });
      setIsNewBest(result.isNewBest);
    },
    [nameInput, onSubmitScore]
  );

  const startRound = useCallback(() => {
    const cleanName = nameInput.replace(/\s+/g, ' ').trim();
    if (!cleanName) {
      setNameError('Enter your name first to play and join the leaderboard.');
      return;
    }

    setNameError('');
    onPlayerNameChange(cleanName);

    roundEndedRef.current = false;
    scoreRef.current = 0;
    streakRef.current = 0;
    bestComboRef.current = 1;
    poppedRef.current = 0;
    lastPopAtRef.current = 0;
    bubblesRef.current = [];

    setScore(0);
    setStreak(0);
    setBestCombo(1);
    setPoppedCount(0);
    setTimeLeftSec(ROUND_SECONDS);
    setIsNewBest(false);
    setBombFlash(false);
    setBubbles([]);
    setPopEffects([]);
    setPhase('playing');
  }, [nameInput, onPlayerNameChange]);

  useEffect(() => {
    if (!open || phase !== 'playing') return;

    const syncArenaSize = () => {
      const el = arenaRef.current;
      if (!el) return;
      arenaSizeRef.current = {
        w: el.clientWidth || 420,
        h: el.clientHeight || 460,
      };
    };

    syncArenaSize();
    const observer =
      typeof ResizeObserver !== 'undefined' && arenaRef.current
        ? new ResizeObserver(syncArenaSize)
        : null;
    if (observer && arenaRef.current) {
      observer.observe(arenaRef.current);
    }

    let rafId = 0;
    let lastTime = performance.now();
    let elapsedMs = 0;
    let lastDisplayedSec = ROUND_SECONDS;
    let spawnAccumulatorMs = 450; // spawn first batch right away

    const spawnBubble = (progress: number) => {
      const kind = pickBubbleKind(progress);
      const meta = BUBBLE_META[kind];
      const baseSpeed = kind === 'doom' ? 19 : kind === 'bomb' ? 14.5 : 13;
      const speedRamp = 1 + progress * 0.35;
      const sizePx =
        kind === 'doom'
          ? 56 + Math.random() * 6
          : kind === 'bomb'
            ? 58 + Math.random() * 8
            : 60 + Math.random() * 10;

      const id = nextIdRef.current++;
      bubblesRef.current.push({
        id,
        kind,
        xPct: 12 + Math.random() * 76,
        yPct: 108,
        speedY: (baseSpeed + Math.random() * 5) * speedRamp,
        swayAmp: 2.6 + Math.random() * 2.6,
        swayFreq: 0.7 + Math.random() * 0.55,
        phaseOffset: Math.random() * Math.PI * 2,
        sizePx,
        points: meta.points,
      });
    };

    const tick = (now: number) => {
      if (roundEndedRef.current) return;

      const rawDtMs = now - lastTime;
      lastTime = now;
      const dtMs = document.hidden ? 0 : Math.min(50, Math.max(0, rawDtMs));
      const dtSec = dtMs / 1000;

      elapsedMs += dtMs;
      const remainingMs = Math.max(0, ROUND_DURATION_MS - elapsedMs);
      const nextSec = Math.ceil(remainingMs / 1000);
      if (nextSec !== lastDisplayedSec) {
        lastDisplayedSec = nextSec;
        setTimeLeftSec(nextSec);
      }

      if (progressBarRef.current) {
        const ratio = Math.max(0, Math.min(1, remainingMs / ROUND_DURATION_MS));
        progressBarRef.current.style.transform = `scaleX(${ratio.toFixed(4)})`;
      }

      if (remainingMs <= 0) {
        void finishRound('time');
        return;
      }

      let listChanged = false;
      const progress = Math.min(1, elapsedMs / ROUND_DURATION_MS);
      const spawnIntervalMs = 680 - progress * 220; // 680ms -> 460ms
      spawnAccumulatorMs += dtMs;

      while (spawnAccumulatorMs >= spawnIntervalMs) {
        spawnAccumulatorMs -= spawnIntervalMs;
        if (bubblesRef.current.length < 14) {
          spawnBubble(progress);
          listChanged = true;
        }
      }

      const { w: arenaW, h: arenaH } = arenaSizeRef.current;
      const alive: ActiveBubble[] = [];

      for (let i = 0; i < bubblesRef.current.length; i++) {
        const b = bubblesRef.current[i];
        b.yPct -= b.speedY * dtSec;
        if (b.yPct > -14) {
          alive.push(b);
          const node = bubbleNodesRef.current.get(b.id);
          if (node) {
            node.style.transform = getBubbleTransform(b, arenaW, arenaH);
          }
        } else {
          listChanged = true;
          bubbleNodesRef.current.delete(b.id);
        }
      }

      bubblesRef.current = alive;
      if (listChanged) {
        setBubbles([...alive]);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [open, phase, finishRound]);

  const handleBubbleTap = (bubble: ActiveBubble) => {
    if (roundEndedRef.current || phase !== 'playing') return;

    if (bubble.kind === 'bomb') {
      setBombFlash(true);
      void finishRound('bomb');
      return;
    }

    const now = performance.now();
    const withinComboWindow = lastPopAtRef.current > 0 && now - lastPopAtRef.current <= 1800;
    const nextStreak = withinComboWindow ? streakRef.current + 1 : 1;
    lastPopAtRef.current = now;
    streakRef.current = nextStreak;
    setStreak(nextStreak);

    const mult = getMultiplier(nextStreak);
    if (nextStreak > bestComboRef.current) {
      bestComboRef.current = nextStreak;
      setBestCombo(nextStreak);
    }

    const gained = bubble.points * mult;
    scoreRef.current += gained;
    poppedRef.current += 1;
    setScore(scoreRef.current);
    setPoppedCount(poppedRef.current);

    bubblesRef.current = bubblesRef.current.filter((b) => b.id !== bubble.id);
    setBubbles(bubblesRef.current);

    const popId = nextIdRef.current++;
    const meta = BUBBLE_META[bubble.kind];
    const effect: PopEffect = {
      id: popId,
      xPct: getBubbleSwayX(bubble),
      yPct: bubble.yPct,
      label: mult > 1 ? `+${gained} x${mult}` : `+${gained}`,
      color: meta.ringColor,
    };
    setPopEffects((prev) => [...prev, effect]);
    window.setTimeout(() => {
      setPopEffects((prev) => prev.filter((e) => e.id !== popId));
    }, 550);
  };

  const handleLobbySubmit = (e: FormEvent) => {
    e.preventDefault();
    startRound();
  };

  if (!open) return null;

  const mult = getMultiplier(streak);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/90 p-2.5 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`doom-hud-card relative flex h-[min(86dvh,42rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border !bg-[#050c08] !backdrop-blur-none shadow-2xl ${
          bombFlash ? 'animate-game-bomb-shake' : ''
        }`}
        style={{
          borderColor: bombFlash ? '#ef4444' : `${accentHex}55`,
          boxShadow: bombFlash ? '0 0 64px rgba(239, 68, 68, 0.45)' : `0 0 54px ${accentHex}2a`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
              style={{
                borderColor: `${accentHex}55`,
                backgroundColor: `${accentHex}1f`,
                color: accentHex,
              }}
            >
              <Gamepad2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p
                className="truncate text-[10px] font-bold tracking-[0.22em] uppercase"
                style={{ color: accentHex }}
              >
                Multiverse Arcade · 30s Blitz
              </p>
              <h2
                id="game-modal-title"
                className="truncate font-display text-sm font-bold tracking-[0.14em] text-white uppercase sm:text-base"
              >
                Doomsday Bubble Pop
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close game modal"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:border-white/40 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/75"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* LOBBY PHASE (Single unified view: Name + "Don't touch the bomb." + Leaderboard) */}
        {phase === 'lobby' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <form
              onSubmit={handleLobbySubmit}
              className="space-y-3 border-b border-white/10 px-4 py-3.5 sm:px-5"
            >
              <div>
                <label
                  htmlFor="game-player-name"
                  className="block text-[11px] font-semibold tracking-[0.16em] text-white/85 uppercase"
                >
                  Register Your Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  id="game-player-name"
                  type="text"
                  maxLength={32}
                  required
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  placeholder="Enter your name to play"
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/55 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-white/45 focus:outline-none"
                />
                {nameError && <p className="mt-1.5 text-xs font-medium text-rose-400">{nameError}</p>}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/35 bg-rose-950/35 px-3 py-2">
                  <GameBubbleIcon kind="bomb" className="h-6 w-6 shrink-0" />
                  <p className="text-xs font-semibold text-rose-200">
                    Don&apos;t touch the bomb.
                  </p>
                </div>

                <div
                  style={{
                    borderColor: `${accentHex}45`,
                    backgroundColor: `${accentHex}14`,
                  }}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2"
                >
                  <Flame className="h-5 w-5 shrink-0" style={{ color: accentHex }} />
                  <p className="text-xs font-semibold text-white/85">
                    Pop fast for <span className="font-bold text-white">2x / 3x</span> points.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  borderColor: `${accentHex}b3`,
                  backgroundColor: `${accentHex}38`,
                  boxShadow: `0 0 30px ${accentHex}3d, inset 0 0 16px ${accentHex}24`,
                }}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border px-7 py-3.5 text-sm font-extrabold tracking-[0.18em] text-white uppercase transition hover:brightness-125 sm:py-4 sm:text-base"
              >
                <Play className="h-4 w-4 fill-current sm:h-5 sm:w-5" style={{ color: accentHex }} />
                <span>Start Game</span>
              </button>
            </form>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-white/65 uppercase">
                  <Trophy className="h-3.5 w-3.5" style={{ color: accentHex }} />
                  <span>Leaderboard</span>
                </p>
                <span className="text-[10px] font-semibold tabular-nums text-white/45">
                  {entries.length} {entries.length === 1 ? 'player' : 'players'}
                </span>
              </div>
              <LeaderboardList
                entries={entries}
                currentPlayerName={nameInput}
                accentHex={accentHex}
                loading={loadingLeaderboard}
              />
            </div>
          </div>
        )}

        {/* PLAYING PHASE */}
        {phase === 'playing' && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Live HUD */}
            <div className="border-b border-white/10 bg-black/40 px-4 py-2.5 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.2em] text-white/50 uppercase">
                      Score
                    </p>
                    <p
                      className="font-marvel text-xl font-bold leading-none tabular-nums sm:text-2xl"
                      style={{ color: accentHex }}
                    >
                      {score}
                    </p>
                  </div>

                  {streak >= 2 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase"
                      style={{
                        borderColor: `${accentHex}70`,
                        backgroundColor: `${accentHex}24`,
                        color: accentHex,
                      }}
                    >
                      <Flame className="h-3 w-3" />
                      {streak} Streak {mult > 1 ? `· x${mult}` : ''}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-white/50 uppercase">
                    Time Left
                  </p>
                  <p
                    className={`font-marvel text-xl font-bold leading-none tabular-nums sm:text-2xl ${
                      timeLeftSec <= 7 ? 'text-rose-400' : 'text-white'
                    }`}
                  >
                    {timeLeftSec}s
                  </p>
                </div>
              </div>

              {/* Countdown Progress Bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  ref={progressBarRef}
                  className="h-full w-full origin-left will-change-transform"
                  style={{
                    backgroundColor: timeLeftSec <= 7 ? '#ef4444' : accentHex,
                  }}
                />
              </div>
            </div>

            {/* Bubble Arena */}
            <div
              ref={arenaRef}
              className="relative min-h-0 flex-1 touch-manipulation select-none overflow-hidden"
              style={{
                contain: 'layout style paint',
                background: `radial-gradient(circle at 50% 55%, ${accentHex}16 0%, rgba(2, 5, 3, 0.95) 75%)`,
              }}
            >
              {bubbles.map((b) => {
                const meta = BUBBLE_META[b.kind];
                const { w: arenaW, h: arenaH } = arenaSizeRef.current;

                return (
                  <button
                    key={b.id}
                    ref={(el) => {
                      if (el) {
                        const isNew = !bubbleNodesRef.current.has(b.id);
                        bubbleNodesRef.current.set(b.id, el);
                        if (isNew) {
                          el.style.transform = getBubbleTransform(b, arenaW, arenaH);
                        }
                      } else {
                        bubbleNodesRef.current.delete(b.id);
                      }
                    }}
                    type="button"
                    aria-label={meta.label}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleBubbleTap(b);
                    }}
                    style={{
                      left: 0,
                      top: 0,
                      width: `${b.sizePx}px`,
                      height: `${b.sizePx}px`,
                      borderColor: `${meta.ringColor}cc`,
                      background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.22) 0%, ${meta.bg} 56%, ${meta.ringColor}2e 100%)`,
                      boxShadow:
                        b.kind === 'bomb'
                          ? '0 0 18px rgba(239, 68, 68, 0.5), inset 0 0 12px rgba(239, 68, 68, 0.35)'
                          : `0 0 14px ${meta.ringColor}40, inset 0 0 12px rgba(255, 255, 255, 0.16)`,
                    }}
                    className={`absolute flex cursor-pointer items-center justify-center rounded-full border-2 will-change-transform ${
                      b.kind === 'bomb' ? 'animate-pulse' : ''
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-[12%] left-[18%] h-[20%] w-[34%] -rotate-25 rounded-full bg-white/30"
                    />
                    <GameBubbleIcon kind={b.kind} className="pointer-events-none h-[64%] w-[64%]" />
                  </button>
                );
              })}

              {/* Pop Effects */}
              {popEffects.map((effect) => (
                <div
                  key={effect.id}
                  style={{
                    left: `${effect.xPct}%`,
                    top: `${effect.yPct}%`,
                  }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <span
                    className="animate-game-burst-ring block h-14 w-14 rounded-full border-2 will-change-transform"
                    style={{ borderColor: effect.color }}
                  />
                  <span
                    className="animate-game-pop-text absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-marvel text-base font-bold tracking-wider will-change-transform"
                    style={{ color: effect.color, textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
                  >
                    {effect.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GAMEOVER PHASE */}
        {phase === 'gameover' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="border-b border-white/10 px-4 py-4 text-center sm:px-6"
              style={{
                background:
                  endReason === 'bomb'
                    ? 'linear-gradient(180deg, rgba(127, 29, 29, 0.35) 0%, transparent 100%)'
                    : `linear-gradient(180deg, ${accentHex}1f 0%, transparent 100%)`,
              }}
            >
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-bold tracking-[0.2em] uppercase">
                {endReason === 'bomb' ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                    <span className="text-rose-300">Red Bomb Triggered · You Lost!</span>
                  </>
                ) : (
                  <>
                    <Trophy className="h-3.5 w-3.5" style={{ color: accentHex }} />
                    <span style={{ color: accentHex }}>Time&apos;s Up · Mission Complete</span>
                  </>
                )}
              </div>

              <div className="mt-3 flex items-baseline justify-center gap-3">
                <span
                  className="font-marvel text-4xl font-bold tracking-wider tabular-nums sm:text-5xl"
                  style={{ color: endReason === 'bomb' ? '#fca5a5' : accentHex }}
                >
                  {score}
                </span>
                <span className="text-xs font-bold tracking-[0.2em] text-white/60 uppercase">
                  PTS
                </span>
              </div>

              <p className="mt-1 text-xs text-white/70">
                {nameInput.trim()} · {poppedCount} popped · {bestCombo}x max streak
                {isNewBest && (
                  <span
                    className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{ backgroundColor: `${accentHex}30`, color: accentHex }}
                  >
                    New Personal Best!
                  </span>
                )}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold tracking-[0.2em] text-white/60 uppercase">
                  Campus Leaderboard
                </p>
                {submittingScore && (
                  <span className="text-[10px] text-white/45">Syncing score...</span>
                )}
              </div>
              <LeaderboardList
                entries={entries}
                currentPlayerName={nameInput}
                accentHex={accentHex}
                loading={loadingLeaderboard}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/40 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  setBombFlash(false);
                  setPhase('lobby');
                }}
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-[11px] font-semibold tracking-[0.12em] text-white/75 uppercase transition hover:border-white/35 hover:text-white"
              >
                Change Name
              </button>

              <button
                type="button"
                onClick={startRound}
                style={{
                  borderColor: `${accentHex}99`,
                  backgroundColor: `${accentHex}33`,
                  boxShadow: `0 0 24px ${accentHex}33`,
                }}
                className="inline-flex items-center gap-1.5 rounded-full border px-5 py-2 text-xs font-bold tracking-[0.15em] text-white uppercase transition hover:brightness-125"
              >
                <RotateCcw className="h-3.5 w-3.5" style={{ color: accentHex }} />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
