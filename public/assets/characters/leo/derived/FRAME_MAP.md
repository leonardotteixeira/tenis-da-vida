# Leo — mapeamento determinístico de frames

Todos os frames abaixo foram recortados de `../leo sprite sheet.png` (1774×887, RGBA)
usando limites exatos de bounding-box por canal alpha (nenhum corte "no chute").
Coordenadas no formato `(x0, y0, x1, y1)` em pixels nativos da sprite sheet original.

Grupos com sobreposição real entre poses (limbs/raquete se tocam sem gap de
transparência) foram **descartados**, não fatiados por estimativa — ver
"Frames NÃO extraídos" no fim.

| Arquivo | Origem (grupo no sheet) | Bbox na sheet original | Tamanho |
|---|---|---|---|
| `idle-1.png` | IDLE (PARADO), frame 1/4 | (272, 55, 355, 210) | 83×155 |
| `idle-2.png` | IDLE (PARADO), frame 2/4 | (374, 55, 444, 210) | 70×155 |
| `idle-3.png` | IDLE (PARADO), frame 3/4 | (475, 55, 555, 210) | 80×155 |
| `idle-4.png` | IDLE (PARADO), frame 4/4 | (574, 55, 654, 210) | 80×155 |
| `prepare-1.png` | PREPARAÇÃO (FOREHAND), frame 1/2 | (19, 262, 147, 432) | 128×170 |
| `prepare-2.png` | PREPARAÇÃO (FOREHAND), frame 2/2 | (164, 260, 289, 430) | 125×170 |
| `forehand-contact.png` | FOREHAND, frame 1/5 (único limpo) | (294, 274, 414, 430) | 120×156 |
| `miss-1.png` | ERRO/MISS, frame 1/3 | (19, 750, 100, 874) | 81×124 |
| `miss-2.png` | ERRO/MISS, frame 2/3 | (130, 750, 210, 874) | 80×124 |
| `miss-3.png` | ERRO/MISS, frame 3/3 | (224, 750, 327, 874) | 103×124 |

## Ancoragem

Cada frame tem altura de bbox diferente (o recorte é justo ao redor do
personagem, sem padding fixo). Para animar sem "flutuar" ou "afundar", o
canvas ancora todos os frames pela **base** (pé no chão), nunca pelo topo —
ver `ANCHOR_BOTTOM_RATIO`/lógica de desenho em `components/GameCanvas.tsx`.

## Frames NÃO extraídos (documentado, não implementado)

- **FOREHAND, frames 2-5/5**: fundidos entre si (o swing sobrepõe braço/raquete
  entre poses consecutivas, sem gap de transparência real). Usar apenas o
  frame 1 (`forehand-contact.png`) como o momento de contato visual.
- **BACKHAND** (todos os 4 frames): mesmo problema, todos fundidos.
- **SMASH, SAQUE, VOLEIO, CAMINHADA (frames 5-6), CORRIDA (frames 2-4)**:
  mesmo problema — poses dinâmicas se sobrepõem no sheet original.

Consequência prática: Leo usa a mesma animação de forehand independente do
lado real da bola (esquerda/direita) ou se o motor classificaria o golpe como
backhand/smash internamente — é uma limitação visual conhecida, não um bug.
Fatiar esses grupos com segurança exigiria a sprite sheet original em maior
resolução ou frames gerados com mais espaçamento — não foi feito aqui para
evitar sprites visualmente quebrados (recortes cortando raquete/braço no meio).
