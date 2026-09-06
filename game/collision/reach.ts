/**
 * Reach and boundary checks — purely geometric, no physics stepping, no
 * rendering. See docs/GAME_DESIGN.md "Sistema de Rebatida" for the
 * hit-quality thresholds this implements.
 */

import { MAX_REACHABLE_Z, REACH_X_GOOD, REACH_X_LATE, REACH_X_PERFECT, REACH_Y } from "@/game/constants";
import type { BallState, HitQuality, PlayerState, Side } from "@/game/types";

/** Evaluates a hit attempt at the current instant — does not mutate anything. */
export function evaluateHitAttempt(ball: BallState, player: PlayerState): HitQuality {
  const dx = Math.abs(ball.x - player.x);
  const dy = Math.abs(ball.y - player.y);

  if (dy > REACH_Y) return "miss";
  if (ball.z > MAX_REACHABLE_Z) return "miss";

  if (dx <= REACH_X_PERFECT) return "perfect";
  if (dx <= REACH_X_GOOD) return "good";
  if (dx <= REACH_X_LATE) return "late";
  return "miss";
}

/** True once the ball has traveled past a player's baseline without being hit — an automatic point loss. */
export function hasBallPassedPlayer(ball: BallState, player: PlayerState, side: Side): boolean {
  if (side === "leo") return ball.x < player.x - REACH_X_LATE;
  return ball.x > player.x + REACH_X_LATE;
}

export function isOutOfBounds(ball: BallState, courtWidth: number): boolean {
  return ball.y < 0 || ball.y > courtWidth;
}

/** A 2nd bounce before the ball is returned ends the point (standard tennis rule, simplified). */
export function isDoubleBounce(ball: BallState): boolean {
  return ball.bounceCount >= 2;
}
