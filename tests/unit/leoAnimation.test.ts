import { describe, expect, it } from "vitest";
import { LeoAnimator } from "@/components/leoAnimation";
import { PLAYER_MOVE_SPEED } from "@/game/constants";
import type { GameEvent, GameSnapshot, HitQuality, Side } from "@/game/types";

function snapshot(
  overrides: { ballOwner?: Side; ballX?: number; leoX?: number; leoVy?: number; leoLastShot?: HitQuality | null; lastEvent?: GameEvent | null } = {},
): GameSnapshot {
  const { ballOwner = "alice", ballX = 500, leoX = 60, leoVy = 0, leoLastShot = null, lastEvent = null } = overrides;
  return {
    ball: { x: ballX, y: 250, z: 0, vx: 0, vy: 0, vz: 0, owner: ballOwner, lastHitBy: null, state: "in_play", bounceCount: 0 },
    leo: { side: "leo", x: leoX, y: 250, vy: leoVy, lastShot: leoLastShot },
    alice: { side: "alice", x: 940, y: 250, vy: 0, lastShot: null },
    score: { points: [0, 0], games: [0, 0], sets: [0, 0], server: "leo" },
    rally: { count: 0, level: 1, speedMultiplier: 1 },
    phase: "rally",
    lastEvent,
  };
}

const NEUTRAL = snapshot();

describe("LeoAnimator", () => {
  it("starts idle with a valid, in-range frame index", () => {
    const animator = new LeoAnimator();
    const frame = animator.getFrame();
    expect(frame.state).toBe("idle");
    expect(frame.frameIndex).toBeGreaterThanOrEqual(0);
    expect(frame.frameIndex).toBeLessThan(4);
  });

  // Regression test: a browser's very first requestAnimationFrame timestamp
  // can occasionally land before the `performance.now()` captured just
  // before it, producing a negative dt on frame 1. Before this fix, that
  // drove `elapsedMs` negative, and JS's `%` returns a negative result for a
  // negative dividend (e.g. -1), which indexed the sprite array with -1 and
  // threw "Cannot read properties of undefined" — crashing render() before
  // Leo, Alice, or the ball ever got drawn.
  it("never produces a negative frameIndex or an invalid state, even with a negative dt on the very first frame", () => {
    const animator = new LeoAnimator();
    expect(() => animator.update(-0.05, NEUTRAL, NEUTRAL)).not.toThrow();
    const frame = animator.getFrame();
    expect(frame.frameIndex).toBeGreaterThanOrEqual(0);
    expect(["idle", "walk", "run", "prepare", "contact", "recover", "miss", "celebrate"]).toContain(frame.state);
  });

  it("stays idle-safe across many consecutive negative-dt frames", () => {
    const animator = new LeoAnimator();
    for (let i = 0; i < 20; i++) animator.update(-0.016, NEUTRAL, NEUTRAL);
    const frame = animator.getFrame();
    expect(frame.frameIndex).toBeGreaterThanOrEqual(0);
    expect(frame.frameIndex).toBeLessThan(4);
  });

  it("enters PREPARE once the ball is within the approach window on leo's side", () => {
    const animator = new LeoAnimator();
    const far = snapshot({ ballOwner: "leo", ballX: 500, leoX: 60 });
    animator.update(0.016, NEUTRAL, far);
    expect(animator.getFrame().state).toBe("idle");

    const near = snapshot({ ballOwner: "leo", ballX: 100, leoX: 60 });
    animator.update(0.016, far, near);
    expect(animator.getFrame().state).toBe("prepare");
  });

  /**
   * CONTACT is driven by the engine's own `lastEvent` — not by raw per-frame
   * input. This is what makes it correct for BOTH a buffered rally return
   * (the connecting frame can land after the key was actually pressed — see
   * PLAYER_HIT_BUFFER_MS in game/constants.ts) and a serve (ball.owner is
   * the *receiver*, "alice", throughout Leo's own toss and contact — never
   * "leo" — see GameEngine.startToss), which is exactly why
   * `ballOwner: "alice"` below is deliberate, not an oversight.
   */
  it("enters CONTACT on the exact frame the engine resolves a non-miss swing (rally or serve)", () => {
    const animator = new LeoAnimator();
    const next = snapshot({ ballOwner: "alice", ballX: 65, leoX: 60, leoLastShot: "good", lastEvent: { type: "hit", side: "leo", quality: "good" } });
    animator.update(0.016, NEUTRAL, next);
    expect(animator.getFrame().state).toBe("contact");
  });

  it("enters MISS when the engine resolves the swing (buffered rally attempt or serve fault) as a miss", () => {
    const animator = new LeoAnimator();
    const next = snapshot({ ballOwner: "leo", ballX: 300, leoX: 60, leoLastShot: "miss" });
    animator.update(0.016, NEUTRAL, next);
    const frame = animator.getFrame();
    expect(frame.state).toBe("miss");
    expect(frame.frameIndex).toBeGreaterThanOrEqual(0);
  });

  it("does not enter CONTACT or MISS without a real resolving signal from the engine", () => {
    const animator = new LeoAnimator();
    animator.update(0.016, NEUTRAL, snapshot({ ballOwner: "alice", leoLastShot: null, lastEvent: null }));
    expect(animator.getFrame().state).toBe("idle");
  });

  it("does not restart the MISS animation on a repeated miss read across frames", () => {
    const animator = new LeoAnimator();
    const missSnap = snapshot({ ballOwner: "leo", leoLastShot: "miss" });
    animator.update(0.016, NEUTRAL, missSnap);
    expect(animator.getFrame().state).toBe("miss");
    const frameIndexAfterFirst = animator.getFrame().frameIndex;

    animator.update(0.016, missSnap, missSnap); // same "miss" value again, one frame later
    // elapsedMs kept advancing instead of resetting to 0 — proves the
    // animation wasn't restarted from scratch.
    expect(animator.getFrame().state).toBe("miss");
    expect(animator.getFrame().frameIndex).toBeGreaterThanOrEqual(frameIndexAfterFirst);
  });

  it("walks at moderate lateral speed and runs near top speed, driven by the engine's vy", () => {
    const animator = new LeoAnimator();
    animator.update(0.016, NEUTRAL, snapshot({ leoVy: 80 }));
    expect(animator.getFrame().state).toBe("walk");
    animator.update(0.016, NEUTRAL, snapshot({ leoVy: -PLAYER_MOVE_SPEED }));
    expect(animator.getFrame().state).toBe("run");
    animator.update(0.016, NEUTRAL, snapshot({ leoVy: 0 }));
    expect(animator.getFrame().state).toBe("idle");
  });

  it("celebrates a point he won, then returns to idle", () => {
    const animator = new LeoAnimator();
    animator.update(0.016, NEUTRAL, snapshot({ lastEvent: { type: "point", winner: "leo" } }));
    expect(animator.getFrame().state).toBe("celebrate");
    animator.update(0.5, NEUTRAL, NEUTRAL);
    expect(animator.getFrame().state).toBe("celebrate");
    animator.update(0.6, NEUTRAL, NEUTRAL);
    expect(animator.getFrame().state).toBe("idle");
  });
});
