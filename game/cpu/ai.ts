/**
 * Alice's AI — deterministic, no machine learning. Predicts where the
 * ball will cross her baseline X using linear extrapolation of its
 * current lateral velocity (vy is constant between hits in this arcade
 * physics model — see game/physics/trajectory.ts), adds a
 * difficulty-dependent error, and moves toward that target. See
 * docs/GAME_DESIGN.md "CPU (Alice)" for the full rationale.
 */

import type { PlayableBounds } from "@/game/court/geometry";
import { clampToBounds } from "@/game/court/geometry";
import type { BallState, PlayerState } from "@/game/types";
import type { DifficultyParams } from "@/game/difficulty/params";

/** Where the ball's Y will be when it reaches `aliceX`, assuming no further hits — pure kinematics, no randomness. */
export function predictInterceptY(ball: BallState, aliceX: number): number {
  if (ball.vx === 0) return ball.y;
  const timeToArrive = (aliceX - ball.x) / ball.vx;
  if (timeToArrive < 0) return ball.y; // ball already past this X, or moving away — nothing useful to predict
  return ball.y + ball.vy * timeToArrive;
}

/**
 * The Y position Alice should move toward this frame — always inside
 * `bounds` (camada 1 of the two-layer bounds protection; see
 * GameEngine.updateAlicePosition for camada 2, the final-position clamp).
 * Every return path goes through `clampToBounds`, including the
 * "hold position" fallback below: if `alice.y` were ever invalid for any
 * reason, this still returns a valid target rather than perpetuating it.
 *
 * `randomError` must be in [0,1) — pass Math.random() in production, a
 * fixed value in tests for determinism.
 */
export function computeCpuTargetY(
  ball: BallState,
  alice: PlayerState,
  params: DifficultyParams,
  randomError: number,
  bounds: PlayableBounds,
): number {
  if (ball.owner !== "alice") {
    // Ball isn't headed to Alice — hold position rather than drift
    // randomly, but still route through the clamp so a somehow-already-out
    // of bounds position doesn't get echoed back forever.
    return clampToBounds(alice.x, alice.y, bounds).y;
  }
  const predictedY = predictInterceptY(ball, alice.x);
  const error = (randomError * 2 - 1) * params.positionErrorMax;
  return clampToBounds(alice.x, predictedY + error, bounds).y;
}

/** Moves `current` toward `target` at `maxSpeed`, never overshooting. */
export function moveToward(current: number, target: number, maxSpeed: number, dt: number): number {
  const delta = target - current;
  const maxStep = maxSpeed * dt;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}
