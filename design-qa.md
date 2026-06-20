# TrackLeaderboardModal Design QA

- Source visual truth:
  `/var/folders/68/r79tzfr57751kxhcqx4h9pdr0000gn/T/com.apple.useractivityd/shared-pasteboard/items/07D5EB0C-9526-498F-B3F7-97966A5E0AD2/44797AEA-481F-4C85-A2BD-2B1E54ADFEDB.png`
- Implementation screenshots:
  - `/tmp/stats-lc-track-modal-393x750-final.png`
  - `/tmp/stats-lc-track-modal-393x750-lower.png`
- Viewport: `393x750`
- State: faixa `Bemba`, usuario destaque `leo`, Track Story carregado.

## Full-view comparison evidence

- O mockup e a implementacao compartilham a mesma leitura: header editorial com
  capa e rankings, social de lancamento, historia pessoal, timeline, Wrapped,
  Insights, grupo, ranking, artistas e acoes finais.
- A prancha longa do mockup foi adaptada ao contrato solicitado de shell fixo:
  header e footer permanecem visiveis e apenas o miolo rola.
- O primeiro viewport preserva a ordem e a densidade visual do mockup; o
  screenshot inferior confirma grupo, ranking e artistas antes do footer.

## Focused region comparison evidence

- Header: capa quadrada arredondada, contexto temporal, titulo, artistas em
  laranja, album, badges de ranking e fechar seguem a hierarquia da referencia.
- Historia e timeline: tres metricas separadas por divisores e quatro marcos
  conectados, com looping em roxo sem contaminar a paleta geral.
- Wrapped e Insights: barras com recorde identificado e tres fatos compactos,
  todos legiveis sem hover.
- Grupo e ranking: anel com percentual textual, cinco avatares, posicoes,
  contagens e destaque do usuario.
- Footer: `Ver letra` dominante, tres acoes icon-only e navegacao de recentes
  em uma segunda linha fixa.

## Required fidelity surfaces

- Fonts and typography: hierarquia, peso, uppercase utilitario, tracking,
  clamps e numeros tabulares estao coerentes com a referencia e com o
  `stats.lc`.
- Spacing and layout rhythm: gutters de 12px, gaps compactos, raios e divisores
  mantem a densidade do mockup sem overflow em `393x750`.
- Colors and visual tokens: preto/grafite domina; laranja e o acento principal;
  roxo aparece somente em artista e looping.
- Image quality and assets: capas e avatares reais usam `SmartImage`; 17 imagens
  do modal foram verificadas sem falhas.
- Copy and content: labels do mockup foram preservadas ou localizadas para a
  semantica real dos dados; valores vem da API, nao de fixtures.

## Findings

- Nenhum P0, P1 ou P2 restante.
- P3 aceitavel: o mockup original e uma prancha de `941x1672`; a implementacao
  usa tipografia e avatares proporcionalmente menores para caber no viewport
  funcional de `393x750` com header e footer fixos.

## Patches made during QA

- Removido overflow horizontal de 19px no miolo.
- Footer reduzido de 107px para 97px, ampliando a area rolavel.
- Ranking compactado sem perder cinco posicoes.
- Playback atual passou a resolver timestamp real e deixou de duplicar a faixa
  no seletor de recentes.
- Wrapped, Insights e Ranking passaram a reocupar toda a largura quando blocos
  opcionais estiverem ausentes.
- Letra foi confirmada standalone, sem o TrackLeaderboardModal ou stats sheet
  montados simultaneamente.

## Verification evidence

- `window.scrollY = 0` antes e depois do scroll interno.
- Header: `top = 5px`; footer: `top = 648px`, `bottom = 745px` durante scroll.
- Scroller: `clientWidth = scrollWidth = 372px`.
- `data-stats-lc-hidden-route-running-loops = 0`.
- Console final: zero erros e zero logs do `TrackLeaderboardModal`.
- Mobile `393x750` e desktop `1280x720` verificados no Browser.

final result: passed
