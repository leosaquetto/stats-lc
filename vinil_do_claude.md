# Plano: VinylRecord Com Grooves, Color Thief E Tonearm

## Resumo

Atualizar `src/components/home/VinylRecord.tsx` para recuperar o visual rico do vinil antigo: grooves concêntricos, cor dinâmica vinda da capa, reflexos, animação musical e tonearm. O componente deve respeitar o layout atual, onde o vinil fica à direita do card em `LeoHeader`.

## Implementação

- Manter as props atuais: `albumImage`, `dominantColor`, `isPlaying`, `progressMs`, `durationMs` e `onClick`.
- Continuar usando `motion/react`, não `framer-motion`, para seguir o padrão atual do repo.
- Manter a lógica atual de progresso em tempo real: `realTimeProgress`, `currentRatio`, `beatDuration`, `pulseScale`, `pulseOpacity` e `shimmerSpeed`.
- Trocar o visual base do disco para camadas:
  - base radial preta;
  - `conic-gradient` com `dominantColor`, variação escura e highlights;
  - grooves SVG concêntricos;
  - capa do álbum circular no centro.
- Usar `SmartImage` para a capa, preservando fallback e comportamento atual.
- Usar `useId()` se houver `pattern` SVG, ou desenhar círculos diretamente, para evitar colisão de IDs quando houver mais de um vinil.
- Respeitar `prefers-reduced-motion`: sem rotação infinita quando motion reduzido estiver ativo.

## Cores

- Atualizar `src/lib/colorUtils.ts` para tentar `colorthief` primeiro.
- Manter o fallback atual via canvas sampling para CORS/erro de imagem.
- Padronizar `getDominantColor(albumImage)` para retornar `#rrggbb`.
- Adicionar helpers:
  - `normalizeColor(input, fallback)`;
  - `adjustBrightness(color, amount)`;
  - `withAlpha(color, alpha)`.
- Em `LeoHeader`, manter o cálculo da cor dominante fora do `VinylRecord`; o vinil só deriva variações da cor recebida.

## Grooves E Animações

- Renderizar 18 a 24 círculos concêntricos entre a capa central e a borda.
- Grooves tocando: opacidade aproximada `0.55-0.65`.
- Grooves parado: opacidade aproximada `0.25-0.35`.
- Tocando: rotação `360deg`, duração `2s-3s`, infinita, linear.
- Parado: respiração leve `scale: [0.985, 1.015, 0.985]`, duração `8s`.
- Manter shimmer da capa proporcional ao progresso da música.

## Tonearm

- Adicionar tonearm como camada interna do `VinylRecord`, `pointer-events-none`.
- Adaptar para o vinil atual à direita: tonearm vindo do topo/direita, não da esquerda antiga.
- Layout sugerido:
  - `right-[-18%] top-[8%] w-[46%] h-[8%]`;
  - `origin-[85%_50%]`;
  - parado: `rotate(-28deg)`;
  - tocando: `rotate(18deg)`.
- Corpo com gradiente `slate/zinc`, sombra e stylus em `rose-400` ou `orange-300`.
- Em mobile, reduzir tamanho/opacidade via classes responsivas se competir com o texto.

## Integração Com LeoHeader

- Não mover o vinil para a esquerda.
- Manter o container atual em `LeoHeader` com posição à direita e parallax.
- Garantir que o tonearm não cubra título, artistas, ranking badge ou progress bar.
- Clique no vinil deve continuar chamando `onTrackClick`.

## Verificação

- Rodar `npm run lint`.
- Rodar `npm run build`.
- Adicionar ou ajustar testes unitários dos helpers de cor, cobrindo hex, rgb/rgba, fallback inválido e ajuste de brilho.
- Validar por inspeção de código que não há IDs SVG fixos, imports duplicados de motion ou novo `cn` desnecessário.
