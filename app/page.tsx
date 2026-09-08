"use client";

import { useCallback, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { MainMenu } from "@/components/MainMenu";
import { ExtrasPanel } from "@/components/ExtrasPanel";
import { GameOverScreen } from "@/components/GameOverScreen";
import { SettingsPanel } from "@/components/SettingsPanel";
import type { MatchStats } from "@/components/matchStats";
import { loadRecords, loadSettings, mergeRecords, saveRecords, saveSettings, type GameSettings, type MatchRecords } from "@/components/settings";
import type { Side } from "@/game/types";

type Screen = "menu" | "playing" | "tutorial" | { screen: "gameover"; winner: Side; stats: MatchStats };

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  // Remounts the tutorial's GameCanvas on "Reiniciar" from its pause menu,
  // same trick matchKey already uses for a real match.
  const [tutorialKey, setTutorialKey] = useState(0);
  // Lazy initializers: on the server (no window) these return the defaults;
  // on the client they read localStorage once. Nothing on the initial menu
  // screen renders a settings/records value, so the SSR markup and the
  // client's first paint stay identical either way.
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [records, setRecords] = useState<MatchRecords>(() => loadRecords());
  // Remounts GameCanvas on replay so a fresh GameEngine/state is created.
  const [matchKey, setMatchKey] = useState(0);

  const handleGameOver = useCallback((winner: Side, stats: MatchStats) => {
    setRecords((previous) => {
      const next = mergeRecords(previous, { longestRally: stats.longestRally, accuracy: stats.accuracy, leoWon: winner === "leo" });
      saveRecords(next);
      return next;
    });
    setScreen({ screen: "gameover", winner, stats });
  }, []);

  const updateSettings = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const startMatch = () => {
    setMatchKey((k) => k + 1);
    setScreen("playing");
  };

  const goToMenu = () => setScreen("menu");

  const startTutorial = () => {
    setTutorialKey((k) => k + 1);
    setExtrasOpen(false);
    setScreen("tutorial");
  };

  // "Jogar" on the tutorial's finish card goes straight into a real match —
  // a player who just demonstrated the mechanics shouldn't be routed back
  // through the menu first. Skipping (from any step) just returns to the menu.
  const exitTutorial = (result: "completed" | "skipped") => {
    if (result === "completed") startMatch();
    else goToMenu();
  };

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-neutral-950 px-4 py-6">
      <p className="text-xs text-neutral-400">
        A / D — mover · SPACE — rebater (segure A ou D no momento do rebater para direcionar a bola) · ESC — pausar
      </p>

      {screen === "menu" && (
        <div className="relative w-full max-w-4xl">
          <MainMenu onPlay={startMatch} onSettings={() => setSettingsOpen(true)} onExtras={() => setExtrasOpen(true)} />
          {settingsOpen && <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />}
          {extrasOpen && <ExtrasPanel onComoJogar={startTutorial} onClose={() => setExtrasOpen(false)} />}
        </div>
      )}

      {screen === "playing" && (
        <GameCanvas key={matchKey} difficulty={settings.difficulty} volume={settings.volume} onGameOver={handleGameOver} onRestart={startMatch} onMainMenu={goToMenu} />
      )}

      {screen === "tutorial" && (
        <GameCanvas
          key={tutorialKey}
          tutorial
          volume={settings.volume}
          onTutorialExit={exitTutorial}
          onRestart={startTutorial}
          onMainMenu={goToMenu}
        />
      )}

      {typeof screen === "object" && screen.screen === "gameover" && (
        <GameOverScreen winner={screen.winner} stats={screen.stats} records={records} onPlayAgain={startMatch} onMainMenu={goToMenu} />
      )}
    </div>
  );
}
