/**
 * Presentation-only impact/feedback effects: hit sparks, bounce dust, the
 * PERFECT screen shake + flash ring, the ball-shadow "squash" on contact,
 * the timing/point banners and the fast-ball afterimage trail. Same
 * architectural pattern as components/playerAnimation.ts — reads two
 * consecutive engine snapshots (before/after `GameEngine.update()`), never
 * mutates engine state, never touches React or <canvas> (drawing lives in
 * components/GameCanvas.tsx so this file stays testable in vitest's node
 * environment).
 *
 * Every trigger comes from components/frameEvents.ts (the single
 * presentation-side edge detector) — nothing is re-derived here. The spawn
 * position of a hit is the ball's position in the *previous* snapshot:
 * launchShot resets `ball.z` to 0 and snaps `ball.x` to the hitter's
 * baseline on the connecting frame, so the previous frame is where contact
 * visually happened (racquet height, actual approach point).
 *
 * Particles live in a fixed, preallocated pool (MAX_PARTICLES) — spawning
 * reuses inactive slots and silently drops when full, so the steady-state
 * loop allocates nothing per frame.
 */
import { readFrameEvents, type PointEventType } from "@/components/frameEvents";
import type { GameSnapshot, HitQuality, Side } from "@/game/types";

export type ParticleKind = "spark" | "dust";

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  /** World-space position — X/Y on the court, Z above it (see game/types). */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  lifeMs: number;
  maxLifeMs: number;
  /** Side length of the square, in canvas px — small pixel-art squares, never scaled. */
  size: number;
  color: string;
}

export interface TrailPoint {
  x: number;
  y: number;
  z: number;
}

type ResolvedQuality = Exclude<HitQuality, "miss">;

export const MAX_PARTICLES = 40;

/** Sparks per hit — within the spec's PERFECT 6–8 / GOOD 4–6 / LATE 2–4 ranges. */
export const SPARK_COUNT: Record<ResolvedQuality, number> = { perfect: 8, good: 5, late: 3 };
export const DUST_COUNT = 4;

export const SHAKE_DURATION_MS = 100;
export const SHAKE_AMPLITUDE_PX = 4;
export const FLASH_DURATION_MS = 60;
/** How long the shadow reads "pressed into the court" after a bounce. */
export const SHADOW_SQUASH_MS = 90;
/** Timing banner (PERFECT!/GOOD!/LATE!/MISS!) lifetime above the player who swung. */
export const HIT_BANNER_MS = 700;
/** Point/game/set/match banner lifetime, centered over the court. */
export const POINT_BANNER_MS = 1100;
/** Ball afterimages are only drawn above this horizontal speed (world units/s) — a PERFECT-class shot, not every rally ball. */
export const TRAIL_MIN_SPEED = 520;
export const TRAIL_LENGTH = 6;

const SPARK_GRAVITY = -700; // world units / s² — a touch lighter than the ball's so sparks hang for a beat
const SPARK_COLORS: Record<ResolvedQuality, readonly string[]> = {
  perfect: ["#ffffff", "#fff3a0", "#ffe14d"],
  good: ["#ffffff", "#dfffb0"],
  late: ["#ffffff", "#d8d2c8"], // neutral, not warm — warm tones vanish against the clay
};
// Pale, warm clay dust — a few shades lighter than the court texture so it
// reads as a puff without glowing (the texture itself is ~#c8703f).
const DUST_COLORS: readonly string[] = ["#f3cfae", "#f9e2c9", "#e6b58f"];

function makeParticle(): Particle {
  return { active: false, kind: "dust", x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, lifeMs: 0, maxLifeMs: 1, size: 2, color: "#fff" };
}

export interface ImpactEffectsOptions {
  random?: () => number; // injectable for deterministic tests — defaults to Math.random
}

export class ImpactEffects {
  readonly particles: readonly Particle[];
  private readonly random: () => number;

  private shakeMs = 0;
  private shakeX = 0;
  private shakeY = 0;

  private flashMs = 0;
  private flashX = 0;
  private flashY = 0;
  private flashZ = 0;

  private squashMs = 0;

  private hitBannerMs = 0;
  private hitBannerSide: Side = "leo";
  private hitBannerQuality: HitQuality = "good";

  private pointBannerMs = 0;
  private pointBannerType: PointEventType = "point";
  private pointBannerWinner: Side = "leo";

  private readonly trail: TrailPoint[] = Array.from({ length: TRAIL_LENGTH }, () => ({ x: 0, y: 0, z: 0 }));
  private trailHead = 0;
  private trailFilled = 0;
  private trailActive = false;

  constructor(options: ImpactEffectsOptions = {}) {
    this.random = options.random ?? Math.random;
    this.particles = Array.from({ length: MAX_PARTICLES }, makeParticle);
  }

  update(dtSeconds: number, prevSnapshot: GameSnapshot, nextSnapshot: GameSnapshot): void {
    const dt = Math.max(0, dtSeconds);
    const dtMs = dt * 1000;
    const events = readFrameEvents(prevSnapshot, nextSnapshot);

    if (events.hit) this.onHit(events.hit.side, events.hit.quality, prevSnapshot);
    if (events.miss) this.showHitBanner(events.miss, "miss");
    if (events.bounce) this.onBounce(nextSnapshot);
    if (events.point) {
      this.pointBannerMs = POINT_BANNER_MS;
      this.pointBannerType = events.point.type;
      this.pointBannerWinner = events.point.winner;
    }

    this.recordTrail(nextSnapshot);
    this.advanceParticles(dt);
    this.advanceTimers(dtMs);
  }

  /** Canvas-px shake offset for this frame — integers, so the pixel art stays crisp. */
  getShakeOffset(): { x: number; y: number } {
    return { x: this.shakeX, y: this.shakeY };
  }

  isShaking(): boolean {
    return this.shakeMs > 0;
  }

  /** 1 right at touchdown, easing to 0 over SHADOW_SQUASH_MS. */
  getShadowSquash(): number {
    return this.squashMs / SHADOW_SQUASH_MS;
  }

  /** World-space position of the active PERFECT flash ring, or null when none is showing. */
  getFlash(): { x: number; y: number; z: number; progress: number } | null {
    if (this.flashMs <= 0) return null;
    return { x: this.flashX, y: this.flashY, z: this.flashZ, progress: 1 - this.flashMs / FLASH_DURATION_MS };
  }

  /** The timing banner to draw above `side`, with progress in [0,1), or null. */
  getHitBanner(): { side: Side; quality: HitQuality; progress: number } | null {
    if (this.hitBannerMs <= 0) return null;
    return { side: this.hitBannerSide, quality: this.hitBannerQuality, progress: 1 - this.hitBannerMs / HIT_BANNER_MS };
  }

  /** The point/game/set/match banner, with progress in [0,1), or null. */
  getPointBanner(): { type: PointEventType; winner: Side; progress: number } | null {
    if (this.pointBannerMs <= 0) return null;
    return { type: this.pointBannerType, winner: this.pointBannerWinner, progress: 1 - this.pointBannerMs / POINT_BANNER_MS };
  }

  /**
   * The ball's position `framesBack` frames ago (1 = previous frame), or
   * null when the ball isn't fast enough for a trail or the history is too
   * short (the buffer is cleared on every hit/reset so an afterimage never
   * bridges a teleport).
   */
  getTrailPoint(framesBack: number): TrailPoint | null {
    if (!this.trailActive || framesBack < 1 || framesBack > this.trailFilled - 1) return null;
    return this.trail[(this.trailHead - 1 - framesBack + TRAIL_LENGTH * 2) % TRAIL_LENGTH];
  }

  activeCount(kind?: ParticleKind): number {
    let n = 0;
    for (const p of this.particles) if (p.active && (kind === undefined || p.kind === kind)) n++;
    return n;
  }

  private onHit(side: Side, quality: ResolvedQuality, prevSnapshot: GameSnapshot): void {
    const ball = prevSnapshot.ball;
    // Contact never visually happens at ground level — floor the spawn
    // height so sparks aren't buried under the shadow on a low return.
    const z = Math.max(ball.z, 12);
    // Sparks fly the way the ball is now going: away from the hitter.
    const away = side === "leo" ? 1 : -1;
    const colors = SPARK_COLORS[quality];

    for (let i = 0; i < SPARK_COUNT[quality]; i++) {
      const p = this.acquire();
      if (!p) break;
      p.active = true;
      p.kind = "spark";
      p.x = ball.x;
      p.y = ball.y;
      p.z = z;
      p.vx = away * this.range(40, 200);
      p.vy = this.range(-110, 110);
      p.vz = this.range(40, 180);
      p.maxLifeMs = this.range(200, 320);
      p.lifeMs = p.maxLifeMs;
      p.size = quality === "perfect" && this.random() < 0.5 ? 4 : 3;
      p.color = colors[Math.floor(this.random() * colors.length)];
    }

    this.showHitBanner(side, quality);
    // The ball is re-launched from the hitter's baseline: drop the history
    // so the trail restarts from the new flight, not across the snap.
    this.trailFilled = 0;

    if (quality === "perfect") {
      this.flashMs = FLASH_DURATION_MS;
      this.flashX = ball.x;
      this.flashY = ball.y;
      this.flashZ = z;
      // Shake is the player's reward only. Alice's raw swing is near-perfect
      // by construction (GameEngine.maybeAttemptCpuHit waits for the PERFECT
      // window), so shaking on hers would rattle the screen on most of her
      // returns — noise, not feedback.
      if (side === "leo") this.shakeMs = SHAKE_DURATION_MS;
    }
  }

  private showHitBanner(side: Side, quality: HitQuality): void {
    this.hitBannerMs = HIT_BANNER_MS;
    this.hitBannerSide = side;
    this.hitBannerQuality = quality;
  }

  private onBounce(nextSnapshot: GameSnapshot): void {
    const ball = nextSnapshot.ball;
    this.squashMs = SHADOW_SQUASH_MS;

    for (let i = 0; i < DUST_COUNT; i++) {
      const p = this.acquire();
      if (!p) break;
      p.active = true;
      p.kind = "dust";
      p.x = ball.x;
      p.y = ball.y;
      p.z = 0;
      // Puffs out low and sideways along the court, drifting a little in the
      // ball's direction of travel; barely any lift so it stays at the
      // surface, next to the shadow, never up at the ball.
      p.vx = this.range(-40, 40) + Math.sign(ball.vx) * 25;
      p.vy = this.range(-55, 55);
      p.vz = this.range(8, 30);
      p.maxLifeMs = this.range(200, 320);
      p.lifeMs = p.maxLifeMs;
      p.size = this.random() < 0.4 ? 4 : 3;
      p.color = DUST_COLORS[Math.floor(this.random() * DUST_COLORS.length)];
    }
  }

  private recordTrail(snapshot: GameSnapshot): void {
    const ball = snapshot.ball;
    if (ball.state === "idle") {
      this.trailFilled = 0;
      this.trailActive = false;
      return;
    }
    const slot = this.trail[this.trailHead];
    slot.x = ball.x;
    slot.y = ball.y;
    slot.z = ball.z;
    this.trailHead = (this.trailHead + 1) % TRAIL_LENGTH;
    this.trailFilled = Math.min(TRAIL_LENGTH, this.trailFilled + 1);
    this.trailActive = Math.hypot(ball.vx, ball.vy) >= TRAIL_MIN_SPEED;
  }

  private advanceParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.lifeMs -= dt * 1000;
      if (p.lifeMs <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "spark") {
        p.z = Math.max(0, p.z + p.vz * dt);
        p.vz += SPARK_GRAVITY * dt;
      } else {
        // Dust decelerates instead of falling — it's a puff, not a projectile.
        p.z += p.vz * dt;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.vz *= 0.85;
      }
    }
  }

  private advanceTimers(dtMs: number): void {
    if (this.shakeMs > 0) {
      // Magnitude decays linearly to zero over the duration; only the
      // direction is re-rolled each frame, so it reads as a rattle (not a
      // slide) while every frame still moves by the full current strength.
      const strength = SHAKE_AMPLITUDE_PX * (this.shakeMs / SHAKE_DURATION_MS);
      this.shakeX = Math.round(strength) * (this.random() < 0.5 ? -1 : 1);
      this.shakeY = Math.round(strength * 0.6) * (this.random() < 0.5 ? -1 : 1);
      this.shakeMs = Math.max(0, this.shakeMs - dtMs);
    }
    if (this.shakeMs <= 0) {
      this.shakeX = 0;
      this.shakeY = 0;
    }
    this.flashMs = Math.max(0, this.flashMs - dtMs);
    this.squashMs = Math.max(0, this.squashMs - dtMs);
    this.hitBannerMs = Math.max(0, this.hitBannerMs - dtMs);
    this.pointBannerMs = Math.max(0, this.pointBannerMs - dtMs);
  }

  private acquire(): Particle | null {
    for (const p of this.particles) if (!p.active) return p;
    return null;
  }

  private range(min: number, max: number): number {
    return min + this.random() * (max - min);
  }
}
