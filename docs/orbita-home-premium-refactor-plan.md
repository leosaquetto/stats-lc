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
| 1 | Backend Orbits rapido, validado e publicado | Em andamento: codigo pronto, Neon aguardando aceite |
| 2 | Shell da Orbita, Timeline e Arena consolidados | Em validacao |
| 3 | Home, transicoes, requests e vinil | Em validacao |
| 4 | Modais pessoais de artista e album | Em validacao |
| 5 | Lint, build, typecheck, QA movel e smoke producao | Pendente |

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
