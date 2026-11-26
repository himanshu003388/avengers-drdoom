import { useEffect, useRef } from 'react';
import type { CharacterProfile } from '../data/characters';
import {
  type AtmosphereMode,
  computeShaderBufferSize,
  getEmberTintColor,
  getShaderIntensity,
} from '../utils/atmosphere';

interface AtmosphericCanvasProps {
  mode: AtmosphereMode;
  activeCharacter: CharacterProfile;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_intensity;
uniform vec3 u_tintColor;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec2 hash2(vec2 p) {
    float n = hash(p);
    return vec2(n, hash(p + n * 17.3));
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // Quintic interpolation for C2-smooth, silky smoke without grid creases
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float total = 0.0;
    float amp = 0.54;
    mat2 rot = mat2(cos(0.55), sin(0.55), -sin(0.55), cos(0.55));
    for (int i = 0; i < 5; i++) {
        total += amp * noise(p);
        p = rot * p * 1.88 + vec2(u_time * 0.07, -u_time * 0.18);
        amp *= 0.46;
    }
    return total;
}

// Tiny real-fire green spark embers with organic per-particle drift and hot core
float fireSparks(vec2 pUV, float scale, float speedY, float threshold, float sparkLen, float sparkRadius) {
    vec2 gridUV = pUV * scale + vec2(0.0, -u_time * speedY);
    vec2 cell = floor(gridUV);
    float seed = hash(cell);
    if (seed < threshold) return 0.0;

    vec2 rnd = hash2(cell);
    float wander = sin(u_time * (1.1 + rnd.x * 1.5) + seed * 31.4) * 0.24;
    vec2 center = (rnd - 0.5) * 0.54 + vec2(wander, 0.0);
    vec2 local = fract(gridUV) - 0.5 - center;

    // Tilt aligned with per-particle horizontal drift
    float angle = cos(u_time * (1.1 + rnd.x * 1.5) + seed * 31.4) * 0.28 + (rnd.y - 0.5) * 0.25;
    float cs = cos(angle);
    float sn = sin(angle);
    vec2 r = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);

    float len = sparkLen * (0.55 + 0.85 * rnd.y);
    float dAlong = max(0.0, abs(r.y) - len);
    float d = length(vec2(r.x, dAlong));

    float core = exp(-d * (2.8 / sparkRadius));
    float halo = exp(-d * (0.58 / sparkRadius)) * 0.42;

    float life = smoothstep(0.08, 0.45, 0.5 + 0.5 * sin(u_time * (1.6 + rnd.y * 2.6) + seed * 62.8));
    float flicker = 0.68 + 0.32 * sin(u_time * 14.0 + seed * 91.0);
    float strength = (seed - threshold) / (1.0 - threshold);
    return (core + halo) * strength * life * flicker;
}

// Tiny pinprick glowing green ember dots floating in the heat updraft
float glowingEmberDots(vec2 pUV, float scale, float speedY, float threshold, float dotRadius) {
    vec2 gridUV = pUV * scale + vec2(0.0, -u_time * speedY);
    vec2 cell = floor(gridUV);
    float seed = hash(cell + vec2(19.3, 7.1));
    if (seed < threshold) return 0.0;

    vec2 rnd = hash2(cell + vec2(11.7, 23.9));
    float wanderX = sin(u_time * (0.85 + rnd.x * 1.3) + seed * 43.2) * 0.26;
    float wanderY = cos(u_time * (0.7 + rnd.y * 1.1) + seed * 27.1) * 0.14;
    vec2 center = (rnd - 0.5) * 0.56 + vec2(wanderX, wanderY);
    vec2 local = fract(gridUV) - 0.5 - center;

    float d = length(local);
    float radius = dotRadius * (0.65 + 0.7 * rnd.x);

    float core = exp(-d * (3.2 / radius));
    float halo = exp(-d * (0.62 / radius)) * 0.48;

    float pulse = 0.35 + 0.65 * (0.5 + 0.5 * sin(u_time * (1.8 + rnd.y * 2.8) + seed * 54.0));
    float strength = (seed - threshold) / (1.0 - threshold);
    return (core + halo) * strength * pulse;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    // Cursor turbulence wake
    vec2 mouseUV = u_mouse / max(u_resolution, vec2(1.0));
    float mouseDist = length(uv - mouseUV);
    float mouseWake = smoothstep(0.35, 0.0, mouseDist) * 0.16;

    // Smooth, billowing Doctor Doom emerald fumes (soft domain-warped FBM)
    vec2 smokeUV = uv * vec2(2.35, 1.95) + vec2(0.0, -u_time * 0.36);
    float warp = fbm(smokeUV * 1.15 + vec2(sin(u_time * 0.20), cos(u_time * 0.26)));
    float smoke = fbm(smokeUV + warp * 0.95 + mouseWake);
    float surge = pow(smoothstep(0.08, 0.92, smoke * 1.14), 1.25);

    // Stronger rising plume from lower & side borders, keeping center-front clean for Doom's PNG
    float bottomPlume = smoothstep(1.08, -0.15, uv.y + (smoke * 0.32 - 0.16));
    float edgeBoost = 0.55 + 0.65 * smoothstep(0.18, 0.78, abs(uv.x - 0.5) * 1.35);
    vec2 subjectDelta = (uv - vec2(0.5, 0.42)) * vec2(1.42, 1.02);
    float subjectZone = 1.0 - smoothstep(0.16, 0.72, length(subjectDelta));
    float frontFumeReduction = mix(1.0, 0.14, subjectZone);
    float fumeMask = bottomPlume * edgeBoost * frontFumeReduction;

    // Powerful dark Latverian emerald fume palette (reactive to character tint)
    vec3 greenShadow = u_tintColor * 0.14;
    vec3 greenMid = u_tintColor * 0.62;
    vec3 greenPower = clamp(u_tintColor * 1.1, 0.0, 1.0);

    vec3 col = mix(greenShadow, greenMid, surge);
    col = mix(col, greenPower, pow(surge, 2.4) * 0.72);

    // Aspect-corrected coordinates for crisp, realistic tiny fire sparks & glowing ember dots
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 pUV = vec2(uv.x * aspect, uv.y);

    float sparksNear = fireSparks(pUV, 24.0, 0.85, 0.90, 0.068, 0.022);
    float sparksMid = fireSparks(pUV + vec2(0.37, 0.19), 36.0, 1.15, 0.91, 0.055, 0.018);
    float sparksFine = fireSparks(pUV + vec2(0.71, 0.53), 52.0, 1.45, 0.92, 0.045, 0.015);

    float dotsNear = glowingEmberDots(pUV, 26.0, 0.52, 0.89, 0.024);
    float dotsFine = glowingEmberDots(pUV + vec2(0.29, 0.67), 44.0, 0.78, 0.90, 0.019);

    float totalParticles = sparksNear * 1.1 + sparksMid * 0.95 + sparksFine * 0.85 + dotsNear * 1.15 + dotsFine * 0.95;
    float heightFade = smoothstep(1.02, 0.04, uv.y);
    float frontParticleClarity = mix(1.0, 0.42, subjectZone);

    vec3 emberBaseColor = clamp(u_tintColor * 1.2 + vec3(0.04, 0.12, 0.04), 0.0, 1.0);
    vec3 emberHotColor = clamp(u_tintColor * 1.45 + vec3(0.45, 0.58, 0.42), 0.0, 1.0);
    vec3 particleColor = mix(emberBaseColor, emberHotColor, clamp(totalParticles * 0.75, 0.0, 1.0));

    col += particleColor * totalParticles * heightFade * frontParticleClarity * 1.45;

    float alpha = clamp((surge * fumeMask * 0.61 + totalParticles * heightFade * frontParticleClarity * 0.92) * u_intensity, 0.0, 0.95);

    gl_FragColor = vec4(col * alpha, alpha);
}
`;

export function AtmosphericCanvas({ mode, activeCharacter }: AtmosphericCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef<number>(getShaderIntensity(mode));
  const tintRef = useRef<[number, number, number]>(getEmberTintColor(activeCharacter.emberTint));

  useEffect(() => {
    intensityRef.current = getShaderIntensity(mode);
  }, [mode]);

  useEffect(() => {
    tintRef.current = getEmberTintColor(activeCharacter.emberTint);
  }, [activeCharacter.emberTint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        powerPreference: 'default',
      }) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) return;

    let isSoftwareRenderer = false;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
      isSoftwareRenderer = /swiftshader|llvmpipe|software/i.test(renderer);
    }

    const syncSize = () => {
      const target = computeShaderBufferSize(
        canvas.clientWidth || window.innerWidth || 1280,
        canvas.clientHeight || window.innerHeight || 720,
        isSoftwareRenderer
      );
      if (canvas.width !== target.width || canvas.height !== target.height) {
        canvas.width = target.width;
        canvas.height = target.height;
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncSize) : null;
    if (resizeObserver) {
      resizeObserver.observe(canvas);
    }
    syncSize();

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLocation);
    gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'u_time');
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uIntensity = gl.getUniformLocation(program, 'u_intensity');
    const uTintColor = gl.getUniformLocation(program, 'u_tintColor');

    let currentIntensity = intensityRef.current;
    const currentTint: [number, number, number] = [...tintRef.current];

    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        mouse.x = nx * canvas.width;
        mouse.y = ny * canvas.height;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerMove, { passive: true });
    window.addEventListener('resize', syncSize);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;

    const renderFrame = (timeMs: number) => {
      if (!resizeObserver) syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      currentIntensity += (intensityRef.current - currentIntensity) * 0.06;
      currentTint[0] += (tintRef.current[0] - currentTint[0]) * 0.05;
      currentTint[1] += (tintRef.current[1] - currentTint[1]) * 0.05;
      currentTint[2] += (tintRef.current[2] - currentTint[2]) * 0.05;

      if (uTime) gl.uniform1f(uTime, timeMs * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      if (uIntensity) gl.uniform1f(uIntensity, currentIntensity);
      if (uTintColor) gl.uniform3f(uTintColor, currentTint[0], currentTint[1], currentTint[2]);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    if (prefersReducedMotion) {
      renderFrame(2400);
    } else {
      const loop = (t: number) => {
        renderFrame(t);
        rafId = window.requestAnimationFrame(loop);
      };
      rafId = window.requestAnimationFrame(loop);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerMove);
      window.removeEventListener('resize', syncSize);
      if (resizeObserver) resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="shader-canvas-ANIMATION_1"
      data-testid="atmospheric-canvas"
      data-atmosphere-mode={mode}
      data-active-tint={activeCharacter.emberTint}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 h-full w-full"
    />
  );
}
