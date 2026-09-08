"use client";

/**
 * Pause menu drawn over the (frozen) canvas. The game loop keeps rendering
 * the last frame but stops advancing the engine, animators and effects
 * while this is up — see GameCanvas. Styled like the HUD panels (same
 * neutral-900 card, same accent borders) so it reads as part of the game
 * rather than a browser dialog.
 */
export function PauseOverlay({ onResume, onRestart, onMainMenu }: { onResume: () => void; onRestart: () => void; onMainMenu: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70" role="dialog" aria-modal="true" aria-label="Jogo pausado">
      <div className="flex w-56 flex-col gap-2 rounded-lg border-2 border-yellow-300 bg-neutral-900 p-4 text-center shadow-lg">
        <span className="mb-1 text-sm font-bold tracking-[0.3em] text-yellow-300">PAUSA</span>
        <PauseButton label="Continuar" onClick={onResume} autoFocus accent="border-green-500 hover:bg-green-500/20" />
        <PauseButton label="Reiniciar partida" onClick={onRestart} accent="border-blue-500 hover:bg-blue-500/20" />
        <PauseButton label="Menu principal" onClick={onMainMenu} accent="border-pink-500 hover:bg-pink-500/20" />
        <span className="mt-1 text-[10px] text-neutral-500">ESC ou P para continuar</span>
      </div>
    </div>
  );
}

function PauseButton({ label, onClick, accent, autoFocus }: { label: string; onClick: () => void; accent: string; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className={`rounded-md border-2 bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${accent}`}
    >
      {label}
    </button>
  );
}
