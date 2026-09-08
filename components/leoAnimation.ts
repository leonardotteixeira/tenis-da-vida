/**
 * Leo's animator — the shared PlayerAnimator (components/playerAnimation.ts)
 * configured for Leo's sheet: 2 preparation frames, 3 miss frames, and the
 * keyboard-driven top speed from game/constants.ts. Leo's derived frames
 * face right (toward the net from his baseline) in every group — see
 * public/assets/characters/leo/derived/FRAME_MAP.md.
 */
import { PLAYER_MOVE_SPEED } from "@/game/constants";
import { PlayerAnimator, type PlayerAnimationFrame, type PlayerAnimState } from "@/components/playerAnimation";

export type LeoAnimState = PlayerAnimState;
export type LeoAnimationFrame = PlayerAnimationFrame;

export const LEO_PREPARE_FRAME_COUNT = 2;
export const LEO_MISS_FRAME_COUNT = 3;

export class LeoAnimator extends PlayerAnimator {
  constructor() {
    super({ side: "leo", prepareFrames: LEO_PREPARE_FRAME_COUNT, missFrames: LEO_MISS_FRAME_COUNT, maxSpeed: PLAYER_MOVE_SPEED });
  }
}
