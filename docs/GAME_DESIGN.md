# TÊNIS DA VIDA — Game Design Document

Este documento é a fonte de verdade do projeto. Qualquer sessão futura (do Claude Code ou de qualquer outra pessoa) deve conseguir entender o jogo inteiro lendo só este arquivo — sem depender de memória de conversa anterior. Ver também `docs/PROGRESS.md` para o estado atual de implementação.

Nota sobre o nome da pasta: o diretório do projeto (`tennis-challenge/`) mantém o nome interno original por conveniência técnica — o nome oficial e exibido do jogo é **TÊNIS DA VIDA** (ver "Nota sobre branding in-game" abaixo).

## Concept

**TÊNIS DA VIDA** é um jogo de tênis arcade retrô, estética 8-bit/16-bit, em que o jogador controla **Leo (P1)** contra **Alice (P2)**, controlada pela CPU. O núcleo do jogo é um **rally real**: a bola de fato viaja entre os dois jogadores, com física em arco, e o jogador influencia timing e direção de cada rebatida — nunca uma animação pré-programada.

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

**Character sheet definitivo recebido** (`docs/reference/leo-sheet.png` — salvar a imagem original aqui). Substitui a referência inicial como fonte de verdade visual de Leo.

Permanente, não deve ser alterada arbitrariamente em nenhuma animação:

- Homem jovem adulto, cabelo castanho curto e levemente volumoso/desarrumado
- Barba curta
- Rosto amigável, expressão confiante/alegre ("Foco, evolução e diversão sempre!")
- Camiseta preta com pequeno logo verde circular no peito
- Shorts brancos
- Tênis azul com detalhes claros
- Raquete vermelha/preta
- Altura de sprite de referência: **~32px**
- Proporções humanas (não chibi/cabeça-grande)

**Paleta oficial (hex)**: `#2B2B2B` (contorno/cinza escuro), `#FFFFFF` (branco), `#1E90FF` (azul — tênis), `#D32F2F` (vermelho — raquete), `#F4C38B` (pele), `#8B5E3C` (cabelo), `#1B1B1B` (preto — camiseta), `#50C87B` (verde — logo).

**Frames de animação já definidos no character sheet**: IDLE, RUN (esquerda), RUN (direita), PREPARE, FOREHAND, BACKHAND, SMASH, MISS, CELEBRAÇÃO — exatamente o conjunto listado na seção Architecture/assets abaixo. Vista traseira também definida (3 poses), disponível se a câmera precisar de ângulo alternativo no futuro.

Não é mais necessário pedir foto real adicional de Leo — o character sheet fornecido é suficientemente detalhado (paleta exata, expressões, proporção, todos os frames-chave) para servir de base direta da Fase 6.

## Alice (P2) — Identidade Visual

**Character sheet definitivo recebido** (`docs/reference/alice-sheet.png` — salvar a imagem original aqui). Substitui a referência inicial como fonte de verdade visual de Alice.

Permanente. **Nunca usar o nome "Julia"** — sempre **ALICE / Alice / P2 / CPU** (o character sheet e o mockup de gameplay mais recentes já usam "ALICE" corretamente).

- Mulher jovem adulta, cabelo castanho longo e ondulado, solto (característica mais marcante)
- Rosto amigável, expressão alegre e competitiva ("Mais jogos, mais histórias!")
- Camiseta rosa com pequeno logo de coração no peito
- Parte inferior branca (shorts/saia)
- Tênis rosa
- Raquete azul/rosa
- Altura de sprite de referência: **~32px** (mesma escala de Leo)
- Proporções humanas

**Paleta oficial (hex)**: `#3B2A20` (cabelo, tom escuro), `#FADBD8` (pele), `#FF69B4` (rosa — camiseta/tênis), `#E5E5E5` (branco/cinza claro — parte inferior), `#C2185B` (rosa escuro/magenta — detalhes), `#8B5E3C` (cabelo, tom claro), `#1E90FF` (azul — raquete), `#FFD34D` (amarelo/dourado — acessório/brinco).

**Frames de animação já definidos no character sheet**: IDLE, RUN (esquerda), RUN (direita), PREPARE, FOREHAND, BACKHAND, SMASH, MISS, CELEBRAÇÃO — mesmo conjunto de Leo. Vista traseira também definida.

Não é mais necessário pedir foto real adicional de Alice — o character sheet fornecido cobre paleta, expressões, proporção e todos os frames-chave.

## Assets recebidos (no disco)

Além dos character sheets iniciais, o usuário forneceu um pacote grande de arte pixel-art profissional em `public/assets/`. Status de integração de cada item:

**Em uso real no jogo:**
- `public/assets/characters/leo/leo-forehand.png` — Leo em pose de forehand/preparação, fundo transparente. Usado em `GameCanvas.tsx` via `drawImage`.
- `public/assets/characters/alice/alice-backhand.png` — Alice em pose de backhand/preparação, fundo transparente. Usado em `GameCanvas.tsx`.
- `public/assets/court/COURT 1.png` (1536×1024) — cenário completo (céu, skyline, torcida, quadros publicitários, cadeira de juiz). Usa câmera tradicional atrás-da-linha-de-fundo, incompatível com o modelo de câmera lateral (rede vertical) do engine já testado. **Resolvido via composição**: apenas a faixa superior de "atmosfera" (y=0 a y=515 dos 1024px, ou seja `BACKDROP_SOURCE_HEIGHT` em `GameCanvas.tsx`) é desenhada como pano de fundo estático; a quadra em si (grama, saibro, rede vertical) continua sendo desenhada programaticamente por baixo, preservando o sistema de coordenadas documentado em "Technical Design".
- `public/assets/menu/menu.png` (1536×1024) — tela de menu principal completa, com botões "JOGAR / CONFIGURAÇÕES / EXTRAS / SAIR" já desenhados na própria arte. Usado em `MainMenu.tsx`.
- `public/assets/menu/vitoria.png`, `public/assets/menu/derrota.png` (1536×1024 cada) — telas de fim de partida completas, com botões "JOGAR NOVAMENTE"/"TENTAR NOVAMENTE", "VER ESTATÍSTICAS" e "VOLTAR AO MENU" já desenhados na arte, mais estatísticas de partida (tempo, pontos, aces, erros, aproveitamento) e uma frase pessoal. Usado em `GameOverScreen.tsx`.
  - **Padrão importante para essas 3 telas**: como os botões já existem desenhados na própria imagem (pixel-art, com ícone e texto), os `<button>` do React são **overlays invisíveis** (`bg-white/0`, sem texto/borda visível, só `aria-label` + hit-area + destaque sutil de hover/focus) posicionados via coordenadas percentuais medidas diretamente do PNG (análise de pixel para achar a caixa exata de cada botão). Desenhar um segundo botão visualmente estilizado por cima causaria duplicação visual (foi um bug real, corrigido nesta sessão). Se qualquer uma dessas 3 imagens for regerada/trocada no futuro, essas coordenadas percentuais precisam ser recalculadas.
  - "CONFIGURAÇÕES", "EXTRAS", "SAIR" (menu) e "VER ESTATÍSTICAS" (vitória/derrota) estão desenhados na arte mas **não têm feature real por trás no V1** — ficam decorativos até que configurações/extras/estatísticas sejam implementados de verdade.

**Recebidos, ainda não integrados** (deferred — ver `docs/PROGRESS.md` para prioridade):
- `public/assets/characters/leo/leo sprite sheet.png`, `public/assets/characters/alice/ALICE SPRITE SHEET.png` — sheets de animação completos (IDLE, RUN, PREPARE, FOREHAND, BACKHAND, SMASH, MISS, CELEBRAÇÃO). Fundo transparente. **Não fatiados ainda**: tentativa de detecção automática de frames via análise de canal alpha funcionou para separar grupos de animação (linhas), mas não frames individuais dentro de um grupo (ficam próximos demais, o heurístico funde tudo em um blob). Fatiamento preciso fica para uma sessão futura dedicada — não fazer isso às pressas para não gerar recortes errados.
- `public/assets/characters/JUIZ/juiz.png` — sheet do juiz de cadeira. Não usado (o juiz já aparece embutido no backdrop do `COURT 1.png`).
- `public/assets/characters/torcida/torcida sprite sheet.png` — sheet da torcida. Não usado (torcida já embutida no backdrop do `COURT 1.png`).
- `public/assets/ball/bola.png` — sheet de VFX da bola. **Sem canal alpha** (fundo totalmente opaco, confirmado via script Python — `alpha.min()==alpha.max()==255`), então não dá pra fatiar por bounding-box de transparência como os personagens; precisaria de recorte manual/por cor. A bola atual no jogo é um círculo amarelo desenhado via Canvas (`drawBall` em `GameCanvas.tsx`), não um sprite.
- `public/assets/court/COURT 2.jpg` — vista aérea/top-down da quadra. Não usado (câmera do jogo é lateral, não top-down).
- `public/assets/efeitos/efeitos sprite sheet.png` — banners de VFX (PERFECT!/GOOD!/LATE!/MISS!/POINT!/GAME!/SET!/MATCH!). Não usado — o feedback de qualidade de hit hoje só aparece como texto no HUD (`Último golpe: perfect`), não como banner animado.
- `public/assets/HUD/SPRITE SHEET INTERFACE.png` — kit de UI completo (painéis, ícones, corações). Não usado — o HUD atual (`components/HUD.tsx`) é funcional mas em Tailwind puro, sem essa estética pixel-art ainda.
- `docs/reference/leo-sheet.png`, `docs/reference/alice-sheet.png` — character sheets de referência (paleta, expressões, proporção). Documentação apenas.
- `docs/reference/gameplay-reference-v1-julia.png`, `docs/reference/gameplay-reference-v2-alice.png` — mockups de composição originais. Documentação apenas.

**⚠️ Atenção antes de qualquer publicação pública (GitHub, deploy, etc.)**: a arte gerada (`COURT 1.png`, `menu.png`, `vitoria.png`, `derrota.png`) contém marcas registradas reais desenhadas no cenário — logo da Lacoste (jacaré) nos quadros publicitários e na camiseta de Leo, marca "HEAD" na bolsa de tênis, e sinalização/uniforme "AO" (Australian Open) na quadra. Isso **ainda não foi resolvido nem removido** — é uma decisão que precisa ser tomada com o usuário (recriar essas artes sem as marcas, ou aceitar o risco) antes de tornar o repositório público, conforme a regra de "não publicar sem revisão" já em vigor no projeto.

## Nota sobre branding in-game

O nome oficial do jogo é **TÊNIS DA VIDA**. A decisão passou por uma reversão: inicialmente o usuário havia confirmado "TENNIS CHALLENGE" como nome oficial (tratando "TÊNIS DA VIDA" como só uma frase de mockup). Depois, com a chegada das telas reais de menu/vitória/derrota — todas com a marca "TÊNIS DA VIDA" desenhada de forma proeminente e definitiva, acompanhada de frases pessoais como "Disciplina hoje. Grandes conquistas amanhã.", "Foco / Evolução / Amizade / Liberdade" e "Mesmo jogo, versões melhores de você." — ficou claro que essa arte tem significado pessoal genuíno (ela retrata Leo e Alice sentados juntos ao entardecer). O usuário confirmou explicitamente a reversão: **TÊNIS DA VIDA é o nome final**. `MainMenu.tsx` e `GameOverScreen.tsx` já usam a arte real com esse nome.

## Decisões de Game Design (confirmadas com o usuário)

| Decisão | Escolha | Por quê |
|---|---|---|
| Nome do jogo | **TÊNIS DA VIDA** | Decisão revertida nesta sessão: confirmado inicialmente como "Tennis Challenge", depois revertido para "Tênis da Vida" ao chegar a arte real (menu/vitória/derrota) com esse nome e significado pessoal claro. Ver "Nota sobre branding in-game". |
| Corações no HUD (♥♥♥ / ♡♡♡) | **Sets vencidos** | Cada coração = um set ganho na partida. Distinto de GAMES (games no set atual) e POINTS (pontos no game atual). |
| Controle da bola | **Timing + mira lateral** | Timing (Perfect/Good/Late) determina qualidade/velocidade do golpe; segurar A/D no momento do hit influencia a direção lateral da bola. Mais profundidade tática do que só timing. |
| Saque | **Jogável para o Leo, automático para a Alice** | Decisão revertida na Etapa 5 (ver `docs/PROGRESS.md`): a linha original ("automático no V1, jogável fica pro V2/Serve Challenge") foi substituída por um saque real — Leo saca com SPACE (toss + janela de contato com timing PERFECT/GOOD/MISS, A/D mira a direção), a Alice saca automaticamente e deterministicamente (sem teclado, sem aleatoriedade). Ambos usam a física de bola já existente — nenhuma física/scoring paralelo foi criado. |
| Fidelidade de personagens | **Resolvida — character sheets recebidos** | Paleta hex exata, proporção (32px), e todos os frames de animação já fornecidos para Leo e Alice (ver seções acima). Não bloqueia a implementação — placeholders primeiro (Fases 1-5), arte definitiva usa esses sheets diretamente na Fase 6. |

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
    page.tsx                # entrada — máquina de estado menu → playing → gameover
  components/
    GameCanvas.tsx           # <canvas> + ligação com o game engine (useEffect + rAF)
    MainMenu.tsx             # tela de menu com arte real (public/assets/menu/menu.png)
    GameOverScreen.tsx        # tela de vitória/derrota com arte real (vitoria.png / derrota.png)
    HUD.tsx                  # overlay React lendo snapshots do engine (visual funcional, não definitivo)
  game/
    engine/                  # game loop, orquestração, snapshot de estado pra UI
    physics/                 # trajetória, arco, bounce, velocidade
    collision/                # alcance do jogador, cruzamento de rede, fora da quadra
    player/                   # estado/movimento de Leo
    cpu/                      # IA de Alice (previsão, alvo, decisão)
    scoring/                  # 0/15/30/40/game/set/match
    difficulty/               # parâmetros centralizados por dificuldade
    input/                    # teclado, normalizado
    types/                    # tipos compartilhados (Vector3, BallState, GameSnapshot, ...)
  public/assets/              # Next.js só serve estático a partir de public/ — ver "Assets recebidos"
    characters/leo/, alice/, JUIZ/, torcida/
    ball/
    court/
    menu/
    HUD/
    efeitos/
  docs/
    GAME_DESIGN.md            # este arquivo
    PROGRESS.md               # estado de implementação, para continuidade entre sessões
    reference/                # character sheets e mockups de gameplay originais
  tests/
    unit/                     # physics, collision, hit quality, scoring, CPU, game state
```

Regra dura: nenhum arquivo mistura renderização + física + regras + UI. `game/` nunca importa React; `components/` nunca calcula física ou regra de pontuação, só lê o snapshot do engine e chama seus métodos públicos (`update`, `getSnapshot`) — a partir da Etapa 5, o saque (toss, janela de contato, saque automático da Alice) é orquestrado inteiramente dentro do próprio `GameEngine.update()`, sem expor um método `serve()` público separado.

## Roadmap (V2+)

- Time Attack.
- Seleção de personagens.
- Arte definitiva de Leo/Alice com fidelidade às fotos reais fornecidas.

## Perguntas ainda pendentes

Nenhuma decisão de arquitetura/gameplay pendente. Um único ponto não-bloqueante precisa de decisão do usuário antes de publicação pública: o que fazer com as marcas registradas reais presentes na arte gerada (ver "⚠️ Atenção antes de qualquer publicação pública" na seção "Assets recebidos").
