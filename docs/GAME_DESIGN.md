# Tennis Challenge — Game Design Document

Este documento é a fonte de verdade do projeto. Qualquer sessão futura (do Claude Code ou de qualquer outra pessoa) deve conseguir entender o jogo inteiro lendo só este arquivo — sem depender de memória de conversa anterior. Ver também `docs/PROGRESS.md` para o estado atual de implementação.

## Concept

**Tennis Challenge** é um jogo de tênis arcade retrô, estética 8-bit/16-bit, em que o jogador controla **Leo (P1)** contra **Alice (P2)**, controlada pela CPU. O núcleo do jogo é um **rally real**: a bola de fato viaja entre os dois jogadores, com física em arco, e o jogador influencia timing e direção de cada rebatida — nunca uma animação pré-programada.

Loop principal:

```
LEO → BOLA → REDE → ALICE → BOLA → REDE → LEO → ...
```

Não é um clone de Pong. É um jogo de tênis de verdade, simplificado para arcade.

## Visual Reference

A imagem de referência (`docs/reference/tennis-reference.png` — salvar a imagem original aqui) define a direção visual oficial. Análise detalhada:

**Câmera**: fixa, vista elevada em 3/4 lateral — a quadra é vista "de lado" (como a posição de um juiz de cadeira), não da linha de fundo. A rede aparece como uma linha **vertical** dividindo a tela (Leo à esquerda, Alice à direita), não horizontal. É isso que permite os dois jogadores ficarem visíveis simultaneamente.

**HUD superior**: painel escuro de ponta a ponta.
- Esquerda: badge "P1" (azul), 3 corações, avatar de Leo, nome, "GAMES", "POINTS".
- Centro: título em pixel-art dourado com contorno escuro + ícone de bola com linhas de movimento + slogan.
- Direita: badge "P2" (vermelho), 3 corações, avatar de Alice, nome, "GAMES", "POINTS".

**Cenário, de trás pra frente**: céu azul com nuvens → skyline de prédios escuros → árvores verdes nas bordas → arquibancada densa com torcida pixel-art multicolorida → quadro publicitário verde-escuro com texto (mensagens temáticas, ver arte original) → dois bancos de jogador → cadeira de juiz centralizada atrás da rede → carrinho de bolas decorativo.

**Quadra**: saibro laranja-terracota, linhas brancas em leve perspectiva, rede central com textura de trama e fita branca no topo.

**Bola**: viaja em arco real, com rastro de movimento curvo — nunca um ponto estático ou teleporte.

**HUD inferior**: três painéis — controles (mover/rebater), status do rally (estrela + contador, nível, barra de velocidade), controles de sistema (pausar/menu).

## Leo (P1) — Identidade Visual

Permanente, não deve ser alterada arbitrariamente em nenhuma animação:

- Homem jovem, cabelo castanho curto e levemente desarrumado
- Barba curta
- Rosto amigável, expressão confiante/alegre
- Camiseta preta
- Shorts brancos
- Tênis azul com detalhes claros
- Raquete de tênis
- Proporções humanas (não chibi/cabeça-grande)

**Pendente**: usuário vai fornecer 1 foto de rosto (frontal) + 1 foto de corpo inteiro de Leo para aumentar a fidelidade na arte definitiva (Fase 6). Até lá, a referência visual já fornecida é suficiente para cor de cabelo, roupas e proporção geral.

## Alice (P2) — Identidade Visual

Permanente. **Nunca usar o nome "Julia"** (usado no mockup de referência) — sempre **ALICE / Alice / P2 / CPU**.

- Mulher jovem, cabelo castanho comprido e solto (característica mais marcante)
- Rosto amigável, expressão alegre
- Camiseta rosa
- Parte inferior branca (saia, conforme a referência)
- Tênis rosa
- Raquete de tênis
- Proporções humanas

**Pendente**: usuário vai fornecer 1 foto de rosto (frontal) + 1 foto de corpo inteiro de Alice, com atenção especial ao cabelo, para a arte definitiva (Fase 6).

## Decisões de Game Design (confirmadas com o usuário)

| Decisão | Escolha | Por quê |
|---|---|---|
| Nome do jogo | **TENNIS CHALLENGE** | A imagem de referência mostrava "TÊNIS DA VIDA" como mockup, mas o nome oficial é Tennis Challenge. |
| Corações no HUD (♥♥♥ / ♡♡♡) | **Sets vencidos** | Cada coração = um set ganho na partida. Distinto de GAMES (games no set atual) e POINTS (pontos no game atual). |
| Controle da bola | **Timing + mira lateral** | Timing (Perfect/Good/Late) determina qualidade/velocidade do golpe; segurar A/D no momento do hit influencia a direção lateral da bola. Mais profundidade tática do que só timing. |
| Saque | **Automático no V1** | Reduz escopo da Fase 1 sem perder a experiência central de rally. Saque jogável de verdade fica reservado para o modo futuro "Serve Challenge" (V2). |
| Fidelidade de personagens | **Pendente fotos reais** | Ver seções Leo/Alice acima — não bloqueia a implementação (placeholders primeiro, arte definitiva na Fase 6). |

Decisões já definidas no documento original do usuário (não precisaram de pergunta):

- Câmera fixa, sem movimento.
- Pontuação tradicional de tênis (0/15/30/40/GAME) + SET/MATCH, mas partidas curtas (arcade).
- Forehand/backhand determinados pela posição da bola; smash quando a bola está suficientemente alta.
- Dificuldade: Easy / Normal / Hard / Insane, com parâmetros centralizados (não espalhados pelo código).
- CPU determinística (sem ML), com previsão de trajetória, posição-alvo, margem de erro por dificuldade.
- Modos V1: **Quick Match** (partida contra Alice) e **Rally Challenge** (maior rally possível). V2 (roadmap): Serve Challenge, Time Attack.
- Apenas Leo vs Alice — sem seleção de personagem no V1.
- Persistência via `localStorage` apenas (maior rally, maior score, melhor partida, maior nível) — sem backend.
- Efeitos visuais/sonoros discretos, gameplay é prioridade sobre exagero.

## Golpes e Sistema de Rebatida

Quando a bola entra no alcance de Leo:

```
BOLA → DISTÂNCIA DO JOGADOR → TIMING → QUALIDADE DO HIT → NOVA TRAJETÓRIA
```

- **PERFECT** — timing excelente → golpe forte, trajetória precisa, velocidade maior.
- **GOOD** — timing adequado → golpe normal.
- **LATE** — timing ruim → golpe fraco, velocidade menor, trajetória menos favorável.
- **MISS** — jogador não alcança ou erra → perde o ponto.

Direção lateral (decisão confirmada: "timing + mira"): segurar A/D no momento do SPACE desloca o ângulo de saída da bola para aquele lado; sem input direcional, a bola sai reta/centralizada.

Tipo de golpe determinado pela posição da bola relativa ao jogador:
- Bola à direita do jogador → forehand
- Bola à esquerda → backhand
- Bola suficientemente alta → smash

## CPU (Alice)

Determinística, sem machine learning:

1. Observa a trajetória atual da bola (posição + velocidade).
2. Prevê (projeção simples da física, não "sabe magicamente") onde a bola cruzará a linha de alcance dela.
3. Calcula uma posição-alvo com uma margem de erro dependente da dificuldade.
4. Move-se em direção ao alvo a uma velocidade máxima dependente da dificuldade.
5. Decide o instante de rebater com uma janela de timing própria (equivalente ao Perfect/Good/Late do jogador) e uma taxa de erro configurável.

Parâmetros por dificuldade (centralizados em `game/difficulty/`, nunca espalhados como números mágicos):

| | Easy | Normal | Hard | Insane |
|---|---|---|---|---|
| Velocidade de reação | Lenta | Média | Rápida | Muito rápida |
| Erro de posicionamento | Alto | Médio | Baixo | Muito baixo |
| Chance de erro no timing | Alta | Média | Baixa | Mínima |
| Velocidade da bola (multiplicador) | Base | Base × 1.15 | Base × 1.3 | Base × 1.5 |

## Pontuação e Progressão

- Pontuação tradicional por game: 0 → 15 → 30 → 40 → GAME.
- Sets ganhos exibidos como corações preenchidos/vazios no HUD (máx. 3, "melhor de 3" para manter partidas curtas).
- Rally (contador de trocas consecutivas) exibido no HUD central, junto com Nível e barra de Velocidade.
- Progressão arcade: conforme o rally/nível sobe, velocidade da bola e exigência de timing aumentam gradualmente — valores ajustados por playtesting, não fixos a priori.

## Technical Design

**Stack**: Next.js + TypeScript + Tailwind (menus/HUD) + **Canvas 2D API nativo** para a simulação (sem engine de jogo — Phaser/PixiJS seriam complexidade desnecessária para o escopo deste jogo; canvas puro com um game loop próprio demonstra melhor o entendimento de sistemas em tempo real, que é o objetivo de portfólio deste projeto).

**Separação fundamental**: React controla menus, HUD (como overlay), telas de pausa/game over, configurações. A simulação em si (posição de bola/jogadores, física, colisão, IA, scoring por frame) roda **fora do ciclo de render do React**, num loop próprio via `requestAnimationFrame`, publicando snapshots de estado para a UI consumir (não o inverso).

**Game loop**:

```
INPUT → UPDATE → PHYSICS → COLLISION → PLAYER → CPU AI → SCORING → RENDER → next frame
```

## Architecture

```
tennis-challenge/
  app/
    page.tsx                # entrada — monta o MainMenu
    game/page.tsx            # tela do jogo (monta GameCanvas + HUD)
  components/
    GameCanvas.tsx           # <canvas> + ligação com o game engine (useEffect + rAF)
    MainMenu.tsx
    HUD.tsx                  # overlay React lendo snapshots do engine
    GameOver.tsx
    PauseMenu.tsx
    Settings.tsx
    Controls.tsx             # controles touch mobile
  game/
    engine/                  # game loop, orquestração, snapshot de estado pra UI
    physics/                 # trajetória, arco, bounce, velocidade
    collision/                # alcance do jogador, cruzamento de rede, fora da quadra
    ball/                     # BallState e transições
    player/                   # estado/movimento de Leo
    cpu/                      # IA de Alice (previsão, alvo, decisão)
    scoring/                  # 0/15/30/40/game/set/match
    difficulty/               # parâmetros centralizados por dificuldade
    input/                    # teclado + touch, normalizado
    types/                    # tipos compartilhados (Vector2, BallState, MatchState, ...)
  assets/
    characters/leo/, alice/   # placeholders agora, sprites definitivos na Fase 6
    court/
    ui/
    audio/
  docs/
    GAME_DESIGN.md            # este arquivo
    PROGRESS.md               # estado de implementação, para continuidade entre sessões
    reference/                # imagem de referência original
  tests/
    unit/                     # physics, collision, hit quality, scoring, CPU, game state
```

Regra dura: nenhum arquivo mistura renderização + física + regras + UI. `game/` nunca importa React; `components/` nunca calcula física ou regra de pontuação, só lê o snapshot do engine e chama seus métodos públicos (`start`, `pause`, `handleInput`).

## Roadmap (V2+)

- Serve Challenge (saque jogável, mirar regiões da quadra).
- Time Attack.
- Seleção de personagens.
- Arte definitiva de Leo/Alice com fidelidade às fotos reais fornecidas.

## Perguntas ainda pendentes

- Nenhuma decisão de arquitetura/gameplay pendente no momento — todas as questões essenciais foram respondidas (ver tabela de decisões acima).
- Pendente apenas: recebimento das fotos de referência de Leo e Alice para a Fase 6 (arte definitiva). Não bloqueia Fases 1-5.
