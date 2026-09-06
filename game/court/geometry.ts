/**
 * Single source of truth for the tennis court's topology. See
 * docs/GAME_DESIGN.md "Technical Design" for the coordinate system: X is
 * the length axis (Leo's baseline near one edge, Alice's near the other,
 * net at the midpoint), Y is the lateral axis both players move along.
 *
 * This module derives every line (singles/doubles sidelines, service
 * lines, center service line) from the project's existing
 * COURT_LENGTH/COURT_WIDTH/LEO_X/ALICE_X/NET_X constants, using the *real*
 * ITF tennis court's proportions as ratios only — this is not a metric
 * simulation, just a way to keep the arcade court's lines in the correct
 * relative positions to each other (see docs/PROGRESS.md, "Geometria da
 * quadra"). It deliberately does NOT reuse the geometry implicit in
 * public/assets/court/derived/half-court-lines.png — that asset's
 * topology/proportions were never validated against real tennis and were
 * identified as the likely cause of the confusing court markings.
 *
 * Nothing here is wired into rendering, movement, collision, or the CPU
 * yet — this module only defines and tests the geometry itself.
 */

import { ALICE_X, COURT_LENGTH, COURT_WIDTH, LEO_X, NET_X } from "@/game/constants";

// Real ITF doubles-court proportions, used only as ratios.
const DOUBLES_WIDTH_FT = 36;
const SINGLES_WIDTH_FT = 27;
const HALF_LENGTH_FT = 39; // net to baseline
const SERVICE_LINE_FROM_NET_FT = 21;

/** Fraction of the total width that the singles sideline is inset from the doubles sideline, on each side. */
const SINGLES_INSET_RATIO = (DOUBLES_WIDTH_FT - SINGLES_WIDTH_FT) / 2 / DOUBLES_WIDTH_FT;
/** Fraction of each half-length (net to baseline) at which the service line sits, measured from the net. */
const SERVICE_LINE_RATIO = SERVICE_LINE_FROM_NET_FT / HALF_LENGTH_FT;

/**
 * A rectangular region in world coordinates. `minX`/`maxX` bound the
 * length axis (a baseline-side limit and a net-side limit); `minY`/`maxY`
 * bound the lateral axis (the two sidelines).
 */
export interface PlayableBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CourtGeometry {
  /** Full court length (baseline to baseline) — same value as COURT_LENGTH. */
  length: number;
  /** Full court width (doubles sideline to doubles sideline) — same value as COURT_WIDTH. */
  width: number;

  /** X position of the net — same value as NET_X. */
  netX: number;
  /** X position of Leo's baseline — same value as LEO_X. */
  leoBaselineX: number;
  /** X position of Alice's baseline — same value as ALICE_X. */
  aliceBaselineX: number;
  /** X position of the service line on Leo's side, between leoBaselineX and netX. */
  leoServiceLineX: number;
  /** X position of the service line on Alice's side, between netX and aliceBaselineX. */
  aliceServiceLineX: number;

  /** Y of the doubles sideline nearer Y=0 (rendered at the top of the court on screen). */
  doublesTop: number;
  /** Y of the doubles sideline nearer Y=width (rendered at the bottom of the court on screen). */
  doublesBottom: number;
  /** Y of the singles sideline nearer Y=0 — inset from doublesTop. */
  singlesTop: number;
  /** Y of the singles sideline nearer Y=width — inset from doublesBottom. */
  singlesBottom: number;
  /** Y of the center service line — the lateral midpoint, shared by both halves. */
  centerServiceY: number;

  /** Leo's side of the net — he can never be positioned outside this rectangle. */
  leoPlayableBounds: PlayableBounds;
  /** Alice's side of the net — she can never be positioned outside this rectangle. */
  alicePlayableBounds: PlayableBounds;
}

function buildCourtGeometry(): CourtGeometry {
  const length = COURT_LENGTH;
  const width = COURT_WIDTH;
  const netX = NET_X;
  const leoBaselineX = LEO_X;
  const aliceBaselineX = ALICE_X;

  const singlesInset = width * SINGLES_INSET_RATIO;
  const doublesTop = 0;
  const doublesBottom = width;
  const singlesTop = singlesInset;
  const singlesBottom = width - singlesInset;
  const centerServiceY = width / 2;

  const leoHalfLength = netX - leoBaselineX;
  const aliceHalfLength = aliceBaselineX - netX;
  const leoServiceLineX = netX - leoHalfLength * SERVICE_LINE_RATIO;
  const aliceServiceLineX = netX + aliceHalfLength * SERVICE_LINE_RATIO;

  const leoPlayableBounds: PlayableBounds = { minX: 0, maxX: netX, minY: doublesTop, maxY: doublesBottom };
  const alicePlayableBounds: PlayableBounds = { minX: netX, maxX: length, minY: doublesTop, maxY: doublesBottom };

  return {
    length,
    width,
    netX,
    leoBaselineX,
    aliceBaselineX,
    leoServiceLineX,
    aliceServiceLineX,
    doublesTop,
    doublesBottom,
    singlesTop,
    singlesBottom,
    centerServiceY,
    leoPlayableBounds,
    alicePlayableBounds,
  };
}

/** The single, precomputed court geometry — every consumer (render, movement, collision, CPU) should read from this rather than deriving its own numbers. Not yet wired into any of them (see docs/PROGRESS.md). */
export const COURT: CourtGeometry = buildCourtGeometry();

/** Clamps a point into a PlayableBounds rectangle. Not used by any gameplay code yet — provided so the next step (Alice's clamp fix) has a single, tested implementation to call instead of writing a new Math.max/min inline. */
export function clampToBounds(x: number, y: number, bounds: PlayableBounds): { x: number; y: number } {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, y)),
  };
}
