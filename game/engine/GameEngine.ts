/**
 * The framework-agnostic simulation core. Owns all game state and
 * advances it one `update(dt, input)` at a time — nothing here touches
 * React, the DOM, or <canvas>. components/GameCanvas.tsx drives this with
 * requestAnimationFrame and reads `getSnapshot()` to render + update the
 * HUD. See docs/GAME_DESIGN.md "Game loop" and "Architecture".
 */

import {
  ALICE_SERVE_CONTACT_MS,
  ALICE_SERVE_DELAY_MS,
  ALICE_X,
  BASE_BALL_SPEED,
  COURT_WIDTH,
  CPU_ACCEL,
  CPU_ARRIVE_EPSILON,
  CPU_BRAKE_TIME,
  CPU_RECOVERY_SPEED_RATIO,
  LEO_X,
  PLAYER_ACCEL,
  PLAYER_HIT_BUFFER_MS,
  PLAYER_MOVE_SPEED,
  REACH_X_PERFECT,
  SERVE_TOSS_TIMEOUT_MS,
  SERVE_TOSS_VZ,
} from "@/game/constants";
import { COURT, clampToBounds } from "@/game/court/geometry";
import { evaluateHitAttempt, hasBallPassedPlayer, isDoubleBounce, isOutOfBounds } from "@/game/collision/reach";
import { computeLaunchVelocity, stepBallPhysics } from "@/game/physics/trajectory";
import { computeCpuTargetY } from "@/game/cpu/ai";
import { applyHitError, DIFFICULTY_PARAMS, TUTORIAL_PARAMS, type DifficultyParams } from "@/game/difficulty/params";
import { cpuDesiredVelocity, stepLateralMotion } from "@/game/player/movement";
import { awardPoint, createInitialScore, isMatchOver } from "@/game/scoring/scoring";
import { classifyServeTiming, computeServeY, getServeSide, type ServeQuality } from "@/game/serve/serve";
import type {
  BallState,
  Difficulty,
  GameEvent,
  GameSnapshot,
  HitQuality,
  InputState,
  MatchPhase,
  PlayerState,
  ScoreState,
  Side,
} from "@/game/types";

const AIM_OFFSET = 120;
// Softened from 0.03/1.6 (Physics & Game Feel pass): the old ramp reached
// its +60% cap after just ~20 hits (10 exchanges), compounding against the
// REACH_X_* windows in constants.ts and undoing their forgiveness a few
// exchanges into every rally. Difficulty should come from more than raw
// speed (see docs/GAME_DESIGN.md) — this keeps a real, felt escalation
// without racing ahead of what the widened hit windows were tuned for.
const RALLY_SPEED_STEP = 0.022;
const RALLY_SPEED_MAX = 1.45;
const HIT_QUALITY_SPEED_MULTIPLIER: Record<Exclude<HitQuality, "miss">, number> = {
  perfect: 1.15,
  good: 1.0,
  late: 0.75,
};

function freshBall(owner: Side): BallState {
  return {
    x: owner === "alice" ? LEO_X : ALICE_X,
    y: COURT_WIDTH / 2,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    owner,
    lastHitBy: null,
    state: "idle",
    bounceCount: 0,
  };
}

function freshPlayer(side: Side): PlayerState {
  return { side, x: side === "leo" ? LEO_X : ALICE_X, y: COURT_WIDTH / 2, vy: 0, lastShot: null };
}

export interface GameEngineOptions {
  difficulty: Difficulty;
  random?: () => number; // injectable for deterministic tests — defaults to Math.random
  /** Who serves the very first point. Defaults to "leo" — every existing call site keeps its exact prior behavior. Used by the tutorial (components/tutorial.ts) so Leo receives a real, easy serve before he's ever asked to press the hit key himself. */
  initialServer?: Side;
  /**
   * Opt-in "training wheels" for the CPU only — see game/difficulty/params.ts
   * TUTORIAL_PARAMS. Defaults to false, which preserves every existing
   * behavior/test exactly: Alice's movement/hit-error uses TUTORIAL_PARAMS
   * instead of DIFFICULTY_PARAMS[difficulty], and she aims every return
   * straight at Leo's current position instead of a random spot on the
   * court — nothing about Leo's own physics, input, or scoring changes.
   */
  tutorialMode?: boolean;
}

export class GameEngine {
  private ball: BallState;
  private leo: PlayerState;
  private alice: PlayerState;
  private score: ScoreState;
  private rallyCount = 0;
  private phase: MatchPhase = "ready_to_serve";
  private lastEvent: GameEvent | null = null;
  private serveTimerMs = 0;
  /** Remaining ms of a buffered rally hit-key press — see PLAYER_HIT_BUFFER_MS. 0 means no press is currently armed. */
  private hitBufferMs = 0;
  /** The positioning-error roll Alice uses for the shot currently coming at her — sampled once per Leo hit (see launchShot), never per frame. */
  private aliceErrorRoll = 0.5;
  /** Ms Alice has waited in "ready_to_serve" before her auto-toss — see ALICE_SERVE_DELAY_MS. */
  private aliceServeDelayMs = 0;
  private readonly difficulty: Difficulty;
  private readonly random: () => number;
  private readonly tutorialMode: boolean;

  constructor(options: GameEngineOptions) {
    this.difficulty = options.difficulty;
    this.random = options.random ?? Math.random;
    this.tutorialMode = options.tutorialMode ?? false;
    this.leo = freshPlayer("leo");
    this.alice = freshPlayer("alice");
    this.score = createInitialScore(options.initialServer ?? "leo");
    this.ball = freshBall("alice"); // placeholder — resetForNextServe() below replaces it immediately
    this.resetForNextServe();
  }

  getSnapshot(): GameSnapshot {
    return {
      ball: this.ball,
      leo: this.leo,
      alice: this.alice,
      score: this.score,
      rally: { count: this.rallyCount, level: this.currentLevel(), speedMultiplier: this.currentSpeedMultiplier() },
      phase: this.phase,
      lastEvent: this.lastEvent,
    };
  }

  private currentLevel(): number {
    return Math.min(1 + Math.floor(this.rallyCount / 5), 7);
  }

  private currentSpeedMultiplier(): number {
    return Math.min(1 + this.rallyCount * RALLY_SPEED_STEP, RALLY_SPEED_MAX);
  }

  update(dt: number, input: InputState): void {
    if (this.phase === "game_over") return;

    this.lastEvent = null;

    if (this.phase === "ready_to_serve") {
      this.updateReadyToServe(dt, input);
      return;
    }
    if (this.phase === "toss") {
      this.updateToss(dt, input);
      return;
    }

    // phase === "rally" — pre-Etapa-5 loop, plus the buffered hit-key read
    // (Physics & Game Feel pass — see PLAYER_HIT_BUFFER_MS).
    this.moveLeo(dt, input.direction);
    this.updateAlicePosition(dt);

    this.ball = stepBallPhysics(this.ball, dt);

    this.updateLeoHitBuffer(dt, input);
    if (this.ball.owner === "alice") {
      this.maybeAttemptCpuHit();
    }

    this.checkPointEndingConditions();
  }

  /**
   * Leo can move freely while waiting to serve, whether he's the server or
   * the receiver (see docs/PROGRESS.md "Etapa 5" — movement is only ever
   * locked during his own toss, to protect the serve-origin fix below).
   * Alice's CPU chase never runs outside "rally" — there's no live
   * trajectory to chase yet, so freezing her here is the simplest correct
   * choice, not a limitation worth engineering around.
   */
  private updateReadyToServe(dt: number, input: InputState): void {
    this.moveLeo(dt, input.direction);

    if (this.score.server === "leo") {
      if (input.hitPressed) this.startToss();
    } else {
      // Alice never depends on keyboard input — she starts her own toss by
      // herself, deterministically (see AUTO_TOSS in the approved spec),
      // after a fixed beat that lets the previous point's outcome land
      // (see ALICE_SERVE_DELAY_MS).
      this.aliceServeDelayMs += dt * 1000;
      if (this.aliceServeDelayMs >= ALICE_SERVE_DELAY_MS) this.startToss();
    }
  }

  /** Leo's lateral movement for this frame — same velocity model Alice uses, tuned for a human on a keyboard (see PLAYER_ACCEL). */
  private moveLeo(dt: number, direction: -1 | 0 | 1): void {
    const motion = stepLateralMotion({ y: this.leo.y, vy: this.leo.vy }, direction * PLAYER_MOVE_SPEED, PLAYER_ACCEL, dt, 0, COURT_WIDTH);
    this.leo = { ...this.leo, y: motion.y, vy: motion.vy };
  }

  /**
   * Puts the ball in the server's hand and starts the toss timer. `owner` is
   * set to the receiver immediately — consistent with its existing meaning
   * ("who must hit it next") even before contact happens — see
   * docs/PROGRESS.md "Etapa 5" for why this doesn't conflict with
   * attemptPlayerHit/maybeAttemptCpuHit (both are only reachable from the
   * "rally" branch of update() now).
   */
  private startToss(): void {
    const server = this.score.server;
    const receiver: Side = server === "leo" ? "alice" : "leo";
    // The server plants: any lateral momentum from the ready phase is
    // dropped so the toss origin (his position) is truly stationary.
    if (server === "leo") this.leo = { ...this.leo, vy: 0 };
    const serverPlayer = server === "leo" ? this.leo : this.alice;

    this.ball = {
      x: serverPlayer.x,
      y: serverPlayer.y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: SERVE_TOSS_VZ,
      owner: receiver,
      lastHitBy: null,
      state: "idle",
      bounceCount: 0,
    };
    this.serveTimerMs = 0;
    this.phase = "toss";
  }

  /**
   * Advances the toss (reusing the existing gravity-only physics step — no
   * second physics system) and resolves contact once the server acts:
   * Leo via a timed hit-key press, Alice at a fixed deterministic instant.
   */
  private updateToss(dt: number, input: InputState): void {
    this.serveTimerMs += dt * 1000;
    this.ball = stepBallPhysics(this.ball, dt);

    const server = this.score.server;

    if (server === "alice") {
      // Leo is receiving — free to reposition while Alice tosses, same as
      // any other moment he isn't the one whose position must stay locked.
      this.moveLeo(dt, input.direction);
    }
    // When Leo is the server his own Y is deliberately never touched here:
    // the ball's origin is his position for the whole toss (see startToss),
    // and moving him mid-toss would reintroduce the audited ball.y bug.

    if (server === "leo") {
      if (input.hitPressed) {
        this.resolveServeContact(classifyServeTiming(this.serveTimerMs), input.direction);
      } else if (this.serveTimerMs >= SERVE_TOSS_TIMEOUT_MS) {
        this.resolveServeContact("miss", 0);
      }
    } else if (this.serveTimerMs >= ALICE_SERVE_CONTACT_MS) {
      // Fixed instant, fixed quality — deterministic, no randomness, no
      // timing skill involved (she isn't pressing anything).
      this.resolveServeContact("good", 0);
    }
  }

  /**
   * Resolves the one and only contact attempt for this serve. A non-miss
   * quality reuses launchShot() — the exact same function every rally hit
   * already goes through — so the serve enters the existing physics/rally
   * pipeline with no duplicated logic. Because the ball's x/y have been
   * locked to the server's own position throughout the toss (see
   * startToss/updateToss), launchShot's `x: from.x` (it never touches `y`)
   * lands on a ball that was already exactly at the server's position —
   * this is the fix for the audited ball.y-vs-server.y bug, by construction.
   */
  private resolveServeContact(quality: ServeQuality, direction: -1 | 0 | 1): void {
    const server = this.score.server;
    const serverPlayer = server === "leo" ? this.leo : this.alice;

    if (quality === "miss") {
      const receiver: Side = server === "leo" ? "alice" : "leo";
      this.awardPointTo(receiver); // resets everything for the next point, including both lastShot to null
      // A fault and its point-end happen in the same frame (unlike a normal
      // rally miss, where the shot and the eventual point-end are always
      // several frames apart) — restore the fault feedback *after* the
      // reset above so "MISS" is actually visible on this frame instead of
      // being silently wiped by the same-frame reset.
      if (server === "leo") this.leo = { ...this.leo, lastShot: "miss" };
      else this.alice = { ...this.alice, lastShot: "miss" };
      return;
    }

    if (server === "leo") this.leo = { ...this.leo, lastShot: quality };
    else this.alice = { ...this.alice, lastShot: quality };

    const aimY = this.computeAimY(serverPlayer.y, direction);
    this.launchShot(server, quality, aimY);
    this.phase = "rally";
  }

  /**
   * Point-reset pipeline (see docs/PROGRESS.md "Etapa 5", section 20 of the
   * approved spec): repositions both players to the new serve side, puts a
   * neutral ball at the new server's position, clears per-point feedback,
   * and returns to "ready_to_serve" — nothing from the finished point can
   * leak into the next one.
   */
  private resetForNextServe(): void {
    this.serveTimerMs = 0;
    this.aliceServeDelayMs = 0;
    this.hitBufferMs = 0; // a leftover armed press from the point that just ended must not silently swing at the next point's first ball
    this.leo = { ...this.leo, lastShot: null };
    this.alice = { ...this.alice, lastShot: null };

    const totalPointsInGame = this.score.points[0] + this.score.points[1];
    const targetY = computeServeY(getServeSide(totalPointsInGame));
    this.leo = { ...this.leo, y: targetY, vy: 0 };
    this.alice = { ...this.alice, y: targetY, vy: 0 };

    const server = this.score.server;
    const serverPlayer = server === "leo" ? this.leo : this.alice;
    this.ball = {
      x: serverPlayer.x,
      y: serverPlayer.y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      owner: server === "leo" ? "alice" : "leo",
      lastHitBy: null,
      state: "idle",
      bounceCount: 0,
    };

    this.phase = "ready_to_serve";
  }

  /**
   * AI decides *where* (computeCpuTargetY), the movement model decides *how*
   * (cpuDesiredVelocity + stepLateralMotion — bounded acceleration, braking
   * on approach, a dead zone on arrival). The error roll is the one sampled
   * for this incoming shot, not a fresh one per frame — see aliceErrorRoll.
   *
   * Two-layer bounds protection (see docs/PROGRESS.md — this is the fix for
   * the historical "Alice left the court" bug): camada 1 is inside
   * computeCpuTargetY itself (the target it hands back is already clamped
   * to alicePlayableBounds), camada 2 is clamping the position the motion
   * step actually produces, so a future change to either function can't
   * reintroduce an out-of-bounds Alice on its own.
   */
  /** Alice's tuning for this match — TUTORIAL_PARAMS when tutorialMode is on, otherwise the selected Difficulty's own params. See GameEngineOptions.tutorialMode. */
  private cpuParams(): DifficultyParams {
    return this.tutorialMode ? TUTORIAL_PARAMS : DIFFICULTY_PARAMS[this.difficulty];
  }

  private updateAlicePosition(dt: number): void {
    const params = this.cpuParams();
    const bounds = COURT.alicePlayableBounds;
    const targetY = computeCpuTargetY(this.ball, this.alice, params, this.aliceErrorRoll, bounds);
    const chasing = this.ball.owner === "alice";
    const maxSpeed = chasing ? params.maxMoveSpeed : params.maxMoveSpeed * CPU_RECOVERY_SPEED_RATIO;
    const desiredVy = cpuDesiredVelocity(targetY - this.alice.y, maxSpeed, CPU_BRAKE_TIME, CPU_ARRIVE_EPSILON);
    const motion = stepLateralMotion({ y: this.alice.y, vy: this.alice.vy }, desiredVy, CPU_ACCEL, dt, bounds.minY, bounds.maxY);
    const safeY = clampToBounds(this.alice.x, motion.y, bounds).y;
    this.alice = { ...this.alice, y: safeY, vy: motion.vy };
  }

  /**
   * Arms/re-checks Leo's buffered hit-key press. A fresh press (re-)arms the
   * buffer to its full duration regardless of whether one was already
   * counting down — a second tap always means "try again now", not "extend
   * the old attempt". While armed and it's Leo's ball, retries every frame
   * (the same no-cost retry the CPU already gets in maybeAttemptCpuHit) so
   * an early press keeps a live chance as the ball closes in, instead of
   * being discarded on the single frame it happened to be read. A resolved
   * "miss" is only ever recorded once — at the moment the buffer actually
   * runs out without connecting — never on every intermediate too-far
   * evaluation, so the miss animation/feedback doesn't fire prematurely
   * while the ball is still approaching.
   */
  private updateLeoHitBuffer(dt: number, input: InputState): void {
    if (input.hitPressed) this.hitBufferMs = PLAYER_HIT_BUFFER_MS;
    if (this.hitBufferMs <= 0) return;

    if (this.ball.owner === "leo" && this.attemptPlayerHit(input.direction)) {
      this.hitBufferMs = 0;
      return;
    }

    this.hitBufferMs -= dt * 1000;
    if (this.hitBufferMs <= 0) {
      this.hitBufferMs = 0;
      // Deliberately doesn't also set `lastEvent` here (unlike a real
      // connect in launchShot): lastEvent's "hit" type is read elsewhere as
      // "a shot was actually exchanged" (e.g. rally-alternation checks) — a
      // spent buffer is a non-event for that purpose. LeoAnimator's MISS
      // state is driven off `leo.lastShot` directly, which this does set.
      if (this.ball.owner === "leo") this.leo = { ...this.leo, lastShot: "miss" };
    }
  }

  /** Evaluates one hit attempt at the current instant. Returns true (and launches the shot) only on a real connect — never mutates state on a miss, since a buffered retry may still land on a later frame. */
  private attemptPlayerHit(direction: -1 | 0 | 1): boolean {
    const quality = evaluateHitAttempt(this.ball, this.leo);
    if (quality === "miss") return false;

    this.leo = { ...this.leo, lastShot: quality };
    const aimY = this.computeAimY(this.leo.y, direction);
    this.launchShot("leo", quality, aimY);
    return true;
  }

  private maybeAttemptCpuHit(): void {
    const dx = Math.abs(this.ball.x - this.alice.x);
    if (dx > REACH_X_PERFECT) return; // waits for a near-perfect window — see docs/GAME_DESIGN.md "CPU (Alice)"

    const rawQuality = evaluateHitAttempt(this.ball, this.alice);
    const params = this.cpuParams();
    const quality = applyHitError(rawQuality, params, this.random());
    this.alice = { ...this.alice, lastShot: quality };
    if (quality === "miss") return;

    // Tutorial: always straight back at wherever Leo currently is — the
    // whole point is a return he can reasonably reach every time. Normal
    // play keeps the existing uniformly-random aim (real tennis variety).
    const aimY = this.tutorialMode ? this.leo.y : this.random() * COURT_WIDTH;
    this.launchShot("alice", quality, aimY, params.ballSpeedMultiplier);
  }

  private computeAimY(currentY: number, direction: -1 | 0 | 1): number {
    const raw = currentY + direction * AIM_OFFSET;
    return Math.max(0, Math.min(COURT_WIDTH, raw));
  }

  private launchShot(hitter: Side, quality: Exclude<HitQuality, "miss">, aimY: number, extraMultiplier = 1): void {
    const from = hitter === "leo" ? this.leo : this.alice;
    const toX = hitter === "leo" ? ALICE_X : LEO_X;
    const speed = BASE_BALL_SPEED * HIT_QUALITY_SPEED_MULTIPLIER[quality] * this.currentSpeedMultiplier() * extraMultiplier;

    const launch = computeLaunchVelocity({ fromX: from.x, fromY: from.y, toX, toY: aimY, speed });
    const receiver: Side = hitter === "leo" ? "alice" : "leo";

    this.ball = {
      ...this.ball,
      x: from.x,
      z: 0,
      vx: launch.vx,
      vy: launch.vy,
      vz: launch.vz,
      owner: receiver,
      lastHitBy: hitter,
      state: "in_play",
      bounceCount: 0,
    };

    this.rallyCount += 1;
    this.lastEvent = { type: "hit", side: hitter, quality };
    // One positioning-error roll per shot coming at Alice — held for the
    // whole flight so her target (and therefore her run) is a single
    // committed read, not a per-frame jitter (see computeCpuTargetY).
    if (hitter === "leo") this.aliceErrorRoll = this.random();
  }

  private checkPointEndingConditions(): void {
    let winner: Side | null = null;

    if (this.ball.owner === "leo" && hasBallPassedPlayer(this.ball, this.leo, "leo")) {
      winner = "alice";
    } else if (this.ball.owner === "alice" && hasBallPassedPlayer(this.ball, this.alice, "alice")) {
      winner = "leo";
    } else if (isDoubleBounce(this.ball)) {
      winner = this.ball.owner === "leo" ? "alice" : "leo";
    } else if (isOutOfBounds(this.ball, COURT_WIDTH) && this.ball.lastHitBy) {
      winner = this.ball.lastHitBy === "leo" ? "alice" : "leo";
    }

    if (!winner) return;
    this.awardPointTo(winner);
  }

  private awardPointTo(winner: Side): void {
    const gamesBefore = [...this.score.games] as [number, number];
    const setsBefore = [...this.score.sets] as [number, number];
    this.score = awardPoint(this.score, winner);
    this.rallyCount = 0;

    const setChanged = this.score.sets[0] !== setsBefore[0] || this.score.sets[1] !== setsBefore[1];
    // awardPoint zeroes the game count when a set is won, so a set win is
    // always also a game win (and a server change) even though games[] may
    // read 0-0 again afterwards.
    const gameChanged = setChanged || this.score.games[0] !== gamesBefore[0] || this.score.games[1] !== gamesBefore[1];
    const matchWinner = isMatchOver(this.score);

    if (matchWinner) {
      this.phase = "game_over";
      this.lastEvent = { type: "match", winner: matchWinner };
      return;
    }

    if (gameChanged) {
      this.score = { ...this.score, server: this.score.server === "leo" ? "alice" : "leo" };
      this.lastEvent = setChanged ? { type: "set", winner } : { type: "game", winner };
    } else {
      this.lastEvent = { type: "point", winner };
    }

    this.resetForNextServe();
  }
}
