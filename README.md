# stats.lc

Frontend React/Vite do stats.lc.

## Rodar Local

```bash
npm install
npm run dev
```

App local: `http://localhost:3000/`.

## Validar

```bash
npm run lint
npm run build
npm run build:report
git diff --check
```

## iOS com Capacitor

```bash
npm run cap:sync
npm run cap:open:ios
```

O shell iOS usa o mesmo build Vite em `dist/`. O projeto nativo fica em `ios/`;
para compilar ou abrir o simulador e necessario ter o Xcode completo selecionado.

## Documentos

- `AGENTS.md`: guia ativo para agentes e manutencao.
- `api-contract.md`: contrato consumido pelo frontend.
- `docs/current-state.md`: estado atual das features, arquitetura quente/fria e decisoes recentes.
- `docs/backlog.md`: follow-ups tecnicos vivos.
- `docs/history.md`: resumo historico consolidado e checkpoints arquivados.
