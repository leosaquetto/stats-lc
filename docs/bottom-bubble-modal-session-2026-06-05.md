# Bottom Bubble e Modal - Handoff 2026-06-05

Checkpoint da sessao focada no botao bubble do menu inferior, modal de stats
da musica, letra, Genius e flicker de imagens. Use este arquivo para retomar
sem refazer a investigacao.

## Estado Atual

- Repo estava limpo no inicio deste checkpoint de documentacao.
- App local usado durante a sessao: `http://localhost:3000/`.
- Viewport principal de validacao: `405x700`.
- Tambem foi usado o acesso pelo celular em `192.168.0.8:3000` quando o dev
  server estava ouvindo em host externo.
- O usuario quer preservar funcoes e animacoes, mas sem lag, engasgo,
  remount perceptivel ou elementos pulando de lugar.

## Problemas Investigados

### Lag ao abrir/fechar o modal

Causas encontradas:

- o portal pesado do modal era montado/desmontado no clique;
- o scroll lock no `body` usava `position: fixed`, gerando reflow forte da Home;
- surfaces do modal tinham blur/sombra pesada em camadas aninhadas;
- o estado visual do shell dependia demais de wrapper animado, causando estado
  invisivel ou piscadas em alguns ciclos.

Correcoes aplicadas na sessao:

- manter o portal do modal montado e alternar apenas `opacity`, `transform` e
  `pointer-events`;
- separar estado logico e visual com `isOpen` e `isModalVisible`;
- remover o scroll lock por `position: fixed` e usar apenas o dataset de modal
  aberto;
- reduzir o custo visual de `.bottom-track-stats-modal` e remover blur aninhado
  em `.bottom-track-stats-surface`;
- abrir o shell imediatamente e hidratar dados/cache depois.

Arquivos envolvidos:

- `src/components/Layout.tsx`
- `src/index.css`

### Botao bubble pulando de lugar

Causa encontrada:

- a bubble passava a `fixed` quando o modal abria, saindo do fluxo reservado do
  menu inferior e alterando largura/posicao percebida.

Correcoes aplicadas:

- a bubble fica dentro de um slot fixo de `60x60`;
- o botao fica sempre `absolute inset-0` dentro do slot;
- o menu inferior mantem a mesma largura antes/depois de abrir o modal.

Validacao feita:

- antes de abrir: bubble `left 318`, `right 378`;
- depois de abrir: bubble `left 318`, `right 378`;
- nav manteve largura `298`.

### Genius aparecendo depois e deslocando layout

Causa encontrada:

- o match de Genius/letra chega assincrono; quando o botao aparece tarde, a
  linha de acoes mudava de tamanho.

Correcao aplicada:

- reservar um slot invisivel `40x40` enquanto a disponibilidade do Genius ainda
  esta pendente.

Arquivo envolvido:

- `src/components/Layout.tsx`

### Flicker de avatar/capa

Causa encontrada:

- `SmartImage` escondia a imagem atual enquanto uma nova `src` carregava, mesmo
  quando o componente visualmente deveria permanecer estavel.

Correcao aplicada:

- `SmartImage` mantem a ultima imagem valida (`lastGoodSrc`) visivel por baixo
  enquanto a nova imagem carrega.

Arquivo envolvido:

- `src/components/shared/CommonUI.tsx`

### Animacao da bubble tocando

Pedido do usuario:

- remover a animacao/equalizador antigo por estar abaixo do padrao visual do
  app;
- usar algo leve com cor dominante;
- quando nao houver reproducao ao vivo, nao animar.

Correcao aplicada:

- remover equalizador e conic pesado;
- quando `isBubbleLive && !isModalVisible`, usar zoom in/out suave da foto e
  pulsos radiais atras dela com `bubbleAccentColor`;
- quando nao houver live playback, a bubble fica estatica.

Arquivo envolvido:

- `src/components/Layout.tsx`

## Comportamentos Protegidos

- O modal deve abrir e fechar com animacao, sem perder gestos, letras, Genius,
  Apple Music, stats, historico ou navegacao pelos recentes.
- Clicar novamente na bubble com modal aberto deve fechar o modal, tanto no
  modal normal quanto no modal de letra.
- Dados pesados do modal devem ser aquecidos em memoria quando a faixa nova ja
  estiver carregada, mas sem criar endpoint novo e sem bloquear a abertura.
- A bubble nao deve mudar de tamanho, posicao ou slot ao abrir/fechar modal.
- Imagem/avatar nao deve piscar se a URL efetiva nao mudou.
- A animacao da bubble so existe quando ha reproducao ao vivo.

## Validacoes Da Sessao

- `npm run lint` passou.
- `git diff --check` passou.
- `npm run build` passou.
- O build manteve o aviso conhecido do Vite:
  `src/screens/HomeScreen.tsx` e importado dinamicamente por
  `src/components/Layout.tsx` e tambem estaticamente por `src/App.tsx`.
- Browser in-app validou o modal em `405x700`.
- Screenshot do modal legivel salvo durante a sessao:
  `/tmp/stats-lc-bottom-modal-readable.png`.
- Screenshot da bubble estatica salvo durante a sessao:
  `/tmp/stats-lc-bubble-pulse.png`.

## Pontos De Atencao Para A Proxima Sessao

- Se ainda houver engasgo, investigar re-render do conteudo interno do modal com
  profiler ou logs pontuais, nao refatorar a Home inteira.
- Conferir se o app esta reaproveitando dados frios do perfil e nao refazendo
  fetch/avatar por causa de mudanca de `nowPlaying`.
- Se a animacao de entrada/saida parecer inexistente, verificar primeiro se
  `isModalVisible` esta alternando e se CSS transition de
  `.bottom-track-stats-modal` continua aplicado.
- Se botao Genius ou Apple Music aparecerem tarde, preservar slots reservados em
  vez de deixar a linha mudar de layout.
- Para ajustes visuais, testar sempre em `405x700` e celular quando possivel.
