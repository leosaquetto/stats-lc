# Track Leaderboard Modal Rules

Contrato do modal competitivo implementado em
`src/components/modals/TrackLeaderboardModal.tsx`.

## Escopo

- Este documento cobre apenas o `TrackLeaderboardModal`.
- O `BottomTrackStatsBubble` de `src/components/Layout.tsx` permanece uma
  superficie separada e protegida por `docs/track-modal-refactor-rules.md`.
- Nao fundir os dois modais, compartilhar estado visual entre eles ou mover o
  layout do modal competitivo para `Layout.tsx`.
- Modais dedicados de artista e album continuam em `EntityStatsModal.tsx`.

## Estrutura Protegida

- Viewport de referencia: `393x750`.
- Header e rodape ficam montados e fixos dentro do shell.
- Somente o miolo usa scroll vertical.
- Header: capa, contexto temporal, faixa, artistas, album, Top 1K/Top Ano e
  fechar.
- Miolo: social de lancamento, historia pessoal, timeline, Wrapped, insights,
  grupo, ranking e artistas.
- Rodape: letra standalone, stats.fm, compartilhar, plataforma musical e
  navegacao de recentes.
- Nao reintroduzir as tabs `Faixa / Artista / Album`; artista e album sao
  contexto e abrem seus modais dedicados.

## Dados

- Fonte principal: uma chamada agregada a `/api/track-story`.
- O modal aceita `userId` e `playback` opcionais; sem eles, usa o usuario
  destaque e resolve o playback atual quando a identidade da faixa coincide.
- Cache e requests in-flight devem continuar limitados pelo `memoryRuntime`.
- Ranking respeita membros ocultos. A fatia do grupo e recalculada sobre o
  ranking visivel quando possivel.
- Campos avancados aparecem apenas quando a faixa tem mais de 10 plays.
- Blocos opcionais sem dados nao reservam vazio.
- Recentes reutilizam `recent/history` e `historyCache`; nao criar persistencia
  pesada nova.

## Visual E Motion

- Base preta/grafite com laranja como acento principal.
- Roxo fica restrito a artista, looping ou recorde; nao usar como banho geral.
- Entradas usam somente `opacity` e `transform`, com stagger curto.
- Timeline usa `scaleX`; barras usam `scaleY`; ranking e artistas entram em
  sequencia.
- Respeitar `motionRuntime`, `useModalMotionScope` e movimento reduzido.
- Sem `transition-all`, loops infinitos, blur animado ou timers visuais locais.

## QA

- Validar no Browser em `393x750`:
  - header e rodape imoveis durante scroll;
  - `window.scrollY` preservado;
  - zero overflow horizontal;
  - troca entre recentes sem conteudo antigo;
  - letra abre standalone depois da saida do modal;
  - artista abre o modal dedicado;
  - ranking, links, share, fechar e Escape funcionam.
- Fazer sanity check em `1280x720`.
- Rodar `npm run lint`, `npm run build`, `npm run build:report` e
  `git diff --check`.
