"use client";

import { pointLabel } from "@/game/scoring/scoring";
import type { HitQuality, GameSnapshot } from "@/game/types";

/**
 * Real portrait art from public/assets/HUD/derived/{leo,alice}-avatar.png
 * (cropped from the "HUD (DURANTE O JOGO)" panel of the interface sprite
 * sheet — see docs/PROGRESS.md). The rest of the bar is a plain CSS panel
 * rather than the full baked panel image: that image bakes its own sample
 * numbers directly into the art with no transparency to clear them through,
 * so masking dynamic text on top of it never lined up reliably across
 * screen sizes. Reusing just the two avatars (the one part of that art with
 * no text baked in) avoids that fragility while still using real art.
 */

const QUALITY_LABEL: Record<HitQuality, string> = { perfect: "PERFECT!", good: "GOOD", late: "LATE", miss: "MISS" };
const QUALITY_COLOR: Record<HitQuality, string> = {
  perfect: "text-yellow-300",
  good: "text-green-400",
  late: "text-orange-400",
  miss: "text-red-500",
};

function HeartRow({ sets }: { sets: number }) {
  return (
    <div className="flex gap-0.5 text-sm leading-none">
      {Array.from({ length: 2 }, (_, i) => (
        <span key={i} className={i < sets ? "text-red-500" : "text-neutral-700"}>
          ♥
        </span>
      ))}
    </div>
  );
}

function PlayerPanel({
  avatarSrc,
  name,
  accent,
  games,
  points,
  sets,
  lastShot,
  align,
}: {
  avatarSrc: string;
  name: string;
  accent: string;
  games: number;
  points: string;
  sets: number;
  lastShot: HitQuality | null;
  align: "left" | "right";
}) {
  const reversed = align === "right";
  return (
    <div className={`flex items-center gap-2 rounded-lg border-2 bg-neutral-900 p-2 ${accent} ${reversed ? "flex-row-reverse text-right" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small pre-rendered pixel-art badge */}
      <img src={avatarSrc} alt="" className="h-12 w-10 rounded border border-neutral-700 object-cover [image-rendering:pixelated]" />
      <div className={`flex flex-col gap-0.5 ${reversed ? "items-end" : "items-start"}`}>
        <span className="text-xs font-bold tracking-wide text-neutral-100">{name}</span>
        <div className={`flex items-center gap-1.5 ${reversed ? "flex-row-reverse" : ""}`}>
          <HeartRow sets={sets} />
          <span className="text-[10px] text-neutral-400">Games {games}</span>
        </div>
        <span className="font-mono text-lg font-bold leading-none text-yellow-300">{points}</span>
        {lastShot && <span className={`text-[10px] font-semibold ${QUALITY_COLOR[lastShot]}`}>{QUALITY_LABEL[lastShot]}</span>}
      </div>
    </div>
  );
}

export function HUD({ snapshot }: { snapshot: GameSnapshot }) {
  const { score, rally, phase, leo, alice } = snapshot;

  return (
    <div className="grid w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-stretch gap-2">
      <PlayerPanel
        avatarSrc="/assets/HUD/derived/leo-avatar.png"
        name="LEO"
        accent="border-blue-500"
        games={score.games[0]}
        points={pointLabel(score.points[0], score.points[1])}
        sets={score.sets[0]}
        lastShot={leo.lastShot}
        align="left"
      />

      <div className="flex min-w-[110px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-neutral-700 bg-neutral-900 px-3 py-2">
        <span className="text-[10px] tracking-widest text-neutral-500">RALLY</span>
        <span className="font-mono text-2xl font-bold leading-none text-yellow-300">{rally.count}</span>
        <span className="text-[10px] text-neutral-500">Nível {rally.level}</span>
        {(phase === "ready_to_serve" || phase === "toss") && (
          <span className="text-[10px] font-bold text-yellow-300">SAQUE</span>
        )}
        {phase === "game_over" && <span className="text-[10px] font-bold text-red-400">FIM</span>}
      </div>

      <PlayerPanel
        avatarSrc="/assets/HUD/derived/alice-avatar.png"
        name="ALICE"
        accent="border-pink-500"
        games={score.games[1]}
        points={pointLabel(score.points[1], score.points[0])}
        sets={score.sets[1]}
        lastShot={alice.lastShot}
        align="right"
      />
    </div>
  );
}
