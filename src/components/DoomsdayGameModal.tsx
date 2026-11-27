import {
  Crown,
  Flame,
  Gamepad2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Target,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import type { BubbleKind, LeaderboardEntry } from '../types/game';
import { normalizeNameKey, sanitizeText } from '../utils/common';
import { GameBubbleIcon } from './GameBubbleIcons';
import { LeaderboardList } from './LeaderboardList';

interface DoomsdayGameModalProps {
  open: boolean;
  accentHex: string;
  characterName?: string;
  characterFaction?: string;
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

const TARGET_INTEL_ORDER: BubbleKind[] = ['avengers', 'thor', 'ironman', 'doom', 'bomb'];

const BUBBLE_META: Record<
  BubbleKind,
  { label: string; shortLabel: string; points: number; ringColor: string; bg: string; badge: string }
> = {
  avengers: {
    label: 'Avengers',
    shortLabel: 'Avengers',
    points: 10,
    ringColor: '#60a5fa',
    bg: 'rgba(30, 58, 138, 0.42)',
    badge: '+10',
  },
  thor: {
    label: "Thor's Hammer",
    shortLabel: 'Mjolnir',
    points: 15,
    ringColor: '#facc15',
    bg: 'rgba(133, 77, 14, 0.42)',
    badge: '+15',
  },
  ironman: {
    label: 'Iron Man',
    shortLabel: 'Iron Man',
    points: 20,
    ringColor: '#f59e0b',
    bg: 'rgba(153, 27, 27, 0.44)',
    badge: '+20',
  },
  doom: {
    label: 'Doctor Doom',
    shortLabel: 'Doom',
    points: 50,
    ringColor: '#22c55e',
    bg: 'rgba(20, 83, 45, 0.52)',
    badge: '+50',
  },
  bomb: {
    label: 'Red Bomb — Instant Loss',
    shortLabel: 'Bomb',
    points: 0,
    ringColor: '#ef4444',
    bg: 'rgba(127, 29, 29, 0.62)',
    badge: 'KO',
  },
};

function pickBubbleKind(progress: number): BubbleKind {
  const bombChance = 0.14 + progress * 0.12; // 14% -> 26% as round heats up
  if (Math.random() < bombChance) return 'bomb';

  const heroRoll = Math.random();
  if (heroRoll < 0.12) return 'doom';
  if (heroRoll < 0.36) return 'ironman';
  if (heroRoll < 0.66) return 'thor';
  return 'avengers';
}

function pickSpawnXPct(existing: ActiveBubble[]): number {
  let bestX = 12 + Math.random() * 76;
  let bestClearance = -1;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = 12 + Math.random() * 76;
    let minGap = 100;
    for (let i = 0; i < existing.length; i++) {
      const b = existing[i];
      if (b.yPct > 84) {
        const gap = Math.abs(b.xPct - candidate);
        if (gap < minGap) minGap = gap;
      }
    }
    if (minGap >= 18) return candidate;
    if (minGap > bestClearance) {
      bestClearance = minGap;
      bestX = candidate;
    }
  }
  return bestX;
}

function getBubbleSwayX(b: ActiveBubble): number {
  const sway = Math.sin((108 - b.yPct) * 0.034 * b.swayFreq + b.phaseOffset) * b.swayAmp;
  return Math.max(9, Math.min(91, b.xPct + sway));
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

function getMissionGrade(score: number, reason: EndReason): { grade: string; label: string } {
  if (reason === 'bomb') return { grade: 'KO', label: 'Detonated' };
  if (score >= 700) return { grade: 'S', label: 'Omega Tier' };
  if (score >= 420) return { grade: 'A', label: 'Avenger Elite' };
  if (score >= 200) return { grade: 'B', label: 'Field Agent' };
  return { grade: 'C', label: 'Recruit' };
}

function TacticalCorners({ color }: { color: string }) {
  const borderStyle = { borderColor: `${color}88` };
  return (
    <>
      <span
        aria-hidden="true"
        style={borderStyle}
        className="pointer-events-none absolute top-2 left-2 z-20 h-3 w-3 rounded-tl-[2px] border-t-2 border-l-2"
      />
      <span
        aria-hidden="true"
        style={borderStyle}
        className="pointer-events-none absolute top-2 right-2 z-20 h-3 w-3 rounded-tr-[2px] border-t-2 border-r-2"
      />
      <span
        aria-hidden="true"
        style={borderStyle}
        className="pointer-events-none absolute bottom-2 left-2 z-20 h-3 w-3 rounded-bl-[2px] border-b-2 border-l-2"
      />
      <span
        aria-hidden="true"
        style={borderStyle}
        className="pointer-events-none absolute right-2 bottom-2 z-20 h-3 w-3 rounded-br-[2px] border-r-2 border-b-2"
      />
    </>
  );
}

export function DoomsdayGameModal({
  open,
  accentHex,
  characterName = 'Doctor Doom',
  characterFaction = 'Latveria',
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

  const panelRef = useRef<HTMLDivElement | null>(null);
  const bubblesRef = useRef<ActiveBubble[]>([]);
  const activeBubbleIdsRef = useRef<Set<number>>(new Set());
  const bubbleNodesRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const popTimersRef = useRef<Set<number>>(new Set());
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
  const roundIdRef = useRef(0);
  const wasOpenRef = useRef(false);

  useModalBehavior(open, onClose, panelRef);

  const clearPopTimers = useCallback(() => {
    for (const timerId of popTimersRef.current) {
      window.clearTimeout(timerId);
    }
    popTimersRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      clearPopTimers();
    };
  }, [clearPopTimers]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (!open) {
      roundIdRef.current += 1;
      clearPopTimers();
      setPhase('lobby');
      setBombFlash(false);
      bubblesRef.current = [];
      activeBubbleIdsRef.current.clear();
      setBubbles([]);
      setPopEffects([]);
      return;
    }

    if (!wasOpen) {
      setNameError('');
      setNameInput((prev) => (prev.trim() ? prev : playerName));
    }
  }, [open, playerName, clearPopTimers]);

  const finishRound = useCallback(
    async (reason: EndReason) => {
      if (roundEndedRef.current) return;
      roundEndedRef.current = true;
      const completedRoundId = roundIdRef.current;

      setEndReason(reason);
      setPhase('gameover');
      bubblesRef.current = [];
      activeBubbleIdsRef.current.clear();
      setBubbles([]);

      const cleanName = sanitizeText(nameInput, 32);
      const result = await onSubmitScore({
        name: cleanName,
        score: scoreRef.current,
        bestCombo: bestComboRef.current,
        popped: poppedRef.current,
      });
      if (roundIdRef.current === completedRoundId) {
        setIsNewBest(result.isNewBest);
      }
    },
    [nameInput, onSubmitScore]
  );

  const startRound = useCallback(() => {
    const cleanName = sanitizeText(nameInput, 32);
    if (!cleanName) {
      setNameError('Enter your callsign first to play and join the leaderboard.');
      return;
    }

    setNameError('');
    onPlayerNameChange(cleanName);

    clearPopTimers();
    roundIdRef.current += 1;
    roundEndedRef.current = false;
    scoreRef.current = 0;
    streakRef.current = 0;
    bestComboRef.current = 1;
    poppedRef.current = 0;
    lastPopAtRef.current = 0;
    bubblesRef.current = [];
    activeBubbleIdsRef.current.clear();

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
  }, [nameInput, onPlayerNameChange, clearPopTimers]);

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
      activeBubbleIdsRef.current.add(id);
      bubblesRef.current.push({
        id,
        kind,
        xPct: pickSpawnXPct(bubblesRef.current),
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
      if (roundEndedRef.current) {
        rafId = 0;
        return;
      }
      if (document.hidden) {
        rafId = 0;
        return;
      }

      const rawDtMs = now - lastTime;
      lastTime = now;
      const dtMs = Math.min(50, Math.max(0, rawDtMs));
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
          activeBubbleIdsRef.current.delete(b.id);
          bubbleNodesRef.current.delete(b.id);
        }
      }

      bubblesRef.current = alive;
      if (listChanged) {
        setBubbles([...alive]);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !roundEndedRef.current && !rafId) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer?.disconnect();
    };
  }, [open, phase, finishRound]);

  const handleBubbleTap = (bubble: ActiveBubble) => {
    if (roundEndedRef.current || phase !== 'playing') return;
    if (!activeBubbleIdsRef.current.has(bubble.id)) return;
    activeBubbleIdsRef.current.delete(bubble.id);

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

    bubbleNodesRef.current.delete(bubble.id);
    bubblesRef.current = bubblesRef.current.filter((b) => b.id !== bubble.id);
    setBubbles(bubblesRef.current);

    const popId = nextIdRef.current++;
    const meta = BUBBLE_META[bubble.kind];
    const effect: PopEffect = {
      id: popId,
      xPct: getBubbleSwayX(bubble),
      yPct: bubble.yPct,
      label: mult > 1 ? `+${gained} ×${mult}` : `+${gained}`,
      color: meta.ringColor,
    };
    setPopEffects((prev) => [...prev.slice(-10), effect]);
    const timerId = window.setTimeout(() => {
      popTimersRef.current.delete(timerId);
      setPopEffects((prev) => prev.filter((e) => e.id !== popId));
    }, 550);
    popTimersRef.current.add(timerId);
  };

  const handleLobbySubmit = (e: FormEvent) => {
    e.preventDefault();
    startRound();
  };

  if (!open) return null;

  const mult = getMultiplier(streak);
  const topScore = entries.length > 0 ? entries[0].score : 0;
  const normalizedName = normalizeNameKey(nameInput);
  const playerRankIndex = normalizedName
    ? entries.findIndex((entry) => normalizeNameKey(entry.name) === normalizedName)
    : -1;
  const missionGrade = getMissionGrade(score, endReason);
  const isUrgentTime = timeLeftSec <= 7;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-modal-title"
      className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/90 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`animate-modal-panel doom-hud-card relative flex h-[min(90dvh,45rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border !bg-[#040906] !backdrop-blur-none shadow-2xl transition-colors duration-300 focus:outline-none ${
          bombFlash ? 'animate-game-bomb-shake' : ''
        }`}
        style={{
          borderColor: bombFlash ? '#ef4444' : `${accentHex}59`,
          boxShadow: bombFlash
            ? '0 0 64px rgba(239, 68, 68, 0.45)'
            : `0 0 58px ${accentHex}28, inset 0 1px 0 ${accentHex}24`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Dossier Energy Beam */}
        <div
          aria-hidden="true"
          className="h-[2px] w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${
              bombFlash ? '#ef4444' : accentHex
            } 50%, transparent 100%)`,
          }}
        />

        {/* Tactical Arcade Header */}
        <div
          className="relative flex items-center justify-between gap-2.5 border-b border-white/10 px-3.5 py-2.5 sm:px-5 sm:py-3"
          style={{
            background: `linear-gradient(180deg, ${accentHex}14 0%, rgba(4, 9, 6, 0.2) 100%)`,
          }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
              style={{
                borderColor: `${accentHex}66`,
                backgroundColor: `${accentHex}1a`,
                color: accentHex,
                boxShadow: `0 0 16px ${accentHex}24`,
              }}
            >
              <Gamepad2 className="h-4.5 w-4.5" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="motion-reduce:animate-none inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
                  style={{ backgroundColor: accentHex, boxShadow: `0 0 8px ${accentHex}` }}
                />
                <p
                  className="truncate text-[9.5px] font-bold tracking-[0.2em] uppercase sm:text-[10px]"
                  style={{ color: accentHex }}
                >
                  {characterFaction} · {characterName} Protocol
                </p>
              </div>
              <h2
                id="game-modal-title"
                className="truncate font-display text-sm font-bold tracking-[0.14em] text-white uppercase sm:text-base"
              >
                Doomsday Bubble Pop
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {phase === 'lobby' && topScore > 0 && (
              <span
                className="hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] uppercase sm:inline-flex"
                style={{
                  borderColor: 'rgba(250, 204, 21, 0.35)',
                  backgroundColor: 'rgba(250, 204, 21, 0.1)',
                  color: '#fde047',
                }}
              >
                <Crown className="h-3 w-3" aria-hidden="true" />
                Top: {topScore}
              </span>
            )}

            {phase === 'playing' && (
              <span
                className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase sm:inline-flex"
                style={{
                  borderColor: `${accentHex}45`,
                  backgroundColor: `${accentHex}14`,
                  color: accentHex,
                }}
              >
                <Target className="h-3 w-3" aria-hidden="true" />
                <span className="max-w-[8rem] truncate text-white">{nameInput.trim()}</span>
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close game modal"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:border-white/40 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/75"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* LOBBY PHASE */}
        {phase === 'lobby' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <form
              onSubmit={handleLobbySubmit}
              className="space-y-3 border-b border-white/10 px-3.5 py-3 sm:px-5 sm:py-3.5"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${accentHex}12 0%, transparent 72%)`,
              }}
            >
              {/* Target Intel Strip */}
              <div className="rounded-xl border border-white/10 bg-[#060f0a] p-2.5 sm:p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.18em] text-white/75 uppercase">
                    <Target className="h-3 w-3" style={{ color: accentHex }} aria-hidden="true" />
                    Target Intel · 30s Blitz
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[9.5px] font-bold tracking-[0.12em] uppercase"
                    style={{ color: accentHex }}
                  >
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    Fast Chain = 2x / 3x
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {TARGET_INTEL_ORDER.map((kind) => {
                    const meta = BUBBLE_META[kind];
                    const isBomb = kind === 'bomb';
                    return (
                      <div
                        key={kind}
                        className="flex flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center"
                        style={{
                          borderColor: isBomb ? 'rgba(239, 68, 68, 0.45)' : `${meta.ringColor}3d`,
                          backgroundColor: isBomb ? 'rgba(127, 29, 29, 0.25)' : 'rgba(255, 255, 255, 0.025)',
                        }}
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full border sm:h-9 sm:w-9"
                          style={{
                            borderColor: `${meta.ringColor}aa`,
                            background: meta.bg,
                          }}
                        >
                          <GameBubbleIcon kind={kind} className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
                        </div>
                        <span className="mt-1 truncate text-[9px] font-semibold text-white/80">
                          {meta.shortLabel}
                        </span>
                        <span
                          className="font-marvel text-xs font-bold tracking-wider"
                          style={{ color: isBomb ? '#fca5a5' : meta.ringColor }}
                        >
                          {meta.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Callsign Input + Arcade Launch */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="game-player-name"
                    className="flex items-center justify-between text-[10px] font-bold tracking-[0.18em] text-white/85 uppercase"
                  >
                    <span>
                      Agent Callsign <span style={{ color: accentHex }}>*</span>
                    </span>
                    <span className="font-normal tracking-normal text-rose-300/90 normal-case">
                      Avoid Red Bombs
                    </span>
                  </label>
                  <input
                    id="game-player-name"
                    type="text"
                    maxLength={32}
                    required
                    value={nameInput}
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? 'game-name-error' : undefined}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    placeholder="Enter your name to deploy"
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-white/50 transition focus:border-white/45 focus:outline-none"
                    style={{
                      borderColor: nameInput.trim() ? `${accentHex}55` : undefined,
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    borderColor: `${accentHex}cc`,
                    background: `linear-gradient(135deg, ${accentHex}4d 0%, ${accentHex}24 100%)`,
                    boxShadow: `0 0 28px ${accentHex}38, inset 0 1px 0 rgba(255,255,255,0.2)`,
                  }}
                  className="group relative inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl border px-6 py-2.5 text-xs font-extrabold tracking-[0.18em] text-white uppercase transition hover:brightness-125 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-white/75 sm:px-7 sm:text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="animate-play-btn-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  />
                  <Play
                    aria-hidden="true"
                    className="relative h-4 w-4 fill-current transition-transform duration-200 group-hover:scale-110"
                    style={{ color: accentHex }}
                  />
                  <span className="relative">Launch Game</span>
                </button>
              </div>
              {nameError && (
                <p id="game-name-error" role="alert" className="text-xs font-medium text-rose-400">
                  {nameError}
                </p>
              )}
            </form>

            {/* Hall of Heroes Leaderboard */}
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto scroll-smooth px-3.5 py-3 sm:px-5">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase">
                  <Trophy className="h-3.5 w-3.5" style={{ color: accentHex }} aria-hidden="true" />
                  <span>Hall of Heroes · Leaderboard</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/70">
                    {entries.length} {entries.length === 1 ? 'agent' : 'agents'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void onRefreshLeaderboard();
                    }}
                    disabled={loadingLeaderboard}
                    aria-label="Refresh leaderboard"
                    title="Refresh leaderboard"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:border-white/35 hover:text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-white/75"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${loadingLeaderboard ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
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
            {/* Live Tactical HUD */}
            <div className="border-b border-white/10 bg-[#050c08] px-3.5 py-2.5 sm:px-5">
              <div className="grid grid-cols-3 items-center gap-2">
                {/* Score & Pops */}
                <div className="text-left">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-white/60 uppercase">
                    Score · {poppedCount} pops
                  </p>
                  <p
                    className="font-marvel text-2xl font-bold leading-none tabular-nums sm:text-3xl"
                    style={{
                      color: accentHex,
                      textShadow: `0 0 18px ${accentHex}44`,
                    }}
                  >
                    {score}
                  </p>
                </div>

                {/* Center Combo Multiplier Gauge */}
                <div className="flex flex-col items-center justify-center">
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-[0.14em] uppercase transition-colors duration-150 sm:text-[11px]"
                    style={
                      mult > 1
                        ? {
                            borderColor: mult === 3 ? '#facc15' : accentHex,
                            backgroundColor:
                              mult === 3 ? 'rgba(250, 204, 21, 0.2)' : `${accentHex}28`,
                            color: mult === 3 ? '#fde047' : accentHex,
                            boxShadow:
                              mult === 3
                                ? '0 0 16px rgba(250, 204, 21, 0.35)'
                                : `0 0 14px ${accentHex}30`,
                          }
                        : {
                            borderColor: 'rgba(255,255,255,0.12)',
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            color: 'rgba(255,255,255,0.68)',
                          }
                    }
                  >
                    <Flame className="h-3 w-3" aria-hidden="true" />
                    <span>
                      {mult === 3
                        ? '3X OVERDRIVE'
                        : mult === 2
                          ? '2X COMBO'
                          : streak >= 2
                            ? `${streak} STREAK`
                            : '1X READY'}
                    </span>
                  </span>
                </div>

                {/* Countdown Timer */}
                <div className="text-right">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-white/60 uppercase">
                    Time Left
                  </p>
                  <p
                    className={`font-marvel text-2xl font-bold leading-none tabular-nums sm:text-3xl ${
                      isUrgentTime ? 'motion-reduce:animate-none animate-pulse text-rose-400' : 'text-white'
                    }`}
                  >
                    {timeLeftSec}s
                  </p>
                </div>
              </div>

              {/* Energy Countdown Track */}
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/60 p-[1px]">
                <div
                  ref={progressBarRef}
                  className="h-full w-full origin-left rounded-full will-change-transform"
                  style={{
                    backgroundColor: isUrgentTime ? '#ef4444' : accentHex,
                    boxShadow: `0 0 10px ${isUrgentTime ? '#ef4444' : accentHex}`,
                  }}
                />
              </div>
            </div>

            {/* Tactical Bubble Arena (Zero blur, GPU transform-only updates) */}
            <div
              ref={arenaRef}
              className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
              style={{
                contain: 'layout style paint',
                backgroundColor: '#030705',
                backgroundImage: `
                  radial-gradient(circle at 50% 52%, ${accentHex}1c 0%, rgba(3, 7, 5, 0.94) 74%),
                  linear-gradient(to right, ${accentHex}0d 1px, transparent 1px),
                  linear-gradient(to bottom, ${accentHex}0d 1px, transparent 1px)
                `,
                backgroundSize: '100% 100%, 36px 36px, 36px 36px',
              }}
            >
              <TacticalCorners color={accentHex} />

              {/* Subtle static targeting reticle in background */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border sm:h-64 sm:w-64"
                style={{ borderColor: `${accentHex}18` }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed sm:h-36 sm:w-36"
                style={{ borderColor: `${accentHex}22` }}
              />

              {bubbles.map((b) => {
                const meta = BUBBLE_META[b.kind];
                const { w: arenaW, h: arenaH } = arenaSizeRef.current;
                const isBomb = b.kind === 'bomb';
                const isDoom = b.kind === 'doom';

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
                    onClick={(e) => {
                      // Support keyboard Enter/Space activation (e.detail === 0) without double-firing pointer taps
                      if (e.detail === 0) {
                        handleBubbleTap(b);
                      }
                    }}
                    style={{
                      left: 0,
                      top: 0,
                      width: `${b.sizePx}px`,
                      height: `${b.sizePx}px`,
                      borderColor: isBomb ? '#ef4444' : `${meta.ringColor}dd`,
                      background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.28) 0%, ${meta.bg} 56%, ${meta.ringColor}36 100%)`,
                      boxShadow: isBomb
                        ? '0 0 18px rgba(239, 68, 68, 0.55), inset 0 0 12px rgba(239, 68, 68, 0.4)'
                        : isDoom
                          ? '0 0 20px rgba(34, 197, 94, 0.5), inset 0 0 12px rgba(134, 239, 172, 0.28)'
                          : `0 0 14px ${meta.ringColor}45, inset 0 0 10px rgba(255, 255, 255, 0.16)`,
                    }}
                    className={`absolute flex cursor-pointer items-center justify-center rounded-full border-2 will-change-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-white ${
                      isBomb ? 'motion-reduce:animate-none animate-pulse' : ''
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-[11%] left-[18%] h-[20%] w-[34%] -rotate-25 rounded-full bg-white/30"
                    />
                    <GameBubbleIcon kind={b.kind} className="pointer-events-none h-[64%] w-[64%]" />
                  </button>
                );
              })}

              {/* Pop Effects */}
              {popEffects.map((effect) => (
                <div
                  key={effect.id}
                  aria-hidden="true"
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
                    className="animate-game-pop-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-marvel text-lg font-bold tracking-wider will-change-transform"
                    style={{ color: effect.color, textShadow: '0 2px 6px rgba(0,0,0,0.96)' }}
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
              role="status"
              className="border-b border-white/10 px-4 py-3.5 text-center sm:px-6 sm:py-4"
              style={{
                background:
                  endReason === 'bomb'
                    ? 'linear-gradient(180deg, rgba(127, 29, 29, 0.42) 0%, rgba(4, 9, 6, 0.2) 100%)'
                    : `linear-gradient(180deg, ${accentHex}24 0%, rgba(4, 9, 6, 0.2) 100%)`,
              }}
            >
              <div
                className="inline-flex items-center gap-1.5 rounded-full border bg-black/50 px-3 py-1 text-[10px] font-bold tracking-[0.2em] uppercase"
                style={{
                  borderColor:
                    endReason === 'bomb' ? 'rgba(248, 113, 113, 0.45)' : `${accentHex}55`,
                }}
              >
                {endReason === 'bomb' ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                    <span className="text-rose-300">Incursion Detonated · Mission Failed</span>
                  </>
                ) : (
                  <>
                    <Trophy className="h-3.5 w-3.5" style={{ color: accentHex }} aria-hidden="true" />
                    <span style={{ color: accentHex }}>Mission Complete · {missionGrade.label}</span>
                  </>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-center gap-3">
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-marvel text-4xl font-bold leading-none tracking-wider tabular-nums sm:text-5xl"
                    style={{
                      color: endReason === 'bomb' ? '#fca5a5' : accentHex,
                      textShadow:
                        endReason === 'bomb'
                          ? '0 0 24px rgba(239, 68, 68, 0.35)'
                          : `0 0 24px ${accentHex}44`,
                    }}
                  >
                    {score}
                  </span>
                  <span className="text-xs font-bold tracking-[0.2em] text-white/65 uppercase">
                    PTS
                  </span>
                </div>

                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl border font-marvel text-lg font-bold tracking-wider"
                  style={{
                    borderColor:
                      endReason === 'bomb' ? 'rgba(248, 113, 113, 0.5)' : `${accentHex}70`,
                    backgroundColor:
                      endReason === 'bomb' ? 'rgba(127, 29, 29, 0.4)' : `${accentHex}20`,
                    color: endReason === 'bomb' ? '#fca5a5' : accentHex,
                  }}
                  title={`Mission Rank: ${missionGrade.label}`}
                >
                  {missionGrade.grade}
                </span>
              </div>

              {isNewBest && score > 0 && (
                <div className="mt-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.14em] uppercase"
                    style={{
                      borderColor: `${accentHex}70`,
                      backgroundColor: `${accentHex}26`,
                      color: accentHex,
                    }}
                  >
                    <Crown className="h-3 w-3" aria-hidden="true" />
                    New Personal Best!
                  </span>
                </div>
              )}

              {/* 3-Stat Debrief Grid */}
              <div className="mx-auto mt-3 grid max-w-md grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/10 bg-black/45 px-2 py-1.5">
                  <p className="text-[9px] font-bold tracking-[0.15em] text-white/60 uppercase">
                    Popped
                  </p>
                  <p className="font-marvel text-lg font-bold text-white tabular-nums">
                    {poppedCount}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/45 px-2 py-1.5">
                  <p className="text-[9px] font-bold tracking-[0.15em] text-white/60 uppercase">
                    Max Streak
                  </p>
                  <p className="font-marvel text-lg font-bold text-white tabular-nums">
                    {bestCombo}x
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/45 px-2 py-1.5">
                  <p className="text-[9px] font-bold tracking-[0.15em] text-white/60 uppercase">
                    Board Rank
                  </p>
                  <p
                    className="font-marvel text-lg font-bold tabular-nums"
                    style={{ color: accentHex }}
                  >
                    {playerRankIndex >= 0 ? `#${playerRankIndex + 1}` : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto scroll-smooth px-3.5 py-3 sm:px-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase">
                  <Trophy className="h-3.5 w-3.5" style={{ color: accentHex }} aria-hidden="true" />
                  <span>
                    Campus Leaderboard · {entries.length}{' '}
                    {entries.length === 1 ? 'agent' : 'agents'}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  {submittingScore && (
                    <span className="text-[10px] text-white/60">Syncing score...</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void onRefreshLeaderboard();
                    }}
                    disabled={loadingLeaderboard}
                    aria-label="Refresh leaderboard"
                    title="Refresh leaderboard"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:border-white/35 hover:text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-white/75"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${loadingLeaderboard ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
              <LeaderboardList
                entries={entries}
                currentPlayerName={nameInput}
                accentHex={accentHex}
                loading={loadingLeaderboard}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/45 px-3.5 py-2.5 sm:px-5 sm:py-3">
              <button
                type="button"
                onClick={() => {
                  setBombFlash(false);
                  setPhase('lobby');
                }}
                className="min-h-[40px] rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-white/85 uppercase transition hover:border-white/35 hover:text-white focus-visible:outline-2 focus-visible:outline-white/75"
              >
                Change Callsign
              </button>

              <button
                type="button"
                onClick={startRound}
                style={{
                  borderColor: `${accentHex}cc`,
                  background: `linear-gradient(135deg, ${accentHex}45 0%, ${accentHex}22 100%)`,
                  boxShadow: `0 0 24px ${accentHex}36`,
                }}
                className="relative inline-flex min-h-[40px] items-center gap-1.5 overflow-hidden rounded-full border px-5 py-2 text-xs font-extrabold tracking-[0.16em] text-white uppercase transition hover:brightness-125 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-white/75"
              >
                <span
                  aria-hidden="true"
                  className="animate-play-btn-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                />
                <RotateCcw className="relative h-3.5 w-3.5" style={{ color: accentHex }} aria-hidden="true" />
                <span className="relative">Play Again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
