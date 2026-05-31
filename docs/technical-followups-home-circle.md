# Technical Follow-ups: Home, Circle, Routing, and Runtime Stability

Este documento registra pontos técnicos observados durante a estabilizacao de navegacao/runtime do `stats-lc`. A ideia e servir como backlog posterior, com nomes reais de arquivos, telas e secoes do app.

## 1. Resolver o warning Vite de chunking em `useStatsStore.ts`

**Sintoma atual**

O build ainda emite:

```text
src/store/useStatsStore.ts is dynamically imported by src/services/statsService.ts
but also statically imported by ...
dynamic import will not move module into another chunk.
```

**Arquivos envolvidos**

- `src/store/useStatsStore.ts`
- `src/services/statsService.ts`
- consumidores estaticos como `src/App.tsx`, `src/components/Layout.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/StatsScreen.tsx`, `src/screens/RankingScreen.tsx`, `src/screens/AlikeScreen.tsx`

**Risco**

O warning nao quebra runtime, mas neutraliza parte do code splitting e pode aumentar o bundle inicial. Tambem indica acoplamento circular entre service layer e store.

**Direcao tecnica**

Separar a responsabilidade usada por `statsService.ts` em uma dependencia que nao importe o store inteiro. Exemplos:

- mover helpers puros para um modulo sem React/Zustand;
- passar callbacks/dados do store para o service por parametro;
- criar um adaptador fino para cache/persistencia sem import dinamico de `useStatsStore.ts`.

## 2. Remover assinaturas amplas do Zustand fora de Ranking/Alike

**Sintoma atual**

Alguns componentes ainda usam `useStatsStore()` sem selector individual, o que faz o componente assinar o store inteiro. Isso aumenta renders e pode reintroduzir problemas de snapshot instavel no Zustand 5/React 19.

**Arquivos a revisar**

- `src/screens/StatsScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/components/shared/CommonUI.tsx`
- `src/components/shared/MusicCard.tsx`
- `src/components/home/HomeHighlights.tsx`
- `src/components/home/HomeInsights.tsx`
- `src/components/home/FriendsMonthlyHighlights.tsx`
- `src/components/modals/CircleActivityModal.tsx`
- `src/components/modals/TrackLeaderboardModal.tsx`

**Padrao desejado**

Usar selectors escalares/estaveis:

```ts
const groupStats = useStatsStore(state => state.groupStats);
const hiddenUsers = useStatsStore(state => state.hiddenUsers);
```

Evitar selectors que retornem objetos/arrays novos:

```ts
// evitar
useStatsStore(state => ({ groupStats: state.groupStats, hiddenUsers: state.hiddenUsers }));
useStatsStore(state => getVisibleMembers(state.groupStats, state.hiddenUsers));
```

Derivar listas fora do selector:

```ts
const members = useMemo(
  () => getVisibleMembers(groupStats, hiddenUsers),
  [groupStats, hiddenUsers]
);
```

## 3. Padronizar cancelamento de requests em effects

**Sintoma atual**

Varias telas disparam chamadas async e fazem `setState` ao resolver. Em navegacao rapida, isso pode atualizar estado depois da rota desmontar.

**Arquivos/secoes a revisar**

- `src/screens/HomeScreen.tsx`: Replay, modais, prefetch, refresh/live cycle
- `src/screens/StatsScreen.tsx`: carregamento de rankings/top items/graficos
- `src/screens/RankingScreen.tsx`: `statsService.getRankings(...)`
- `src/screens/AlikeScreen.tsx`: derivacoes de afinidade se evoluirem para fetch
- `src/components/history/FriendHistoryCard.tsx`: historico inline
- `src/components/home/FriendsMonthlyHighlights.tsx`: `Promise.allSettled` de top items por membro

**Direcao tecnica**

Usar uma destas abordagens de forma consistente:

- flag `cancelled` local em effects simples;
- `AbortController` quando o service aceita `signal`;
- cleanup que invalide resposta antiga antes de chamar `setState`.

## 4. Evoluir `CircleScreen` sem redesign grande

**Estado atual**

`src/screens/CircleScreen.tsx` funciona como wrapper controlado com abas:

- `Ranking`: renderiza `RankingScreen`
- `Duelos`: placeholder curto
- `Afinidade`: renderiza `AlikeScreen`

Rotas mantidas:

- `/circle`
- `/ranking`
- `/alike`

**Proximos incrementos seguros**

- transformar a aba `Duelos` em superficie real usando a rivalidade semanal existente de `RankingScreen`;
- evitar duplicar logica de ranking/duelo entre `RankingScreen` e `CircleScreen`;
- se o chunk `CircleScreen-*.js` crescer demais, lazy-loadar `RankingScreen` e `AlikeScreen` dentro das abas.

## 5. Melhorar modelo de rotas legadas

**Estado atual**

- `/ranking` abre Circle na aba `Ranking`;
- `/alike` abre Circle na aba `Afinidade`;
- `/circle` abre Circle na aba `Ranking`;
- bottom nav aponta apenas para `/circle`.

**Possivel melhoria posterior**

Adicionar uma rota/tab sem quebrar compatibilidade, por exemplo:

- `#/circle/ranking`
- `#/circle/duels`
- `#/circle/affinity`

Ou usar query/hash interno:

- `#/circle?tab=ranking`
- `#/circle?tab=affinity`

**Cuidado**

Nao remover `/ranking` e `/alike` enquanto existirem links externos, favoritos ou historico do usuario apontando para essas rotas.

## 6. Revisar keys em telas secundarias e modais

**Ja tratado na Home/reload**

Foram revisadas keys de:

- `src/components/home/HomeHighlights.tsx`
- `src/components/home/ReplaySection.tsx`
- `src/components/home/ReplayModals.tsx`
- `src/components/history/FriendHistoryCard.tsx`
- `src/components/home/LeoHeader.tsx`
- `src/components/home/UserSelectorModal.tsx`
- `src/components/home/UserSelectorExplosion.tsx`

**Ainda vale revisar depois**

- `src/components/modals/TrackLeaderboardModal.tsx`
- `src/components/modals/UserModals.tsx`
- `src/components/modals/UserHistoryModal.tsx`
- `src/components/modals/AlbumDetailModal.tsx`
- `src/components/stats/FriendsStatsComparer.tsx`
- listas internas de `src/screens/StatsScreen.tsx`

**Padrao recomendado**

Para usuarios:

```ts
key={user.id}
```

Para tracks/history:

```ts
key={`track-${track.id || track.name}-${playedAt || endTime || position}`}
```

Para album/artist/replay:

```ts
key={`album-${album.id || album.name}-${index}`}
key={`artist-${artist.id || artist.name}-${index}`}
```

O objetivo e evitar duplicacao acidental sem esconder duplicacao real de membros.

## 7. Unificar estados de loading, empty e error

**Sintoma atual**

Cada tela usa um padrao proprio de loading/empty/error. Isso torna mais facil aparecer uma tela parcialmente montada em rede lenta ou cache invalido.

**Secoes impactadas**

- Home: replay, timeline, friend activity, insights
- Stats: highlights, top lists, charts
- Circle/Ranking: rankings por periodo, weekly rivalry, modais de batalha
- Circle/Afinidade: empty state de conexoes/featured user
- Ajustes: listas de membros e ordenacao de historico

**Direcao tecnica**

Criar componentes pequenos e reutilizaveis, sem redesign:

- `SectionLoadingState`
- `SectionEmptyState`
- `SectionErrorState`

Manter o visual atual, mas padronizar texto, altura minima e acoes de retry.

## 8. Sanear cache persistido de forma centralizada

**Sintoma atual**

O app ja se recupera de alguns estados invalidos, mas a sanitizacao aparece espalhada entre store, selectors e telas.

**Arquivos envolvidos**

- `src/store/useStatsStore.ts`
- `src/lib/memberSelectors.ts`
- `src/services/statsCacheService.ts`
- `src/services/statsService.ts`

**Dados sensiveis a inconsistencias**

- `groupStats.members`
- `groupStats.users`
- `featuredUserId`
- `hiddenUsers`
- `historyCustomOrder`
- caches de top items/historico por usuario

**Direcao tecnica**

Consolidar uma funcao pura de sanitizacao de estado persistido:

- canonicalizar membros por `id`;
- validar se `featuredUserId` existe;
- deduplicar arrays de ids;
- preservar campos ricos (`nowPlaying`, `avatar`, `name`, `stats`, `recent`, `topItems`);
- descartar apenas payload estruturalmente invalido.

## 9. Melhorar observabilidade em dev

**Estado atual**

`RouteErrorBoundary` agora loga erro original, stack e component stack em dev.

**Possiveis melhorias**

Adicionar logs dev-only com contexto de rota/tela para:

- falhas de `statsService.getRankings(...)`;
- falhas de replay em `HomeScreen`;
- recuperacao de `featuredUserId` invalido;
- cache persistido invalido;
- chunk/lazy import error.

**Formato sugerido**

```ts
console.warn('[RankingScreen] rankings fetch failed', {
  activeRange,
  rankingType,
  memberCount: members.length,
  error,
});
```

## 10. Revisar code splitting das abas do Circle

**Estado atual**

`CircleScreen` importa `RankingScreen` e `AlikeScreen` diretamente, entao a rota Circle tende a carregar as duas experiencias juntas.

**Quando mexer**

So vale otimizar se o bundle da Circle crescer ou se a navegacao inicial para `/circle` ficar perceptivelmente lenta.

**Direcao tecnica**

Lazy-load por aba:

- `RankingScreen` apenas quando a aba `Ranking` estiver ativa;
- `AlikeScreen` apenas quando a aba `Afinidade` estiver ativa;
- manter fallback curto, como `Carregando seção`, para nao gerar tela preta.

## 11. Registrar decisoes visuais recentes da Home

**Contexto**

Durante o polimento mobile da Home, algumas correcoes resolveram bugs reais de splash, progresso ao vivo, scroll e sobreposicao visual. Estes pontos devem virar regra de manutencao para evitar regressao quando `HomeScreen`, `LeoHeader` ou `HomeInsights` forem mexidos de novo.

**Home boot / splash**

- Manter apenas a splash estatica do `index.html`.
- Evitar recriar splash visual dentro de `src/screens/HomeScreen.tsx`.
- Depois que a Home libera a interface, ela nao deve voltar para splash por causa de refresh/live update.
- Em carregamento lento, preferir placeholder neutro/altura estavel a alternar blocos visuais que causam flicker.

**`LeoHeader` / progresso ao vivo**

- A barra de progresso nao deve depender da identidade inteira de `nowPlaying`.
- Evitar `key` dinamica no fill da barra de progresso, porque isso remonta a animacao e reinicia visualmente.
- O progresso deve partir de snapshot estavel com `playbackKey`, `trackId`, `progressMs`/`playedMs`, `durationMs` e `receivedAt`.
- `LeoHeader` pode atualizar o progresso localmente; nao usar heartbeat global do store para isso sem uma razao forte.
- A mascara/fade do titulo da musica so deve existir quando o titulo realmente precisa rolar. Em texto estatico, ela corta a primeira letra.

**`Seus Destaques` em `HomeScreen`**

- Padrao visual atual:
  - posicao do ranking = numero grande branco sobre a imagem;
  - metrica/playcount = badge laranja separada;
  - artistas mostram minutos no texto inferior;
  - evitar badge preta/circular para posicao nessa secao.
- `Top artistas`, `Top musicas` e `Top albuns` devem manter a mesma altura vertical para nao gerar salto entre abas internas.
- Ainda vale evoluir a altura fixa atual para medida responsiva por viewport/container.

**`Perceptions`**

- Nao deixar `Perceptions` colado em `Seus Destaques`; manter respiro vertical claro entre as secoes.
- Se a secao ganhar mais conteudo, preservar swipe horizontal sem capturar scroll vertical da pagina.

**`Insights do Dia`**

- A intencao visual e orbita, nao grid simples de cards.
- A composicao orbital precisa ficar contida no container para nao atravessar viewport nem travar scroll.
- Se voltar a usar cards orbitando, limitar `left/right/top/bottom`, `overflow` e `z-index` para nao invadir `Stats Alike` ou o footer.

**Filtros / carrosseis**

- Filtros principais (`hoje`, `semana`, `mes`, `ano`, `tudo`) e meses devem funcionar como carrossel horizontal no mobile.
- Areas com `data-home-horizontal-scroll="true"` devem aceitar gesto horizontal, mas preservar scroll vertical quando o gesto principal for vertical.

**Pendencias relacionadas**

- Padronizar badges entre `Seus Destaques`, `ReplaySection` e o popover de contagens do `LeoHeader`.
- Reduzir custo de animacoes e imagens nas secoes da Home com lazy/priority por bloco.
- Criar um pequeno guia visual da Home se novas secoes forem adicionadas, para evitar cada ajuste recriar um padrao diferente.

## Ordem sugerida de ataque

1. Corrigir o warning Vite de `useStatsStore.ts`.
2. Revisar assinaturas amplas do Zustand em `StatsScreen` e `SettingsScreen`.
3. Padronizar cancelamento de fetch em `HomeScreen`, `StatsScreen` e `FriendsMonthlyHighlights`.
4. Revisar keys em modais e `StatsScreen`.
5. Evoluir a aba `Duelos` dentro de `CircleScreen`.
6. Consolidar sanitizacao de cache persistido.
7. Padronizar badges e alturas responsivas das secoes visuais da Home.
