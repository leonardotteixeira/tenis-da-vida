/**
 * Serve-side positioning and serve-contact timing classification — pure
 * functions, no engine state, no rendering. See docs/PROGRESS.md "Etapa 5"
 * for the rules these implement and why they're simplified from real tennis.
 */

import { COURT } from "@/game/court/geometry";
import { SERVE_GOOD_WINDOW_MS, SERVE_PERFECT_WINDOW_MS, SERVE_TOSS_IDEAL_MS } from "@/game/constants";

export type ServeSide = "deuce" | "ad";
export type ServeQuality = "perfect" | "good" | "miss";

/**
 * Deuce court when the total points played so far in the current game is
 * even (0, 2, 4…), ad court when odd — the standard tennis alternation rule.
 * Simplified from real tennis: this engine has no left/right-handedness or
 * true cross-court diagonal model (see game/court/geometry.ts's coordinate
 * system), so both the server and the receiver share the same lateral half
 * for a given side, rather than diagonally opposite boxes.
 */
export function getServeSide(totalPointsInGame: number): ServeSide {
  return totalPointsInGame % 2 === 0 ? "deuce" : "ad";
}

/**
 * Lateral (Y) stance for a serve on `side` — the midpoint of that half of
 * the singles court, derived from COURT (game/court/geometry.ts), the
 * single source of truth for court topology. No magic numbers here.
 */
export function computeServeY(side: ServeSide): number {
  return side === "deuce"
    ? (COURT.singlesTop + COURT.centerServiceY) / 2
    : (COURT.centerServiceY + COURT.singlesBottom) / 2;
}

/**
 * Classifies a serve-contact attempt by how close `elapsedMs` (time since
 * the toss started) is to the ideal contact instant — deterministic, no
 * randomness, no CPU-style error roll. Symmetric: both too-early and
 * too-late attempts fall outside the windows and read as "miss".
 */
export function classifyServeTiming(elapsedMs: number): ServeQuality {
  const delta = Math.abs(elapsedMs - SERVE_TOSS_IDEAL_MS);
  if (delta <= SERVE_PERFECT_WINDOW_MS) return "perfect";
  if (delta <= SERVE_GOOD_WINDOW_MS) return "good";
  return "miss";
}
