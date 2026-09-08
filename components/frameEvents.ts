/**
 * The one place the presentation layer turns two consecutive engine
 * snapshots into discrete "something happened this frame" signals. Every
 * consumer that reacts to a moment — animators, impact effects, banners,
 * audio, match stats — reads these instead of re-deriving its own edge
 * detection from raw snapshot fields, so there is exactly one definition of
 * "a hit", "a bounce", "a miss" and "a point" on the presentation side.
 *
 * Nothing here is new information: it only reads what GameEngine already
 * publishes (see game/engine/GameEngine.ts).
 *  - hit:   `lastEvent.type === "hit"`, emitted once per connect by
 *           launchShot (rally return or serve, either player).
 *  - bounce: the in_play → bouncing edge — stepBallPhysics holds "bouncing"
 *           for exactly the touchdown frame, so this is once per bounce.
 *  - miss:  `player.lastShot` becoming "miss". Leo's buffered miss and both
 *           players' serve faults set it exactly at the moment of failure;
 *           Alice's CPU miss may re-evaluate to "miss" on consecutive frames,
 *           which the transition check collapses into one signal.
 *  - point: any of the point/game/set/match events.
 */
import type { GameEvent, GameSnapshot, HitQuality, Side } from "@/game/types";

export type PointEventType = "point" | "game" | "set" | "match";

export interface FrameEvents {
  hit: { side: Side; quality: Exclude<HitQuality, "miss"> } | null;
  bounce: boolean;
  miss: Side | null;
  point: { type: PointEventType; winner: Side } | null;
}

const NO_EVENTS: FrameEvents = Object.freeze({ hit: null, bounce: false, miss: null, point: null });

export function readFrameEvents(prev: GameSnapshot, next: GameSnapshot): FrameEvents {
  // GameEngine.update() clears lastEvent at the start of every frame and
  // allocates a fresh object per event — except after the match ends, when
  // update() returns early and the final {type:"match"} object stays put on
  // every later snapshot. Reference inequality is therefore exactly "this
  // event is new this frame", which keeps the match banner, sound and
  // celebration from re-triggering on every frame of the outro.
  const event = next.lastEvent !== prev.lastEvent ? next.lastEvent : null;
  const hit = event?.type === "hit" && event.quality !== "miss" ? { side: event.side, quality: event.quality } : null;
  const bounce = prev.ball.state !== "bouncing" && next.ball.state === "bouncing";
  const miss = becameMiss(prev, next, "leo") ? "leo" : becameMiss(prev, next, "alice") ? "alice" : null;
  const point = event && isPointEvent(event) ? { type: event.type, winner: event.winner } : null;
  if (!hit && !bounce && !miss && !point) return NO_EVENTS;
  return { hit, bounce, miss, point };
}

function becameMiss(prev: GameSnapshot, next: GameSnapshot, side: Side): boolean {
  return next[side].lastShot === "miss" && prev[side].lastShot !== "miss";
}

function isPointEvent(event: GameEvent): event is Extract<GameEvent, { type: PointEventType }> {
  return event.type === "point" || event.type === "game" || event.type === "set" || event.type === "match";
}
