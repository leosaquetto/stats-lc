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

## Decisoes Importantes Ja Incorporadas

- Troca de usuario destaque em Ajustes deve confirmar, persistir, limpar
  `stats-lc-home-boot-ready`, resetar `__STATS_LC_HOME_READY__`, navegar para
  `#/` e recarregar.
- `FriendActivityReel`, `CircleTopOrbit`, `HomeInsights`, `AlikeScreen` e
  `TrackLeaderboardModal` foram ajustados para nao limitar membros
  indevidamente.
- `TrackLeaderboardModal` deve respeitar `hiddenUsers`.
- `/api/group-live` deve ignorar cache longo de resposta e servir como refresh
  leve de live.
- Quando a API demora para reconhecer nova musica, e melhor manter a faixa
  antiga por alguns segundos do que piscar fallback incompleto.
- Bottom menu e glass antigo foram aproximados para um padrao Apple-like, com
  fundo escuro translucido e blur forte.

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
