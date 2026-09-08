import { describe, expect, it } from "vitest";
import { cpuDesiredVelocity, stepLateralMotion } from "@/game/player/movement";
import { CPU_ACCEL, CPU_ARRIVE_EPSILON, CPU_BRAKE_TIME, PLAYER_ACCEL, PLAYER_MOVE_SPEED } from "@/game/constants";

const DT = 1 / 60;

describe("stepLateralMotion", () => {
  it("ramps velocity up by at most accel*dt per step and reaches full speed within ~90ms for Leo", () => {
    let m = { y: 250, vy: 0 };
    m = stepLateralMotion(m, PLAYER_MOVE_SPEED, PLAYER_ACCEL, DT, 0, 500);
    expect(m.vy).toBeCloseTo(PLAYER_ACCEL * DT, 5);
    expect(m.vy).toBeLessThan(PLAYER_MOVE_SPEED);

    let frames = 1;
    while (m.vy < PLAYER_MOVE_SPEED && frames < 60) {
      m = stepLateralMotion(m, PLAYER_MOVE_SPEED, PLAYER_ACCEL, DT, 0, 500);
      frames++;
    }
    expect(m.vy).toBe(PLAYER_MOVE_SPEED);
    expect(frames * DT).toBeLessThanOrEqual(0.1);
  });

  it("brakes through zero on a reversal instead of flipping sign instantly", () => {
    let m = { y: 250, vy: PLAYER_MOVE_SPEED };
    m = stepLateralMotion(m, -PLAYER_MOVE_SPEED, PLAYER_ACCEL, DT, 0, 500);
    expect(m.vy).toBeGreaterThan(0); // still moving the old way, just slower
    expect(m.vy).toBeLessThan(PLAYER_MOVE_SPEED);
    for (let i = 0; i < 20; i++) m = stepLateralMotion(m, -PLAYER_MOVE_SPEED, PLAYER_ACCEL, DT, 0, 500);
    expect(m.vy).toBe(-PLAYER_MOVE_SPEED);
  });

  it("decelerates to a full stop over several frames when the target velocity drops to zero", () => {
    let m = { y: 250, vy: PLAYER_MOVE_SPEED };
    const positions: number[] = [];
    for (let i = 0; i < 10; i++) {
      m = stepLateralMotion(m, 0, PLAYER_ACCEL, DT, 0, 500);
      positions.push(m.y);
    }
    expect(m.vy).toBe(0);
    // Kept moving forward while braking (no snap-stop), never backward.
    for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
    expect(positions[positions.length - 1]).toBeGreaterThan(250);
  });

  it("clamps to the court and zeroes the velocity against the wall", () => {
    let m = { y: 498, vy: PLAYER_MOVE_SPEED };
    m = stepLateralMotion(m, PLAYER_MOVE_SPEED, PLAYER_ACCEL, DT, 0, 500);
    expect(m.y).toBe(500);
    expect(m.vy).toBe(0);
    const back = stepLateralMotion(m, -PLAYER_MOVE_SPEED, PLAYER_ACCEL, DT, 0, 500);
    expect(back.y).toBeLessThan(500);
  });
});

describe("cpuDesiredVelocity", () => {
  it("asks for full speed while far from the target, in the right direction", () => {
    expect(cpuDesiredVelocity(300, 240, CPU_BRAKE_TIME, CPU_ARRIVE_EPSILON)).toBe(240);
    expect(cpuDesiredVelocity(-300, 240, CPU_BRAKE_TIME, CPU_ARRIVE_EPSILON)).toBe(-240);
  });

  it("eases off inside the braking distance and is exactly zero inside the arrival dead zone", () => {
    const close = cpuDesiredVelocity(12, 240, CPU_BRAKE_TIME, CPU_ARRIVE_EPSILON);
    expect(close).toBeGreaterThan(0);
    expect(close).toBeLessThan(240);
    expect(cpuDesiredVelocity(CPU_ARRIVE_EPSILON, 240, CPU_BRAKE_TIME, CPU_ARRIVE_EPSILON)).toBe(0);
    expect(cpuDesiredVelocity(-1, 240, CPU_BRAKE_TIME, CPU_ARRIVE_EPSILON)).toBe(0);
  });

  it("settles on a fixed target without overshooting or oscillating when driven through stepLateralMotion", () => {
    let m = { y: 100, vy: 0 };
    const target = 350;
    let reversals = 0;
    let lastSign = 0;
    for (let i = 0; i < 240; i++) {
      const desired = cpuDesiredVelocity(target - m.y, 240, CPU_BRAKE_TIME, CPU_ARRIVE_EPSILON);
      m = stepLateralMotion(m, desired, CPU_ACCEL, DT, 0, 500);
      const sign = Math.sign(m.vy);
      if (sign !== 0 && lastSign !== 0 && sign !== lastSign) reversals++;
      if (sign !== 0) lastSign = sign;
      expect(m.y).toBeLessThanOrEqual(target + CPU_ARRIVE_EPSILON + 1);
    }
    expect(reversals).toBe(0);
    expect(Math.abs(m.y - target)).toBeLessThanOrEqual(CPU_ARRIVE_EPSILON + 1);
    expect(m.vy).toBe(0);
  });
});
