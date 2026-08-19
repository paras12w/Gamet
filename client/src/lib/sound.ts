// Every sound here is synthesized at runtime with the Web Audio API - no
// audio files to fetch, license, or ship. Kept deliberately simple:
// short tone bursts with a quick attack/decay envelope, composed into
// little melodic stabs for the bigger moments (takeover, season win).

export type SoundName = "click" | "chat" | "expand" | "battleWin" | "battleLose" | "takeover" | "sessionWin" | "error" | "herald";

const MUTE_KEY = "gamet:muted";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private mutedState: boolean;

  constructor() {
    let stored = false;
    try {
      stored = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      /* localStorage unavailable (SSR / private mode) - default unmuted */
    }
    this.mutedState = stored;
  }

  get muted(): boolean {
    return this.mutedState;
  }

  setMuted(value: boolean): void {
    this.mutedState = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? "1" : "0");
    } catch {
      /* best-effort persistence only */
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private tone(start: number, freq: number, duration: number, type: OscillatorType, peakGain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  play(name: SoundName): void {
    if (this.mutedState) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (name) {
      case "click":
        this.tone(t, 720, 0.06, "square", 0.05);
        break;
      case "chat":
        this.tone(t, 600, 0.08, "sine", 0.06);
        this.tone(t + 0.05, 900, 0.08, "sine", 0.05);
        break;
      case "expand":
        this.tone(t, 523.25, 0.14, "triangle", 0.12);
        this.tone(t + 0.09, 659.25, 0.16, "triangle", 0.12);
        break;
      case "battleWin":
        this.tone(t, 392, 0.1, "sawtooth", 0.1);
        this.tone(t + 0.07, 587.33, 0.18, "sawtooth", 0.12);
        break;
      case "battleLose":
        this.tone(t, 220, 0.18, "sine", 0.13);
        this.tone(t + 0.12, 164.81, 0.24, "sine", 0.11);
        break;
      case "takeover":
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => this.tone(t + i * 0.11, freq, 0.22, "triangle", 0.14));
        break;
      case "sessionWin":
        [392, 493.88, 587.33, 783.99, 987.77].forEach((freq, i) => this.tone(t + i * 0.13, freq, 0.3, "triangle", 0.15));
        break;
      case "error":
        this.tone(t, 180, 0.16, "square", 0.08);
        break;
      case "herald":
        this.tone(t, 660, 0.09, "triangle", 0.09);
        this.tone(t + 0.1, 660, 0.09, "triangle", 0.09);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
