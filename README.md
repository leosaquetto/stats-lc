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

## Estrategia Mobile

O desenvolvimento e a validacao continuam web-first. O app deve ser lapidado
em `http://localhost:3000/` e no navegador mobile antes de uma nova fase
nativa.

- Expo e o caminho nativo pretendido para a proxima fase.
- Xcode, simulador e iPhone real nao sao gates do trabalho web atual.
- O shell Capacitor existente em `ios/` foi preservado como referencia, mas
  esta pausado e nao deve orientar novas features sem pedido explicito.
- Nao migrar a interface para React Native nem remover o shell existente por
  iniciativa propria.

Se o shell Capacitor for retomado no futuro:

```bash
npm run cap:sync
npm run cap:open:ios
```

## Documentos

- `AGENTS.md`: guia ativo para agentes e manutencao.
- `api-contract.md`: contrato consumido pelo frontend.
- `docs/current-state.md`: estado atual, arquitetura, performance, deploy e
  estrategia mobile.
- `docs/backlog.md`: follow-ups tecnicos vivos.
- `docs/history.md`: resumo historico consolidado e checkpoints arquivados.
- `../stats-lc-api/README.md`: entrada operacional do backend.
