# Premium 430 UI Refactor Progress

Checkpoint criado em 2026-06-03 para acompanhar a execucao do plano premium
em `430x932` para `stats-lc` e, se necessario, `stats-lc-api`.

## Objetivo

Corrigir fluidez, densidade visual, dados vazios indevidos, sobreposicoes,
modais e padroes discrepantes sem perder a identidade do LeoHeader, vinil,
Top 1 do Circulo, Bottom Bubble e Arena Live.

## Baseline 430x932

- Home, Stats, Orbita, Arena, Duelos, Afinidade e Ajustes ja renderizavam sem
  overflow horizontal real, sem imagens quebradas visiveis e sem erro relevante
  de console no browser in-app.
- Achados principais:
  - Home tinha entradas pos-splash pouco animadas, sobreposicao em Atividade do
    Circulo, engasgos em trocas orbitais e Ultimas Reproducoes fora do padrao
    da Timeline da Sessao.
  - Stats precisava de header/filtros mais alinhados com Orbita, Replay mais
    respirado, artistas faltando em algumas linhas e charts temporais mais
    confiaveis.
  - Orbita precisava explicar e limpar o Pulso, renomear Inbox social,
    conter avatares da Arena Live e aproximar Arena/Duelos/Afinidade do padrao
    Agora.
  - Bottom Bubble e Letras precisavam de prewarm, gesto de fechamento,
    swipe historico mais suave e limpeza melhor de marcadores entre colchetes.
  - Modais de artista/album precisavam reduzir truncamentos e dar mais valor
    visual a badges de Top Ano/Total.

## Progresso

| Fase | Status | Notas |
| --- | --- | --- |
| 0. Checkpoint e baseline | Concluido | Documento criado antes das alteracoes. |
| 1. Padrao visual compartilhado | Parcial | Badges e listas compactas foram aplicadas; Arena Live, ranking e Stats Alike perderam animacoes de layout/remount pesadas, mas ainda ha superficies a auditar. |
| 2. Home e Bottom Bubble | Parcial | Recentes, anel e prewarm existem; faltam fechar gestos, troca horizontal com feedback e auditar todas as orbitas/entradas. |
| 3. Stats e charts temporais | Parcial | Artistas e toggle com minutos reais foram corrigidos; a API local agora deriva buckets reais com cobertura explicita quando o upstream de datas falha, faltando prova visual integrada. |
| 4. Orbita/Arena/Afinidade/Ajustes | Parcial | Radar/Arena/Duelos existem; a API local agora calcula sintonia historica compacta e o frontend recua para live/recentes se a rota publicada ainda nao estiver disponivel. |
| 5. Modais artista/album | Parcial | Submodal de ranking e duas linhas existem; falta auditoria funcional completa das abas, listas e acoes. |
| 6. API/cache se necessario | Parcial | Foram adicionados apenas os contratos necessarios para datas reais e sintonia historica, ambos com cobertura explicita e sem persistencia pesada. |
| 7. Validacao final | Pendente | A validacao anterior foi por rota, nao por cada funcao/tarefa do plano. |

## Matriz De Conclusao Integral

Legenda:

- `FEITO`: implementado e validado na funcao correspondente.
- `PARCIAL`: existe implementacao, mas falta comportamento, dado ou prova.
- `NAO FEITO`: ainda nao implementado.
- `API/DADO`: depende de confirmar a fonte real antes de decidir frontend/API.

### Inicio

| Tarefa | Estado real | Evidencia/acao restante |
| --- | --- | --- |
| Entrada animada depois da splash | PARCIAL | Existem wrappers de entrada; falta medir boot frio e confirmar que todos os blocos entram sem remount pesado. |
| Troca fluida do vinil | PARCIAL | Disco ficou estavel e capa troca em camada; falta testar troca real entre faixas. |
| Atividade do Circulo sem lag | PARCIAL | Reel perdeu `popLayout`; falta testar troca de slots com live update. |
| Ranking Summary sem sobrepor titulo | PARCIAL | Falta inspecao visual especifica no LeoHeader. |
| Seus Destaques orbital sequencial | PARCIAL | O palco atual e sequencial; `layout/popLayout` foram removidos das superficies Home ativas mais quentes e falta validar a troca no Browser. |
| Perceptions sem engasgo | PARCIAL | Movimento existe; falta remover remounts restantes e validar troca. |
| Top 1 com movimento fluido e badges normalizadas | PARCIAL | Scroll preservado; badges/movimento precisam de comparacao visual dedicada. |
| Insights do Dia em orbit mode fluido | PARCIAL | Orbit mode existe; falta validar troca sem fade/remount perceptivel. |
| Stats Alike legivel sem match | PARCIAL | Glass foi melhorado; falta validar quadrantes vazios no Browser. |
| Ultimas Reproducoes no padrao Timeline | FEITO | Lista compacta abre a faixa e reutiliza linguagem da Timeline. |
| Itens nao voltarem pretos ao scroll | PARCIAL | Fallbacks melhoraram; falta teste de scroll longo e retorno. |
| Rodape da Home sem vazio excessivo | PARCIAL | Falta medir fim real da pagina contra bottom nav. |
| Bubble menor com estados tocando/ocioso/troca | PARCIAL | Anel e foto menor existem; faltam validar estados e troca real. |

### Stats

| Tarefa | Estado real | Evidencia/acao restante |
| --- | --- | --- |
| Bottom nav sem lag ao selecionar Stats | PARCIAL | Spring foi encurtada; falta medir troca Home/Stats repetida. |
| Header/filtros inspirados em Orbita | PARCIAL | Filtro sticky existe; falta comparacao visual dedicada. |
| Card inicial streams + insights | PARCIAL | Hierarquia foi polida; falta inspecao de densidade. |
| Margens do Replay | PARCIAL | Replay foi ajustado; falta validar em 430x932 e telas menores. |
| Count-up de minutos | PARCIAL | Animacao existe no total; falta validar reinicio correto por periodo. |
| Artista nas musicas do Replay | FEITO | `getStatsItemArtistName` normaliza variantes. |
| Toggle Replay reproducoes/minutos | PARCIAL | Agora usa minutos reais quando presentes e informa `tempo indisponivel` sem falsificar plays; falta validar com payload real no Browser. |
| Evolucao de atividade com dado real | PARCIAL | A API local deriva buckets reais de ate 12 mil streams quando `/streams/dates` falha e informa cobertura; falta prova visual com o frontend apontado para essa versao. |
| Distribuicao horaria com dado real | PARCIAL | Conversao de duracao foi corrigida e a API local fornece horas reais com cobertura; falta prova visual integrada. |
| Meus Mais Tocados em linhas compactas | FEITO | Artista/capa/rank/plays foram compactados. |
| Ordem/design alinhados com Orbita | PARCIAL | Falta comparacao visual e ajuste final. |

### Orbita

| Tarefa | Estado real | Evidencia/acao restante |
| --- | --- | --- |
| Pulso explicado/redesenhado como Radar | FEITO | Radar do circulo e spotlight existem. |
| Priorizacao correta de capa/album | FEITO | `getNowTrackImage` prioriza album/capa. |
| Arena Live sem cruzar total/fixar topo | PARCIAL | Clamp/repelencia/z-index foram ajustados; falta drag real dedicado. |
| Nome orbital para Arena Live | FEITO | `Sistema Live`. |
| Inbox social renomeada | FEITO | `Caixa de Orbits`. |
| Arena no padrao Agora | PARCIAL | Hero e Ranking+Duelos existem; falta validar filtros/batalha/modais. |
| Duelos integrados na Arena | FEITO | Arena renderiza Ranking e Duelos mantendo alias/aba. |
| Duelos sem nomes truncados indevidos | PARCIAL | Duas linhas existem; falta testar nomes longos. |
| Afinidade no padrao Agora/Arena | PARCIAL | Superficie foi polida; falta comparacao visual dedicada. |
| Faixas/artistas ouvidos ao mesmo tempo em 10 min | PARCIAL | `/api/simultaneous` local usa historico controlado, janela de 10 min e cobertura explicita; o frontend usa a rota e recua para live/recentes se ela ainda nao estiver publicada. |

### Ajustes

| Tarefa | Estado real | Evidencia/acao restante |
| --- | --- | --- |
| Ajustes inspirado em Orbita | PARCIAL | Header/nav/cards foram polidos; falta validar cada aba e crop de imagens. |
| Navegacao/ocultar/preferencias | PARCIAL | Validacao anterior foi parcial e sem acoes destrutivas; repetir funcoes seguras. |

### Bottom Bubble, Letras E Modais

| Tarefa | Estado real | Evidencia/acao restante |
| --- | --- | --- |
| Abertura/fechamento sem fade laggado | PARCIAL | Transicao curta e prewarm existem; falta comparar abertura repetida. |
| Preload inteligente do modal | PARCIAL | Letras sao pre-aquecidas; dados completos do painel ainda hidratam progressivamente. |
| Drag para baixo fecha bubble | PARCIAL | Handlers existem; falta prova confiavel em gesto real. |
| Swipe horizontal com feedback por transform | PARCIAL | O conteudo agora acompanha o pointer por `transform`, com resistencia nas bordas e animacao de troca; falta prova de gesto em touch. |
| Lista externa de recentes para abrir faixa | FEITO | Ultimas Reproducoes abre faixa escolhida. |
| Modal de letras cresce responsivo/animado | PARCIAL | A viewport agora usa `clamp(280px,48dvh,520px)` e gesto proprio; falta prova visual em alturas diferentes. |
| Tag/metadado ao lado da musica | FEITO | Badge Genius e metadados do hero existem. |
| Limpeza de colchetes/espacos de letras | FEITO | Normalizador compartilhado remove anotacoes e comprime blocos. |
| Gesto de fechamento da letra | PARCIAL | Handlers foram adicionados; falta prova confiavel em touch. |
| Modais artista/album premium | PARCIAL | Virtualizacao, tabs e submodal Top existem; falta auditar abas/acoes/listas longas. |

### API, Cache E Performance Transversal

| Tarefa | Estado real | Evidencia/acao restante |
| --- | --- | --- |
| Dados robustos reutilizaveis na API/cache | PARCIAL | Foram criados fallbacks compactos para buckets temporais e sintonia historica, ambos com cache server-side existente e cobertura, sem arrays pesados persistidos no frontend. |
| Transicao de secao como app nativo | PARCIAL | Wrapper de rota existe; falta teste repetido sob carga. |
| Remover animacoes pesadas restantes | PARCIAL | Arena Live/ranking perderam `layout/popLayout`, Home principal e Stats Alike perderam `mode="wait"` e transicoes genericas; falta auditar Layout/modais e superficies legadas. |
| Validacao integral 430x932 | PENDENTE | Executar item a item e registrar evidencia, distinguindo lag do app de contencao temporaria de outros processos. |

## Regra Para Esta Continuacao

- Nenhuma fase sera marcada `FEITO` apenas porque a rota renderiza.
- Cada tarefa precisa de implementacao completa e prova funcional/visual.
- Lentidao isolada durante concorrencia com outros processos do Codex sera
  repetida antes de ser classificada como regressao do app.

## Validacao 430x932 Em 2026-06-03

- Browser in-app com viewport `430x932`, servidor local `http://127.0.0.1:3000`.
- Rotas auditadas com cache-buster antes do hash: `/`, `/stats`, `/circle`,
  `/circle?tab=orbits`, `/circle?tab=arena`, `/ranking`, `/circle?tab=duels`,
  `/circle?tab=affinity`, `/alike` e `/settings`.
- Resultado visual/DOM: nenhuma imagem quebrada, nenhum overflow horizontal
  real (`scrollWidth` igual a `clientWidth` nas rotas), nenhum erro/warn
  relevante de console capturado.
- Arena deep link: `/circle?tab=arena` e `/ranking` agora mostram hero
  `Arena orbital`, `Arena do Grupo` e `Duelos da Semana`; o primeiro teste
  revelou cache/HMR preso e foi corrigido reiniciando o Vite.
- Afinidade: `Sintonia simultanea` aparece com dados live/recentes e estado
  visual integrado.
- Stats: Replay renderiza, toggle `plays/min` foi acionado no browser e `min`
  ficou com `aria-pressed=true`; charts temporais permanecem visiveis com dados
  ou empty state claro.
- Bottom Bubble: abertura por botao fixo validada; botoes de letra e links
  aparecem; letra abriu no browser e o normalizador removeu secoes entre
  colchetes no texto visivel.
- Letras: foi adicionado handler proprio de fechamento por gesto no painel
  de letras. O `cua.drag` do Browser interpretou o movimento como scroll/volta
  para stats em vez de provar o fechamento fisico, entao a validacao visual
  confirmou abertura/limpeza/retorno, mas o gesto depende de teste manual fino
  em touch real.

## Regras Durante A Execucao

- Nao commitar nem publicar sem pedido explicito.
- Nao executar reset/refresh destrutivo em Ajustes durante QA.
- Nao criar `/api/home-bundle`, service worker ou persistencia pesada no
  frontend.
- Preferir `opacity`, `transform`, preload e montagem progressiva.
- Atualizar este arquivo apos cada bloco relevante.

## Continuacao Integral Em 2026-06-04

- Replay: o seletor `plays/min` deixou de ser cosmetico. O mapper agora procura
  minutos/duracao agregada reais e, quando o backend nao fornece tempo,
  apresenta `tempo indisponivel` em vez de reutilizar reproducoes como minutos.
- Afinidade: `Sintonia simultanea` deixou de parear usuarios somente por
  proximidade de horario. Um resultado local agora exige a mesma faixa ou o
  mesmo artista normalizado dentro do gap de 10 minutos.
- Home: Arena Live e ranking perderam animacao de layout e `popLayout`; o shell
  principal e o Stats Alike deixaram de aguardar saida completa com
  `mode="wait"`. Drag, aneis e movimento orbital foram preservados.
- Stats/API: a causa real dos charts vazios foi confirmada no endpoint
  `/streams/dates`. A API local agora agrega streams reais em buckets de hora,
  mes, dia da semana e dia do mes, limita o trabalho e informa cobertura.
- Afinidade/API: foi criado `/api/simultaneous`, que busca historico controlado
  por usuario, compara faixa/artista em janela de 10 minutos e devolve payload
  compacto. A Afinidade usa esse resultado e mantem fallback live/recentes.
- Bottom Bubble/Letras: o swipe horizontal ganhou deslocamento visual por
  `transform`; a letra ganhou viewport responsiva por `dvh`.
- Validacao da API: `typecheck`, `git diff --check` e 57 testes passaram.
- `git diff --check` passou apos o bloco. A validacao visual dedicada ainda sera
  executada em `430x932`; lentidao isolada sera repetida por causa dos outros
  processos concorrentes autorizados pelo usuario.

### Fechamento Tecnico Da Home

- Entrada pos-splash: a causa real era `shouldSkipHomeEntryMotion` passar a
  verdadeiro no mesmo release da primeira splash. A decisao de pular animacao
  agora e capturada apenas na montagem, portanto o primeiro boot anima e
  retornos posteriores continuam imediatos.
- LeoHeader: trocas deixaram de aguardar a saida completa, o blur de entrada
  foi removido e a sequencia curta continua usando `opacity/transform`.
- Atividade do Circulo: entradas deixaram de usar spring, e equalizador,
  indicador live e seta pausam fora da viewport.
- Seus Destaques, Perceptions, Top 1 e Stats Alike: trocas principais deixaram
  de animar `filter: blur` e springs; profundidade, orbitas e movimentos
  continuos visiveis foram preservados.
- Top 1 do Circulo: a badge `TOP 1` redundante sob o usuario foi removida para
  liberar o centro visual.
- Perceptions: imagens passaram a usar o cache/fallback visual compartilhado,
  reduzindo o risco de itens pretos ao retornar pelo scroll.
- Rodape: removido o padding adicional de `11rem`; o Layout ja reserva o espaco
  necessario acima da bottom nav.
- A prova visual deste bloco continua pendente porque o processo Vite anterior
  manteve a porta aberta sem responder durante a contencao concorrente. O
  servidor foi reiniciado com HMR desativado para reduzir esse ruido antes do
  novo teste.

## Continuacao Em 2026-06-04

- Check tecnico frontend: `git diff --check`, `npm run lint` e
  `npm run build` passaram apos os ajustes finais.
- Check tecnico API: `npm run check` passou no `stats-lc-api`, incluindo
  typecheck e 57 testes.
- Stats: os avisos esperados de fallback de `/api/stats-dates` passaram de
  `console.warn` para `console.debug`, mantendo a informacao em DEV sem sujar
  a auditoria de console.
- Home: `UserSelectorModal` e `UserSelectorExplosion` perderam
  `transition-all` em pontos acionaveis; agora usam transicoes especificas de
  `box-shadow`, `opacity` e `transform`.
- A validacao final em Browser in-app `430x932` sera repetida agora com foco
  em: Home, Stats, Orbita, Orbits, Arena, Duelos, Afinidade, aliases,
  Ajustes, Bottom Bubble, letras, modais e ausencia de secoes vazias.

## Validacao Final Em 430x932 - 2026-06-04

- Browser in-app em `430x932`, servidor `http://localhost:3000`, rotas com
  cache-buster antes do hash.
- Rotas validadas estabilizadas: `/`, `/stats`, `/circle`,
  `/circle?tab=orbits`, `/circle?tab=arena`, `/ranking`,
  `/circle?tab=duels`, `/circle?tab=affinity`, `/alike` e `/settings`.
- Resultado por rota: `overflow` horizontal `0`, nenhuma imagem visivel
  quebrada, secoes-chave presentes e nenhum `warn/error` novo apos a tela
  estabilizar.
- Home: Atividade do Circulo, Seus Destaques, Insights e Ultimas Reproducoes
  apareceram; Bottom Bubble abriu por botao acessivel e coordenada fisica,
  sem logs novos; letra abriu dentro do painel, sem anotacoes entre colchetes
  no texto visivel e sem imagem quebrada.
- Stats: filtros `Hoje/Semana/Mes/Ano/Total`, Replay `plays/min`, artistas
  nas musicas do Replay, graficos temporais e Meus Mais Tocados foram
  validados. Linha compacta abriu modal de artista com hero, metricas, badges
  Top Ano/Total e abas `Resumo/Musicas/Circulo/Historico`.
- Charts: a causa do warning de Recharts era montagem com dimensao negativa
  em `ResponsiveContainer`; `StatsScreen` e `GroupGrowthChart` agora medem o
  container e passam dimensoes explicitas para os graficos.
- Orbits: aba `Criar` abriu o composer com destinatarios e botao `Enviar
  Orbit`, sem envio acidental.
- Arena: filtros `Tempo de Audicao` e `Mais Tocadas` responderam; `Ver
  Batalha` abriu o painel com comparativo, ranking e grafico de crescimento
  sem logs novos.
- Afinidade/Alike: troca de amigo para Sávio Lombardi funcionou, comparativo
  apareceu, `Sintonia simultanea` manteve estado vazio claro quando nao havia
  coincidencia em 10 minutos.
- Ajustes: header premium, grid de usuarios e seções foram validados; chips
  `Privacidade`, `Dados` e `Sistema` mantiveram `#/settings` sem quebrar o
  `HashRouter`. Acoes destrutivas de refresh/reset nao foram executadas.
- A sonda tecnica de `requestAnimationFrame` nao e exposta pelo Browser
  in-app; a validacao de fluidez foi feita por scroll, clicks reais, ausencia
  de remount visual travando, ausencia de logs novos e ausencia de overflow.
- Checks finais: frontend `git diff --check`, `npm run lint` e
  `npm run build` passaram; API `git diff --check` e `npm run check` passaram,
  com 57 testes verdes e worktree da API limpo.
