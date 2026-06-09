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
