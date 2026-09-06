import { describe, expect, it } from "vitest";
import { awardPoint, createInitialScore, isMatchOver, pointLabel } from "@/game/scoring/scoring";

describe("pointLabel", () => {
  it("maps 0/1/2/3 to 0/15/30/40", () => {
    expect(pointLabel(0, 0)).toBe("0");
    expect(pointLabel(1, 0)).toBe("15");
    expect(pointLabel(2, 0)).toBe("30");
    expect(pointLabel(3, 0)).toBe("40");
  });

  it("shows 40-40 as deuce (both at 40)", () => {
    expect(pointLabel(3, 3)).toBe("40");
    expect(pointLabel(4, 4)).toBe("40");
  });

  it("shows AD for the side ahead past deuce", () => {
    expect(pointLabel(4, 3)).toBe("AD");
    expect(pointLabel(3, 4)).toBe("40");
  });
});

describe("awardPoint", () => {
  it("increments points without reaching a game", () => {
    let score = createInitialScore("leo");
    score = awardPoint(score, "leo");
    expect(score.points).toEqual([1, 0]);
    expect(score.games).toEqual([0, 0]);
  });

  it("wins a game at 4 points with a 2-point lead, resetting points", () => {
    let score = createInitialScore("leo");
    for (let i = 0; i < 4; i++) score = awardPoint(score, "leo");
    expect(score.games).toEqual([1, 0]);
    expect(score.points).toEqual([0, 0]);
  });

  it("does not win the game at 4-3 (needs a 2-point lead)", () => {
    let score = createInitialScore("leo");
    score = awardPoint(score, "leo");
    score = awardPoint(score, "leo");
    score = awardPoint(score, "leo");
    score = awardPoint(score, "alice");
    score = awardPoint(score, "alice");
    score = awardPoint(score, "alice");
    score = awardPoint(score, "leo"); // 4-3
    expect(score.games).toEqual([0, 0]);
    score = awardPoint(score, "leo"); // 5-3, +2 lead
    expect(score.games).toEqual([1, 0]);
  });

  it("wins a set at 6 games with a 2-game lead", () => {
    let score = createInitialScore("leo");
    for (let g = 0; g < 6; g++) {
      for (let p = 0; p < 4; p++) score = awardPoint(score, "leo");
    }
    expect(score.sets).toEqual([1, 0]);
    expect(score.games).toEqual([0, 0]);
  });

  it("does not concede a game/set to the opposite side when awarding points to leo repeatedly", () => {
    let score = createInitialScore("leo");
    for (let i = 0; i < 4; i++) score = awardPoint(score, "leo");
    expect(score.points[1]).toBe(0);
  });
});

describe("isMatchOver", () => {
  it("returns null before anyone has 2 sets", () => {
    const score = createInitialScore("leo");
    expect(isMatchOver(score)).toBeNull();
  });

  it("returns the winner once they reach setsToWin", () => {
    let score = createInitialScore("leo");
    score = { ...score, sets: [2, 1] };
    expect(isMatchOver(score)).toBe("leo");
  });

  it("returns alice when alice reaches setsToWin", () => {
    let score = createInitialScore("leo");
    score = { ...score, sets: [0, 2] };
    expect(isMatchOver(score)).toBe("alice");
  });

  it("respects a custom setsToWin", () => {
    let score = createInitialScore("leo");
    score = { ...score, sets: [1, 0] };
    expect(isMatchOver(score, 1)).toBe("leo");
  });
});
