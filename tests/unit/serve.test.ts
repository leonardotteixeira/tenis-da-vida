import { describe, expect, it } from "vitest";
import { COURT } from "@/game/court/geometry";
import { classifyServeTiming, computeServeY, getServeSide } from "@/game/serve/serve";
import { SERVE_GOOD_WINDOW_MS, SERVE_PERFECT_WINDOW_MS, SERVE_TOSS_IDEAL_MS } from "@/game/constants";

describe("getServeSide", () => {
  it("is the deuce court at the start of a game (0 points played)", () => {
    expect(getServeSide(0)).toBe("deuce");
  });

  it("alternates deuce/ad for every point played, in order", () => {
    const sides = [0, 1, 2, 3, 4, 5, 6, 7].map(getServeSide);
    expect(sides).toEqual(["deuce", "ad", "deuce", "ad", "deuce", "ad", "deuce", "ad"]);
  });

  it("is deterministic — same input always produces the same side", () => {
    expect(getServeSide(10)).toBe(getServeSide(10));
  });

  it("goes back to deuce at the start of a new game (points reset to 0 after any game ends)", () => {
    // A game can end after any number of points (deuce/advantage can run long),
    // but the rule only cares about the total for the *current* game — once
    // that resets to 0 for a new game, it's deuce again regardless of how
    // the previous game (or set) ended.
    expect(getServeSide(0)).toBe("deuce");
  });

  it("goes back to deuce at the start of a new set for the same reason (games AND points reset to 0)", () => {
    expect(getServeSide(0)).toBe("deuce");
  });
});

describe("computeServeY", () => {
  it("returns a Y strictly inside the singles court on both sides", () => {
    for (const side of ["deuce", "ad"] as const) {
      const y = computeServeY(side);
      expect(y).toBeGreaterThan(COURT.singlesTop);
      expect(y).toBeLessThan(COURT.singlesBottom);
    }
  });

  it("deuce is on the near-top half, ad is on the near-bottom half, split by the center service line", () => {
    expect(computeServeY("deuce")).toBeLessThan(COURT.centerServiceY);
    expect(computeServeY("ad")).toBeGreaterThan(COURT.centerServiceY);
  });

  it("is deterministic and symmetric around the center service line", () => {
    const deuceOffset = COURT.centerServiceY - computeServeY("deuce");
    const adOffset = computeServeY("ad") - COURT.centerServiceY;
    expect(deuceOffset).toBeCloseTo(adOffset, 5);
  });
});

describe("classifyServeTiming", () => {
  it("is perfect exactly at the ideal instant", () => {
    expect(classifyServeTiming(SERVE_TOSS_IDEAL_MS)).toBe("perfect");
  });

  it("is perfect anywhere inside the perfect window, on both sides of the ideal instant", () => {
    expect(classifyServeTiming(SERVE_TOSS_IDEAL_MS - SERVE_PERFECT_WINDOW_MS)).toBe("perfect");
    expect(classifyServeTiming(SERVE_TOSS_IDEAL_MS + SERVE_PERFECT_WINDOW_MS)).toBe("perfect");
  });

  it("is good just outside the perfect window but inside the good window, on both sides", () => {
    expect(classifyServeTiming(SERVE_TOSS_IDEAL_MS - SERVE_PERFECT_WINDOW_MS - 1)).toBe("good");
    expect(classifyServeTiming(SERVE_TOSS_IDEAL_MS + SERVE_GOOD_WINDOW_MS)).toBe("good");
  });

  it("is a miss outside the good window, both too early and too late", () => {
    expect(classifyServeTiming(SERVE_TOSS_IDEAL_MS - SERVE_GOOD_WINDOW_MS - 1)).toBe("miss");
    expect(classifyServeTiming(SERVE_TOSS_IDEAL_MS + SERVE_GOOD_WINDOW_MS + 1)).toBe("miss");
  });

  it("is a miss for a press right at the very start of the toss (far too early)", () => {
    expect(classifyServeTiming(0)).toBe("miss");
  });

  it("never uses randomness — same elapsed time always classifies the same way", () => {
    expect(classifyServeTiming(123)).toBe(classifyServeTiming(123));
  });
});
