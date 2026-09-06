import { describe, expect, it } from "vitest";
import { ALICE_X, COURT_LENGTH, COURT_WIDTH, LEO_X, NET_X } from "@/game/constants";
import { clampToBounds, COURT } from "@/game/court/geometry";

describe("CourtGeometry — dimensões", () => {
  it("expõe o comprimento e a largura existentes sem duplicar os números", () => {
    expect(COURT.length).toBe(COURT_LENGTH);
    expect(COURT.width).toBe(COURT_WIDTH);
  });

  it("a largura é positiva e o comprimento é maior que a largura (quadra retangular alongada)", () => {
    expect(COURT.width).toBeGreaterThan(0);
    expect(COURT.length).toBeGreaterThan(COURT.width);
  });

  it("a rede fica exatamente no ponto médio entre as duas baselines", () => {
    expect(COURT.netX).toBeCloseTo((COURT.leoBaselineX + COURT.aliceBaselineX) / 2, 6);
  });

  it("os dois lados da quadra são simétricos em relação à rede", () => {
    const leoHalf = COURT.netX - COURT.leoBaselineX;
    const aliceHalf = COURT.aliceBaselineX - COURT.netX;
    expect(leoHalf).toBeCloseTo(aliceHalf, 6);
  });

  it("usa as constantes existentes (LEO_X/ALICE_X/NET_X) como as posições de baseline/rede", () => {
    expect(COURT.leoBaselineX).toBe(LEO_X);
    expect(COURT.aliceBaselineX).toBe(ALICE_X);
    expect(COURT.netX).toBe(NET_X);
  });
});

describe("CourtGeometry — linhas", () => {
  it("as linhas de duplas (sidelines externas) coincidem com os limites de movimento já existentes [0, COURT_WIDTH]", () => {
    expect(COURT.doublesTop).toBe(0);
    expect(COURT.doublesBottom).toBe(COURT_WIDTH);
  });

  it("as linhas de simples ficam estritamente dentro das linhas de duplas", () => {
    expect(COURT.singlesTop).toBeGreaterThan(COURT.doublesTop);
    expect(COURT.singlesBottom).toBeLessThan(COURT.doublesBottom);
  });

  it("as linhas de simples são simétricas em relação ao centro da quadra", () => {
    const center = (COURT.doublesTop + COURT.doublesBottom) / 2;
    expect(COURT.singlesTop).toBeCloseTo(center - (COURT.singlesBottom - center), 6);
  });

  it("a linha de saque de cada lado fica entre a rede e a respectiva baseline", () => {
    expect(COURT.leoServiceLineX).toBeGreaterThan(COURT.leoBaselineX);
    expect(COURT.leoServiceLineX).toBeLessThan(COURT.netX);

    expect(COURT.aliceServiceLineX).toBeLessThan(COURT.aliceBaselineX);
    expect(COURT.aliceServiceLineX).toBeGreaterThan(COURT.netX);
  });

  it("as linhas de saque são simétricas em relação à rede (mesma distância dos dois lados)", () => {
    const leoDistance = COURT.netX - COURT.leoServiceLineX;
    const aliceDistance = COURT.aliceServiceLineX - COURT.netX;
    expect(leoDistance).toBeCloseTo(aliceDistance, 6);
  });

  it("a linha central de saque fica exatamente no meio lateral da quadra, dentro da faixa de simples", () => {
    expect(COURT.centerServiceY).toBeCloseTo((COURT.doublesTop + COURT.doublesBottom) / 2, 6);
    expect(COURT.centerServiceY).toBeGreaterThan(COURT.singlesTop);
    expect(COURT.centerServiceY).toBeLessThan(COURT.singlesBottom);
  });

  it("a linha de saque real (ITF: 21 de 39 pés a partir da rede) está a mais da metade do caminho da rede até a baseline", () => {
    // sanity check that the ratio actually moved the line away from the net,
    // not left it sitting on top of the net or past the baseline
    const leoHalfLength = COURT.netX - COURT.leoBaselineX;
    const distanceFromNet = COURT.netX - COURT.leoServiceLineX;
    const fraction = distanceFromNet / leoHalfLength;
    expect(fraction).toBeGreaterThan(0);
    expect(fraction).toBeLessThan(1);
    expect(fraction).toBeCloseTo(21 / 39, 3);
  });
});

describe("CourtGeometry — playable bounds", () => {
  it("existem bounds jogáveis para os dois lados", () => {
    expect(COURT.leoPlayableBounds).toBeDefined();
    expect(COURT.alicePlayableBounds).toBeDefined();
  });

  it("Leo fica inteiramente do lado dele da rede (maxX == netX)", () => {
    expect(COURT.leoPlayableBounds.maxX).toBe(COURT.netX);
    expect(COURT.leoPlayableBounds.minX).toBeLessThan(COURT.leoPlayableBounds.maxX);
  });

  it("Alice fica inteiramente do lado oposto da rede (minX == netX)", () => {
    expect(COURT.alicePlayableBounds.minX).toBe(COURT.netX);
    expect(COURT.alicePlayableBounds.maxX).toBeGreaterThan(COURT.alicePlayableBounds.minX);
  });

  it("nenhum dos dois bounds atravessa a rede — a intersecção dos dois intervalos de X é vazia (exceto o ponto da rede)", () => {
    expect(COURT.leoPlayableBounds.maxX).toBeLessThanOrEqual(COURT.alicePlayableBounds.minX);
  });

  it("nenhum dos dois bounds ultrapassa as laterais (doubles sidelines)", () => {
    for (const bounds of [COURT.leoPlayableBounds, COURT.alicePlayableBounds]) {
      expect(bounds.minY).toBeGreaterThanOrEqual(COURT.doublesTop);
      expect(bounds.maxY).toBeLessThanOrEqual(COURT.doublesBottom);
    }
  });

  it("os bounds jogáveis cobrem toda a extensão do respectivo lado até a rede (não deixam Leo/Alice presos perto da baseline)", () => {
    expect(COURT.leoPlayableBounds.minX).toBe(0);
    expect(COURT.alicePlayableBounds.maxX).toBe(COURT.length);
  });
});

describe("clampToBounds", () => {
  it("não altera um ponto que já está dentro dos limites", () => {
    const result = clampToBounds(200, 250, COURT.leoPlayableBounds);
    expect(result).toEqual({ x: 200, y: 250 });
  });

  it("limita X para não ultrapassar a rede", () => {
    const result = clampToBounds(COURT.netX + 100, 250, COURT.leoPlayableBounds);
    expect(result.x).toBe(COURT.netX);
  });

  it("limita Y para não ultrapassar as laterais, nos dois sentidos", () => {
    expect(clampToBounds(200, -50, COURT.leoPlayableBounds).y).toBe(COURT.doublesTop);
    expect(clampToBounds(200, COURT.width + 50, COURT.leoPlayableBounds).y).toBe(COURT.doublesBottom);
  });

  it("funciona igualmente para os bounds da Alice", () => {
    const result = clampToBounds(COURT.netX - 100, 250, COURT.alicePlayableBounds);
    expect(result.x).toBe(COURT.netX);
  });
});
