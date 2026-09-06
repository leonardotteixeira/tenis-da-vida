"use client";

import { useEffect, useRef, useState } from "react";
import { COURT_LENGTH, COURT_WIDTH } from "@/game/constants";
import { COURT } from "@/game/court/geometry";
import { GameEngine } from "@/game/engine/GameEngine";
import { KeyboardInput } from "@/game/input/keyboard";
import type { Difficulty, GameSnapshot, Side } from "@/game/types";
import { HUD } from "@/components/HUD";
import { LeoAnimator, type LeoAnimationFrame } from "@/components/leoAnimation";
import { AliceAnimator, type AliceAnimationFrame } from "@/components/aliceAnimation";

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
const LEO_IDLE_SRCS = [
  "/assets/characters/leo/derived/idle-1.png",
  "/assets/characters/leo/derived/idle-2.png",
  "/assets/characters/leo/derived/idle-3.png",
  "/assets/characters/leo/derived/idle-4.png",
];
const LEO_PREPARE_SRCS = [
  "/assets/characters/leo/derived/prepare-1.png",
  "/assets/characters/leo/derived/prepare-2.png",
];
const LEO_CONTACT_SRC = "/assets/characters/leo/derived/forehand-contact.png";
const LEO_MISS_SRCS = [
  "/assets/characters/leo/derived/miss-1.png",
  "/assets/characters/leo/derived/miss-2.png",
  "/assets/characters/leo/derived/miss-3.png",
];

// Alice's animation frames — deterministically sliced from
// public/assets/characters/alice/ALICE SPRITE SHEET.png, with IDLE/MISS
// re-oriented to face left (see derived/FRAME_MAP.md — the sheet itself is
// inconsistent between groups, and alice-backhand.png, no longer used here,
// had the same wrong-direction problem). See FRAME_MAP.md for the exact
// source bounding boxes and the corrected FOREHAND frame count.
const ALICE_IDLE_SRCS = [
  "/assets/characters/alice/derived/idle-1.png",
  "/assets/characters/alice/derived/idle-2.png",
  "/assets/characters/alice/derived/idle-3.png",
  "/assets/characters/alice/derived/idle-4.png",
];
const ALICE_PREPARE_FOREHAND_SRCS = [
  "/assets/characters/alice/derived/prepare-forehand-1.png",
  "/assets/characters/alice/derived/prepare-forehand-2.png",
  "/assets/characters/alice/derived/prepare-forehand-3.png",
];
const ALICE_PREPARE_BACKHAND_SRCS = [
  "/assets/characters/alice/derived/prepare-backhand-1.png",
  "/assets/characters/alice/derived/prepare-backhand-2.png",
  "/assets/characters/alice/derived/prepare-backhand-3.png",
];
const ALICE_FOREHAND_CONTACT_SRC = "/assets/characters/alice/derived/forehand-contact.png";
const ALICE_BACKHAND_CONTACT_SRC = "/assets/characters/alice/derived/backhand-contact.png";
const ALICE_MISS_SRCS = [
  "/assets/characters/alice/derived/miss-1.png",
  "/assets/characters/alice/derived/miss-2.png",
];
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
// drawCourtLines below), not from that asset. The file itself was left on
// disk (see docs/PROGRESS.md) in case it's useful for something else later.
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

const NET_VISUAL_THICKNESS = 26; // on-screen px — deliberately NOT derived from the sprite's own aspect ratio (see docs/PROGRESS.md)
const JUDGE_RENDER_HEIGHT = 70; // bigger than the backdrop's own tiny baked-in chair so it actually reads, matching how Leo/Alice are already drawn oversized vs the crowd

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

function tryPattern(ctx: CanvasRenderingContext2D, image: HTMLImageElement): CanvasPattern | null {
  if (!isReady(image)) return null;
  return ctx.createPattern(image, "repeat");
}

interface LeoSprites {
  idle: HTMLImageElement[];
  prepare: HTMLImageElement[];
  contact: HTMLImageElement;
  miss: HTMLImageElement[];
}

interface AliceSprites {
  idle: HTMLImageElement[];
  prepareForehand: HTMLImageElement[];
  forehandContact: HTMLImageElement;
  prepareBackhand: HTMLImageElement[];
  backhandContact: HTMLImageElement;
  miss: HTMLImageElement[];
}

interface SpriteRefs {
  leo: LeoSprites;
  alice: AliceSprites;
  backdrop: HTMLImageElement;
  net: HTMLImageElement;
  textureClay: HTMLImageElement;
  textureGrass: HTMLImageElement;
  judge: HTMLImageElement;
  ball: HTMLImageElement[];
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

function drawCourt(ctx: CanvasRenderingContext2D, sprites: SpriteRefs): void {
  if (isReady(sprites.backdrop)) {
    ctx.drawImage(sprites.backdrop, 0, 0, BACKDROP_NATIVE_WIDTH, BACKDROP_SOURCE_HEIGHT, 0, 0, CANVAS_WIDTH, TOP_MARGIN);
  } else {
    ctx.fillStyle = "#0b3d24";
    ctx.fillRect(0, 0, CANVAS_WIDTH, TOP_MARGIN);
  }

  drawJudge(ctx, sprites.judge);

  const courtTop = drawY(COURT.doublesTop);
  const courtBottom = drawY(COURT.doublesBottom);

  const grassPattern = tryPattern(ctx, sprites.textureGrass);
  ctx.fillStyle = grassPattern ?? "#1f6b3a";
  ctx.fillRect(0, courtTop - 20, CANVAS_WIDTH, 20);
  ctx.fillRect(0, courtBottom, CANVAS_WIDTH, BOTTOM_MARGIN);

  const clayPattern = tryPattern(ctx, sprites.textureClay);
  ctx.fillStyle = clayPattern ?? "#c8703f";
  ctx.fillRect(0, courtTop, CANVAS_WIDTH, courtBottom - courtTop);

  drawCourtLines(ctx);
  drawNet(ctx, sprites.net, courtTop, courtBottom);
}

function pickAliceImage(sprites: AliceSprites, frame: AliceAnimationFrame): HTMLImageElement {
  const isForehand = frame.shotSide === "forehand";
  switch (frame.state) {
    case "idle":
      return sprites.idle[frame.frameIndex];
    case "prepare":
      return (isForehand ? sprites.prepareForehand : sprites.prepareBackhand)[frame.frameIndex];
    case "contact":
      return isForehand ? sprites.forehandContact : sprites.backhandContact;
    case "recover":
      // Reuses the fully-wound-up preparation frame, same trick LeoAnimator
      // uses for its recover state — see aliceAnimation.ts.
      return (isForehand ? sprites.prepareForehand : sprites.prepareBackhand)[frame.frameIndex];
    case "miss":
      return sprites.miss[frame.frameIndex];
  }
}

function drawAlice(ctx: CanvasRenderingContext2D, sprites: AliceSprites, worldX: number, worldY: number, frame: AliceAnimationFrame): void {
  const image = pickAliceImage(sprites, frame);
  if (!isReady(image)) {
    ctx.fillStyle = "#888";
    ctx.fillRect(worldX - 20, drawY(worldY) - 40, 40, 80);
    return;
  }
  const aspect = image.naturalWidth / image.naturalHeight;
  const height = SPRITE_HEIGHT;
  const width = height * aspect;
  // Bottom-anchored, same reasoning as drawLeo: these are tight crops with no
  // baked-in ground padding and varying heights frame to frame.
  ctx.drawImage(image, worldX - width / 2, drawY(worldY) - height, width, height);
}

function pickLeoImage(sprites: LeoSprites, frame: LeoAnimationFrame): HTMLImageElement {
  switch (frame.state) {
    case "idle":
      return sprites.idle[frame.frameIndex];
    case "prepare":
      return sprites.prepare[frame.frameIndex];
    case "contact":
      return sprites.contact;
    case "recover":
      return sprites.prepare[0]; // reuses the windup frame in reverse — see FRAME_MAP.md
    case "miss":
      return sprites.miss[frame.frameIndex];
  }
}

function drawLeo(ctx: CanvasRenderingContext2D, sprites: LeoSprites, worldX: number, worldY: number, frame: LeoAnimationFrame): void {
  const image = pickLeoImage(sprites, frame);
  if (!isReady(image)) {
    ctx.fillStyle = "#888";
    ctx.fillRect(worldX - 20, drawY(worldY) - 40, 40, 80);
    return;
  }
  const aspect = image.naturalWidth / image.naturalHeight;
  const height = SPRITE_HEIGHT;
  const width = height * aspect;
  // Bottom-anchored: these frames are tight crops with no baked-in ground
  // padding, and their heights vary frame to frame, so anchoring by the feet
  // is what keeps Leo from floating/sinking as the animation switches
  // sprites (drawAlice uses the same anchoring, for the same reason).
  ctx.drawImage(image, worldX - width / 2, drawY(worldY) - height, width, height);
}

function drawImpactFlash(ctx: CanvasRenderingContext2D, worldX: number, worldY: number, worldZ: number): void {
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(worldX, drawY(worldY, worldZ), 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, worldX: number, worldY: number, worldZ: number, sprites: HTMLImageElement[], frameIndex: number): void {
  const shadowY = drawY(worldY, 0);
  const shadowScale = Math.max(0.3, 1 - worldZ / 250);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(worldX, shadowY, 10 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

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
  const height = BALL_RENDER_HEIGHT;
  const width = height * aspect;
  ctx.drawImage(image, worldX - width / 2, ballY - height / 2, width, height);
}

function render(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  sprites: SpriteRefs,
  leoFrame: LeoAnimationFrame,
  aliceFrame: AliceAnimationFrame,
  ballFrameIndex: number,
): void {
  drawCourt(ctx, sprites);
  drawLeo(ctx, sprites.leo, snapshot.leo.x, snapshot.leo.y, leoFrame);
  drawAlice(ctx, sprites.alice, snapshot.alice.x, snapshot.alice.y, aliceFrame);
  drawBall(ctx, snapshot.ball.x, snapshot.ball.y, snapshot.ball.z, sprites.ball, ballFrameIndex);
  if (leoFrame.showImpactFlash) {
    drawImpactFlash(ctx, snapshot.ball.x, snapshot.ball.y, snapshot.ball.z);
  }
}

export function GameCanvas({
  difficulty = "normal" as Difficulty,
  onGameOver,
}: {
  difficulty?: Difficulty;
  onGameOver?: (winner: Side) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<KeyboardInput | null>(null);
  const spritesRef = useRef<SpriteRefs | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);

  useEffect(() => {
    const engine = new GameEngine({ difficulty });
    engineRef.current = engine;
    const leoAnimator = new LeoAnimator();
    const aliceAnimator = new AliceAnimator();

    const input = new KeyboardInput(window);
    input.attach();
    inputRef.current = input;

    spritesRef.current = {
      leo: {
        idle: LEO_IDLE_SRCS.map(loadImage),
        prepare: LEO_PREPARE_SRCS.map(loadImage),
        contact: loadImage(LEO_CONTACT_SRC),
        miss: LEO_MISS_SRCS.map(loadImage),
      },
      alice: {
        idle: ALICE_IDLE_SRCS.map(loadImage),
        prepareForehand: ALICE_PREPARE_FOREHAND_SRCS.map(loadImage),
        forehandContact: loadImage(ALICE_FOREHAND_CONTACT_SRC),
        prepareBackhand: ALICE_PREPARE_BACKHAND_SRCS.map(loadImage),
        backhandContact: loadImage(ALICE_BACKHAND_CONTACT_SRC),
        miss: ALICE_MISS_SRCS.map(loadImage),
      },
      backdrop: loadImage(BACKDROP_SRC),
      net: loadImage(NET_SRC),
      textureClay: loadImage(TEXTURE_CLAY_SRC),
      textureGrass: loadImage(TEXTURE_GRASS_SRC),
      judge: loadImage(JUDGE_SRC),
      ball: BALL_ROTATION_SRCS.map(loadImage),
    };

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (ctx) ctx.imageSmoothingEnabled = false; // keep every drawImage crisp — no blur on the pixel art

    let lastTime = performance.now();
    let frameId = 0;
    let gameOverReported = false;
    let ballSpinMs = 0;

    function frame(now: number) {
      // Clamped to [0, 1/30]: the upper bound avoids a huge dt after a tab
      // switch; the lower bound guards against a browser's first rAF
      // timestamp occasionally landing before the `performance.now()`
      // captured synchronously above, which would otherwise feed a negative
      // dt into the engine and the animator on frame 1.
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 1 / 30);
      lastTime = now;

      const currentInput = inputRef.current?.poll() ?? { direction: 0, hitPressed: false, smashHeld: false };
      const prevSnapshot = engine.getSnapshot();
      engine.update(dt, currentInput);
      const nextSnapshot = engine.getSnapshot();
      setSnapshot(nextSnapshot);

      leoAnimator.update(dt, prevSnapshot, nextSnapshot, currentInput.hitPressed);
      aliceAnimator.update(dt, prevSnapshot, nextSnapshot);

      // Same negative-dt guard as LeoAnimator (see safeFrameIndex there) —
      // dt is already clamped to >= 0 above, but the accumulator is kept
      // non-negative too rather than relying solely on the caller.
      ballSpinMs = Math.max(0, ballSpinMs + dt * 1000);
      const ballFrameIndex = Math.floor(ballSpinMs / BALL_SPIN_FRAME_MS) % BALL_ROTATION_SRCS.length;

      if (ctx && spritesRef.current) {
        render(ctx, nextSnapshot, spritesRef.current, leoAnimator.getFrame(), aliceAnimator.getFrame(), ballFrameIndex);
      }

      if (!gameOverReported && nextSnapshot.phase === "game_over" && nextSnapshot.lastEvent?.type === "match") {
        gameOverReported = true;
        onGameOver?.(nextSnapshot.lastEvent.winner);
      }

      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      input.detach();
      engineRef.current = null;
    };
  }, [difficulty, onGameOver]);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full max-w-4xl rounded-lg border-4 border-neutral-800 [image-rendering:pixelated]"
        role="img"
        aria-label="Quadra de tênis — Leo à esquerda, Alice à direita"
      />
      {snapshot && <HUD snapshot={snapshot} />}
    </div>
  );
}
