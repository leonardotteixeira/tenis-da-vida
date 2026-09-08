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
// Lateral acceleration/braking (world units / s²) — see game/player/movement.ts.
// Leo: 0 → PLAYER_MOVE_SPEED in ~90 ms, short enough that a tap still feels
// instant but a reversal visibly plants and pushes off instead of snapping.
export const PLAYER_ACCEL = 2800;
// Alice: a slightly longer ramp (0 → 240 in ~160 ms) so she reads as a body
// with momentum; braking over CPU_BRAKE_TIME seconds of remaining travel so
// she settles under the ball instead of stopping dead on it.
export const CPU_ACCEL = 1500;
export const CPU_BRAKE_TIME = 0.14; // seconds
export const CPU_ARRIVE_EPSILON = 2; // world units — inside this she's "there" and holds still, no micro-twitch
// While the ball is Leo's, Alice drifts back toward the middle at this
// fraction of her difficulty's max speed — a visible "recover to ready",
// slow enough not to change how much court she can actually cover on the
// next shot at any difficulty.
export const CPU_RECOVERY_SPEED_RATIO = 0.45;

// Reach thresholds for hit-quality evaluation (distance in X between the
// ball and the player's fixed baseline X at the moment of the hit attempt).
//
// These are tuned against real-world-clock windows, not picked in
// isolation: at a typical mid-rally ball speed of ~420-650 world units/s
// (BASE_BALL_SPEED scaled by quality/rally/difficulty multipliers — see
// GameEngine.launchShot), a threshold of N world units on X is a real-time
// window of roughly (2*N / speed) seconds as the ball crosses it. The old
// values (12/28/50) gave GOOD only ~90-135ms and LATE ~155-240ms — near or
// below human reaction+decision time, and with no margin for the one-shot
// nature of a keyboard press (see PLAYER_HIT_BUFFER_MS below). Widened here
// so GOOD reads as ~125-190ms and LATE as ~200-315ms — enough to build a
// rally without collapsing the skill gap between PERFECT and the rest.
export const REACH_X_PERFECT = 16;
export const REACH_X_GOOD = 40;
export const REACH_X_LATE = 66;
export const REACH_Y = 68; // max lateral (Y) distance the racquet can cover — slightly widened alongside REACH_X_* so a slightly-imperfect lateral read isn't a separate, uncommunicated way to miss
export const MAX_REACHABLE_Z = 140; // ball above this height cannot be returned (except a smash window, future work)

// How long (ms) a hit-key press stays "armed" waiting for the ball to enter
// range, instead of being discarded the instant it's read (see
// game/input/keyboard.ts — InputState.hitPressed is a single-frame edge,
// true only on the exact frame of the physical keydown). Without this, a
// press that's a little early — the single most common human timing error,
// since anticipating early is more natural than reacting late — is wasted
// outright and the player must physically release and press again with no
// on-screen indication that the first attempt didn't just fail, it never
// even evaluated against a reachable ball. GameEngine.update re-attempts
// the hit every frame while the buffer is live and the ball hasn't arrived
// yet; it's consumed the instant a real hit connects, or once it expires
// without one (a genuine miss). This never lets a swing succeed outside the
// REACH_X_*/REACH_Y windows above — it only gives an early press more
// chances to land inside them, the same forgiveness a continuously-held key
// would already get for free (see docs/PROGRESS.md "Physics & Game Feel").
export const PLAYER_HIT_BUFFER_MS = 130;

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
// Alice used to start her toss on the very first frame after a point ended,
// so the point banner/celebration and the score change were never readable
// before the next ball was already in the air. She now waits this long in
// "ready_to_serve" first — a beat, not a cutscene. Leo's own serve is never
// delayed (he decides when to press).
export const ALICE_SERVE_DELAY_MS = 900;
