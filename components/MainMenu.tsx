"use client";

/**
 * Full-bleed main menu using the real art (public/assets/menu/menu.png).
 * The art already draws the "JOGAR" and "CONFIGURAÇÕES" buttons
 * pixel-for-pixel, so the overlays are invisible hit targets aligned to
 * them (coordinates measured directly from the source PNG) rather than a
 * second, differently-styled set of buttons — otherwise the two visibly
 * double up. EXTRAS now opens ExtrasPanel (the "Como Jogar" tutorial menu —
 * see app/page.tsx), using the same pattern one more time: its hit target
 * follows the art's own 8.1%-of-height vertical step between buttons. SAIR
 * is drawn in the art too but still has no feature behind it, so it stays
 * decorative.
 */
export function MainMenu({ onPlay, onSettings, onExtras }: { onPlay: () => void; onSettings: () => void; onExtras: () => void }) {
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
      <button
        type="button"
        onClick={onSettings}
        aria-label="Configurações"
        className="absolute top-[49.6%] left-[5.9%] h-[6.2%] w-[21.4%] rounded-md bg-white/0 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      />
      {/* Same 8.1%-of-height vertical step as JOGAR->CONFIGURAÇÕES, measured directly from the art — see the file comment above. */}
      <button
        type="button"
        onClick={onExtras}
        aria-label="Extras"
        className="absolute top-[57.7%] left-[5.9%] h-[6.2%] w-[21.4%] rounded-md bg-white/0 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      />
    </div>
  );
}
