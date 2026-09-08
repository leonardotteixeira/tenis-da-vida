/**
 * Lateral (Y-axis) movement shared by both players — pure functions, no
 * input-reading (see game/input/keyboard.ts) and no AI decisions (see
 * game/cpu/ai.ts). See docs/GAME_DESIGN.md "Technical Design".
 *
 * Polish pass: movement is a velocity model with bounded acceleration
 * instead of a position teleport-per-frame. A player who reverses direction
 * now visibly brakes and re-accelerates (a sense of weight), and a player who
 * stops does so over a few frames instead of freezing mid-stride. The ramps
 * are short on purpose — Leo reaches full speed in ~90 ms — so the input
 * still feels immediate (see PLAYER_ACCEL / CPU_ACCEL in game/constants.ts).
 */

export interface LateralMotion {
  y: number;
  /** Signed lateral velocity, world units / s. Positive = toward Y=courtWidth. */
  vy: number;
}

/**
 * Advances one lateral motion step: `vy` moves toward `targetVy` by at most
 * `accel * dt`, then `y` integrates the new velocity and is clamped to
 * [minY, maxY]. Hitting a wall kills the velocity so the player doesn't
 * "lean" into the sideline and lag when reversing away from it.
 */
export function stepLateralMotion(motion: LateralMotion, targetVy: number, accel: number, dt: number, minY: number, maxY: number): LateralMotion {
  const maxDelta = accel * dt;
  const delta = targetVy - motion.vy;
  const vy = Math.abs(delta) <= maxDelta ? targetVy : motion.vy + Math.sign(delta) * maxDelta;

  const rawY = motion.y + vy * dt;
  const y = Math.max(minY, Math.min(maxY, rawY));
  return { y, vy: y === rawY ? vy : 0 };
}

/**
 * The velocity a CPU-driven player should aim for to reach a target `delta`
 * world units away: full `maxSpeed` while far, easing off over the last
 * `brakeTime` seconds of travel so arrival is a settle, not a slam — and
 * exactly 0 inside a small dead zone, so a target that is already reached
 * never produces a one-frame twitch. Never overshoots on its own: the
 * result, integrated over one frame, is always short of `delta`.
 */
export function cpuDesiredVelocity(delta: number, maxSpeed: number, brakeTime: number, arriveEpsilon: number): number {
  if (Math.abs(delta) <= arriveEpsilon) return 0;
  const braking = delta / brakeTime;
  return Math.max(-maxSpeed, Math.min(maxSpeed, braking));
}
