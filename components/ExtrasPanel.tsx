"use client";

/**
 * Extras menu — opened from the main menu's "EXTRAS" button (drawn in the
 * menu art itself, same invisible-hit-target pattern as JOGAR/CONFIGURAÇÕES
 * — see MainMenu). Styled like SettingsPanel/PauseOverlay (neutral-900 card,
 * colored border) so it reads as part of the game. Currently a single entry
 * point to the "Como Jogar" tutorial — more could live here later without
 * changing this shell.
 */
export function ExtrasPanel({ onComoJogar, onClose }: { onComoJogar: () => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70" role="dialog" aria-modal="true" aria-label="Extras">
      <div className="flex w-72 flex-col gap-3 rounded-lg border-2 border-yellow-300 bg-neutral-900 p-5 shadow-lg">
        <span className="text-center text-sm font-bold tracking-[0.3em] text-yellow-300">EXTRAS</span>

        <button
          type="button"
          onClick={onComoJogar}
          autoFocus
          className="rounded-md border-2 border-cyan-400 bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-100 transition-colors hover:bg-cyan-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Como jogar
        </button>

        <button
          type="button"
          onClick={onClose}
          className="rounded-md border-2 border-green-500 bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-100 transition-colors hover:bg-green-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
