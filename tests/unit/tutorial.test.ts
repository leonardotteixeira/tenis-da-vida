import { describe, expect, it } from "vitest";
import { TutorialController } from "@/components/tutorial";
import { COURT_WIDTH } from "@/game/constants";
import type { GameEvent, GameSnapshot, Side } from "@/game/types";

function snapshot(overrides: {
  leoY?: number;
  leoX?: number;
  ballOwner?: Side;
  ballX?: number;
  ballVy?: number;
  rallyCount?: number;
  lastEvent?: GameEvent | null;
  phase?: GameSnapshot["phase"];
} = {}): GameSnapshot {
  const { leoY = 250, leoX = 60, ballOwner = "alice", ballX = 500, ballVy = 0, rallyCount = 0, lastEvent = null, phase = "rally" } = overrides;
  return {
    ball: { x: ballX, y: 250, z: 0, vx: -400, vy: ballVy, vz: 0, owner: ballOwner, lastHitBy: null, state: "in_play", bounceCount: 0 },
    leo: { side: "leo", x: leoX, y: leoY, vy: 0, lastShot: null },
    alice: { side: "alice", x: 940, y: 250, vy: 0, lastShot: null },
    score: { points: [0, 0], games: [0, 0], sets: [0, 0], server: "alice" },
    rally: { count: rallyCount, level: 1, speedMultiplier: 1 },
    phase,
    lastEvent,
  };
}

/** A fresh, distinct `{type:"hit",...}` object each call — frameEvents.ts detects "new this frame" by reference inequality, matching how the real engine allocates a new object per event. */
function leoHitEvent(quality: "perfect" | "good" | "late" = "good"): GameEvent {
  return { type: "hit", side: "leo", quality };
}

describe("TutorialController", () => {
  it("starts on the movement step with the real A/D instruction", () => {
    const controller = new TutorialController();
    expect(controller.getStep()).toBe("movement");
    expect(controller.getInfo().caption).toBe("A / D — MOVER");
  });

  describe("movement -> positioning", () => {
    it("stays on movement below the accumulated-distance target", () => {
      const controller = new TutorialController();
      let prev = snapshot({ leoY: 250 });
      // 5 frames of a small step each — well under the 180-unit target.
      for (let i = 0; i < 5; i++) {
        const next = snapshot({ leoY: 250 + (i + 1) * 10 });
        controller.update(1 / 60, prev, next);
        prev = next;
      }
      expect(controller.getStep()).toBe("movement");
    });

    it("advances once accumulated lateral travel clears the target", () => {
      const controller = new TutorialController();
      let prev = snapshot({ leoY: 100 });
      const next = snapshot({ leoY: 100 + 200 }); // one big jump, well past the 180-unit target
      controller.update(1 / 60, prev, next);
      expect(controller.getStep()).toBe("positioning");
      prev = next;
    });

    it("sums travel across many small back-and-forth steps, not just net displacement", () => {
      const controller = new TutorialController();
      let y = 250;
      let prev = snapshot({ leoY: y });
      // Oscillate: net displacement ends near 0, but total travel exceeds the target.
      for (let i = 0; i < 40; i++) {
        y += i % 2 === 0 ? 10 : -8; // net +2/cycle, but |10|+|8| = 18 accumulated per cycle
        const next = snapshot({ leoY: y });
        controller.update(1 / 60, prev, next);
        prev = next;
        if (controller.getStep() !== "movement") break;
      }
      expect(controller.getStep()).toBe("positioning");
    });
  });

  describe("positioning -> swing", () => {
    function atPositioning(): TutorialController {
      const controller = new TutorialController();
      controller.update(1 / 60, snapshot({ leoY: 100 }), snapshot({ leoY: 300 }));
      expect(controller.getStep()).toBe("positioning");
      return controller;
    }

    it("stays on positioning while the ball is still far from Leo", () => {
      const controller = atPositioning();
      const far = snapshot({ ballOwner: "leo", ballX: 500, leoX: 60 }); // |500-60| = 440 > 260
      controller.update(1 / 60, far, far);
      expect(controller.getStep()).toBe("positioning");
    });

    it("stays on positioning while the ball is not owned by Leo, no matter how close on X", () => {
      const controller = atPositioning();
      const close = snapshot({ ballOwner: "alice", ballX: 65, leoX: 60 });
      controller.update(1 / 60, close, close);
      expect(controller.getStep()).toBe("positioning");
    });

    it("advances to swing once the ball is Leo's and close enough on X", () => {
      const controller = atPositioning();
      const close = snapshot({ ballOwner: "leo", ballX: 200, leoX: 60 }); // |200-60| = 140 <= 260
      controller.update(1 / 60, close, close);
      expect(controller.getStep()).toBe("swing");
    });
  });

  describe("swing -> timing -> direction", () => {
    function atSwing(): TutorialController {
      const controller = new TutorialController();
      controller.update(1 / 60, snapshot({ leoY: 100 }), snapshot({ leoY: 300 }));
      const close = snapshot({ ballOwner: "leo", ballX: 200, leoX: 60 });
      controller.update(1 / 60, close, close);
      expect(controller.getStep()).toBe("swing");
      return controller;
    }

    it("shows the hit-key instruction, then swaps to the timing cue after a short beat, without changing step", () => {
      const controller = atSwing();
      expect(controller.getInfo().caption).toBe("SPACE — REBATER");
      const still = snapshot();
      controller.update(2, still, still); // 2s > SWING_CAPTION_SWAP_MS, no hit event
      expect(controller.getStep()).toBe("swing");
      expect(controller.getInfo().caption).toBe("APERTE NO MOMENTO CERTO");
    });

    it("moves to timing on Leo's first connect, and to direction only after the 3rd total connect", () => {
      const controller = atSwing();
      const prev = snapshot();

      controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent() }));
      expect(controller.getStep()).toBe("timing");

      controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent("perfect") }));
      expect(controller.getStep()).toBe("timing"); // 2 of 3

      controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent("late") }));
      expect(controller.getStep()).toBe("direction"); // 3 of 3
    });
  });

  describe("direction -> rally", () => {
    function atDirection(): TutorialController {
      const controller = new TutorialController();
      controller.update(1 / 60, snapshot({ leoY: 100 }), snapshot({ leoY: 300 }));
      const close = snapshot({ ballOwner: "leo", ballX: 200, leoX: 60 });
      controller.update(1 / 60, close, close);
      const prev = snapshot();
      for (let i = 0; i < 3; i++) controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent() }));
      expect(controller.getStep()).toBe("direction");
      return controller;
    }

    it("asks for A (left) first, matching the approved copy", () => {
      const controller = atDirection();
      expect(controller.getInfo().caption).toBe("SEGURE A PARA MANDAR A BOLA PARA A ESQUERDA");
    });

    it("switches to asking for D only after a real leftward-aimed hit registers", () => {
      const controller = atDirection();
      const prev = snapshot();
      controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent(), ballVy: -80 })); // held A -> negative vy
      expect(controller.getStep()).toBe("direction");
      expect(controller.getInfo().caption).toBe("SEGURE D PARA MANDAR A BOLA PARA A DIREITA");
    });

    it("does not accept a near-straight hit as a directional one (must clear the vy threshold)", () => {
      const controller = atDirection();
      const prev = snapshot();
      controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent(), ballVy: 5 })); // well under DIRECTION_VY_THRESHOLD
      expect(controller.getStep()).toBe("direction");
      expect(controller.getInfo().caption).toBe("SEGURE A PARA MANDAR A BOLA PARA A ESQUERDA");
    });

    it("advances to rally once both a left hit and a right hit have registered", () => {
      const controller = atDirection();
      const prev = snapshot();
      controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent(), ballVy: -80 }));
      controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent(), ballVy: 80 }));
      expect(controller.getStep()).toBe("rally");
    });
  });

  describe("rally -> recovery -> complete", () => {
    function atRally(): TutorialController {
      const controller = new TutorialController();
      controller.update(1 / 60, snapshot({ leoY: 100 }), snapshot({ leoY: 300 }));
      const close = snapshot({ ballOwner: "leo", ballX: 200, leoX: 60 });
      controller.update(1 / 60, close, close);
      const prev = snapshot();
      for (let i = 0; i < 3; i++) controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent() }));
      controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent(), ballVy: -80 }));
      controller.update(1 / 60, prev, snapshot({ lastEvent: leoHitEvent(), ballVy: 80 }));
      expect(controller.getStep()).toBe("rally");
      return controller;
    }

    it("stays on rally below the exchange target", () => {
      const controller = atRally();
      controller.update(1 / 60, snapshot({ rallyCount: 1 }), snapshot({ rallyCount: 2 }));
      expect(controller.getStep()).toBe("rally");
    });

    it("advances to recovery once the rally count reaches the target", () => {
      const controller = atRally();
      controller.update(1 / 60, snapshot({ rallyCount: 3 }), snapshot({ rallyCount: 4 }));
      expect(controller.getStep()).toBe("recovery");
    });

    it("recovery completes once Leo is back near the center of the court", () => {
      const controller = atRally();
      controller.update(1 / 60, snapshot({ rallyCount: 3 }), snapshot({ rallyCount: 4 }));
      expect(controller.getStep()).toBe("recovery");
      controller.update(1 / 60, snapshot(), snapshot({ leoY: COURT_WIDTH / 2 + 20 }));
      expect(controller.getStep()).toBe("complete");
    });

    it("recovery also completes on a timeout, so an off-center player is never stuck forever", () => {
      const controller = atRally();
      controller.update(1 / 60, snapshot({ rallyCount: 3 }), snapshot({ rallyCount: 4 }));
      expect(controller.getStep()).toBe("recovery");
      const stillOffCenter = snapshot({ leoY: 10 });
      controller.update(5, stillOffCenter, stillOffCenter); // 5000ms > RECOVERY_TIMEOUT_MS (4000ms)
      expect(controller.getStep()).toBe("complete");
    });

    it("getInfo() reports the approved finish copy once complete", () => {
      const controller = atRally();
      controller.update(1 / 60, snapshot({ rallyCount: 3 }), snapshot({ rallyCount: 4 }));
      controller.update(1 / 60, snapshot(), snapshot({ leoY: COURT_WIDTH / 2 }));
      expect(controller.isComplete()).toBe(true);
      expect(controller.getInfo().caption).toBe("VOCÊ ESTÁ PRONTO!");
    });
  });

  it("treats a match ending mid-tutorial as completion instead of getting stuck", () => {
    const controller = new TutorialController();
    controller.update(1 / 60, snapshot({ phase: "rally" }), snapshot({ phase: "game_over" }));
    expect(controller.isComplete()).toBe(true);
  });
});
