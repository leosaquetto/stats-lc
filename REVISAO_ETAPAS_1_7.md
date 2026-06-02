# Revisao das Etapas 1-7

Arquivo vivo de acompanhamento da revisao local das etapas 1-7. Objetivo: revisar, corrigir e validar as mudancas feitas no app `stats-lc` e na API `stats-lc-api` antes de qualquer commit ou deploy.

## Estado inicial

- App: `/Users/leosaquetto/Developer/GitHub/stats-lc`
- API: `/Users/leosaquetto/Developer/GitHub/stats-lc-api`
- Commit: nenhum commit sera feito sem pedido explicito.
- Deploy: nenhum deploy sera feito sem pedido explicito.
- Browser: validacao visual autorizada no navegador in-app em `http://localhost:3000/`.

## Baseline de diffs

- App: 11 arquivos modificados, 744 insercoes e 373 delecoes.
- API: 2 arquivos modificados, 32 insercoes e 3 delecoes.

Arquivos do app em revisao:

- `src/App.tsx`
- `src/components/Layout.tsx`
- `src/components/home/FriendActivityReel.tsx`
- `src/components/home/LeoHeader.tsx`
- `src/components/home/VinylRecord.tsx`
- `src/components/home/VinylTonearm.tsx`
- `src/components/modals/UserHistoryModal.tsx`
- `src/components/shared/CommonUI.tsx`
- `src/screens/HomeScreen.tsx`
- `src/services/statsService.ts`
- `src/store/useStatsStore.ts`

Arquivos da API em revisao:

- `lib/api-handlers/group-live.ts`
- `lib/genius.ts`

## Prioridades da revisao

- Preservar qualidade visual, animacoes importantes e identidade do app.
- Evitar fallback ruim quando o dado realmente precisa aparecer, principalmente Home, ouvindo agora, recentes e stats das faixas recentes.
- Manter splash mais paciente quando isso evita abrir Home vazia ou pobre.
- Reduzir requests/retries ruins sem esconder erro real de contrato.
- Corrigir areas vazias sem mascarar se o dado deveria existir.

## Hipoteses e riscos iniciais

- `FriendActivityReel` pode estar remontando o card inteiro ao trocar musica; isso pode quebrar continuidade visual de avatar/header.
- A limpeza de letras no cliente pode estar removendo qualquer linha entre colchetes, inclusive linhas validas.
- O modal inferior ganhou bastante hidratacao/cache; precisa revisar dependencia instavel e resposta stale.
- A Home ficou mais agressiva para liberar splash; preciso garantir que ela nao abra vazia demais.
- O fallback de `/api/group-live` precisa ser util sem virar fonte canonica falsa quando a API falha.

## Checklist vivo

- [x] Levantar baseline local dos dois repos.
- [x] Revisar diffs do app por area.
- [x] Revisar diffs da API.
- [x] Corrigir regressoes ou riscos confirmados.
- [x] Verificar areas vazias/sem dados.
- [x] Rodar validacoes de terminal.
- [x] Validar visualmente no navegador in-app.
- [x] Atualizar conclusao, riscos restantes e comando de commit sugerido.

## Log de progresso

- Baseline coletado: app com 11 arquivos modificados; API com 2 arquivos modificados.
- API revisada: `group-live` ficou mais leve sem mudar contrato; `genius` passou a remover apenas marcadores de secao conhecidos.
- Corrigido `Layout.tsx`: limpeza de lyrics agora preserva linhas entre colchetes que nao sejam marcadores; loading de lyrics nao e mais encerrado por resposta antiga; cache do modal inferior nao depende mais de objetos inteiros de usuario/listas.
- Corrigido `Layout.tsx` e `stats-lc-api/lib/genius.ts`: marcadores longos com credito, como `[Post-Chorus: artista]`, tambem sao removidos; linhas entre colchetes que nao sejam marcadores continuam preservadas.
- Corrigido `FriendActivityReel.tsx`: troca de musica anima artwork e bloco de faixa, sem remontar avatar/header do card.
- Corrigido `HomeScreen.tsx`: primeira liberacao da Home volta a esperar baseline de recentes, alem de dados centrais e imagens criticas.
- Ajustado `HomeScreen.tsx`: baseline critico de recentes agora e 10 itens, suficiente para abrir a Home sem fallback pobre enquanto os 20 itens seguem atualizando em background.
- Corrigido `MusicCard.tsx`: avatar do usuario passou para `SmartImage` para evitar `<img src="">` durante montagem de cards de historico/recentes.
- Corrigido contrato de boot: `Layout.tsx` e `HomeScreen.tsx` agora compartilham `__STATS_LC_HOME_READY__` e `sessionStorage` para evitar Home visivel com flag global indefinido.
- `git diff --check` passou no app e na API.
- `npm run lint` passou no app.
- `npm run build` passou no app.
- `npm run check` passou na API, com 55 testes aprovados.
- Apos os patches extras, `git diff --check`, `npm run lint` e `npm run build` passaram novamente no app.
- Browser Home: Home abriu visivel com usuario destaque, ouvindo agora, atividade do circulo, destaques/replay e ritual recente com dados reais.
- Browser Home: console pos-reload sem warnings/errors novos; 0 imagens com `src` vazio; 0 imagens quebradas detectadas.
- Browser modal de stats: abriu com metricas reais, ranking/social e historico da faixa; 0 skeletons restantes apos hidratacao.
- Browser letra: abriu sem loading preso, sem indisponivel falso e sem marcadores tecnicos longos em colchetes.
- Browser historico completo: snapshot acessivel mostrou modal com `Agora`, item `Ouvindo`, secao `Hoje` e `Carregar mais historico`.
- Vercel: app local esta vinculado em `.vercel/repo.json` ao projeto `appstatslc`; API esta vinculada ao projeto `stats-lc-api`.

## Validacoes executadas

- App: `git diff --check` passou.
- App: `npm run lint` passou.
- App: `npm run build` passou.
- API: `git diff --check` passou.
- API: `npm run check` passou com 55 testes.

## Conclusao

- O pacote local das etapas 1-7 foi revisado e corrigido sem mudar a essencia do app.
- O app preserva animacoes relevantes de Home/vinil/tonearm/card, mas evita remount grande no card de atividade.
- A Home prioriza abrir com dados criticos: destaque, ouvindo agora, imagens criticas e 10 recentes preparados; os 20 recentes seguem atualizando em background.
- O fallback de live ficou silencioso para falhas temporarias, mas a UI continua baseada no snapshot existente em vez de inventar dado.
- Nada foi commitado e nada foi deployado.

## Riscos restantes

- A leitura direta de `window.__STATS_LC_HOME_READY__` pelo ambiente isolado do navegador nao foi confiavel, mas o codigo servido contem o espelhamento e a UI/gate validaram visualmente.
- Validacao visual cobriu Home, modal de stats/letra e historico; nao fiz uma varredura completa de todas as rotas.

## Commit sugerido

```bash
git add REVISAO_ETAPAS_1_7.md src/App.tsx src/components/Layout.tsx src/components/home/FriendActivityReel.tsx src/components/home/LeoHeader.tsx src/components/home/VinylRecord.tsx src/components/home/VinylTonearm.tsx src/components/modals/UserHistoryModal.tsx src/components/shared/CommonUI.tsx src/components/shared/MusicCard.tsx src/screens/HomeScreen.tsx src/services/statsService.ts src/store/useStatsStore.ts
git -C /Users/leosaquetto/Developer/GitHub/stats-lc-api add lib/api-handlers/group-live.ts lib/genius.ts
git commit -m "Stabilize home live experience and recent track stats"
```
