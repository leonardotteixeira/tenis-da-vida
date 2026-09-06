/**
 * Normalizes raw keyboard events into a per-frame InputState, decoupled
 * from the DOM so the engine (and its tests) never touch
 * `window`/`document` directly — only components/GameCanvas.tsx
 * instantiates this.
 */

import type { InputState } from "@/game/types";

export class KeyboardInput {
  private keys = new Set<string>();
  private hitQueued = false;

  constructor(private target: Window) {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  attach(): void {
    this.target.addEventListener("keydown", this.handleKeyDown);
    this.target.addEventListener("keyup", this.handleKeyUp);
  }

  detach(): void {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.keys.clear();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.code === "Space") {
      // The browser's own default action for Space is to scroll the page —
      // never wanted during gameplay, this is the sole place that decision
      // belongs (see docs/PROGRESS.md "Etapa corretiva").
      e.preventDefault();
      // A held key fires repeated keydown events from the OS/browser's own
      // key-repeat (e.repeat === true) — those are the *same* physical
      // press, not new ones. Without this guard, one held Space could arm
      // hitQueued multiple times, breaking the documented contract on
      // InputState.hitPressed ("true only on the frame the hit key was
      // pressed — not held") and consuming a swing/serve-contact attempt
      // before the player actually meant to act again.
      if (!e.repeat) this.hitQueued = true;
    }
    this.keys.add(e.code);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  /** Call exactly once per frame — consumes the queued hit-press so it fires only once. */
  poll(): InputState {
    const left = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const right = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    const direction: -1 | 0 | 1 = left && !right ? -1 : right && !left ? 1 : 0;

    const hitPressed = this.hitQueued;
    this.hitQueued = false;

    return { direction, hitPressed, smashHeld: this.keys.has("KeyW") || this.keys.has("ArrowUp") };
  }
}
