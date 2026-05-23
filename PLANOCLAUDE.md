# Plano De Correção Do `stats-lc`

## Resumo

Produção em `appstatslc.leosaquetto.com` está online em Vercel e o app carrega em desktop/mobile. O foco da correção é alinhar o frontend ao contrato da API, estabilizar identidade de usuários, preservar dados ricos entre `/api/group` e `/api/group-live`, corrigir pontos mobile e reduzir riscos de build/performance.

## Contrato E Identidade

- Usar `member.id` como identidade canônica do frontend: `UserStats.id`, `GroupStats.users`, `featuredUserId`, `hiddenUsers`, ranking, cache, analytics e seleção de usuário.
- Preservar `member.key` apenas como metadata opcional recebida da API, por exemplo `UserStats.key?: string`, sem exibir na UI e sem usá-la como chave principal.
- Não remover nem proibir `key` do contrato, porque `/api/group-live` e `/api/entity-group-stats` documentam esse campo.
- Para chamadas novas à API, enviar preferencialmente o ID stats.fm em `user`/`users`. Não quebrar endpoints que já aceitam aliases/custom IDs.
- Atualizar `normalizeMember` para retornar `id: member.id`; se `member.id` não existir, ignorar o membro e registrar warning apenas em DEV.
- Atualizar `normalizeGroupStats` para indexar `users` por `user.id`, preservando `members` na ordem recebida.
- Adicionar campos opcionais ao tipo `UserStats`: `key`, `catalogSummary`, `errors`, `recent`, e garantir que `topItems`/`tops` continuem normalizados.
- Respeitar o contrato de plataforma: `member.platform` é plataforma primária do usuário; `nowPlaying.platformCandidate` é contexto do item.
- Não usar `externalIds` para inferir origem de playback; eles servem só para catálogo/discovery.
- Manter metadata de cache/stale/cooldown fora dos payloads normais; só consumir em `/api/health` ou debug explícito.

## Correções Funcionais

- Corrigir `fetchGroupLive` para mesclar dados live sem apagar dados ricos já carregados por `/api/group`.
- Se `/api/group-live` retornar um membro ainda inexistente no store, inserir em `users` e `members` usando `member.id`.
- Corrigir `getRankings` para usar `response.rankings` quando disponível; cair para `members[].stats` apenas como fallback.
- Ajustar `/api/entity-group-stats`: consumir `members[].id` como chave principal e usar `key` apenas como alias auxiliar quando necessário.
- Criar helper `getUserApiParam(userOrId)` para centralizar qual identificador enviar em `/api/user`, `/api/top`, `/api/user-streams`, `/api/stats`, `/api/stats-cardinality`, `/api/stats-dates`, `/api/entity-streams` e `/api/compare`.
- Criar helper `getUserCacheKey(userOrId)` para garantir que caches usem sempre o mesmo identificador canônico.
- Migrar estado persistido antigo: ao carregar Zustand/localStorage, se houver IDs antigos/aliases conhecidos, converter para `member.id` após o primeiro `/api/group`.
- Unificar cache persistido: escolher Zustand persist como fonte principal e manter o mock MMKV apenas como camada de compatibilidade/migração.
- Remover invalidação assíncrona dentro de getters de cache; getters devem ser puros. Criar ação explícita `pruneExpiredCaches()`.
- Tornar `isOffline` seguro com helper `isBrowserOnline()`, evitando acesso direto a `navigator` fora do browser.
- Corrigir refresh manual da Home para chamar `fetchGroup(true)` quando o usuário quer atualização completa; manter `fetchGroupLive()` para polling leve.
- Renomear textos/configurações de “push notifications” para “notificações locais do navegador”, ou implementar Web Push real com subscription/server.

## UI Mobile

- Validar e corrigir mobile em `390x844` e `375x667`.
- Garantir que todas as rotas iniciem no topo após navegação HashRouter.
- Reservar padding inferior suficiente para a bottom nav fixa em Home, Stats, Arena, Alike e Ajustes.
- Corrigir casos em que a bottom nav cobre conteúdo acionável, especialmente em Stats e Ajustes.
- Revisar carrosséis horizontais para que o overflow seja intencional, suave e sem corte estranho.
- Revisar controles segmentados da Arena em `375px`; se não couberem, permitir scroll horizontal claro ou quebrar em duas linhas.
- Revisar botão flutuante “SINCRONIZADO” em Stats para não competir com a bottom nav.
- Na Home, reduzir vazio visual e garantir que a primeira viewport indique claramente a continuidade do conteúdo.
- Substituir elementos decorativos com offsets negativos por wrappers locais com `overflow-hidden` quando necessário.
- Verificar que `member.key` não aparece em texto visível, labels, badges, tooltips ou debug UI em produção.

## Performance E Build

- Corrigir import de `react-virtualized-auto-sizer` em `StatsScreen`: usar import nomeado e remover `@ts-ignore`.
- Lazy-load das rotas principais com `React.lazy` e `Suspense`.
- Reduzir dependência do agregador `src/components/MusicUI.tsx` quando ele impedir code splitting.
- Remover imports estáticos que anulam dynamic imports, especialmente modais pesados.
- Avaliar remoção de dependências não usadas ou duplicadas: `@google/genai`, `@react-navigation/native`, `@shopify/flash-list`, `framer-motion`/`motion`, `react-native-mmkv`.
- Corrigir `SmartImage`: resetar `loading/error` quando `src` muda, adicionar `alt` útil e mapear classes Tailwind dinâmicas para classes explícitas.
- Corrigir comentário corrompido em `vite.config.ts`.
- Se o chunk principal continuar acima de `500 kB`, adicionar `manualChunks` para gráficos, motion, rotas e modais.

## Testes

- `npm run lint`.
- `npm run build`.
- Teste unitário para `normalizeMember`: quando payload contém `key` e `id`, `UserStats.id` deve ser `member.id` e `key` deve ser opcional/pass-through.
- Teste unitário para `normalizeGroupStats`: `users` deve ser indexado por IDs stats.fm.
- Teste para migração de estado antigo: `featuredUserId`, `hiddenUsers`, caches e `historyCustomOrder` convertem aliases antigos para IDs canônicos.
- Teste para `fetchGroupLive`: dados live atualizam `nowPlaying` sem apagar `topItems`, `recent`, stats agregadas ou campos de perfil já existentes.
- Teste para `getRankings`: prioriza `response.rankings` e usa `id` como chave.
- Teste para `entity-group-stats`: usa `members[].id` como chave primária.
- Teste visual/mobile manual em Home, Stats, Arena, Alike e Ajustes nos viewports `390x844` e `375x667`.

## Critérios De Aceite

- Nenhuma tela usa `member.key` como identidade principal.
- `member.key` pode continuar existindo como metadata recebida da API, sem aparecer na UI.
- Chamadas novas usam ID stats.fm sempre que possível.
- Ranking, seleção de usuário, histórico, top items, comparação e cache seguem funcionando após migração.
- Live polling não apaga dados ricos carregados pela rota completa.
- Mobile não tem overflow horizontal global, não tem conteúdo acionável escondido pela bottom nav e cada rota começa no topo.
- Build passa sem warning de import quebrado do AutoSizer.
- Bundle principal reduzido ou warning documentado com justificativa.
