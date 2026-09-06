/**
 * Leo's lateral movement — clamped to the court's Y range. Pure function,
 * no input-reading (see game/input/keyboard.ts for that).
 */

import { PLAYER_MOVE_SPEED } from "@/game/constants";

export function applyPlayerMovement(
  currentY: number,
  direction: -1 | 0 | 1,
  dt: number,
  courtWidth: number,
): number {
  const nextY = currentY + direction * PLAYER_MOVE_SPEED * dt;
  return Math.max(0, Math.min(courtWidth, nextY));
}
