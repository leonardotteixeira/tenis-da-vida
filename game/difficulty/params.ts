/**
 * Centralized per-difficulty tuning — see docs/GAME_DESIGN.md "CPU
 * (Alice)". Every number the CPU's behavior depends on lives here, never
 * scattered as a magic number inside game/cpu/ai.ts.
 */

import type { Difficulty } from "@/game/types";

export interface DifficultyParams {
  /** Max lateral speed Alice can move at, world units/s. */
  maxMoveSpeed: number;
  /** Random offset (± this amount) added to Alice's predicted intercept Y. */
  positionErrorMax: number;
  /** Probability [0,1] that Alice's hit attempt is deliberately downgraded a tier (perfect->good, good->late, late->miss). */
  hitErrorChance: number;
  /** Multiplies the base ball speed on every shot Alice hits. */
  ballSpeedMultiplier: number;
}

export const DIFFICULTY_PARAMS: Record<Difficulty, DifficultyParams> = {
  easy: { maxMoveSpeed: 180, positionErrorMax: 70, hitErrorChance: 0.35, ballSpeedMultiplier: 1.0 },
  normal: { maxMoveSpeed: 240, positionErrorMax: 40, hitErrorChance: 0.2, ballSpeedMultiplier: 1.15 },
  hard: { maxMoveSpeed: 300, positionErrorMax: 20, hitErrorChance: 0.1, ballSpeedMultiplier: 1.3 },
  insane: { maxMoveSpeed: 360, positionErrorMax: 8, hitErrorChance: 0.03, ballSpeedMultiplier: 1.5 },
};

const QUALITY_DOWNGRADE: Record<"perfect" | "good" | "late", "good" | "late" | "miss"> = {
  perfect: "good",
  good: "late",
  late: "miss",
};

/** Applies the difficulty's hit-error chance to a computed hit quality. `roll` must be in [0,1) — pass Math.random() in production, a fixed value in tests. */
export function applyHitError(
  quality: "perfect" | "good" | "late" | "miss",
  params: DifficultyParams,
  roll: number,
): "perfect" | "good" | "late" | "miss" {
  if (quality === "miss") return "miss";
  if (roll >= params.hitErrorChance) return quality;
  return QUALITY_DOWNGRADE[quality];
}
