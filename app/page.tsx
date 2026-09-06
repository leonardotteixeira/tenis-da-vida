"use client";

import { useCallback, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { MainMenu } from "@/components/MainMenu";
import { GameOverScreen } from "@/components/GameOverScreen";
import type { Side } from "@/game/types";

type Screen = "menu" | "playing" | { screen: "gameover"; winner: Side };

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  // Remounts GameCanvas on replay so a fresh GameEngine/state is created.
  const [matchKey, setMatchKey] = useState(0);

  const handleGameOver = useCallback((winner: Side) => {
    setScreen({ screen: "gameover", winner });
  }, []);

  const startMatch = () => {
    setMatchKey((k) => k + 1);
    setScreen("playing");
  };

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-neutral-950 px-4 py-6">
      <p className="text-xs text-neutral-400">
        A / D — mover · SPACE — rebater (segure A ou D no momento do rebater para direcionar a bola)
      </p>

      {screen === "menu" && <MainMenu onPlay={startMatch} />}

      {screen === "playing" && (
        <GameCanvas key={matchKey} difficulty="normal" onGameOver={handleGameOver} />
      )}

      {typeof screen === "object" && screen.screen === "gameover" && (
        <GameOverScreen winner={screen.winner} onPlayAgain={startMatch} onMainMenu={() => setScreen("menu")} />
      )}
    </div>
  );
}
