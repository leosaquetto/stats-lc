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

## Performance e iOS

- O bundle inicial e Home sao chunks separados. `npm run build:report` aplica
  os orcamentos de 160 kB gzip para a entrada e 500 kB gzip para todo o JS.
- `window.__STATS_LC_PERFORMANCE__` expoe amostras leves de Home pronta,
  navegacao, long tasks e long animation frames para validacao.
- Vercel Speed Insights usa amostragem de 20%.
- O shell Capacitor fica em `ios/`, usa `com.leosaquetto.statslc`, scheme
  `statslc://`, safe areas existentes e pausa/retoma o polling pelo ciclo de
  vida nativo. Use `npm run cap:sync` antes de abrir no Xcode.

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
