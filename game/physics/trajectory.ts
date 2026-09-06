/**
 * Arcade projectile physics for the ball: constant gravity, no air drag,
 * no spin. Not a realistic tennis simulation — a convincing, predictable
 * arc that both the player and the CPU can reason about (see
 * docs/GAME_DESIGN.md "Technical Design").
 */

import { ARC_MIN_TIME, GRAVITY, BOUNCE_DAMPING } from "@/game/constants";
import type { BallState } from "@/game/types";

/** Advances the ball's position/velocity by one physics step. Pure — returns a new BallState, never mutates. */
export function stepBallPhysics(ball: BallState, dt: number): BallState {
  const nextX = ball.x + ball.vx * dt;
  const nextY = ball.y + ball.vy * dt;
  const rawNextZ = ball.z + ball.vz * dt + 0.5 * GRAVITY * dt * dt;
  const rawNextVz = ball.vz + GRAVITY * dt;

  let nextZ = rawNextZ;
  let nextVz = rawNextVz;
  let bounceCount = ball.bounceCount;
  let state = ball.state;

  if (rawNextZ <= 0 && ball.state === "in_play") {
    nextZ = 0;
    nextVz = -rawNextVz * BOUNCE_DAMPING;
    bounceCount += 1;
    state = "bouncing";
  } else if (ball.state === "bouncing" && rawNextZ > 0) {
    state = "in_play";
  }

  return {
    ...ball,
    x: nextX,
    y: nextY,
    z: Math.max(0, nextZ),
    vz: nextVz,
    bounceCount,
    state,
  };
}

export interface LaunchVelocity {
  vx: number;
  vy: number;
  vz: number;
  timeToTarget: number;
}

/**
 * Solves for the initial velocity that carries the ball from (fromX,
 * fromY, z=0) to (toX, toY, z=0) at the given horizontal `speed`, using
 * constant gravity. The peak arc height is a natural consequence of
 * `speed` and distance (faster shots are flatter) — it is not an
 * independently settable input, because gravity and total flight time
 * together fully determine it once the ball must start and land at z=0.
 */
export function computeLaunchVelocity(params: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  speed: number;
}): LaunchVelocity {
  const dx = params.toX - params.fromX;
  const dy = params.toY - params.fromY;
  const horizontalDistance = Math.hypot(dx, dy);
  const timeToTarget = Math.max(horizontalDistance / params.speed, ARC_MIN_TIME);

  const vx = dx / timeToTarget;
  const vy = dy / timeToTarget;
  // The only vz for which a projectile starting at z=0 under constant
  // gravity returns to z=0 at exactly t=timeToTarget.
  const vz = (-GRAVITY * timeToTarget) / 2;

  return { vx, vy, vz, timeToTarget };
}
