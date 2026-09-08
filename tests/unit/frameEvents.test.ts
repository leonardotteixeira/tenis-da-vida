import { describe, expect, it } from "vitest";
import { readFrameEvents } from "@/components/frameEvents";
import { MatchStatsTracker } from "@/components/matchStats";
import { mergeRecords, parseRecords, parseSettings } from "@/components/settings";
import type { BallStateType, GameEvent, GameSnapshot, HitQuality } from "@/game/types";

function snapshot(
  overrides: { ballState?: BallStateType; leoLastShot?: HitQuality | null; aliceLastShot?: HitQuality | null; lastEvent?: GameEvent | null; rally?: number } = {},
): GameSnapshot {
  const { ballState = "in_play", leoLastShot = null, aliceLastShot = null, lastEvent = null, rally = 0 } = overrides;
  return {
    ball: { x: 500, y: 250, z: 0, vx: 400, vy: 0, vz: 0, owner: "alice", lastHitBy: "leo", state: ballState, bounceCount: 0 },
    leo: { side: "leo", x: 60, y: 250, vy: 0, lastShot: leoLastShot },
    alice: { side: "alice", x: 940, y: 250, vy: 0, lastShot: aliceLastShot },
    score: { points: [0, 0], games: [0, 0], sets: [0, 0], server: "leo" },
    rally: { count: rally, level: 1, speedMultiplier: 1 },
    phase: "rally",
    lastEvent,
  };
}

describe("readFrameEvents", () => {
  it("reports nothing on a quiet frame", () => {
    const e = readFrameEvents(snapshot(), snapshot());
    expect(e).toEqual({ hit: null, bounce: false, miss: null, point: null });
  });

  it("reports a hit from the engine's own lastEvent, for either side", () => {
    const e = readFrameEvents(snapshot(), snapshot({ lastEvent: { type: "hit", side: "alice", quality: "late" } }));
    expect(e.hit).toEqual({ side: "alice", quality: "late" });
  });

  it("reports a bounce only on the in_play → bouncing edge", () => {
    expect(readFrameEvents(snapshot({ ballState: "in_play" }), snapshot({ ballState: "bouncing" })).bounce).toBe(true);
    expect(readFrameEvents(snapshot({ ballState: "bouncing" }), snapshot({ ballState: "bouncing" })).bounce).toBe(false);
    expect(readFrameEvents(snapshot({ ballState: "bouncing" }), snapshot({ ballState: "in_play" })).bounce).toBe(false);
  });

  it("reports a miss on the frame lastShot becomes 'miss' and not while it stays 'miss'", () => {
    expect(readFrameEvents(snapshot(), snapshot({ leoLastShot: "miss" })).miss).toBe("leo");
    expect(readFrameEvents(snapshot({ leoLastShot: "miss" }), snapshot({ leoLastShot: "miss" })).miss).toBeNull();
    expect(readFrameEvents(snapshot({ aliceLastShot: "good" }), snapshot({ aliceLastShot: "miss" })).miss).toBe("alice");
  });

  it("reports an event only on the frame it first appears — a lastEvent that persists across frames (game_over) is not re-reported", () => {
    const over = snapshot({ lastEvent: { type: "match", winner: "leo" } });
    expect(readFrameEvents(snapshot(), over).point?.type).toBe("match");
    expect(readFrameEvents(over, over).point).toBeNull();
    // Same object carried over into a *different* snapshot is still stale.
    const later: GameSnapshot = { ...over, rally: { ...over.rally } };
    expect(readFrameEvents(over, later).point).toBeNull();
  });

  it("reports point/game/set/match events with their winner", () => {
    for (const type of ["point", "game", "set", "match"] as const) {
      const e = readFrameEvents(snapshot(), snapshot({ lastEvent: { type, winner: "alice" } }));
      expect(e.point).toEqual({ type, winner: "alice" });
      expect(e.hit).toBeNull();
    }
  });
});

describe("MatchStatsTracker", () => {
  it("counts Leo's swings by quality, his misses, and the longest rally — ignoring Alice's swings", () => {
    const t = new MatchStatsTracker();
    const quiet = snapshot();
    t.update(quiet, snapshot({ lastEvent: { type: "hit", side: "leo", quality: "perfect" }, rally: 1 }));
    t.update(quiet, snapshot({ lastEvent: { type: "hit", side: "alice", quality: "perfect" }, rally: 2 }));
    t.update(quiet, snapshot({ lastEvent: { type: "hit", side: "leo", quality: "good" }, rally: 3 }));
    t.update(quiet, snapshot({ lastEvent: { type: "hit", side: "leo", quality: "late" }, rally: 4 }));
    t.update(quiet, snapshot({ leoLastShot: "miss" }));
    t.update(snapshot({ leoLastShot: "miss" }), snapshot({ leoLastShot: "miss" })); // same miss, next frame — not a second swing
    t.update(quiet, snapshot({ rally: 0 }));
    expect(t.get()).toEqual({ perfect: 1, good: 1, late: 1, miss: 1, longestRally: 4, accuracy: 0.75 });
  });

  it("reports 0 accuracy (not NaN) when Leo never swung", () => {
    expect(new MatchStatsTracker().get().accuracy).toBe(0);
  });
});

describe("settings persistence helpers", () => {
  it("falls back to defaults for anything malformed and clamps the volume", () => {
    expect(parseSettings(null)).toEqual({ volume: 0.7, difficulty: "normal" });
    expect(parseSettings({ volume: 4, difficulty: "nightmare" })).toEqual({ volume: 1, difficulty: "normal" });
    expect(parseSettings({ volume: 0.25, difficulty: "hard" })).toEqual({ volume: 0.25, difficulty: "hard" });
    expect(parseSettings("garbage")).toEqual({ volume: 0.7, difficulty: "normal" });
  });

  it("parses records defensively and only ever merges upward", () => {
    expect(parseRecords({ longestRally: -3, bestAccuracy: 7, wins: 2.9 })).toEqual({ longestRally: 0, bestAccuracy: 1, wins: 2 });
    const merged = mergeRecords({ longestRally: 10, bestAccuracy: 0.8, wins: 1 }, { longestRally: 6, accuracy: 0.9, leoWon: true });
    expect(merged).toEqual({ longestRally: 10, bestAccuracy: 0.9, wins: 2 });
    expect(mergeRecords(merged, { longestRally: 12, accuracy: 0.1, leoWon: false })).toEqual({ longestRally: 12, bestAccuracy: 0.9, wins: 2 });
  });
});
