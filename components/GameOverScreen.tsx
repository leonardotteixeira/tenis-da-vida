"use client";

import type { MatchStats } from "@/components/matchStats";
import type { MatchRecords } from "@/components/settings";
import type { Side } from "@/game/types";

/**
 * Full-bleed victory/defeat screen using the real art. Leo winning shows
 * vitoria.png (Leo celebrating); anything else shows derrota.png — from
 * the player's (Leo's) point of view, matching how the art was drawn.
 *
 * Both images already draw their own "jogar novamente"/"tentar novamente"
 * and "voltar ao menu" buttons pixel-for-pixel, so the overlays here are
 * invisible hit targets aligned to those (coordinates measured directly
 * from the two source PNGs, which differ slightly) rather than a second,
 * differently-styled set of buttons drawn on top. "VER ESTATÍSTICAS" is
 * drawn in the art too; the real numbers for this match live in the summary
 * strip below the art (the art's own baked-in figures are decorative).
 */
export function GameOverScreen({
  winner,
  stats,
  records,
  onPlayAgain,
  onMainMenu,
}: {
  winner: Side;
  stats: MatchStats;
  /** Records *including* this match, so a new best reads as "recorde" right away. */
  records: MatchRecords;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}) {
  const leoWon = winner === "leo";
  const src = leoWon ? "/assets/menu/vitoria.png" : "/assets/menu/derrota.png";
  const alt = leoWon ? "Vitória" : "Derrota";
  const playAgainLabel = leoWon ? "Jogar novamente" : "Tentar novamente";
  const swings = stats.perfect + stats.good + stats.late + stats.miss;
  const accuracyPct = Math.round(stats.accuracy * 100);
  const rallyIsRecord = stats.longestRally > 0 && stats.longestRally >= records.longestRally;
  const accuracyIsRecord = swings > 0 && stats.accuracy >= records.bestAccuracy;

  return (
    <div className="flex w-full max-w-4xl flex-col gap-3">
      <div className="relative w-full overflow-hidden rounded-lg border-4 border-neutral-800">
        {/* eslint-disable-next-line @next/next/no-img-element -- large pre-rendered art asset, not an optimizable photo */}
        <img src={src} alt={alt} className="block w-full [image-rendering:pixelated]" />
        <button
          type="button"
          onClick={onPlayAgain}
          aria-label={playAgainLabel}
          className="absolute top-[57%] left-[68%] h-[5%] w-[26%] rounded-md bg-white/0 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        />
        <button
          type="button"
          onClick={onMainMenu}
          aria-label="Voltar ao menu"
          className="absolute top-[70.3%] left-[68%] h-[5%] w-[26%] rounded-md bg-white/0 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        />
      </div>

      <section aria-label="Resumo da partida" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Rally mais longo" value={String(stats.longestRally)} accent={rallyIsRecord ? "recorde" : `recorde ${records.longestRally}`} highlight={rallyIsRecord} />
        <Stat label="Aproveitamento" value={swings > 0 ? `${accuracyPct}%` : "—"} accent={accuracyIsRecord ? "recorde" : `recorde ${Math.round(records.bestAccuracy * 100)}%`} highlight={accuracyIsRecord} />
        <Stat label="Golpes do Leo" value={String(swings)} accent={`${stats.perfect} perfect · ${stats.good} good · ${stats.late} late`} />
        <Stat label="Erros" value={String(stats.miss)} accent={`${records.wins} ${records.wins === 1 ? "vitória" : "vitórias"} no total`} />
      </section>
    </div>
  );
}

function Stat({ label, value, accent, highlight }: { label: string; value: string; accent: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-lg border-2 bg-neutral-900 px-3 py-2 ${highlight ? "border-yellow-300" : "border-neutral-700"}`}>
      <span className="text-[10px] tracking-widest text-neutral-500 uppercase">{label}</span>
      <span className="font-mono text-xl font-bold leading-none text-yellow-300">{value}</span>
      <span className={`text-[10px] ${highlight ? "font-semibold text-yellow-200" : "text-neutral-400"}`}>{highlight ? "★ " : ""}{accent}</span>
    </div>
  );
}
