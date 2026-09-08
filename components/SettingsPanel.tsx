"use client";

import { DIFFICULTIES, type GameSettings } from "@/components/settings";
import type { Difficulty } from "@/game/types";

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Fácil", normal: "Normal", hard: "Difícil", insane: "Insano" };
const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: "Alice mais lenta e erra mais — bom para aprender o timing.",
  normal: "O equilíbrio padrão do jogo.",
  hard: "Alice rápida, precisa e com bola mais forte.",
  insane: "Quase não erra. Boa sorte.",
};

/**
 * Lightweight settings: master volume and difficulty. Opened from the main
 * menu's "CONFIGURAÇÕES" button (which is drawn in the menu art itself —
 * see MainMenu). Changes are applied immediately by the parent and
 * persisted through components/settings.ts.
 */
export function SettingsPanel({ settings, onChange, onClose }: { settings: GameSettings; onChange: (next: GameSettings) => void; onClose: () => void }) {
  const volumePercent = Math.round(settings.volume * 100);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70" role="dialog" aria-modal="true" aria-label="Configurações">
      <div className="flex w-80 flex-col gap-4 rounded-lg border-2 border-yellow-300 bg-neutral-900 p-5 shadow-lg">
        <span className="text-center text-sm font-bold tracking-[0.3em] text-yellow-300">CONFIGURAÇÕES</span>

        <label className="flex flex-col gap-1 text-xs text-neutral-200">
          <span className="flex justify-between">
            <span className="font-semibold">Volume</span>
            <span className="font-mono text-yellow-300">{volumePercent}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volumePercent}
            onChange={(e) => onChange({ ...settings, volume: Number(e.target.value) / 100 })}
            className="accent-yellow-300"
            aria-label="Volume"
          />
        </label>

        <div className="flex flex-col gap-1 text-xs text-neutral-200">
          <span className="font-semibold">Dificuldade</span>
          <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Dificuldade">
            {DIFFICULTIES.map((d) => {
              const active = settings.difficulty === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ ...settings, difficulty: d })}
                  className={`rounded-md border-2 px-1 py-1.5 text-[11px] font-semibold transition-colors ${
                    active ? "border-yellow-300 bg-yellow-300/20 text-yellow-200" : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {DIFFICULTY_LABEL[d]}
                </button>
              );
            })}
          </div>
          <span className="min-h-[2.5em] text-[10px] text-neutral-400">{DIFFICULTY_HINT[settings.difficulty]}</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="rounded-md border-2 border-green-500 bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-100 transition-colors hover:bg-green-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
