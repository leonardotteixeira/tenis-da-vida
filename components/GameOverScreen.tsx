"use client";

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
 * drawn in the art too but has no V1 feature behind it, so it stays
 * decorative.
 */
export function GameOverScreen({ winner, onPlayAgain, onMainMenu }: { winner: Side; onPlayAgain: () => void; onMainMenu: () => void }) {
  const src = winner === "leo" ? "/assets/menu/vitoria.png" : "/assets/menu/derrota.png";
  const alt = winner === "leo" ? "Vitória" : "Derrota";
  const playAgainLabel = winner === "leo" ? "Jogar novamente" : "Tentar novamente";

  return (
    <div className="relative w-full max-w-4xl overflow-hidden rounded-lg border-4 border-neutral-800">
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
  );
}
