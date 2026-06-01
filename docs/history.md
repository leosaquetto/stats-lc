# stats.lc Historico Resumido

Resumo dos documentos antigos consolidados. Nao e fonte de regra ativa; use `AGENTS.md` para trabalho novo.

## Maio/2026

- Home, LeoHeader, Settings, Top 1 do Circulo, Stats Alike e modais receberam ajustes de estabilidade, boot, performance e suporte a mais usuarios.
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
- Aliases curtos em `HomeScreen.tsx`: `leo`, `gab`, `savio`, `benny`, `peter`, `fabio`, `fabiomian`, `guilherme`, `guilhermou`.

## Decisoes Importantes

- Troca de usuario destaque em Ajustes deve confirmar, persistir, limpar `stats-lc-home-boot-ready`, resetar `__STATS_LC_HOME_READY__`, navegar para `#/` e recarregar.
- `FriendActivityReel`, `CircleTopOrbit`, `HomeInsights`, `AlikeScreen` e `TrackLeaderboardModal` foram ajustados para nao limitar membros indevidamente.
- `TrackLeaderboardModal` deve respeitar `hiddenUsers`.
- `/api/group-live` deve ignorar cache longo de resposta e servir como refresh leve de live.
- Quando a API demora para reconhecer nova musica, e melhor manter a faixa antiga por alguns segundos do que piscar fallback incompleto.
- Bottom menu e glass antigo foram aproximados para um padrao Apple-like, com fundo escuro translucido e blur forte.

## Vinil

- `src/components/home/VinylRecord.tsx` tem variantes procedurais: `classic`, `marble`, `splatter`.
- Ajustes permite `Shuffle`, `1`, `2` ou `3`.
- `vinylTextureMode` existe no store.
- Splatter ja foi reduzido por ficar exagerado.
- Tonearm renderiza quando `isPlaying` e `!hideTonearm`.

## Problemas Ja Vistos

- `localhost:3000` pode abrir enquanto proxy falha por DNS para `statslc.leosaquetto.com`; isso nao significa Vite fora do ar.
- Navegador in-app pode dar timeout de navegacao mesmo com app aberto. Confirmar URL/titulo antes de assumir falha.
- `stats-lc-api` pode nao validar bem com `npx tsc --noEmit` sem args/config; para alguns casos foi usado import direto via Node.
- Se usuario novo nao propaga, geralmente faltou atualizar `stats-lc-api/lib/users.ts` primeiro.
- Se Home fica preta apos selecao, procurar selector Zustand instavel em `FriendHistoryCard`, `LeoHeader`, `memberSelectors` e `HomeScreen`.

## Docs Removidos

Estes documentos foram consolidados aqui e/ou em `AGENTS.md`:

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
