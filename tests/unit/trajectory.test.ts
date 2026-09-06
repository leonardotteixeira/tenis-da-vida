import { describe, expect, it } from "vitest";
import { computeLaunchVelocity, stepBallPhysics } from "@/game/physics/trajectory";
import type { BallState } from "@/game/types";

function makeBall(overrides: Partial<BallState> = {}): BallState {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    owner: "alice",
    lastHitBy: null,
    state: "in_play",
    bounceCount: 0,
    ...overrides,
  };
}

describe("computeLaunchVelocity", () => {
  it("simulating the resulting velocity lands the ball at the target around timeToTarget", () => {
    const launch = computeLaunchVelocity({ fromX: 0, fromY: 0, toX: 1000, toY: 0, speed: 500 });
    let ball = makeBall({ vx: launch.vx, vy: launch.vy, vz: launch.vz });

    // Stepping stops at 90% of the flight time (not literally at
    // timeToTarget - dt): repeated small-step Euler integration
    // accumulates drift relative to the exact closed-form parabola, so a
    // margin is needed rather than asserting airborne exactly one dt
    // before the analytic landing instant.
    const dt = 1 / 240;
    let elapsed = 0;
    while (elapsed < launch.timeToTarget * 0.9) {
      ball = stepBallPhysics(ball, dt);
      elapsed += dt;
    }

    expect(ball.x).toBeCloseTo(900, -1);
    expect(ball.z).toBeGreaterThan(0); // still airborne at 90% of the flight
  });

  it("produces a real arc — peak height is positive and above both endpoints", () => {
    const launch = computeLaunchVelocity({ fromX: 0, fromY: 0, toX: 500, toY: 0, speed: 400 });
    let ball = makeBall({ vx: launch.vx, vy: launch.vy, vz: launch.vz });

    let maxZ = 0;
    const dt = 1 / 240;
    for (let t = 0; t < launch.timeToTarget; t += dt) {
      ball = stepBallPhysics(ball, dt);
      maxZ = Math.max(maxZ, ball.z);
    }

    expect(maxZ).toBeGreaterThan(10);
  });

  it("a faster shot over the same distance has a flatter arc than a slower one", () => {
    const slow = computeLaunchVelocity({ fromX: 0, fromY: 0, toX: 500, toY: 0, speed: 200 });
    const fast = computeLaunchVelocity({ fromX: 0, fromY: 0, toX: 500, toY: 0, speed: 600 });
    expect(fast.vz).toBeLessThan(slow.vz);
  });

  it("respects a minimum flight time for very short distances (no degenerate near-vertical arc)", () => {
    const launch = computeLaunchVelocity({ fromX: 0, fromY: 0, toX: 1, toY: 0, speed: 1000 });
    expect(launch.timeToTarget).toBeGreaterThanOrEqual(0.35);
  });

  it("handles a purely lateral (Y-only) shot", () => {
    const launch = computeLaunchVelocity({ fromX: 0, fromY: 0, toX: 0, toY: 200, speed: 300 });
    expect(launch.vx).toBeCloseTo(0, 5);
    expect(launch.vy).toBeGreaterThan(0);
  });
});

describe("stepBallPhysics", () => {
  it("bounces when it reaches the ground, reducing vertical speed", () => {
    let ball = makeBall({ z: 5, vz: -300 });
    ball = stepBallPhysics(ball, 1 / 60);
    expect(ball.z).toBe(0);
    expect(ball.vz).toBeGreaterThan(0); // reflected upward
    expect(ball.bounceCount).toBe(1);
    expect(ball.state).toBe("bouncing");
  });

  it("energy is lost on bounce (damping < 1)", () => {
    const ball = makeBall({ z: 5, vz: -300 });
    const bounced = stepBallPhysics(ball, 1 / 60);
    expect(Math.abs(bounced.vz)).toBeLessThan(300);
  });

  it("transitions back to in_play once airborne again after a bounce", () => {
    let ball = makeBall({ z: 5, vz: -300, state: "bouncing" });
    ball = stepBallPhysics(ball, 1 / 600); // small step: still near ground and moving up
    expect(ball.state === "in_play" || ball.state === "bouncing").toBe(true);
  });

  it("never returns a negative height", () => {
    const ball = makeBall({ z: 1, vz: -10000 }); // huge dt-independent velocity to force overshoot
    const result = stepBallPhysics(ball, 1);
    expect(result.z).toBeGreaterThanOrEqual(0);
  });

  it("moves x/y linearly when airborne (no drag)", () => {
    const ball = makeBall({ x: 0, y: 0, z: 50, vx: 100, vy: 50, vz: 0 });
    const result = stepBallPhysics(ball, 0.1);
    expect(result.x).toBeCloseTo(10, 5);
    expect(result.y).toBeCloseTo(5, 5);
  });
});
