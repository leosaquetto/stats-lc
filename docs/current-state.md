# Estado Atual do stats.lc

Este arquivo consolida os checkpoints recentes para evitar muitos MDs de sessao.
Regras ativas continuam em `AGENTS.md`; contrato de API continua em
`api-contract.md`.

## Superficies Principais

- Home: mostra usuario em destaque, LeoHeader, vinil, reproduzindo agora,
  atividade do circulo, Replay, Top 1 do Circulo, Stats Alike, insights e
  ultimas reproducoes.
- Stats: rota `/stats`, filtros `Hoje / Semana / Mes / Ano / Total`, Replay,
  graficos temporais e listas compactas. A tela Stats nao copia a Home nem usa
  LeoHeader.
- Orbita: rota `/circle` com abas `Agora`, `Orbits`, `Arena`, `Duelos` e
  `Afinidade`. Aliases preservados: `/ranking` abre Arena e `/alike` abre
  Afinidade.
- Ajustes: troca de usuario destaque deve ser tratada como boot novo da Home,
  limpando `stats-lc-home-boot-ready`, resetando `__STATS_LC_HOME_READY__`,
  navegando para `#/` e recarregando.

## Arquitetura Quente/Fria

- `groupStats` guarda a base fria: usuarios, nomes, avatares, plataforma,
  stats, tops, recentes e preferencias.
- `liveNowPlayingByUserId` guarda dado quente de reproducao por usuario.
- `/api/group-live?profile=0` e intencionalmente leve e pode vir sem nome ou
  avatar completos. Esse payload nunca deve apagar nome/avatar ja conhecido por
  `/api/group` ou cache valido.
- Componentes que precisam de playback devem combinar dados usando helpers em
  `src/lib/memberSelectors.ts`, especialmente `attachLiveNowPlayingToMember`,
  `getCanonicalMembersWithLive` e `getVisibleMembersWithLive`.
- Troca de faixa deve acordar LeoHeader, vinil, progresso, mini stats e
  atividade ao vivo, mas nao invalidar secoes frias da Home.
- Capa/cor dominante devem vir prontas da API quando possivel. O canvas local
  em `src/lib/colorUtils.ts` fica como fallback raro.
- Polling live nao atualiza a idade do snapshot frio nem regrava `groupStats`
  quando apenas a reproducao mudou.
- Preloads de rotas secundarias so iniciam em idle depois da Home pronta; tops
  do circulo e Stats Alike adiam fanout ate suas secoes se aproximarem da tela.

## Performance e Mobile

- O bundle inicial e Home sao chunks separados. `npm run build:report` aplica
  os orcamentos de 160 kB gzip para a entrada e 500 kB gzip para todo o JS.
- `window.__STATS_LC_PERFORMANCE__` expoe Home pronta, navegacao, long tasks e
  long animation frames. Contadores e maximos separam boot e pos-boot.
- Vercel Speed Insights usa amostragem de 20%.
- O desenvolvimento continua web-first. Expo e o caminho nativo pretendido
  para uma fase futura, depois da lapidacao das features web.
- Xcode, simulador e iPhone real nao sao gates atuais.
- O shell Capacitor permanece em `ios/` como referencia pausada. Ele usa
  `com.leosaquetto.statslc`, scheme `statslc://`, safe areas e ciclo de vida
  nativo, mas nao deve receber novas features sem pedido explicito.

### Rollout de Performance de 2026-06-09

Commits publicados:

- frontend base: `c6248a8` (`Optimize app performance and add iOS shell`)
- frontend complemento: `60b4aac`
  (`Reduce Home boot blocking and improve performance metrics`)
- API: `33abac4`, `f34ed76`, `cfcb20d` e `1f4c2cf`

Mudancas consolidadas no frontend:

- Home e rotas secundarias isoladas em chunks lazy.
- Preload global imediato removido; rotas secundarias aquecem por intencao ou
  em idle depois da Home pronta.
- Conteudos pesados e interiores de modais carregam progressivamente, mantendo
  shells imediatos.
- A base recente compacta de `/api/group` libera a splash; a busca de 20 itens
  de historico continua em background.
- Warmup visual inicial limitado ao usuario principal, capa principal, tres
  amigos ativos e tres capas recentes.
- Atualizacoes live priorizam `liveNowPlayingByUserId` e nao regravam
  `groupStats` quando apenas o playback mudou.
- Requests compartilhados ganharam dedupe/cancelamento nos fluxos centrais e
  polling/animações respeitam visibilidade e ciclo de vida.
- Blurs atmosfericos globais mantem o visual, mas o movimento ocorre no wrapper
  por `transform`/`opacity`, evitando animar o blur diretamente.
- Contadores de long task e Long Animation Frame deixaram de usar apenas o
  array truncado de amostras e agora registram total, fase e maior duracao.

Mudancas consolidadas na API:

- `/api/group-live` tem deadline interno de 1,9 s, timeout curto por usuario e
  pode devolver membro parcial com `live_deadline_exceeded`.
- Resolucao direta de album continua no caminho live quando barata; cor
  dominante e enriquecimentos opcionais sairam do caminho critico.
- `/api/group` usa cache CDN de 180 s com stale de 900 s.
- Cache upstream frio padrao passou para 3 min fresh e 15 min stale.
- `/api/top` aceita aliases de periodo e transforma `400` de faixa vazia em
  resposta `200` com `items: []` e warning `upstream_empty_range`.
- Dispatcher central registra request ID, rota, status e duracao sem PII.
- Respostas expoem `X-Request-Id`, `Server-Timing` e `X-App-Timing`; este ultimo
  funciona como fallback quando a plataforma remove `Server-Timing`.

Baseline observado em 2026-06-09:

- bundle: entrada `127,0 kB gzip`; JS total `460,0 kB gzip`; Home
  `25,4 kB gzip`
- Home fria local em nova aba: `2,16 s`
- Home fria em producao: `1,89 s`
- `/api/group-live?profile=0`: `200` em `0,85 s` num MISS, com
  `X-App-Timing: 341,5 ms`
- `/api/group`: `200` em `0,51 s` servindo stale; payload observado de
  aproximadamente `161 kB`

Esses numeros sao snapshots, nao garantias ou SLOs. O Browser in-app pode
inflar long tasks/LoAF pos-boot e nao substitui profiling em aparelho real.
Compare regressao usando o mesmo viewport, rede e estado de cache.

## Home, LeoHeader e Vinil

- A Home deve liberar splash com dados essenciais e imagens criticas ja
  preparados quando possivel. Depois de liberada, refresh/live update nao deve
  voltar para splash.
- `Seus Destaques`, `Top 1 do Circulo`, `Stats Alike` e orbitais similares sao
  comportamentos protegidos: preservar palco, aneis, profundidade, transform,
  opacidade e movimento orbital.
- Vinil e tonearm nao devem ser movidos ou redesenhados sem relacao direta com
  a tarefa. Se o tonearm parecer ausente, verificar `hideTonearm`, clipping e
  `z-index` antes de refatorar.
- Progress clock da faixa deve evitar rerender por segundo no componente todo.
- Recentes usados por Home/Vinil devem preservar capas reais; quando aplicavel,
  preferir `/api/recent?resolveAlbums=1`.
- A Home pode renderizar primeiro a base recente de `/api/group`, mas a
  hidratacao completa deve continuar usando a superficie de historico com
  resolucao de album quando aplicavel.

### Animacao do Vinil (Atualizado 2026-06-10)

- O vinil usa Web Animations API com aceleracao/desaceleracao fisicas realistas.
- **Aceleracao**: 2s com 1.5 rotacoes ate atingir 20 RPM (velocidade constante).
  Easing `cubic-bezier(0.33, 0, 0.2, 1)` simula torque inicial forte do motor.
- **Desaceleracao**: 4s com 3.5 rotacoes ate parar completamente. Easing
  `cubic-bezier(0.25, 0.46, 0.45, 0.94)` simula atrito fisico constante.
- **Rotacao constante**: 3s/volta (20 RPM) enquanto tocando, com easing linear.
- **Troca de track**: Ao trocar track enquanto tocando, o vinil **continua
  girando suavemente** sem reaceleracao. A transicao visual (~1.2s) acontece
  naturalmente enquanto a rotacao fisica permanece constante. Apenas a imagem da
  capa troca; a rotacao e independente da identidade visual.
- O tonearm (0.72s) e intencionalmente mais rapido que o vinil - comportamento
  realista de toca-discos reais onde o braco desce antes do prato atingir
  velocidade maxima.
- Animacoes respeitam `prefers-reduced-motion` e sao canceladas quando o
  componente nao esta visivel (Intersection Observer).
- Implementacao: `startSpinWithAcceleration()` encadeia fase de aceleracao com
  fase de rotacao constante via `onfinish` callback. O useEffect de rotacao
  depende apenas de `isPlaying` e `canAnimate`, nao de `visualSnapshot.identity`.

### Lapidacao de Home e orbitais de 2026-06-09

- O contador `TOTAL HOJE` usa o `featuredStats` opcional do mesmo polling
  `/api/group-live?statsUser=<usuario>`. O valor fica em
  `liveStreamsTodayByUserId`, separado de `groupStats` e fora da persistencia.
- O primeiro valor do contador anima de zero ate o total atual. Atualizacoes
  seguintes partem do valor anterior, com duracao adaptativa; movimento
  reduzido continua instantaneo.
- O mini vinil de scroll foi removido por completo. A capa principal continua
  no warmup visual do LeoHeader, sem listener ou estado paralelo de mini-header.
- A troca de faixa anima o vinil completo saindo e entrando pela direita,
  mantendo o tonearm fora da arvore trocada e preservando o angulo de giro.
- O tonearm usa uma unica sombra suave alinhada ao braco e oscilacao de
  reproducao mais ampla, lenta e assimetrica. O drag manual foi preservado.
- Perceptions e Insights usam rotacao automatica pausada fora da viewport, com
  aba oculta ou durante interacao. Swipe, setas, satelites e pontos reiniciam o
  relogio da secao.
- `Ultima descoberta` so aparece quando `/api/latest-discovery` retorna
  `coverage.complete=true`. Resposta parcial nunca e apresentada como prova.
- Top 1 do Circulo mostra artista sob faixa e album, usa badge visual compativel
  com RankingSummary e nao exibe mais o pill central `TOP 1`.
- Stats Alike valida o tipo de cada top, preserva artista/IDs externos, aceita
  titulo em duas linhas e usa cache de tops `v2` para descartar classificacoes
  antigas incorretas.

### Melhorias de UI e animacao de 2026-06-10

- **Seus Destaques**: indicadores (dots) afastados para mt-4 (antes -mt-2) e
  agora respondem a swipe horizontal para trocar entre artistas/musicas/albuns
  (threshold 30px). Efeito 3D jukebox nos albuns com `rotateY` baseado na
  posicao do scroll (±8°) e `transform-style: preserve-3d`. Flashing nos cards
  eliminado suavizando transicoes de opacity (farFade de 0.56→0.4, threshold
  2.5, fator 0.12). Animacao entre secoes mais fluida (0.32s, easing
  `[0.25, 0.1, 0.25, 1]`).
- **Sombras dos cards**: Cards de "Seus Destaques" e "Atividade do Circulo"
  usam sombra suave a partir do canto superior `shadow-[0_-2px_12px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.25)]`.
  Numeros do ranking com drop-shadow simples `drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]`.
  Cards de atividade ao vivo incluem glow laranja sutil quando tocando
  `0_16px_48px_rgba(249,115,22,0.18)`.

### Atividade do Circulo e troca do vinil de 2026-06-10

- A Atividade do Circulo continua priorizando `liveNowPlayingByUserId`, mas
  agora usa `/api/group-activity` como fallback para a ultima reproducao do
  historico completo de cada membro.
- `/api/group-activity` consulta `/users/:id/streams?limit=1`, limita a
  concorrencia interna a tres usuarios, hidrata linhas que possuem apenas
  `trackId/trackName`, reaproveita a resolucao de album e responde de forma
  parcial sob deadline de 10,5 segundos. A rota e progressiva e nao bloqueia a
  liberacao da Home.
- A rota usa cache CDN de 180 segundos com stale de 900 segundos e nunca envia
  `force=1`. O frontend reutiliza o cache/dedupe temporario de cinco minutos do
  `statsService`; nada foi adicionado ao Zustand ou a persistencia.
- `FriendActivityReel` carrega o fallback somente perto da viewport, mistura
  live e historico, marca historico como nao-live, ordena live primeiro e
  depois por timestamp, mostra ate tres cards e oculta membros sem atividade.
- O rotulo lateral passou de `Tempo Real` para `Atividade recente`.
- A troca do vinil separa transformacoes em tres camadas: entrada/saida
  horizontal externa, oscilacao ociosa intermediaria e rotacao WAAPI no disco
  interno. `vinyl-record-idle` nao atua mais no elemento que gira.
- `VinylRecord` recebe `playbackKey`, portanto duas faixas com a mesma capa
  ainda geram revisoes visuais distintas.
- Capa, cor e playback key ficam em um snapshot visual unico. Uma nova capa so
  substitui a anterior depois de preload e `decode()`; o fallback prematuro de
  700 ms foi removido.
- A passagem de ocioso para tocando tambem cria uma nova revisao visual, mesmo
  com a mesma reproducao, cobrindo o gesto manual do tonearm sem duplicar a
  animacao quando chave e capa mudam juntas.
- A coreografia usa sobreposicao com tween: anterior sai cerca de 150 px para
  a direita e o novo entra de cerca de 140 px, em 540-580 ms. Movimento
  reduzido ou vinil fora da viewport usa crossfade curto.
- Tonearm, drag, sombras, furo, textura e angulo acumulado do disco permanecem
  independentes da arvore trocada.
- Validacao local em `390x844` confirmou tres cards reais na Atividade do
  Circulo: Gabriel, Savio com `Love Controller` de Demi Lovato, e Benny. O
  scroll horizontal e a composicao mobile permaneceram intactos.
- A rota local isolada foi necessaria durante o QA porque o fanout completo da
  Home satura artificialmente o `vercel dev`; ela confirmou a hidratacao e o
  terceiro card sem alterar o comportamento de producao.
- O Browser in-app confirmou o vinil e o tonearm montados, a revisao visual e
  o movimento do braco. A automacao CUA nao entregou de forma confiavel o
  `pointerup` capturado pelo SVG, portanto o fechamento do gesto manual
  ocioso/tocando continua sendo um ponto de verificacao humana no aparelho.
- Gates deste checkpoint: frontend `npm run lint`, `npm run build` e
  `git diff --check`; API `npm run check` com 67 testes e
  `git diff --check`, todos aprovados.

### Lapidacao de UI e Performance de 2026-06-10 (tarde)

Commit publicado: `43ffe69` (`Refine animations, avatar stability, image loading`)

Mudancas consolidadas:

- A transicao da splash para a Home agora usa `translateY` combinado com fade,
  criando movimento vertical coordenado: splash sobe enquanto desaparece (400ms)
  e LeoHeader desce enquanto aparece (400ms), eliminando o gap de tela preta.
- `FriendActivityReel` ajustou padding do card de `p-3.5` para
  `pt-2.5 px-3.5 pb-3.5`, elevando avatar, nome e timestamp em 4px.
- Sombras dos cards da Atividade do Circulo foram intensificadas:
  `shadow-[0_8px_24px_rgba(0,0,0,0.4)]` no estado padrao e dupla sombra
  `shadow-[0_8px_24px_rgba(0,0,0,0.4),0_16px_48px_rgba(249,115,22,0.24)]` quando
  tocando, melhorando contraste e leitura.
- Avatar, nome e timestamp dos cards da Atividade ganharam `drop-shadow` e
  `text-shadow` adicionais para destacar texto sobre imagens de fundo variaveis.
- `SmartImage` melhorou logica de cache: verifica `loadedImageSrcs` e
  `stableImageSrcByKey` antes de disparar estado de loading, evitando shimmer
  desnecessario quando imagem ja esta carregada.
- `primaryUser` no HomeScreen usa `useRef` para manter referencia estavel,
  atualizando apenas quando o ID realmente muda, reduzindo dependencias do
  `useMemo` de 4 para 2.
- `profileAvatarOriginal` no LeoHeader extrai `userAvatarString` estavel no
  inicio do componente e compara `userId` + `avatarValue` antes de recalcular,
  evitando re-renders quando apenas a referencia do objeto `user` muda.
- Essas otimizacoes reduzem flickering do avatar do usuario principal durante
  updates live e trocas de faixa.

Gates desta rodada: `npm run lint`, `npm run build` e `git diff --check`.

## Bottom Bubble e Modal de Musica

Checkpoint consolidado da sessao de 2026-06-05:

- O modal de stats da musica deve permanecer montado e alternar abertura por
  `opacity`, `transform` e `pointer-events`.
- Evitar scroll lock com `body { position: fixed }`; ele causava reflow forte
  da Home.
- O shell deve abrir imediatamente e hidratar dados/cache depois.
- A bubble fica em slot reservado de `60x60`, com botao `absolute inset-0`, para
  nao pular de posicao ao abrir/fechar modal.
- Slots de acoes como Genius/Apple Music devem ser reservados enquanto a
  disponibilidade assincrona chega, evitando mudanca de layout.
- `SmartImage` deve preservar a ultima imagem valida enquanto uma nova `src`
  carrega, evitando flicker quando a URL efetiva nao mudou.
- Animacao da bubble so deve existir quando houver reproducao ao vivo. Sem live
  playback, ela fica estatica.
- Validacoes ja executadas nessa sessao: `npm run lint`, `npm run build`,
  `git diff --check` e Browser in-app em `405x700`.

## Modais de Album e Artista

- `UserAlbumStatsModal` e `UserArtistStatsModal` sao modais pessoais separados
  da arena competitiva.
- `TrackLeaderboardModal` continua sendo o modal de ranking competitivo.
- Endpoints reutilizados: `/api/entity`, `/api/entity-stats`,
  `/api/entity-group-stats`, `/api/entity-streams`, `/api/entity-listeners`,
  `/api/album-tracks`, `/api/artist-catalog`, `/api/top` e `/api/lyrics`.
- Modal deve abrir com shell imediato, skeleton leve, dados pesados
  progressivos, dedupe in-flight e cancelamento via `AbortController`.
- Nao fazer uma request por faixa para montar ranking.
- Acoes por faixa: abrir stats.fm, Spotify, Apple Music, letra in-app, Genius,
  copiar letra e compartilhar letra quando houver dados confiaveis.

## Orbits

- Orbits sao sugestoes de musicas entre membros do circulo, com estado
  compartilhado de visto, aberto, ouvido e contagem de plays depois do envio.
- API principal:
  - `GET /api/orbits?user=<id>&box=received|sent|all`
  - `GET /api/orbits/summary?user=<id>`
  - `POST /api/orbits`
  - `POST /api/orbits/:id/seen`
  - `POST /api/orbits/:id/opened`
  - `POST /api/orbits/:id/dismiss`
  - `POST /api/orbits/:id/check-listens`
- Persistencia duravel existe via Neon/Postgres quando `DATABASE_URL` ou
  `POSTGRES_URL` esta configurado; sem banco, dev usa fallback em memoria.
- `listenUrl` prioriza `member.platform.primary`; catalogo e `externalIds`
  servem como fallback/match, nao como origem de playback.
- Criacao valida membros conhecidos, bloqueia autoenvio e exige identidade
  utilizavel da faixa.
- Frontend nao deve persistir listas completas de Orbits no Zustand.
- `/circle?tab=orbits` usa identidade inicial estavel `leo` ate hidratacao do
  usuario canonico, evitando loading infinito em deep link fria.

## Validacoes Recentes

- Performance web em 2026-06-09: Browser in-app `390x844` validou Home fria e
  quente, Stats, Orbita, Ajustes, scroll, modal de historico, LeoHeader, vinil,
  tonearm e palcos orbitais. Resultado: zero overflow horizontal, imagens
  quebradas ou `warn/error` de console.
- Producao foi confirmada servindo `assets/index-CA5CelhI.js` a partir do
  frontend `60b4aac`; Speed Insights estava ativo.
- Checks da rodada de performance: frontend `npm run lint`,
  `npm run build:report` e `git diff --check`; API `npm run check` com 61 testes
  na rodada do backend.
- Premium 430 em 2026-06-04: Browser in-app `430x932` validou `/`, `/stats`,
  `/circle`, `/circle?tab=orbits`, `/circle?tab=arena`, `/ranking`,
  `/circle?tab=duels`, `/circle?tab=affinity`, `/alike` e `/settings` sem
  overflow horizontal, imagens visiveis quebradas ou `warn/error` novo apos
  estabilizacao.
- Foram testados Bottom Bubble, letra, filtros Stats, Replay `plays/min`,
  grafico temporal, modal de artista, composer de Orbits sem envio,
  filtros/Batalha da Arena, troca de amigo no Alike e chips seguros de Ajustes.
- Acoes destrutivas de Ajustes nao foram executadas.
- Checks finais registrados nessa rodada: frontend `git diff --check`,
  `npm run lint` e `npm run build`; API `git diff --check` e `npm run check`.
