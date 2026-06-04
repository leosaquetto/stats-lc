# stats.lc Agent Guide

Guia unico para agentes trabalhando em `/Users/leosaquetto/Developer/GitHub/stats-lc`.

## Objetivo

`stats-lc` e o frontend web/mobile do stats.lc. A Home mostra o usuario em destaque, LeoHeader, vinil, reproduzindo agora, atividade do circulo, Replay, Top 1 do Circulo, Stats Alike e historico recente. O app usa Vite, React 19, TypeScript, Tailwind, Zustand e API via `src/services/statsService.ts`.

API de producao: `https://statslc.leosaquetto.com`.
App local: `http://localhost:3000/`.
App producao: `https://appstatslc.leosaquetto.com`.

## Comandos

```bash
npm run dev
npm run lint
npm run build
git diff --check
```

`npm run lint` e `npm run build` sao as validacoes principais. O build pode avisar sobre chunks grandes; isso nao bloqueia automaticamente.

## Fluxo Padrao

1. Veja `git status --short` antes de editar.
2. Leia os arquivos reais envolvidos com `rg`/`sed`.
3. Mantenha o escopo estreito.
4. Nao reverta mudancas existentes do usuario.
5. Use `apply_patch` para edicoes manuais.
6. Rode `npm run lint`; rode `npm run build` para alteracoes centrais ou UI.
7. Nao faca commit sem pedido explicito.

## Validacao Visual

Se o navegador in-app do Codex estiver aberto, a validacao visual por ele esta autorizada sem pedir nova confirmacao.

Use preferencialmente:

- URL: `http://localhost:3000/`
- viewport mobile: `390 x 844`

Se a ferramenta de browser falhar, nao gaste tempo excessivo: relate a limitacao e use lint/build quando fizer sentido.

## Nao Fazer Sem Pedido Explicito

- Redesign amplo.
- Mexer em vinis/LeoHeader sem relacao direta com a tarefa.
- Redis/KV/cache backend novo.
- Service worker, Workbox, PWA offline ou CSP bloqueante.
- `/api/home-bundle`.
- Refatoracao ampla do store.
- Troca de Recharts ou stack visual.
- Light mode.
- Duelos/Circle feature nova.

## Regras De Dados

- Nao persistir arrays pesados em `stats-lc-storage` ou `groupStats`.
- Evitar persistir `topItems`, historicos, full stats e caches grandes.
- `hiddenUsers` nao deve resetar `featuredUserId`.
- Ocultar usuario afeta listas/rankings, nao o usuario destaque se ele ainda existir em `allMembers`.
- Para telas que respeitam membros ocultos, use `getVisibleMembers(...)` ou `getVisibleMembersWithLive(...)`.
- Se adicionar usuarios, atualize primeiro `stats-lc-api/lib/users.ts`, que e a fonte real do grupo.

## API E Plataforma

Contrato local: `api-contract.md`.

Regras importantes:

- `member.platform` e a plataforma primaria do usuario.
- `nowPlaying.platformCandidate` e contexto da faixa/item.
- `track.catalogAvailability` e disponibilidade de catalogo, nao origem de playback.
- Nunca inferir origem de playback usando apenas `externalIds`.
- `/api/group-live` e a superficie leve de polling/live.
- Evite `force=1` em fluxos automaticos; use apenas em acoes manuais claras.
- Dados live devem trocar a UI so quando o payload necessario estiver pronto.

## Home E Performance

- Tudo que a Home precisa mostrar sem placeholders deve ser preparado antes de liberar a splash quando possivel.
- Depois que a Home liberou, refresh/live update nao deve voltar para splash.
- Nao criar request loops em `useEffect`.
- Estabilize params/queries com `useMemo`.
- Use cleanup/cancelamento em effects async.
- Zustand: evite selectors que retornam objetos/arrays novos.
- Prefira selectors escalares e derive listas com `useMemo`.
- UI acionada por scroll deve ficar montada e alternar `opacity`, `transform` e `pointer-events`.
- Evite animar `height`, `width`, blur pesado ou sombras pesadas em areas de alta frequencia.
- Imagens e rankings ja aquecidos devem ser reutilizados; nao reprocessar avatares/capas toda vez que um modal ou card monta.

### Comportamentos Protegidos Da Home

- `Seus Destaques` deve preservar o palco orbital fluido atual: cards absolutos em orbit mode, item principal em destaque, satelites/cartoes alternando profundidade com `transform`, `opacity`, `filter: blur(...)` e `z-index`; nao converter para lista, grid estatico ou cards empilhados sem duas confirmacoes explicitas do usuario.
- `Top 1 do Circulo` e `Stats Alike` da Home sao exemplos de animacao desejada no app. Preservar aneis, camadas frente/fundo, blur de profundidade, badges e troca suave por `transform`. Nao remover, achatar, trocar por fallback simples, nem "otimizar" esse comportamento para algo menos orbital sem o usuario confirmar duas vezes.

## LeoHeader E Vinil

- Vinil nao deve ser movido ou redesenhado sem pedido claro.
- O relogio da faixa deve evitar rerender por segundo; pode atualizar texto isolado.
- A barra de progresso deve usar snapshot estavel e nao remontar por `key` dinamica.
- Quando recentes alimentarem Vinil/LeoHeader, preserve resolucao real de album usando `/api/recent?resolveAlbums=1` quando aplicavel.
- Se o tonearm parecer ausente, verificar `hideTonearm`, clipping e `z-index` antes de refatorar.

## UI

- Mobile primeiro.
- A tela Stats nao copia a Home nem usa LeoHeader; o topo funcional e o filtro sticky `Hoje / Semana / Mes / Ano / Total`.
- Orbit/orbital significa stage real com aneis, elementos absolutos e satelites, nao cards empilhados.
- Glassmorphism neste repo e web/Tailwind: `backdrop-filter`, `-webkit-backdrop-filter`, fundos/bordas translucidos. Nao usar `expo-blur`.
- Graficos da Stats sao features principais. Se aparecerem zerados com dados existentes, corrija mapper/fonte; nao esconda.
- Laranja deve virar token de design; nao invente tons novos sem auditar os existentes.

## Arquivos-Chave

- `src/screens/HomeScreen.tsx`: composicao da Home, splash/boot, Replay, Top 1, recentes e modais.
- `src/components/home/LeoHeader.tsx`: header principal, vinil, progresso, ranking summary.
- `src/components/home/VinylRecord.tsx`: vinil, textura, tonearm.
- `src/components/home/FriendActivityReel.tsx`: atividade do circulo.
- `src/components/home/FriendsMonthlyHighlights.tsx`: Top 1 do Circulo.
- `src/components/home/StatsAlike.tsx`: afinidade na Home.
- `src/components/modals/TrackLeaderboardModal.tsx`: modal da faixa/artista/album.
- `src/store/useStatsStore.ts`: Zustand, cache, fetchGroup, fetchGroupLive.
- `src/services/statsService.ts`: API client e normalizacao.
- `src/lib/memberSelectors.ts`: membros canonicos/visiveis/live.
- `src/lib/artistUtils.ts`: artista principal; album owner deve vencer ordem instavel de artistas quando existir.
- `src/lib/colorUtils.ts`: cor dominante/fallback; nao reintroduzir `colorthief`.

## Deploy/Vercel

Antes de deploy no Vercel, confirme `.vercel/project.json`, `.vercel/repo.json` ou `vercel project inspect`. Este checkout ja ficou linkado ao projeto errado.

Hosts corretos:

- App: `appstatslc.leosaquetto.com`
- API: `statslc.leosaquetto.com`

## Relatorio Final

Inclua:

- arquivos alterados;
- causa real;
- o que mudou;
- houve request novo? sim/nao;
- cache/persistencia mudou? sim/nao;
- scroll mobile preservado? sim/nao;
- lint;
- build;
- riscos restantes;
- comando de commit sugerido;
- confirmar que nao commitou, salvo pedido explicito.
