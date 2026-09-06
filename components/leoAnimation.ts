/**
 * Presentation-only animation state machine for Leo's swing. Reads two
 * consecutive engine snapshots (before/after `GameEngine.update()`) plus the
 * raw input for that frame — it never mutates or replaces any engine state,
 * see docs/GAME_DESIGN.md "Architecture" (components/ never computes physics
 * or scoring, only reacts to the snapshot).
 *
 * CONTACT is entered on the exact frame the engine resolves a swing attempt
 * (same frame GameEngine sets `leo.lastShot`), so the visual hit always lines
 * up with the real one instead of running on its own decorative timer.
 */
import type { GameSnapshot, HitQuality } from "@/game/types";

export type LeoAnimState = "idle" | "prepare" | "contact" | "recover" | "miss";

export interface LeoAnimationFrame {
  state: LeoAnimState;
  frameIndex: number;
  /** Discreet one-shot flash, PERFECT hits only — see docs/GAME_DESIGN.md. */
  showImpactFlash: boolean;
}

type ResolvedQuality = Exclude<HitQuality, "miss">;

const IDLE_FRAME_MS = 220;
const PREPARE_FRAME_MS = 150;
const MISS_FRAME_MS = 150;
const MISS_FRAME_COUNT = 3;
const IDLE_FRAME_COUNT = 4;

// Contact/recover durations differ by quality so PERFECT reads as a crisp,
// fast swing and LATE as a heavier, delayed one — see the user-facing spec
// in docs/PROGRESS.md. Quality is only known once the engine resolves the
// hit, so (unlike a real windup) PREPARE itself can't be quality-scaled —
// only what happens from CONTACT onward.
const CONTACT_MS: Record<ResolvedQuality, number> = { perfect: 70, good: 100, late: 150 };
const RECOVER_MS: Record<ResolvedQuality, number> = { perfect: 110, good: 170, late: 260 };
const IMPACT_FLASH_MS = 60;

/** Visual-only anticipation window — Leo raises his racquet once the ball is
 * this close on X, well before REACH_X_LATE decides an actual hit/miss. Pure
 * presentation, doesn't touch any reach/collision constant. */
const PREPARE_APPROACH_DISTANCE = 180;

/** JS's `%` returns a negative result for a negative dividend (unlike most
 * math conventions), which would index a sprite array with e.g. -1. `dt` is
 * expected to be >= 0, but a browser's very first requestAnimationFrame
 * timestamp is occasionally earlier than the `performance.now()) captured
 * synchronously just before it, producing one negative dt — this keeps a
 * stray negative elapsed time from ever turning into an invalid array index
 * instead of just relying on the caller never passing one. */
function safeFrameIndex(elapsedMs: number, frameMs: number, frameCount: number): number {
  return ((Math.floor(elapsedMs / frameMs) % frameCount) + frameCount) % frameCount;
}

export class LeoAnimator {
  private state: LeoAnimState = "idle";
  private elapsedMs = 0;
  private quality: ResolvedQuality = "good";

  update(dtSeconds: number, prevSnapshot: GameSnapshot, nextSnapshot: GameSnapshot, hitPressed: boolean): void {
    this.elapsedMs = Math.max(0, this.elapsedMs + dtSeconds * 1000);

    const swingAttempted = prevSnapshot.ball.owner === "leo" && hitPressed;
    if (swingAttempted) {
      const result = nextSnapshot.leo.lastShot;
      if (result === "miss") {
        this.state = "miss";
      } else if (result) {
        this.quality = result;
        this.state = "contact";
      }
      this.elapsedMs = 0;
      return;
    }

    if (this.state === "contact" && this.elapsedMs >= CONTACT_MS[this.quality]) {
      this.state = "recover";
      this.elapsedMs = 0;
      return;
    }
    if (this.state === "recover" && this.elapsedMs >= RECOVER_MS[this.quality]) {
      this.state = "idle";
      this.elapsedMs = 0;
      return;
    }
    if (this.state === "miss" && this.elapsedMs >= MISS_FRAME_MS * MISS_FRAME_COUNT) {
      this.state = "idle";
      this.elapsedMs = 0;
      return;
    }

    if (this.state === "idle" || this.state === "prepare") {
      const ball = nextSnapshot.ball;
      const leo = nextSnapshot.leo;
      const approaching = ball.owner === "leo" && Math.abs(ball.x - leo.x) < PREPARE_APPROACH_DISTANCE;
      if (approaching && this.state !== "prepare") {
        this.state = "prepare";
        this.elapsedMs = 0;
      } else if (!approaching && this.state === "prepare") {
        this.state = "idle";
        this.elapsedMs = 0;
      }
    }
  }

  getFrame(): LeoAnimationFrame {
    switch (this.state) {
      case "idle":
        return { state: "idle", frameIndex: safeFrameIndex(this.elapsedMs, IDLE_FRAME_MS, IDLE_FRAME_COUNT), showImpactFlash: false };
      case "prepare":
        return { state: "prepare", frameIndex: safeFrameIndex(this.elapsedMs, PREPARE_FRAME_MS, 2), showImpactFlash: false };
      case "contact":
        return {
          state: "contact",
          frameIndex: 0,
          showImpactFlash: this.quality === "perfect" && this.elapsedMs < IMPACT_FLASH_MS,
        };
      case "recover":
        return { state: "recover", frameIndex: 0, showImpactFlash: false };
      case "miss":
        return {
          state: "miss",
          frameIndex: Math.min(MISS_FRAME_COUNT - 1, Math.max(0, Math.floor(this.elapsedMs / MISS_FRAME_MS))),
          showImpactFlash: false,
        };
    }
  }
}
