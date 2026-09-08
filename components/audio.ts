/**
 * The game's sound layer — a handful of tiny synthesized cues over the Web
 * Audio API. No audio files exist in the project and no dependency is
 * added: every sound is an oscillator/noise burst shaped by a short gain
 * envelope, which also happens to fit the 8/16-bit identity better than
 * sampled foley would.
 *
 * Purely presentational and event-driven: GameCanvas feeds it the same
 * FrameEvents every other presentation system reads (components/
 * frameEvents.ts), so a racquet sound is emitted exactly when the engine
 * says a hit connected — never on a key press.
 *
 * Browsers only allow an AudioContext to start after a user gesture. The
 * context is created lazily on the first `unlock()` (wired to keydown/
 * pointerdown in GameCanvas); until then every play call is a silent no-op.
 * All methods are safe to call in environments without Web Audio (tests,
 * SSR) — they simply do nothing.
 */
import type { HitQuality } from "@/game/types";

type ResolvedQuality = Exclude<HitQuality, "miss">;

interface AudioContextLike {
  new (): AudioContext;
}

function getAudioContextCtor(): AudioContextLike | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: AudioContextLike };
  return (window.AudioContext as AudioContextLike | undefined) ?? w.webkitAudioContext ?? null;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume: number;

  constructor(volume = 0.7) {
    this.volume = clamp01(volume);
  }

  /** Master volume in [0, 1]; 0 mutes. Safe before unlock. */
  setVolume(volume: number): void {
    this.volume = clamp01(volume);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
  }

  getVolume(): number {
    return this.volume;
  }

  /** Create/resume the context. Must be called from a user-gesture handler the first time. */
  unlock(): void {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
      } catch {
        this.ctx = null;
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }

  /** Racquet impact — a noise "thwack" plus a short body tone; louder, brighter and tighter the better the timing. */
  racquet(quality: ResolvedQuality): void {
    const spec = { perfect: { gain: 1.0, tone: 520, noiseMs: 45 }, good: { gain: 0.75, tone: 400, noiseMs: 55 }, late: { gain: 0.5, tone: 300, noiseMs: 75 } }[quality];
    this.noiseBurst(spec.noiseMs, spec.gain * 0.5, quality === "late" ? 1400 : 2600);
    this.tone("triangle", spec.tone, spec.tone * 0.6, 0.09, spec.gain * 0.35);
    if (quality === "perfect") {
      // A quick two-note "ping" on top so PERFECT is unmistakable by ear alone.
      this.tone("square", 880, 880, 0.05, 0.12, 0.03);
      this.tone("square", 1320, 1320, 0.07, 0.1, 0.08);
    }
  }

  /** Ball meeting the clay — short, low, dull. */
  bounce(): void {
    this.noiseBurst(35, 0.18, 700);
    this.tone("sine", 150, 90, 0.07, 0.25);
  }

  /** A swing that finds nothing but air. */
  whiff(): void {
    this.noiseBurst(90, 0.12, 900);
  }

  /** Point resolved — a two-note figure, rising for Leo, falling for Alice. */
  point(leoWon: boolean): void {
    const [a, b] = leoWon ? [660, 880] : [440, 330];
    this.tone("square", a, a, 0.09, 0.14);
    this.tone("square", b, b, 0.16, 0.14, 0.1);
  }

  /** Game / set won — a slightly longer three-note phrase. */
  game(leoWon: boolean): void {
    const notes = leoWon ? [523, 659, 784] : [523, 415, 349];
    notes.forEach((f, i) => this.tone("square", f, f, 0.14, 0.14, i * 0.11));
  }

  /** Match over — the same phrase resolved with a held final note. */
  match(leoWon: boolean): void {
    const notes = leoWon ? [523, 659, 784, 1047] : [523, 466, 415, 262];
    notes.forEach((f, i) => this.tone("square", f, f, i === notes.length - 1 ? 0.6 : 0.16, 0.16, i * 0.14));
  }

  /** UI click / pause toggle. */
  click(): void {
    this.tone("square", 740, 740, 0.04, 0.08);
  }

  private tone(type: OscillatorType, from: number, to: number, seconds: number, gain: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + seconds);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  private noiseBurst(ms: number, gain: number, lowpassHz: number): void {
    if (!this.ctx || !this.master) return;
    const buffer = this.getNoiseBuffer();
    if (!buffer) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpassHz;
    const env = this.ctx.createGain();
    const seconds = ms / 1000;
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    src.connect(filter).connect(env).connect(this.master);
    src.start(t0);
    src.stop(t0 + seconds + 0.01);
  }

  private getNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noiseBuffer) {
      const length = Math.floor(this.ctx.sampleRate * 0.2);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}
