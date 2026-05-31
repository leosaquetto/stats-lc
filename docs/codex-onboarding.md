# Codex Onboarding For stats.lc

Use este arquivo para iniciar uma nova janela do Codex sem precisar redescobrir o projeto.

## Projeto

- Repo: `/Users/leosaquetto/Developer/GitHub/stats-lc`
- App: frontend web/mobile do `stats.lc`, feito com Vite, React 19, Tailwind, Zustand, Motion e API via `src/services/statsService.ts`.
- Experiencia principal: Home mobile com `LeoHeader`, vinil, ranking summary, atividade do circulo, replay e seletores de usuario.
- API em desenvolvimento: o Vite usa o proprio origin local; em producao o frontend fala com `https://statslc.leosaquetto.com`.

## Como Comecar

1. Entre no repo:

   ```bash
   cd /Users/leosaquetto/Developer/GitHub/stats-lc
   ```

2. Veja estado atual antes de editar:

   ```bash
   git status --short
   ```

3. Suba o servidor:

   ```bash
   npm run dev
   ```

   O script ja sobe em `0.0.0.0:3000`, entao o app fica em:

   - `http://localhost:3000/`
   - `http://192.168.0.8:3000/` para testar no iPhone na mesma rede.

4. Validacoes normais:

   ```bash
   npm run lint
   npm run build
   git diff --check
   ```

   `npm run lint` e `npm run build` sao as validacoes principais. O build pode avisar sobre chunks grandes e imports dinamicos; isso ja existia e nao necessariamente bloqueia a entrega.

## Regra De Ouro

Antes de otimizar ou redesenhar, prove que o bug nao e:

1. API antiga/deploy antigo.
2. Cache/chunk velho.
3. Request loop.
4. Selector Zustand instavel.
5. Fallback vazio na Home.
6. Timeout upstream stats.fm.

Nao resolver sintomas visuais antes de checar console, network e curls.

## Nao Fazer Sem Autorizacao Explicita

- Redis/KV.
- Cache em memoria no backend.
- Service worker/Workbox.
- Offline PWA.
- CSP bloqueante.
- Troca de Recharts.
- Troca agressiva de `lucide-react` para imports internos.
- `/api/home-bundle`.
- Refatoracao ampla do store.
- Redesign de vinis.
- Duelos/Circle feature nova.
- Light mode.

## Navegador In-App

- Usar o in-app browser do Codex quando o usuario pedir inspecao visual.
- URL padrao: `http://localhost:3000/`.
- Para comparar com o celular do Leo, usar viewport mobile proxima do iPhone 16e: `390 x 844`.
- Se a ferramenta de browser/CDP falhar, nao gastar muito tempo brigando com ela quando `lint` e `build` ja passaram; avisar claramente.
- O usuario autorizou testes visuais nesta conversa, mas em novas janelas confirme a intencao antes de rodar verificacao visual demorada, porque ele ja pediu em outro momento para nao fazer teste visual sem autorizacao.

## Fluxo De Trabalho Preferido

- Implementar direto quando o pedido for claro.
- Antes de editar, ler os arquivos relevantes com `rg`/`sed`.
- Nao reverter mudancas existentes do usuario.
- Usar `apply_patch` para edicoes manuais.
- Manter o trabalho estreito: corrigir o que foi pedido sem refatorar o app inteiro.
- Depois de mudancas de UI, validar no minimo com `npm run lint`; usar `npm run build` quando a alteracao mexer em componentes centrais.

## Arquivos-Chave

- `src/screens/HomeScreen.tsx`: composicao da Home, pull-to-refresh, splash/loading, portal de modais, atividade do circulo, replay.
- `src/components/home/LeoHeader.tsx`: header principal, estado reproduzindo/ocioso, vinil, progresso, ranking summary, botao/popover de contagens.
- `src/components/home/VinylRecord.tsx`: vinil, texturas procedurais, tonearm, transparencia/plastico.
- `src/components/home/UserSelectorExplosion.tsx`: seletor visual de usuarios.
- `src/components/modals/TrackLeaderboardModal.tsx`: ranking de faixa/artista/album e selecao de artistas secundarios.
- `src/services/statsService.ts`: normalizacao da API, cache de requests, shape de `nowPlaying`.
- `src/store/useStatsStore.ts`: store Zustand, `fetchGroup`, `fetchGroupLive`, throttling/cache local.
- `src/lib/colorUtils.ts`: cor dominante/fallback via canvas local cacheado; nao reintroduza `colorthief` para a Home/vinis.
- `src/lib/artistUtils.ts`: prioridade de artista principal. Regra importante: quando existir `albumArtist`, ele deve vencer a ordem instavel de artistas da faixa.

## Decisoes Recentes Importantes

- Pull-to-refresh e mini-header devem chamar refresh leve de live (`fetchGroupLive(true)`), nao a sincronizacao pesada.
- Ao final da faixa, a barra deve esperar a duracao real e so entao buscar live. Nao somar duas vezes `progressMs` com timestamp da faixa.
- O app deve mostrar splash/loading no F5 antes de renderizar Replay/Home.
- Quando um usuario for selecionado, o seletor deve fechar.
- O vinil nao deve ser movido de lugar sem pedido explicito.
- Existem 3 variantes procedurais de vinil, geradas por hash de capa/cor e memoizadas localmente. Elas devem ser leves, sem assets pesados no bundle.
- O plastico do vinil deve parecer translucido.
- `albumArtist` tem prioridade para casos como Anitta/Shakira em singles/feats quando o artista principal do album/single e diferente da ordem retornada pela faixa.
- O popover de contagens fica no `LeoHeader`, na linha do nome do usuario, perto do vinil. Ele abre com botao pequeno, fecha no scroll ou clique fora, e mostra:
  - artista: badge de contagem + nome
  - musica: badge de contagem + nome
  - album: badge de contagem + nome, somente se a contagem for maior que zero

## Cuidados De UI Mobile

- Priorizar tela mobile primeiro.
- Nao deixar elementos sobreporem o vinil, ranking summary ou "Atividade do circulo".
- Safe area/notch: backgrounds e splash devem cobrir a area superior.
- Evitar textos explicativos quando o elemento ja e autoexplicativo.
- Badges de contagem devem ficar fora do recorte da imagem quando forem sobre avatares/capas.
- Barra de progresso no estado reproduzindo deve ocupar no maximo cerca de 50% da largura util.
- Se mexer no `LeoHeader`, testar tambem o estado ocioso, porque espacamentos negativos podem invadir areas erradas.

## Referencias Locais

- `referencia_vinis/`: pasta local com referencias visuais de vinis. Nao apagar e nao stagear sem pedido.

## Pos-Estabilizacao De Maio/2026 — Regras Obrigatorias

### 1. Nao implementar cache em memoria no backend serverless

Nao adicionar `new Map()`/cache em memoria para endpoints de producao da API.

Motivo:

- Vercel serverless nao garante persistencia entre cold starts.
- Instancias paralelas nao compartilham memoria.
- Pode mascarar timeout em warm instance e falhar em cold start.
- Se a chave nao incluir todos os parametros relevantes, pode devolver dados errados.

Se for implementar cache real:

- Usar Vercel KV, Upstash ou Redis com env vars configuradas.
- Chave precisa incluir versao, endpoint, usuario/grupo, periodo e flags relevantes.
- `force`/`debug` devem bypassar cache.
- Erro deve retornar JSON controlado com `no-store`.
- Nunca depender do cache para evitar timeout. O endpoint precisa degradar sozinho.

### 2. `/api/group` deve ser bootstrap parcial e resiliente

`/api/group` nao pode voltar a ser endpoint gigante que espera tudo de todos.

Regras:

- Deadline interno menor que o timeout da Vercel.
- Retornar dados parciais com warnings quando necessario.
- Nunca deixar a Vercel matar a funcao com `FUNCTION_INVOCATION_TIMEOUT`.
- `top`, enrich, recent pesado e historico nao devem ser obrigatorios para responder.
- Erro de um membro nao pode derrubar o grupo inteiro.
- `/api/group-live` continua sendo a rota leve para now playing/live.

Validacao obrigatoria apos mexer em group:

```bash
curl -i "https://statslc.leosaquetto.com/api/group"
curl -i "https://statslc.leosaquetto.com/api/group-live?force=1"
```

Resultado proibido:

```txt
FUNCTION_INVOCATION_TIMEOUT
An error occurred with your deployment
```

### 3. `stats-dates` upstream 404 nao e erro fatal

A rota `/api/stats-dates` existe, mas o upstream stats.fm pode retornar 404 para `/streams/dates`.

Esse caso deve ser tratado como dado vazio, nao erro fatal:

- HTTP 200.
- JSON controlado.
- `empty: true`.
- `reason: "upstream_not_found"`.
- Arrays/objetos vazios.
- CORS presente.

Nao deixar o frontend receber erro vermelho repetido para esse caso.

### 4. Nao usar `force=1` em fluxos automaticos

`force=1` deve ser excecao, nao padrao.

Evitar em:

- Abertura da Home.
- Polling/live automatico.
- Replay automatico.
- Top mensal/semanal automatico.
- Retry silencioso.

Permitido apenas em acoes manuais claras, com cooldown/rate limit.

Refresh manual deve ter cooldown minimo de 2s.

### 5. Nao criar request loops

Antes de alterar componente que chama API, verificar:

- `useEffect` com dependencias instaveis.
- Objetos/arrays recriados por render.
- Callbacks nao memoizados.
- `periodQuery`, `params`, `filters` e `members` derivados sem `useMemo`.
- Promises sem `cancelled`/cleanup em componente que desmonta.

Caso real: `FriendsMonthlyHighlights` gerou chamadas duplicadas para `/api/top` por `periodQuery` instavel. Sempre estabilizar queries/params usados em effects.

### 6. Zustand: nao usar selectors instaveis

Evitar:

```ts
useStatsStore(state => ({ a: state.a, b: state.b }))
useStatsStore(state => getVisibleMembers(state.groupStats, state.hiddenUsers))
```

Preferir:

```ts
const groupStats = useStatsStore(state => state.groupStats)
const hiddenUsers = useStatsStore(state => state.hiddenUsers)

const members = useMemo(
  () => getVisibleMembers(groupStats, hiddenUsers),
  [groupStats, hiddenUsers]
)
```

Nao assinar o store inteiro com `useStatsStore()` em componentes grandes.

### 7. ErrorBoundary nao deve limpar estado do usuario

O ErrorBoundary pode:

- Mostrar fallback visivel.
- Detectar chunk load error.
- Fazer reload controlado.
- Limpar CacheStorage somente em chunk error e com acao do usuario.

Nao pode:

- `unregister()` service worker automaticamente.
- Limpar `localStorage`.
- Limpar `sessionStorage`.
- Apagar preferencias/cache do app.
- Limpar cache em erro generico.

Motivo: isso pode quebrar PWA futuro e apagar estado util.

### 8. Home nunca deve renderizar preto/vazio

Se `groupStats`, `primaryUser`, `featuredUserId` ou members estiverem inconsistentes:

- Mostrar loading/empty/fallback visivel.
- Recuperar `featuredUserId` para primeiro membro valido.
- Se usuario atual for ocultado em Ajustes, trocar para proximo usuario visivel.
- Nunca retornar `null` silencioso em tela principal.

Fluxo obrigatorio de validacao:

```txt
Home -> Stats -> Circle -> Ajustes -> Home
```

Tambem testar:

```txt
Ajustes -> ocultar usuario atual -> Home
```

### 9. Fallback de avatar deve ser local e proporcional

Nao depender de `ui-avatars.com` nem de outra API externa para fallback de avatar.

Fallback deve:

- Ser local.
- Mostrar no maximo 2 iniciais.
- Usar texto pequeno/proporcional.
- Nao estourar card.
- Deixar a imagem real substituir normalmente quando carregar.

### 10. Fontes externas

Nao usar fonte remota de `onlinewebfonts.com`.

Se usar Google Fonts:

- Preferir `<link rel="preconnect">`.
- Usar `display=swap`.
- Evitar `@import` bloqueante no CSS.

Se o visual permitir, usar `Outfit` + system fallback.

### 11. Assets versionados podem usar immutable

E seguro usar:

```txt
Cache-Control: public, max-age=31536000, immutable
```

somente para assets com hash em `/assets/*`.

Nunca aplicar `immutable` em:

- `index.html`.
- `/api/*`.
- Manifest sem versionamento.
- Dados dinamicos.

### 12. PWA/service worker: nao implementar sem plano

Nao adicionar Workbox/service worker/offline cache como ajuste pequeno.

Motivo: pode prender chunks antigos, gerar tela preta em PWA e divergir Safari/PWA.

Antes de implementar PWA offline:

- Definir estrategia de atualizacao.
- Definir cache de chunks.
- Definir limpeza segura.
- Testar Safari normal e app instalado na tela inicial.

### 13. Secao “TOP 1 DO CIRCULO”

A secao “TOP 1 DO CIRCULO” fica na Home e nao deve ser confundida com:

- Stats Alike.
- Atividade do Circulo.
- CircleScreen.
- RankingScreen.
- AlikeScreen.
- Duelos.

Se for refatorar para orbit mode:

- Usar dados reais atuais.
- Nao inventar dados.
- 1 usuario ativo por vez.
- Satelites: top artista, top faixa, top album.
- Dock de membros para troca.
- Nao criar request novo.
- Nao bloquear scroll vertical.
- Nao mexer em vinis/LeoHeader.

### 14. Validacao minima pos-mudanca

Frontend:

```bash
cd /Users/leosaquetto/Developer/GitHub/stats-lc
npm run lint
npm run build
```

Backend:

```bash
cd /Users/leosaquetto/Developer/GitHub/stats-lc-api
npx tsc --noEmit --module nodenext --moduleResolution nodenext --target es2022 --skipLibCheck 'api/[...path].ts' $(rg --files lib | rg '\.ts$' | rg -v '\.test\.ts$')
```

Curls uteis:

```bash
curl -i "https://statslc.leosaquetto.com/api/group"
curl -i "https://statslc.leosaquetto.com/api/group-live?force=1"
curl -i "https://statslc.leosaquetto.com/api/stats?user=savio&after=0"
curl -i "https://statslc.leosaquetto.com/api/stats-dates?user=savio&after=1780023600000"
```

## Diagnosticos E Armadilhas Recentes

Esta secao registra dificuldades reais encontradas durante a rodada de polimento mobile da Home, Replay, Timeline e integracao com a API. Use como checklist antes de assumir que um bug e visual, de cache ou de frontend.

### Dominios, proxy e localhost

- Arquitetura correta:
  - App/producao: `https://appstatslc.leosaquetto.com`
  - API/producao: `https://statslc.leosaquetto.com`
  - App local: `http://localhost:3000`
- Em desenvolvimento, `src/services/statsService.ts` usa `window.location.origin` quando nao existe `VITE_API_BASE_URL`. Assim, o browser chama `http://localhost:3000/api/*` e o Vite proxy encaminha para a API.
- `vite.config.ts` encaminha `/api` para `VITE_API_BASE_URL` ou, se ausente, `https://statslc.leosaquetto.com`.
- Nao deixe um `.env.local` apontando para API local sem avisar. Um exemplo que foi util para validar handler local, mas que deve ser removido para testar producao limpa:

  ```bash
  STATS_API_PROXY_TARGET="http://localhost:3001"
  ```

- Se o app local mostrar dados diferentes da API local direta, verifique primeiro qual origin esta respondendo:

  ```bash
  curl -sS 'http://localhost:3000/api/replay?user=leo&period=month&force=1'
  curl -sS 'http://localhost:3000/api/top?user=leo&type=tracks&period=month&limit=30&force=1'
  curl -sS 'https://statslc.leosaquetto.com/api/replay?user=leo&period=month&force=1'
  curl -sS 'https://statslc.leosaquetto.com/api/top?user=leo&type=tracks&period=month&limit=30&force=1'
  ```

- Para resetar um teste local contaminado por API local:

  ```bash
  rm -f .env.local
  lsof -nP -iTCP:3000 -sTCP:LISTEN
  lsof -nP -iTCP:3001 -sTCP:LISTEN
  npm run dev
  ```

- Se precisar validar a API do checkout `stats-lc-api` sem depender da producao, rode no outro repo:

  ```bash
  cd /Users/leosaquetto/Developer/GitHub/stats-lc-api
  vercel dev --listen 3001
  ```

  Depois aponte temporariamente o Vite para `http://localhost:3001`, valide, e remova esse desvio antes de concluir se a pergunta for sobre producao.

### Deploy da API e sinais de versao antiga

- Se `http://localhost:3000/api/replay` ou `https://statslc.leosaquetto.com/api/replay` retornar `404 NOT_FOUND`, a API de producao ainda nao tem o endpoint `/api/replay` publicado naquele origin.
- Se `/api/top?type=tracks` ainda retornar `Meia Noite` com `primaryArtistName: "Los Brasileros"` e `album.artistName: null`, a API servida pelo origin esta antiga ou o deploy novo falhou.
- Valide especificamente estes campos quando houver problema de artista principal:

  ```txt
  track.primaryArtistName
  track.primaryArtist
  track.artists
  track.album.artistName
  track.album.primaryArtistName
  track.album.artists
  ```

- Caso recente: o handler local de `stats-lc-api` estava certo, mas a producao continuava antiga porque deploys recentes da API falharam. O comando que revelou isso:

  ```bash
  cd /Users/leosaquetto/Developer/GitHub/stats-lc-api
  vercel ls --yes
  vercel inspect <deployment-url> --logs
  ```

- Erro de deploy ja visto:

  ```txt
  api/user.ts: Property 'item' does not exist on type 'unknown'
  ```

  A correcao foi tipar/castar `result.data` antes de acessar `.item`.

- Outro bloqueio ja visto no deploy da API:

  ```txt
  No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.
  ```

  O repo `stats-lc-api` tinha mais de 12 arquivos `api/*.ts` virando functions. Antes de insistir em deploy, conte:

  ```bash
  find api -maxdepth 1 -type f -name '*.ts' | sort
  find api -maxdepth 1 -type f -name '*.ts' ! -name '*.test.ts' | wc -l
  ```

  Arquivos `*.test.ts` dentro de `api/` tambem podem confundir build/empacotamento da Vercel. Se a API estiver no plano Hobby, talvez seja necessario consolidar endpoints, mudar estrutura, excluir testes do output ou ajustar o projeto/plano antes da producao refletir o codigo atual.

### Replay e artista principal

- A regra desejada: quando a API trouxer `albumArtist`, `albumArtistName`, `album.primaryArtistName`, `album.artistName` ou `album.artists`, esses campos devem vencer a ordem instavel de `track.artists` em casos de feat/multiartista.
- O frontend ja tenta respeitar isso em:
  - `src/lib/artistUtils.ts`
  - `src/services/statsService.ts`
  - helpers privados de Replay em `src/screens/HomeScreen.tsx`
- Se esses campos chegam `null`, o frontend nao tem como inferir com seguranca quem e o dono do album. Nao mascare no cliente um problema que a API ainda pode resolver.
- Caso concreto para regressao:

  ```txt
  Meia Noite
  Esperado: primaryArtistName = Anitta
  Album esperado: artistName/primaryArtistName/artists = Anitta
  Sintoma antigo: primaryArtistName = Los Brasileros e album sem dono
  ```

- Outro caso concreto:

  ```txt
  Choka Choka
  Verificar se o album single vem com dono preenchido, nao apenas a lista de artistas da track.
  ```

- Para albums no Replay/top albums, ja apareceram como `Artista Desconhecido` quando a API nao trazia dono do album. Casos vistos:
  - `It's Not That Deep (Unless You Want It To Be)`
  - `The Great Impersonator (Deluxe)`
  - `A Beautiful Lie (20 Year Anniversary)`
  - `HIStory Continues`

### Home mobile: pontos visuais mexidos

- `VinylRecord`:
  - Nao mover o vinil de lugar sem pedido explicito.
  - As marcas procedurais nao devem parecer manchas verticais esticadas.
  - Mesmo sem capa carregada, o disco procedural deve continuar aparecendo.
- `TrackLeaderboardModal`:
  - O modal "Musica no tocador" deve usar linguagem de glass parecida com o bottom nav: superficie translucida, blur forte, borda visivel e sombra suave.
- `FriendActivityReel`:
  - O carrossel de "Atividade do circulo" deve aceitar gesto horizontal, mas nao virar uma area de scroll vertical isolada.
  - A pagina deve continuar rolando verticalmente fora do carrossel.
- `ReplaySection` e `ReplayModals`:
  - Tipografia e espacamentos no mobile devem ser mais compactos que a primeira versao.
  - Cards principais de artistas e albums da secao Replay estavam aceitaveis; cuidado para nao encolher esses sem pedido.
  - No modal de musicas mais ouvidas, nao mostrar botoes "Reproduzir" e "Aleatorio" se nao houver acao real.
  - O total de minutos precisa vir do periodo/filtro selecionado, preferindo `totalDurationMs`/`totalMinutes` quando disponiveis.
- `StatsAlike`:
  - Aumentar moderadamente o palco/orbita, avatars, arte central e labels.
  - Reduzir vazio vertical entre palco e detalhe.
  - Suportar swipe/drag horizontal com dedo, pausando auto-rotacao durante a interacao.
- Timeline da sessao:
  - Itens de musica devem ficar contraidos por padrao.
  - Mostrar itens recentes somente quando o usuario apertar a seta/expandir o card.
  - O botao "Ver historico completo" continua separado e deve abrir o modal completo.
  - Se "hoje" ou "mes" nao calcular, verificar a janela de datas e o payload de stats usado pelo card, nao apenas renderizacao.

## Prompt Curto Para Nova Janela

Cole isto no inicio de uma nova conversa quando quiser economizar contexto:

```text
Leia primeiro /Users/leosaquetto/Developer/GitHub/stats-lc/docs/codex-onboarding.md e use esse arquivo como contexto operacional do projeto stats.lc. Trabalhe no repo /Users/leosaquetto/Developer/GitHub/stats-lc. Se precisar ver visualmente, use o in-app browser em http://localhost:3000/ com viewport mobile 390x844, e suba o servidor com npm run dev se ele nao estiver ativo.
```
