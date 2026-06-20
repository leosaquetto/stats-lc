# Track Stats Modal Refactor Rules

Documento vivo para guiar a refatoracao do modal de stats da musica no stats.lc.

## Escopo

- Superficie alvo: `BottomTrackStatsBubble` em `src/components/Layout.tsx`.
- Este documento nao rege o `TrackLeaderboardModal` competitivo, que possui
  contrato proprio em `docs/track-leaderboard-modal-rules.md`.
- Modal web-first; nada de Expo, Capacitor ou React Native agora.
- Viewport principal de validacao: `390x790`, equivalente ao iPhone 16E informado.
- Sem commit automatico.

## Direcao Visual

- O modal deve ser uma ficha unica, top-aligned, com margem segura no topo,
  visualmente proxima do modal original de track story.
- Header do modal deve ficar fixo: capa, contexto, titulo, artista e album nao rolam junto com o miolo.
- A regua de acoes (`Ver letra`, links de musica e Genius) deve ficar fixa no rodape interno da ficha.
- Apenas o miolo do modal deve rolar.
- Quando apenas o miolo rolar, o fade do miolo deve ser dinamico: sem fade no topo quando o conteudo ja comeca ali, e sem fade no rodape quando o conteudo ja terminou.
- A identidade geral escura/glass do stats.lc permanece, mas a superficie interna
  deve ser mais densa/escura do que a bolha fraca anterior.
- Preferencia travada: bolhas compactas separadas, nao painel unico grande.
- O passe de 2026-06-20 substitui a direcao "card fraco/cru": o bubble deve
  receber praticamente a estrutura visual do modal original de track story,
  preservando a infraestrutura propria do `BottomTrackStatsBubble` (transparencia
  controlada, performance, footer/header fixos e navegacao de recentes).
- `Sua historia`, timeline em trilho, Wrapped com barras, Insights, Seu grupo,
  Ranking e card de artista devem seguir a hierarquia do modal original.
- Evitar vazios horizontais e verticais.
- Bolhas com poucas informacoes podem compartilhar a mesma linha.
- Quando uma informacao nao existir e for decorativa/social/ranking, nao reservar espaco vazio.
- Campos essenciais podem usar fallback curto.
- Laranja pode voltar como acento pequeno de leitura e progresso, mas nao como
  banho geral, shimmer antigo ou badge pesada.
- Usar vidro neutro branco/cinza nos destaques internos.
- Botoes de acao inferiores devem ser simetricos e harmonicos.

## Header

- Manter capa maior e premium, entre `74x74` e `86x86` no mobile, ajustando para
  nao estourar titulos longos.
- O bloco `Stats da musica + titulo + artista + album` deve ocupar visualmente a mesma altura da capa.
- Reduzir levemente fonte do titulo, leading e margens verticais se necessario.
- Titulo da faixa em ate duas linhas.
- Artista e album mais compactos.
- Campos longos devem usar clamp/truncate com `...`, sem marquee agressivo nos campos principais.

## Blocos Principais

- O bloco `Sua historia` substitui os tres cards antigos separados de faixa,
  artista e album.
- Eles representam quanto o usuario em destaque reproduziu cada item.
- O usuario em destaque e a perspectiva de "minhas reproducoes".
- `ARTISTA` deve virar o nome do artista principal + contagem.
- Se houver mais de um artista, os artistas adicionais devem aparecer no mesmo bloco, como mini linha/avatar/nome/plays, sem abrir um bloco grande separado.
- `FAIXA` deve virar o titulo da faixa + contagem.
- `ALBUM` deve virar o nome do album + contagem.
- Esses tres valores vivem em uma unica bolha maior, com divisores discretos,
  conforme o modal original.

## Datas E Timeline

- `Release`, `Primeiro play` e `Ultimo play` devem usar bolhas verticais compactas, no mesmo padrao visual de `Streak`, `Loop factor` e `Hora`.
- Conteudo:
  - `Release` + data curta.
  - `Primeiro play` + data curta + botao pequeno de informacao.
  - `Ultimo play` + data curta + botao pequeno de informacao, ou `sem anterior`.
- As datas de `Release`, `Primeiro play` e `Ultimo play` nao devem ter background proprio; elas usam o background da propria bolha.
- Em `Primeiro play`, o botao de informacao abre toast com horario e dias desde entao.
- Em `Ultimo play`, o botao de informacao abre toast com horario.
- `Ultimo play` significa o play anterior ao playback aberto/atual.
- Evitar chips redundantes.
- `Days since` nao deve ocupar uma bolha propria quando puder aparecer no toast de `Primeiro play`.
- Data de release e data de catalogo; deve ser formatada sem deslocamento de fuso horario. Um release `2026-06-05T00:00:00Z` deve aparecer como `05/06/26`, nao como o dia anterior em Sao Paulo.

## Social

- `Ouviram no lancamento`: mostrar avatares de quem ouviu no lancamento.
- A janela de `Ouviram no lancamento` inclui quem ouviu no dia do release e tambem 1 dia antes do release.
- Se houver apenas uma pessoa em `Ouviram no lancamento`, usar singular: `Ouviu no lancamento`.
- Se houver membros em `Ouviram no lancamento`, nao mostrar `Ouviu/Ouviram primeiro`, pois tende a ser o mesmo grupo.
- `Ouviu primeiro` no singular se for uma pessoa.
- `Ouviram primeiro` no plural se for mais de uma pessoa.
- Quando a bolha for `Ouviu/Ouviram primeiro`, mostrar a data pequena ao lado do label, sem horario e sem aumentar a altura da linha.
- Incluir proprio usuario e amigos quando forem first listeners.
- Social deve virar bolha propria apenas quando houver avatares reais.
- Se social estiver vazio, nao renderizar bolha e nao mostrar `sem registro`.
- Nao renderizar textos antigos como:
  - `voces foram os primeiros...`
  - `so voce ouviu...`
  - `voces ouviram primeiro`
  - `so vc ouviu essa faixa`

## Grupo, Cake E Ranking

- Renomear para `Seu grupo` quando o layout estiver no modo originalizado.
- `Reproducoes do grupo`: total do grupo somado.
- `Cake piece`: percentual que minhas reproducoes representam no total do circulo/grupo.
- `Seu grupo` e `Ranking` devem preferir cards separados lado a lado quando
  houver dados para ambos, como no modal original.
- O ranking deve usar avatares circulares menores.
- Evitar pills largas no ranking.
- Posicao e plays devem virar microbadges sobrepostos ou adjacentes ao avatar.
- Se nao houver ranking, nao reservar area vazia.
- Ranking pode compartilhar espaco com grupo/cake para economizar altura.

## Avatares

- Remover borda preta/ring escura dos avatares sociais e ranking.
- Usar no maximo uma borda translucida clara muito sutil, ou nenhuma borda.
- Manter sobreposicao por z-index, sem halo preto.
- Avatares devem ser compactos e legiveis.

## Wrapped

- Mostrar reproducoes dos tres ultimos anos considerando o ano atual.
- Exemplo:
  - `2024` ano + reproducoes.
  - `2025` ano + reproducoes.
  - `2026` ano + reproducoes.
- Destacar o ano com mais reproducoes.
- Se o ano recorde for anterior aos tres anos atuais, considerar esse ano como primeiro e os outros dois mais recentes normais.
- Se a musica for do ano atual, usar os tres ultimos meses em vez de anos.
- Se o mes recorde for anterior aos tres meses atuais, considerar esse mes como primeiro e os outros dois mais recentes normais.
- Wrapped deve ficar em uma bolha separada da Timeline enquanto a composicao estiver em teste.

## Campos Avancados

- Mostrar campos avancados apenas se a faixa tiver mais de 10 plays para o usuario em destaque.
- Campos:
  - `Streak`: maximo de dias seguidos ouvindo essa musica, com periodo em pequeno.
  - `Loop factor`: dia em que mais reproduziu essa musica + quantidade de reproducoes.
  - `Hora`: maior porcentagem por periodo do dia, clampada entre `0-100%`.
  - `Days since`: dias desde a primeira vez que ouviu.
  - `Top 1K`: posicao da musica no top 1000 do usuario; se nao estiver, mostrar `OUT`.
- `Loop factor` nao deve mostrar horario, pois pode haver reproducoes em horarios diferentes no mesmo dia.
- Avancados devem aparecer como card `Insights` quando houver mais de 10 plays,
  com streak, loop factor e periodo do dia em colunas compactas.
- Se nao houver dados avancados, omitir `Insights` sem reservar espaco.

## API E Dados

- Fonte agregada principal: `/api/track-story`.
- Frontend deve consumir via cliente tipado em `src/services/statsService.ts`.
- Manter `specialCards` no contrato da API, mas o modal nao deve renderizar as badges antigas.
- Backend em `stats-lc-api/lib/api-handlers/track-story.ts` so deve ser alterado quando faltar shape impossivel de renderizar corretamente.
- Campos esperados/preservados:
  - `counts`
  - `history.previousPlayedAt`
  - `wrapped`
  - `social.ranking`
  - `social.releaseListeners`
  - `social.firstListeners`
  - `cakePiecePercent`
  - `advanced`
- `history.previousPlayedAt` deve representar o ultimo play anterior ao playback aberto/atual.

## Compactacao E Harmonia

- Evitar bubbles longas horizontalmente.
- Titulos curtos podem quebrar linha quando isso economiza largura, como `Plays do grupo`.
- Bolhas separadas continuam sendo a referencia estetica, como artista/faixa/album.
- Nunca deve sobrar um espaco vazio grande so porque uma faixa nao tem todos os campos.
- Preferir composicao modular e fluida.

## Validacao

- Rodar:
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
- Quando backend for alterado:
  - `npm run check` em `/Users/leosaquetto/Developer/GitHub/stats-lc-api`.
- Browser QA:
  - URL: `http://localhost:3000/#/`
  - viewport: `390x790`
  - confirmar top-aligned, scroll interno, ausencia de overflow horizontal, botoes simetricos e bolhas sem vazio desnecessario.
- Casos a validar:
  - faixa com 1 play.
  - faixa com 10 ou menos plays.
  - faixa com mais de 10 plays.
  - multiplos artistas.
  - titulo longo.
  - album longo.
  - sem release date.
  - dados parciais do endpoint.
  - com `Ouviram no lancamento`.
  - sem social.
  - com ranking.
  - sem ranking.
