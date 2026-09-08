import { describe, expect, it } from "vitest";
import { evaluateHitAttempt, hasBallPassedPlayer, isDoubleBounce, isOutOfBounds } from "@/game/collision/reach";
import type { BallState, PlayerState } from "@/game/types";

function ball(overrides: Partial<BallState> = {}): BallState {
  return { x: 60, y: 250, z: 0, vx: 0, vy: 0, vz: 0, owner: "leo", lastHitBy: "alice", state: "in_play", bounceCount: 0, ...overrides };
}

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return { side: "leo", x: 60, y: 250, vy: 0, lastShot: null, ...overrides };
}

describe("evaluateHitAttempt", () => {
  it("returns perfect when the ball is exactly at the player's X and Y", () => {
    expect(evaluateHitAttempt(ball({ x: 60, y: 250 }), player({ x: 60, y: 250 }))).toBe("perfect");
  });

  it("returns good for a small X gap", () => {
    expect(evaluateHitAttempt(ball({ x: 90, y: 250 }), player({ x: 60, y: 250 }))).toBe("good");
  });

  it("returns late for a larger X gap still within range", () => {
    expect(evaluateHitAttempt(ball({ x: 115, y: 250 }), player({ x: 60, y: 250 }))).toBe("late");
  });

  it("returns miss when the X gap is too large", () => {
    expect(evaluateHitAttempt(ball({ x: 300, y: 250 }), player({ x: 60, y: 250 }))).toBe("miss");
  });

  it("returns miss when the ball is laterally (Y) out of reach, even with perfect timing", () => {
    expect(evaluateHitAttempt(ball({ x: 60, y: 400 }), player({ x: 60, y: 250 }))).toBe("miss");
  });

  it("returns miss when the ball is too high to reach", () => {
    expect(evaluateHitAttempt(ball({ x: 60, y: 250, z: 500 }), player({ x: 60, y: 250 }))).toBe("miss");
  });
});

describe("hasBallPassedPlayer", () => {
  it("leo: true once the ball is behind his baseline", () => {
    expect(hasBallPassedPlayer(ball({ x: -10 }), player({ x: 60 }), "leo")).toBe(true);
  });

  it("leo: false while the ball is still approaching", () => {
    expect(hasBallPassedPlayer(ball({ x: 200 }), player({ x: 60 }), "leo")).toBe(false);
  });

  it("alice: true once the ball is behind her baseline", () => {
    expect(hasBallPassedPlayer(ball({ x: 1010 }), player({ x: 940, side: "alice" }), "alice")).toBe(true);
  });
});

describe("isOutOfBounds", () => {
  it("false within court width", () => {
    expect(isOutOfBounds(ball({ y: 250 }), 500)).toBe(false);
  });
  it("true below zero", () => {
    expect(isOutOfBounds(ball({ y: -1 }), 500)).toBe(true);
  });
  it("true above court width", () => {
    expect(isOutOfBounds(ball({ y: 501 }), 500)).toBe(true);
  });
});

describe("isDoubleBounce", () => {
  it("false with 0 or 1 bounce", () => {
    expect(isDoubleBounce(ball({ bounceCount: 0 }))).toBe(false);
    expect(isDoubleBounce(ball({ bounceCount: 1 }))).toBe(false);
  });
  it("true with 2+ bounces", () => {
    expect(isDoubleBounce(ball({ bounceCount: 2 }))).toBe(true);
  });
});
