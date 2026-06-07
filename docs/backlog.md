# stats.lc Backlog Tecnico

Backlog vivo e curto. Regras ativas ficam em `AGENTS.md`; estado atual fica em
`docs/current-state.md`.

## Alta

1. Corrigir warning de chunking entre `src/store/useStatsStore.ts` e
   `src/services/statsService.ts`.
   - Separar helpers puros ou adaptador fino para reduzir acoplamento circular.

2. Reduzir assinaturas amplas do Zustand.
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

## Baixa

1. Criar guia visual pequeno para novas secoes da Home.
2. Revisar rota/tab legada para Circle, sem quebrar links antigos.
3. Avaliar code splitting adicional apenas se houver lentidao real medida.
4. Padronizar badges e alturas responsivas da Home, especialmente
   `Seus Destaques`, `ReplaySection` e popover de contagens do LeoHeader.
