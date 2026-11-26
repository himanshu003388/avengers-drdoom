import { useEffect, useRef } from 'react';
import type { AtmosphereMode } from '../utils/atmosphere';

interface DoomsdayWebGLSceneProps {
  accentHex: string;
  mode: AtmosphereMode;
  paused?: boolean;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  speed: number;
  size: number;
  alpha: number;
  phase: number;
  twinkleSpeed: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 34;
    const g = parseInt(clean[1] + clean[1], 16) || 197;
    const b = parseInt(clean[2] + clean[2], 16) || 94;
    return [r, g, b];
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [34, 197, 94];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function DoomsdayWebGLScene({ accentHex, mode, paused = false }: DoomsdayWebGLSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRgbRef = useRef<[number, number, number]>(hexToRgb(accentHex));
  const modeRef = useRef(mode);
  const pausedRef = useRef(paused);
  const resumeLoopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    targetRgbRef.current = hexToRgb(accentHex);
  }, [accentHex]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) {
      resumeLoopRef.current?.();
    }
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;
    const maxDpr = isCoarsePointer ? 1.5 : 2;
    let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    const syncSize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.imageSmoothingEnabled = false;
    };

    syncSize();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncSize) : null;
    if (resizeObserver) resizeObserver.observe(canvas);

    const currentRgb: [number, number, number] = [...targetRgbRef.current];

    const particleCount = isCoarsePointer || width < 768 ? 120 : 260;
    const particles: Particle3D[] = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 20,
      y: (Math.random() - 0.5) * 14,
      z: (Math.random() - 0.5) * 12,
      speed: 0.24 + Math.random() * 0.62,
      size: 0.72 + Math.random() * 0.78,
      alpha: 0.4 + Math.random() * 0.52,
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: 1.4 + Math.random() * 2.4,
    }));

    let pointerX = 0;
    let pointerY = 0;
    let smoothX = 0;
    let smoothY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const w = window.innerWidth || 1440;
      const h = window.innerHeight || 900;
      pointerX = (e.clientX / w - 0.5) * 2;
      pointerY = (e.clientY / h - 0.5) * 2;
    };

    if (!isCoarsePointer) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
    }
    window.addEventListener('resize', syncSize, { passive: true });

    const minFrameMs = isCoarsePointer ? 32 : 0;
    let rafId = 0;
    let lastTime = performance.now();
    let lastRenderTime = lastTime;
    let elapsed = 0;

    const drawFrame = (delta: number) => {
      elapsed += delta;
      const isSurge = modeRef.current === 'ember-surge';
      const surgeMult = isSurge ? 2.4 : 1.0;
      const surgeAlphaBoost = isSurge ? 1.18 : 1.0;

      const colorEase = 1 - Math.exp(-4.8 * delta);
      const target = targetRgbRef.current;
      currentRgb[0] += (target[0] - currentRgb[0]) * colorEase;
      currentRgb[1] += (target[1] - currentRgb[1]) * colorEase;
      currentRgb[2] += (target[2] - currentRgb[2]) * colorEase;

      const cr = Math.min(255, Math.round(currentRgb[0] * 1.08));
      const cg = Math.min(255, Math.round(currentRgb[1] * 1.12));
      const cb = Math.min(255, Math.round(currentRgb[2] * 1.05));

      const ptrEase = 1 - Math.exp(-3.8 * delta);
      smoothX += (pointerX - smoothX) * ptrEase;
      smoothY += (pointerY - smoothY) * ptrEase;

      const camX = smoothX * 0.75;
      const camY = 0.2 - smoothY * 0.45;
      const camZ = 11.5;
      const rotY = elapsed * 0.025 + smoothX * 0.08;
      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);
      const focal = Math.min(width, height) * 0.92;
      const cx = width * 0.5;
      const cy = height * 0.5;

      // Draw directly in snapped physical device pixels for razor-sharp square edges
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += delta * p.speed * surgeMult;
        if (p.y > 7) p.y = -7;

        const rx = p.x * cosR - p.z * sinR;
        const rz = p.x * sinR + p.z * cosR;
        const dz = camZ - rz;
        if (dz <= 1.2) continue;

        const perspective = focal / dz;
        const sx = cx + (rx - camX) * perspective;
        const sy = cy - (p.y - camY) * perspective;

        if (sx < -12 || sx > width + 12 || sy < -12 || sy > height + 12) continue;

        const depthFade = Math.max(0, Math.min(1, 1 - (dz - 4) / 16));
        const twinkle = 0.72 + 0.28 * Math.sin(elapsed * p.twinkleSpeed + p.phase);
        const depthScale = 11.5 / dz;
        const sizeCss = Math.max(1.5, Math.min(3.25, p.size * depthScale * 1.4));
        const sizePx = Math.max(2, Math.round(sizeCss * dpr));
        const px = Math.round(sx * dpr - sizePx * 0.5);
        const py = Math.round(sy * dpr - sizePx * 0.5);

        ctx.globalAlpha = Math.min(1, p.alpha * depthFade * twinkle * surgeAlphaBoost);
        ctx.fillRect(px, py, sizePx, sizePx);
      }

      ctx.restore();
    };

    if (prefersReducedMotion) {
      drawFrame(0);
    } else {
      const tick = (now: number) => {
        if (document.hidden || pausedRef.current) {
          rafId = 0;
          return;
        }
        if (minFrameMs > 0 && now - lastRenderTime < minFrameMs) {
          lastTime = now;
          rafId = window.requestAnimationFrame(tick);
          return;
        }
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        lastRenderTime = now;
        drawFrame(dt);
        rafId = window.requestAnimationFrame(tick);
      };

      const onVisibilityChange = () => {
        if (!document.hidden && !pausedRef.current && !rafId) {
          lastTime = performance.now();
          lastRenderTime = lastTime;
          rafId = window.requestAnimationFrame(tick);
        }
      };
      resumeLoopRef.current = onVisibilityChange;

      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('pageshow', onVisibilityChange);
      if (!pausedRef.current) {
        rafId = window.requestAnimationFrame(tick);
      }

      return () => {
        resumeLoopRef.current = null;
        window.cancelAnimationFrame(rafId);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pageshow', onVisibilityChange);
        if (!isCoarsePointer) {
          window.removeEventListener('pointermove', handlePointerMove);
        }
        window.removeEventListener('resize', syncSize);
        if (resizeObserver) resizeObserver.disconnect();
      };
    }

    return () => {
      if (!isCoarsePointer) {
        window.removeEventListener('pointermove', handlePointerMove);
      }
      window.removeEventListener('resize', syncSize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      data-testid="webgl-3d-stage"
      className="pointer-events-none fixed inset-0 z-[11]"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
