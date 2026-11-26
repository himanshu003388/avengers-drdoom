import { useEffect, useRef } from 'react';

interface FluidNode {
  x: number;
  y: number;
}

const NODE_COUNT = 12;
const BLOB_SEGMENTS = 28;

export function CinematicOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    if (prefersReduced || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const syncSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncSize();
    window.addEventListener('resize', syncSize, { passive: true });

    const nodes: FluidNode[] = Array.from({ length: NODE_COUNT }, () => ({
      x: -200,
      y: -200,
    }));

    let hasInitialized = false;
    let isActive = false;
    let isTouch = false;
    let isHoveringInteractive = false;

    let targetX = -200;
    let targetY = -200;
    let smoothVx = 0;
    let smoothVy = 0;
    let opacity = 0;
    let hoverMix = 0;

    const activateAt = (x: number, y: number, pointerType: string, target: EventTarget | null) => {
      targetX = x;
      targetY = y;
      isTouch = pointerType === 'touch';
      isActive = true;

      if (!hasInitialized) {
        hasInitialized = true;
        for (let i = 0; i < NODE_COUNT; i++) {
          nodes[i].x = x;
          nodes[i].y = y;
        }
      }

      if (!isTouch && target instanceof Element) {
        isHoveringInteractive = Boolean(target.closest('a, button, [role="button"]'));
      } else {
        isHoveringInteractive = false;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      activateAt(e.clientX, e.clientY, e.pointerType, e.target);
    };

    const onPointerMove = (e: PointerEvent) => {
      activateAt(e.clientX, e.clientY, e.pointerType, e.target);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        isActive = false;
      }
    };

    const onPointerLeave = () => {
      isActive = false;
      isHoveringInteractive = false;
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', onPointerLeave);

    let rafId = 0;
    let lastTime = performance.now();

    const drawSmoothClosedLoop = (points: { x: number; y: number }[]) => {
      const len = points.length;
      if (len < 3) return;
      const firstMidX = (points[len - 1].x + points[0].x) * 0.5;
      const firstMidY = (points[len - 1].y + points[0].y) * 0.5;
      ctx.beginPath();
      ctx.moveTo(firstMidX, firstMidY);
      for (let i = 0; i < len; i++) {
        const curr = points[i];
        const next = points[(i + 1) % len];
        const midX = (curr.x + next.x) * 0.5;
        const midY = (curr.y + next.y) * 0.5;
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      ctx.closePath();
    };

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const time = now * 0.001;

      const targetOpacity = isActive ? 1 : 0;
      const opacityRate = 1 - Math.exp(-(isActive ? 14 : 6) * dt);
      opacity += (targetOpacity - opacity) * opacityRate;

      const hoverRate = 1 - Math.exp(-10 * dt);
      hoverMix += ((isHoveringInteractive ? 1 : 0) - hoverMix) * hoverRate;

      if (hasInitialized) {
        const prevX = nodes[0].x;
        const prevY = nodes[0].y;
        const headFollow = 1 - Math.exp(-22 * dt);
        nodes[0].x += (targetX - nodes[0].x) * headFollow;
        nodes[0].y += (targetY - nodes[0].y) * headFollow;

        const instVx = (nodes[0].x - prevX) / Math.max(dt, 0.001);
        const instVy = (nodes[0].y - prevY) / Math.max(dt, 0.001);
        const velSmooth = 1 - Math.exp(-14 * dt);
        smoothVx += (instVx - smoothVx) * velSmooth;
        smoothVy += (instVy - smoothVy) * velSmooth;

        for (let i = 1; i < NODE_COUNT; i++) {
          const prev = nodes[i - 1];
          const curr = nodes[i];
          const lagRate = 1 - Math.exp(-(24 - i * 1.15) * dt);
          curr.x += (prev.x - curr.x) * lagRate;
          curr.y += (prev.y - curr.y) * lagRate;
        }
      }

      ctx.clearRect(0, 0, width, height);

      if (opacity > 0.01 && hasInitialized) {
        const speed = Math.hypot(smoothVx, smoothVy);
        const moveAngle = Math.atan2(smoothVy, smoothVx);
        const speedNorm = Math.min(speed / 1300, 1);

        const baseRadius = (isTouch ? 18 : 13.5) + hoverMix * 8.5;
        const head = nodes[0];
        const tail = nodes[NODE_COUNT - 1];

        // 1. Flowing viscous tail ribbon
        const leftPts: { x: number; y: number }[] = [];
        const rightPts: { x: number; y: number }[] = [];

        for (let i = 0; i < NODE_COUNT; i++) {
          const curr = nodes[i];
          const next = nodes[Math.min(i + 1, NODE_COUNT - 1)];
          const prev = nodes[Math.max(i - 1, 0)];
          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          const t = i / (NODE_COUNT - 1);
          const taper = Math.pow(1 - t, 1.35);
          const r = baseRadius * 0.82 * taper;

          leftPts.push({ x: curr.x + nx * r, y: curr.y + ny * r });
          rightPts.push({ x: curr.x - nx * r, y: curr.y - ny * r });
        }

        const tailDist = Math.hypot(head.x - tail.x, head.y - tail.y);
        if (tailDist > 1.5) {
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.beginPath();
          ctx.moveTo(leftPts[0].x, leftPts[0].y);
          for (let i = 1; i < leftPts.length; i++) {
            const prev = leftPts[i - 1];
            const curr = leftPts[i];
            ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) * 0.5, (prev.y + curr.y) * 0.5);
          }
          ctx.lineTo(tail.x, tail.y);
          for (let i = rightPts.length - 1; i >= 1; i--) {
            const curr = rightPts[i];
            const prev = rightPts[i - 1];
            ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + prev.x) * 0.5, (curr.y + prev.y) * 0.5);
          }
          ctx.closePath();

          const tailGrad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
          tailGrad.addColorStop(0, `rgba(74, 222, 128, ${0.32 + hoverMix * 0.16})`);
          tailGrad.addColorStop(0.55, 'rgba(34, 197, 94, 0.14)');
          tailGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
          ctx.fillStyle = tailGrad;
          ctx.fill();
          ctx.restore();
        }

        // 2. Organic liquid head droplet with velocity stretch & surface-tension ripples
        const blobPts: { x: number; y: number }[] = [];
        const wobbleAmp = 0.055 + speedNorm * 0.06 + hoverMix * 0.02;

        for (let i = 0; i < BLOB_SEGMENTS; i++) {
          const angle = (i / BLOB_SEGMENTS) * Math.PI * 2;
          const cosDiff = Math.cos(angle - moveAngle);
          const stretch = 1 + speedNorm * 0.42 * (cosDiff * cosDiff - 0.28);
          const ripple =
            Math.sin(angle * 3 + time * 3.1) * wobbleAmp +
            Math.cos(angle * 5 - time * 2.3) * (wobbleAmp * 0.6) +
            Math.sin(angle * 2 + time * 1.7) * (wobbleAmp * 0.7);

          const r = baseRadius * stretch * (1 + ripple);
          blobPts.push({
            x: head.x + Math.cos(angle) * r,
            y: head.y + Math.sin(angle) * r,
          });
        }

        ctx.save();
        ctx.globalAlpha = opacity;

        // Soft outer emerald aura
        const auraRadius = baseRadius * 2.1;
        const auraGrad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, auraRadius);
        auraGrad.addColorStop(0, `rgba(74, 222, 128, ${0.22 + hoverMix * 0.14})`);
        auraGrad.addColorStop(0.55, 'rgba(34, 197, 94, 0.08)');
        auraGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(head.x, head.y, auraRadius, 0, Math.PI * 2);
        ctx.fill();

        // Main fluid membrane
        drawSmoothClosedLoop(blobPts);
        const bodyGrad = ctx.createRadialGradient(
          head.x - baseRadius * 0.22,
          head.y - baseRadius * 0.22,
          baseRadius * 0.1,
          head.x,
          head.y,
          baseRadius * 1.35
        );
        bodyGrad.addColorStop(0, `rgba(134, 239, 172, ${0.26 + hoverMix * 0.12})`);
        bodyGrad.addColorStop(0.65, `rgba(34, 197, 94, ${0.14 + hoverMix * 0.1})`);
        bodyGrad.addColorStop(1, 'rgba(16, 185, 129, 0.04)');
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        ctx.lineWidth = 1.25 + hoverMix * 0.45;
        ctx.strokeStyle = `rgba(74, 222, 128, ${0.5 + hoverMix * 0.38})`;
        ctx.stroke();

        // Luminous inner core droplet
        const coreRadius = 2.6 + hoverMix * 0.9;
        const coreGrad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, coreRadius * 2.2);
        coreGrad.addColorStop(0, 'rgba(187, 247, 208, 0.95)');
        coreGrad.addColorStop(0.45, 'rgba(74, 222, 128, 0.65)');
        coreGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(head.x, head.y, coreRadius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncSize);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.documentElement.removeEventListener('mouseleave', onPointerLeave);
    };
  }, []);

  return (
    <>
      {/* 35mm Theatrical Film Grain */}
      <div
        aria-hidden="true"
        className="film-grain pointer-events-none fixed inset-0 z-30 opacity-60"
      />

      {/* Cinematic Peripheral Vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-30"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 58%, rgba(2, 5, 3, 0.72) 100%)',
        }}
      />

      {/* Fluid Pointer & Touch Tracking Overlay */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40"
      />
    </>
  );
}
