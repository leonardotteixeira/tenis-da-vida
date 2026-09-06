/**
 * Presentation-only animation state machine for Alice's swing — same
 * architectural pattern as components/leoAnimation.ts (LeoAnimator): reads
 * consecutive engine snapshots, never mutates or replaces any engine state.
 * See docs/PROGRESS.md "Etapa 4" for the audit that established which parts
 * of LeoAnimator generalize directly and which don't.
 *
 * Key difference from Leo: Leo's swing is gated by a single-frame key press
 * (`hitPressed`), so "a swing was attempted" is unambiguous. Alice's swing is
 * decided entirely by the CPU inside GameEngine.maybeAttemptCpuHit, which can
 * re-evaluate on consecutive frames while the ball is in her reach window.
 * The unambiguous signals used here instead:
 *  - CONTACT (successful hit): `lastEvent.type === "hit" && side === "alice"`,
 *    emitted by GameEngine.launchShot exactly once per connect.
 *  - MISS: `alice.lastShot === "miss"` while she still owns the ball — only
 *    treated as a *new* attempt if we weren't already animating a miss, so a
 *    miss that re-evaluates identically for 2-3 frames (a real possibility at
 *    REACH_X_PERFECT=12 world units and high rally speeds) doesn't restart
 *    the animation from frame 0 every tick.
 */
import type { GameSnapshot, HitQuality } from "@/game/types";

export type AliceAnimState = "idle" | "prepare" | "contact" | "recover" | "miss";
export type ShotSide = "forehand" | "backhand";

export interface AliceAnimationFrame {
  state: AliceAnimState;
  shotSide: ShotSide;
  frameIndex: number;
}

type ResolvedQuality = Exclude<HitQuality, "miss">;

const IDLE_FRAME_MS = 220;
const PREPARE_FRAME_MS = 150;
const MISS_FRAME_MS = 150;
const MISS_FRAME_COUNT = 2; // sheet has 2 usable erro/miss frames, not 3 — see FRAME_MAP.md
const IDLE_FRAME_COUNT = 4;

// Same quality-scaled contact/recover timing as LeoAnimator — no gameplay
// reason for Alice to read differently, and the numbers were already tuned
// to feel right (PERFECT crisp, LATE heavy) — see docs/PROGRESS.md.
const CONTACT_MS: Record<ResolvedQuality, number> = { perfect: 70, good: 100, late: 150 };
const RECOVER_MS: Record<ResolvedQuality, number> = { perfect: 110, good: 170, late: 260 };

const PREPARE_APPROACH_DISTANCE = 180;

function safeFrameIndex(elapsedMs: number, frameMs: number, frameCount: number): number {
  return ((Math.floor(elapsedMs / frameMs) % frameCount) + frameCount) % frameCount;
}

export class AliceAnimator {
  private state: AliceAnimState = "idle";
  private elapsedMs = 0;
  private quality: ResolvedQuality = "good";
  private shotSide: ShotSide = "forehand";

  update(dtSeconds: number, prevSnapshot: GameSnapshot, nextSnapshot: GameSnapshot): void {
    this.elapsedMs = Math.max(0, this.elapsedMs + dtSeconds * 1000);

    const ballWasHers = prevSnapshot.ball.owner === "alice";

    const event = nextSnapshot.lastEvent;
    if (event?.type === "hit" && event.side === "alice") {
      this.quality = event.quality as ResolvedQuality;
      this.shotSide = this.pickShotSide(nextSnapshot);
      this.state = "contact";
      this.elapsedMs = 0;
      return;
    }

    const justMissed = ballWasHers && nextSnapshot.ball.owner === "alice" && nextSnapshot.alice.lastShot === "miss";
    if (justMissed && this.state !== "miss") {
      this.state = "miss";
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
      const alice = nextSnapshot.alice;
      const approaching = ball.owner === "alice" && Math.abs(ball.x - alice.x) < PREPARE_APPROACH_DISTANCE;
      if (approaching && this.state !== "prepare") {
        this.shotSide = this.pickShotSide(nextSnapshot);
        this.state = "prepare";
        this.elapsedMs = 0;
      } else if (!approaching && this.state === "prepare") {
        this.state = "idle";
        this.elapsedMs = 0;
      }
    }
  }

  /**
   * Purely visual forehand/backhand pick — the engine has no concept of shot
   * side (Leo doesn't either, see leo/derived/FRAME_MAP.md), so this reads
   * only already-public snapshot fields (never adds engine state). Ball
   * approaching from the far sideline relative to Alice's current lateral
   * position reads as a forehand; the near side reads as a backhand.
   */
  private pickShotSide(snapshot: GameSnapshot): ShotSide {
    return snapshot.ball.y >= snapshot.alice.y ? "forehand" : "backhand";
  }

  getFrame(): AliceAnimationFrame {
    switch (this.state) {
      case "idle":
        return { state: "idle", shotSide: this.shotSide, frameIndex: safeFrameIndex(this.elapsedMs, IDLE_FRAME_MS, IDLE_FRAME_COUNT) };
      case "prepare":
        return { state: "prepare", shotSide: this.shotSide, frameIndex: safeFrameIndex(this.elapsedMs, PREPARE_FRAME_MS, 3) };
      case "contact":
        return { state: "contact", shotSide: this.shotSide, frameIndex: 0 };
      case "recover":
        // Reuses the last preparation frame (fully wound up) as a static
        // recovery pose — same trick LeoAnimator uses, see its comments.
        return { state: "recover", shotSide: this.shotSide, frameIndex: 2 };
      case "miss":
        return {
          state: "miss",
          shotSide: this.shotSide,
          frameIndex: Math.min(MISS_FRAME_COUNT - 1, Math.max(0, Math.floor(this.elapsedMs / MISS_FRAME_MS))),
        };
    }
  }
}
