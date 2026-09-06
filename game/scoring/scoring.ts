/**
 * Traditional tennis scoring: 0/15/30/40/game with deuce/advantage, games
 * per set (6, win by 2), sets per match (best of 3 — see
 * docs/GAME_DESIGN.md "Pontuação e Progressão"). Pure functions over
 * ScoreState only — no side effects, no rendering, no rally/HUD concerns.
 */

import type { ScoreState, Side } from "@/game/types";

const POINT_LABELS = ["0", "15", "30", "40"];

/** Human-readable label for one side's current point count, handling deuce/advantage. */
export function pointLabel(points: number, opponentPoints: number): string {
  if (points >= 3 && opponentPoints >= 3) {
    if (points === opponentPoints) return "40";
    return points > opponentPoints ? "AD" : "40";
  }
  return POINT_LABELS[Math.min(points, 3)];
}

export function createInitialScore(server: Side): ScoreState {
  return { points: [0, 0], games: [0, 0], sets: [0, 0], server };
}

function sideIndex(side: Side): 0 | 1 {
  return side === "leo" ? 0 : 1;
}

function otherIndex(index: 0 | 1): 0 | 1 {
  return index === 0 ? 1 : 0;
}

/** Awards one point to `winner` and rolls it up into games/sets as needed. Returns a new ScoreState. */
export function awardPoint(score: ScoreState, winner: Side): ScoreState {
  const idx = sideIndex(winner);
  const otherIdx = otherIndex(idx);

  const points: [number, number] = [...score.points];
  const games: [number, number] = [...score.games];
  const sets: [number, number] = [...score.sets];

  points[idx] += 1;

  const gameWon = points[idx] >= 4 && points[idx] - points[otherIdx] >= 2;

  if (gameWon) {
    games[idx] += 1;
    points[0] = 0;
    points[1] = 0;

    const setWon = games[idx] >= 6 && games[idx] - games[otherIdx] >= 2;
    if (setWon) {
      sets[idx] += 1;
      games[0] = 0;
      games[1] = 0;
    }
  }

  return { ...score, points, games, sets };
}

export function isMatchOver(score: ScoreState, setsToWin: number = 2): Side | null {
  if (score.sets[0] >= setsToWin) return "leo";
  if (score.sets[1] >= setsToWin) return "alice";
  return null;
}
