/**
 * Core shared types for the Tennis Challenge simulation.
 *
 * Coordinate system (see docs/GAME_DESIGN.md "Technical Design" for the
 * full rationale): X is the court's length axis — Leo's baseline is a
 * fixed X near one edge, Alice's a fixed X near the other, net at the
 * midpoint. Y is the lateral axis each player moves along (A/D) within
 * their own baseline — this is the "left/right" from the game design doc.
 * Z is the ball's height off the ground, used only for the arc/bounce
 * and for reachability checks — never for player positioning.
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type Side = "leo" | "alice";

export type HitQuality = "perfect" | "good" | "late" | "miss";

/**
 * "idle" — held/reset, no physics beyond the serve toss; "in_play" — flying;
 * "bouncing" — exactly the one frame the ball touches the court (see
 * stepBallPhysics). The former "out"/"point_over" members were never
 * assigned anywhere (release audit) and were removed.
 */
export type BallStateType = "idle" | "in_play" | "bouncing";

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Which side the ball is currently traveling toward — who must hit it next. */
  owner: Side;
  lastHitBy: Side | null;
  state: BallStateType;
  /** Bounces since the last hit. A 2nd bounce before the receiver hits it ends the point. */
  bounceCount: number;
}

export interface PlayerState {
  side: Side;
  /** Fixed baseline X for this side — constant during play. */
  x: number;
  /** Lateral position, clamped to [0, COURT_WIDTH]. */
  y: number;
  /** Signed lateral velocity, world units / s — see game/player/movement.ts. Presentation reads it to pick walk/run frames. */
  vy: number;
  lastShot: HitQuality | null;
}

export interface ScoreState {
  /** [leo, alice] points within the current game (0..3 index into 0/15/30/40, or advantage territory). */
  points: [number, number];
  games: [number, number];
  /** Sets won — rendered as hearts in the HUD. */
  sets: [number, number];
  server: Side;
}

/**
 * Etapa 5: "serving" was split into two real, renderable phases
 * ("ready_to_serve" / "toss") now that the serve is playable instead of an
 * instantaneous internal transition. "point_scored" was removed — it was
 * declared but never assigned anywhere (see docs/PROGRESS.md "Etapa 5"
 * audit); the point-end reset is synchronous (award → reposition → back to
 * "ready_to_serve"), so there was nothing for a persisted phase to represent.
 */
export type MatchPhase = "ready_to_serve" | "toss" | "rally" | "game_over";

export interface RallyState {
  count: number;
  level: number;
  speedMultiplier: number;
}

export type GameEvent =
  | { type: "hit"; side: Side; quality: HitQuality }
  | { type: "point"; winner: Side }
  | { type: "game"; winner: Side }
  | { type: "set"; winner: Side }
  | { type: "match"; winner: Side };

export interface GameSnapshot {
  ball: BallState;
  leo: PlayerState;
  alice: PlayerState;
  score: ScoreState;
  rally: RallyState;
  phase: MatchPhase;
  lastEvent: GameEvent | null;
}

export type Difficulty = "easy" | "normal" | "hard" | "insane";

export interface InputState {
  /** -1 = move toward Y=0 (A/left), 1 = move toward Y=COURT_WIDTH (D/right), 0 = no input. */
  direction: -1 | 0 | 1;
  /** True only on the frame the hit key was pressed — not held. */
  hitPressed: boolean;
  smashHeld: boolean;
}
