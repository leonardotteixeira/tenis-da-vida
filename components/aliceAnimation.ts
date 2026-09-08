/**
 * Alice's animator — the shared PlayerAnimator (components/playerAnimation.ts)
 * configured for Alice's sheet: 3 preparation frames per shot side, 2 miss
 * frames, and her difficulty's top speed (the walk/run boundary scales with
 * it, so on "easy" she jogs at the pace she actually moves). Her derived
 * frames all face left (toward the net from her baseline) — IDLE/MISS were
 * mirrored at extraction time, see
 * public/assets/characters/alice/derived/FRAME_MAP.md.
 */
import { DIFFICULTY_PARAMS } from "@/game/difficulty/params";
import type { Difficulty } from "@/game/types";
import { PlayerAnimator, type PlayerAnimationFrame, type PlayerAnimState, type ShotSide } from "@/components/playerAnimation";

export type AliceAnimState = PlayerAnimState;
export type AliceAnimationFrame = PlayerAnimationFrame;
export type { ShotSide };

export const ALICE_PREPARE_FRAME_COUNT = 3;
export const ALICE_MISS_FRAME_COUNT = 2;

export class AliceAnimator extends PlayerAnimator {
  constructor(difficulty: Difficulty = "normal") {
    super({
      side: "alice",
      prepareFrames: ALICE_PREPARE_FRAME_COUNT,
      missFrames: ALICE_MISS_FRAME_COUNT,
      maxSpeed: DIFFICULTY_PARAMS[difficulty].maxMoveSpeed,
    });
  }
}
