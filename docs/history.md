# stats.lc Historico Resumido

Arquivo historico. Nao e fonte de regra ativa; use `AGENTS.md` para trabalho
novo e `docs/current-state.md` para o estado operacional recente.

## Maio/2026

- Home, LeoHeader, Settings, Top 1 do Circulo, Stats Alike e modais receberam
  ajustes de estabilidade, boot, performance e suporte a mais usuarios.
- `stats-lc-api/lib/users.ts` recebeu novos usuarios:
  - `fabiomian`: `12147621938`
  - `guilhermou`: `31gwcieaym3sg36sg3nl3q6nwfci`
- Links/hash planejados ou implementados:
  - `/#leo_saquetto`
  - `/#gabriel`
  - `/#savio_lombardi`
  - `/#marcelo_benante`
  - `/#peter_castro`
  - `/#fabio_rafael_mian`
  - `/#guilherme_lima`
- Aliases curtos em `HomeScreen.tsx`: `leo`, `gab`, `savio`, `benny`,
  `peter`, `fabio`, `fabiomian`, `guilherme`, `guilhermou`.

## Junho/2026

- Orbits saiu de plano para feature com API, shell `/circle`, composer, inbox e
  persistencia duravel via Neon/Postgres no projeto `stats-lc-api`.
- `/circle` foi consolidada em abas `Agora`, `Orbits`, `Arena`, `Duelos` e
  `Afinidade`; `/ranking` e `/alike` permaneceram como aliases.
- Modais pessoais de album/artista foram separados da arena competitiva e
  passaram a abrir com shell imediato, dados progressivos e acoes contextuais.
- Premium 430 validou Home, Stats, Orbita, Arena, Duelos, Afinidade, Ajustes,
  Bottom Bubble, letras e modais em mobile sem overflow horizontal, imagens
  quebradas ou logs relevantes apos estabilizacao.
- Bottom Bubble/modal de musica foi ajustado para reduzir lag, reflow, flicker
  de imagem e pulos de layout, mantendo o modal montado e animando por
  `opacity`/`transform`.
- O rollout completo de performance web/API foi publicado em producao:
  - frontend `c6248a8` separou chunks, adiou preloads/fanouts, integrou Speed
    Insights, adicionou orcamento de bundle, ciclo de vida e shell Capacitor;
  - frontend `60b4aac` deixou o historico completo fora do bloqueio da splash,
    reduziu warmup de imagens, melhorou as metricas de boot/pos-boot e moveu a
    animacao dos blurs globais para wrappers de composicao;
  - API `33abac4`, `f34ed76`, `cfcb20d` e `1f4c2cf` adicionou deadline parcial
    no live, cache/stale maior, normalizacao de `/api/top`, timing headers,
    logs estruturados e testes de fallback.
- Em producao, a Home fria foi observada em `1,89 s`; o bundle ficou em
  `127,0 kB gzip` de entrada e `460,0 kB gzip` total. Home, Stats, Orbita,
  Ajustes e modal de historico passaram no Browser in-app em `390x844` sem
  overflow, imagens quebradas ou logs relevantes.
- A fase nativa deixou de ser gate imediato. O produto continua web-first e
  Expo ficou definido como caminho pretendido para uma etapa futura. O shell
  Capacitor existente foi mantido, mas esta pausado.

## Decisoes Importantes Ja Incorporadas

- Troca de usuario destaque em Ajustes deve confirmar, persistir, limpar
  `stats-lc-home-boot-ready`, resetar `__STATS_LC_HOME_READY__`, navegar para
  `#/` e recarregar.
- `FriendActivityReel`, `CircleTopOrbit`, `HomeInsights`, `AlikeScreen` e
  `TrackLeaderboardModal` foram ajustados para nao limitar membros
  indevidamente.
- `TrackLeaderboardModal` deve respeitar `hiddenUsers`.
- `/api/group-live` deve ignorar cache longo de resposta e servir como refresh
  leve de live, com deadline e resposta parcial segura quando necessario.
- `/api/group` pode liberar a Home com base recente compacta. Historico
  completo, Replay e outros dados frios devem hidratar progressivamente.
- Medidas do Browser in-app sao direcionais e nao equivalem a prova de 60 fps
  em iPhone real.
- Quando a API demora para reconhecer nova musica, e melhor manter a faixa
  antiga por alguns segundos do que piscar fallback incompleto.
- Bottom menu e glass antigo foram aproximados para um padrao Apple-like, com
  fundo escuro translucido e blur forte.

## 2026-06-09 - Home, vinil e secoes orbitais

- Substituida a consulta isolada de stats do LeoHeader pelo campo opcional
  `featuredStats` de `/api/group-live`, com estado live nao persistido e defesa
  contra resposta atrasada e virada do dia.
- Adicionada animacao adaptativa do contador, troca do vinil completo pela
  direita, sombra unica do tonearm e oscilacao de reproducao suavizada.
- Removidos mini vinil, portal, listener de scroll, cor derivada e estados
  associados.
- Perceptions passou a usar periodos explicitos e descoberta comprovada por
  `/api/latest-discovery`; Insights passou a distinguir semana, mes e hoje nos
  textos.
- Perceptions e Insights ganharam rotacao automatica consciente de viewport,
  visibilidade da pagina e interacao, com transicoes direcionais.
- Top 1 ganhou artista para faixa/album e badge coerente com RankingSummary.
- Stats Alike ganhou normalizacao estrita por tipo, artista sob faixa/album,
  titulo de duas linhas e versao `v2` do cache de tops.
- Expo, Capacitor, Xcode, commit e deploy ficaram fora deste lote.

## Vinil

- `src/components/home/VinylRecord.tsx` tem variantes procedurais: `classic`,
  `marble`, `splatter`.
- Ajustes permite `Shuffle`, `1`, `2` ou `3`.
- `vinylTextureMode` existe no store.
- Splatter ja foi reduzido por ficar exagerado.
- Tonearm renderiza quando `isPlaying` e `!hideTonearm`.

## Problemas Ja Vistos

- `localhost:3000` pode abrir enquanto proxy falha por DNS para
  `statslc.leosaquetto.com`; isso nao significa Vite fora do ar.
- Navegador in-app pode dar timeout de navegacao mesmo com app aberto. Confirmar
  URL/titulo antes de assumir falha.
- `stats-lc-api` pode nao validar bem com `npx tsc --noEmit` sem args/config;
  usar o comando suportado no repo da API.
- Se usuario novo nao propaga, geralmente faltou atualizar
  `stats-lc-api/lib/users.ts` primeiro.
- Se Home fica preta apos selecao, procurar selector Zustand instavel em
  `FriendHistoryCard`, `LeoHeader`, `memberSelectors` e `HomeScreen`.

## Docs Consolidados

Estes documentos foram consolidados em `AGENTS.md`, `docs/current-state.md`,
`docs/backlog.md`, `docs/history.md` e/ou `api-contract.md`:

- `CLAUDE.md`
- `DEVELOPER_GUIDE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `QUICK_COMMIT_GUIDE.md`
- `REPLAY_IMPLEMENTATION.md`
- `docs/agent-current-rules.md`
- `docs/codex-onboarding.md`
- `docs/plano2905_statslc.md`
- `docs/recuperacao-pre-carroca.md`
- `docs/session-handoff-2026-05-31.md`
- `docs/technical-followups-home-circle.md`
- `planos/stats-lc_review_report.md`
- `REVISAO_ETAPAS_1_7.md`
- `docs/app-quality-performance-audit-plan.md`
- `docs/bottom-bubble-modal-session-2026-06-05.md`
- `docs/entity-stats-modals-plan.md`
- `docs/live-playback-architecture.md`
- `docs/orbita-home-premium-refactor-plan.md`
- `docs/orbits-plan.md`
- `docs/premium-430-ui-refactor-progress.md`
