# Backups - Bottom Track Stats Modal - 2026-06-11

Snapshots restauraveis das duas composicoes anteriores do modal acionado pelo
botao do bottom menu.

## Bases

- Repo: `/Users/leosaquetto/Developer/GitHub/stats-lc`
- Modal original anterior ao Track Story: `29169a4`
- Primeira implementacao Track Story: `ee1ac4d`
- Criado em: `2026-06-11`

## Superficie Coberta

- `src/components/Layout.tsx`
  - Helpers, cache, loader e componente `BottomTrackStatsBubble`.
  - Trecho principal observado antes da edicao: linhas aproximadas `520-3085`.
- `src/index.css`
  - Estilos `bottom-track-stats-modal`, `bottom-track-stats-body-backdrop`,
    `bottom-track-stats-surface`, `bottom-track-controls-button`,
    `bottom-track-recent-picker` e `bottom-track-lyrics-modal`.
  - Trecho principal observado antes da edicao: linhas aproximadas `193-284`.

## Restauracao Rapida

Para restaurar os arquivos inteiros ao modal original:

```bash
git show 29169a4:src/components/Layout.tsx > src/components/Layout.tsx
git show 29169a4:src/index.css > src/index.css
```

Para restaurar a primeira implementacao Track Story:

```bash
git show ee1ac4d:src/components/Layout.tsx > src/components/Layout.tsx
git show ee1ac4d:src/index.css > src/index.css
git show ee1ac4d:src/components/bottom-track/TrackStorySections.tsx > src/components/bottom-track/TrackStorySections.tsx
```

Para restaurar apenas trechos do modal, extraia as regioes cobertas acima de:

```bash
git show 29169a4:src/components/Layout.tsx
git show 29169a4:src/index.css
git show ee1ac4d:src/components/Layout.tsx
git show ee1ac4d:src/index.css
```

## Notas Visuais Protegidas

- Card unico com fundo blur/glass translucido.
- Borda praticamente invisivel.
- Surfaces internas escuras densas.
- Glow/acento laranja derivado da capa ou fallback `#ff5f00`.
- Modal deve abrir imediatamente; dados pesados hidratam depois.
