/**
 * Integration test for the whole simulation: real physics, real
 * collision, real CPU, real scoring, real serve — wired together exactly as
 * components/GameCanvas.tsx would drive them. This is the automated
 * proof of docs/GAME_DESIGN.md's "Primeiro Marco de Sucesso":
 * LEO -> ALICE -> LEO -> ALICE is a real, playable rally, not a
 * scripted animation.
 */

import { describe, expect, it } from "vitest";
import { ALICE_SERVE_CONTACT_MS, COURT_WIDTH, SERVE_TOSS_IDEAL_MS, SERVE_TOSS_TIMEOUT_MS } from "@/game/constants";
import { COURT } from "@/game/court/geometry";
import { GameEngine } from "@/game/engine/GameEngine";
import { computeServeY } from "@/game/serve/serve";
import type { InputState } from "@/game/types";

const NO_INPUT: InputState = { direction: 0, hitPressed: false, smashHeld: false };
const HOLD_HIT: InputState = { direction: 0, hitPressed: true, smashHeld: false };
const SERVE_PRESS: InputState = { direction: 0, hitPressed: true, smashHeld: false };

function runFrames(engine: GameEngine, count: number, input: InputState, dt = 1 / 60) {
  for (let i = 0; i < count; i++) engine.update(dt, input);
}

/**
 * Etapa 5: a new match now starts in "ready_to_serve" — Leo must serve
 * before any rally logic runs (he no longer auto-serves). This drives a
 * single, perfectly-timed serve so every pre-existing rally test below can
 * keep exercising exactly the rally mechanics it was written for, unaffected
 * by the new serve gate. Only valid to call while it's Leo's turn to serve
 * (true for every test below — none of them touch the server-alternation
 * path before calling this).
 */
function bringToRally(engine: GameEngine, dt = 1 / 60): void {
  engine.update(dt, SERVE_PRESS); // ready_to_serve -> toss
  const steps = Math.round(SERVE_TOSS_IDEAL_MS / 1000 / dt);
  for (let i = 0; i < steps; i++) engine.update(dt, NO_INPUT);
  engine.update(dt, SERVE_PRESS); // toss -> contact (perfect) -> rally
}

/**
 * A minimal "auto-server" bot for tests that must span many points (and
 * therefore many of Leo's serves) in a single loop — e.g. a full match or a
 * long-running point-reset stress test. It only ever presses the hit key to
 * serve, always timed to land "perfect"; it never swings during a rally, so
 * tests relying on "leo never returns anything during the rally" keep their
 * original behavior and intent. `tossElapsedMs` is mutable state the caller
 * owns across calls (one object per engine being driven).
 */
function autoServeInput(engine: GameEngine, tossElapsedMs: { value: number }, dt = 1 / 60): InputState {
  const snapshot = engine.getSnapshot();
  if (snapshot.phase === "ready_to_serve" && snapshot.score.server === "leo") {
    tossElapsedMs.value = 0;
    return SERVE_PRESS;
  }
  if (snapshot.phase === "toss" && snapshot.score.server === "leo") {
    tossElapsedMs.value += dt * 1000;
    if (tossElapsedMs.value >= SERVE_TOSS_IDEAL_MS) return SERVE_PRESS;
  }
  return NO_INPUT;
}

describe("GameEngine — a real rally", () => {
  it("no longer serves automatically — a new match starts in ready_to_serve and waits for Leo (Etapa 5)", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    const initial = engine.getSnapshot();
    expect(initial.phase).toBe("ready_to_serve");
    expect(initial.score.server).toBe("leo");

    engine.update(1 / 60, NO_INPUT); // no input at all — nothing should advance
    expect(engine.getSnapshot().phase).toBe("ready_to_serve");

    engine.update(1 / 60, SERVE_PRESS);
    expect(engine.getSnapshot().phase).toBe("toss"); // now it advances
  });

  it("produces multiple real hit exchanges between leo and alice (a genuine rally)", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });
    bringToRally(engine);
    const hitSides: string[] = [];
    // Etapa 5: a serve success now emits a "hit" event too (it reuses
    // launchShot — see GameEngine.resolveServeContact), which the old
    // automatic serve never did. That means the SAME side can legitimately
    // "hit" twice in a row across a point boundary (their rally shot ends
    // the point, then their own next serve is a fresh, unrelated hit) —
    // the real "never twice in a row" invariant only holds *within* one
    // continuous rally, so the check below resets at every point/game end.
    let justStartedNewRally = false;

    // Holding "hit" every frame is safe: attemptPlayerHit only has an
    // effect on frames where the ball is actually owned by leo and in
    // range — see GameEngine.attemptPlayerHit / evaluateHitAttempt.
    for (let i = 0; i < 3000; i++) {
      engine.update(1 / 60, HOLD_HIT);
      const event = engine.getSnapshot().lastEvent;
      if (event?.type === "point" || event?.type === "game") justStartedNewRally = true;
      if (event?.type === "hit") {
        // A real rally alternates sides within one continuous exchange — it
        // never hits twice in a row for the same side without a point
        // boundary in between (that would mean the ball teleported or a
        // side hit its own incoming ball, which is exactly the "fake"
        // behavior the spec forbids).
        if (!justStartedNewRally && hitSides.length > 0) {
          expect(event.side).not.toBe(hitSides[hitSides.length - 1]);
        }
        hitSides.push(event.side);
        justStartedNewRally = false;
      }
      if (engine.getSnapshot().phase === "game_over") break;
    }

    expect(hitSides.length).toBeGreaterThanOrEqual(4);
    expect(hitSides).toContain("leo");
    expect(hitSides).toContain("alice");
  });

  it("increments the rally counter with each real hit exchange", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });
    bringToRally(engine);
    runFrames(engine, 200, HOLD_HIT);
    const rallyAfterSome = engine.getSnapshot().rally.count;
    expect(rallyAfterSome).toBeGreaterThan(0);
  });

  it("ends the point (awards it to alice) when leo never presses hit", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });
    bringToRally(engine);
    let sawPointEvent = false;
    for (let i = 0; i < 600; i++) {
      engine.update(1 / 60, NO_INPUT); // leo never swings — the ball must eventually pass him
      const event = engine.getSnapshot().lastEvent;
      if (event?.type === "point" && event.winner === "alice") {
        sawPointEvent = true;
        break;
      }
    }
    expect(sawPointEvent).toBe(true);
  });

  it("never awards a point to leo for a ball he never touched (no phantom scoring)", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });
    bringToRally(engine);
    let leoWasAwardedPoint = false;
    for (let i = 0; i < 600; i++) {
      engine.update(1 / 60, NO_INPUT);
      const event = engine.getSnapshot().lastEvent;
      if (event?.type === "point" && event.winner === "leo") leoWasAwardedPoint = true;
      if (engine.getSnapshot().phase === "game_over") break;
    }
    expect(leoWasAwardedPoint).toBe(false);
  });

  it("resets the rally counter to 0 after a point ends", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });
    bringToRally(engine);
    for (let i = 0; i < 600; i++) {
      engine.update(1 / 60, NO_INPUT);
      if (engine.getSnapshot().lastEvent?.type === "point") break;
    }
    expect(engine.getSnapshot().rally.count).toBe(0);
  });

  it("a full match eventually reaches game_over with a winner", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });
    let winner: string | undefined;
    const tossElapsed = { value: 0 };
    for (let i = 0; i < 200_000; i++) {
      // Leo always serves (perfectly-timed) but never swings during a rally
      // -> alice wins every point she returns, exactly like the pre-Etapa-5
      // version of this test (which relied on an automatic serve instead).
      engine.update(1 / 60, autoServeInput(engine, tossElapsed));
      const snapshot = engine.getSnapshot();
      if (snapshot.phase === "game_over") {
        winner = snapshot.lastEvent?.type === "match" ? snapshot.lastEvent.winner : undefined;
        break;
      }
    }
    expect(winner).toBe("alice");
  });

  it("is fully deterministic given the same injected random function", () => {
    const makeEngine = () => new GameEngine({ difficulty: "normal", random: () => 0.42 });
    const a = makeEngine();
    const b = makeEngine();
    bringToRally(a);
    bringToRally(b);
    runFrames(a, 500, HOLD_HIT);
    runFrames(b, 500, HOLD_HIT);
    expect(a.getSnapshot().ball).toEqual(b.getSnapshot().ball);
    expect(a.getSnapshot().score).toEqual(b.getSnapshot().score);
  });
});

/**
 * "Etapa corretiva" — deterministic proof that the state machine and
 * ball.owner can sustain a real, multi-exchange rally end to end:
 * ready_to_serve -> SPACE -> toss -> serve contact -> rally -> Alice hit ->
 * Leo hit -> Alice hit -> Leo hit. This doesn't reproduce pixel-perfect
 * physics — it proves the states/ownership themselves are sound. See
 * docs/PROGRESS.md "Etapa corretiva" for the audit that asked for this.
 */
describe("GameEngine — full serve+rally integration flow", () => {
  it("ready_to_serve -> SPACE -> toss -> serve contact -> rally -> Alice -> Leo -> Alice -> Leo", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });

    expect(engine.getSnapshot().phase).toBe("ready_to_serve");

    engine.update(1 / 60, SERVE_PRESS);
    expect(engine.getSnapshot().phase).toBe("toss");

    const steps = Math.round(SERVE_TOSS_IDEAL_MS / 1000 / (1 / 60));
    for (let i = 0; i < steps; i++) engine.update(1 / 60, NO_INPUT);
    engine.update(1 / 60, SERVE_PRESS);

    let snap = engine.getSnapshot();
    expect(snap.phase).toBe("rally");
    expect(snap.leo.lastShot).toBe("perfect");
    expect(snap.ball.owner).toBe("alice"); // serve contact resolved — Alice must return it

    // Collect an uninterrupted run of hits within a single continuous rally
    // — if a point happens to end along the way, the *next* serve's own
    // contact is a legitimate fresh "hit" for whichever side served, not a
    // violation of alternation — so the run resets instead of being
    // asserted across that boundary. See docs/PROGRESS.md "Etapa corretiva"
    // for why serves emit "hit" events now (Etapa 5 reused launchShot for
    // serve contact).
    //
    // Leo actively chases the court center here: Alice's rally-return aim
    // (maybeAttemptCpuHit) is `this.random() * COURT_WIDTH`, a fixed 250
    // with random locked at 0.5 — it doesn't track Leo's position, and
    // Etapa 5 moved his serve-side starting Y away from the center, so a
    // static direction (as older tests used, back when he started exactly
    // at COURT_WIDTH/2) can no longer reliably keep him in her return's
    // path. This isn't a production concern (a real player moves toward
    // the ball) — it only matters for sustaining a deterministic rally here.
    let cleanRun: string[] = [];
    for (let i = 0; i < 6000 && cleanRun.length < 4; i++) {
      const leoY = engine.getSnapshot().leo.y;
      const direction: -1 | 0 | 1 = leoY < COURT_WIDTH / 2 ? 1 : leoY > COURT_WIDTH / 2 ? -1 : 0;
      engine.update(1 / 60, { direction, hitPressed: true, smashHeld: false });
      const event = engine.getSnapshot().lastEvent;
      if (event?.type === "point" || event?.type === "game") cleanRun = [];
      if (event?.type === "hit") cleanRun.push(event.side);
    }

    // The exact sequence the spec asks to prove: Alice -> Leo -> Alice -> Leo.
    expect(cleanRun).toEqual(["alice", "leo", "alice", "leo"]);

    snap = engine.getSnapshot();
    expect(snap.phase).toBe("rally");
    expect(snap.rally.count).toBeGreaterThanOrEqual(4);
  });
});

/**
 * Etapa 5 — the serve mechanic. See docs/PROGRESS.md "Etapa 5" for the full
 * design (READY_TO_SERVE -> TOSS -> contact -> RALLY -> point end -> next
 * serve) and the audit that preceded it.
 */
describe("GameEngine — serve state machine", () => {
  it("starts a new match in ready_to_serve with Leo as server", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    const snap = engine.getSnapshot();
    expect(snap.phase).toBe("ready_to_serve");
    expect(snap.score.server).toBe("leo");
  });

  it("ready_to_serve -> toss when Leo presses the hit key", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    engine.update(1 / 60, SERVE_PRESS);
    expect(engine.getSnapshot().phase).toBe("toss");
  });

  it("toss -> rally on a well-timed contact", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    bringToRally(engine);
    expect(engine.getSnapshot().phase).toBe("rally");
    expect(engine.getSnapshot().ball.state).toBe("in_play");
  });

  it("rally -> point end -> ready_to_serve when the point ends", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });
    bringToRally(engine);
    for (let i = 0; i < 600; i++) {
      engine.update(1 / 60, NO_INPUT);
      if (engine.getSnapshot().lastEvent?.type === "point") break;
    }
    expect(engine.getSnapshot().phase).toBe("ready_to_serve");
  });

  it("a serve fault also returns the game to ready_to_serve (via the same point-award path)", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    engine.update(1 / 60, SERVE_PRESS); // toss
    engine.update(1 / 60, SERVE_PRESS); // way too early -> miss/fault
    const snap = engine.getSnapshot();
    expect(snap.phase).toBe("ready_to_serve");
    expect(snap.score.points[1]).toBe(1); // point awarded to alice (the receiver)
  });
});

describe("GameEngine — Leo's serve", () => {
  it("the hit key does nothing while the match is over", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });
    // Leo double-faults his own serve every time; NO_INPUT while it isn't
    // his ready-to-serve turn (Alice serves/returns/loses the point to a
    // pass-by automatically). Deterministically reaches game_over (alice
    // wins every point 4-0 each game, straight sets) without depending on
    // any CPU/random behavior — much faster and more reliable than
    // simulating a realistic full match just to get to game_over.
    for (let i = 0; i < 5000 && engine.getSnapshot().phase !== "game_over"; i++) {
      const snap = engine.getSnapshot();
      if (snap.phase === "ready_to_serve" && snap.score.server === "leo") {
        engine.update(1 / 60, SERVE_PRESS);
        engine.update(1 / 60, SERVE_PRESS);
      } else {
        engine.update(1 / 60, NO_INPUT);
      }
    }
    expect(engine.getSnapshot().phase).toBe("game_over");
    engine.update(1 / 60, SERVE_PRESS);
    expect(engine.getSnapshot().phase).toBe("game_over"); // still stuck — no reaction to input
  });

  it("a perfectly-timed press produces a PERFECT serve", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    bringToRally(engine); // presses exactly at SERVE_TOSS_IDEAL_MS
    expect(engine.getSnapshot().leo.lastShot).toBe("perfect");
    expect(engine.getSnapshot().phase).toBe("rally");
  });

  it("a press inside the good window but outside the perfect window produces a GOOD serve", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    engine.update(1 / 60, SERVE_PRESS); // start toss
    // advance ~150ms past the ideal instant — inside GOOD_WINDOW(220), outside PERFECT_WINDOW(80)
    const steps = Math.round((SERVE_TOSS_IDEAL_MS + 150) / 1000 / (1 / 60));
    for (let i = 0; i < steps; i++) engine.update(1 / 60, NO_INPUT);
    engine.update(1 / 60, SERVE_PRESS);
    expect(engine.getSnapshot().leo.lastShot).toBe("good");
    expect(engine.getSnapshot().phase).toBe("rally");
  });

  it("a press far from the ideal instant produces a MISS (fault) and awards the point to Alice", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    engine.update(1 / 60, SERVE_PRESS); // start toss
    engine.update(1 / 60, SERVE_PRESS); // ~16ms later — way too early
    const snap = engine.getSnapshot();
    expect(snap.leo.lastShot).toBe("miss");
    expect(snap.phase).toBe("ready_to_serve");
    expect(snap.score.points[1]).toBe(1);
  });

  it("no press at all before the timeout also faults", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    engine.update(1 / 60, SERVE_PRESS); // start toss
    const steps = Math.round((SERVE_TOSS_TIMEOUT_MS + 50) / 1000 / (1 / 60));
    for (let i = 0; i < steps; i++) engine.update(1 / 60, NO_INPUT);
    const snap = engine.getSnapshot();
    expect(snap.leo.lastShot).toBe("miss");
    expect(snap.phase).toBe("ready_to_serve");
    expect(snap.score.points[1]).toBe(1);
  });

  it("holding a different direction at the moment of contact changes the aim (A vs D produce different lateral targets)", () => {
    const engineLeft = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    const engineRight = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    for (const [engine, direction] of [
      [engineLeft, -1],
      [engineRight, 1],
    ] as const) {
      engine.update(1 / 60, SERVE_PRESS);
      const steps = Math.round(SERVE_TOSS_IDEAL_MS / 1000 / (1 / 60));
      for (let i = 0; i < steps; i++) engine.update(1 / 60, NO_INPUT);
      engine.update(1 / 60, { direction, hitPressed: true, smashHeld: false });
    }
    // Same starting conditions on both engines — only the held direction at
    // contact differs — so a different aim must produce a different vy.
    expect(engineLeft.getSnapshot().ball.vy).not.toBeCloseTo(engineRight.getSnapshot().ball.vy, 3);
  });

  it("contact happens exactly once — the resolved serve doesn't re-trigger from a leftover hit-key state", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    bringToRally(engine);
    const qualityAfterServe = engine.getSnapshot().leo.lastShot;
    expect(engine.getSnapshot().phase).toBe("rally");
    // advancing further frames (ball now genuinely in a rally) must not
    // silently re-run serve-contact logic and overwrite lastShot again on
    // its own — it can only change via a real new swing.
    engine.update(1 / 60, NO_INPUT);
    expect(engine.getSnapshot().leo.lastShot).toBe(qualityAfterServe);
  });
});

describe("GameEngine — Alice's serve", () => {
  function leoDoubleFaults(engine: GameEngine): void {
    engine.update(1 / 60, SERVE_PRESS); // ready_to_serve -> toss
    engine.update(1 / 60, SERVE_PRESS); // pressed immediately -> way too early -> fault
  }

  function makeAliceServer(): GameEngine {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    // Leo double-faults every point of his opening service game (0/15/30/40
    // for Alice) so the game ends and the server alternates to Alice —
    // exercising the exact same server-alternation path a real match uses,
    // without depending on Alice's CPU behavior at all.
    for (let i = 0; i < 4; i++) leoDoubleFaults(engine);
    return engine;
  }

  it("Alice becomes server after Leo loses a game, and starts serving without any keyboard input", () => {
    const engine = makeAliceServer();
    expect(engine.getSnapshot().score.server).toBe("alice");
    expect(engine.getSnapshot().phase).toBe("ready_to_serve");

    engine.update(1 / 60, NO_INPUT); // no keyboard input at all
    expect(engine.getSnapshot().phase).toBe("toss"); // she auto-tossed
  });

  it("her contact happens exactly once, at a fixed deterministic instant, and starts the rally", () => {
    const engine = makeAliceServer();
    engine.update(1 / 60, NO_INPUT); // -> toss

    const steps = Math.round(ALICE_SERVE_CONTACT_MS / 1000 / (1 / 60)) + 1;
    for (let i = 0; i < steps; i++) engine.update(1 / 60, NO_INPUT);

    const snap = engine.getSnapshot();
    expect(snap.phase).toBe("rally");
    expect(snap.alice.lastShot).toBe("good");
    expect(snap.ball.owner).toBe("leo"); // owner passes to the receiver
    expect(snap.ball.state).toBe("in_play");
  });

  it("is deterministic — two engines driven the same way produce the same serve outcome", () => {
    const a = makeAliceServer();
    const b = makeAliceServer();
    const steps = Math.round(ALICE_SERVE_CONTACT_MS / 1000 / (1 / 60)) + 2;
    for (let i = 0; i < steps; i++) {
      a.update(1 / 60, NO_INPUT);
      b.update(1 / 60, NO_INPUT);
    }
    expect(a.getSnapshot().ball).toEqual(b.getSnapshot().ball);
  });
});

describe("GameEngine — serve side alternates correctly", () => {
  function leoDoubleFaults(engine: GameEngine): void {
    engine.update(1 / 60, SERVE_PRESS);
    engine.update(1 / 60, SERVE_PRESS);
  }

  it("alternates deuce/ad for every point within a game, and returns to deuce for the next game", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    const expectedSides: Array<"deuce" | "ad"> = ["deuce", "ad", "deuce", "ad"]; // points 0,1,2,3 of the opening game
    const observedYs: number[] = [];

    for (let i = 0; i < 4; i++) {
      observedYs.push(engine.getSnapshot().leo.y);
      leoDoubleFaults(engine); // ends the point, resets to the next side
    }

    for (let i = 0; i < 4; i++) {
      expect(observedYs[i]).toBeCloseTo(computeServeY(expectedSides[i]), 5);
    }

    // The 4th fault just lost Leo the game (0-40) — server alternates and
    // the new game starts back at deuce.
    expect(engine.getSnapshot().score.server).toBe("alice");
    expect(engine.getSnapshot().leo.y).toBeCloseTo(computeServeY("deuce"), 5);
  });

  it("both server and receiver share the same lateral stance for a given side", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    const snap = engine.getSnapshot();
    expect(snap.leo.y).toBeCloseTo(snap.alice.y, 5);
  });
});

describe("GameEngine — serve ball-position bug regression (Etapa 5 audit)", () => {
  it("the toss ball starts exactly at Leo's actual lateral position, not a hardcoded value", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    const initialY = engine.getSnapshot().leo.y;

    // Movement is allowed in ready_to_serve — actually move him.
    for (let i = 0; i < 60; i++) engine.update(1 / 60, { direction: 1, hitPressed: false, smashHeld: false });
    const leoYBeforeServe = engine.getSnapshot().leo.y;
    expect(leoYBeforeServe).not.toBeCloseTo(initialY, 0); // sanity check: he actually moved

    engine.update(1 / 60, SERVE_PRESS);
    const snap = engine.getSnapshot();
    expect(snap.phase).toBe("toss");
    expect(snap.ball.y).toBeCloseTo(leoYBeforeServe, 5);
    expect(snap.ball.x).toBeCloseTo(snap.leo.x, 5);
  });

  it("holds regardless of which direction he moved before serving", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    for (let i = 0; i < 60; i++) engine.update(1 / 60, { direction: -1, hitPressed: false, smashHeld: false });
    const leoYBeforeServe = engine.getSnapshot().leo.y;

    engine.update(1 / 60, SERVE_PRESS);
    expect(engine.getSnapshot().ball.y).toBeCloseTo(leoYBeforeServe, 5);
  });

  it("also holds when Alice is the server", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    for (let i = 0; i < 4; i++) {
      engine.update(1 / 60, SERVE_PRESS);
      engine.update(1 / 60, SERVE_PRESS);
    }
    expect(engine.getSnapshot().score.server).toBe("alice");

    engine.update(1 / 60, NO_INPUT); // her toss begins
    const snap = engine.getSnapshot();
    expect(snap.phase).toBe("toss");
    expect(snap.ball.y).toBeCloseTo(snap.alice.y, 5);
    expect(snap.ball.x).toBeCloseTo(snap.alice.x, 5);
  });

  it("the ball's position stays locked to the server's position throughout the whole toss, not just at the start", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    engine.update(1 / 60, SERVE_PRESS);
    for (let i = 0; i < 20; i++) {
      engine.update(1 / 60, NO_INPUT);
      const snap = engine.getSnapshot();
      expect(snap.ball.x).toBeCloseTo(snap.leo.x, 5);
      expect(snap.ball.y).toBeCloseTo(snap.leo.y, 5);
    }
  });
});

describe("GameEngine — point reset", () => {
  it("clears rally count, both players' lastShot, and puts the ball in a neutral state", () => {
    const engine = new GameEngine({ difficulty: "easy", random: () => 0.5 });
    bringToRally(engine);
    for (let i = 0; i < 600; i++) {
      engine.update(1 / 60, HOLD_HIT);
      if (engine.getSnapshot().lastEvent?.type === "point") break;
    }
    const snap = engine.getSnapshot();
    expect(snap.rally.count).toBe(0);
    expect(snap.leo.lastShot).toBeNull();
    expect(snap.alice.lastShot).toBeNull();
    expect(snap.ball.state).toBe("idle");
    expect(snap.ball.vx).toBe(0);
    expect(snap.ball.vy).toBe(0);
    expect(snap.ball.vz).toBe(0);
    expect(snap.ball.bounceCount).toBe(0);
  });

  it("the server for the next point owns the correct baseline position", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    engine.update(1 / 60, SERVE_PRESS);
    engine.update(1 / 60, SERVE_PRESS); // fault -> point to alice -> reset
    const snap = engine.getSnapshot();
    expect(snap.score.server).toBe("leo"); // still leo — one point isn't a game
    expect(snap.ball.x).toBeCloseTo(snap.leo.x, 5);
    expect(snap.ball.owner).toBe("alice");
  });
});

describe("GameEngine — serve stress test", () => {
  it("stays fully valid (no NaN/Infinity, all positions/velocities finite, valid phases) across 1000+ steps spanning many serves and points", () => {
    const engine = new GameEngine({ difficulty: "hard", random: () => 0.7 });
    const tossElapsed = { value: 0 };
    const validPhases = new Set(["ready_to_serve", "toss", "rally", "game_over"]);

    for (let i = 0; i < 4000; i++) {
      const input = autoServeInput(engine, tossElapsed);
      // Also swing during rallies (with a held direction), so Alice gets
      // real returns to chase and this genuinely stresses movement, not
      // just serving.
      const rallyInput = engine.getSnapshot().phase === "rally" ? { ...input, hitPressed: true, direction: 1 as const } : input;
      engine.update(1 / 60, rallyInput);

      const snap = engine.getSnapshot();
      expect(validPhases.has(snap.phase)).toBe(true);
      expect(Number.isFinite(snap.ball.x)).toBe(true);
      expect(Number.isFinite(snap.ball.y)).toBe(true);
      expect(Number.isFinite(snap.ball.z)).toBe(true);
      expect(Number.isFinite(snap.ball.vx)).toBe(true);
      expect(Number.isFinite(snap.ball.vy)).toBe(true);
      expect(Number.isFinite(snap.ball.vz)).toBe(true);
      expect(Number.isFinite(snap.leo.y)).toBe(true);
      expect(Number.isFinite(snap.alice.y)).toBe(true);
      expect(snap.alice.y).toBeGreaterThanOrEqual(COURT.alicePlayableBounds.minY);
      expect(snap.alice.y).toBeLessThanOrEqual(COURT.alicePlayableBounds.maxY);
      expect(["leo", "alice"]).toContain(snap.score.server);
      expect(["leo", "alice"]).toContain(snap.ball.owner);
      expect(Number.isFinite(snap.score.points[0])).toBe(true);
      expect(Number.isFinite(snap.score.points[1])).toBe(true);
      expect(Number.isFinite(snap.score.games[0])).toBe(true);
      expect(Number.isFinite(snap.score.games[1])).toBe(true);

      if (snap.phase === "game_over") break;
    }
  });
});

/**
 * Regression coverage for the "Alice left the court" bug (see
 * docs/PROGRESS.md): the fix lives in game/cpu/ai.ts (target-level clamp)
 * and game/engine/GameEngine.ts (final-position clamp), both driven by
 * game/court/geometry.ts's COURT.alicePlayableBounds. These tests drive
 * the real, fully-wired GameEngine — not the isolated AI functions — so
 * they'd catch a regression introduced anywhere in that chain.
 */
describe("GameEngine — Alice stays within her playable bounds", () => {
  it("starts with alice at a valid position inside her bounds (Teste 7)", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0.5 });
    const alice = engine.getSnapshot().alice;
    expect(alice.y).toBeGreaterThanOrEqual(COURT.alicePlayableBounds.minY);
    expect(alice.y).toBeLessThanOrEqual(COURT.alicePlayableBounds.maxY);
    // Her fixed baseline X is on her own side of the net (between the net and the far edge), never past either.
    expect(alice.x).toBeGreaterThanOrEqual(COURT.alicePlayableBounds.minX);
    expect(alice.x).toBeLessThanOrEqual(COURT.alicePlayableBounds.maxX);
  });

  it("never leaves her playable bounds or crosses the net across a long rally, even at max CPU position error (Teste 3/4)", () => {
    // random() = 1 forces the largest possible positionErrorMax on every
    // single frame, in the same direction every time — the worst case for
    // the historical bug, and something a real Math.random() rally would
    // only occasionally hit.
    const engine = new GameEngine({ difficulty: "normal", random: () => 1 });
    bringToRally(engine);

    let framesChecked = 0;
    for (let i = 0; i < 5000; i++) {
      engine.update(1 / 60, HOLD_HIT);
      const { alice } = engine.getSnapshot();
      expect(alice.y).toBeGreaterThanOrEqual(COURT.alicePlayableBounds.minY);
      expect(alice.y).toBeLessThanOrEqual(COURT.alicePlayableBounds.maxY);
      expect(alice.x).toBeGreaterThanOrEqual(COURT.alicePlayableBounds.minX); // never crosses the net
      framesChecked++;
    }
    expect(framesChecked).toBe(5000); // sanity check the loop actually ran (didn't throw/exit early)
  });

  it("never leaves her playable bounds at the opposite extreme of CPU position error either (random() = 0)", () => {
    const engine = new GameEngine({ difficulty: "normal", random: () => 0 });
    bringToRally(engine);
    for (let i = 0; i < 5000; i++) {
      engine.update(1 / 60, HOLD_HIT);
      const { alice } = engine.getSnapshot();
      expect(alice.y).toBeGreaterThanOrEqual(COURT.alicePlayableBounds.minY);
      expect(alice.y).toBeLessThanOrEqual(COURT.alicePlayableBounds.maxY);
    }
  });

  it("does not accumulate drift across many points (position never grows unbounded)", () => {
    const engine = new GameEngine({ difficulty: "hard", random: () => 0.9 });
    const tossElapsed = { value: 0 };
    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < 8000; i++) {
      // Leo serves (auto-bot) but never returns during the rally — forces
      // many point resets, exercising the reset path repeatedly, same
      // intent as the pre-Etapa-5 version of this test.
      engine.update(1 / 60, autoServeInput(engine, tossElapsed));
      const y = engine.getSnapshot().alice.y;
      maxY = Math.max(maxY, y);
      minY = Math.min(minY, y);
    }
    expect(maxY).toBeLessThanOrEqual(COURT.alicePlayableBounds.maxY);
    expect(minY).toBeGreaterThanOrEqual(COURT.alicePlayableBounds.minY);
  });

  it("stays within bounds across every difficulty level", () => {
    for (const difficulty of ["easy", "normal", "hard", "insane"] as const) {
      const engine = new GameEngine({ difficulty, random: () => 1 });
      bringToRally(engine);
      for (let i = 0; i < 1500; i++) {
        engine.update(1 / 60, HOLD_HIT);
        const y = engine.getSnapshot().alice.y;
        expect(y).toBeGreaterThanOrEqual(COURT.alicePlayableBounds.minY);
        expect(y).toBeLessThanOrEqual(COURT.alicePlayableBounds.maxY);
      }
    }
  });
});
