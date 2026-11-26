/**
 * Lightweight Web Audio API soundscape for the Avengers: Doomsday experience.
 * Generates an ominous Latverian sub-bass drone and subtle metallic UI cues
 * with zero external audio file dependencies.
 */
class DoomSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private isPlaying = false;

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    }
    this.start();
    return true;
  }

  public getEnabled(): boolean {
    return this.isPlaying;
  }

  public start(): void {
    if (this.isPlaying || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const master = this.ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.14, now + 1.4);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, now);
    filter.Q.setValueAtTime(2.5, now);

    // Deep ominous D1 + slightly detuned D2 fifth drone
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(36.71, now); // D1

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(55.0, now); // A1

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(master);
    master.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);

    this.masterGain = master;
    this.droneOsc1 = osc1;
    this.droneOsc2 = osc2;
    this.isPlaying = true;
  }

  public stop(): void {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(this.masterGain.gain.value, 0.0001), now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    const o1 = this.droneOsc1;
    const o2 = this.droneOsc2;
    window.setTimeout(() => {
      try {
        o1?.stop();
        o2?.stop();
        o1?.disconnect();
        o2?.disconnect();
      } catch {
        // Ignore already-stopped oscillators
      }
    }, 500);

    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.isPlaying = false;
  }

  public playUiCue(freq = 220): void {
    if (!this.isPlaying || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.16);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

export const soundEngine = new DoomSoundEngine();
