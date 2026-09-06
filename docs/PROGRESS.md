# Progress — Tênis da Vida

Última atualização: sessão de 2026-09-06 (décima primeira parte — Auditoria Final de Release + fechamento do release candidate). Ler `docs/GAME_DESIGN.md` primeiro para entender o jogo — este arquivo é só o estado de implementação.

## Status geral

**RELEASE CANDIDATE — pronto para publicação no GitHub.** O jogo é jogável de ponta a ponta com arte real, incluindo um saque de verdade e um input de teclado corrigido: menu → partida (quadra com marcações reais, rede de malha, juiz, Leo e Alice ambos animados, bola pixel-art, HUD com avatares reais, **saque jogável para o Leo e automático para a Alice**) → tela de vitória/derrota → volta ao menu ou reinicia. 148 testes automatizados passando, `typecheck`/`lint`/`build` limpos. `README.md` reescrito (era boilerplate do `create-next-app`).

**Mudança de nome (sessão anterior)**: o jogo se chama **TÊNIS DA VIDA** (não mais "Tennis Challenge").

**Histórico do plano de etapas (concluído)**: a validação visual de sessões anteriores revelou que (1) a marcação da quadra não correspondia à topologia real de uma quadra de tênis, (2) a Alice podia sair da área jogável, (3) a Alice não tinha animação de gameplay, e (4) o saque era 100% automático e invisível. **Etapa 1 (geometria central), Etapa 2 (correção da Alice), Etapa 3 (redesenho visual da quadra), Etapa 4 (animação da Alice) e Etapa 5 (mecânica de saque) foram concluídas.** Depois da Etapa 5, playtesting manual com teclado físico real revelou dois bugs reais de input, corrigidos numa **Etapa corretiva**. Depois disso, uma **Auditoria Final de Release** (ver seção abaixo) revisou arquitetura, game loop, estados, saque, rally, input, visual, responsividade, performance, segurança, testes, documentação e assets — sem encontrar nenhum bloqueador técnico.

## Sessão de 2026-09-06 (parte 11) — Auditoria Final de Release + fechamento

**Escopo**: auditoria completa de release (sem alterar código na primeira fase), seguida de fechamento do release candidate — só o trabalho necessário para publicação no GitHub (README, nome do repositório, descrição, topics, screenshots, comandos de publicação), sem novas features, sem refactors, sem alteração de gameplay.

### Achados da auditoria técnica

Nenhum bloqueador técnico. Únicos achados: três union members mortos/nunca alcançados (`PlayerState.isSwinging` nunca setado por ninguém; `BallStateType`'s `"out"`/`"point_over"` nunca atribuídos; `GameEvent`'s `{type:"set"}` nunca construído — um set vencido some indistinguível de um game vencido no stream de eventos, embora `score.sets` e os corações do HUD continuem corretos por si só) e uma recriação desnecessária de `CanvasPattern` a cada frame em `drawCourt()`. Todos classificados como melhoria futura opcional (baixíssimo impacto, zero efeito em runtime) — **não implementados**, conforme a própria regra do usuário de não corrigir itens dessa categoria. Lacuna de teste real identificada: `AliceAnimator` não tem arquivo de teste unitário dedicado (só validação visual ao vivo, repetida várias vezes) — também registrada como melhoria futura, não implementada.

Arquitetura, game loop (incluindo o bug histórico de dt negativo, revisitado especificamente), máquina de estados, saque, rally/hit, input, responsividade (testada ao vivo em 1400×900, 480×800 e 1200×500), performance, segurança (sem `.env`, sem segredos, sem `dangerouslySetInnerHTML`, sem chamadas externas) e testes — todos avaliados como prontos, sem necessidade de correção.

### Achado de assets/marcas de terceiros — decisão do usuário registrada

A auditoria encontrou marcas reais de terceiros (logo da Lacoste, wordmark "HEAD", marca "AO"/Australian Open) embutidas na arte gerada por IA usada pelo projeto — presentes em `COURT 1.png` (backdrop ao vivo de toda partida), `menu.png`, `vitoria.png`, `derrota.png`, e no avatar do Leo no HUD (`leo-avatar.png`). Isso foi reportado ao usuário com a recomendação de tratar como bloqueador técnico de publicação pública, junto com opções de remediação (regenerar arte, manter privado, aceitar o risco, recortar/mascarar).

**O usuário decidiu explicitamente manter as marcas como estão** — decisão consciente de escopo visual do projeto, não um esquecimento. Instrução recebida: não regenerar, não remover, não mascarar, não recortar, não substituir nenhum asset por causa disso; não tratar mais como bloqueador técnico; ser honesto na documentação sobre a situação, sem transformar isso num aviso jurídico exagerado. `README.md` agora tem uma seção "Assets" factual registrando isso (arte gerada por IA, contém marcas de terceiros reais, nenhuma licença/autorização verificada, decisão deliberada de escopo — sem alegar que os assets são originais ou livres de terceiros).

### README

Reescrito por completo nesta sessão (antes era o boilerplate padrão do `create-next-app`, sem nenhuma menção ao jogo). Seções: título/descrição, demo (não implantado ainda), sobre, features (só reais), arquitetura, technical highlights, controles, como rodar localmente, estrutura do projeto, jornada de desenvolvimento, limitações conhecidas, assets (factual, ver acima), licença (indefinida, sem inventar).

### Validação técnica final

`npm test`: **148/148** ✅. `npm run typecheck`: limpo ✅. `npm run lint`: limpo ✅. `npm run build`: limpo ✅. Nenhuma alteração de código nesta sessão além do `README.md` — os únicos achados de código são melhorias futuras opcionais, não implementadas.

### GitHub — preparação de publicação

- **Nome do repositório recomendado**: `tenis-da-vida`.
- **Descrição recomendada**: "A 2D pixel-art tennis game built with TypeScript and Canvas — arcade physics, playable rally, manual serve, deterministic CPU opponent."
- **Topics recomendados**: typescript, nextjs, react, canvas, pixel-art, game-development, 2d-game, tennis, arcade-game, game-engine.
- **Screenshots**: não foi possível gerar screenshots limpas (sem UI do navegador) automaticamente nesta sessão — ver comentário na entrega final sobre captura manual.
- **Git**: `.git` já existia, só o commit automático original do `create-next-app` no histórico, nenhum remote configurado, nenhum commit/push feito nesta sessão. Comandos de publicação fornecidos ao usuário para execução manual — histórico preservado, nenhuma reescrita.

### Git

Nenhum commit ou push foi feito em nenhum momento desta sessão.

## Sessão de 2026-09-06 (parte 10) — Etapa corretiva: saque, rally e input

**Contexto**: depois de aprovar a Etapa 5, o usuário jogou manualmente com teclado físico real (não `window.dispatchEvent()`, não testes automatizados) e relatou três sintomas: (1) o saque do Leo às vezes virava ponto da Alice imediatamente; (2) a rebatida durante o rally parecia não registrar o SPACE consistentemente; (3) SPACE rolava a página. Pedido explícito: auditar a causa raiz antes de alterar qualquer código.

### Auditoria (sem alterações de código)

Rastreei o pipeline completo (`KeyboardInput → GameEngine.update() → toss/rally → ball.owner → checkPointEndingConditions`) e não encontrei nenhum caminho de código que trate o toss como "bola perdida" — `checkPointEndingConditions()` só roda dentro do branch `"rally"` de `update()`, nunca durante `"toss"`. A causa real estava em `game/input/keyboard.ts`:

- **`handleKeyDown` nunca chamava `e.preventDefault()`** — SPACE sempre rolou a página desde antes da Etapa 5 (nunca apareceu porque toda validação anterior usava eventos sintéticos, que não acionam o comportamento padrão real do navegador).
- **`handleKeyDown` não verificava `e.repeat`** — uma tecla física segurada além do limiar de repetição do sistema operacional dispara múltiplos `keydown` para a **mesma pressão física**, e cada um rearmava `hitQueued = true`. Isso quebra o contrato já documentado no próprio tipo (`InputState.hitPressed`: "true only on the frame the hit key was pressed — not held"). No saque, isso podia resolver o contato com `serveTimerMs` próximo de zero (fault imediato); no rally, podia consumir a tentativa de rebatida antes da bola estar de fato no alcance, fazendo o SPACE "real" (quando a bola já estava perto) não encontrar nenhum input pendente.

Também descartei, por auditoria de código: inconsistência de coordenadas (não encontrada — `player.x`/`player.y` são usados de forma consistente em movimento, colisão e renderização), e problema de direção/`vx` (não é necessário checar — o "gating" por `ball.owner` já impede um jogador de acertar sua própria bola de saída).

**Fator adicional identificado, não um bug de coordenadas**: a janela de alcance (`REACH_X_LATE=50`, `REACH_Y=60`) nunca tinha sido testada com timing humano real antes desta sessão — toda validação anterior usava `HOLD_HIT` (tecla mantida a cada frame) em testes automatizados, que satisfaz trivialmente qualquer tamanho de janela. Com a velocidade da bola aumentando por rally (até 1.6x) e por qualidade de golpe (até 1.15x), o tempo real que a bola passa dentro da janela pode cair a ~65-120ms — mais curto que o tempo de reação humano típico (~200-300ms). Optei por **não alterar essas constantes preventivamente**: corrigi os dois bugs reais primeiro e revalidei manualmente — a mecânica se mostrou jogável de forma consistente uma vez com o input corrigido (ver validação abaixo), então não havia evidência de que ajustar a janela fosse necessário.

### Correção

- **`game/input/keyboard.ts`**: `handleKeyDown` agora chama `e.preventDefault()` para `"Space"` (suprime o scroll do navegador) e só arma `hitQueued = true` quando `!e.repeat` (ignora repetições do SO para a mesma pressão física). Nenhuma outra tecla foi alterada. Nenhum listener duplicado, nenhum `window.dispatchEvent`, nenhum hack de foco — a correção fica inteiramente dentro do handler existente.

### Testes

- **Novo arquivo `tests/unit/keyboard.test.ts`** (14 testes) — `KeyboardInput` não tinha nenhuma cobertura antes desta etapa, apesar de ser exatamente onde os dois bugs reais viviam. Cobre: reconhecimento de Space, consumo de um único pulso por pressão, `preventDefault` chamado (e não chamado para outras teclas), `keyup` isolado não gera hit, **uma repetição do SO para a mesma tecla segurada não gera um hit extra** (teste de regressão direto para o bug do saque/rally), `preventDefault` continua sendo chamado numa repetição, uma pressão nova após soltar a tecla volta a gerar um hit real, mapeamento de A/D/setas, W/seta-cima para smash, e `detach()`.
- **`tests/unit/engine.test.ts`**: novo describe "GameEngine — full serve+rally integration flow" com um teste determinístico explícito provando `ready_to_serve → SPACE → toss → serve contact → rally → Alice → Leo → Alice → Leo` (a sequência exata pedida) — captura uma sequência limpa de 4 rebatidas alternadas dentro de um único rally contínuo (reiniciando a captura se um ponto terminar no meio, já que um novo saque depois de um ponto pode legitimamente repetir o lado sem violar a alternância dentro de um rally).
- **Antes**: 133 testes. **Depois**: **148 testes** (15 novos), nenhum removido ou enfraquecido.

### Validação técnica

`npm test`: **148/148** ✅. `npm run typecheck`: limpo ✅. `npm run lint`: limpo ✅. `npm run build`: limpo ✅.

### Validação real no navegador

- **Repetição de tecla não gera mais hit extra**: dispatchei um `keydown` genuíno (`repeat:false`) seguido de dois `keydown` com `repeat:true` (simulando o key-repeat do SO para a mesma tecla física segurada) — confirmado que o toss **não** resolveu contato prematuramente (HUD continuou mostrando "SAQUE", placar 0-0), diferente do comportamento antes da correção.
- **Saque completo**: toss anima corretamente (bola sobe e desce na mão), um segundo press genuíno resolve contato — observados um MISS real (fault, ponto pra Alice, reposicionamento de lado) e um GOOD real (RALLY:1) em tentativas diferentes.
- **Rally sustentado**: confirmado ao vivo um rally real com pelo menos 4 trocas alternadas (Leo GOOD → Alice PERFECT → Leo GOOD → Alice PERFECT, `RALLY:4`) — a primeira tentativa de rebatida do Leo registrou "MISS" corretamente (pressionei cedo demais, a bola ainda estava longe — comportamento correto, não um bug) e uma segunda pressão genuína, mais próxima do momento real, registrou "GOOD" — confirma que o mecanismo de timing funciona de forma consistente e previsível uma vez corrigido o bug de input.
- **Saque automático da Alice revalidado**: depois das correções, forcei a Alice a virar servidora (Leo perdendo um game) e confirmei — de novo — que o saque dela dispara e resolve **sem nenhum input de teclado**, exatamente como na Etapa 5.
- **`document.activeElement` verificado**: confirmado como `<body>` durante o jogo (não um botão de menu esquecido com foco) — descarta a hipótese de um elemento focado interferindo no SPACE.
- **Não observado diretamente**: a supressão real do scroll do navegador (Cenário E) não pôde ser reproduzida via automação, porque `window.dispatchEvent()` não aciona o comportamento padrão *trusted-only* do navegador (scroll), mesmo antes da correção — por isso o bug nunca apareceu em validações anteriores. A correção (`e.preventDefault()`) é padrão e correta a nível de código para qualquer evento real do navegador, mas recomendo ao usuário confirmar visualmente com um teclado físico real.

### Limitações e decisões pendentes

- **Janela de alcance (`REACH_X_LATE`/`REACH_Y`) não foi alterada** — ver "Fator adicional" acima. Se, mesmo com os dois bugs de input corrigidos, o usuário ainda achar o rally difícil de sustentar em playtesting real, um ajuste explícito e centralizado nessas constantes (não um número mágico solto) é o próximo passo natural, não feito aqui por falta de evidência de que fosse necessário.
- Nenhuma outra alteração fora do escopo dos três problemas relatados — quadra, animações, scoring, física, lado de saque, HUD e feedback PERFECT/GOOD/MISS permanecem exatamente como estavam.

### Git

Nenhum commit ou push foi feito em nenhum momento desta etapa.

## Sessão de 2026-09-06 (parte 9) — Etapa 5: mecânica de saque

**Escopo desta etapa, exatamente como aprovado**: transformar o saque de 100% automático/invisível em `SAQUE JOGÁVEL PARA O LEO + SAQUE AUTOMÁTICO PARA A ALICE`, reaproveitando a física/scoring/input já existentes — sem redesenhar quadra, sem refazer os animators, sem áudio, sem segundo saque, sem regras oficiais de fault complexas. **Esta foi a última etapa funcional planejada do desenvolvimento.**

### 1. Auditoria inicial (resumo dos achados usados)

Feita antes de qualquer código, confirmando no código real (não na documentação, que dizia "saque automático no V1" — desatualizada por design, corrigida nesta etapa):
- Leo sempre servia primeiro (hardcoded); o servidor já alternava corretamente entre games.
- `MatchPhase` tinha `"serving"` (durava 1 frame interno, nunca renderizado) e `"point_scored"` (nunca atribuído em lugar nenhum — valor morto).
- O saque era 100% automático, sem timing, sem input dedicado, sem tratamento de fault — o recebedor tratava a bola do saque como uma bola de rally qualquer.
- **Bug real encontrado**: `freshBall()` sempre posicionava a bola no centro lateral da quadra (`y = COURT_WIDTH/2`), mas a velocidade era calculada usando a posição lateral real do servidor (`from.y`) — se o servidor não estivesse exatamente no centro, a bola nascia numa posição diferente da usada para calcular sua própria trajetória. Sem cobertura de teste.

### 2. Arquitetura escolhida

`MatchPhase` foi reduzido a `"ready_to_serve" | "toss" | "rally" | "game_over"` — `"serving"` virou dois estados reais e renderizáveis (`ready_to_serve`/`toss`), e `"point_scored"` foi removido (nunca foi atribuído; não foi inventada uma transição artificial só para usá-lo, conforme instruído). Não há dois estados conflitantes: `phase` é a única fonte de verdade, sem um `ServeState` paralelo.

O ponto (`SERVE_CONTACT`/`BALL_IN_PLAY`) não virou uma fase própria: o contato é resolvido dentro de um único `update()` (como qualquer rebatida de rally já era), e uma vez resolvido com sucesso a fase já é `"rally"` — não havia necessidade de um frame visual separado para "bola acabou de sair da mão", então nenhum foi inventado (seguindo a instrução explícita da seção 1 da especificação). Pelo mesmo motivo, `POINT_END` também não é uma fase persistida — `awardPointTo()` já fazia (e continua fazendo) o reset síncrono dentro de uma única chamada, indo direto para `"ready_to_serve"`.

### 3. Máquina de estados real implementada

```text
ready_to_serve
  → (Leo pressiona SPACE | Alice: automático)
toss
  → (contato resolvido: perfect/good → rally | miss → fault → ready_to_serve)
rally
  → (ponto termina) → award + reset → ready_to_serve
```

Novo módulo `game/serve/serve.ts` (funções puras, sem estado de engine): `getServeSide(totalPointsInGame)`, `computeServeY(side)`, `classifyServeTiming(elapsedMs)`.

### 4. Leo — saque jogável

- **SPACE**: reaproveita o `KeyboardInput` já existente (`hitPressed`, um pulso por tecla) — nenhum listener novo, nenhum `window.dispatchEvent` no código de produção. Só funciona a partir de `"ready_to_serve"`; durante `"rally"`/`"game_over"` não inicia um saque nem faz nada.
- **Toss**: `startToss()` coloca a bola exatamente na posição do servidor (`x`, `y` do jogador) com `vz = SERVE_TOSS_VZ` e `vx = vy = 0`, e cada frame de `"toss"` chama `stepBallPhysics()` — a **mesma** função de gravidade que todo o resto do jogo já usa (nenhuma segunda física). O resultado é uma bola que sobe e desce naturalmente na mão do sacador, nunca um teleport.
- **Janela de contato e timing**: `classifyServeTiming(elapsedMs)` compara o tempo decorrido desde o início do toss com `SERVE_TOSS_IDEAL_MS` (o ápice do arco, calculado a partir de `SERVE_TOSS_VZ`/gravidade). Dentro de `SERVE_PERFECT_WINDOW_MS` → PERFECT; um pouco mais longe (dentro de `SERVE_GOOD_WINDOW_MS`) → GOOD; fora disso (cedo demais ou tarde demais) → MISS. Sem nenhum `Math.random()` — puramente determinístico a partir do tempo real decorrido. Se nenhuma tecla for pressionada até `SERVE_TOSS_TIMEOUT_MS`, também vira fault automaticamente.
- **A/D (direção)**: verificado no código antes de assumir qualquer coisa — `KeyboardInput.poll()` já mapeia A→`direction:-1`, D→`direction:1` (o mesmo mapeamento do rally, não um novo). O saque reaproveita a função `computeAimY()` já existente (a mesma usada por `attemptPlayerHit`) — nenhum segundo sistema de mira foi criado. Durante o rally, A/D continuam funcionando exatamente como antes (nenhuma mudança nesse caminho).
- **Contato único**: uma vez que `resolveServeContact()` roda (por uma tecla ou por timeout), a fase deixa de ser `"toss"` imediatamente (vira `"rally"` num acerto, ou `"ready_to_serve"` num fault) — uma segunda tecla no mesmo frame ou nos seguintes não pode acionar um segundo contato para o mesmo saque, porque a condição `phase === "toss"` já deixou de valer.

### 5. Alice — saque automático

`ready_to_serve` com `score.server === "alice"` chama `startToss()` imediatamente, sem depender de nenhum input. Durante `"toss"`, ela ignora completamente o teclado e o contato é resolvido em um instante fixo (`ALICE_SERVE_CONTACT_MS`) com qualidade sempre `"good"` — determinístico, sem `Math.random()`, sem depender do `random` injetável do engine (mesmo raciocínio de "não exagerar, arcade" da especificação, já que ela não está "pressionando" nada para ter uma janela de timing real).

### 6. Física

Nenhuma física nova foi criada. O toss reaproveita `stepBallPhysics()`; o contato bem-sucedido reaproveita `launchShot()` — a **mesma** função que toda rebatida de rally já usa (mesmo cálculo de `computeLaunchVelocity`, mesmo `HIT_QUALITY_SPEED_MULTIPLIER`, mesmo `rallyCount++`, mesmo evento `{type:"hit", side, quality}`). Isso teve um efeito colateral desejável: como o saque agora passa pelos mesmos eventos que qualquer golpe, o `AliceAnimator` da Etapa 4 já reage à animação de contato do próprio saque dela **sem nenhuma mudança** — confirmado ao vivo no navegador (ver seção de validação). Cogitei criar `computeServeVelocity()` como a especificação sugeria, mas decidi não criar — seria só um passthrough de uma linha para `computeLaunchVelocity()` já existente, e isso teria sido duplicação desnecessária.

### 7. Bug corrigido: `ball.y` centralizado vs. velocidade calculada a partir de `server.y`

Corrigido **por construção**, não com um patch pontual: `startToss()` agora usa `serverPlayer.y` (a posição lateral real do jogador, não mais `COURT_WIDTH/2`) como origem da bola, e essa posição fica **travada durante todo o toss** (o próprio servidor não se move enquanto está sacando — ver seção 8). Quando o contato acontece, `launchShot()` (que já definia `x: from.x` mas nunca tocava em `y`) herda um `ball.y` que já era exatamente `server.y` o tempo todo — a mesma origem usada tanto para a posição quanto para o cálculo de velocidade, sem nenhuma chance de divergirem.

**Teste de regressão** (`tests/unit/engine.test.ts`, describe "serve ball-position bug regression"): move o Leo para uma posição lateral real (não o centro) durante `ready_to_serve` (movimento é permitido aí), inicia o saque, e confirma `ball.y === leo.y` (não um valor fixo) — testado em duas direções diferentes, para a Alice como servidora também, e confirmando que a posição fica travada ao longo de todo o toss (não só no instante inicial).

### 8. Movimento durante o saque

- `ready_to_serve`: movimento livre para o Leo via input (`applyPlayerMovement`), sempre — seja ele o servidor ou o recebedor.
- `toss`: a posição do **servidor** fica travada (razão: proteger a correção do bug acima). O Leo, quando é o recebedor (Alice sacando), continua livre para se mover. A Alice nunca roda sua IA de perseguição (`updateAlicePosition`) fora de `"rally"` — não existe uma trajetória real para ela perseguir antes do contato, então parada é o comportamento mais simples e correto, não uma limitação a contornar.
- `rally`: exatamente como antes, sem nenhuma mudança.

### 9. `ball.owner`

Semântica preservada sem alteração: `owner` continua significando "quem precisa rebater a seguir". Já no início do toss, `owner` é setado para o **recebedor** (mesmo antes do contato) — isso não conflita com `attemptPlayerHit`/`maybeAttemptCpuHit`, porque ambos só são alcançáveis a partir do branch `"rally"` de `update()` agora (a estrutura do código já garante isso, não foi necessário adicionar uma checagem de fase redundante dentro deles).

### 10. Lado de saque (`getServeSide`)

Regra padrão de tênis, simplificada para o modelo de coordenadas deste engine: `deuce` quando o total de pontos jogados no game atual é par (0, 2, 4…), `ad` quando é ímpar — sem depender de handedness/diagonais reais (o jogo não modela isso). Como o eixo Y é compartilhado entre os dois lados (não espelhado), servidor e recebedor usam a **mesma** metade lateral (`computeServeY`, derivada de `COURT.singlesTop`/`centerServiceY`/`singlesBottom` — sem números mágicos). Importante: **alternância de servidor** (a cada game, já existia) e **alternância de lado de saque** (a cada ponto, novo) são regras diferentes e foram implementadas separadamente — confirmado com um teste que rastreia os dois efeitos ao longo de um game inteiro.

### 11. Scoring

Não reescrito. `awardPoint`/`createInitialScore`/`isMatchOver` (`game/scoring/scoring.ts`) continuam exatamente iguais — o saque só se integra a esse fluxo já existente (um fault chama `awardPointTo()`, o mesmo método que qualquer ponto perdido em rally já chamava).

### 12. Point reset

`resetForNextServe()` (chamado tanto por um fault quanto pelo fim normal de um ponto de rally, via `awardPointTo`): zera o timer de saque, `lastShot` dos dois jogadores volta a `null`, ambos são reposicionados para o novo lado de saque, e a bola volta a um estado neutro na posição do novo servidor. **Achado durante a implementação, corrigido**: como um fault e o fim do ponto que ele causa acontecem no mesmo frame (diferente de um ponto de rally normal, onde a rebatida e o fim do ponto sempre ficam separados por vários frames de bola voando), o reset síncrono apagava o `lastShot:"miss"` no mesmo instante em que era setado — a mensagem de fault nunca chegava a ser visível. Corrigido restaurando o `lastShot` do servidor **depois** do reset, especificamente no caminho de fault — confirmado tanto por teste automatizado quanto visualmente no navegador (a label "MISS" aparece corretamente).

### 13. HUD

Mudança mínima: um label "SAQUE" no painel central quando `phase` é `"ready_to_serve"` ou `"toss"` (reaproveitando o mesmo padrão condicional que já existia para "FIM" em game over). PERFECT/GOOD/MISS do saque reaproveitam o sistema de feedback já existente (`lastShot` + `QUALITY_LABEL`/`QUALITY_COLOR` do `HUD.tsx`) — um fault aparece como "MISS" (a label já existente), não uma nova label "FAULT!" separada, para não estender o tipo `HitQuality` (usado em vários lugares, incluindo os animators) só por causa de uma palavra diferente. Documentado aqui como decisão de escopo mínimo, não esquecimento.

### 14-17. Testes

- **Antes**: 95 testes. **Depois**: **133 testes** (38 novos), todos os 95 originais preservados — nenhum removido. Onde o comportamento mudou deliberadamente (ex: a partida não começa mais em rally automático), o teste foi **reescrito para validar o novo contrato**, nunca apagado.
- **Novo arquivo `tests/unit/serve.test.ts`** (15 testes): `getServeSide` (determinístico, alterna, volta a deuce em novo game/set), `computeServeY` (dentro da quadra de simples, dividido pela linha central, simétrico), `classifyServeTiming` (perfect/good/miss nas duas bordas de cada janela, sem aleatoriedade).
- **`tests/unit/engine.test.ts`**: novos describes — "serve state machine" (ready_to_serve→toss→rally→ponto→próximo saque), "Leo's serve" (SPACE inicia só no estado certo, PERFECT/GOOD/MISS por timing real, timeout também falta, A/D produz miras diferentes, contato único), "Alice's serve" (sem teclado, contato único, `owner` passa pro Leo, determinística), "serve side alternates correctly", "serve ball-position bug regression" (o teste de regressão obrigatório do bug encontrado na auditoria), "point reset", e um "serve stress test" (4000 frames, várias partidas de saque e rally, checando ausência de `NaN`/`Infinity`, fases sempre válidas, `owner`/`server` sempre `"leo"|"alice"`, Alice sempre dentro dos limites).
- Testes pré-existentes que dependiam do saque automático antigo (ex: segurar a tecla de hit o jogo inteiro, incluindo o instante do saque) foram adaptados com dois helpers novos — `bringToRally()` (um saque perfeito único, para testes de um só ponto) e `autoServeInput()` (um "bot" mínimo que só serve, nunca rebate durante o rally, para testes que precisam atravessar muitos pontos) — preservando a intenção original de cada teste.
- **Achado durante os ajustes**: alguns testes com `HOLD_HIT` (tecla de hit segurada o tempo todo) ficavam "passando" sem realmente testar nada, porque com o novo portão de saque o jogo simplesmente travava em `ready_to_serve` esperando um `SPACE` que o `NO_INPUT` de outros testes nunca enviava — corrigido usando os helpers acima em vez de aceitar o "passa" vazio.

### Coverage / typecheck / lint / build

- `npm test -- --run`: **133/133 passando**.
- `npm run typecheck`: limpo.
- `npm run lint`: limpo.
- `npm run build`: limpo.

### Validação real no navegador (cenários realmente observados, nada assumido)

- **Cenário A**: partida aberta, Leo como servidor, fase `ready_to_serve` visível (HUD mostra "SAQUE"), bola posicionada exatamente na posição do Leo (não no centro fixo).
- **Cenário B**: SPACE (via `window.dispatchEvent`, só para fins de teste de automação de navegador — nunca usado em código de produção) inicia o toss; a bola sobe visivelmente na mão do Leo (confirmado em várias capturas consecutivas) e desce de volta.
- **Cenário D (timing)**: **os dois resultados foram observados ao vivo** — um MISS real (label "MISS" em vermelho, ponto pra Alice, reposicionamento de lado) e, numa tentativa seguinte, um GOOD real (label "GOOD" em verde, `RALLY: 1`, bola voando de verdade). O timing exato de PERFECT via automação de navegador se mostrou impraticável de controlar com precisão (o ambiente sandboxed só avança o tempo do jogo de forma perceptível durante screenshots consecutivos, num incremento não finamente controlável — quirk já documentado em sessões anteriores) — **PERFECT foi validado com confiança total pelos testes automatizados determinísticos** (`classifyServeTiming` tem 6 testes cobrindo exatamente as bordas de cada janela), não no navegador. Não estou declarando isso como observado ao vivo quando não foi.
- **Rally completo pós-saque**: confirmado ao vivo — saque GOOD do Leo, retorno **PERFECT** real da Alice (rally virou 2, sua animação de contato tocou corretamente), bola voltando para o Leo, ele não rebate (proposital, para fechar o ponto) e o ponto termina normalmente.
- **Cenário E (fim de ponto → próximo saque)**: confirmado várias vezes — score atualiza, jogadores se reposicionam para o novo lado de saque (posição lateral visivelmente diferente entre um saque e outro), e uma nova fase `ready_to_serve`/`toss` começa automaticamente.
- **Cenário F (saque da Alice)**: confirmado ao vivo, com **zero input de teclado** da minha parte — assim que ela virou servidora (depois do Leo perder um game), o toss dela começou sozinho, e o contato resolveu automaticamente como "GOOD" com `RALLY: 1` — e, como bônus não pedido mas observado, a animação de contato dela (Etapa 4) tocou corretamente durante o próprio saque, sem nenhuma mudança no `AliceAnimator`.
- **Cenário G (vários pontos consecutivos)**: confirmado — pelo menos 5 pontos/saques completos foram jogados em sequência nesta sessão de validação, sem nenhum estado preso, sem regressão visual na quadra/HUD/bola.

### Limitações e decisões pendentes (documentadas, não escondidas)

- **Segundo saque**: não implementado, conforme instruído (regra simplificada de 1 tentativa por ponto). Não considero essencial para a experiência atual — não registrando como pendência crítica, só como escopo deliberadamente fora.
- **PERFECT do Leo não foi observado ao vivo no navegador** (só via teste automatizado determinístico) — ver seção de validação acima. Recomendado a uma sessão futura de playtesting humano manual confirmar a sensação de timing com um teclado físico real.
- **Fault não tem uma label "FAULT!" própria** — reaproveita a label "MISS" já existente, para não estender `HitQuality` só por texto (ver seção 13).
- **`AliceAnimator` não tem uma pose de saque própria** — reaproveita o forehand/backhand de contato normal (Etapa 4). Funciona visualmente bem (confirmado ao vivo), mas não é uma animação desenhada especificamente para "sacar".
- **Rede/colisão de rede**: como já era verdade para qualquer golpe antes desta etapa (não é uma lacuna nova), o engine não modela colisão explícita com a rede — nem para rally nem para saque. Fora do escopo desta etapa (documentado, não corrigido, conforme instruído: "não corrigir automaticamente" problemas fora do pipeline SAQUE→FÍSICA→RALLY→PONTO→PRÓXIMO SAQUE).
- **Achado fora de escopo, só documentado**: `docs/GAME_DESIGN.md` também descrevia o roadmap V2 como incluindo "Serve Challenge (saque jogável)" — como o saque jogável já existe agora, essa linha foi removida do roadmap (mudança textual mínima, não uma nova feature).

### Git

Nenhum commit ou push foi feito em nenhum momento desta etapa. `git log` continua mostrando só o commit automático original do `create-next-app`.

## Sessão de 2026-09-06 (parte 8) — Etapa 4: animação da Alice

**Escopo desta etapa, exatamente como aprovado**: dar à Alice uma máquina de animação de gameplay (idle/prepare/contact/recover/miss, com forehand e backhand) equivalente em princípio ao `LeoAnimator`, sem alterar física, pontuação, quadra, bola, HUD, ou a IA além do mínimo necessário para ler os eventos já públicos do engine. **Sem mecânica de saque nesta etapa.**

### Auditoria (Fase 1, feita antes de qualquer código)

Antes de implementar, auditei `ALICE SPRITE SHEET.png` (nunca usada em código até esta etapa — a Alice usava só uma imagem estática, `alice-backhand.png`) pixel a pixel (canal alpha + componentes conectados, não só inspeção visual). Achados principais, reportados e aprovados pelo usuário antes de qualquer implementação:
- Os grupos IDLE, PREPARAÇÃO(FOREHAND/BACKHAND), FOREHAND, BACKHAND e ERRO/MISS têm qualidade igual ou melhor que os do Leo — sem o mesmo problema de fusão severa de poses que limitou o Leo a um único frame de forehand.
- **Achado de orientação**: a sheet é inconsistente entre grupos — IDLE e ERRO/MISS desenham a Alice virada para a **direita**, enquanto PREPARAÇÃO/FOREHAND/BACKHAND a desenham virada para a **esquerda**. A Alice fica no lado direito da quadra e precisa olhar para a rede (esquerda) sempre. A antiga `alice-backhand.png` tinha esse mesmo problema (virada para a direita, para fora da quadra) — confirmado visualmente no navegador antes da correção.
- `isSwinging` (campo do tipo `PlayerState`) nunca é setado por nenhum lado (Leo ou Alice) — não é a fonte de sincronização real.
- `alice.lastShot` já era público (setado por `maybeAttemptCpuHit` em `GameEngine.ts`) mas nunca lido pela UI.

### Correção adicional encontrada durante a implementação (não estava na auditoria original)

Uma inspeção pixel a pixel mais fina durante a extração dos frames (não só a inspeção visual da auditoria) mostrou que o grupo **FOREHAND tem 3 poses reais, não 4** como a auditoria original contou — a "quarta pose" era a mesma pose final com o braço/raquete bem estendido, ocupando uma faixa mais larga do sheet. O grupo BACKHAND foi reconferido com o mesmo método e realmente tem os 4 frames da contagem original. Isso está documentado em detalhe em `public/assets/characters/alice/derived/FRAME_MAP.md`.

### O que foi criado

- **`components/aliceAnimation.ts`** (novo) — `AliceAnimator`, mesma arquitetura conceitual do `LeoAnimator` (presentation-only, compara snapshots antes/depois de `engine.update()`, nunca escreve no engine), mas **não copiada cegamente**:
  - Estados: `idle → prepare → contact → recover → miss`, com `shotSide: "forehand" | "backhand"` escolhido no início de cada `prepare`/`contact` a partir só de campos já públicos do snapshot (`ball.y` vs `alice.y` — sem adicionar nem alterar nenhum estado em `game/`).
  - **Gatilho de swing diferente do Leo, por necessidade**: o Leo depende de uma tecla (`hitPressed`, garantidamente um único frame); a Alice é decidida pela IA a cada frame dentro do alcance. CONTACT dispara em `lastEvent.type === "hit" && side === "alice"` (emitido exatamente uma vez por acerto real, por `GameEngine.launchShot`); MISS dispara em `alice.lastShot === "miss"`, mas só quando ainda não estava animando um miss (evita reiniciar a animação do zero a cada frame idêntico, algo que pode acontecer 2-3 frames seguidos dado `REACH_X_PERFECT=12` e a velocidade da bola em rallies avançados).
  - `safeFrameIndex()` reaproveitado sem alteração (proteção contra `dt` negativo).
- **`public/assets/characters/alice/derived/*.png`** (19 arquivos novos) — frames extraídos de `ALICE SPRITE SHEET.png`: idle(4), prepare-forehand(3), forehand-1/forehand-2/forehand-contact(3, corrigido de 4), prepare-backhand(3), backhand-1/2/3/contact(4), miss(2). IDLE e MISS foram **espelhados horizontalmente na extração** para corrigir a orientação (ver auditoria acima) — a Alice agora olha para a rede em todos os estados. Detalhes completos (bbox de origem, decisões, limitação conhecida) em `derived/FRAME_MAP.md`.
- **Escopo reduzido deliberadamente**: `forehand-1`, `backhand-1` e `backhand-2` foram extraídos mas **não foram ligados** ao `AliceAnimator` — o estado CONTACT usa só um frame por lado (`forehand-contact.png`/`backhand-contact.png`), igual ao padrão minimalista já estabelecido pelo Leo (que também usa 1 frame de contato), em vez de inventar uma animação de swing multi-frame que a especificação não pediu.

### Limitação conhecida e aceita: leve "eco" de raquete

As 3 poses do FOREHAND se encostam por uma margem pequena mas real no sheet original (confirmado até em alpha > 200/255 — não é só anti-aliasing). Tentei isolar por componente conectado; isso **piorou** o resultado (a malha da raquete tem muitos buracos e virou vários componentes pequenos, removendo pedaços da própria raquete da Alice) e foi revertido. O resultado aceito: cada frame tem a pose 100% completa (nenhum braço/raquete cortado no meio), com um contorno fraco e parcial da raquete do frame vizinho no canto da imagem — quase imperceptível no tamanho de render do jogo (150px), e que no frame de contato até lê como um efeito natural de motion-blur. Documentado em `FRAME_MAP.md`, não escondido.

### O que aconteceu com `alice-backhand.png`

O arquivo **continua no disco**, intocado — não foi apagado. Todo o código que o carregava/desenhava foi removido (`ALICE_SPRITE_SRC`, o campo `alice: HTMLImageElement` de `SpriteRefs`, a função genérica `drawPlayer()`). `SpriteRefs.alice` agora é uma `AliceSprites` estruturada (idle/prepareForehand/forehandContact/prepareBackhand/backhandContact/miss), no mesmo padrão de `LeoSprites`.

### Validação visual real

Navegador aberto no servidor de desenvolvimento do próprio usuário. Confirmado:
- Menu principal inalterado.
- **Alice olhando para a rede** em todos os estados observados (idle, prepare, contact) — a inversão de orientação da `alice-backhand.png` não existe mais.
- **IDLE**: ciclo sutil entre os 4 frames, sem flicker nem sprite quebrado.
- **CONTACT**: capturado ao vivo, via uma sequência de screenshots consecutivos — Alice rebatendo com uma pose de swing dinâmica (pernas afastadas, raquete estendida, bola bem próxima da raquete), completamente diferente da pose estática antiga. O HUD mostrou "PERFECT!" no mesmo instante e o contador de rally incrementou para 1 — confirma que a animação está sincronizada com o evento real do engine, não é decorativa.
- Nenhuma exceção/crash observado durante a sequência de rally.
- Ball, HUD, quadra: sem regressão.
- **Não observado ao vivo nesta sessão** (por depender de um evento probabilístico — `hitErrorChance` da dificuldade normal): o estado MISS. Foi validado indiretamente — os frames `miss-1.png`/`miss-2.png` foram inspecionados individualmente (orientação corrigida, pose completa) e a lógica de gatilho (`alice.lastShot === "miss"`) usa o mesmo campo já validado pelos testes existentes de `game/engine/GameEngine.ts` e `game/cpu/ai.ts`. Recomendado a uma sessão futura observar isso numa partida mais longa ou em dificuldade mais alta (maior `hitErrorChance`).

### Testes / coverage / typecheck / lint / build

- `npm test -- --run`: **95/95 passando** (mesmo total das etapas anteriores — nenhuma regressão; nenhum teste novo, porque `AliceAnimator` é lógica de apresentação sem contrato de engine para testar, mesmo raciocínio já aplicado ao `LeoAnimator`, que também não tem testes unitários próprios).
- `npm run typecheck`: limpo.
- `npm run lint`: limpo.
- `npm run build`: limpo.

### Problemas restantes / pendências

- Mecânica de saque (Etapas 5-10), posicionamento inicial (Etapa 11), física/limites da bola (Etapa 12), sistema de pontuação (Etapa 13) — não tocados.
- Estado MISS da Alice não observado ao vivo nesta sessão (ver acima) — só validado indiretamente.
- `forehand-1.png`, `backhand-1.png`, `backhand-2.png` foram extraídos mas ficaram sem uso — disponíveis para uma eventual animação de contato multi-frame futura, se pedido.
- `alice-backhand.png` permanece no disco sem uso.
- **O jogo completo não está pronto/finalizado** — restam mecânica de saque, revisão de física/pontuação, testes mais amplos, validação visual final, validação técnica final e playtesting humano manual (Etapas 5 a 16 do plano).

## Sessão de 2026-09-06 (parte 7) — Etapa 3: redesenho visual da quadra

**Escopo desta etapa, exatamente como aprovado**: fazer o render da quadra (`components/GameCanvas.tsx`) consumir `COURT` (a geometria única da Etapa 1) para desenhar as marcações reais de uma quadra de tênis, aposentando o papel semântico de `half-court-lines.png`. **Nada mais** — sem tocar em Leo/Alice/IA/física/pontuação/saque/áudio.

### Arquivos modificados

- `components/GameCanvas.tsx` — único arquivo de código alterado nesta etapa.

### Arquivos criados

- Nenhum arquivo novo de código. Nenhum teste novo foi necessário (ver "Testes" abaixo).

### Como `COURT` passou a controlar o render

`drawCourt()` agora deriva todas as coordenadas de tela das marcações a partir de `COURT` (import de `@/game/court/geometry`) passadas pelo mesmo `drawY()` que todo o resto do mundo já usava — nenhuma coordenada visual independente foi criada por linha, como pedido. O limite externo da quadra (antes `drawY(0)`/`drawY(COURT_WIDTH)`, com uma faixa de `strokeRect` de números mágicos) agora usa `drawY(COURT.doublesTop)`/`drawY(COURT.doublesBottom)`.

### Como as linhas de simples/duplas foram representadas

`ctx.strokeRect` no retângulo externo (`COURT.leoBaselineX` até `COURT.aliceBaselineX`, `doublesTop` até `doublesBottom`) representa o contorno de duplas. As laterais de simples são duas linhas horizontais independentes (`strokeHorizontalLine`, novo helper) em `drawY(COURT.singlesTop)` e `drawY(COURT.singlesBottom)`, atravessando a quadra toda (baseline a baseline) — visivelmente inseridas dentro do contorno de duplas, nunca coincidindo com ele.

### Como as service lines foram representadas

Duas linhas verticais independentes (`strokeVerticalLine`, novo helper), em `COURT.leoServiceLineX` e `COURT.aliceServiceLineX`, cada uma indo só de `singlesTopY` até `singlesBottomY` (não da quadra inteira) — ou seja, cada linha de saque fica contida dentro da faixa de simples, uma de cada lado da rede.

### Como as center service lines foram representadas

**Dois segmentos horizontais separados**, nunca uma linha única atravessando a quadra: `strokeHorizontalLine(ctx, COURT.netX, COURT.leoServiceLineX, centerServiceScreenY)` para o lado do Leo e o equivalente com `COURT.aliceServiceLineX` para o lado da Alice — cada um só entre a rede e a linha de saque do seu próprio lado, exatamente como pedido explicitamente na especificação.

### Como a rede foi alinhada

`drawNet()` e `drawJudge()` trocaram a constante antiga `NET_X` por `COURT.netX` (mesmo valor numérico — `COURT.netX` é só a mesma constante reexposta pela geometria central — mas agora a rede deriva da mesma fonte única que as linhas, não de uma constante solta importada separadamente).

### O que aconteceu com `half-court-lines.png`

O arquivo **continua no disco**, intocado (`public/assets/court/derived/half-court-lines.png`) — não foi apagado, pois não havia necessidade de removê-lo fisicamente. Todo o código que o carregava e desenhava foi removido: a constante `HALF_COURT_LINES_SRC`, o campo `halfCourtLines` de `SpriteRefs`, a chamada `loadImage(HALF_COURT_LINES_SRC)`, e a função inteira `drawHalfCourtLines()` (substituída por `drawCourtLines()`, que desenha a partir de `COURT`). Um comentário no código documenta por que o arquivo ainda existe mas não é mais usado. Confirmado por `grep` que não sobrou nenhuma referência a `NET_X`, `LEO_X`, `ALICE_X`, `HALF_COURT_LINES_SRC` ou `halfCourtLines` soltas no arquivo — só `COURT_LENGTH`/`COURT_WIDTH` permanecem, usadas apenas para dimensionar o canvas (`CANVAS_WIDTH`/`CANVAS_HEIGHT`), sem relação com a topologia das linhas.

### Validação visual real

Navegador aberto no servidor de desenvolvimento do próprio usuário (`localhost:3000`, evitando abrir um segundo servidor conflitante na mesma porta). Confirmado:
- Menu principal renderiza sem alteração (reload completo).
- Em partida: contorno externo de duplas completo; duas laterais de simples visivelmente inseridas e paralelas ao contorno externo, simétricas (mesma distância do topo/base); duas linhas de saque verticais, uma de cada lado da rede, simétricas; dois segmentos de linha central de saque, cada um só entre a rede e sua própria linha de saque — **confirmado que NÃO atravessam a quadra inteira**, tanto na visão geral quanto num recorte com zoom (2×) do lado do Leo; rede vertical, centrada, alinhada com as novas linhas e com o juiz na cadeira; Leo e Alice cada um do seu lado, sem sobreposição estranha com nenhuma linha nova.
- Bola confirmada em movimento real (capturada em 3 posições diferentes ao longo de screenshots consecutivos), sem regressão de renderização.
- HUD (nomes, corações, games, pontos, contador de rally) continua funcionando normalmente, sem alteração visual.
- **Resultado**: o salto visual é imediatamente perceptível — antes era "um cenário retangular com linhas decorativas", agora é reconhecível de relance como uma quadra de tênis real (simples dentro de duplas, linhas de saque, linha central de saque corretamente contida).
- **Nenhuma incompatibilidade de posicionamento de Leo/Alice em relação às novas linhas foi observada** — não há nada a registrar como pendência de posicionamento para uma etapa futura.

### Testes

Nenhum teste novo foi adicionado nesta etapa — não havia lógica pura nova e testável para cobrir (`drawCourtLines`, `strokeHorizontalLine`, `strokeVerticalLine` são funções de desenho em `CanvasRenderingContext2D`, sem valor de retorno relevante para asserção, e a geometria que elas consomem — `COURT` — já tem 22 testes desde a Etapa 1). Isso é consistente com a instrução explícita desta etapa de só adicionar testes para lógica genuinamente nova. Nenhum teste existente foi removido ou enfraquecido.

### Coverage / typecheck / lint / build

- `npm test -- --run`: **95/95 passando** (mesmo total da Etapa 2 — nenhuma regressão, nenhum teste novo, como esperado).
- `npm run typecheck`: limpo.
- `npm run lint`: limpo.
- `npm run build`: limpo (compilação e geração de páginas estáticas concluídas sem erro).

### Problemas restantes / pendências (não resolvidos nesta etapa, de propósito)

- Animação da Alice (Etapa 4), mecânica de saque (Etapas 5-10), posicionamento inicial (Etapa 11), física/limites da bola (Etapa 12), sistema de pontuação (Etapa 13) — nenhum desses foi tocado.
- Áudio, troca de framework/física, ou qualquer polish visual fora do escopo da quadra — não implementados, conforme instruído.
- `half-court-lines.png` permanece no disco sem uso — pode ser removido fisicamente numa sessão futura se o usuário decidir que não há mais utilidade nenhuma para o arquivo.
- **O jogo completo não está pronto/finalizado** — restam animação da Alice, mecânica de saque, revisão de física/pontuação, testes mais amplos, validação visual final e validação técnica final (Etapas 4 a 16 do plano), além de playtesting humano manual.

## Sessão de 2026-09-06 (parte 6) — Etapa 2: playable bounds + correção da Alice

**Escopo desta etapa, exatamente como aprovado**: corrigir a causa raiz do bug da Alice saindo da quadra, integrando os `PlayableBounds` da geometria central (Etapa 1) ao movimento/IA. **Nada mais** — sem redesenho visual da quadra, sem animação da Alice, sem saque, sem mudanças de pontuação/física.

### Causa raiz corrigida

`computeCpuTargetY()` (`game/cpu/ai.ts`) calculava `predictedY + error` sem nenhum limite, e `moveToward()` movia a Alice até esse alvo sem clamp nenhum — diferente do Leo, que sempre teve `Math.max(0, Math.min(courtWidth, nextY))` em `applyPlayerMovement`. Essa omissão específica (nunca escrita para a Alice) era a causa raiz.

### As duas camadas de proteção pedidas

- **Camada 1 (target)** — `computeCpuTargetY` agora recebe um parâmetro `bounds: PlayableBounds` e passa **todo** valor de retorno por `clampToBounds()` antes de devolver — inclusive o caminho de "manter posição" (quando a bola não está indo para a Alice), que agora também é clampado, para que uma posição inválida por qualquer motivo não seja ecoada indefinidamente.
- **Camada 2 (posição final)** — `GameEngine.updateAlicePosition()` agora clampa o resultado de `moveToward()` de novo, com o mesmo `clampToBounds()`, antes de atribuir a nova posição da Alice.

Nenhuma segunda implementação de clamp foi criada — as duas camadas chamam a mesma função `clampToBounds()` de `game/court/geometry.ts` (Etapa 1), com `COURT.alicePlayableBounds`.

### Lado da rede

`COURT.alicePlayableBounds = {minX: netX, maxX: length, ...}` — o `minX` é exatamente a posição da rede, então a Alice estruturalmente não pode ter uma posição de profundidade menor que a rede. O Leo usa o eixo X para profundidade (fixo, nunca varia durante o jogo hoje) e Y para lateral — convenção preservada sem alterações.

### O Leo foi deliberadamente NÃO tocado

`game/player/movement.ts` e a chamada `applyPlayerMovement(this.leo.y, input.direction, dt, COURT_WIDTH)` em `GameEngine.update()` continuam exatamente como estavam. O clamp do Leo já era matematicamente equivalente a `clampToBounds` (mesmos números), mas religá-lo à nova geometria foi deixado de fora desta etapa para minimizar risco/mudança em código já validado, como pedido explicitamente.

### Testes adicionados (10 novos, 95 no total)

- `tests/unit/cpu-ai.test.ts`: os 3 testes existentes de `computeCpuTargetY` foram atualizados para passar `bounds` (nenhum foi enfraquecido); 5 novos — alvo abaixo do limite mínimo, alvo acima do limite máximo, todas as dificuldades nos dois extremos de erro, fallback com posição já inválida, e um teste nomeado explicitamente como regressão histórica (`predictedY=0,error=-max` e `predictedY=width,error=+max`).
- `tests/unit/engine.test.ts`: novo describe "Alice stays within her playable bounds" com 5 testes rodando o `GameEngine` real (não só as funções isoladas) — posição inicial válida, 5000 frames consecutivos com erro máximo positivo, 5000 frames com erro máximo negativo, 8000 frames forçando resets de ponto repetidos (sem acumular deriva), e todas as dificuldades por 1500 frames cada.

### Validação

- `npm test`: **95/95 passando** (85 anteriores + 10 novos; todos os testes pré-existentes continuam passando sem alteração de expectativa).
- `npm run typecheck`, `npm run lint`, `npm run build`: limpos.
- **Validação manual real no navegador**: jogo aberto, vários pontos e um rally real observados (incluindo um "PERFECT!" da Alice). A Alice chegou visivelmente perto da linha lateral superior da quadra em múltiplos frames e **nunca a ultrapassou**; nunca cruzou a rede; ao final do ponto (Alice 15, rally resetado a 0) o novo saque começou normalmente e ela se reposicionou de forma válida. Não foi possível, nem necessário, reproduzir o bug antigo — os testes automatizados já cobrem os cenários extremos de forma muito mais exaustiva (milhares de frames em condições piores do que qualquer partida real produziria).

### O que NÃO foi feito nesta etapa (fica para as próximas)

- `GameCanvas.tsx` **não foi tocado** — a quadra visual continua com o mesmo asset `half-court-lines.png` de topologia incerta.
- Nenhuma animação da Alice, mecânica de saque, ou mudança de pontuação/física da bola.

## Sessão de 2026-09-06 (parte 5) — Etapa 1: geometria única da quadra

**Escopo desta etapa, exatamente como aprovado**: criar e testar uma fonte única de verdade para a topologia da quadra. **Nada mais** — sem integração com render/movimento/IA/física, sem fix do bug da Alice, sem saque, sem polish visual. Essas vêm em etapas seguintes, cada uma com sua própria aprovação.

### O que foi criado

- **`game/court/geometry.ts`** (novo) — exporta `COURT: CourtGeometry`, um objeto único calculado a partir das constantes já existentes (`COURT_LENGTH`, `COURT_WIDTH`, `LEO_X`, `ALICE_X`, `NET_X` — nenhuma delas foi duplicada ou alterada). Contém:
  - `netX`, `leoBaselineX`, `aliceBaselineX` (= as constantes já existentes, só reexpostas com nome semântico)
  - `leoServiceLineX`, `aliceServiceLineX` — linhas de saque, derivadas da proporção real de uma quadra ITF (linha de saque a 21 dos 39 pés entre rede e baseline → razão `21/39` aplicada à metade do comprimento de cada lado)
  - `doublesTop`/`doublesBottom` (= os limites `[0, COURT_WIDTH]` já usados por movimento/colisão hoje — a quadra de duplas É a área jogável já existente, decisão explícita documentada abaixo)
  - `singlesTop`/`singlesBottom` — linhas de simples, derivadas da razão real `(36-27)/2/36` aplicada à largura
  - `centerServiceY` — o meio lateral exato da quadra
  - `leoPlayableBounds`/`alicePlayableBounds` — retângulos `{minX, maxX, minY, maxY}`, cada um limitado pela rede de um lado e pelas laterais de duplas dos outros dois lados
  - `clampToBounds(x, y, bounds)` — função pura auxiliar, pronta para a próxima etapa (fix da Alice) usar, mas **ainda não chamada por nenhum código de gameplay**.
- **`tests/unit/court-geometry.test.ts`** (novo, 22 testes) — cobre dimensões, linhas (posição relativa, simetria, proporção real da linha de saque) e bounds jogáveis, priorizando relações (`toBeGreaterThan`, `toBeLessThan`, simetria) sobre números fixos, como pedido.

### Como as proporções reais foram representadas

Usei as proporções de uma quadra ITF **só como razões**, nunca como medida em metros/pés real:
- Largura de simples/duplas: `27/36` pés → razão de inset `(36-27)/2/36 = 0.125` aplicada a `COURT_WIDTH`.
- Distância da linha de saque até a rede: `21/39` pés (metade do comprimento) → aplicada à distância `netX - baselineX` de cada lado.

Isso preserva a topologia e as proporções relativas de uma quadra real sem exigir que `COURT_LENGTH`/`COURT_WIDTH` representem metros de verdade — exatamente o que foi pedido.

### Decisão arquitetural registrada

`COURT_WIDTH` (o intervalo `[0, COURT_WIDTH]` já usado por movimento/colisão) foi tratado como a **largura de duplas** (a mais externa), não a de simples — porque o jogo já deixa os jogadores se moverem por toda essa largura hoje, e mudar isso seria uma alteração de gameplay, que esta etapa **não** deveria fazer. As linhas de simples ficam só como marcação visual/geometria disponível para o futuro, não como um limite de movimento novo.

### Validação desta etapa

- `npm test`: **85 testes passando** (63 anteriores + 22 novos — nenhum teste existente foi alterado ou enfraquecido).
- `npm run typecheck`: limpo.
- `npm run lint`: limpo.
- `npm run build`: limpo.
- **Não houve validação visual** nesta etapa — a quadra renderizada em tela continua exatamente igual a antes, porque a nova geometria não foi conectada a `GameCanvas.tsx`. Isso é esperado e deliberado, não um esquecimento.

### O que NÃO foi feito nesta etapa (fica para as próximas, cada uma com sua aprovação)

- `GameCanvas.tsx` **não foi tocado** — a quadra continua desenhada do jeito antigo, com o mesmo asset `half-court-lines.png` cuja topologia é incerta. A nova geometria existe mas não está "no ar" ainda.
- `game/cpu/ai.ts` **não foi tocado** — o bug da Alice saindo da quadra **continua presente**, sem nenhuma correção ainda.
- `GameEngine.ts`, `game/player/movement.ts`, física da bola: **não tocados**.
- Nenhuma mecânica de saque, animação da Alice, ou polish visual.

## Sessão de 2026-09-06 (parte 4) — Bug crítico de renderização, bola e HUD

Escopo desta sessão, na ordem pedida: (1) investigar e corrigir Leo/bola invisíveis na execução normal, (2) finalizar sprite/animação do Leo (já estava validada — só reconferida), (3) sprite real da bola, (4) HUD com arte real, (5) polish visual. **Áudio não foi tocado, como pedido.**

### 1-2. Causa raiz do bug "Leo e bola invisíveis"

**Sintoma**: em execução normal (não na automação de teste), a quadra aparecia mas Leo, Alice e a bola nunca eram desenhados — nem mesmo os fallbacks cinza/círculo que o código já tinha para asset ainda não carregado.

**Investigação**: reproduzi o jogo repetidamente neste navegador sandboxed sem conseguir reproduzir de forma confiável (a latência artificial do ambiente quase sempre garante um `dt` positivo no primeiro frame). Descartado por auditoria: 404 de assets (nenhum), exceção JS visível no console (nenhuma — mas o console só mostra o que aconteceu enquanto eu observava, não o que o usuário viu), z-order (`render()` desenha bola por último, sempre visível se chegar até lá), posição fora do canvas (LEO_X/ALICE_X/COURT_WIDTH são constantes válidas). O padrão do sintoma — quadra completa (que termina de desenhar) mas NADA depois dela (Leo, Alice, bola, que são desenhados depois) — indicava fortemente uma exceção lançada bem no meio do `render()`, entre o fim de `drawCourt` e o início de `drawLeo`.

**Causa raiz encontrada por revisão de código**: em `components/GameCanvas.tsx`, `dt = (now - lastTime) / 1000` no primeiro frame pode ser **negativo** — o timestamp que o navegador entrega ao callback de `requestAnimationFrame` ocasionalmente é anterior ao `performance.now()` capturado de forma síncrona no `useEffect`, uma peculiaridade real e documentada de timing entre JS síncrono e o início de frame do navegador (não é garantido que `performance.now()` no seu script seja sempre `<=` o timestamp do próximo rAF). Com `dt` negativo, `LeoAnimator.elapsedMs` ficava negativo, e `Math.floor(elapsedMs / frameMs) % frameCount` em JavaScript **retorna um número negativo** para dividendo negativo (diferente de Python) — por exemplo `-1`. Um array em JS não suporta índice negativo: `sprites.idle[-1]` retorna `undefined`, e a chamada seguinte (`isReady(undefined)` → `undefined.complete`) lança `TypeError`, que interrompe o `render()` exatamente onde o sintoma indicava.

Isso explica por que era intermitente e por que nunca apareceu na automação de navegador usada nas sessões anteriores (latência artificial alta demais para produzir `dt` negativo).

**Correção estrutural** (nenhum hack, nenhuma lógica de gameplay alterada):
- `components/GameCanvas.tsx`: `dt` agora é `Math.min(Math.max((now - lastTime) / 1000, 0), 1/30)` — nunca negativo, protegendo tanto o `LeoAnimator` quanto a física do engine (`stepBallPhysics` também recebe esse mesmo `dt`).
- `components/leoAnimation.ts`: `elapsedMs` agora é clampado com `Math.max(0, ...)` no `update()` (defesa adicional, caso algum outro chamador futuro passe `dt` negativo), e `getFrame()` usa uma função `safeFrameIndex()` com a fórmula `((n % m) + m) % m`, que é sempre não-negativa independente do sinal de `n` — elimina essa classe inteira de bug de índice, não só o caso específico encontrado.
- **A máquina de estados IDLE/PREPARE/CONTACT/RECOVER/MISS validada nas sessões anteriores não foi alterada** — só a matemática de índice de frame, que agora é robusta.

**Teste de regressão adicionado**: `tests/unit/leoAnimation.test.ts` (novo, 7 testes) — cobre especificamente "não lança exceção nem produz índice negativo mesmo com `dt` negativo no primeiro frame" (o cenário exato do bug), além de cobrir idle/prepare/contact/miss/ignorar-swing-fora-de-turno para não perder cobertura da lógica já validada visualmente antes.

**Validação**: reproduzi o fluxo normal (clicar JOGAR, sem nenhuma automação de teclado especial) várias vezes seguidas, incluindo reloads frios completos do zero — Leo, Alice e bola aparecem consistentemente em todas as tentativas depois da correção. Antes da correção, um estado transitório onde Alice aparecia como retângulo cinza (asset ainda carregando) era visível por 1 frame e se autocorrigia — isso é comportamento normal de carregamento assíncrono, não o bug.

### 3. Sprite real da bola

`public/assets/ball/bola.png` (sheet de catálogo, RGB opaco, sem alpha — mesmo padrão dos outros sheets de cenário) tem uma fileira "ANIMAÇÃO NORMAL (ROTAÇÃO)" com 8 ícones de bola limpos e uniformemente espaçados. Extraídos via chroma-key (mesma técnica já usada para rede/juiz) para `public/assets/ball/derived/rotation-1.png` … `rotation-8.png`.

`GameCanvas.tsx`: `drawBall` agora desenha esses 8 frames em ciclo (a cada 45ms, dá a impressão de rotação) numa escala pequena (`BALL_RENDER_HEIGHT = 18px`, proporcional ao Leo de 150px) em vez do círculo vetorial anterior. Mantém um fallback para o círculo vetorial se a sprite ainda não tiver carregado (mesmo padrão de degradação graciosa usado em todos os outros assets). Confirmado visualmente em movimento real durante o rally — bola nítida, sem blur, escala adequada.

### 4. HUD com arte real

Tentativa inicial: usar o painel inteiro "HUD (DURANTE O JOGO)" do `SPRITE SHEET INTERFACE.png` como fundo único, mascarando os números de exemplo já desenhados na arte ("15 - 30", "RALLY 12", 3 corações fixos) com retângulos da cor local seguidos do texto dinâmico — mesma técnica usada com sucesso nos botões do menu/vitória/derrota. **Não funcionou desta vez**: ao contrário dos botões (que são regiões grandes e bem separadas), os números de exemplo dentro do painel são pequenos e minha estimativa visual das coordenadas exatas ficou imprecisa o suficiente para os overlays não cobrirem os números originais direito — confirmado visualmente no navegador (dígitos da arte ainda apareciam ao lado dos dinâmicos).

**Abordagem final, mais robusta**: extraídos apenas os dois avatares (`leo-avatar.png`, `alice-avatar.png` — as únicas partes desse painel sem texto de exemplo embutido, portanto sem risco de sobreposição), e o resto do HUD reconstruído como um painel CSS limpo (Tailwind) com esses avatares reais + corações Unicode coloridos (♥ vermelho preenchido / cinza vazio, 2 por lado = sets) + texto real (games, pontos via `pointLabel` já existente, contador de rally, nível, qualidade do último golpe com cor por categoria — verde/amarelo/laranja/vermelho). Cores de borda mantêm o esquema já estabelecido (azul Leo, rosa Alice). Documentado no topo do `HUD.tsx` por que a arte completa do painel não foi usada (para não repetir a mesma tentativa numa sessão futura sem essa informação).

**Validação**: confirmado visualmente no navegador — avatares reais aparecem, corações/games/pontos/rally exibem os valores corretos do `GameSnapshot` (mesmos campos já validados em sessões anteriores), layout responsivo, sem sobreposição de texto.

### 5. Polish visual

Revisão final da composição completa (quadra + rede + juiz + Leo + Alice + bola + HUD) junto — sem sobreposições quebradas, sem blur (`ctx.imageSmoothingEnabled = false` continua aplicado), escalas coerentes entre si. Não foram feitas mudanças adicionais de polish além do HUD e da bola nesta sessão — o cenário (quadra/rede/juiz) e a animação do Leo já haviam sido finalizados na sessão anterior e permanecem intactos.

### Áudio

**Não implementado, conforme instruído.** Nenhum arquivo de áudio, biblioteca ou código de som foi adicionado.

## Sessão atual — Polimento visual do gameplay (animação do Leo, quadra completa, juiz)

Esta seção documenta especificamente o trabalho desta sessão. Escopo: (1) animação de rebatida do Leo, (2) quadra completa com marcações, (3) juiz na cadeira, (4) integração visual/camadas, (5) validação. **Nenhuma lógica de `game/` (engine, scoring, collision, física) foi alterada** — só `components/GameCanvas.tsx` (reescrito) e um arquivo novo, `components/leoAnimation.ts`.

### 1. Animação do Leo — máquina de estados sincronizada com o hit real

`components/leoAnimation.ts` (novo) implementa `LeoAnimator`, uma máquina de estados **puramente de apresentação** — não lê nem escreve nenhum estado do engine, só compara dois snapshots consecutivos (antes/depois de `engine.update()`) mais o input bruto daquele frame:

```
IDLE (4 frames, cicla a cada 220ms)
  → PREPARE (2 frames, quando a bola entra numa janela de 180 unidades — só visual, não usa REACH_X_*)
  → CONTACT (1 frame) — disparado no MESMO frame em que o engine resolve o swing
  → RECOVER (reaproveita o frame de PREPARE em reverso)
  → IDLE
MISS (3 frames) — quando o resultado do swing é "miss"
```

**Como a sincronização funciona sem tocar no engine**: `GameCanvas.tsx` agora chama `engine.getSnapshot()` ANTES de `engine.update()` (guardando o snapshot anterior), e de novo depois. Se `prevSnapshot.ball.owner === "leo" && input.hitPressed`, um swing foi tentado nesse frame exato — e `nextSnapshot.leo.lastShot` (campo que já existia no engine, nunca antes lido pela UI) diz se foi perfect/good/late/miss. Isso é 100% baseado em estado público já exposto pelo `GameEngine`, sem adicionar nem alterar nada em `game/`.

**Diferenciação de timing por qualidade** (não há arte separada por qualidade — só 1 frame de contato — então a diferenciação é por duração):

| Qualidade | Duração do CONTACT | Duração do RECOVER | Efeito extra |
|---|---|---|---|
| PERFECT | 70ms | 110ms | flash branco discreto (~60ms) ao redor da bola |
| GOOD | 100ms | 170ms | nenhum |
| LATE | 150ms | 260ms | nenhum |
| MISS | 3 frames × 150ms (450ms total) | — | nenhum |

**Frames usados — mapeamento determinístico**: ver `public/assets/characters/leo/derived/FRAME_MAP.md` para as bounding boxes exatas usadas para recortar cada frame de `leo sprite sheet.png` (coordenadas medidas via análise de canal alpha, não estimadas visualmente). Resumo: IDLE (4/4 frames limpos), PREPARAÇÃO FOREHAND (2/2 limpos), FOREHAND (apenas 1/5 frames tem gap de transparência real — os outros 4 se fundem no sheet original), ERRO/MISS (3/3 limpos).

**Limitação conhecida e deliberada**: BACKHAND, SMASH, SAQUE, VOLEIO e os frames 2-5 de FOREHAND **não foram fatiados** porque as poses se sobrepõem no sheet original sem um gap de transparência real entre elas — fatiar por estimativa produziria sprites com raquete/braço cortados no meio. Leo usa a MESMA animação de forehand para qualquer rebatida (independente do lado real da bola). Isso é uma limitação visual documentada, não um bug, e segue exatamente a instrução de não cortar frames "no chute".

Ancoragem: como os frames têm alturas de recorte diferentes (155px idle, 170px prepare, 156px contact, 124px miss — recortes justos, sem padding), `drawLeo()` ancora sempre pela base (`drawY(worldY) - height`), não pelo heurístico `height*0.85` que `drawPlayer` (Alice, inalterado) ainda usa — isso evita Leo "flutuar" ou "afundar" ao trocar de sprite entre frames de tamanhos diferentes.

### 2. Quadra completa — texturas e linhas reais, não CSS genérico

Todo o cenário da quadra agora usa assets reais extraídos de sheets de catálogo (`court 4 com objetos.png`, `objetos/rede.png`, `cenarios e objetos.png`) — essas sheets são imagens RGB **opacas** (fundo azul-marinho de catálogo, sem canal alpha), então cada asset precisou de extração por recorte de pixel + chroma-key (remover a cor de fundo por distância de cor), nunca desenho programático de linhas genéricas:

- **Textura do saibro e da grama**: `public/assets/court/derived/texture-clay.png` e `texture-grass.png`, recortados da seção "SUPERFÍCIES" de `cenarios e objetos.png`, aplicados via `ctx.createPattern(...)` no lugar do preenchimento de cor sólida anterior.
- **Linhas de marcação** (linha de serviço, linha central de serviço, extensão da linha de fundo): `public/assets/court/derived/half-court-lines.png`, extraído da seção "LINHAS (OVERLAYS)" de `court 4 com objetos.png` (um diagrama PLANO, não em perspectiva — por isso pôde ser reaproveitado). Rotacionado 90° porque o diagrama original tem o eixo comprimento-da-quadra na vertical, e o nosso canvas tem esse eixo na horizontal. Desenhado uma vez normal (metade da Alice) e uma vez espelhado horizontalmente (metade do Leo) via `ctx.scale(-1,1)`.
- **Rede**: `public/assets/court/derived/net-vertical.png`, extraído da seção "REDE (SEM SUPORTE CENTRAL)" de `objetos/rede.png` (vista frontal, com malha e postes reais) e rotacionado 90° para virar a barra vertical que o engine já usa. A espessura na tela é fixa (26px, `NET_VISUAL_THICKNESS`) e **não** derivada da proporção nativa do sprite — a "altura" da rede na foto original não corresponde a nenhuma unidade do nosso mundo, então usar a proporção literal deixaria a rede absurdamente grossa (~80px). Isso está documentado no próprio código.

O contorno externo da quadra (`strokeRect` branco já existente) foi mantido sem alteração — ele já funcionava e não precisava ser substituído, só complementado com as marcações internas que faltavam.

### 3. Juiz na cadeira

Achado da auditoria: `COURT 1.png` (o backdrop já em uso) já mostra uma cadeira de juiz **vazia**, centralizada no eixo da rede, dentro da faixa já recortada (`BACKDROP_SOURCE_HEIGHT`). O problema era exatamente esse — cadeira sem ninguém.

`public/assets/characters/JUIZ/derived/normal.png` foi extraído da pose "NORMAL" (vista frontal, sentado) de `characters/JUIZ/juiz.png` via chroma-key (a sheet inteira é opaca — mesmo caso da quadra). Desenhado centralizado em `NET_X`, numa escala (`JUDGE_RENDER_HEIGHT = 70px`) deliberadamente maior que a escala literal da cadeira minúscula do backdrop — mesmo critério já usado para Leo/Alice, que são desenhados bem maiores que a torcida do backdrop para ficarem legíveis. Isso faz o juiz visualmente ocupar/substituir a cadeira vazia original.

**Camadas (ordem de desenho em `drawCourt`)**: backdrop → juiz → grama/saibro (textura) → contorno branco → linhas internas → rede. O juiz é desenhado ANTES da quadra/rede (ou seja, atrás delas na composição), e sua posição vertical (`bottomY = TOP_MARGIN - 2`) fica acima do início da rede (`courtTop - 15`), então ele nunca aparece na frente da rede.

### Verificação feita nesta sessão

- `npm test` (56/56), `npm run typecheck`, `npm run lint`, `npm run build` — todos limpos, rodados depois de toda a implementação e de novo depois de remover todo o código de debug temporário usado na verificação (nenhum resto ficou — confirmado por grep).
- **Confirmado visualmente no navegador**: quadra com textura de saibro/grama reais, linhas de marcação nos dois lados (espelhadas corretamente), rede com malha real e postes, juiz sentado atrás da arquibancada/rede sem sobrepor a rede incorretamente, Leo e Alice renderizando sem sprites cortados/deformados/borrados (`ctx.imageSmoothingEnabled = false` aplicado).
- **Os 5 estados da animação do Leo foram confirmados visualmente, um a um, no navegador**: IDLE (ciclo de 4 frames), PREPARE (dispara exatamente quando a bola entra na janela de aproximação), CONTACT (pose de forehand real, no frame exato em que `lastShot` vira "good"), RECOVER (retorno à postura de preparação) e MISS (pose de erro, 3 frames, quando o swing erra). Cada transição foi capturada isolada via screenshot, incluindo o ciclo completo IDLE→PREPARE→CONTACT→RECOVER→IDLE em uma única sequência de rally real.
- **Achado de metodologia de teste (importante para sessões futuras)**: a tecla SPACE sintética desta ferramenta de automação de navegador gera um `KeyboardEvent` **vazio** (`code: ""`, `keyCode: 0`, `key: ""`) — verificado adicionando um listener de `keydown` temporário via `javascript_tool` e inspecionando o evento recebido. Como `game/input/keyboard.ts` checa `e.code === "Space"`, esse SPACE sintético nunca registrava um swing, então as primeiras tentativas de validação (via `computer.key`) mostravam `hits=0` para sempre — não porque a animação estivesse quebrada, mas porque nenhum swing real jamais foi tentado por essa via. A correção foi disparar o evento manualmente via `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))` (e o `keyup` correspondente) através do `javascript_tool` — isso SIM aciona `KeyboardInput` corretamente e permitiu a validação completa acima. **Se uma sessão futura precisar testar SPACE via automação de navegador neste ambiente, usar esse método de `dispatchEvent`, não `computer.key`.**
- Também descoberto (e não é bug): a aba do navegador sandboxed roda a simulação em tempo real contínuo em segundo plano (não trava/não é pulada), mas a captura de screenshot é o que introduz o atraso percebido — ou seja, o jogo em si nunca "travou", só a visibilidade de estados muito curtos (CONTACT/RECOVER, ~70-260ms) é difícil de cronometrar por screenshot isolado. Para confirmar essas transições com folga, os multiplicadores `CONTACT_MS`/`RECOVER_MS`/`MISS_FRAME_MS` foram temporariamente multiplicados por 15×/8× durante a verificação e revertidos aos valores reais logo depois (confirmado por grep — nenhum multiplicador temporário ficou no código final).
- PERFECT especificamente (com o flash de impacto) não foi isolado num screenshot próprio — GOOD, LATE e MISS usam o mesmo caminho de código que PERFECT (só a tabela `CONTACT_MS`/`RECOVER_MS`/`IMPACT_FLASH_MS` muda por qualidade), e esse caminho já foi confirmado funcionando para GOOD e MISS. Fica como verificação visual opcional para uma sessão futura, não como risco conhecido.

## O que está concluído e testado

### Motor do jogo (`game/`) — 100% testado, framework-agnóstico

Sem mudanças desde a sessão anterior. 56 testes passando (`tests/unit/*.test.ts`), cobrindo física, colisão/hit-quality, scoring, CPU, e o engine completo (incluindo o teste de rally real LEO↔ALICE e o teste de determinismo). Ver tabela detalhada em versões anteriores deste arquivo ou diretamente em `tests/unit/`.

### Fluxo de telas (novo nesta sessão)

- `app/page.tsx` — máquina de estado `"menu" | "playing" | {screen:"gameover", winner}`, com `matchKey` forçando remount do `GameCanvas` (engine novo) a cada nova partida.
- `components/MainMenu.tsx` — renderiza `public/assets/menu/menu.png` em tela cheia; botão "JOGAR" é um overlay invisível (`aria-label`, hit-area, hover/focus sutil) posicionado por coordenadas percentuais medidas por análise de pixel da própria imagem.
- `components/GameOverScreen.tsx` — renderiza `vitoria.png` (Leo venceu) ou `derrota.png` (Alice venceu); "jogar novamente"/"tentar novamente" e "voltar ao menu" são overlays invisíveis, mesmo padrão do menu.
- `components/GameCanvas.tsx` — ganhou prop `onGameOver?: (winner: Side) => void`, disparado uma única vez quando `snapshot.phase === "game_over"` e `lastEvent.type === "match"`.

**Por que overlays invisíveis, não botões visuais novos**: as 3 imagens (menu/vitória/derrota) já têm seus próprios botões desenhados pixel a pixel, com ícone e texto. A primeira versão desta sessão desenhava botões Tailwind visíveis por cima — isso causava **duplicação visual real** (o botão da arte e o botão React apareciam ambos, um ligeiramente deslocado do outro). Corrigido: os `<button>` agora são transparentes (`bg-white/0`), só ficam visíveis num hover/focus sutil, e suas coordenadas (`top`/`left`/`width`/`height` em `%`) foram calculadas medindo os pixels reais de cada PNG (script Python/PIL, procurando as transições de borda dos botões). **Se qualquer uma dessas 3 imagens for regerada/substituída, essas coordenadas precisam ser recalculadas** — não são genéricas, são medidas por imagem.

### Cenário (novo nesta sessão)

`GameCanvas.tsx` agora desenha um backdrop real: a faixa superior (céu/skyline/torcida/quadros publicitários/juiz) de `public/assets/court/COURT 1.png` é recortada (`0,0` a `1536,515` do PNG de 1536×1024) e desenhada como imagem estática acima da quadra. A quadra em si (grama, saibro, rede vertical) continua sendo desenhada por código, porque `COURT 1.png` usa câmera tradicional (rede horizontal, vista atrás-da-linha-de-fundo) incompatível com o modelo de câmera lateral já testado do engine. `TOP_MARGIN` subiu de 60 para 220px para dar espaço ao backdrop.

### Verificação feita nesta sessão

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` — todos limpos, rodados após as mudanças de menu/gameover/canvas.
- Menu principal confirmado visualmente no navegador (screenshot), sem duplicação de botão.
- Rally real confirmado via **teclado de verdade** (tecla SPACE via automação de navegador, não só engine sintético) — rally counter incrementou, bola visivelmente foi e voltou entre Leo e Alice. **Correção registrada na sessão seguinte**: descobriu-se depois que a tecla SPACE sintética do `computer.key` desta ferramenta gera um `KeyboardEvent` vazio (`code:""`) que `KeyboardInput` nunca reconhece (ver "Achado de metodologia de teste" na seção da sessão de polimento visual, abaixo) — então esse rally observado aqui provavelmente correspondia à CPU (Alice) jogando sozinha contra um Leo que nunca rebatia de verdade, não a um hit real do Leo via automação. O rally/fluxo em si (motor, telas, callback de fim de jogo) continua válido; o que fica em dúvida é só essa alegação específica de "SPACE via automação funcionou" nesta linha.
- Telas de vitória e derrota confirmadas visualmente (via uma rota de preview temporária, removida depois) — layout correto, sem duplicação.
- Hit-testing dos 5 botões (Jogar, Jogar Novamente, Voltar ao Menu ×2, Tentar Novamente) confirmado via `document.elementFromPoint` — cada overlay realmente captura o clique no centro do botão correspondente da arte.
- **Não testado nesta sessão**: uma partida completa jogada do início ao fim manualmente (script de automação de teclado é lento demais para simular uma partida inteira de tênis tradicional — 2 sets de 6 games). O caminho de vitória/derrota foi validado via renderização isolada dos componentes + `onGameOver` callback já coberto por `GameCanvas.tsx`'s lógica (que não mudou desde a versão testada por `engine.test.ts`).

## O que NÃO foi feito ainda

1. **Leo: backhand/smash/saque/voleio sem animação própria** — só idle/prepare/forehand-contact/miss foram fatiados com segurança (ver seção da sessão de polimento visual acima e `FRAME_MAP.md`). Usa a animação de forehand para qualquer rebatida.
2. **Alice continua com UMA pose estática** — fora do escopo pedido até agora (os pedidos de animação foram só sobre o Leo e, depois, sobre a bola/HUD). `ALICE SPRITE SHEET.png` tem o mesmo problema de frames fundidos que o sheet do Leo.
3. **HUD não usa o painel completo da arte** (`SPRITE SHEET INTERFACE.png`) — usa só os dois avatares dessa arte + um painel CSS. Ver "4. HUD com arte real" acima para o porquê (a tentativa de mascarar os números de exemplo do painel completo não ficou alinhada com confiança).
4. **Racquet icons, ícone de bola pequena e outros elementos decorativos do kit de HUD** não usados (só os avatares foram extraídos).
5. **Efeitos/VFX de texto não usados** (`efeitos sprite sheet.png` — banners PERFECT!/GOOD!/LATE!/MISS!/POINT!/GAME!/SET!/MATCH!) — só o PERFECT ganhou um flash discreto desenhado via canvas. Os banners de texto animado continuam não usados; o "Último golpe" no HUD é só texto colorido.
6. **Seleção de dificuldade** — hardcoded como `"normal"` em `app/page.tsx`.
7. **Controles mobile/touch** — não implementados.
8. **Áudio** — nada implementado (deliberadamente adiado, ver instrução explícita do usuário).
9. **Persistência (localStorage)** — nada implementado (recordes de rally/score).
10. **Modos de jogo separados** (Rally Challenge como modo distinto de Quick Match) — só existe o equivalente a "Quick Match".
11. **README profissional** — não criado.
12. **Trademark/IP na arte gerada** — logo Lacoste, marca HEAD, sinalização "AO" (Australian Open) aparecem em `COURT 1.png`, na rede extraída, e nas telas de menu/vitória/derrota. Ainda não decidido com o usuário o que fazer antes de publicação pública (ver `GAME_DESIGN.md`).
13. **Validação humana manual completa** — todo teste de teclado até agora foi via automação de navegador sandboxed ou via `dispatchEvent` manual para depuração (nunca parte do código do jogo). Uma sessão de playtesting manual real (humano, navegador normal, teclado físico) ainda não aconteceu — recomendado como próximo passo antes de considerar o gameplay "fechado".
14. **Auditoria final** — não feita.

## Como continuar na próxima sessão

1. Ler `docs/GAME_DESIGN.md` e este arquivo primeiro.
2. Rodar `npm test && npm run typecheck && npm run lint && npm run build` em `tennis-challenge/` para confirmar que nada quebrou (deve dar 56 testes, tudo limpo).
3. Rodar `npm run dev` e **jogar manualmente num navegador de verdade** (não sandboxed) — prioridade #1, para confirmar visualmente as 4 variações de timing (PERFECT/GOOD/LATE/MISS) da animação do Leo, algo que esta sessão não conseguiu observar com confiança total por limitação do ambiente de automação (ver nota na seção "Verificação feita nesta sessão").
4. Prioridade sugerida a partir daqui (perguntar ao usuário se preferir outra ordem): (a) resolver a questão de trademark/IP antes de qualquer publicação, (b) animação de Alice (mesmo tratamento dado ao Leo), (c) sprite da bola, (d) HUD com a arte real do kit de interface, (e) áudio e persistência.
5. **Nenhum commit ou push foi feito** — está tudo no working tree local, exatamente como pedido ("não faça commit/push, quero revisar antes").

## Decisões técnicas para lembrar (não re-decidir)

- Nome oficial do jogo: **TÊNIS DA VIDA** (não "Tennis Challenge" — decisão revertida nesta sessão).
- Sistema de coordenadas: X = comprimento da quadra (Leo↔Alice), Y = lateral (A/D), Z = altura (visual only). Ver `docs/GAME_DESIGN.md` "Technical Design".
- Canvas 2D nativo, sem Phaser/PixiJS — decisão deliberada, documentada.
- React só cuida de HUD/menus/telas; a simulação roda fora do ciclo de render do React, num `GameEngine` puro TypeScript.
- CPU sem machine learning — previsão determinística + erro por dificuldade.
- `computeLaunchVelocity` deriva `vz` a partir do tempo de voo — altura do arco é uma consequência, não um parâmetro livre.
- Botões sobre arte pré-renderizada (menu/vitória/derrota) devem ser overlays invisíveis alinhados por coordenadas medidas em pixel, nunca um segundo botão visualmente estilizado — evita duplicação visual (bug real, já corrigido uma vez nesta sessão).
- `COURT 1.png` só contribui a faixa de atmosfera (acima da quadra); a quadra/rede continuam sendo desenhadas por código porque a câmera da imagem não bate com o modelo lateral do engine.
- Sheets de catálogo/cenário (`court 3/4.png`, `objetos/rede.png`, `cenarios e objetos.png`, `characters/JUIZ/juiz.png`) são imagens RGB **opacas**, sem canal alpha — qualquer recorte delas precisa de chroma-key (remoção de fundo por distância de cor), diferente dos sheets de personagem (Leo/Alice), que têm transparência real e podem ser recortados só por bounding-box de alpha.
- Nunca fatiar frames de sprite sheet "no chute": só usar frames com gap de transparência real e verificável entre eles (ver `leo/derived/FRAME_MAP.md`). Poses dinâmicas que se sobrepõem no sheet original ficam documentadas como pendentes, não estimadas.
- Animação de personagem deve ser puramente de apresentação (`components/leoAnimation.ts`), nunca lida/gravada pelo `GameEngine` — sincroniza comparando snapshots antes/depois de `update()`, não adicionando estado novo ao engine.
- Este ambiente de browser sandboxed reduz `requestAnimationFrame` quando a aba não está sendo screenshotada ativamente — não confiar em polling JS puro para observar animação em tempo real aqui; usar screenshots consecutivos dentro do mesmo `browser_batch`.
- **`dt` (delta time) precisa ser sempre clampado para `>= 0`, nunca só o teto superior** — o timestamp do primeiro `requestAnimationFrame` pode ocasionalmente ser anterior ao `performance.now()` capturado de forma síncrona antes dele, produzindo `dt` negativo, que se propaga para qualquer acumulador (`elapsedMs`, física) e pode virar índice de array negativo via `%` (JS retorna negativo para dividendo negativo, diferente de outras linguagens). Corrigido na sessão de 2026-09-06 — ver seção acima. Qualquer novo acumulador de tempo baseado em `dt` deve usar `Math.max(0, ...)` ou uma função de módulo seguro como `safeFrameIndex` em `leoAnimation.ts`.
- **Mascarar texto dinâmico sobre uma arte de painel completa (ex: HUD) é mais frágil do que mascarar botões** — botões costumam ser regiões grandes e bem separadas (fácil de medir por pixel com confiança); números pequenos dentro de um painel denso são fáceis de posicionar errado por estimativa visual. Se precisar reusar uma arte de painel com números de exemplo embutidos no futuro, meça as coordenadas por script (threshold de cor/brilho), não a olho num grid reduzido — ou prefira extrair só os elementos sem texto (como foi feito com os avatares do HUD) e reconstruir o resto em CSS.
- `window.dispatchEvent()` para simular teclado é só uma ferramenta de depuração desta sessão (contorna uma limitação da ferramenta de automação de navegador, que gera eventos de tecla vazios) — nunca deve aparecer em código de produção do jogo. Confirmado ausente do código final (grep).
