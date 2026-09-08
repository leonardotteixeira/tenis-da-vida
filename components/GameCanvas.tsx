"use client";

import { useEffect, useRef, useState } from "react";
import { COURT_LENGTH, COURT_WIDTH } from "@/game/constants";
import { COURT } from "@/game/court/geometry";
import { GameEngine } from "@/game/engine/GameEngine";
import { KeyboardInput } from "@/game/input/keyboard";
import type { Difficulty, GameSnapshot, HitQuality, Side } from "@/game/types";
import { HUD } from "@/components/HUD";
import { PauseOverlay } from "@/components/PauseOverlay";
import { LeoAnimator } from "@/components/leoAnimation";
import { AliceAnimator } from "@/components/aliceAnimation";
import type { PlayerAnimationFrame } from "@/components/playerAnimation";
import { ImpactEffects, type Particle, type ParticleKind } from "@/components/impactEffects";
import { readFrameEvents, type PointEventType } from "@/components/frameEvents";
import { GameAudio } from "@/components/audio";
import { MatchStatsTracker, type MatchStats } from "@/components/matchStats";
import { TutorialController } from "@/components/tutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";

const CANVAS_WIDTH = COURT_LENGTH; // 1000 — world X maps 1:1 to canvas pixels
const TOP_MARGIN = 220; // room for the stadium backdrop crop above the playing surface
const BOTTOM_MARGIN = 40;
const CANVAS_HEIGHT = TOP_MARGIN + COURT_WIDTH + BOTTOM_MARGIN;
const Z_LIFT = 0.6; // how many canvas px a ball rises per world unit of height

const SPRITE_HEIGHT = 150;

// Leo's animation frames — deterministically sliced from
// public/assets/characters/leo/leo sprite sheet.png. See
// public/assets/characters/leo/derived/FRAME_MAP.md for the exact source
// bounding boxes and which groups were deliberately NOT sliced (their poses
// overlap in the source sheet with no real transparency gap between frames).
const LEO = "/assets/characters/leo/derived";
const LEO_IDLE_SRCS = [1, 2, 3, 4].map((i) => `${LEO}/idle-${i}.png`);
const LEO_WALK_SRCS = [1, 2, 3, 4, 5].map((i) => `${LEO}/walk-${i}.png`);
const LEO_RUN_SRCS = [1, 2, 3, 4].map((i) => `${LEO}/run-${i}.png`);
const LEO_PREPARE_SRCS = [1, 2].map((i) => `${LEO}/prepare-${i}.png`);
const LEO_CONTACT_SRC = `${LEO}/forehand-contact.png`;
const LEO_MISS_SRCS = [1, 2, 3].map((i) => `${LEO}/miss-${i}.png`);
const LEO_CELEBRATE_SRCS = [1, 2].map((i) => `${LEO}/celebrate-${i}.png`);

// Alice's animation frames — deterministically sliced from
// public/assets/characters/alice/ALICE SPRITE SHEET.png, with IDLE/MISS
// re-oriented to face left (see derived/FRAME_MAP.md — the sheet itself is
// inconsistent between groups). WALK/RUN/CELEBRATE were added in the polish
// pass; see FRAME_MAP.md for the exact source bounding boxes.
const ALICE = "/assets/characters/alice/derived";
const ALICE_IDLE_SRCS = [1, 2, 3, 4].map((i) => `${ALICE}/idle-${i}.png`);
const ALICE_WALK_SRCS = [1, 2, 3, 4, 5].map((i) => `${ALICE}/walk-${i}.png`);
const ALICE_RUN_SRCS = [1, 2, 3, 4].map((i) => `${ALICE}/run-${i}.png`);
const ALICE_PREPARE_FOREHAND_SRCS = [1, 2, 3].map((i) => `${ALICE}/prepare-forehand-${i}.png`);
const ALICE_PREPARE_BACKHAND_SRCS = [1, 2, 3].map((i) => `${ALICE}/prepare-backhand-${i}.png`);
const ALICE_FOREHAND_CONTACT_SRC = `${ALICE}/forehand-contact.png`;
const ALICE_BACKHAND_CONTACT_SRC = `${ALICE}/backhand-contact.png`;
const ALICE_MISS_SRCS = [1, 2].map((i) => `${ALICE}/miss-${i}.png`);
const ALICE_CELEBRATE_SRCS = [1, 2].map((i) => `${ALICE}/celebrate-${i}.png`);

const BACKDROP_SRC = "/assets/court/COURT 1.png";
// The source image's clay court surface (with its own, differently-oriented
// net) starts around y=515 of its 1024px height — everything above that
// (sky, skyline, trees, crowd, ad boards, umpire chair) is reusable as a
// static backdrop. We draw our own grass/clay/net below it, matching
// docs/GAME_DESIGN.md's side-elevation camera (vertical net), which this
// source image was not composed for.
const BACKDROP_SOURCE_HEIGHT = 515;
const BACKDROP_NATIVE_WIDTH = 1536;

// Derived court assets — real pixel-art, extracted (and where noted,
// rotated) from the catalog sheets in public/assets/court and
// public/assets/objetos, which are flat presentation sheets on an opaque
// background rather than ready-made game sprites. See docs/PROGRESS.md for
// the extraction notes (source file, crop box, chroma-key threshold).
//
// NOTE: public/assets/court/derived/half-court-lines.png (a rotated crop of
// court 4's flat line-overlay diagram) is no longer loaded here. Its
// topology/proportions were never validated against a real tennis court and
// it was identified as the likely cause of the confusing markings — the
// court's line markings are now drawn programmatically from COURT (see
// drawCourtLines below), not from that asset.
const NET_SRC = "/assets/court/derived/net-vertical.png"; // rotated 90° from objetos/rede.png's front-view net
const TEXTURE_CLAY_SRC = "/assets/court/derived/texture-clay.png";
const TEXTURE_GRASS_SRC = "/assets/court/derived/texture-grass.png";
const JUDGE_SRC = "/assets/characters/JUIZ/derived/normal.png"; // chroma-keyed out of characters/JUIZ/juiz.png's frontal "NORMAL" pose

// Ball rotation frames — 8 evenly-spaced icons from the "ANIMAÇÃO NORMAL
// (ROTAÇÃO)" row of public/assets/ball/bola.png, chroma-keyed the same way
// as the net/judge (that sheet is an opaque RGB catalog page, no alpha).
const BALL_ROTATION_SRCS = Array.from({ length: 8 }, (_, i) => `/assets/ball/derived/rotation-${i + 1}.png`);
const BALL_SPIN_FRAME_MS = 45; // fast enough to read as spin, not a slideshow, at typical rally ball speeds
const BALL_RENDER_HEIGHT = 18; // small relative to Leo's 150px sprite height — see docs/PROGRESS.md scale note

// Timing/point banners — the game's own pixel-art VFX, chroma-keyed out of
// public/assets/efeitos/efeitos sprite sheet.png ("EFEITOS DE PONTUAÇÃO
// (TIMING)" and "EFEITOS DE PONTO" panels). See docs/PROGRESS.md.
const BANNER = "/assets/efeitos/derived";
const HIT_BANNER_SRCS: Record<HitQuality, string> = {
  perfect: `${BANNER}/banner-perfect.png`,
  good: `${BANNER}/banner-good.png`,
  late: `${BANNER}/banner-late.png`,
  miss: `${BANNER}/banner-miss.png`,
};
const POINT_BANNER_SRCS: Record<PointEventType, string> = {
  point: `${BANNER}/banner-point.png`,
  game: `${BANNER}/banner-game.png`,
  set: `${BANNER}/banner-set.png`,
  match: `${BANNER}/banner-match.png`,
};
const HIT_BANNER_HEIGHT = 52; // on-screen px — small enough to sit over a head without hiding the court
const POINT_BANNER_HEIGHT = 96;

const NET_VISUAL_THICKNESS = 26; // on-screen px — deliberately NOT derived from the sprite's own aspect ratio (see docs/PROGRESS.md)
const JUDGE_RENDER_HEIGHT = 70; // bigger than the backdrop's own tiny baked-in chair so it actually reads, matching how Leo/Alice are already drawn oversized vs the crowd

/** How long the final MATCH! banner and the winner's celebration stay on the court before the result screen takes over. */
const MATCH_OUTRO_MS = 1600;

function drawY(worldY: number, worldZ = 0): number {
  return worldY + TOP_MARGIN - worldZ * Z_LIFT;
}

function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

function isReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

interface PlayerSprites {
  idle: HTMLImageElement[];
  walk: HTMLImageElement[];
  run: HTMLImageElement[];
  /** Indexed by shot side — Leo's sheet has one swing, so both entries point at the same frames. */
  prepare: { forehand: HTMLImageElement[]; backhand: HTMLImageElement[] };
  contact: { forehand: HTMLImageElement; backhand: HTMLImageElement };
  miss: HTMLImageElement[];
  celebrate: HTMLImageElement[];
}

interface SpriteRefs {
  leo: PlayerSprites;
  alice: PlayerSprites;
  backdrop: HTMLImageElement;
  net: HTMLImageElement;
  textureClay: HTMLImageElement;
  textureGrass: HTMLImageElement;
  judge: HTMLImageElement;
  ball: HTMLImageElement[];
  hitBanner: Record<HitQuality, HTMLImageElement>;
  pointBanner: Record<PointEventType, HTMLImageElement>;
}

/**
 * CanvasPatterns are built once per texture, the first frame the image is
 * ready, and reused every frame after (the release audit flagged that they
 * used to be recreated on every draw). Keyed by the image so a hot-reloaded
 * sprite set gets its own patterns.
 */
class PatternCache {
  private readonly patterns = new Map<HTMLImageElement, CanvasPattern>();

  get(ctx: CanvasRenderingContext2D, image: HTMLImageElement): CanvasPattern | null {
    const cached = this.patterns.get(image);
    if (cached) return cached;
    if (!isReady(image)) return null;
    const pattern = ctx.createPattern(image, "repeat");
    if (pattern) this.patterns.set(image, pattern);
    return pattern;
  }
}

function drawJudge(ctx: CanvasRenderingContext2D, image: HTMLImageElement): void {
  if (!isReady(image)) return; // no generic placeholder drawn — the backdrop's own empty chair still reads fine on its own
  const aspect = image.naturalWidth / image.naturalHeight;
  const height = JUDGE_RENDER_HEIGHT;
  const width = height * aspect;
  const bottomY = TOP_MARGIN - 2; // sits just above the court/net transition, never over the net line
  ctx.drawImage(image, COURT.netX - width / 2, bottomY - height, width, height);
}

function strokeHorizontalLine(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

function strokeVerticalLine(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

/**
 * Draws the tennis court's real markings — baselines, doubles/singles
 * sidelines, service lines, and the two (net-to-service-line-only) center
 * service lines — entirely from `COURT` (game/court/geometry.ts), the
 * single source of truth for the court's topology (see docs/PROGRESS.md).
 * World X maps 1:1 to canvas X; world Y goes through `drawY()` exactly like
 * every other world-space draw call in this file.
 */
function drawCourtLines(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#f5f5f5";
  ctx.lineWidth = 3;

  const doublesTopY = drawY(COURT.doublesTop);
  const doublesBottomY = drawY(COURT.doublesBottom);
  const singlesTopY = drawY(COURT.singlesTop);
  const singlesBottomY = drawY(COURT.singlesBottom);
  const centerServiceScreenY = drawY(COURT.centerServiceY);

  // Doubles sidelines + baselines together form the outer boundary.
  ctx.strokeRect(COURT.leoBaselineX, doublesTopY, COURT.aliceBaselineX - COURT.leoBaselineX, doublesBottomY - doublesTopY);

  // Singles sidelines — same baseline-to-baseline span, inset on Y.
  strokeHorizontalLine(ctx, COURT.leoBaselineX, COURT.aliceBaselineX, singlesTopY);
  strokeHorizontalLine(ctx, COURT.leoBaselineX, COURT.aliceBaselineX, singlesBottomY);

  // Service lines — one per side, spanning only the singles width.
  strokeVerticalLine(ctx, COURT.leoServiceLineX, singlesTopY, singlesBottomY);
  strokeVerticalLine(ctx, COURT.aliceServiceLineX, singlesTopY, singlesBottomY);

  // Center service lines — net to that side's own service line only, never
  // crossing the net and never reaching all the way to the baseline.
  strokeHorizontalLine(ctx, COURT.netX, COURT.leoServiceLineX, centerServiceScreenY);
  strokeHorizontalLine(ctx, COURT.netX, COURT.aliceServiceLineX, centerServiceScreenY);
}

function drawNet(ctx: CanvasRenderingContext2D, image: HTMLImageElement, courtTop: number, courtBottom: number): void {
  const top = courtTop - 15;
  const height = courtBottom - courtTop + 30;

  if (!isReady(image)) {
    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(COURT.netX, top);
    ctx.lineTo(COURT.netX, top + height);
    ctx.stroke();
    return;
  }

  // Stretched to a fixed on-screen thickness rather than the sprite's own
  // aspect ratio — the source photo's net height doesn't correspond to
  // anything in our world units, this is a deliberate stylization.
  ctx.drawImage(image, COURT.netX - NET_VISUAL_THICKNESS / 2, top, NET_VISUAL_THICKNESS, height);
}

function drawCourt(ctx: CanvasRenderingContext2D, sprites: SpriteRefs, patterns: PatternCache): void {
  if (isReady(sprites.backdrop)) {
    ctx.drawImage(sprites.backdrop, 0, 0, BACKDROP_NATIVE_WIDTH, BACKDROP_SOURCE_HEIGHT, 0, 0, CANVAS_WIDTH, TOP_MARGIN);
  } else {
    ctx.fillStyle = "#0b3d24";
    ctx.fillRect(0, 0, CANVAS_WIDTH, TOP_MARGIN);
  }

  drawJudge(ctx, sprites.judge);

  const courtTop = drawY(COURT.doublesTop);
  const courtBottom = drawY(COURT.doublesBottom);

  ctx.fillStyle = patterns.get(ctx, sprites.textureGrass) ?? "#1f6b3a";
  ctx.fillRect(0, courtTop - 20, CANVAS_WIDTH, 20);
  ctx.fillRect(0, courtBottom, CANVAS_WIDTH, BOTTOM_MARGIN);

  ctx.fillStyle = patterns.get(ctx, sprites.textureClay) ?? "#c8703f";
  ctx.fillRect(0, courtTop, CANVAS_WIDTH, courtBottom - courtTop);

  drawCourtLines(ctx);
  drawNet(ctx, sprites.net, courtTop, courtBottom);
}

function pickPlayerImage(sprites: PlayerSprites, frame: PlayerAnimationFrame): HTMLImageElement {
  switch (frame.state) {
    case "idle":
      return sprites.idle[frame.frameIndex];
    case "walk":
      return sprites.walk[frame.frameIndex];
    case "run":
      return sprites.run[frame.frameIndex];
    case "prepare":
    case "recover":
      // Recover reuses the fully-wound-up preparation frame as a static pose.
      return sprites.prepare[frame.shotSide][frame.frameIndex];
    case "contact":
      return sprites.contact[frame.shotSide];
    case "miss":
      return sprites.miss[frame.frameIndex];
    case "celebrate":
      return sprites.celebrate[frame.frameIndex];
  }
}

/**
 * Bottom-anchored: these frames are tight crops with no baked-in ground
 * padding, and their heights vary frame to frame, so anchoring by the feet
 * is what keeps a character from floating/sinking as the animation switches
 * sprites. The horizontal anchor is the frame's center — the walk/run
 * frames were cut so the planted foot stays near the center column.
 */
function drawPlayer(ctx: CanvasRenderingContext2D, sprites: PlayerSprites, worldX: number, worldY: number, frame: PlayerAnimationFrame): void {
  const image = pickPlayerImage(sprites, frame);
  if (!isReady(image)) {
    ctx.fillStyle = "#888";
    ctx.fillRect(worldX - 20, drawY(worldY) - 40, 40, 80);
    return;
  }
  const aspect = image.naturalWidth / image.naturalHeight;
  const height = SPRITE_HEIGHT;
  const width = height * aspect;
  ctx.drawImage(image, Math.round(worldX - width / 2), Math.round(drawY(worldY) - height), width, height);
}

/**
 * PERFECT-only one-shot ring at the contact point, for either player — a
 * thin stroke that expands slightly and fades over FLASH_DURATION_MS. Kept
 * deliberately small so the ball itself stays the focal point.
 */
function drawPerfectFlash(ctx: CanvasRenderingContext2D, effects: ImpactEffects): void {
  const flash = effects.getFlash();
  if (!flash) return;
  ctx.save();
  ctx.globalAlpha = 0.7 * (1 - flash.progress);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(flash.x, drawY(flash.y, flash.z), 12 + 8 * flash.progress, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws every active particle of one kind as a crisp, pixel-aligned square
 * (no blur, no glow). The last 40% of a particle's life fades it out.
 * Sparks and dust are drawn by separate calls (see render() for the
 * layering); both go under the ball so it is never hidden.
 */
function drawParticles(ctx: CanvasRenderingContext2D, particles: readonly Particle[], kind: ParticleKind): void {
  ctx.save();
  for (const p of particles) {
    if (!p.active || p.kind !== kind) continue;
    const t = p.lifeMs / p.maxLifeMs;
    ctx.globalAlpha = t < 0.4 ? t / 0.4 : 1;
    ctx.fillStyle = p.color;
    const half = p.size / 2;
    ctx.fillRect(Math.round(p.x - half), Math.round(drawY(p.y, p.z) - half), p.size, p.size);
  }
  ctx.restore();
}

/**
 * Ball shadow — the player's main height cue. Scale shrinks and the shadow
 * lightens as the ball climbs (a small, faint shadow under a ball reads as
 * "high"; a large, dark one as "about to land"), and `squash` (1 right at
 * touchdown, easing to 0 over SHADOW_SQUASH_MS — see ImpactEffects) presses
 * it wider and flatter for a few frames so the bounce instant itself is
 * legible even at rally speed.
 */
function drawBallShadow(ctx: CanvasRenderingContext2D, worldX: number, worldY: number, worldZ: number, squash: number): void {
  const shadowY = drawY(worldY, 0);
  const heightScale = Math.max(0.35, 1 - worldZ / 300);
  const radiusX = 11 * heightScale * (1 + 0.35 * squash);
  const radiusY = 4 * heightScale * (1 - 0.3 * squash);
  const alpha = 0.16 + 0.22 * heightScale + 0.1 * squash;
  ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(worldX, shadowY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Two dim afterimages behind a fast ball (see TRAIL_MIN_SPEED) — small
 * squares in the ball's own color, not a blur or a streak, so a PERFECT
 * shot reads as "quick" without the ball ever becoming harder to track.
 */
function drawBallTrail(ctx: CanvasRenderingContext2D, effects: ImpactEffects): void {
  const near = effects.getTrailPoint(2);
  const far = effects.getTrailPoint(4);
  if (!near && !far) return;
  ctx.save();
  ctx.fillStyle = "#d7f24a";
  if (far) {
    ctx.globalAlpha = 0.18;
    ctx.fillRect(Math.round(far.x) - 2, Math.round(drawY(far.y, far.z)) - 2, 4, 4);
  }
  if (near) {
    ctx.globalAlpha = 0.32;
    ctx.fillRect(Math.round(near.x) - 3, Math.round(drawY(near.y, near.z)) - 3, 6, 6);
  }
  ctx.restore();
}

/**
 * The ball itself. `squash` (from the bounce) flattens it against the court
 * for a few frames — the sprite is drawn wider and shorter, anchored at its
 * bottom so it presses *into* the surface rather than hovering.
 */
function drawBall(ctx: CanvasRenderingContext2D, worldX: number, worldY: number, worldZ: number, sprites: HTMLImageElement[], frameIndex: number, squash: number): void {
  const ballY = drawY(worldY, worldZ);
  const image = sprites[frameIndex];

  if (!image || !isReady(image)) {
    // Fallback vector ball — keeps the ball visible even if the sprite
    // hasn't loaded yet, same graceful-degradation pattern as every other
    // asset in this file.
    ctx.fillStyle = "#d7f24a";
    ctx.beginPath();
    ctx.arc(worldX, ballY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8fae1f";
    ctx.lineWidth = 1;
    ctx.stroke();
    return;
  }

  const aspect = image.naturalWidth / image.naturalHeight;
  const height = BALL_RENDER_HEIGHT * (1 - 0.28 * squash);
  const width = BALL_RENDER_HEIGHT * aspect * (1 + 0.28 * squash);
  const bottom = ballY + BALL_RENDER_HEIGHT / 2;
  ctx.drawImage(image, worldX - width / 2, bottom - height, width, height);
}

/** Pop-in (first ~12% of life) then hold, then fade over the last 30%. Shared by both banner kinds. */
function bannerEnvelope(progress: number): { scale: number; alpha: number } {
  const pop = Math.min(1, progress / 0.12);
  const scale = 0.7 + 0.3 * (1 - (1 - pop) * (1 - pop)); // ease-out
  const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
  return { scale, alpha };
}

function drawBannerImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, centerX: number, centerY: number, height: number, scale: number, alpha: number): void {
  if (!isReady(image)) return;
  const aspect = image.naturalWidth / image.naturalHeight;
  const h = height * scale;
  const w = h * aspect;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, Math.round(centerX - w / 2), Math.round(centerY - h / 2), w, h);
  ctx.restore();
}

/** PERFECT!/GOOD!/LATE!/MISS! over the head of whoever just swung, drifting up a little as it fades. */
function drawHitBanner(ctx: CanvasRenderingContext2D, sprites: SpriteRefs, snapshot: GameSnapshot, effects: ImpactEffects): void {
  const banner = effects.getHitBanner();
  if (!banner) return;
  const player = snapshot[banner.side];
  const { scale, alpha } = bannerEnvelope(banner.progress);
  const rise = 14 * banner.progress;
  const centerX = Math.max(60, Math.min(CANVAS_WIDTH - 60, player.x));
  const centerY = drawY(player.y) - SPRITE_HEIGHT - HIT_BANNER_HEIGHT / 2 - 6 - rise;
  drawBannerImage(ctx, sprites.hitBanner[banner.quality], centerX, centerY, HIT_BANNER_HEIGHT, scale, alpha);
}

/** POINT!/GAME!/SET!/MATCH! centered over the court. */
function drawPointBanner(ctx: CanvasRenderingContext2D, sprites: SpriteRefs, effects: ImpactEffects): void {
  const banner = effects.getPointBanner();
  if (!banner) return;
  const { scale, alpha } = bannerEnvelope(banner.progress);
  drawBannerImage(ctx, sprites.pointBanner[banner.type], COURT.netX, drawY(COURT.centerServiceY) - 40, POINT_BANNER_HEIGHT, scale, alpha);
}

function render(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  sprites: SpriteRefs,
  patterns: PatternCache,
  leoFrame: PlayerAnimationFrame,
  aliceFrame: PlayerAnimationFrame,
  ballFrameIndex: number,
  effects: ImpactEffects,
): void {
  // Screen shake is a whole-canvas translate inside save/restore, so it can
  // never accumulate. The HUD, score and menus are separate React elements
  // outside this canvas (see below and app/page.tsx), so they're unaffected
  // by construction. drawCourt normally overdraws the entire canvas, but a
  // shifted world leaves a few stale pixels along the edges — clear them to
  // the frame's border color only while shaking.
  const shake = effects.getShakeOffset();
  ctx.save();
  if (effects.isShaking()) {
    ctx.fillStyle = "#262626";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.translate(shake.x, shake.y);
  }

  const squash = effects.getShadowSquash();
  drawCourt(ctx, sprites, patterns);
  drawPlayer(ctx, sprites.leo, snapshot.leo.x, snapshot.leo.y, leoFrame);
  drawPlayer(ctx, sprites.alice, snapshot.alice.x, snapshot.alice.y, aliceFrame);
  // Shadow and dust are court-surface effects but are drawn *over* the
  // players on purpose: every shot is aimed to land right on the receiver's
  // baseline (see computeLaunchVelocity's toX), so the bounce almost always
  // happens behind the receiver's own 150px sprite — under it, both cues
  // would be hidden exactly when they matter most.
  drawBallShadow(ctx, snapshot.ball.x, snapshot.ball.y, snapshot.ball.z, squash);
  drawParticles(ctx, effects.particles, "dust");
  drawParticles(ctx, effects.particles, "spark");
  drawBallTrail(ctx, effects);
  drawBall(ctx, snapshot.ball.x, snapshot.ball.y, snapshot.ball.z, sprites.ball, ballFrameIndex, squash);
  drawPerfectFlash(ctx, effects);
  drawHitBanner(ctx, sprites, snapshot, effects);
  drawPointBanner(ctx, sprites, effects);

  ctx.restore();
}

function loadPlayerSprites(srcs: {
  idle: string[];
  walk: string[];
  run: string[];
  prepareForehand: string[];
  prepareBackhand: string[];
  contactForehand: string;
  contactBackhand: string;
  miss: string[];
  celebrate: string[];
}): PlayerSprites {
  const prepareForehand = srcs.prepareForehand.map(loadImage);
  const prepareBackhand = srcs.prepareBackhand === srcs.prepareForehand ? prepareForehand : srcs.prepareBackhand.map(loadImage);
  const contactForehand = loadImage(srcs.contactForehand);
  const contactBackhand = srcs.contactBackhand === srcs.contactForehand ? contactForehand : loadImage(srcs.contactBackhand);
  return {
    idle: srcs.idle.map(loadImage),
    walk: srcs.walk.map(loadImage),
    run: srcs.run.map(loadImage),
    prepare: { forehand: prepareForehand, backhand: prepareBackhand },
    contact: { forehand: contactForehand, backhand: contactBackhand },
    miss: srcs.miss.map(loadImage),
    celebrate: srcs.celebrate.map(loadImage),
  };
}

function loadSprites(): SpriteRefs {
  return {
    leo: loadPlayerSprites({
      idle: LEO_IDLE_SRCS,
      walk: LEO_WALK_SRCS,
      run: LEO_RUN_SRCS,
      prepareForehand: LEO_PREPARE_SRCS,
      prepareBackhand: LEO_PREPARE_SRCS, // one swing on Leo's sheet — see FRAME_MAP.md
      contactForehand: LEO_CONTACT_SRC,
      contactBackhand: LEO_CONTACT_SRC,
      miss: LEO_MISS_SRCS,
      celebrate: LEO_CELEBRATE_SRCS,
    }),
    alice: loadPlayerSprites({
      idle: ALICE_IDLE_SRCS,
      walk: ALICE_WALK_SRCS,
      run: ALICE_RUN_SRCS,
      prepareForehand: ALICE_PREPARE_FOREHAND_SRCS,
      prepareBackhand: ALICE_PREPARE_BACKHAND_SRCS,
      contactForehand: ALICE_FOREHAND_CONTACT_SRC,
      contactBackhand: ALICE_BACKHAND_CONTACT_SRC,
      miss: ALICE_MISS_SRCS,
      celebrate: ALICE_CELEBRATE_SRCS,
    }),
    backdrop: loadImage(BACKDROP_SRC),
    net: loadImage(NET_SRC),
    textureClay: loadImage(TEXTURE_CLAY_SRC),
    textureGrass: loadImage(TEXTURE_GRASS_SRC),
    judge: loadImage(JUDGE_SRC),
    ball: BALL_ROTATION_SRCS.map(loadImage),
    hitBanner: {
      perfect: loadImage(HIT_BANNER_SRCS.perfect),
      good: loadImage(HIT_BANNER_SRCS.good),
      late: loadImage(HIT_BANNER_SRCS.late),
      miss: loadImage(HIT_BANNER_SRCS.miss),
    },
    pointBanner: {
      point: loadImage(POINT_BANNER_SRCS.point),
      game: loadImage(POINT_BANNER_SRCS.game),
      set: loadImage(POINT_BANNER_SRCS.set),
      match: loadImage(POINT_BANNER_SRCS.match),
    },
  };
}

/** Routes this frame's engine events to the sound layer — the only place audio is triggered. */
function playFrameSounds(audio: GameAudio, prev: GameSnapshot, next: GameSnapshot): void {
  const events = readFrameEvents(prev, next);
  if (events.hit) audio.racquet(events.hit.quality);
  if (events.miss) audio.whiff();
  if (events.bounce) audio.bounce();
  if (events.point) {
    const leoWon = events.point.winner === "leo";
    if (events.point.type === "point") audio.point(leoWon);
    else if (events.point.type === "match") audio.match(leoWon);
    else audio.game(leoWon);
  }
}

export function GameCanvas({
  difficulty = "normal" as Difficulty,
  volume = 0.7,
  tutorial = false,
  onGameOver,
  onRestart,
  onMainMenu,
  onTutorialExit,
}: {
  difficulty?: Difficulty;
  /** Master volume in [0, 1]. */
  volume?: number;
  /** "Como Jogar" mode — see components/tutorial.ts. Alice serves first and plays with TUTORIAL_PARAMS (GameEngineOptions.tutorialMode); `difficulty` is ignored while this is true. */
  tutorial?: boolean;
  onGameOver?: (winner: Side, stats: MatchStats) => void;
  onRestart?: () => void;
  onMainMenu?: () => void;
  /** Fires once, when the player finishes or skips the tutorial. Required when `tutorial` is true. */
  onTutorialExit?: (result: "completed" | "skipped") => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<KeyboardInput | null>(null);
  const spritesRef = useRef<SpriteRefs | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const pausedRef = useRef(false);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [tutorialInfo, setTutorialInfo] = useState(() => new TutorialController().getInfo());

  // Volume changes from the settings panel apply live without restarting the match.
  useEffect(() => {
    audioRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    const engine = tutorial
      ? new GameEngine({ difficulty: "easy", tutorialMode: true, initialServer: "alice" })
      : new GameEngine({ difficulty });
    engineRef.current = engine;
    const leoAnimator = new LeoAnimator();
    const aliceAnimator = new AliceAnimator(tutorial ? "easy" : difficulty);
    const effects = new ImpactEffects();
    const stats = new MatchStatsTracker();
    const patterns = new PatternCache();
    const audio = new GameAudio(volume);
    audioRef.current = audio;
    const tutorialController = tutorial ? new TutorialController() : null;

    const input = new KeyboardInput(window);
    input.attach();
    inputRef.current = input;

    spritesRef.current = loadSprites();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (ctx) ctx.imageSmoothingEnabled = false; // keep every drawImage crisp — no blur on the pixel art

    const setPausedState = (next: boolean) => {
      if (pausedRef.current === next) return;
      pausedRef.current = next;
      setPaused(next);
      audio.click();
    };

    // Browsers gate audio behind a user gesture: the first key/click of the
    // match unlocks the context. Escape/P toggle pause here rather than in
    // KeyboardInput, which stays a pure gameplay-input reader.
    const onKeyDown = (e: KeyboardEvent) => {
      audio.unlock();
      if (e.code === "Escape" || e.code === "KeyP") {
        e.preventDefault();
        if (engine.getSnapshot().phase !== "game_over") setPausedState(!pausedRef.current);
      }
    };
    const onPointerDown = () => audio.unlock();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);

    let lastTime = performance.now();
    let frameId = 0;
    let gameOverReported = false;
    let matchOutroMs = -1; // -1 = match still running; counts up once the match event fires
    let ballSpinMs = 0;
    let lastTutorialCaption = tutorialController?.getInfo().caption ?? "";

    function frame(now: number) {
      // Clamped to [0, 1/30]: the upper bound avoids a huge dt after a tab
      // switch; the lower bound guards against a browser's first rAF
      // timestamp occasionally landing before the `performance.now()`
      // captured synchronously above, which would otherwise feed a negative
      // dt into the engine and the animator on frame 1.
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 1 / 30);
      lastTime = now;

      const currentInput = inputRef.current?.poll() ?? { direction: 0, hitPressed: false, smashHeld: false };

      if (pausedRef.current) {
        // Everything freezes — physics, ball, AI, animators, effects. Input
        // is still polled (and discarded) so a Space pressed on the pause
        // menu can't fire a buffered swing the instant play resumes. The
        // last frame is re-drawn so a resize/repaint never shows a blank
        // canvas under the overlay.
        if (ctx && spritesRef.current) {
          render(ctx, engine.getSnapshot(), spritesRef.current, patterns, leoAnimator.getFrame(), aliceAnimator.getFrame(), Math.floor(ballSpinMs / BALL_SPIN_FRAME_MS) % BALL_ROTATION_SRCS.length, effects);
        }
        frameId = requestAnimationFrame(frame);
        return;
      }

      const prevSnapshot = engine.getSnapshot();
      engine.update(dt, currentInput);
      const nextSnapshot = engine.getSnapshot();
      setSnapshot(nextSnapshot);

      leoAnimator.update(dt, prevSnapshot, nextSnapshot);
      aliceAnimator.update(dt, prevSnapshot, nextSnapshot);
      effects.update(dt, prevSnapshot, nextSnapshot);
      stats.update(prevSnapshot, nextSnapshot);
      playFrameSounds(audio, prevSnapshot, nextSnapshot);

      if (tutorialController) {
        tutorialController.update(dt, prevSnapshot, nextSnapshot);
        const info = tutorialController.getInfo();
        // Only re-renders React when the caption text actually changes —
        // not every frame — same "don't create expensive per-frame React
        // state" concern the HUD's own setSnapshot already accepts, but
        // there's no reason to pay it twice for text that changes maybe
        // half a dozen times in the whole tutorial.
        if (info.caption !== lastTutorialCaption) {
          lastTutorialCaption = info.caption;
          setTutorialInfo(info);
        }
      }

      // Same negative-dt guard as the animators — dt is already clamped to
      // >= 0 above, but the accumulator is kept non-negative too rather than
      // relying solely on the caller.
      ballSpinMs = Math.max(0, ballSpinMs + dt * 1000);
      const ballFrameIndex = Math.floor(ballSpinMs / BALL_SPIN_FRAME_MS) % BALL_ROTATION_SRCS.length;

      if (ctx && spritesRef.current) {
        render(ctx, nextSnapshot, spritesRef.current, patterns, leoAnimator.getFrame(), aliceAnimator.getFrame(), ballFrameIndex, effects);
      }

      // Match over: hold on the court for the MATCH! banner and the winner's
      // celebration, then hand off to the result screen. (The engine stops
      // updating in game_over, so this is armed once and then just counts.)
      if (matchOutroMs < 0 && nextSnapshot.phase === "game_over") matchOutroMs = 0;
      if (matchOutroMs >= 0 && !gameOverReported) {
        matchOutroMs += dt * 1000;
        if (matchOutroMs >= MATCH_OUTRO_MS) {
          gameOverReported = true;
          const winner: Side = nextSnapshot.score.sets[0] > nextSnapshot.score.sets[1] ? "leo" : "alice";
          onGameOver?.(winner, stats.get());
        }
      }

      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      input.detach();
      audio.dispose();
      audioRef.current = null;
      engineRef.current = null;
    };
    // `volume` is intentionally not a dependency: it's applied live by the
    // effect above, and re-creating the engine on a volume change would
    // restart the match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, tutorial, onGameOver]);

  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    audioRef.current?.click();
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="relative w-full max-w-4xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block w-full rounded-lg border-4 border-neutral-800 [image-rendering:pixelated]"
          role="img"
          aria-label="Quadra de tênis — Leo à esquerda, Alice à direita"
        />
        {tutorial && !paused && (
          <TutorialOverlay info={tutorialInfo} onPlay={() => onTutorialExit?.("completed")} onSkip={() => onTutorialExit?.("skipped")} />
        )}
        {paused && <PauseOverlay onResume={resume} onRestart={() => onRestart?.()} onMainMenu={() => onMainMenu?.()} />}
      </div>
      {snapshot && <HUD snapshot={snapshot} />}
    </div>
  );
}
