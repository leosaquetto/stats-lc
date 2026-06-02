# Reconstrucao Premium: Orbita, Home e Modais

Checkpoint restart-safe criado em 2026-06-02 para acompanhar a implementacao
completa do plano aprovado.

## Decisoes Travadas

- Orbita vira um shell leve com resumo e abas: `Agora`, `Orbits`, `Arena`,
  `Duelos` e `Afinidade`.
- `/ranking` continua abrindo Arena e `/alike` continua abrindo Afinidade.
- Orbits deve funcionar em producao com persistencia duravel Neon/Postgres.
- Modais pessoais de artista e album usam listas compactas por faixa e menu de
  acoes contextual.
- LeoHeader, vinil, Bottom Bubble e Arena Live devem preservar sua identidade
  visual.
- Animacoes novas devem ficar em `opacity` e `transform`, com movimento
  desligado fora da viewport sempre que possivel.

## Baseline Movel

Capturado no navegador in-app em `http://localhost:3000/#/`, viewport
`390x844`.

- Home: `3893px` de altura total, `54` imagens e nenhuma imagem quebrada.
- Secoes visiveis: LeoHeader, Atividade do Circulo, Seus Destaques,
  Perceptions, Top 1 do Circulo, Insights do Dia, Stats Alike e Ultimas
  Reproducoes.
- Console: `/api/compare` registra erro e tenta retry depois de
  `ERR_CANCELED`.
- Orbita atual: API publicada ainda responde `404` em
  `/api/orbits/summary?user=leo`.
- UX atual: troca para Home atualiza a URL antes de substituir a tela anterior,
  sem transicao clara.

## Fases

| Fase | Objetivo | Status |
| --- | --- | --- |
| 0 | Baseline, checkpoint e estado dos repos | Concluido |
| 1 | Backend Orbits rapido, validado e publicado | Concluido |
| 2 | Shell da Orbita, Timeline e Arena consolidados | Concluido |
| 3 | Home, transicoes, requests e vinil | Concluido |
| 4 | Modais pessoais de artista e album | Concluido |
| 5 | Lint, build, typecheck, QA movel e smoke producao | Concluido |

## Validacao Obrigatoria

- Frontend: `git diff --check`, `npm run lint`, `npm run build`.
- API: typecheck NodeNext explicito documentado em `docs/orbits-plan.md`.
- Browser in-app: viewport `390x844`, Home, scroll prolongado, menu, todas as
  abas da Orbita, Timeline, modais, imagens e console.
- Producao: smoke test dos endpoints Orbits e hosts corretos.

## Progresso

### 2026-06-02 - Inicio

- Confirmado que `stats-lc` e `stats-lc-api` estavam limpos na branch `main`.
- Confirmado vinculo local da API com o projeto Vercel `stats-lc-api`.
- Registrado baseline movel e retry indevido de request cancelada.
- Proxima etapa: endurecer API de Orbits, verificar env de producao e publicar.

### 2026-06-02 - Primeira Fase Implementada

- `GET /api/orbits` agora devolve o store imediatamente, sem bloquear a inbox
  com auditoria de historico para todos os itens.
- Criacao de Orbit valida usuarios conhecidos, impede autoenvio e exige
  identidade utilizavel da faixa.
- Frontend audita progressivamente no maximo tres Orbits enviados
  desatualizados por montagem, com TTL de cinco minutos.
- `/circle` virou shell com `Agora`, `Orbits`, `Arena`, `Duelos` e `Afinidade`;
  somente a aba ativa monta.
- `/ranking` e `/alike` continuam compativeis como aliases.
- Timeline reaplica o normalizador compartilhado aos recentes embutidos,
  cacheados e buscados.
- Requests canceladas deixaram de registrar erro e retry no wrapper generico.
- Seus Destaques e Perceptions pausam rotacoes e floats fora da viewport.
- Filtro anual da Home deixou de fixar manualmente `2024`, `2025`, `2026`.
- Vinil preserva angulo e ganhou entrada/saida mais clara pela direita.
- Modais pessoais ganharam shell mais compacto, quatro abas principais,
  insights curtos, primeira pagina de historico menor, lista virtualizada e
  menu contextual por faixa.
- API: `npm run typecheck`, `npm test` e `git diff --check` passaram. Testes:
  `55`.
- Frontend: `npm run lint`, `npm run build` e `git diff --check` passaram.
- Browser `390x844`: Home, cinco abas da Orbita, modais pessoais de artista e
  album, menus contextuais, historico paginado e Stats foram percorridos sem
  imagens quebradas.
- A lista paginada em Stats deixou de usar um viewport virtual fixo de `520px`.
  Quinze linhas agora entram no scroll natural antes de `Carregar Mais`,
  removendo o vazio visual e o segundo scroll interno no mobile.
- `statsService.fetchRecent()` passou a usar `/api/recent?resolveAlbums=1`.
  `/api/user-streams` continua reservado ao historico paginado: sua forma
  compacta pode nao carregar catalogo suficiente para as capas quentes da
  Home. As dez Ultimas Reproducoes foram verificadas com capas reais.
- Ajustes preserva o gesto horizontal da navegacao interna, mas esconde o
  scrollbar nativo que aparecia no viewport de iPhone.
- A transicao externa de rota deixou de usar `AnimatePresence`: animacoes
  descendentes da Home podiam manter a tela antiga montada mesmo depois da URL
  mudar. O wrapper estavel agora desmonta a rota anterior imediatamente e
  aplica somente a entrada curta da nova tela.
- API publicada continua pendente do aceite de termos do Neon na Vercel; ate
  esse desbloqueio, `/api/orbits/summary` publicado ainda responde `404`.

### 2026-06-02 - Producao Ativada E Smoke Final

- Neon `neon-cyan-queen` foi provisionado no projeto correto `stats-lc-api`;
  `DATABASE_URL` e `POSTGRES_URL` ficaram disponiveis em Production, Preview e
  Development.
- API publicada com CORS para `POST` e rewrites explicitos para
  `/api/orbits/summary` e `/api/orbits/:id/:action`.
- Smoke real criou um Orbit temporario, listou remetente e destinatario,
  marcou visto, aberto, auditoria de plays e dispensado, validou exclusao
  independente por lado e removeu o item dos dois lados.
- UI de Orbits foi percorrida no navegador: inbox vazia, composer, escolha de
  amigo, busca, selecao, envio, lista de enviados e exclusao.
- Como `/api/search` upstream pode responder vazio para termos conhecidos, o
  composer tenta catalogo primeiro e usa recentes resolvidos antes de consultar
  Top Tracks. A sugestao recente apareceu em cerca de `2s`.
- Resumo de Orbits e atualizado depois de marcar itens vistos ou excluir um
  item, evitando contador antigo ate o proximo remount.
- Modal de artista foi revalidado com a API publicada: Taylor Swift passou a
  mostrar `2024 - 5.265 plays` como melhor ano, sem repetir o total historico.
- A abertura fria de `/circle?tab=orbits` no dominio publicado revelou que a
  inbox podia ficar em loading antes de existir `featuredUserId` persistido.
  O shell agora usa `leo` como identidade inicial estavel ate o usuario
  canonico assumir, sem depender da chegada assincrona dos membros.
- Lista e resumo de Orbits passaram a iniciar em paralelo. A lista vazia nao
  fica bloqueada pela atualizacao secundaria dos contadores.
- A Home publicada revelou outra diferenca do navegador in-app: em aba
  `hidden`, o browser suspende `requestAnimationFrame` e pode adiar o
  aquecimento de imagens. A liberacao continua aguardando dados essenciais,
  mas conclui o shell oculto imediatamente e mantem o preload em segundo plano;
  em foreground, preserva o aquecimento visual antes de remover a splash.
- Rotas internas tambem deixaram de depender exclusivamente do proximo paint
  para dispensar a splash inline. Em aba `hidden`, usam dismiss imediato
  depois do boot inicial; em foreground, preservam a transicao curta.
- Frontend final publicado como `dpl_DGZa6wR2beU7rQTkLZX7WAsH4cg5`. Smoke no
  host `https://appstatslc.leosaquetto.com` carregou o bundle
  `index-BqIdfJHs.js`. A deep link fria da inbox mostrou
  `Nenhum Orbit por aqui ainda.` sem spinner; a Home fria, mesmo em aba
  `hidden`, removeu a splash em menos de `6.5s`, carregou `47` imagens sem
  quebra e exibiu os dez recentes resolvidos. O smoke quente final da Home
  carregou `59` imagens sem quebra.
