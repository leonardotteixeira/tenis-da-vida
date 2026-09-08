import { describe, expect, it } from "vitest";
import { AliceAnimator } from "@/components/aliceAnimation";
import { RUN_FRAME_COUNT, RUN_UNITS_PER_FRAME, WALK_FRAME_COUNT, WALK_UNITS_PER_FRAME } from "@/components/playerAnimation";
import { DIFFICULTY_PARAMS } from "@/game/difficulty/params";
import type { GameEvent, GameSnapshot, HitQuality, Side } from "@/game/types";

function snapshot(
  overrides: {
    ballOwner?: Side;
    ballX?: number;
    ballY?: number;
    aliceY?: number;
    aliceVy?: number;
    aliceLastShot?: HitQuality | null;
    lastEvent?: GameEvent | null;
  } = {},
): GameSnapshot {
  const { ballOwner = "leo", ballX = 300, ballY = 250, aliceY = 250, aliceVy = 0, aliceLastShot = null, lastEvent = null } = overrides;
  return {
    ball: { x: ballX, y: ballY, z: 0, vx: 0, vy: 0, vz: 0, owner: ballOwner, lastHitBy: null, state: "in_play", bounceCount: 0 },
    leo: { side: "leo", x: 60, y: 250, vy: 0, lastShot: null },
    alice: { side: "alice", x: 940, y: aliceY, vy: aliceVy, lastShot: aliceLastShot },
    score: { points: [0, 0], games: [0, 0], sets: [0, 0], server: "leo" },
    rally: { count: 0, level: 1, speedMultiplier: 1 },
    phase: "rally",
    lastEvent,
  };
}

const NEUTRAL = snapshot();
const DT = 1 / 60;
const MAX = DIFFICULTY_PARAMS.normal.maxMoveSpeed;

describe("AliceAnimator — locomotion", () => {
  it("is idle when standing, walks at low speed and runs near her top speed", () => {
    const a = new AliceAnimator("normal");
    a.update(DT, NEUTRAL, snapshot({ aliceVy: 0 }));
    expect(a.getFrame().state).toBe("idle");
    a.update(DT, NEUTRAL, snapshot({ aliceVy: 60 }));
    expect(a.getFrame().state).toBe("walk");
    a.update(DT, NEUTRAL, snapshot({ aliceVy: -MAX }));
    expect(a.getFrame().state).toBe("run");
  });

  it("advances the run cycle by distance travelled, so the stride is tied to the ground (no foot sliding)", () => {
    const a = new AliceAnimator("normal");
    const fast = snapshot({ aliceVy: MAX });
    a.update(DT, NEUTRAL, fast);
    expect(a.getFrame().state).toBe("run");
    const first = a.getFrame().frameIndex;

    // One full stride: RUN_FRAME_COUNT frames × RUN_UNITS_PER_FRAME units.
    const strideUnits = RUN_FRAME_COUNT * RUN_UNITS_PER_FRAME;
    const seconds = strideUnits / MAX;
    const steps = Math.round(seconds / DT);
    const seen = new Set<number>();
    for (let i = 0; i < steps; i++) {
      a.update(DT, fast, fast);
      seen.add(a.getFrame().frameIndex);
    }
    expect(seen.size).toBe(RUN_FRAME_COUNT); // every frame of the cycle was shown exactly across one stride's worth of ground
    expect(a.getFrame().frameIndex).toBe(first); // and we're back where we started
  });

  it("does not advance the stride while her velocity is zero (never runs in place)", () => {
    const a = new AliceAnimator("normal");
    const walking = snapshot({ aliceVy: 60 });
    a.update(DT, NEUTRAL, walking);
    const start = a.getFrame().frameIndex;
    // Still "walking" state-wise on this frame, but with no ground covered
    // the leg cycle must not move: feed the same low speed for a tiny dt.
    a.update(0, walking, walking);
    expect(a.getFrame().frameIndex).toBe(start);
    // Sanity: covering exactly one walk frame's worth of ground moves it by one.
    a.update(WALK_UNITS_PER_FRAME / 60, walking, walking);
    expect(a.getFrame().frameIndex).toBe((start + 1) % WALK_FRAME_COUNT);
  });

  it("keeps the stride phase when shifting between walk and run instead of resetting the legs", () => {
    const a = new AliceAnimator("normal");
    const walking = snapshot({ aliceVy: 60 });
    a.update(DT, NEUTRAL, walking);
    for (let i = 0; i < 20; i++) a.update(DT, walking, walking);
    expect(a.getFrame().state).toBe("walk");
    const walkIndex = a.getFrame().frameIndex;
    const running = snapshot({ aliceVy: MAX });
    a.update(0, walking, running);
    expect(a.getFrame().state).toBe("run");
    // Same accumulated distance, just re-quantised for the run cycle.
    expect(a.getFrame().frameIndex).toBe(Math.floor((walkIndex * WALK_UNITS_PER_FRAME) / RUN_UNITS_PER_FRAME) % RUN_FRAME_COUNT);
  });

  it("scales the walk/run boundary with the difficulty's top speed", () => {
    const easy = new AliceAnimator("easy");
    const insane = new AliceAnimator("insane");
    const speed = DIFFICULTY_PARAMS.easy.maxMoveSpeed * 0.7;
    easy.update(DT, NEUTRAL, snapshot({ aliceVy: speed }));
    insane.update(DT, NEUTRAL, snapshot({ aliceVy: speed }));
    expect(easy.getFrame().state).toBe("run");
    expect(insane.getFrame().state).toBe("walk");
  });
});

describe("AliceAnimator — swing, miss, celebration", () => {
  it("enters PREPARE (with the forehand/backhand side picked from the ball's lateral position) once the ball is close and hers", () => {
    const a = new AliceAnimator();
    a.update(DT, NEUTRAL, snapshot({ ballOwner: "alice", ballX: 800, ballY: 300, aliceY: 250 }));
    expect(a.getFrame().state).toBe("prepare");
    expect(a.getFrame().shotSide).toBe("forehand");

    const b = new AliceAnimator();
    b.update(DT, NEUTRAL, snapshot({ ballOwner: "alice", ballX: 800, ballY: 100, aliceY: 250 }));
    expect(b.getFrame().state).toBe("prepare");
    expect(b.getFrame().shotSide).toBe("backhand");
  });

  it("prefers PREPARE over RUN when the ball is close, even while still moving", () => {
    const a = new AliceAnimator();
    a.update(DT, NEUTRAL, snapshot({ ballOwner: "alice", ballX: 820, aliceVy: MAX }));
    expect(a.getFrame().state).toBe("prepare");
  });

  it("enters CONTACT on her hit event and walks the contact → recover → idle chain with quality-scaled timing", () => {
    const a = new AliceAnimator();
    a.update(DT, NEUTRAL, snapshot({ lastEvent: { type: "hit", side: "alice", quality: "perfect" }, aliceLastShot: "perfect" }));
    expect(a.getFrame().state).toBe("contact");
    a.update(0.08, NEUTRAL, NEUTRAL); // > 70ms PERFECT contact
    expect(a.getFrame().state).toBe("recover");
    a.update(0.12, NEUTRAL, NEUTRAL); // > 110ms PERFECT recover
    expect(a.getFrame().state).toBe("idle");

    const late = new AliceAnimator();
    late.update(DT, NEUTRAL, snapshot({ lastEvent: { type: "hit", side: "alice", quality: "late" }, aliceLastShot: "late" }));
    late.update(0.08, NEUTRAL, NEUTRAL); // still inside the 150ms LATE contact
    expect(late.getFrame().state).toBe("contact");
  });

  it("ignores Leo's hit events and Leo's misses", () => {
    const a = new AliceAnimator();
    a.update(DT, NEUTRAL, snapshot({ lastEvent: { type: "hit", side: "leo", quality: "good" } }));
    expect(a.getFrame().state).toBe("idle");
    const leoMiss: GameSnapshot = { ...NEUTRAL, leo: { ...NEUTRAL.leo, lastShot: "miss" } };
    a.update(DT, NEUTRAL, leoMiss);
    expect(a.getFrame().state).toBe("idle");
  });

  it("enters MISS once when her lastShot becomes 'miss' and does not restart while the CPU keeps re-reading 'miss'", () => {
    const a = new AliceAnimator();
    const missing = snapshot({ ballOwner: "alice", aliceLastShot: "miss" });
    a.update(DT, NEUTRAL, missing);
    expect(a.getFrame().state).toBe("miss");
    a.update(0.2, missing, missing); // second miss frame
    expect(a.getFrame().state).toBe("miss");
    expect(a.getFrame().frameIndex).toBe(1);
    a.update(0.2, missing, missing); // 2 frames × 150ms elapsed -> back to idle even though lastShot still reads "miss"
    expect(a.getFrame().state).toBe("idle");
  });

  it("celebrates a point/game she won and not one Leo won", () => {
    const a = new AliceAnimator();
    a.update(DT, NEUTRAL, snapshot({ lastEvent: { type: "game", winner: "alice" } }));
    expect(a.getFrame().state).toBe("celebrate");
    expect(a.getFrame().frameIndex).toBeLessThan(2);

    const b = new AliceAnimator();
    b.update(DT, NEUTRAL, snapshot({ lastEvent: { type: "point", winner: "leo" } }));
    expect(b.getFrame().state).toBe("idle");
  });

  it("never produces an out-of-range frame index in any state, even with a negative dt", () => {
    const a = new AliceAnimator();
    const states = [
      snapshot({ aliceVy: 60 }),
      snapshot({ aliceVy: MAX }),
      snapshot({ ballOwner: "alice", ballX: 800 }),
      snapshot({ lastEvent: { type: "hit", side: "alice", quality: "good" } }),
      snapshot({ ballOwner: "alice", aliceLastShot: "miss" }),
      snapshot({ lastEvent: { type: "point", winner: "alice" } }),
    ];
    for (const s of states) {
      expect(() => a.update(-0.02, NEUTRAL, s)).not.toThrow();
      const frame = a.getFrame();
      expect(frame.frameIndex).toBeGreaterThanOrEqual(0);
      expect(frame.frameIndex).toBeLessThan(5);
    }
  });
});
