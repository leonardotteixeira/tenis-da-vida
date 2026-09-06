/**
 * Centralized tunable constants — see docs/GAME_DESIGN.md "Technical
 * Design" for the coordinate-system rationale. Nothing in game/ should
 * hardcode a "magic number" that belongs here.
 */

export const COURT_LENGTH = 1000; // X axis: Leo's baseline (LEO_X) .. Alice's baseline (ALICE_X)
export const COURT_WIDTH = 500; // Y axis: lateral movement range for both players and the ball

export const LEO_X = 60;
export const ALICE_X = COURT_LENGTH - 60;
export const NET_X = COURT_LENGTH / 2;

export const GRAVITY = -900; // world units / s^2 (negative pulls Z down)
export const BOUNCE_DAMPING = 0.55; // fraction of vertical speed retained after a bounce

export const PLAYER_MOVE_SPEED = 260; // world units / s, Leo's max lateral speed

// Reach thresholds for hit-quality evaluation (distance in X between the
// ball and the player's fixed baseline X at the moment of the hit attempt).
export const REACH_X_PERFECT = 12;
export const REACH_X_GOOD = 28;
export const REACH_X_LATE = 50;
export const REACH_Y = 60; // max lateral (Y) distance the racquet can cover
export const MAX_REACHABLE_Z = 140; // ball above this height cannot be returned (except a smash window, future work)

export const BASE_BALL_SPEED = 420; // world units / s, before difficulty/quality/level multipliers
export const ARC_MIN_TIME = 0.35; // seconds — floor on flight time so very close shots don't produce a degenerate (near-vertical) arc

// Serve mechanic (Etapa 5 — see docs/PROGRESS.md). The toss is stepped
// through the existing stepBallPhysics gravity integration (vx=vy=0, only vz
// set), so SERVE_TOSS_VZ is chosen so the ball's natural apex — vz / |GRAVITY|
// — lands almost exactly at SERVE_TOSS_IDEAL_MS: 450 / 900 = 0.5s = 500ms.
export const SERVE_TOSS_VZ = 450; // world units / s, initial upward toss velocity
export const SERVE_TOSS_IDEAL_MS = 500; // the toss apex — the "perfect" contact instant
export const SERVE_PERFECT_WINDOW_MS = 80; // +/- around SERVE_TOSS_IDEAL_MS for a PERFECT serve
export const SERVE_GOOD_WINDOW_MS = 220; // +/- around SERVE_TOSS_IDEAL_MS for a GOOD serve (outside PERFECT, inside this)
export const SERVE_TOSS_TIMEOUT_MS = 900; // no contact attempt by this point auto-faults (well past the GOOD window)
export const ALICE_SERVE_CONTACT_MS = 500; // Alice's fixed, deterministic auto-contact instant — no randomness, no timing skill involved
