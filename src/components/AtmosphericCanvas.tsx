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
  paused?: boolean;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_intensity;
uniform float u_mobile;
uniform vec3 u_tintColor;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

const mat2 FBM_ROT = mat2(0.8525, 0.5227, -0.5227, 0.8525);

float fbm(vec2 p) {
    float total = 0.0;
    float amp = 0.54;
    vec2 shift = vec2(u_time * 0.07, -u_time * 0.18);
    for (int i = 0; i < 4; i++) {
        total += amp * noise(p);
        p = FBM_ROT * p * 1.88 + shift;
        amp *= 0.46;
    }
    return total;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    vec2 mouseUV = u_mouse / max(u_resolution, vec2(1.0));
    float mouseDist = length(uv - mouseUV);
    float mouseWake = smoothstep(0.35, 0.0, mouseDist) * 0.16 * (1.0 - u_mobile);

    vec2 smokeUV = uv * vec2(2.35, 1.95) + vec2(0.0, -u_time * 0.36);
    float warp = fbm(smokeUV * 1.15 + vec2(sin(u_time * 0.20), cos(u_time * 0.26)));
    float smoke = fbm(smokeUV + warp * 0.95 + mouseWake);
    float s = smoothstep(0.08, 0.92, smoke * 1.14);
    float surge = s * sqrt(s);

    float bottomPlume = smoothstep(1.08, -0.15, uv.y + (smoke * 0.32 - 0.16));
    float edgeBoost = 0.55 + 0.65 * smoothstep(0.18, 0.78, abs(uv.x - 0.5) * 1.35);
    vec2 subjectDelta = (uv - vec2(0.5, 0.42)) * vec2(1.42, 1.02);
    float subjectZone = 1.0 - smoothstep(0.16, 0.72, length(subjectDelta));
    float frontFumeReduction = mix(1.0, 0.14, subjectZone);
    float fumeMask = bottomPlume * edgeBoost * frontFumeReduction;

    vec3 greenShadow = u_tintColor * 0.14;
    vec3 greenMid = u_tintColor * 0.62;
    vec3 greenPower = clamp(u_tintColor * 1.1, 0.0, 1.0);

    vec3 col = mix(greenShadow, greenMid, surge);
    col = mix(col, greenPower, surge * surge * 0.72);

    float alpha = clamp(surge * fumeMask * 0.61 * u_intensity, 0.0, 0.95);

    gl_FragColor = vec4(col * alpha, alpha);
}
`;

export function AtmosphericCanvas({ mode, activeCharacter, paused = false }: AtmosphericCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef<number>(getShaderIntensity(mode));
  const tintRef = useRef<[number, number, number]>(getEmberTintColor(activeCharacter.emberTint));
  const pausedRef = useRef<boolean>(paused);
  const resumeLoopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    intensityRef.current = getShaderIntensity(mode);
  }, [mode]);

  useEffect(() => {
    tintRef.current = getEmberTintColor(activeCharacter.emberTint);
  }, [activeCharacter.emberTint]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) {
      resumeLoopRef.current?.();
    }
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;
    let isSoftwareRenderer = false;
    let contextLost = false;
    let rafId = 0;

    let uTime: WebGLUniformLocation | null = null;
    let uRes: WebGLUniformLocation | null = null;
    let uMouse: WebGLUniformLocation | null = null;
    let uIntensity: WebGLUniformLocation | null = null;
    let uMobile: WebGLUniformLocation | null = null;
    let uTintColor: WebGLUniformLocation | null = null;

    const syncSize = () => {
      const cw = canvas.clientWidth || window.innerWidth || 1280;
      const ch = canvas.clientHeight || window.innerHeight || 720;
      const target = computeShaderBufferSize(cw, ch, isSoftwareRenderer, isCoarsePointer || cw <= 768);
      if (canvas.width !== target.width || canvas.height !== target.height) {
        canvas.width = target.width;
        canvas.height = target.height;
      }
    };

    const cleanupGlResources = () => {
      if (!gl) return;
      if (buffer) gl.deleteBuffer(buffer);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (program) gl.deleteProgram(program);
      buffer = null;
      vs = null;
      fs = null;
      program = null;
    };

    const initGl = (): boolean => {
      gl =
        (canvas.getContext('webgl', {
          alpha: true,
          premultipliedAlpha: true,
          antialias: false,
          powerPreference: 'default',
        }) as WebGLRenderingContext | null) ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

      if (!gl) return false;

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
        isSoftwareRenderer = /swiftshader|llvmpipe|software/i.test(renderer);
      }

      syncSize();

      const compileShader = (type: number, source: string): WebGLShader | null => {
        if (!gl) return null;
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

      vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
      fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      if (!vs || !fs) {
        cleanupGlResources();
        return false;
      }

      program = gl.createProgram();
      if (!program) {
        cleanupGlResources();
        return false;
      }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        cleanupGlResources();
        return false;
      }

      gl.useProgram(program);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );

      const posLocation = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posLocation);
      gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

      uTime = gl.getUniformLocation(program, 'u_time');
      uRes = gl.getUniformLocation(program, 'u_resolution');
      uMouse = gl.getUniformLocation(program, 'u_mouse');
      uIntensity = gl.getUniformLocation(program, 'u_intensity');
      uMobile = gl.getUniformLocation(program, 'u_mobile');
      uTintColor = gl.getUniformLocation(program, 'u_tintColor');
      return true;
    };

    if (!initGl()) return;

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncSize) : null;
    if (resizeObserver) {
      resizeObserver.observe(canvas);
    }

    let currentIntensity = intensityRef.current;
    const currentTint: [number, number, number] = [...tintRef.current];
    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        mouse.x = nx * canvas.width;
        mouse.y = ny * canvas.height;
      }
    };

    const renderFrame = (elapsedSec: number) => {
      if (!gl || contextLost || !program) return;
      if (!resizeObserver) syncSize();

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      currentIntensity += (intensityRef.current - currentIntensity) * 0.06;
      currentTint[0] += (tintRef.current[0] - currentTint[0]) * 0.05;
      currentTint[1] += (tintRef.current[1] - currentTint[1]) * 0.05;
      currentTint[2] += (tintRef.current[2] - currentTint[2]) * 0.05;

      const isMobileNow = isCoarsePointer || (canvas.clientWidth || window.innerWidth) <= 768 ? 1.0 : 0.0;
      if (uTime) gl.uniform1f(uTime, elapsedSec);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      if (uIntensity) gl.uniform1f(uIntensity, currentIntensity);
      if (uMobile) gl.uniform1f(uMobile, isMobileNow);
      if (uTintColor) gl.uniform3f(uTintColor, currentTint[0], currentTint[1], currentTint[2]);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const minFrameMs = isCoarsePointer ? 32 : 0;
    let lastRender = performance.now();
    let lastTick = lastRender;
    let elapsedSec = 0;

    const loop = (t: number) => {
      if (document.hidden || contextLost || pausedRef.current) {
        rafId = 0;
        return;
      }
      if (minFrameMs > 0 && t - lastRender < minFrameMs) {
        lastTick = t;
        rafId = window.requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (t - lastTick) / 1000));
      lastTick = t;
      lastRender = t;
      elapsedSec += dt;
      // Keep u_time bounded so noise coordinates never lose precision on long-open tabs
      if (elapsedSec > 3600) elapsedSec -= 3600;
      renderFrame(elapsedSec);
      rafId = window.requestAnimationFrame(loop);
    };

    const resumeIfVisible = () => {
      if (!document.hidden && !contextLost && !prefersReducedMotion && !pausedRef.current && !rafId) {
        lastTick = performance.now();
        lastRender = lastTick;
        rafId = window.requestAnimationFrame(loop);
      }
    };
    resumeLoopRef.current = resumeIfVisible;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const onContextRestored = () => {
      contextLost = false;
      if (initGl()) {
        if (prefersReducedMotion) {
          renderFrame(2.4);
        } else if (!document.hidden && !rafId) {
          lastTick = performance.now();
          lastRender = lastTick;
          rafId = window.requestAnimationFrame(loop);
        }
      }
    };

    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    document.addEventListener('visibilitychange', resumeIfVisible);
    window.addEventListener('pageshow', resumeIfVisible);
    if (!isCoarsePointer) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
    }
    if (!resizeObserver) {
      window.addEventListener('resize', syncSize, { passive: true });
    }

    if (prefersReducedMotion) {
      renderFrame(2.4);
    } else {
      rafId = window.requestAnimationFrame(loop);
    }

    return () => {
      resumeLoopRef.current = null;
      window.cancelAnimationFrame(rafId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      document.removeEventListener('visibilitychange', resumeIfVisible);
      window.removeEventListener('pageshow', resumeIfVisible);
      if (!isCoarsePointer) {
        window.removeEventListener('pointermove', handlePointerMove);
      }
      if (!resizeObserver) {
        window.removeEventListener('resize', syncSize);
      }
      if (resizeObserver) resizeObserver.disconnect();
      cleanupGlResources();
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
