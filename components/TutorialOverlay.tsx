"use client";

import type { TutorialStepInfo } from "@/components/tutorial";

/**
 * The tutorial's only UI beyond the real HUD/banners already drawn by
 * GameCanvas — a short instruction pinned to the stadium backdrop strip
 * above the actual playing surface (TOP_MARGIN in GameCanvas.tsx), so it
 * never sits over the ball, a player, or the court itself. Styled like the
 * project's existing overlays (PauseOverlay/SettingsPanel: neutral-900 card,
 * colored border, tracking-widest label) rather than a generic tutorial UI.
 */
export function TutorialOverlay({ info, onPlay, onSkip }: { info: TutorialStepInfo; onPlay: () => void; onSkip: () => void }) {
  if (info.step === "complete") {
    return (
      <div className="absolute inset-x-0 top-4 flex justify-center px-3">
        <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-yellow-300 bg-neutral-900/95 px-5 py-3 text-center shadow-lg">
          <span className="text-sm font-bold tracking-[0.2em] text-yellow-300">VOCÊ ESTÁ PRONTO!</span>
          <span className="text-xs text-neutral-300">AGORA TENTE VENCER ALICE.</span>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onPlay}
              autoFocus
              className="rounded-md border-2 border-green-500 bg-neutral-800 px-4 py-1.5 text-xs font-semibold text-neutral-100 transition-colors hover:bg-green-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Jogar
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md border-2 border-neutral-600 bg-neutral-800 px-4 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 top-4 flex justify-center px-3">
      <div className="flex items-center gap-3 rounded-lg border-2 border-cyan-400 bg-neutral-900/95 px-4 py-2 shadow-lg">
        <span className="text-xs font-bold tracking-[0.15em] text-cyan-300">{info.caption}</span>
        <button
          type="button"
          onClick={onSkip}
          className="text-[10px] text-neutral-400 underline decoration-dotted underline-offset-2 transition-colors hover:text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Pular tutorial
        </button>
      </div>
    </div>
  );
}
