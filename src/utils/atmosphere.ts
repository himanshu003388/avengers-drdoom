export type AtmosphereMode = 'smoke-and-embers' | 'ember-surge' | 'minimal';

export type EmberTint =
  | 'emerald'
  | 'chartreuse'
  | 'cyan-emerald'
  | 'electric-blue'
  | 'electric-yellow';

export function getEmberTintColor(tint: EmberTint): [number, number, number] {
  switch (tint) {
    case 'electric-yellow':
      return [0.98, 0.8, 0.08];
    case 'electric-blue':
      return [0.22, 0.74, 0.98];
    case 'cyan-emerald':
      return [0.16, 0.78, 0.92];
    case 'chartreuse':
      return [0.58, 0.92, 0.24];
    case 'emerald':
    default:
      return [0.18, 0.84, 0.4];
  }
}

export function getShaderIntensity(mode: AtmosphereMode): number {
  switch (mode) {
    case 'ember-surge':
      return 1.32;
    case 'minimal':
      return 0.28;
    case 'smoke-and-embers':
    default:
      return 0.92;
  }
}

export function computeShaderBufferSize(
  clientWidth: number,
  clientHeight: number,
  isSoftwareRenderer: boolean,
  isMobile = false
): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(clientWidth || 1280));
  const safeH = Math.max(1, Math.round(clientHeight || 720));

  let scale = 1;
  if (isSoftwareRenderer) {
    const maxWidth = 400;
    scale = safeW > maxWidth ? maxWidth / safeW : 0.45;
  } else if (isMobile || safeW <= 768) {
    const targetMaxWidth = 300;
    scale = Math.min(0.5, targetMaxWidth / safeW);
  } else {
    const maxWidth = 640;
    scale = safeW > maxWidth ? maxWidth / safeW : 0.75;
  }

  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

export interface Parallax3DState {
  rotateX: number;
  rotateY: number;
  subjectTranslateX: number;
  subjectTranslateY: number;
  backdropTranslateX: number;
  backdropTranslateY: number;
  sheenXPercent: number;
  sheenYPercent: number;
}

export function computeParallax3D(normalizedX: number, normalizedY: number): Parallax3DState {
  const nx = Math.max(-1, Math.min(1, normalizedX));
  const ny = Math.max(-1, Math.min(1, normalizedY));

  return {
    rotateX: Number((-ny * 5.5).toFixed(3)),
    rotateY: Number((nx * 7.0).toFixed(3)),
    subjectTranslateX: Number((-nx * 24).toFixed(2)),
    subjectTranslateY: Number((-ny * 16).toFixed(2)),
    backdropTranslateX: Number((nx * 18).toFixed(2)),
    backdropTranslateY: Number((ny * 12).toFixed(2)),
    sheenXPercent: Number((50 + nx * 30).toFixed(2)),
    sheenYPercent: Number((42 + ny * 26).toFixed(2)),
  };
}

export interface ReleaseCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isReleased: boolean;
}

export function computeReleaseCountdown(
  nowMs: number,
  targetMs: number = new Date(2026, 11, 17, 0, 0, 0).getTime()
): ReleaseCountdown {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isReleased: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isReleased: false,
  };
}
