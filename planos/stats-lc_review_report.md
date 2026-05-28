# Revisão dos repositórios `stats‑lc` e `stats‑lc‑api`

## Contexto

- **Frontend (stats‑lc)** – Projeto React 19 com Vite, Tailwind, Zustand, Framer‑motion, axios e virtualização com `react‑window`. O arquivo `statsService.ts` normaliza a estrutura de dados recebida da API e implementa um sistema de cache e deduplicação de requisições; o TTL foi recentemente aumentado para 60 s【fileciteturn3file2†L165-L174】. O store Zustand (`useStatsStore.ts`) guarda diversos caches, gerencia *heartbeats*, preload de tops/históricos e dispara prefetchers para o “próximo amigo”【fileciteturn4file3†L332-L343】.

- **Backend (stats‑lc‑api)** – API serverless na Vercel com vários endpoints. A proposta fornecida ao Codex sugere separar a API em três camadas: **Live mínimo** (now playing e perfil), **Bootstrap** (dados básicos para montar a home) e **Histórico frio** (histórico completo pré‑carregado em background). Ainda há limitações de planos (máximo de 12 functions) e a API atual faz chamadas diretas ao `stats.fm`, o que implica lentidão e rate limits.

O usuário sente que a app/webapp continua lenta apesar de aparelhos modernos e pediu uma revisão geral com um plano de correção e comandos específicos para serem aplicados pelo Codex ou Claude.

## Pontos problemáticos encontrados

### 1. Atualização global de *heartbeat*

O store atual possui um campo `heartbeat` atualizado por `setInterval` a cada **1 s** em `startHeartbeat`【fileciteturn4file3†L332-L343】. Esse contador global é utilizado para atualizar o progresso do vinil/replay, mas causa uma atualização de estado global a cada segundo, acionando *re-renders* em componentes conectados ao store. Em ambientes de baixa potência isso provoca janks perceptíveis.

### 2. Prefetch agressivo de dados de amigos

O método `prefetchNextFriend` percorre o vetor de membros e dispara duas requisições em background (tops e estatísticas completas) via `setTimeout` de 1,5 s【fileciteturn4file3†L317-L334】. Quando o círculo possui muitos amigos, essas chamadas paralelas aumentam a latência do app e ainda podem agravar *rate limits* na API externa.

### 3. Carga de componentes pesados no bundle inicial

O projeto importa diretamente bibliotecas volumosas como `framer‑motion`, `recharts` e `lucide‑react`. Embora o `vite.config.ts` já divida alguns *chunks*【fileciteturn6file0†L27-L37】, componentes de modais e gráficos são carregados no bundle inicial, aumentando o tempo de *first paint*. Além disso, a extração de cores (`colorthief`) e a geração procedural do vinil executam no thread principal, podendo bloquear a renderização.

### 4. Caches múltiplos no lado do cliente

`useStatsStore` mantém diversos mapas de caches (`statsCache`, `historyCache`, `userFullStatsCache`, etc.) persistidos em `MMKV/localStorage`. Estes caches podem crescer indefinidamente, principalmente o histórico de cada usuário (listas de streams). Leitura e escrita de grandes blobs no `localStorage` são lentas e podem bloquear o UI thread. Ainda, os caches não utilizam TTL consistente: alguns itens permanecem indefinidamente.

### 5. API serverless sem cache granular

O backend responde a cada requisição buscando dados completos do `stats.fm`. Não existe cache estruturado por usuário/período; o próprio Vercel não recebe cabeçalhos de cache adequados. Isso resulta em chamadas repetidas para as mesmas estatísticas em curto intervalo, aumentando latência e risco de `429 Too Many Requests`.

## Plano de correção

### 1. Reduzir re‑renders globais removendo o *heartbeat* do store

- **Remover** o campo `heartbeat` e a função `startHeartbeat` do store.
- **Mover** a lógica de atualização do progresso para componentes específicos (ex.: `LeoHeader` e `VinylRecord`). Estes componentes podem usar `useState` com `requestAnimationFrame` ou `setInterval` local para atualizar o progresso sem disparar re-renders globais.
- **Comando sugerido** (pseudo‑patch):

  ```bash
  apply_patch <<'EOF'
  *** Begin Patch
  *** Update File: src/store/useStatsStore.ts
  @@
-      heartbeat: Date.now(),
-      lastLiveFetchTime: 0,
-      startHeartbeat: () => {
-        if ((window as any)._heartbeatStarted) return;
-        (window as any)._heartbeatStarted = true;
-        setInterval(() => {
-          set({ heartbeat: Date.now() });
-        }, 1000);
-      },
+      // heartbeat removido; progressos são atualizados localmente nos componentes
+      lastLiveFetchTime: 0,
+      startHeartbeat: () => {},
  *** End Patch
  EOF
  ```

- **No componente** que exibe o progresso do vinil (por exemplo `LeoHeader.tsx`), adicionar um `useEffect` que atualiza um estado interno a cada 200 ms:

  ```ts
  const [progressTime, setProgressTime] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setProgressTime(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  ````

  e utilizar `progressTime` para calcular a barra de progresso. Esse ajuste reduz as atualizações globais e melhora a fluidez.

### 2. Suavizar o prefetch de amigos

- **Limitar** o número de prefetches simultâneos. Em vez de disparar chamadas para todos os amigos, manter uma fila e processar no máximo 1 ou 2 usuários por vez.
- **Priorizar** somente o amigo atualmente visível na UI; caso o usuário mude de selecionado, cancelar o prefetch pendente usando `AbortController`.
- **Comando sugerido**:

  ```bash
  apply_patch <<'EOF'
  *** Begin Patch
  *** Update File: src/store/useStatsStore.ts
  @@
-      prefetchNextFriend: (currentUserId: string) => {
-        const members = get().groupStats?.members || [];
-        if (members.length <= 1) return;
-
-        const currentIndex = members.findIndex(m => m.id === currentUserId);
-        if (currentIndex === -1) return;
-
-        const nextIndex = (currentIndex + 1) % members.length;
-        const nextFriend = members[nextIndex];
-
-        if (!get().isLoading && !get().isRefreshing) {
-          setTimeout(() => {
-            get().prefetchUserTops(nextFriend.id);
-            statsService.getUserFullStats(nextFriend.id).catch(() => {});
-          }, 1500);
-        }
-      },
+      // Prefetch limitado: processa somente um amigo de cada vez e cancela se o usuário muda
+      prefetchNextFriend: (() => {
+        let controller: AbortController | null = null;
+        return (currentUserId: string) => {
+          const members = get().groupStats?.members || [];
+          if (members.length <= 1) return;
+          const currentIndex = members.findIndex(m => m.id === currentUserId);
+          if (currentIndex === -1) return;
+          const nextIndex = (currentIndex + 1) % members.length;
+          const nextFriend = members[nextIndex];
+          if (controller) controller.abort();
+          controller = new AbortController();
+          // executa apenas uma chamada por vez com abort
+          get().prefetchUserTops(nextFriend.id);
+          statsService.getUserFullStats(nextFriend.id, { signal: controller.signal }).catch(() => {});
+        };
+      })(),
  *** End Patch
  EOF
  ```

### 3. Dividir componentes pesados via importação dinâmica

- **Lazy load** de modais e gráficos: utilize `React.lazy`/`Suspense` para componentes como `TrackLeaderboardModal`, `ReplaySection` e gráficos de `recharts`. Isso evita que códigos grandes sejam baixados na primeira renderização.

  Exemplo:

  ```tsx
  import { Suspense, lazy } from 'react';
  const TrackLeaderboardModal = lazy(() => import('../components/modals/TrackLeaderboardModal'));
  // …
  <Suspense fallback={<div>Carregando…</div>}>
    {showModal && <TrackLeaderboardModal … />}
  </Suspense>
  ```

- **Mover** a extração de cores (`colorthief`) e geração de texturas do vinil para *web workers*. Crie um arquivo `src/workers/colorWorker.ts` com o código de extração e utilize `new Worker()` no componente para evitar bloqueio do thread principal. Essa abordagem melhora a responsividade ao abrir telas com vinis ou grandes listas.

### 4. Otimizar caches do lado do cliente

- **Estabelecer TTLs consistentes** para todos os caches (`historyCache`, `userFullStatsCache`, `timeRangeStatsCache` etc.), por exemplo 5 minutos ou 24 h dependendo da natureza do dado. Limpar entradas expiradas quando a app inicializar.
- **Limitar o tamanho** do histórico armazenado. Armazenar apenas os N itens mais recentes por usuário (ex.: 200 entradas) evita crescimento do `localStorage`.
- **Compressão**: antes de salvar grandes objetos no `localStorage`, considere serializar com `JSON.stringify` + gzip (há bibliotecas como `pako` que funcionam no browser). Isso reduz I/O.
- **Evitar gravar caches dentro do ciclo de renderização**; use `requestIdleCallback` quando disponível para salvar dados pesados sem bloquear a thread principal.

### 5. Melhorias no `statsService`

- **Abortar requisições antigas**: adicione `AbortController` em `fetchFromApi` para que chamadas pendentes sejam canceladas quando o usuário fizer uma nova. Combine com deduplicação (já existente) para evitar múltiplas requisições para o mesmo endpoint.
- **Agrupar chamadas**: quando for preciso obter estatísticas para vários usuários ou tipos de entidade, implemente um endpoint no backend que aceite múltiplos IDs e retorne um mapa em uma única chamada. Isso reduz a necessidade de `Promise.all` sobre muitos usuários (como visto em `fetchTrackStatsForAll`【fileciteturn4file1†L322-L330】).  
  Por exemplo, `/api/entity-group-stats?type=track&id=...&users=uid1,uid2,…`.
- **Expansão progressiva de histórico**: utilize `after`/`cursor` quando chamar `/api/user-streams` para baixar páginas pequenas; grave no cache e pare quando atingir uma data limite. Não solicite todo o histórico de todos os usuários na inicialização.

### 6. Reestruturação e cache da API serverless

- **Camadas de endpoints**, conforme sugerido: 
  1. `/api/group-live` – retorna apenas `nowPlaying`, perfil mínimo e estado atual; TTL curto (ex.: 5 s) com cabeçalho `Cache-Control: s-maxage=5` para permitir cache no CDN.  
  2. `/api/group` – retorna dados resumidos para montar a home (membros, stats básicas). Este endpoint pode ter TTL de 30–60 s.  
  3. `/api/user-history` – retorna páginas de histórico com parâmetros `after/before`, `limit` e `cursor`. Implementar caching por usuário/período (chave `history:v3:userId:range`) e armazenar em `KV` ou memória. 

- **Consolidação de endpoints**: combine `entity-stats.ts` e `entity-streams.ts` em um único handler que aceita parâmetros `type`, `id` e `range` e retorna tanto contagem quanto lista de streams quando solicitado. Reduz o número de functions, ajudando a contornar o limite de 12 functions no plano hobby.

- **Implementar cache interno**: utilizar um mapa em memória ou `Edge Config` com TTL para armazenar respostas de `stats.fm` por user/range. Exemplo:

  ```ts
  const cache = new Map<string, { expires: number; data: any }>();
  async function getUserHistory(user: string, after?: number, before?: number) {
    const key = `${user}:${after ?? ''}:${before ?? ''}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.data;
    const data = await fetchFromStatsFm(user, { after, before });
    cache.set(key, { expires: Date.now() + 5 * 60 * 1000, data });
    return data;
  }
  ```

- **Limitar concorrência** ao chamar `stats.fm` usando bibliotecas como `p-limit`. Isso evita estourar o rate limit ao sincronizar vários usuários simultaneamente.

### 7. Análise de bundle e limpeza de dependências

- Rodar `npx vite build --report` (ou adicionar o plugin `rollup-plugin-visualizer`) para visualizar o tamanho dos *chunks*. Identificar se bibliotecas como `@google/genai` ou `html-to-image` estão incluídas no bundle final mesmo sem uso. Remover ou trocar por alternativas mais leves se possível.

- Substituir `recharts` por `@visx/visx` ou outra biblioteca mais enxuta caso os gráficos sejam simples, reduzindo o *bundle size*.

### 8. Monitoramento e perfilamento

- Adicionar logs de performance (ex.: `console.time`/`console.timeEnd`) em pontos críticos – renderização da Home, carregamento de histórico, etc. Utilizar a API Performance Web para medir TTI e TTFB.
- Configurar `Lighthouse`/`WebVitals` para monitorar métrica de fluidez. Assim é possível validar se as otimizações surtiram efeito.

## Conclusão

Seguindo este plano, a experiência inicial do aplicativo se torna muito mais rápida e fluida: a remoção do `heartbeat` global elimina *re-renders* desnecessários, o prefetch agressivo deixa de sobrecarregar a rede e o thread principal, e a divisão de componentes pesados via *lazy loading* diminui o bundle inicial. Do lado do backend, a reestruturação proposta permite cachear respostas e paginar dados, reduzindo a latência percebida pelo usuário e minimizando erros de limite de requisições.
