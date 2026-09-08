/**
 * "Como Jogar" tutorial — a small, deterministic step state machine driven
 * entirely by real GameSnapshot data (see GameCanvas, which runs a real
 * GameEngine underneath the tutorial exactly like a normal match — see
 * GameEngineOptions.tutorialMode/initialServer in game/engine/GameEngine.ts).
 * No fake physics, no fake hit detection, no parallel scoring: every step
 * below advances off signals the engine already publishes (frameEvents,
 * rally.count, ball/player position and velocity), the same signals the
 * animators/effects/stats trackers already read.
 *
 * Step order matches the approved flow:
 *   movement -> positioning -> swing -> timing -> direction -> rally -> recovery -> complete
 * Alice serves first (initialServer: "alice") specifically so "positioning"
 * can teach receiving a ball before "swing" ever has to mention the hit key.
 */
import { readFrameEvents } from "@/components/frameEvents";
import { COURT_WIDTH } from "@/game/constants";
import type { GameSnapshot } from "@/game/types";

export type TutorialStepId = "movement" | "positioning" | "swing" | "timing" | "direction" | "rally" | "recovery" | "complete";

export interface TutorialStepInfo {
  step: TutorialStepId;
  /** Short line always shown (e.g. "PASSO 3 DE 7"-free — see caption for the actual instruction). */
  caption: string;
}

const MOVEMENT_DISTANCE_TARGET = 180; // world units of accumulated lateral travel — proves real back-and-forth, not one twitch
const POSITIONING_APPROACH_X = 260; // ball-to-Leo X distance at which the "SPACE" instruction takes over from "posicione-se"
const TIMING_HITS_TARGET = 3; // total successful connects (across swing+timing) before moving on to direction
const DIRECTION_VY_THRESHOLD = 30; // world units/s of lateral ball speed — proves a real aimed hit, not a coincidental near-zero one
const RALLY_TARGET = 4; // rally.count — two full back-and-forth exchanges
const RECOVERY_MARGIN = 100; // world units from center — "close enough to ready position"
const RECOVERY_TIMEOUT_MS = 4000; // never blocks completion indefinitely if the player doesn't recenter exactly
const SWING_CAPTION_SWAP_MS = 1600; // "SPACE — REBATER" holds this long before switching to "APERTE NO MOMENTO CERTO"

export class TutorialController {
  private step: TutorialStepId = "movement";
  private stepElapsedMs = 0;
  private movedDistance = 0;
  private leoHits = 0;
  private sawLeftHit = false;
  private sawRightHit = false;

  update(dtSeconds: number, prevSnapshot: GameSnapshot, nextSnapshot: GameSnapshot): void {
    const dt = Math.max(0, dtSeconds);
    this.stepElapsedMs += dt * 1000;

    // Defensive only — a tutorial rally this gentle essentially never reaches
    // a real match conclusion, but if it somehow did there is nothing left
    // to teach, so treat it as done rather than getting stuck.
    if (nextSnapshot.phase === "game_over" && this.step !== "complete") {
      this.enter("complete");
      return;
    }

    const events = readFrameEvents(prevSnapshot, nextSnapshot);

    switch (this.step) {
      case "movement":
        this.movedDistance += Math.abs(nextSnapshot.leo.y - prevSnapshot.leo.y);
        if (this.movedDistance >= MOVEMENT_DISTANCE_TARGET) this.enter("positioning");
        break;

      case "positioning":
        if (nextSnapshot.ball.owner === "leo" && Math.abs(nextSnapshot.ball.x - nextSnapshot.leo.x) <= POSITIONING_APPROACH_X) {
          this.enter("swing");
        }
        break;

      case "swing":
        if (events.hit?.side === "leo") {
          this.leoHits += 1;
          this.enter("timing");
        }
        break;

      case "timing":
        if (events.hit?.side === "leo") {
          this.leoHits += 1;
          if (this.leoHits >= TIMING_HITS_TARGET) this.enter("direction");
        }
        break;

      case "direction":
        if (events.hit?.side === "leo") {
          if (nextSnapshot.ball.vy <= -DIRECTION_VY_THRESHOLD) this.sawLeftHit = true;
          else if (nextSnapshot.ball.vy >= DIRECTION_VY_THRESHOLD) this.sawRightHit = true;
        }
        if (this.sawLeftHit && this.sawRightHit) this.enter("rally");
        break;

      case "rally":
        if (nextSnapshot.rally.count >= RALLY_TARGET) this.enter("recovery");
        break;

      case "recovery": {
        const centered = Math.abs(nextSnapshot.leo.y - COURT_WIDTH / 2) <= RECOVERY_MARGIN;
        if (centered || this.stepElapsedMs >= RECOVERY_TIMEOUT_MS) this.enter("complete");
        break;
      }

      case "complete":
        break;
    }
  }

  getStep(): TutorialStepId {
    return this.step;
  }

  isComplete(): boolean {
    return this.step === "complete";
  }

  getInfo(): TutorialStepInfo {
    switch (this.step) {
      case "movement":
        return { step: this.step, caption: "A / D — MOVER" };
      case "positioning":
        return { step: this.step, caption: "POSICIONE-SE PARA A BOLA" };
      case "swing":
        return {
          step: this.step,
          caption: this.stepElapsedMs < SWING_CAPTION_SWAP_MS ? "SPACE — REBATER" : "APERTE NO MOMENTO CERTO",
        };
      case "timing":
        return { step: this.step, caption: "PERFECT · GOOD · LATE — O TIMING MUDA A QUALIDADE DO GOLPE" };
      case "direction":
        return {
          step: this.step,
          caption: this.sawLeftHit ? "SEGURE D PARA MANDAR A BOLA PARA A DIREITA" : "SEGURE A PARA MANDAR A BOLA PARA A ESQUERDA",
        };
      case "rally":
        return { step: this.step, caption: "MANTENHA A TROCA!" };
      case "recovery":
        return { step: this.step, caption: "VOLTE PARA UMA BOA POSIÇÃO" };
      case "complete":
        return { step: this.step, caption: "VOCÊ ESTÁ PRONTO!" };
    }
  }

  private enter(step: TutorialStepId): void {
    this.step = step;
    this.stepElapsedMs = 0;
  }
}
