import { useEffect, useRef } from 'react';

interface ThorLightningProps {
  active: boolean;
  phase: 'blue' | 'yellow';
}

interface BoltSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

interface ActiveBolt {
  segments: BoltSegment[];
  life: number;
  maxLife: number;
  intensity: number;
}

interface ElectricSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function buildLightningSegments(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  displace: number,
  width: number,
  depth: number,
  out: BoltSegment[]
): void {
  if (depth <= 0 || displace < 2.2) {
    out.push({ x1, y1, x2, y2, width });
    return;
  }

  const midX = (x1 + x2) * 0.5 + (Math.random() - 0.5) * displace;
  const midY = (y1 + y2) * 0.5 + (Math.random() - 0.5) * displace;

  buildLightningSegments(x1, y1, midX, midY, displace * 0.54, width, depth - 1, out);
  buildLightningSegments(midX, midY, x2, y2, displace * 0.54, width, depth - 1, out);

  // Occasional secondary fork
  if (depth >= 2 && Math.random() < 0.34) {
    const angle = Math.atan2(y2 - y1, x2 - x1) + (Math.random() - 0.5) * 1.4;
    const branchLen = Math.hypot(x2 - x1, y2 - y1) * (0.35 + Math.random() * 0.3);
    const bx = midX + Math.cos(angle) * branchLen;
    const by = midY + Math.sin(angle) * branchLen;
    buildLightningSegments(midX, midY, bx, by, displace * 0.42, width * 0.6, depth - 2, out);
  }
}

export function ThorLightning({ active, phase }: ThorLightningProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  const targetMixRef = useRef(phase === 'yellow' ? 1 : 0);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    targetMixRef.current = phase === 'yellow' ? 1 : 0;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const bolts: ActiveBolt[] = [];
    const sparks: ElectricSpark[] = [];
    let colorMix = targetMixRef.current;
    let flashAlpha = 0;
    let lastTime = performance.now();
    let spawnAccumulator = 0;

    const spawnBoltAroundThor = (major = false) => {
      const cx = width * 0.5;
      const cy = height * 0.45;
      const rx = Math.min(width * 0.24, height * 0.34);
      const ry = Math.min(height * 0.36, width * 0.42);

      // Bias bolts around upper torso, shoulders, and Stormbreaker arc
      const angleA = -Math.PI * 0.92 + Math.random() * Math.PI * 1.84;
      const angleB = angleA + (Math.random() - 0.5) * (major ? 1.15 : 0.7);
      const rScaleA = 0.65 + Math.random() * 0.42;
      const rScaleB = major ? 1.05 + Math.random() * 0.5 : 0.72 + Math.random() * 0.48;

      const x1 = cx + Math.cos(angleA) * rx * rScaleA;
      const y1 = cy + Math.sin(angleA) * ry * rScaleA;
      const x2 = cx + Math.cos(angleB) * rx * rScaleB;
      const y2 = cy + Math.sin(angleB) * ry * rScaleB;

      const segments: BoltSegment[] = [];
      const dist = Math.hypot(x2 - x1, y2 - y1);
      buildLightningSegments(
        x1,
        y1,
        x2,
        y2,
        Math.max(22, dist * 0.32),
        major ? 2.4 : 1.5,
        major ? 4 : 3,
        segments
      );

      bolts.push({
        segments,
        life: 0,
        maxLife: major ? 0.24 + Math.random() * 0.14 : 0.14 + Math.random() * 0.12,
        intensity: major ? 1 : 0.65 + Math.random() * 0.3,
      });

      if (major) {
        flashAlpha = Math.min(0.32, flashAlpha + 0.18);
      }

      // Spawn a few electric sparks along the bolt
      const sparkCount = major ? 6 : 2;
      for (let i = 0; i < sparkCount; i++) {
        const seg = segments[Math.floor(Math.random() * segments.length)];
        if (!seg) continue;
        sparks.push({
          x: seg.x1,
          y: seg.y1,
          vx: (Math.random() - 0.5) * 140,
          vy: (Math.random() - 0.5) * 140 - 30,
          life: 0,
          maxLife: 0.25 + Math.random() * 0.35,
          size: 1.2 + Math.random() * 2.1,
        });
      }
    };

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // Smoothly interpolate between Electric Blue (0) and Thunder Yellow (1)
      colorMix += (targetMixRef.current - colorMix) * Math.min(1, dt * 6.5);

      // RGB interpolation:
      // Blue:   outer (56, 189, 248), mid (125, 211, 252)
      // Yellow: outer (250, 204, 21), mid (254, 240, 138)
      const rOut = Math.round(lerp(56, 250, colorMix));
      const gOut = Math.round(lerp(189, 204, colorMix));
      const bOut = Math.round(lerp(248, 21, colorMix));

      const rMid = Math.round(lerp(147, 254, colorMix));
      const gMid = Math.round(lerp(217, 243, colorMix));
      const bMid = Math.round(lerp(255, 145, colorMix));

      ctx.clearRect(0, 0, width, height);

      if (!activeRef.current) {
        if (bolts.length > 0) bolts.length = 0;
        if (sparks.length > 0) sparks.length = 0;
        rafId = window.requestAnimationFrame(renderFrame);
        return;
      }

      if (prefersReducedMotion) {
        const cx = width * 0.5;
        const cy = height * 0.45;
        const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.min(width, height) * 0.42);
        grad.addColorStop(0, `rgba(${rOut}, ${gOut}, ${bOut}, 0.22)`);
        grad.addColorStop(1, `rgba(${rOut}, ${gOut}, ${bOut}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        rafId = window.requestAnimationFrame(renderFrame);
        return;
      }

      spawnAccumulator += dt;
      if (spawnAccumulator >= 0.065) {
        spawnAccumulator = 0;
        spawnBoltAroundThor(Math.random() < 0.26);
        if (Math.random() < 0.55) {
          spawnBoltAroundThor(false);
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Ambient lightning flash pulse behind Thor
      if (flashAlpha > 0.005) {
        const cx = width * 0.5;
        const cy = height * 0.42;
        const radius = Math.min(width, height) * 0.52;
        const flashGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
        flashGrad.addColorStop(0, `rgba(${rMid}, ${gMid}, ${bMid}, ${flashAlpha * 0.85})`);
        flashGrad.addColorStop(0.45, `rgba(${rOut}, ${gOut}, ${bOut}, ${flashAlpha * 0.42})`);
        flashGrad.addColorStop(1, `rgba(${rOut}, ${gOut}, ${bOut}, 0)`);
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, width, height);
        flashAlpha *= Math.pow(0.06, dt);
      }

      // Draw active lightning bolts
      for (let i = bolts.length - 1; i >= 0; i--) {
        const bolt = bolts[i];
        bolt.life += dt;
        if (bolt.life >= bolt.maxLife) {
          bolts.splice(i, 1);
          continue;
        }

        const progress = bolt.life / bolt.maxLife;
        const alpha = (1 - progress * progress) * bolt.intensity;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Outer electric glow
        ctx.shadowColor = `rgba(${rOut}, ${gOut}, ${bOut}, ${alpha})`;
        ctx.shadowBlur = 22;
        ctx.strokeStyle = `rgba(${rOut}, ${gOut}, ${bOut}, ${alpha * 0.78})`;
        for (const seg of bolt.segments) {
          ctx.lineWidth = seg.width * 2.8;
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();
        }

        // Mid vibrant core
        ctx.shadowBlur = 10;
        ctx.strokeStyle = `rgba(${rMid}, ${gMid}, ${bMid}, ${alpha * 0.92})`;
        for (const seg of bolt.segments) {
          ctx.lineWidth = seg.width * 1.35;
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();
        }

        // White-hot filament
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
        for (const seg of bolt.segments) {
          ctx.lineWidth = Math.max(0.7, seg.width * 0.55);
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();
        }
      }

      // Draw crackling electric sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life >= s.maxLife) {
          sparks.splice(i, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const alpha = 1 - s.life / s.maxLife;

        ctx.fillStyle = `rgba(${rMid}, ${gMid}, ${bMid}, ${alpha})`;
        ctx.shadowColor = `rgba(${rOut}, ${gOut}, ${bOut}, ${alpha})`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
