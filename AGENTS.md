# stats.lc Agent Guide

Guia unico para agentes trabalhando em `/Users/leosaquetto/Developer/GitHub/stats-lc`.

## Objetivo

`stats-lc` e o frontend web-first do stats.lc. A Home mostra o usuario em destaque, LeoHeader, vinil, reproduzindo agora, atividade do circulo, Replay, Top 1 do Circulo, Stats Alike e historico recente. O app usa Vite, React 19, TypeScript, Tailwind, Zustand e API via `src/services/statsService.ts`. Uma fase nativa via Expo esta planejada para depois da lapidacao web.

API de producao: `https://statslc.leosaquetto.com`.
App local: `http://localhost:3000/`.
App producao: `https://appstatslc.leosaquetto.com`.

## Comandos

```bash
npm run dev
npm run lint
npm run build
npm run build:report
npm run qa:home-mobile
git diff --check
```

`npm run lint` e `npm run build` sao as validacoes principais.
`npm run build:report` aplica os orcamentos atuais de bundle.
`npm run qa:home-mobile` valida a Home em 390 x 844 com Playwright quando o
dev server ja esta rodando em `http://127.0.0.1:3000/#/`.

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
- smoke local: `npm run qa:home-mobile`

Se a ferramenta de browser falhar, nao gaste tempo excessivo: relate a limitacao e use lint/build quando fizer sentido.

## Estrategia Mobile Atual

- Continuar desenvolvimento, performance e QA pela webapp.
- Expo e o caminho nativo pretendido para uma fase futura.
- Xcode, simulador e iPhone real nao sao gates do trabalho atual.
- O shell Capacitor em `ios/` esta preservado, mas pausado.
- Nao migrar componentes para React Native, instalar stack Expo ou remover
  Capacitor sem pedido explicito.
- Quando a fase Expo comecar, preservar contratos da API, identidade visual,
  palcos orbitais e comportamento web validado.

## Nao Fazer Sem Pedido Explicito

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
- Ao mesclar payload live leve com dados de `/api/group`, preserve dados ricos
  ja tratados quando a faixa for a mesma: `albumImage`, `album`, `durationMs`,
  artista principal, artista do album, cores e disponibilidade de catalogo.
- Para rankings/Replay, `plays` e contagem de reproducoes; `min` deve vir de
  tempo real (`playedMs`, `totalDurationMs`, `durationMs * plays` ou campo de
  minutos explicito), nunca de um mero rename de streams/playcount.

## Home E Performance

- Para qualquer patch visual, de animacao, modal, loader, tray, rota ou loop,
  siga tambem `docs/motion-runtime-rules.md`.
- Tudo que a Home precisa mostrar sem placeholders deve ser preparado antes de liberar a splash quando possivel.
- A splash real e a tela com logo/equalizer `stats.lc`; o loader preto de rota com spinner nao deve ser tratado como splash.
- Se a Home fria precisar segurar a splash por mais tempo para entrar fluida, prefira atrasar a liberacao visual ate o runtime voltar a `full` ou atingir um deadline de seguranca, em vez de revelar uma primeira viewport engasgando.
- Depois que a Home liberou, refresh/live update nao deve voltar para splash.
- Nao criar request loops em `useEffect`.
- Estabilize params/queries com `useMemo`.
- Use cleanup/cancelamento em effects async.
- Zustand: evite selectors que retornam objetos/arrays novos.
- Prefira selectors escalares e derive listas com `useMemo`.
- UI acionada por scroll deve ficar montada e alternar `opacity`, `transform` e `pointer-events`.
- Animacoes longas/non-stop devem ser loops fechados: a posicao base precisa bater com o quadro `0%, 100%` para nao saltar ao pausar, retomar ou mudar tier.
- Evite animar `height`, `width`, blur pesado ou sombras pesadas em areas de alta frequencia.
- Imagens e rankings ja aquecidos devem ser reutilizados; nao reprocessar avatares/capas toda vez que um modal ou card monta.
- `/api/group` fornece uma base recente compacta suficiente para liberar a
  Home; a busca de 20 recentes deve continuar em background.
- O warmup inicial deve se limitar a imagens realmente criticas para a primeira
  viewport. Nao voltar a preaquecer todos os amigos e todo o historico.
- `window.__STATS_LC_PERFORMANCE__` e os atributos
  `data-stats-lc-*` separam long tasks/LoAF de boot e pos-boot. Use uma nova aba
  para medir boot frio, pois `sessionStorage` e isolado por aba.
- Medidas do Browser in-app sao direcionais. Elas nao comprovam sozinhas 60 fps
  em iPhone real.

### Comportamentos Protegidos Da Home

- `Destaques` substitui o antigo `Seus Destaques`: manter grade/carrossel
  horizontal 3 x 2, edge-to-edge, sem badge de ranking, com loop quando houver
  mais de uma pagina. Usar `sanitizeTopItems(...)` para artistas, musicas e
  albuns antes de renderizar. A badge de categoria recolhida e icon-only; o
  texto completo vive no menu/popover.
- `Destaques` pode renderizar com base compacta/cache assim que houver dados e
  continuar hidratando Replay em background; nao bloquear a navegacao esperando
  Replay profundo.
- `Top 1 do Circulo` e `Stats Alike` da Home sao exemplos de animacao desejada no app. Preservar aneis, camadas frente/fundo, blur de profundidade, badges e troca suave por `transform`. Nao remover, achatar, trocar por fallback simples, nem "otimizar" esse comportamento para algo menos orbital sem o usuario confirmar duas vezes.

## LeoHeader E Vinil

- Vinil nao deve ser movido ou redesenhado sem pedido claro.
- Textura do plastico do vinil deve permanecer abstrata; nao reintroduzir uma capa reconhecivel piscando por cima do disco.
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
- `src/components/modals/TrackLeaderboardModal.tsx`: historia competitiva e
  ranking da faixa; artista e album abrem seus modais dedicados.
- `docs/track-leaderboard-modal-rules.md`: contrato visual, de dados e QA do
  modal competitivo da faixa; nao confundir com a bolha inferior.
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

Binding frontend conhecido:

- projeto Vercel: `appstatslc`
- project ID: `prj_qiPsRxSxAbOkLlWuWZ2sbRtbnQG8`

Checkpoint de performance e producao de 2026-06-09:

- frontend: `c6248a8` + `60b4aac`
- API: `33abac4` + `f34ed76` + `cfcb20d` + `1f4c2cf`
- detalhes e metricas: `docs/current-state.md`

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
