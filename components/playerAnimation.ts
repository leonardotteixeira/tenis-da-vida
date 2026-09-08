/**
 * Presentation-only animation state machine shared by Leo and Alice. Reads
 * two consecutive engine snapshots (before/after `GameEngine.update()`) and
 * the frame events derived from them (components/frameEvents.ts) — it never
 * mutates or replaces any engine state. See docs/GAME_DESIGN.md
 * "Architecture": components/ never computes physics or scoring, only
 * reacts to the snapshot.
 *
 * States and what drives them:
 *  - CONTACT / RECOVER: the engine's own `hit` event for this side (once per
 *    connect — rally return or serve). Contact/recover durations scale with
 *    the resolved quality: PERFECT crisp, LATE heavy.
 *  - MISS: `lastShot` becoming "miss" for this side.
 *  - CELEBRATE: a point/game/set/match event won by this side — a short,
 *    two-frame fist pump, then straight back to idle.
 *  - PREPARE: racquet back once the ball is close on X and coming this way
 *    (visual anticipation only — PREPARE_APPROACH_DISTANCE is not a reach
 *    constant and never decides a hit).
 *  - WALK / RUN: driven by the player's actual lateral velocity (`vy`, from
 *    game/player/movement.ts). The cycle is advanced by *distance travelled*
 *    rather than by time: each frame of the sheet's stride corresponds to a
 *    fixed number of world units, so the feet cover ground at exactly the
 *    rate the body moves — no foot sliding, no running in place, and the
 *    stride naturally slows/quickens with acceleration and braking.
 *  - IDLE: everything else — the sheet's 4-frame ready sway.
 */
import { readFrameEvents } from "@/components/frameEvents";
import type { GameSnapshot, HitQuality, Side } from "@/game/types";

export type PlayerAnimState = "idle" | "walk" | "run" | "prepare" | "contact" | "recover" | "miss" | "celebrate";
export type ShotSide = "forehand" | "backhand";

export interface PlayerAnimationFrame {
  state: PlayerAnimState;
  /** Index into that state's frame list — always in range for the configured frame counts. */
  frameIndex: number;
  /** Visual forehand/backhand pick (see pickShotSide) — only Alice's sprites use it, Leo has one swing. */
  shotSide: ShotSide;
}

export interface PlayerAnimatorConfig {
  side: Side;
  prepareFrames: number;
  missFrames: number;
  /** The player's top lateral speed (world units/s) — sets the walk/run boundary. */
  maxSpeed: number;
}

type ResolvedQuality = Exclude<HitQuality, "miss">;

export const IDLE_FRAME_COUNT = 4;
export const WALK_FRAME_COUNT = 5;
export const RUN_FRAME_COUNT = 4;
export const CELEBRATE_FRAME_COUNT = 2;

const IDLE_FRAME_MS = 220;
const PREPARE_FRAME_MS = 150;
const MISS_FRAME_MS = 150;
const CELEBRATE_FRAME_MS = 200;
export const CELEBRATE_MS = 1000;

// Contact/recover durations differ by quality so PERFECT reads as a crisp,
// fast swing and LATE as a heavier, delayed one. Quality is only known once
// the engine resolves the hit, so PREPARE itself can't be quality-scaled.
const CONTACT_MS: Record<ResolvedQuality, number> = { perfect: 70, good: 100, late: 150 };
const RECOVER_MS: Record<ResolvedQuality, number> = { perfect: 110, good: 170, late: 260 };

/** Visual-only anticipation window on X — well before REACH_X_LATE decides an actual hit/miss. */
export const PREPARE_APPROACH_DISTANCE = 180;

/** Below this lateral speed the player is standing (a braking tail or the arrival dead zone), not walking. */
export const WALK_MIN_SPEED = 30;
/** Fraction of the player's max speed above which the stride switches from the walk cycle to the run cycle. */
export const RUN_SPEED_RATIO = 0.55;
/**
 * World units of travel per frame of each cycle. The characters are ~150
 * units tall on screen; a jogging stride of ~4×22 = 88 units and a walking
 * stride of ~5×14 = 70 units match the leg reach drawn in the sheets, which
 * is what keeps the planted foot visually still relative to the court.
 */
export const RUN_UNITS_PER_FRAME = 22;
export const WALK_UNITS_PER_FRAME = 14;

/** JS's `%` is negative for a negative dividend; keep a stray negative elapsed time from indexing a sprite array with -1. */
function safeFrameIndex(elapsed: number, perFrame: number, frameCount: number): number {
  return ((Math.floor(elapsed / perFrame) % frameCount) + frameCount) % frameCount;
}

export class PlayerAnimator {
  private state: PlayerAnimState = "idle";
  private elapsedMs = 0;
  /** Distance-based phase of the current walk/run cycle, in world units. */
  private strideUnits = 0;
  private quality: ResolvedQuality = "good";
  private shotSide: ShotSide = "forehand";

  constructor(private readonly config: PlayerAnimatorConfig) {}

  update(dtSeconds: number, prevSnapshot: GameSnapshot, nextSnapshot: GameSnapshot): void {
    const dt = Math.max(0, dtSeconds);
    this.elapsedMs += dt * 1000;
    const me = nextSnapshot[this.config.side];
    const events = readFrameEvents(prevSnapshot, nextSnapshot);

    if (events.hit && events.hit.side === this.config.side) {
      this.quality = events.hit.quality;
      this.shotSide = this.pickShotSide(nextSnapshot);
      this.enter("contact");
      return;
    }
    if (events.miss === this.config.side && this.state !== "miss") {
      this.enter("miss");
      return;
    }
    if (events.point && events.point.winner === this.config.side) {
      this.enter("celebrate");
      return;
    }

    if (this.state === "contact" && this.elapsedMs >= CONTACT_MS[this.quality]) {
      this.enter("recover");
      return;
    }
    if (this.state === "recover" && this.elapsedMs >= RECOVER_MS[this.quality]) {
      this.enter("idle");
      return;
    }
    if (this.state === "miss" && this.elapsedMs >= MISS_FRAME_MS * this.config.missFrames) {
      this.enter("idle");
      return;
    }
    if (this.state === "celebrate" && this.elapsedMs >= CELEBRATE_MS) {
      this.enter("idle");
      return;
    }

    if (this.state === "idle" || this.state === "walk" || this.state === "run" || this.state === "prepare") {
      const ball = nextSnapshot.ball;
      const approaching = ball.owner === this.config.side && Math.abs(ball.x - me.x) < PREPARE_APPROACH_DISTANCE;
      const speed = Math.abs(me.vy);
      this.strideUnits += speed * dt;

      let next: PlayerAnimState;
      if (approaching) next = "prepare";
      else if (speed >= this.config.maxSpeed * RUN_SPEED_RATIO) next = "run";
      else if (speed >= WALK_MIN_SPEED) next = "walk";
      else next = "idle";

      if (next !== this.state) {
        if (next === "prepare") this.shotSide = this.pickShotSide(nextSnapshot);
        // Walk ↔ run keep the stride phase so a change of pace doesn't
        // reset the legs mid-step; anything else starts its own clock.
        const keepStride = (next === "walk" || next === "run") && (this.state === "walk" || this.state === "run");
        this.enter(next, keepStride);
      }
    }
  }

  getFrame(): PlayerAnimationFrame {
    const shotSide = this.shotSide;
    switch (this.state) {
      case "idle":
        return { state: "idle", frameIndex: safeFrameIndex(this.elapsedMs, IDLE_FRAME_MS, IDLE_FRAME_COUNT), shotSide };
      case "walk":
        return { state: "walk", frameIndex: safeFrameIndex(this.strideUnits, WALK_UNITS_PER_FRAME, WALK_FRAME_COUNT), shotSide };
      case "run":
        return { state: "run", frameIndex: safeFrameIndex(this.strideUnits, RUN_UNITS_PER_FRAME, RUN_FRAME_COUNT), shotSide };
      case "prepare":
        return { state: "prepare", frameIndex: safeFrameIndex(this.elapsedMs, PREPARE_FRAME_MS, this.config.prepareFrames), shotSide };
      case "contact":
        return { state: "contact", frameIndex: 0, shotSide };
      case "recover":
        // Reuses the fully-wound-up preparation frame as a static recovery pose.
        return { state: "recover", frameIndex: this.config.prepareFrames - 1, shotSide };
      case "miss":
        return { state: "miss", frameIndex: Math.min(this.config.missFrames - 1, Math.max(0, Math.floor(this.elapsedMs / MISS_FRAME_MS))), shotSide };
      case "celebrate":
        return { state: "celebrate", frameIndex: safeFrameIndex(this.elapsedMs, CELEBRATE_FRAME_MS, CELEBRATE_FRAME_COUNT), shotSide };
    }
  }

  private enter(state: PlayerAnimState, keepStride = false): void {
    this.state = state;
    this.elapsedMs = 0;
    if (!keepStride) this.strideUnits = 0;
  }

  /**
   * Purely visual forehand/backhand pick — the engine has no concept of shot
   * side. A ball on the far side of the player relative to the top sideline
   * reads as a forehand; the near side as a backhand.
   */
  private pickShotSide(snapshot: GameSnapshot): ShotSide {
    return snapshot.ball.y >= snapshot[this.config.side].y ? "forehand" : "backhand";
  }
}
