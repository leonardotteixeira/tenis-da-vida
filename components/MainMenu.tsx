"use client";

/**
 * Full-bleed main menu using the real art (public/assets/menu/menu.png).
 * The art already draws the "JOGAR" button pixel-for-pixel, so the overlay
 * is an invisible hit target aligned to it (coordinates measured directly
 * from the source PNG) rather than a second, differently-styled button —
 * otherwise the two visibly double up. CONFIGURAÇÕES/EXTRAS/SAIR are drawn
 * in the art too but have no V1 feature behind them, so they stay decorative.
 */
export function MainMenu({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="relative w-full max-w-4xl overflow-hidden rounded-lg border-4 border-neutral-800">
      {/* eslint-disable-next-line @next/next/no-img-element -- large pre-rendered art asset, not an optimizable photo */}
      <img src="/assets/menu/menu.png" alt="Tênis da Vida" className="block w-full [image-rendering:pixelated]" />
      <button
        type="button"
        onClick={onPlay}
        aria-label="Jogar"
        className="absolute top-[41.5%] left-[5.9%] h-[6.2%] w-[21.4%] rounded-md bg-white/0 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      />
    </div>
  );
}
