# stats.lc Backlog Tecnico

Backlog vivo e curto. Regras ativas ficam em `AGENTS.md`; estado atual fica em
`docs/current-state.md`.

## Alta

1. Reduzir o custo frio de `/api/group`.
   - Snapshot de 2026-06-09: payload de aproximadamente `161 kB` e trabalho de
     origem acima de 4 s em uma resposta que depois foi servida stale.
   - Manter payload retrocompativel, cache/stale e a proibicao de
     `/api/home-bundle`.
   - Medir por secao antes de remover ou adiar qualquer campo.

2. Reduzir assinaturas amplas do Zustand restantes.
   - Revisar `StatsScreen`, `SettingsScreen`, `CommonUI`, `MusicCard`,
     `HomeHighlights`, `HomeInsights`, `FriendsMonthlyHighlights`,
     `CircleActivityModal` e `TrackLeaderboardModal`.
   - Usar selectors escalares e derivar arrays/objetos com `useMemo`.

3. Padronizar cancelamento de requests em effects.
   - Revisar `HomeScreen`, `StatsScreen`, `RankingScreen`, `AlikeScreen`,
     `FriendHistoryCard` e `FriendsMonthlyHighlights`.
   - Preferir `AbortController` quando o servico suportar `signal`; usar flag
     `cancelled` quando o efeito for local.

4. Sanear cache persistido de forma centralizada.
   - Validar `groupStats.members`, `groupStats.users`, `featuredUserId`,
     `hiddenUsers`, `historyCustomOrder` e caches por usuario.
   - Nao persistir `topItems`, historicos, full stats, Orbits completos ou
     arrays pesados no frontend.

5. Criar um teste de regressao de performance repetivel.
   - Medir Home fria/quente, abertura de modal e trocas de rota em `390x844`.
   - Registrar asset principal, bundle, requests, console, overflow e imagens
     quebradas.
   - Manter resultados do Browser in-app como direcionais; validar fps real
     somente quando houver ambiente/aparelho compativel.

## Media

1. Unificar loading/empty/error.
   - Criar componentes pequenos como `SectionLoadingState`,
     `SectionEmptyState` e `SectionErrorState`.
   - Manter visual atual, mas padronizar altura minima, retry e copy curta.

2. Revisar keys em modais e telas secundarias.
   - Focar `TrackLeaderboardModal`, `UserModals`, `UserHistoryModal`,
     `AlbumDetailModal`, `FriendsStatsComparer` e listas internas da Stats.

3. Auditar gestos reais de Bottom Bubble e Letras.
   - Validar drag para baixo, swipe horizontal e fechamento em touch real ou
     Browser confiavel.
   - Se ainda houver engasgo, investigar re-render interno do modal antes de
     refatorar a Home.

4. Evoluir Circle sem redesign grande.
   - Manter `/circle`, `/ranking` e `/alike`.
   - Fortalecer Duelos com dados existentes antes de criar feature nova.
   - Considerar lazy-load por aba apenas se o chunk crescer ou houver medida
     real de lentidao.

5. Melhorar observabilidade em dev.
   - Logs dev-only com contexto para rankings, replay, `featuredUserId`
     invalido, cache invalido, chunk errors e fallbacks de dados temporais.

6. Investigar Long Animation Frames pos-boot em ambiente confiavel.
   - O Browser in-app registrou ruido alto mesmo em rotas simples.
   - Reproduzir em Chrome Performance/Safari ou aparelho real antes de atribuir
     custo a uma animacao protegida.

7. Preparar a fase Expo somente quando ela for iniciada.
   - Definir estrategia para reaproveitar a webapp/API sem reescrever a UI por
     impulso.
   - Mapear safe areas, deep links, ciclo de vida, background e distribuicao.
   - Nao tratar Xcode ou simulador como bloqueio da fase web atual.

## Baixa

1. Criar guia visual pequeno para novas secoes da Home.
2. Revisar rota/tab legada para Circle, sem quebrar links antigos.
3. Avaliar code splitting adicional apenas se houver lentidao real medida.
4. Padronizar badges e alturas responsivas da Home, especialmente
   `Seus Destaques`, `ReplaySection` e popover de contagens do LeoHeader.
5. Reavaliar os orcamentos de `160 kB` entry e `500 kB` total apenas quando uma
   feature nova justificar crescimento medido.
