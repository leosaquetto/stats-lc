# Session Handoff - 2026-05-31

Este documento registra o que foi pertinente na sessao de performance, live playback, vinis, glass, ajustes e entrada de novos usuarios. Serve como trilha para o proximo agente continuar sem recalcular o historico inteiro.

## Escopo principal

- `stats-lc` recebeu ajustes de Home, LeoHeader, Settings, Top 1 do Circulo, Stats Alike e modais.
- `stats-lc-api` recebeu novos usuarios no arquivo fonte do grupo.
- O objetivo funcional foi manter a Home pronta depois da splash, reduzir renders/temporizadores desnecessarios, evitar fallback visual depois do boot e garantir que dados live mudem a UI apenas quando ja estao completos.

## Repos e arquivos tocados

Frontend `stats-lc`:

- `src/components/home/LeoHeader.tsx`
- `src/components/home/VinylRecord.tsx`
- `src/components/home/CircleTopOrbit.tsx`
- `src/components/home/FriendActivityReel.tsx`
- `src/components/home/HomeInsights.tsx`
- `src/components/modals/TrackLeaderboardModal.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/screens/AlikeScreen.tsx`
- `src/store/useStatsStore.ts`
- `src/services/statsService.ts`
- `src/components/Layout.tsx`
- `src/index.css`

Backend `stats-lc-api`:

- `lib/users.ts`

## Entrada de novos usuarios

Novos usuarios adicionados em `stats-lc-api/lib/users.ts`:

- `fabiomian`: `12147621938`
- `guilhermou`: `31gwcieaym3sg36sg3nl3q6nwfci`

Procedimento padrao:

1. Adicionar o usuario no `stats-lc-api/lib/users.ts`, que e a fonte real do grupo.
2. Confirmar que `/api/group`, `/api/group-live`, rankings, history e compare passam a receber o membro.
3. Adicionar aliases/hash no frontend para abrir direto no perfil.
4. Ao trocar usuario destaque em Ajustes, confirmar a troca e reiniciar automaticamente para a Home com splash/boot limpo.

Links diretos implementados/planejados por hash:

- `/#leo_saquetto`
- `/#gabriel`
- `/#savio_lombardi`
- `/#marcelo_benante`
- `/#peter_castro`
- `/#fabio_rafael_mian`
- `/#guilherme_lima`

Tambem existem aliases curtos no `HomeScreen.tsx`, como `leo`, `gab`, `savio`, `benny`, `peter`, `fabio`, `fabiomian`, `guilherme`, `guilhermou`.

## Ajustes e ocultar usuarios

`SettingsScreen.tsx` foi ajustado para:

- cards de usuario com foto preenchendo todo o card;
- nomes longos quebrando linha;
- grid de usuarios com 4 colunas;
- secao "Ocultar Membros" separada de "Distintivo de Ranking";
- celulas de ocultar membros em grid 50% / 50%;
- troca de usuario destaque com confirmacao e reload para Home.

Regra importante: ocultar usuario deve afetar listas/rankings, mas nao deve apagar `featuredUserId`. O usuario destaque pode continuar sendo referencia mesmo se estiver oculto de listas.

Foi feita varredura por usos de `hiddenUsers` e `getVisibleMembers`. A excecao encontrada foi `TrackLeaderboardModal.tsx`, que usava `groupStats.users` direto. Foi corrigido para usar `getVisibleMembers(groupStats, hiddenUsers)` tambem no fallback de contagem.

## LeoHeader e live playback

Mudancas importantes:

- Removido o timer de 1s que fazia o header recalcular/renderizar para progresso.
- A barra agora anima via `transform: scaleX` ate o fim da duracao.
- O relogio visual da faixa foi isolado em `LiveElapsedTime`, que atualiza apenas `span.textContent` a cada segundo sem rerenderizar o header inteiro.
- Para Apple Music/stats, `playedAt`, `startedAt`, `startTime` e `timestamp` sao tratados como inicio da reproducao; `endTime` so entra como fallback.
- Quando a faixa chega no tempo final, o app chama `fetchGroupLive(true)` e tenta algumas rechecagens antes de marcar como finalizada. Isso evita trocar para "acabou" cedo quando a API ainda demora alguns segundos para refletir a musica nova.
- `/api/group-live` no frontend deve ignorar o cache longo de resposta, mantendo apenas dedupe in-flight.

Ponto sensivel: se a API demorar para reconhecer a musica nova, a UI pode ficar alguns segundos na faixa antiga, mas isso e preferivel a piscar fallback ou trocar para estado incompleto.

## Badge ranking summary no LeoHeader

O badge da faixa agora:

- sempre inclui o usuario selecionado;
- mostra pelo menos a janela inicial de 4 bolhas quando houver dados;
- usa scroll horizontal para o restante;
- adiciona `+N` quando ha mais usuarios alem dos 4 iniciais;
- usa animacao leve de bolhas aparecendo/sumindo;
- respeita `hiddenUsers`.

O badge de plays foi alterado para:

- icone `Repeat`;
- texto `REPEATS`;
- novo padrao glass sem borda.

## Home, Circle, Stats Alike e Activity

Mudancas para suportar mais usuarios:

- `FriendActivityReel.tsx`: deixou de cortar em 3 amigos; agora usa todos os visiveis em scroll horizontal.
- `CircleTopOrbit.tsx`: Top 1 do Circulo ganhou dropdown por avatar para trocar membro, alem dos controles/swipe existentes.
- `HomeInsights.tsx`: Match do Dia deixou de escolher apenas entre as 4 primeiras combinacoes e agora considera todas as combinacoes validas.
- `AlikeScreen.tsx`: Ranking de Afinidade deixou de mostrar apenas 4 amigos e agora lista todos.
- `TrackLeaderboardModal.tsx`: passa a respeitar membros ocultos.

Se aparecer outro componente "com usuario sumido", procurar primeiro por:

```bash
rg -n "slice\\(0,\\s*(3|4|5)|groupStats\\.users|Object\\.values\\(.*users|hiddenUsers|getVisibleMembers" src
```

Nem todo `slice(0, 5)` e problema: muitos sao listas de faixas/artistas/albuns ou recortes visuais de historico, nao limite de membros.

## Vinil e tonearm

Arquivo principal:

- `src/components/home/VinylRecord.tsx`

Estado atual:

- existem 3 variantes de textura: `classic`, `marble`, `splatter`;
- Ajustes permite selecionar `Shuffle`, `1`, `2` ou `3`;
- `vinylTextureMode` foi adicionado ao store;
- cores do vinil usam normalizacao por saturacao/brilho para evitar fallback aleatorio;
- splatter foi reduzido depois de ficar visualmente exagerado;
- o tonearm so renderiza quando `isPlaying` e `!hideTonearm`;
- a posicao do tonearm depende de `progressMs / durationMs`.

Trechos-chave:

- calculo da variante e cor: `VinylRecord.tsx` perto de `textureVariant`;
- sulcos/splatter: bloco SVG com `grooveRings`, `splatterStreaks`, `splatterDrops`;
- tonearm: bloco final `AnimatePresence` com `motion.svg`.

Dificuldade visual aberta: o usuario ainda relatou que o tonearm nao estava claramente visivel em algumas capturas. Antes de refatorar, verificar se o componente pai esta passando `hideTonearm`, se o vinil esta cortado pelo container, e se o `z-index` compete com avatars/overlays. Nao assumir que o SVG esta ausente: ele pode estar fora da area visivel/cortada pela composicao da Home.

## Glass / bottom menu

O bottom menu foi ajustado para um glass mais proximo do padrao Apple:

- sem glow laranja exagerado;
- sem pilula cinza forte;
- fundo escuro translucido;
- `backdrop-blur-2xl`;
- realce superior fino.

Depois disso, o padrao antigo `AURA GLASS` / `ORBIT GLASS` foi aproximado desse novo visual em CSS e componentes que usavam badges/glass.

## Boot, splash e caching

Direcao definida pelo usuario:

- tudo que for necessario para a Home ficar 100% funcional deve ser preparado antes de liberar a tela depois da splash;
- evitar componentes aparecendo sem dados reais;
- dados frios da Home devem ser cacheados e nao recalculados a cada retorno;
- dados live devem atualizar em background, mas so trocar a UI quando estiverem completos;
- Stats, Orbita/Circle e Ajustes devem ser pre-carregados quando possivel.

Ja foram atacados varios pontos, mas ainda vale revisar:

- boot/splash de Replay e Top 1 antes da Home;
- cache pronto de Stats Alike e Top 1;
- prefetch de chunks de Stats/Circle/Settings;
- isolamento ainda maior entre dados live e dados frios.

## Dificuldades e cuidados para o proximo agente

1. `localhost:3000` pode abrir enquanto requests de proxy falham por DNS:

```text
getaddrinfo ENOTFOUND statslc.leosaquetto.com
```

Isso aconteceu ao abrir o app com Vite. Nao confundir com servidor Vite fora do ar. O app pode estar carregado, mas endpoints proxied podem falhar se o dominio externo nao resolver.

2. O navegador in-app pode dar timeout na navegacao mesmo com o app aberto. Confirmar com URL/titulo depois, nao assumir falha total. Nesta sessao, a confirmacao retornou `http://localhost:3000/` e titulo `stats.lc`.

3. O repo `stats-lc-api` nao tinha um `tsconfig` util para `npx tsc --noEmit` no momento da validacao anterior; esse comando pode imprimir help em vez de validar. Para `lib/users.ts`, foi usado import direto via Node como sanity check.

4. Evitar teste visual automatizado sem autorizacao explicita do usuario. O usuario vem validando pelo in-app browser e screenshots. Se precisar verificar visual, explicar antes.

5. Cuidado com `groupStats.users` direto. Para telas que devem respeitar ocultar membros, use `getVisibleMembers(groupStats, hiddenUsers)`.

6. Cuidado com timers: a barra de progresso nao deve renderizar o header por segundo. Se for mostrar cronometro, manter a estrategia de atualizar so o texto isolado.

7. Cuidado com troca de usuario destaque: nao hot-swap Home montada. Confirmar, persistir, limpar boot-ready, navegar para `#/` e recarregar.

8. Cuidado com vinis: o usuario esta sensivel a regressao visual. Antes de mexer, localizar composicao real do `VinylRecord` no pai e conferir `hideTonearm`, clipping e stacking context.

## Validacao feita

Frontend:

```bash
npm run lint
```

Resultado: passou (`tsc --noEmit`).

Servidor local:

```bash
npm run dev -- --host 0.0.0.0
```

Subiu em:

- `http://localhost:3000/`
- `http://192.168.0.8:3000/`

Observacao: durante a abertura houve erro de proxy/DNS para `statslc.leosaquetto.com`.

Backend:

- `lib/users.ts` alterado.
- Validacao anterior por import direto confirmou 7 usuarios.

## Estado git esperado

No fim desta sessao havia alteracoes nao commitadas nos dois repos.

`stats-lc`:

- componentes e telas listados neste documento.

`stats-lc-api`:

- `lib/users.ts`.

Nao commitar sem pedido explicito do usuario.

