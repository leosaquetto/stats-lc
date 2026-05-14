# Auditoria técnica completa — `stats-lc`

## 1. Resumo executivo
- O app está funcional como frontend Vite/React e **já aponta somente para** `https://statslc.leosaquetto.com` em `src/services/statsService.ts`.
- A base visual está forte (glass/iOS-like), porém há riscos técnicos relevantes em: tipagem (`any` excessivo), heurísticas de plataforma conflitantes, possível renderização/re-renders custosos em `src/components/MusicUI.tsx`, e documentação/build desatualizados.
- O contrato novo do backend está **parcialmente preservado**: campos críticos (`durationMs`, `playedMs`, `platformCandidate`, `catalogAvailability`, `externalIds`) entram no mapeamento; ainda há pontos de coerência semântica a revisar (ex.: `platformCandidate` sendo usado como badge de usuário em histórico).

## 2. Estado atual do app
- Stack detectada: React 19 + Vite 6 + Zustand + Tailwind v4 + animações com `motion/react`.
- Rotas principais:
  - `/` Home
  - `/stats`
  - `/ranking`
- Polling global em `App.tsx` (60s), com refresh manual separado.
- Persistência em `localStorage` via Zustand `persist` para `groupStats` e `lastFetchTime`.

## 3. Arquitetura detectada
- `src/services`: camada de API e utilidades centrais de domínio.
- `src/store/useStatsStore.ts`: estado global (grupo, loading, erro, offline).
- `src/components/MusicUI.tsx`: concentrador grande de UI/regras de apresentação (monolítico).
- `src/screens/*`: composição por página.
- `src/lib/time.ts`: utilidades de data/hora SP.

## 4. Mapa de arquivos
- Config/infra: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `README.md`.
- Entrada/app: `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/constants.tsx`.
- Domínio: `src/types/stats.ts`, `src/services/statsService.ts`, `src/services/statsCore.ts`, `src/store/useStatsStore.ts`, `src/lib/time.ts`.
- Telas: `src/screens/HomeScreen.tsx`, `src/screens/StatsScreen.tsx`, `src/screens/RankingScreen.tsx`.
- Componentes: `src/components/Layout.tsx`, `src/components/MusicUI.tsx`.

## 5. Auditoria arquivo por arquivo

## `package.json`
1) Função: definição de scripts/dependências.
2) Principais: `dev`, `build`, `lint`.
3) Dependências relevantes: React, Zustand, Axios, Tailwind, Motion.
4) Consome dados: N/A.
5) Produz dados: build artefato (`dist`).
6) Possíveis bugs: libs web/mobile misturadas sem uso claro.
7) Estado/cache: indireto (depende de Zustand middleware).
8) Performance: bundle pode inflar com dependências não usadas.
9) Mobile: dependências RN sugerem confusão de target.
10) A11y: N/A.
11) Duplicações: `motion` + `framer-motion` simultâneos.
12) Código morto/suspeito: `@google/genai`, `@react-navigation/native`, `@shopify/flash-list`, `react-native-mmkv`, `react-window` ecosystem (parcialmente usado), tipos de libs potencialmente ociosos.
13) Sugestão: fazer auditoria de imports reais e remover pacotes não usados.
14) Prioridade: **alta**.
15) Executor: **Gemini (app)**.

## `vite.config.ts`
- Boa base para app estático.
- `loadEnv` é carregado e não usado (`env` morto).
- Alias `@` aponta para raiz do projeto (`.`), funcional mas menos restritivo que `src`.
- Prioridade: **baixa** (higiene).
- Executor: **Gemini (app)**.

## `tsconfig.json`
- `allowJs: true` e `skipLibCheck: true` reduzem segurança tipada.
- Sem `strict` explícito; para evolução segura, habilitar gradualmente.
- Prioridade: **média**.
- Executor: **Gemini (app)**.

## `index.html`
- Tem metas iOS básicas (`apple-mobile-web-app-capable`, status bar).
- Faltam elementos PWA completos (manifest, ícones Apple touch, etc.).
- `user-scalable=no` pode prejudicar acessibilidade (zoom).
- Prioridade: **média** (a11y/UX iOS).
- Executor: **Gemini (app)**.

## `README.md`
- Desalinhado com o projeto atual: descreve Gemini/AI Studio e `GEMINI_API_KEY`, não condiz com frontend que consome backend próprio.
- Prioridade: **alta**.
- Executor: **Gemini (app)**.

## `src/main.tsx`
- Bootstrap padrão React com `StrictMode`.
- Sem problemas relevantes.
- Prioridade: **baixa**.

## `src/App.tsx`
- Faz fetch inicial `fetchStats(true)` (force=true) e polling 60s com `fetchStats(false)`.
- ✅ Alinhado com requisito force manual vs polling.
- Risco: em React StrictMode, efeitos duplicados em dev podem gerar double-call percebido durante desenvolvimento.
- Prioridade: **baixa**.

## `src/store/useStatsStore.ts`
- Persistência localStorage correta (`persist` + `partialize`).
- Separa `isLoading` (inicial) e `isRefreshing` (refresh), bom.
- `isOffline` pode coexistir com erros reais; UI atual tende a suavizar erro quando já existe cache (tradeoff válido, mas pode mascarar incidentes).
- Não desmonta componentes no refresh: positivo.
- Prioridade: **média** (estratégia de erro/offline).

## `src/services/statsService.ts`
- Base URL única: `https://statslc.leosaquetto.com`.
- Não foram encontrados endpoints externos proibidos (`api.stats.fm`, `raw.githubusercontent`, `allorigins`, `cors-anywhere`) no código auditado.
- Preserva novos campos no mapeamento de grupo:
  - `member.platform.primary/confidence` (via `platform: m.platform`)
  - `nowPlaying.durationMs`, `playedMs`, `track.durationMs`, `platformCandidate`, `track.externalIds`, `track.catalogAvailability`
- `fetchRecent` retorna `any[]`; tipagem fraca.
- `console.log("GROUP RESPONSE", data)` em produção pode vazar volume no console.
- Prioridade: **alta** (tipos/observabilidade).

## `src/services/statsCore.ts`
- Contém utilitários de formatação, fallbacks e inferências.
- Ponto crítico: `detectCatalogAvailability` infere plataforma por `spotifyId/appleMusicId` e host de imagem (`mzstatic`, `scdn.co`).
  - Isso pode conflitar com a nova fonte `member.platform.primary` quando usado fora do contexto de catálogo.
- Uso correto esperado: `catalogAvailability` para links de catálogo, não para “plataforma do usuário”.
- Prioridade: **alta**.

## `src/types/stats.ts`
- Modelagem cobre parte do contrato novo, mas ainda há `any` e lacunas:
  - `TopItem.track.externalIds?: any`, `catalogAvailability?: any`.
  - faltam interfaces nomeadas para contrato unificado.
- Prioridade: **alta** (segurança de contrato).

## `src/lib/time.ts`
- Utilitários úteis para SP com `Intl`.
- `toSaoPauloDate` declara conversão mas retorna `date` sem transformação real (nome potencialmente enganoso).
- `console.log` de debug executa sempre.
- Comentários já admitem limitação de rigor temporal.
- Prioridade: **média**.

## `src/components/Layout.tsx`
- Estrutura mobile-first com tab bar flutuante.
- Risco de safe-area: usa `pb-8`, mas não há uso explícito de `env(safe-area-inset-bottom)`.
- Acessibilidade: botões/links com foco visual limitado e alguns labels pequenos.
- Prioridade: **média**.

## `src/components/MusicUI.tsx`
- Arquivo grande/central, mistura UI + regra de negócio + fetching modal.
- Usa `motion/react`; `framer-motion` em `package.json` parece redundante se não importado.
- Progresso/duração:
  - lógica de progresso condicionada a `isNowPlaying` (bom);
  - quando sem `durationMs`, cai em estado shimmer para live (comportamento intencional, validar se desejado para “last played”).
  - duração formatada `m:ss` via `formatDurationSmart` (ok).
  - duração é ocultada quando ausente em pontos principais (ok).
- Riscos:
  - performance por componente monolítico/extenso;
  - potencial de re-render alto por closures e props não memoizadas em muitas subárvores;
  - acessibilidade: várias imagens com `alt=""` e botões sem `aria-label`.
- Prioridade: **alta**.

## `src/screens/HomeScreen.tsx`
- Implementa Home, Amigos em Sintonia e Histórico da Sessão.
- Amigos em Sintonia:
  - ordena live primeiro (ok);
  - exibe 4 cards (`slice(0,4)`) sem scroll horizontal desnecessário na seção principal (ok).
- Histórico da Sessão:
  - inicia compacto, expande por usuário (ok);
  - expandido chama `fetchRecent(user.id, 5)` (ok);
  - modal de histórico completo usa 50 + offset (ok para “buscar mais”);
  - loading local por card/modal (ok), não recarrega Home inteira.
- Ponto de atenção:
  - usa `item.platformCandidate || user.platform` para badge no histórico; `platformCandidate` é do nowPlaying/contexto de faixa e pode confundir “plataforma do usuário”.
- Prioridade: **alta**.

## `src/screens/StatsScreen.tsx`
- Estatísticas com filtro e battle.
- `fullUserData` em `any` e múltiplos casts enfraquecem robustez.
- Busca local + fetch global pode duplicar chamadas em cenários de navegação rápida.
- Prioridade: **média**.

## `src/screens/RankingScreen.tsx`
- Ranking com range e modal de detalhe.
- `rankingsData` tipado frouxo (`Record<string, any>`).
- Ordenação muta array (`displayUsers.sort`) após mapeamento local (ok prático, mas manter imutabilidade explícita é melhor).
- Prioridade: **média**.

## `src/constants.tsx`
- SVGs de logo embutidos, sem problemas críticos.
- Prioridade: **baixa**.

## `src/index.css`
- Tailwind v4 + utilitários customizados.
- Fontes externas de terceiros no runtime (Google + onlinewebfonts) podem causar FOIT/FOUT e risco de disponibilidade.
- `body { overflow-hidden; }` combinado com layout interno scrollável é intencional, mas pode impactar comportamento iOS em edge-cases de teclado/zoom.
- Prioridade: **média**.

## 6. Problemas críticos
1. **Ambiguidade semântica de plataforma** (usuário vs faixa) em pontos da Home/histórico com `platformCandidate`.
   - Impacto: badge incorreta, leitura errada do usuário.
   - Executor: Gemini (app).
2. **Tipagem incompleta do contrato backend novo** (`any` em tipos e respostas).
   - Impacto: regressões silenciosas ao evoluir API.
   - Executor: Gemini (app).

## 7. Problemas altos
- `README.md` desatualizado para stack/fluxo real.
- Dependências possivelmente não usadas/duplicadas.
- `MusicUI.tsx` grande demais (manutenção, risco de bug colateral, difícil otimização).
- Inferência de plataforma por imagem/IDs ainda ativa em utilitários centrais.

## 8. Problemas médios
- Safe-area e a11y (zoom bloqueado, labels pequenos, `alt` vazio excessivo).
- Logs de debug em produção (`time.ts`, `statsService.ts`).
- Config TypeScript permissiva para fase de crescimento.

## 9. Melhorias visuais sugeridas
- Aplicar `padding-bottom: calc(2rem + env(safe-area-inset-bottom))` na navegação fixa.
- Ajustar contraste em textos `< 10px` e estados cinza para não-live.
- Microinterações: reduzir animação infinita onde status não-live.
- Garantir truncamento inteligente sem cortar informações críticas de música/artista em telas estreitas.

## 10. Melhorias de dados/API sugeridas
- Consolidar regra: badge de usuário deve vir de `member.platform.primary`; `platformCandidate` só contexto de execução atual.
- Usar `track.catalogAvailability` exclusivamente para render de links/botões de catálogo.
- Definir adapter tipado para `/api/group`, `/api/recent`, `/api/user`, `/api/top`, `/api/stats`, `/api/entity-stats`.

## 11. Melhorias de performance
- Fatiar `MusicUI.tsx` por domínio e memoizar componentes de lista com props estáveis.
- Revisar animações contínuas e `AnimatePresence` aninhados em listas.
- Verificar custo de imagens grandes com blur e múltiplas camadas em mobile Safari.
- Considerar virtualização somente onde lista cresce de fato; evitar overhead onde há poucos itens.

## 12. Melhorias de tipos
Sugestão de interfaces (em `src/types/stats.ts` ou `src/types/api.ts`):
- `PlatformInfo { primary; confidence; source? }`
- `CatalogAvailability { appleMusic: boolean; spotify: boolean }`
- `Track { ... externalIds: ExternalIds; catalogAvailability: CatalogAvailability }`
- `RecentItem { id; playedAt; durationMs?; playedMs?; track: Track; platformCandidate? }`
- `GroupMember { id; profile; platform: PlatformInfo; nowPlaying?; stats }`
- `UserStats` (front shape final)
- `PlaybackStatus { status: 'live'|'recent'|'idle'; label: string; timestamp?: string }`

## 13. Limpeza de dependências
Dependências suspeitas (verificar manualmente antes de remover):
- Provável remoção: `@google/genai`, `@react-navigation/native`, `@shopify/flash-list`, `react-native-mmkv`, `@types/react-virtualized-auto-sizer` (se não exigido), `@types/react-window` (confirmar necessidade).
- Duplicidade provável: manter **ou** `motion` **ou** `framer-motion` conforme import real.

## 14. Preparação para Vercel
- Estado atual: apto a build estático (`npm run build`, saída `dist`).
- Env vars: aparentemente não obrigatórias para runtime da API (base fixa no código).
- Recomendar `vercel.json` simples apenas se necessário para headers/cache/history fallback (SPA).
- Atualizar README com passos reais de deploy Vercel para Vite.

## 15. Sugestão de roadmap em fases
1. **Fase 1 (Crítica/Alta):** tipagem de contrato + semântica de plataforma + limpeza de logs.
2. **Fase 2 (Alta):** decompor `MusicUI.tsx` e padronizar adapters de API.
3. **Fase 3 (Média):** UX mobile Safari/safe-area/a11y.
4. **Fase 4 (Média/Baixa):** limpeza de dependências e hardening de TSConfig.

## 16. Lista de prompts futuros para Gemini
1. “Refatore `src/types/stats.ts` removendo `any` e implementando interfaces `PlatformInfo`, `CatalogAvailability`, `Track`, `RecentItem`, `GroupMember`, `UserStats`, `PlaybackStatus`.”
2. “Separe `src/components/MusicUI.tsx` em `components/music`, `components/modals`, `components/layout` sem alterar UI/UX final.”
3. “Padronize badges de plataforma: usar `member.platform.primary` para usuário e `platformCandidate` apenas para contexto de faixa.”
4. “Melhore safe-area iOS e acessibilidade (zoom, aria-label, contraste) mantendo visual premium glass.”
5. “Atualize README para Vite+Vercel estático com backend `https://statslc.leosaquetto.com`.”

## 17. Lista de prompts futuros para Codex/backend (se depender da API)
1. “Confirmar contrato estável e versionado para campos `platform`, `nowPlaying`, `track.externalIds`, `track.catalogAvailability`, `recent[].playedMs`.”
2. “Documentar formalmente exemplos de payload para `/api/group` e `/api/recent` com e sem campos opcionais.”
3. “Definir semântica oficial de `platformCandidate` vs `member.platform.primary` para evitar ambiguidades de frontend.”

## 18. Checklist final de validação
- [x] App chama apenas `https://statslc.leosaquetto.com` (base URL detectada).
- [x] Não foram encontrados endpoints proibidos citados.
- [x] Campos novos principais do backend aparecem no mapeamento atual.
- [x] Polling usa `force=false`; refresh manual usa `force=true`.
- [x] Histórico expandido usa `limit=5`; histórico completo usa `limit=50` + `offset`.
- [x] Persistência Zustand em `localStorage` detectada.
- [ ] Verificar manualmente em runtime se animações/progresso e cortes de layout ocorrem em todos os dispositivos móveis.
- [ ] Verificar manualmente consumo real de todas dependências antes de remoção.

---

## Observações de incerteza (“verificar manualmente”)
- Comportamento visual exato no Safari iOS (safe-area, tab bar, blur pesado) depende de validação em dispositivo real.
- Se `framer-motion` é usado indiretamente por outra integração, confirmar antes de remover.
- Confirmar se algum payload de backend usa formatos alternativos além dos mapeados atualmente.

---

## 19. Achados adicionais (não incluídos antes, com maior granularidade)

### 19.1 Riscos funcionais específicos
1. `totalStreams` em `statsService.getGroupData` é preenchido com `m.stats?.month?.streams` e não lifetime.
   - Risco: cards/comparações podem exibir “total” mensal sem deixar explícito.
   - Prioridade: **alta**.
   - Executor: **Gemini (app)**.

2. Em `HomeScreen`, `LEO_ID` depende do primeiro membro quando `leo` não existe no payload.
   - Risco: regras de exclusão/filtros podem deslocar semântica do “Leo” em cenários de payload incompleto.
   - Prioridade: **média**.
   - Executor: **Gemini (app)**.

3. `fetchRecent` usa mapeamento especial só para `leo`; outros IDs passam crus.
   - Risco: inconsistência caso backend normalize IDs alternativos em caixa/alias.
   - Prioridade: **média**.
   - Executor: **Gemini (app)** + **Codex/backend (se padronização exigir API)**.

### 19.2 Riscos de UX e estado
1. `isLoading` é usado visualmente em alguns botões onde o ideal seria `isRefreshing`.
   - Risco: feedback visual impreciso durante refresh incremental.
   - Prioridade: **média**.

2. Eventos globais `window.dispatchEvent('openHistory')` para navegação modal interna.
   - Risco: acoplamento implícito, difícil rastrear e testar.
   - Prioridade: **média**.

3. Botões críticos sem `aria-label` (ex.: close modal “×”, refresh-only icon).
   - Risco: navegabilidade por leitor de tela reduzida.
   - Prioridade: **alta**.

### 19.3 Riscos de performance adicionais
1. `console.log` frequentes em fluxo quente (`GROUP RESPONSE`, `MAIN MEMBER`, init de `time.ts`).
   - Risco: ruído e custo em produção/mobile debug remoto.
   - Prioridade: **média**.

2. `SmartImage` monta fallback externo (`ui-avatars`) em tempo real.
   - Risco: chamadas extras de rede para placeholders, latência e dependência de terceiro.
   - Prioridade: **média**.

3. `TrackLeaderboardModal`/`UserDetailModal` carregam dados ao abrir sem cache local dedicado.
   - Risco: repetição de requests em abre/fecha frequente.
   - Prioridade: **média**.

### 19.4 Pontos de contrato API para validar manualmente
- Confirmar se `recent[].platformCandidate` existe sempre ou apenas em cenários live/recentes.
- Confirmar se `recent[].playedMs` representa progresso no momento do scrobble ou no fim da reprodução.
- Confirmar se `track.externalIds.spotify/appleMusic` pode vir vazio/`null` mesmo com IDs primários preenchidos.
- Confirmar semântica de `member.platform.confidence` (faixa de valores esperada).

## 20. Blocos de correção sugeridos por prioridade (sem implementar agora)

### Bloco A — Crítico/Alto (primeiro)
- Corrigir semântica de plataforma (usuário vs track).
- Fortalecer tipos do contrato novo (eliminar `any` estratégico).
- Corrigir campos estatísticos ambíguos (`totalStreams`).
- Hardening de acessibilidade mínima (`aria-label`, zoom, contraste textual).

### Bloco B — Alto/Médio
- Decompor `MusicUI.tsx` por domínio (music/modals/layout).
- Reduzir logs de produção e criar utilitário de logger por ambiente.
- Ajustar feedback visual para `isRefreshing` vs `isLoading`.

### Bloco C — Médio
- Revisão de dependências instaladas vs usadas.
- Melhorar safe-area iOS e fallback de fontes/imagens.
- Introduzir cache local simples para modais de detalhe.

## 21. Prompt pronto (diagnóstico + execução segura)

### Para Gemini (frontend)
"Faça uma correção incremental em 3 PRs: (1) tipos + plataforma + `totalStreams` sem mudar UI, (2) a11y/safe-area/logs sem alterar design visual, (3) decomposição de `MusicUI.tsx` mantendo comportamento. Não altere endpoints nem backend. Gere diff mínimo e checklist de regressão por tela (`/`, `/stats`, `/ranking`)."

### Para Codex/backend (se necessário)
"Documente contrato oficial de `platform` e `platformCandidate`, incluindo exemplos reais de `/api/group` e `/api/recent` com campos opcionais. Informe garantias de presença/tipo para `durationMs`, `playedMs`, `externalIds`, `catalogAvailability`."


## 22. Melhorias de design premium (detalhadas)

### 22.1 Direção visual (sem mudar identidade atual)
- **Hierarquia tipográfica:** reduzir uso de caixa alta em textos longos e reservar uppercase para labels/metadata; melhora legibilidade em 360–390px.
- **Escala consistente:** padronizar uma escala (`8/10/12/14/18/24`) para evitar micro-variações de fonte que cansam leitura.
- **Contraste contextual:** aumentar contraste de `text-white/20` e `text-white/30` em cards não-live para preservar estética sem perder leitura.

### 22.2 Glass/iOS refinado
- **Glass com profundidade por camada:**
  - camada base: blur suave + borda translúcida;
  - camada destaque: brilho leve apenas em cards ativos/live;
  - evitar glow forte em todos elementos para não “achatar” hierarquia.
- **Ruído sutil opcional (overlay estático):** melhora percepção premium do vidro sem custo alto de animação.

### 22.3 Home (LeoHero/LeoHeader)
- **Capa desfocada:** aplicar limite de opacidade progressivo para evitar texto “lavado” em capas claras.
- **Badge de plataforma:** manter sempre na mesma posição/layout para evitar “saltos” visuais quando dados mudam.
- **Play count e horário:** apresentar em linha secundária única com separadores fixos (•) para reduzir quebra de linha.
- **Barra de progresso:** transição curta (200–300ms) em updates; sem shimmer quando status não-live.

### 22.4 Amigos em Sintonia
- **Grid 4 colunas estável:** garantir largura mínima por card com truncamento previsível (`nome` > `track` > `artist`).
- **Não-live legível:** desaturar imagem, mas manter texto com contraste AA mínimo.
- **Estado live primeiro:** adicionar micro-indicador consistente (dot + label curta) em todos cards live.

### 22.5 Histórico da Sessão
- **Card compacto inicial:** manter título + último evento + horário curto; expandir só metadados relevantes.
- **Modal 50 itens:** incluir cabeçalho “fixo” com contexto do usuário e ação de fechar com área de toque maior.
- **Buscar mais:** mostrar contador incremental (ex.: “50 carregadas”) para feedback de progresso.

### 22.6 Microinterações e motion
- Reduzir animações infinitas para elementos informativos (usar só quando live).
- Uniformizar curvas e duração (`spring` ou `ease`, não ambos sem necessidade) para percepção mais coesa.
- Em listas, preferir fade+slide leve ao invés de sequências com atraso alto em muitos itens.

### 22.7 Mobile Safari / safe-area
- Aplicar `padding-bottom` com `env(safe-area-inset-bottom)` na tab bar e no conteúdo scrollável final.
- Testar comportamento com barra de endereço expandida/retraída e teclado aberto.
- Evitar elementos acionáveis encostados na borda inferior sem zona de respiro.

### 22.8 Acessibilidade visual e interação
- Garantir alvos de toque >= 44px para ícones de ação primária (refresh/close/nav).
- Incluir `aria-label` em botões só-ícone.
- Revisar textos `<=9px` para casos não decorativos.
- Permitir zoom do usuário quando possível (avaliar impacto de `user-scalable=no`).

### 22.9 Priorização de design (execução sugerida)
- **Alta:** contraste de texto, safe-area real, `aria-label`, consistência de badge/plataforma/progresso.
- **Média:** refinamento de tipografia e espaçamento, padronização de motion, melhoria de modal histórico.
- **Baixa:** overlays de ruído e ajustes cosméticos adicionais de glass.

### 22.10 Dono da implementação
- **Gemini (app):** todos os ajustes de UI/UX, motion, safe-area, a11y e consistência visual.
- **Codex/backend:** somente se surgir necessidade de novos campos de payload para enriquecer estados de UI.

## 23. Sugestão de funções novas (frontend)

> Objetivo: reduzir duplicação, melhorar tipagem e previsibilidade sem alterar endpoints.

### 23.1 `services/adapters/groupAdapter.ts`
1. `mapGroupResponseToGroupStats(payload: GroupApiResponse): GroupStats`
   - Centraliza todo mapeamento de `/api/group`.
   - Prioridade: **alta**.
   - Dono: **Gemini (app)**.

2. `mapNowPlaying(raw: GroupMemberNowPlaying): NowPlaying | undefined`
   - Isola fallback de `isNow`, `timestamp`, `durationMs`, `playedMs`.
   - Prioridade: **alta**.

3. `mapTrack(raw: ApiTrack): Track`
   - Preserva `externalIds`, `catalogAvailability`, `durationMs` com tipo forte.
   - Prioridade: **alta**.

### 23.2 `services/platform.ts`
1. `resolveUserPlatform(member: GroupMember): PlatformInfo`
   - Fonte única para badge de plataforma do usuário (`member.platform.primary`).
   - Prioridade: **crítica**.

2. `resolveTrackPlatformCandidate(nowPlaying?: NowPlaying): PlatformInfo | null`
   - Uso exclusivo para contexto da faixa atual; evita confusão com plataforma do usuário.
   - Prioridade: **alta**.

3. `shouldShowCatalogLink(track: Track, provider: 'spotify'|'appleMusic'): boolean`
   - Encapsula regra de exibição baseada em `catalogAvailability` + IDs.
   - Prioridade: **alta**.

### 23.3 `utils/format.ts`
1. `formatDurationClock(ms?: number | null): string | null`
   - Retorna `m:ss` ou `null` se ausente.
   - Prioridade: **alta**.

2. `formatPlayCountPtBr(count: number): string`
   - Pluralização única para todo app.
   - Prioridade: **média**.

3. `formatLastPlayedLabel(ts?: string): string`
   - Padroniza “ouvindo agora / X min atrás / ontem hhHmm”.
   - Prioridade: **média**.

### 23.4 `store/selectors.ts`
1. `selectMembersSortedByLive(members: UserStats[]): UserStats[]`
   - Remove duplicação de sort em telas.
   - Prioridade: **média**.

2. `selectLeoMember(groupStats: GroupStats | null): UserStats | undefined`
   - Resolve fallback de Leo de forma explícita/testável.
   - Prioridade: **média**.

3. `selectRecentWithoutCurrentLive(recent: RecentItem[], nowPlaying?: NowPlaying): RecentItem[]`
   - Evita repetição da mesma faixa no histórico.
   - Prioridade: **alta**.

### 23.5 `hooks/`
1. `useGroupPolling({ intervalMs = 60000 })`
   - Encapsula polling e regras `force=true/false`.
   - Prioridade: **média**.

2. `useUserHistory(userId: string, pageSize = 50)`
   - Controla loading, offset, paginação e cache local de histórico completo.
   - Prioridade: **alta**.

3. `usePlaybackProgress(params)`
   - Centraliza cálculo de progresso live (`playedMs`, `durationMs`, fallback por timestamp).
   - Prioridade: **alta**.

### 23.6 `components` helpers
1. `getMusicCardA11yLabel({ userName, songName, artistName, status }): string`
   - Gera `aria-label` consistente em cards.
   - Prioridade: **alta**.

2. `getPlatformBadgeProps(platform: PlatformInfo)`
   - Padroniza ícone, cor, label e fallback de plataforma.
   - Prioridade: **média**.

3. `getSafeAreaBottomPadding(extra = 32): string`
   - Helper de estilo para tab bar/containers finais.
   - Prioridade: **média**.

### 23.7 Funções candidatas para testes unitários prioritários
- `resolveUserPlatform`
- `resolveTrackPlatformCandidate`
- `shouldShowCatalogLink`
- `formatDurationClock`
- `selectRecentWithoutCurrentLive`
- `usePlaybackProgress` (com fake timers)

### 23.8 Bloco de execução recomendado
- **PR 1 (alta prioridade):** adapters de API + plataforma + formatadores de duração/horário.
- **PR 2:** selectors + hooks de histórico/polling/progresso.
- **PR 3:** helpers de acessibilidade e safe-area, sem mudar UI final.

## 24. Verificação de funções quebradas e áreas vazias

### 24.1 Resultado da verificação técnica executada
- **`npm run lint`**: falhou no ambiente atual por ausência de módulos instalados (`Cannot find module ...`, `vite: not found`).
- **`npm run build`**: também falhou pelo mesmo motivo (dependências não instaladas no ambiente de execução).
- Conclusão: não foi possível validar runtime/build end-to-end aqui sem `npm install` prévio.

### 24.2 Funções/áreas com risco de quebra (estática)
1. **Tipagem muito permissiva (`any`) em caminhos críticos**
   - Arquivos: `src/services/statsService.ts`, `src/services/statsCore.ts`, `src/screens/HomeScreen.tsx`, `src/components/MusicUI.tsx`.
   - Risco: payload inesperado quebrar render silenciosamente.
   - Prioridade: **alta**.

2. **Fallbacks silenciosos em erros de API**
   - Ex.: `fetchRecent` retorna `[]` no erro.
   - Risco: “área vazia” parecer ausência de dados quando é falha de integração.
   - Prioridade: **alta**.

3. **Blocos vazios/estado vazio sem diagnóstico explícito**
   - Textos genéricos detectados: “Vazio”, “Sem dados”, “Sem dados para este período”.
   - Risco: baixa observabilidade para usuário e debug.
   - Prioridade: **média**.

4. **Dependência de campos opcionais sem guardas fortes em toda árvore**
   - Ex.: múltiplos acessos a `track.*` e arrays de artistas com casting dinâmico.
   - Risco: quebra em itens incompletos de histórico/top.
   - Prioridade: **alta**.

### 24.3 Áreas vazias a validar manualmente (UI)
- Home: cards de histórico quando `recent` falha (diferenciar erro vs vazio real).
- Stats: seção Top Artistas quando `fullUserData.tops` não existe.
- Modais: listas com imagem/artista ausente e fallback visual/textual.
- Ranking: caso `rankingsData` venha vazio mas `members` exista.

### 24.4 Funções novas recomendadas para prevenir quebras/áreas vazias
1. `isValidTrack(track: unknown): track is Track`
   - Valida shape mínimo antes de render.
2. `toSafeArtists(artists: unknown): string[]`
   - Normaliza lista de artistas para evitar `map` em valor inválido.
3. `toUiEmptyState(reason: 'no_data'|'api_error'|'offline')`
   - Mensagem/ícone/ação padronizados por causa da área vazia.
4. `guardRecentItems(items: unknown): RecentItem[]`
   - Sanitiza resposta de `/api/recent`.
5. `withApiFallback<T>(promise, fallback, context)`
   - Centraliza fallback + logging contextual (sem silenciar erro crítico).

### 24.5 Checklist objetivo de validação sugerido (após instalar deps)
- Rodar `npm install`.
- Rodar `npm run lint` e classificar erros por categoria (ambiente/tipo/código).
- Rodar `npm run build`.
- Validar manualmente estados `loading/error/empty` em `/`, `/stats`, `/ranking` com backend indisponível e disponível.
- Testar payload parcial (sem `track.image`, sem `artists`, sem `durationMs`).
