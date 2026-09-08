# Alice — mapeamento determinístico de frames

Todos os frames abaixo foram recortados de `../ALICE SPRITE SHEET.png`
(1774×887, RGBA) usando bounding-box exata por canal alpha (mesmo método do
Leo — ver `leo/derived/FRAME_MAP.md`), com uma etapa extra de correção de
orientação (ver abaixo). `alice-backhand.png` **não é mais usada** como
sprite de gameplay — permanece no disco, sem uso em código.

## Correção de orientação (achado da auditoria da Etapa 4)

A sheet **não é consistente**: os grupos IDLE e ERRO/MISS desenham a Alice
virada para a **direita**, enquanto PREPARAÇÃO/FOREHAND/BACKHAND a desenham
virada para a **esquerda**. Como a Alice fica no lado direito da quadra e
precisa olhar para a rede (esquerda) em todos os estados, os frames de
IDLE e MISS foram **espelhados horizontalmente na extração** (`Image.
FLIP_LEFT_RIGHT`, aplicado uma vez ao salvar o PNG derivado — não há flip em
tempo de render). Os frames de PREPARAÇÃO/FOREHAND/BACKHAND já vinham
corretos e não foram espelhados. Isso também corrige, como efeito colateral
desejado, a orientação invertida que `alice-backhand.png` (a sprite estática
usada até a Etapa 3) tinha — ela virava para a direita, para fora da quadra.

## Correção de contagem (achado da implementação desta etapa)

A auditoria original contou "FOREHAND: 4 frames" a partir de uma inspeção
visual rápida do grupo rotulado. Uma inspeção pixel a pixel (canal alpha +
componentes conectados) feita durante a implementação mostrou que o grupo
FOREHAND tem, na verdade, **3 poses distintas** (preparação→meio do
swing→contato), não 4 — o quarto "frame" que parecia existir era a mesma
pose final vista com o braço/raquete bem estendido, ocupando uma faixa mais
larga do sheet. BACKHAND foi reconferido com o mesmo método e **tem mesmo os
4 frames** da auditoria original. A tabela abaixo reflete a contagem real.

| Arquivo | Origem (grupo no sheet) | Bbox aproximada na sheet original | Espelhado? |
|---|---|---|---|
| `idle-1.png` … `idle-4.png` | IDLE (PARADA), 4/4 frames | x≈244–671, y≈48–211 | Sim |
| `prepare-forehand-1.png` … `-3.png` | PREPARAÇÃO (FOREHAND), 3/3 | x≈14–403, y≈265–433 | Não |
| `forehand-1.png`, `forehand-2.png`, `forehand-contact.png` | FOREHAND, 3 poses reais (não 4 — ver acima) | x≈428–918, y≈265–433 | Não |
| `prepare-backhand-1.png` … `-3.png` | PREPARAÇÃO (BACKHAND), 3/3 | x≈922–1269, y≈265–433 | Não |
| `backhand-1.png` … `-3.png`, `backhand-contact.png` | BACKHAND, 4/4 | x≈1279–1765, y≈265–433 | Não |
| `miss-1.png`, `miss-2.png` | ERRO/MISS, 2/2 (a sheet só tem 2, não 3 como o Leo) | x≈16–234, y≈734–873 | Sim |
| `walk-1.png` … `walk-5.png` | CAMINHADA, 5/5 (polish pass) | x≈695–1209, y≈51–212 | Não (já vira para a esquerda) |
| `run-1.png` … `run-4.png` | CORRIDA, 4/4 (polish pass) | x≈1235–1772, y≈50–212 | Não (já vira para a esquerda) |
| `celebrate-1.png`, `celebrate-2.png` | COMEMORAÇÃO, frames 1–2 de 4 (3 e 4 estão fundidos entre si — braços erguidos se tocam — e foram descartados) | x≈263–444, y≈737–870 | Não (pose frontal) |

## Polish pass: CAMINHADA, CORRIDA e COMEMORAÇÃO

Extraídos por componente conectado do canal alpha (`scipy.ndimage.label`,
limiar 40/255, dilatação de 2px para recuperar as bordas suaves), **não por
bbox retangular**: os frames de CORRIDA se intercalam horizontalmente
(bbox do frame 2 começa antes do fim do bbox do frame 1), então cada PNG
derivado contém só os pixels do seu próprio componente — nenhum pedaço da
pose vizinha. Uso em jogo: `components/playerAnimation.ts` — o ciclo de
caminhada/corrida avança por **distância percorrida** (`vy` do motor), não
por tempo, para os pés não deslizarem.

## Limitação conhecida e aceita: leve "eco" de raquete em `forehand-2` e `forehand-contact`

Diferente do Leo (onde poses dinâmicas sobrepostas foram **descartadas**),
aqui as 3 poses do FOREHAND encostam uma na outra por uma margem pequena mas
real (confirmado até em alpha > 200/255 — não é só anti-aliasing) bem no
ponto de transição raquete-para-raquete entre a pose 2 e a pose de contato.
Tentativas de isolar por componente conectado pioraram o resultado (a malha
da raquete tem muitos buracos e vira vários componentes pequenos,
arriscando remover pedaços da própria raquete da Alice — testado e
revertido). A pose de cada frame está **100% completa e correta** (nenhum
braço/raquete cortado no meio) — o que sobra é um contorno fraco e parcial
da raquete do frame vizinho no canto da imagem, quase imperceptível no
tamanho de render do jogo (150px) e que, no frame de contato, até lê como um
efeito natural de "motion blur" da raquete. Documentado aqui em vez de
escondido — se uma versão futura da sprite sheet vier com mais espaçamento
entre poses, isso pode ser eliminado por completo.

## Ancoragem

Mesma técnica do Leo: cada frame tem altura de bbox diferente (recorte justo,
sem padding fixo), então o desenho ancora todos os frames pela base
(`drawY(worldY) - height`), nunca pelo topo — ver `drawAlice()` em
`components/GameCanvas.tsx`.

## Contato: forehand vs. backhand

O engine (`game/`) não tem nenhum conceito de lado do golpe — nem para o
Leo, nem para a Alice. A escolha visual entre forehand/backhand é feita
inteiramente em `components/aliceAnimation.ts` (`AliceAnimator.pickShotSide`),
usando só campos já públicos do snapshot (`ball.y` vs `alice.y`) — não foi
adicionado nem alterado nenhum estado em `game/`.
