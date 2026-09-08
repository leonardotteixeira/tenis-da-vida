/**
 * Alice's AI — deterministic, no machine learning. Predicts where the
 * ball will cross her baseline X using linear extrapolation of its
 * current lateral velocity (vy is constant between hits in this arcade
 * physics model — see game/physics/trajectory.ts), adds a
 * difficulty-dependent error, and moves toward that target. See
 * docs/GAME_DESIGN.md "CPU (Alice)" for the full rationale.
 *
 * This module only *decides where to go*. How she physically gets there
 * (acceleration, braking, arrival) is game/player/movement.ts, and how it
 * looks is components/aliceAnimation.ts — three separate layers.
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
 * Every return path goes through `clampToBounds`.
 *
 * `randomError` must be in [0,1) — it is the *roll* for this shot's
 * positioning error. The engine holds one roll per incoming shot and passes
 * the same value every frame (see GameEngine.launchShot): re-rolling it per
 * frame made the target jump ±positionErrorMax every frame, and Alice
 * visibly vibrated around the ball instead of settling under it. Pass a
 * fixed value in tests for determinism.
 *
 * When the ball is not headed to her, she recovers toward the lateral
 * middle of the court — the neutral ready position a real player returns
 * to between shots — instead of freezing wherever her last shot left her.
 */
export function computeCpuTargetY(
  ball: BallState,
  alice: PlayerState,
  params: DifficultyParams,
  randomError: number,
  bounds: PlayableBounds,
): number {
  if (ball.owner !== "alice") {
    return clampToBounds(alice.x, (bounds.minY + bounds.maxY) / 2, bounds).y;
  }
  const predictedY = predictInterceptY(ball, alice.x);
  const error = (randomError * 2 - 1) * params.positionErrorMax;
  return clampToBounds(alice.x, predictedY + error, bounds).y;
}
