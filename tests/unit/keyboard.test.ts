/**
 * KeyboardInput had zero test coverage before the "Etapa corretiva" — both
 * real bugs found by manual playtesting (Space scrolling the page, a held
 * key generating extra swing/serve-contact attempts via the OS's own
 * key-repeat) lived exactly here. vitest runs in a plain Node environment
 * (see vitest.config.mts — no DOM), so this uses a minimal fake `window`
 * implementing only what KeyboardInput actually calls
 * (addEventListener/removeEventListener) instead of pulling in jsdom for
 * one file.
 */
import { describe, expect, it, vi } from "vitest";
import { KeyboardInput } from "@/game/input/keyboard";

type Handler = (e: unknown) => void;

class FakeWindow {
  private listeners: Record<string, Handler[]> = {};

  addEventListener(type: string, handler: Handler): void {
    (this.listeners[type] ??= []).push(handler);
  }

  removeEventListener(type: string, handler: Handler): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((h) => h !== handler);
  }

  dispatch(type: string, event: unknown): void {
    for (const handler of this.listeners[type] ?? []) handler(event);
  }
}

function keyEvent(code: string, overrides: Partial<{ repeat: boolean; preventDefault: () => void }> = {}) {
  return { code, repeat: false, preventDefault: vi.fn(), ...overrides };
}

function makeInput() {
  const fakeWindow = new FakeWindow();
  const input = new KeyboardInput(fakeWindow as unknown as Window);
  input.attach();
  return { fakeWindow, input };
}

describe("KeyboardInput — Space (hit/serve key)", () => {
  it("recognizes a genuine Space press and reports hitPressed exactly once", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keydown", keyEvent("Space"));
    expect(input.poll().hitPressed).toBe(true);
    expect(input.poll().hitPressed).toBe(false); // consumed — a single press is a single frame of true
  });

  it("calls preventDefault on Space so the browser never scrolls the page", () => {
    const { fakeWindow } = makeInput();
    const event = keyEvent("Space");
    fakeWindow.dispatch("keydown", event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("does not call preventDefault for other keys (movement must keep working exactly as before)", () => {
    const { fakeWindow } = makeInput();
    const event = keyEvent("KeyA");
    fakeWindow.dispatch("keydown", event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("keyup alone never generates a hit", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keyup", { code: "Space" });
    expect(input.poll().hitPressed).toBe(false);
  });

  /**
   * Regression test for the "Etapa corretiva" root cause: a held key fires
   * repeated keydown events from the OS/browser (event.repeat === true) —
   * those describe the *same* physical press, not a new one. Before the
   * fix, each repeat re-armed hitQueued, so one held Space could resolve a
   * serve contact or rally swing the instant a repeat fired — often before
   * the player meant to act, and always silently consuming the *real*
   * attempt that was supposed to happen when they actually released and
   * pressed again.
   */
  it("an OS key-repeat for the same held press does not generate an extra hit", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keydown", keyEvent("Space", { repeat: false }));
    expect(input.poll().hitPressed).toBe(true); // the real, original press

    fakeWindow.dispatch("keydown", keyEvent("Space", { repeat: true })); // OS repeat, same hold
    expect(input.poll().hitPressed).toBe(false); // must NOT re-arm

    fakeWindow.dispatch("keydown", keyEvent("Space", { repeat: true })); // another repeat
    expect(input.poll().hitPressed).toBe(false);
  });

  it("still calls preventDefault on a repeated Space keydown (the scroll must stay suppressed for the whole hold)", () => {
    const { fakeWindow } = makeInput();
    const repeatEvent = keyEvent("Space", { repeat: true });
    fakeWindow.dispatch("keydown", repeatEvent);
    expect(repeatEvent.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("releasing and pressing Space again after a repeat produces a genuine new hit", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keydown", keyEvent("Space", { repeat: false }));
    input.poll(); // consume the first press
    fakeWindow.dispatch("keydown", keyEvent("Space", { repeat: true })); // still held, ignored
    input.poll();
    fakeWindow.dispatch("keyup", { code: "Space" }); // released
    fakeWindow.dispatch("keydown", keyEvent("Space", { repeat: false })); // a brand new press
    expect(input.poll().hitPressed).toBe(true);
  });
});

describe("KeyboardInput — movement (A/D, arrows)", () => {
  it("KeyA produces direction -1", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keydown", keyEvent("KeyA"));
    expect(input.poll().direction).toBe(-1);
  });

  it("KeyD produces direction 1", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keydown", keyEvent("KeyD"));
    expect(input.poll().direction).toBe(1);
  });

  it("ArrowLeft/ArrowRight work the same as A/D", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keydown", keyEvent("ArrowLeft"));
    expect(input.poll().direction).toBe(-1);
  });

  it("holding both A and D cancels out to no direction", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keydown", keyEvent("KeyA"));
    fakeWindow.dispatch("keydown", keyEvent("KeyD"));
    expect(input.poll().direction).toBe(0);
  });

  it("releasing a direction key stops movement in that direction", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keydown", keyEvent("KeyA"));
    expect(input.poll().direction).toBe(-1);
    fakeWindow.dispatch("keyup", { code: "KeyA" });
    expect(input.poll().direction).toBe(0);
  });

  it("KeyW/ArrowUp report smashHeld while held", () => {
    const { fakeWindow, input } = makeInput();
    fakeWindow.dispatch("keydown", keyEvent("KeyW"));
    expect(input.poll().smashHeld).toBe(true);
    fakeWindow.dispatch("keyup", { code: "KeyW" });
    expect(input.poll().smashHeld).toBe(false);
  });
});

describe("KeyboardInput — detach", () => {
  it("stops reacting to key events once detached", () => {
    const { fakeWindow, input } = makeInput();
    input.detach();
    fakeWindow.dispatch("keydown", keyEvent("Space"));
    expect(input.poll().hitPressed).toBe(false);
  });
});
