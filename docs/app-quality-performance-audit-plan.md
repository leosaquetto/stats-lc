# Plano de Auditoria Total do stats.lc

## Resumo

Auditar e corrigir o app inteiro com foco em quatro pilares: dados visiveis,
imagens carregando, graficos/calculos corretos e performance fluida em mobile
sem perder as animacoes, o vinil/LeoHeader e o catch do que o grupo esta
ouvindo agora.

Validacoes principais:

- `git diff --check`
- `npm run lint`
- `npm run build`
- navegador in-app em `http://localhost:3000/`, viewport mobile `390x844`

## Regras De Execucao

- Preservar a arquitetura quente/fria: live/now-playing continua leve e
  frequente; historico, rankings e calculos pesados ficam cacheados/indexados.
- Corrigir dados/calculos antes de polir UI.
- Nao esconder graficos quando houver dados.
- Nao persistir arrays pesados no Zustand/local storage.
- Usar animacoes leves: `opacity`, `transform`, stagger e entrada progressiva.
- Evitar animar `height`, `width`, blur pesado e sombras caras em areas de
  scroll.
- Nao redesenhar vinil/LeoHeader sem causa direta.

## Inventario De Auditoria

| Area | O que verificar | Status |
| --- | --- | --- |
| Home | Splash, LeoHeader, vinil, tonearm, faixa atual, progresso, replay, recentes, Stats Alike, Top 1 e modais | Validado em 430x932; Bottom Bubble abriu e preencheu |
| Stats | Filtros, graficos, heatmap, cards, rankings, listas e calculos por periodo | Validado; limpeza de transicoes e affordance aplicada |
| Circle/Ranking | Rankings, usuarios ocultos, imagens, listas e modais | Validado em 430x932; abas, aliases e filtros acionados |
| Alike | Afinidade, ordenacao, imagens e estados vazios | Validado em 430x932; troca de amigo acionada |
| Settings | Troca de destaque, persistencia, reset de boot e navegacao | Validado em 430x932; header, tabs, cards e fim da pagina corrigidos |
| Modais | Historico, faixa, album, artista, leaderboard, letras e acoes externas | Bottom Bubble e modal de ranking de faixa validados; links destrutivos/externos nao acionados |
| Imagens | `SmartImage`, `<img>`, src vazio, fallback enganoso, capas e avatares | Validado sem quebradas; foco atual em crop/truncamento visual |
| Performance | Console, long tasks, scroll, rerenders, requests duplicadas e animacoes | Validado localmente com transicoes especificas em areas de toque/scroll |

## Criterio De Fechamento

Cada item so fecha quando:

- a area renderiza com dado real ou empty state correto;
- imagens nao estao quebradas;
- graficos aparecem quando ha dados;
- calculos batem com a fonte;
- nao ha erro relevante no console;
- scroll mobile segue fluido;
- animacoes nao causam lag perceptivel.

## Progresso

- Criado em resposta ao plano colado pelo usuario.
- Adicionados modais de stats pessoais para album/artista, separados da arena.
- Adicionadas entradas pela Home, Replay, Stats, MusicCard e historico de albuns.
- Validado no navegador in-app: Home sem erro de console, modal de artista por
  destaque orbital, modal de album pelo LeoHeader, abas e letra in-app.
- A auditoria visual sera atualizada conforme as correcoes forem validadas no
  navegador in-app.
- Baseline movel em 2026-06-02: Home com `3893px`, `54` imagens, nenhuma
  imagem quebrada e retry indevido de `/api/compare` apos `ERR_CANCELED`.
- Wrapper generico de API agora ignora cancelamentos esperados antes de logar
  ou decidir retry.
- Home pausou rotacoes/floats de Seus Destaques e Perceptions fora da viewport.
- Filtro anual deixou de usar lista fixa encerrada em `2026`.
- Trocas de rota receberam transicao curta interna sem remontar a barra
  inferior.
- Stats deixou de usar lista virtual com altura fixa para apenas `15` rankings
  paginados. As linhas usam scroll natural e o botao `Carregar Mais` nao fica
  mais separado por uma area vazia no mobile.
- Ultimas Reproducoes deixou de buscar o feed quente pelo historico compacto
  `/api/user-streams`: `fetchRecent()` usa `/api/recent?resolveAlbums=1` e as
  dez capas reais foram confirmadas no navegador.
- Ajustes esconde o scrollbar nativo da navegacao horizontal sem bloquear o
  gesto de deslizar.
- A transicao de rota desmonta a tela anterior imediatamente. O
  `AnimatePresence` externo foi removido porque movimentos descendentes da
  Home podiam segurar a tela antiga depois da mudanca de URL.
- 2026-06-03: iniciada a fase pos-Orbita Premium para fechar pendencias de
  `Ranking/Arena`, `Alike`, `Settings` e performance transversal sem reabrir
  LeoHeader, vinil, backend, cache pesado ou contrato de Orbits.
- Baseline de codigo desta fase: `RankingScreen` ainda tinha requests de
  ranking sem cancelamento; `AlikeScreen` animava barras por `width`; e
  `RankingScreen`/`SettingsScreen` tinham varios `transition-all` em areas de
  toque e scroll.
- `Ranking/Arena`: carregamentos de ranking agora ignoram respostas antigas e
  cancelamentos esperados antes de atualizar estado; controles principais,
  chips de periodo, seletor de metrica e botao de batalha deixaram de usar
  `transition-all`.
- `Alike`: manteve o calculo de afinidade e o fallback local, mas removeu
  animacao por largura nas barras comparativas, usando `scaleX` com origem
  fixa; cards de amigos receberam `aria-pressed` e transicoes especificas.
- `Settings`: preservados troca de usuario em destaque, usuarios ocultos,
  preferencias, notificacoes e reset local; controles de toque e componentes
  compartilhados agora usam transicoes especificas em vez de animar todas as
  propriedades.
- Browser 390x844 em 2026-06-03 15:10 BRT, usando o build estatico local:
  Home, Arena, `/ranking`, Afinidade, `/alike` e Settings renderizaram sem
  overflow horizontal, sem imagens quebradas e sem erro relevante de console.
  Filtros de Ranking e troca de amigo em Alike foram acionados com sucesso.
- A matriz visual encontrou dois bugs de rota/navegacao: `/#/stats` caia na
  Home porque o app so tinha rota `/highlights`, e a navegacao interna de
  Settings usava `href="#privacy"`, o que quebrava o `HashRouter` e retornava
  para a Home.
- Correcoes aplicadas: `/stats` virou alias de `StatsScreen`; a navegacao
  sticky de Settings deixou de alterar o hash da rota e passou a usar botoes
  com `scrollIntoView` para as secoes internas.
- Validacao de codigo apos as correcoes: `git diff --check` passou,
  `NODE_DISABLE_COMPILE_CACHE=1 node node_modules/typescript/lib/_tsc.js
  --noEmit` passou e `npm run build` passou em 36.28s.
- Browser 390x844 em 2026-06-03 15:35 BRT, usando o build atualizado:
  `/#/stats` abriu a tela Stats correta, com filtros reais e sem cair na Home;
  `/ranking` permitiu alternar filtro `Total`; `/alike` permitiu trocar amigo
  comparado; e Settings manteve `/#/settings` ao tocar em `Privacidade`,
  rolando para a secao interna sem quebrar o `HashRouter`.
- Proximo polimento planejado: a navegacao horizontal de Settings esta
  funcional, mas no recorte 390x844 ainda aparece truncada a direita; vale
  melhorar a affordance visual do scroll lateral sem aumentar altura nem peso.
- 2026-06-03: iniciada a varredura premium final autorizada em `430x932`.
  O objetivo desta rodada e comparar tela por tela e funcao por funcao no
  Browser in-app antes de finalizar.
- Ajustes recebeu um header premium compartilhavel inspirado na Orbita, com
  metricas compactas de perfil, ocultos e Arena, alem de navegacao sticky com
  estado ativo e fade lateral para deixar claro que ha scroll horizontal.
- Cards de usuario em Ajustes foram recalibrados para `430x932`: tres colunas
  no mobile, proporcao menos estreita, crop central, indicador ativo interno e
  menor risco de imagem parecer truncada.
- Stats recebeu limpeza segura de transicoes em linhas, filtros, chips de
  Replay, botoes de metrica/categoria, busca e voltar ao topo. Carrosseis
  continuaram horizontais, mas com affordance visual quando necessario.
- 2026-06-03 430x932: a primeira passada visual foi refeita com cache-buster
  antes do hash route para garantir bundle novo. Home, Stats, Orbita Agora,
  Orbits, Duelos, Arena, Afinidade, `/ranking`, `/alike` e Settings renderizaram
  sem overflow horizontal real e sem imagens quebradas.
- Ajustes: a nav interna passou a caber com os sete chips visiveis em `430x932`
  (`Perfil`, `Privacidade`, `Home`, `Snaps`, `Alertas`, `Dados`, `Sistema`).
  O active state de `Sistema` tambem foi corrigido para vencer quando o scroll
  chega ao fim da pagina.
- Interacoes validadas no Browser in-app: `Privacidade`, `Dados` e `Sistema`
  em Settings; composer de Orbits em modo `Criar` sem enviar; filtros `Total`
  e `Tempo de Audicao` na Arena; alias `/ranking`; troca de amigo no `/alike`;
  filtros e categorias em Stats; Bottom Bubble pela Home; e modal de ranking de
  faixa pela lista de Stats.
- Ambiente local desta validacao: binarios nativos de `esbuild`, Rollup e
  `fsevents` travavam no macOS 12.7.6 desta sessao. Para validar sem alterar
  arquivos versionados, foi usado fallback temporario em `node_modules` com
  `esbuild-wasm`, `@rollup/wasm-node` e stub local de `fsevents`. Depois disso,
  `git diff --check`, `npm run lint` e `npm run build` passaram.
