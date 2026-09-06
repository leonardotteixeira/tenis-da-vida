import { describe, expect, it } from "vitest";
import { computeCpuTargetY, moveToward, predictInterceptY } from "@/game/cpu/ai";
import { COURT } from "@/game/court/geometry";
import { DIFFICULTY_PARAMS, applyHitError } from "@/game/difficulty/params";
import type { BallState, PlayerState } from "@/game/types";

const ALICE_BOUNDS = COURT.alicePlayableBounds;

function ball(overrides: Partial<BallState> = {}): BallState {
  return { x: 0, y: 250, z: 0, vx: 100, vy: 0, vz: 0, owner: "alice", lastHitBy: "leo", state: "in_play", bounceCount: 0, ...overrides };
}

describe("predictInterceptY", () => {
  it("returns the current Y when vx is 0 (no horizontal motion to extrapolate)", () => {
    expect(predictInterceptY(ball({ vx: 0, y: 100 }), 940)).toBe(100);
  });

  it("extrapolates linearly for constant lateral velocity", () => {
    // ball at x=0 moving vx=100, vy=50; alice at x=200 -> time=2s -> y = 250 + 50*2 = 350
    const result = predictInterceptY(ball({ x: 0, vx: 100, vy: 50, y: 250 }), 200);
    expect(result).toBeCloseTo(350, 5);
  });

  it("returns current Y if the ball has already passed the target X (negative time)", () => {
    const result = predictInterceptY(ball({ x: 300, vx: 100, y: 250 }), 200);
    expect(result).toBe(250);
  });
});

describe("computeCpuTargetY", () => {
  const alice: PlayerState = { side: "alice", x: 940, y: 250, isSwinging: false, lastShot: null };

  it("holds position when the ball isn't headed to alice", () => {
    const result = computeCpuTargetY(ball({ owner: "leo" }), alice, DIFFICULTY_PARAMS.normal, 0.5, ALICE_BOUNDS);
    expect(result).toBe(alice.y);
  });

  it("adds no error when randomError is exactly 0.5 (midpoint)", () => {
    const result = computeCpuTargetY(ball({ owner: "alice", x: 940, y: 300 }), alice, DIFFICULTY_PARAMS.normal, 0.5, ALICE_BOUNDS);
    expect(result).toBeCloseTo(300, 5);
  });

  it("easy difficulty allows a larger position error than insane", () => {
    const easyResult = computeCpuTargetY(ball({ owner: "alice", y: 300 }), alice, DIFFICULTY_PARAMS.easy, 1, ALICE_BOUNDS);
    const insaneResult = computeCpuTargetY(ball({ owner: "alice", y: 300 }), alice, DIFFICULTY_PARAMS.insane, 1, ALICE_BOUNDS);
    expect(Math.abs(easyResult - 300)).toBeGreaterThan(Math.abs(insaneResult - 300));
  });

  // Regression coverage for the historical bug (see docs/PROGRESS.md):
  // predictedY + error was never clamped, so Alice's target — and
  // eventually her actual position — could land outside the court and
  // stay there. Every path below must respect ALICE_BOUNDS.

  it("clamps to the minimum bound when the predicted position plus a negative error would go below it (Teste 1)", () => {
    // predictedY at the very top sideline (0) + the most negative possible error
    const result = computeCpuTargetY(ball({ owner: "alice", x: 940, y: ALICE_BOUNDS.minY }), alice, DIFFICULTY_PARAMS.normal, 0, ALICE_BOUNDS);
    expect(result).toBeGreaterThanOrEqual(ALICE_BOUNDS.minY);
    expect(result).toBe(ALICE_BOUNDS.minY);
  });

  it("clamps to the maximum bound when the predicted position plus a positive error would exceed it (Teste 2)", () => {
    // predictedY at the very bottom sideline (width) + the most positive possible error
    const result = computeCpuTargetY(ball({ owner: "alice", x: 940, y: ALICE_BOUNDS.maxY }), alice, DIFFICULTY_PARAMS.normal, 1, ALICE_BOUNDS);
    expect(result).toBeLessThanOrEqual(ALICE_BOUNDS.maxY);
    expect(result).toBe(ALICE_BOUNDS.maxY);
  });

  it("stays within bounds across easy/normal/hard/insane at both extremes of randomError (Teste 5)", () => {
    for (const difficulty of ["easy", "normal", "hard", "insane"] as const) {
      const params = DIFFICULTY_PARAMS[difficulty];
      for (const y of [ALICE_BOUNDS.minY, ALICE_BOUNDS.maxY]) {
        for (const randomError of [0, 1]) {
          const result = computeCpuTargetY(ball({ owner: "alice", x: 940, y }), alice, params, randomError, ALICE_BOUNDS);
          expect(result).toBeGreaterThanOrEqual(ALICE_BOUNDS.minY);
          expect(result).toBeLessThanOrEqual(ALICE_BOUNDS.maxY);
        }
      }
    }
  });

  it("clamps the fallback (ball not headed to alice) if her current position is somehow already invalid (Teste 6)", () => {
    const outOfBoundsAlice: PlayerState = { ...alice, y: ALICE_BOUNDS.maxY + 500 };
    const result = computeCpuTargetY(ball({ owner: "leo" }), outOfBoundsAlice, DIFFICULTY_PARAMS.normal, 0.5, ALICE_BOUNDS);
    expect(result).toBe(ALICE_BOUNDS.maxY);
  });

  it("historical regression: predictedY=0, error=-max and predictedY=width, error=+max both used to escape the court — now both land exactly on the boundary", () => {
    const belowCase = computeCpuTargetY(ball({ owner: "alice", x: 940, y: 0 }), alice, DIFFICULTY_PARAMS.normal, 0, ALICE_BOUNDS);
    const aboveCase = computeCpuTargetY(ball({ owner: "alice", x: 940, y: ALICE_BOUNDS.maxY }), alice, DIFFICULTY_PARAMS.normal, 1, ALICE_BOUNDS);

    // Before the fix, these were 0 - positionErrorMax (negative) and
    // width + positionErrorMax (> width) respectively.
    expect(belowCase).toBe(ALICE_BOUNDS.minY);
    expect(aboveCase).toBe(ALICE_BOUNDS.maxY);
  });
});

describe("moveToward", () => {
  it("moves at most maxSpeed*dt per call", () => {
    const result = moveToward(0, 1000, 100, 1);
    expect(result).toBe(100);
  });

  it("snaps to target without overshooting when close enough", () => {
    const result = moveToward(95, 100, 100, 1);
    expect(result).toBe(100);
  });

  it("moves negative direction correctly", () => {
    const result = moveToward(100, 0, 50, 1);
    expect(result).toBe(50);
  });
});

describe("applyHitError", () => {
  it("never downgrades a miss", () => {
    expect(applyHitError("miss", DIFFICULTY_PARAMS.easy, 0)).toBe("miss");
  });

  it("keeps quality when roll is above the error chance", () => {
    expect(applyHitError("perfect", DIFFICULTY_PARAMS.normal, 0.99)).toBe("perfect");
  });

  it("downgrades by exactly one tier when roll is below the error chance", () => {
    expect(applyHitError("perfect", DIFFICULTY_PARAMS.normal, 0)).toBe("good");
    expect(applyHitError("good", DIFFICULTY_PARAMS.normal, 0)).toBe("late");
    expect(applyHitError("late", DIFFICULTY_PARAMS.normal, 0)).toBe("miss");
  });
});
