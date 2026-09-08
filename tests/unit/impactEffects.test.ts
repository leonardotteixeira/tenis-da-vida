import { describe, expect, it } from "vitest";
import {
  DUST_COUNT,
  ImpactEffects,
  MAX_PARTICLES,
  SHADOW_SQUASH_MS,
  SHAKE_AMPLITUDE_PX,
  SHAKE_DURATION_MS,
  SPARK_COUNT,
} from "@/components/impactEffects";
import type { BallStateType, GameEvent, GameSnapshot, Side } from "@/game/types";

function snapshot(
  overrides: { ballState?: BallStateType; ballZ?: number; ballX?: number; lastEvent?: GameEvent | null } = {},
): GameSnapshot {
  const { ballState = "in_play", ballZ = 0, ballX = 500, lastEvent = null } = overrides;
  return {
    ball: { x: ballX, y: 250, z: ballZ, vx: 400, vy: 0, vz: 0, owner: "alice", lastHitBy: "leo", state: ballState, bounceCount: 0 },
    leo: { side: "leo", x: 60, y: 250, vy: 0, lastShot: null },
    alice: { side: "alice", x: 940, y: 250, vy: 0, lastShot: null },
    score: { points: [0, 0], games: [0, 0], sets: [0, 0], server: "leo" },
    rally: { count: 0, level: 1, speedMultiplier: 1 },
    phase: "rally",
    lastEvent,
  };
}

function hit(side: Side, quality: "perfect" | "good" | "late"): GameEvent {
  return { type: "hit", side, quality };
}

const DT = 1 / 60;
// Deterministic mid-range roll — keeps every spawn inside its nominal ranges
// without any randomness in the assertions below.
const fixedRandom = () => 0.5;

describe("ImpactEffects — hit sparks", () => {
  it.each([
    ["perfect", SPARK_COUNT.perfect],
    ["good", SPARK_COUNT.good],
    ["late", SPARK_COUNT.late],
  ] as const)("spawns exactly the configured spark count for a %s hit, for either player", (quality, expected) => {
    for (const side of ["leo", "alice"] as const) {
      const fx = new ImpactEffects({ random: fixedRandom });
      fx.update(DT, snapshot(), snapshot({ lastEvent: hit(side, quality) }));
      expect(fx.activeCount("spark")).toBe(expected);
    }
  });

  it("stays within the spec's per-quality ranges (PERFECT 6–8, GOOD 4–6, LATE 2–4)", () => {
    expect(SPARK_COUNT.perfect).toBeGreaterThanOrEqual(6);
    expect(SPARK_COUNT.perfect).toBeLessThanOrEqual(8);
    expect(SPARK_COUNT.good).toBeGreaterThanOrEqual(4);
    expect(SPARK_COUNT.good).toBeLessThanOrEqual(6);
    expect(SPARK_COUNT.late).toBeGreaterThanOrEqual(2);
    expect(SPARK_COUNT.late).toBeLessThanOrEqual(4);
  });

  it("spawns nothing without a hit event or a bounce edge", () => {
    const fx = new ImpactEffects({ random: fixedRandom });
    fx.update(DT, snapshot(), snapshot());
    fx.update(DT, snapshot(), snapshot({ lastEvent: { type: "point", winner: "leo" } }));
    expect(fx.activeCount()).toBe(0);
  });

  it("spawns sparks at the previous frame's ball position (where contact visually happened), never below a small height floor", () => {
    const fx = new ImpactEffects({ random: fixedRandom });
    const prev = snapshot({ ballX: 100, ballZ: 40 });
    const next = snapshot({ ballX: 60, ballZ: 0, lastEvent: hit("leo", "good") });
    fx.update(0, prev, next);
    const spark = fx.particles.find((p) => p.active);
    expect(spark?.x).toBe(100);
    expect(spark?.z).toBe(40);

    const low = new ImpactEffects({ random: fixedRandom });
    low.update(0, snapshot({ ballZ: 0 }), snapshot({ lastEvent: hit("leo", "good") }));
    expect(low.particles.find((p) => p.active)?.z).toBeGreaterThan(0);
  });

  it("expires every particle after its lifetime, freeing the pool", () => {
    const fx = new ImpactEffects({ random: fixedRandom });
    fx.update(DT, snapshot(), snapshot({ lastEvent: hit("leo", "perfect") }));
    expect(fx.activeCount()).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) fx.update(DT, snapshot(), snapshot()); // 1s ≫ max lifetime
    expect(fx.activeCount()).toBe(0);
  });

  it("never exceeds the fixed pool size, even under a burst of hits and bounces on consecutive frames", () => {
    const fx = new ImpactEffects({ random: fixedRandom });
    for (let i = 0; i < 20; i++) {
      fx.update(0, snapshot({ ballState: "in_play" }), snapshot({ ballState: "bouncing", lastEvent: hit("alice", "perfect") }));
      expect(fx.activeCount()).toBeLessThanOrEqual(MAX_PARTICLES);
    }
    expect(fx.particles.length).toBe(MAX_PARTICLES);
    expect(fx.activeCount()).toBe(MAX_PARTICLES);
  });
});

describe("ImpactEffects — bounce dust and shadow squash", () => {
  it("fires once on the in_play → bouncing edge, and not again while the state stays bouncing", () => {
    const fx = new ImpactEffects({ random: fixedRandom });
    fx.update(0, snapshot({ ballState: "in_play" }), snapshot({ ballState: "bouncing" }));
    expect(fx.activeCount("dust")).toBe(DUST_COUNT);
    expect(fx.getShadowSquash()).toBe(1);

    fx.update(0, snapshot({ ballState: "bouncing" }), snapshot({ ballState: "bouncing" }));
    expect(fx.activeCount("dust")).toBe(DUST_COUNT);

    // Leaving and re-entering bouncing is a second, real bounce.
    fx.update(0, snapshot({ ballState: "bouncing" }), snapshot({ ballState: "in_play" }));
    fx.update(0, snapshot({ ballState: "in_play" }), snapshot({ ballState: "bouncing" }));
    expect(fx.activeCount("dust")).toBe(DUST_COUNT * 2);
  });

  it("keeps dust at the court surface, next to the shadow — never up at ball height", () => {
    const fx = new ImpactEffects({ random: fixedRandom });
    fx.update(0, snapshot({ ballState: "in_play" }), snapshot({ ballState: "bouncing" }));
    for (let i = 0; i < 12; i++) fx.update(DT, snapshot(), snapshot());
    for (const p of fx.particles) {
      if (!p.active) continue;
      expect(p.kind).toBe("dust");
      expect(p.z).toBeGreaterThanOrEqual(0);
      expect(p.z).toBeLessThan(15);
    }
  });

  it("eases the shadow squash back to zero over SHADOW_SQUASH_MS", () => {
    const fx = new ImpactEffects({ random: fixedRandom });
    fx.update(0, snapshot({ ballState: "in_play" }), snapshot({ ballState: "bouncing" }));
    fx.update(SHADOW_SQUASH_MS / 2000, snapshot(), snapshot());
    expect(fx.getShadowSquash()).toBeCloseTo(0.5, 5);
    fx.update(SHADOW_SQUASH_MS / 1000, snapshot(), snapshot());
    expect(fx.getShadowSquash()).toBe(0);
  });
});

describe("ImpactEffects — PERFECT shake and flash", () => {
  it("shakes only on Leo's PERFECT — not on GOOD/LATE, and not on Alice's PERFECT", () => {
    const leoPerfect = new ImpactEffects({ random: fixedRandom });
    leoPerfect.update(DT, snapshot(), snapshot({ lastEvent: hit("leo", "perfect") }));
    expect(leoPerfect.isShaking()).toBe(true);

    for (const event of [hit("leo", "good"), hit("leo", "late"), hit("alice", "perfect")]) {
      const fx = new ImpactEffects({ random: fixedRandom });
      fx.update(DT, snapshot(), snapshot({ lastEvent: event }));
      expect(fx.isShaking()).toBe(false);
      expect(fx.getShakeOffset()).toEqual({ x: 0, y: 0 });
    }
  });

  it("keeps the shake to integer offsets of a few pixels and decays to exactly zero within ~100ms", () => {
    const fx = new ImpactEffects({ random: () => 0.99 });
    fx.update(0, snapshot(), snapshot({ lastEvent: hit("leo", "perfect") }));
    const first = fx.getShakeOffset();
    expect(Number.isInteger(first.x) && Number.isInteger(first.y)).toBe(true);
    expect(Math.abs(first.x)).toBeLessThanOrEqual(SHAKE_AMPLITUDE_PX);
    expect(Math.abs(first.y)).toBeLessThanOrEqual(SHAKE_AMPLITUDE_PX);
    expect(Math.abs(first.x) + Math.abs(first.y)).toBeGreaterThan(0);

    const steps = Math.ceil(SHAKE_DURATION_MS / 1000 / DT) + 1;
    for (let i = 0; i < steps; i++) fx.update(DT, snapshot(), snapshot());
    expect(fx.isShaking()).toBe(false);
    expect(fx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("shows the flash ring for a PERFECT from either player and never for GOOD/LATE", () => {
    for (const side of ["leo", "alice"] as const) {
      const fx = new ImpactEffects({ random: fixedRandom });
      fx.update(0, snapshot(), snapshot({ lastEvent: hit(side, "perfect") }));
      expect(fx.getFlash()).not.toBeNull();
      fx.update(0.1, snapshot(), snapshot());
      expect(fx.getFlash()).toBeNull();
    }
    const good = new ImpactEffects({ random: fixedRandom });
    good.update(0, snapshot(), snapshot({ lastEvent: hit("leo", "good") }));
    expect(good.getFlash()).toBeNull();
  });

  it("tolerates a negative dt on the first frame without corrupting timers or particles", () => {
    const fx = new ImpactEffects({ random: fixedRandom });
    expect(() => fx.update(-0.05, snapshot(), snapshot({ lastEvent: hit("leo", "perfect") }))).not.toThrow();
    expect(fx.activeCount("spark")).toBe(SPARK_COUNT.perfect);
    expect(fx.getShadowSquash()).toBeGreaterThanOrEqual(0);
  });
});

describe("ImpactEffects — ball trail", () => {
  function moving(x: number, speed: number, state: BallStateType = "in_play"): GameSnapshot {
    const s = snapshot({ ballX: x, ballState: state });
    return { ...s, ball: { ...s.ball, vx: speed } };
  }

  it("offers afterimages only for a fast ball with enough history, and drops them on a hit or reset", () => {
    const fx = new ImpactEffects({ random: fixedRandom });
    for (let i = 0; i < 5; i++) fx.update(DT, moving(100 + i * 5, 300), moving(105 + i * 5, 300));
    expect(fx.getTrailPoint(2)).toBeNull(); // too slow for a trail

    for (let i = 0; i < 5; i++) fx.update(DT, moving(300 + i * 10, 600), moving(310 + i * 10, 600));
    const p = fx.getTrailPoint(2);
    expect(p).not.toBeNull();
    expect(p!.x).toBeLessThan(350); // strictly behind the current ball position (350)

    fx.update(DT, moving(360, 600), snapshot({ ballX: 940, lastEvent: hit("alice", "good") }));
    expect(fx.getTrailPoint(2)).toBeNull(); // history dropped at the hit — no afterimage across the snap

    for (let i = 0; i < 5; i++) fx.update(DT, moving(900 - i * 10, -600), moving(890 - i * 10, -600));
    expect(fx.getTrailPoint(2)).not.toBeNull();
    fx.update(DT, moving(850, -600), moving(850, 0, "idle"));
    expect(fx.getTrailPoint(2)).toBeNull(); // point reset
  });
});
