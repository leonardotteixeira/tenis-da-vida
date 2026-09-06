import { describe, expect, it } from "vitest";
import { LeoAnimator } from "@/components/leoAnimation";
import type { GameSnapshot, HitQuality, Side } from "@/game/types";

function snapshot(overrides: { ballOwner?: Side; ballX?: number; leoX?: number; leoLastShot?: HitQuality | null } = {}): GameSnapshot {
  const { ballOwner = "alice", ballX = 500, leoX = 60, leoLastShot = null } = overrides;
  return {
    ball: { x: ballX, y: 250, z: 0, vx: 0, vy: 0, vz: 0, owner: ballOwner, lastHitBy: null, state: "in_play", bounceCount: 0 },
    leo: { side: "leo", x: leoX, y: 250, isSwinging: false, lastShot: leoLastShot },
    alice: { side: "alice", x: 940, y: 250, isSwinging: false, lastShot: null },
    score: { points: [0, 0], games: [0, 0], sets: [0, 0], server: "leo" },
    rally: { count: 0, level: 1, speedMultiplier: 1 },
    phase: "rally",
    lastEvent: null,
  };
}

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
  // Leo, Alice, or the ball ever got drawn (they're all drawn after the
  // court in GameCanvas.tsx's render()).
  it("never produces a negative frameIndex or an invalid state, even with a negative dt on the very first frame", () => {
    const animator = new LeoAnimator();
    const snap = snapshot();

    expect(() => animator.update(-0.05, snap, snap, false)).not.toThrow();

    const frame = animator.getFrame();
    expect(frame.frameIndex).toBeGreaterThanOrEqual(0);
    expect(["idle", "prepare", "contact", "recover", "miss"]).toContain(frame.state);
  });

  it("stays idle-safe across many consecutive negative-dt frames", () => {
    const animator = new LeoAnimator();
    const snap = snapshot();
    for (let i = 0; i < 20; i++) {
      animator.update(-0.016, snap, snap, false);
    }
    const frame = animator.getFrame();
    expect(frame.frameIndex).toBeGreaterThanOrEqual(0);
    expect(frame.frameIndex).toBeLessThan(4);
  });

  it("enters PREPARE once the ball is within the approach window on leo's side", () => {
    const animator = new LeoAnimator();
    const far = snapshot({ ballOwner: "leo", ballX: 500, leoX: 60 });
    animator.update(0.016, far, far, false);
    expect(animator.getFrame().state).toBe("idle");

    const near = snapshot({ ballOwner: "leo", ballX: 100, leoX: 60 });
    animator.update(0.016, near, near, false);
    expect(animator.getFrame().state).toBe("prepare");
  });

  it("enters CONTACT on the exact frame the engine resolves a non-miss swing", () => {
    const animator = new LeoAnimator();
    const prev = snapshot({ ballOwner: "leo", ballX: 65, leoX: 60, leoLastShot: null });
    const next = snapshot({ ballOwner: "alice", ballX: 65, leoX: 60, leoLastShot: "good" });
    animator.update(0.016, prev, next, true);
    expect(animator.getFrame().state).toBe("contact");
  });

  it("enters MISS when the engine resolves the swing as a miss", () => {
    const animator = new LeoAnimator();
    const prev = snapshot({ ballOwner: "leo", ballX: 300, leoX: 60, leoLastShot: null });
    const next = snapshot({ ballOwner: "leo", ballX: 300, leoX: 60, leoLastShot: "miss" });
    animator.update(0.016, prev, next, true);
    const frame = animator.getFrame();
    expect(frame.state).toBe("miss");
    expect(frame.frameIndex).toBeGreaterThanOrEqual(0);
  });

  it("does not attempt a swing when the ball is not leo's to hit, even if hitPressed is true", () => {
    const animator = new LeoAnimator();
    const prev = snapshot({ ballOwner: "alice" });
    const next = snapshot({ ballOwner: "alice" });
    animator.update(0.016, prev, next, true);
    expect(animator.getFrame().state).toBe("idle");
  });
});
