# stats.lc Backlog Tecnico

Backlog resumido. Use este arquivo para follow-ups; regras ativas ficam em `AGENTS.md`.

## Prioridade Alta

1. Corrigir warning de chunking entre `src/store/useStatsStore.ts` e `src/services/statsService.ts`.
   - Separar helpers puros ou adaptador fino para evitar acoplamento circular.

2. Reduzir assinaturas amplas do Zustand.
   - Revisar `StatsScreen`, `SettingsScreen`, `CommonUI`, `MusicCard`, `HomeHighlights`, `HomeInsights`, `FriendsMonthlyHighlights`, `CircleActivityModal` e `TrackLeaderboardModal`.
   - Usar selectors escalares e derivar arrays/objetos com `useMemo`.

3. Padronizar cancelamento de requests em effects.
   - Revisar `HomeScreen`, `StatsScreen`, `RankingScreen`, `AlikeScreen`, `FriendHistoryCard` e `FriendsMonthlyHighlights`.
   - Usar flag `cancelled` ou `AbortController`.

4. Unificar loading/empty/error.
   - Criar componentes pequenos como `SectionLoadingState`, `SectionEmptyState` e `SectionErrorState`.
   - Manter visual atual, mas padronizar altura minima e retry.

5. Sanear cache persistido de forma centralizada.
   - Validar `groupStats.members`, `groupStats.users`, `featuredUserId`, `hiddenUsers`, `historyCustomOrder` e caches por usuario.

## Prioridade Media

1. Revisar keys em modais e telas secundarias.
   - `TrackLeaderboardModal`, `UserModals`, `UserHistoryModal`, `AlbumDetailModal`, `FriendsStatsComparer` e listas internas da Stats.

2. Evoluir Circle sem redesign grande.
   - Manter `/circle`, `/ranking` e `/alike`.
   - Transformar Duelos em superficie real usando dados existentes.
   - Considerar lazy-load por aba se o chunk crescer.

3. Melhorar observabilidade em dev.
   - Logs dev-only com contexto para rankings, replay, featuredUserId invalido, cache invalido e chunk errors.

4. Padronizar badges e alturas responsivas da Home.
   - Especialmente `Seus Destaques`, `ReplaySection` e popover de contagens do LeoHeader.

## Prioridade Baixa

1. Criar guia visual pequeno para novas secoes da Home.
2. Revisar rota/tab legada para Circle, sem quebrar links antigos.
3. Avaliar code splitting adicional apenas se houver lentidao real medida.
