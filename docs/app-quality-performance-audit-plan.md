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
| Home | Splash, LeoHeader, vinil, tonearm, faixa atual, progresso, replay, recentes, Stats Alike, Top 1 e modais | Parcial validado: Home sem imagens quebradas/console; modais album/artista abrem |
| Stats | Filtros, graficos, heatmap, cards, rankings, listas e calculos por periodo | Parcial validado: grafico visivel e lista mobile sem vazio |
| Circle/Ranking | Rankings, usuarios ocultos, imagens, listas e modais | Pendente |
| Alike | Afinidade, ordenacao, imagens e estados vazios | Pendente |
| Settings | Troca de destaque, persistencia, reset de boot e navegacao | Pendente |
| Modais | Historico, faixa, album, artista, leaderboard, letras e acoes externas | Parcial: modais novos de album/artista implementados |
| Imagens | `SmartImage`, `<img>`, src vazio, fallback enganoso, capas e avatares | Parcial validado: Home e modais novos sem imagens quebradas |
| Performance | Console, long tasks, scroll, rerenders, requests duplicadas e animacoes | Pendente |

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
