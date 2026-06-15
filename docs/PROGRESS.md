# Active Goal Progress

## Objetivo ativo

> Então faça isso, torne tudo que engloba o app, do início ao fim, como se fosse um canvas/engine nativa com loop único, assets pré-processados, shaders na GPU, controle rígido de memória e renderização pensada desde o começo para 30/60/120 fps.
>
> Nunca mande a final answer se você ainda não atingiu 100% da realização da meta, ao identificar os riscos restantes já recomece todas as tarefas que englobam o que é enviado antes da resposta final (ou summary / result / diff summary. Pode commitar e fazer push na medida que achar necessário, mas realmente só finalize ao aceitar que a meta está 100% concluída.

## Subtarefas pendentes

- [ ] Auditar os loops e filas restantes na Home, Circle, Stats e mini tray em viewport mobile.
- [ ] Eliminar entradas abruptas restantes registradas em `docs/abrupt-entry-audit.md`.
- [ ] Rodar validacao completa pos-commit em `390x844` para Home -> Stats -> Circle -> Settings -> Home, incluindo loaders, mini tray, letras e modais.
- [ ] Atualizar as regras definitivas de animação/runtime para futuras edições por agentes.

## Subtarefas concluídas

- [x] Runtime central de motion, pressão adaptativa e gates de viewport. Commit `929fe00`.
- [x] Transições do app e integração inicial do scheduler central. Commit `bc2b74f`.
- [x] Correções de labels compactos e clipping. Commits `cb99f81` e `1f5f208`.
- [x] Migração de timers visuais para o runtime. Commit `95fb1ca`.
- [x] Classificação e redução de timeouts não visuais. Commit `83c9a80`.
- [x] Captura semanal agendada com segurança. Commit `bc1a38d`.
- [x] Filas de assets e paletas ligadas ao runtime. Commit `7bd05a8`.
- [x] Limpeza dos schedulers visuais restantes. Commit `7aacc2a`.
- [x] Redução do custo de blur repetido com aparência premium preservada. Commit `2e0e889`.
- [x] Retorno quente para Home sem loader curto, RouteLoader com revelacao atrasada e preloads de rota por interacao. Commit `ba959f7`.
- [x] Letra do LeoHeader standalone sem montar/hidratar modal de stats da faixa. Commit `ba959f7`.
- [x] Fechamento de bottom sheet/modal da bolha com safety tasks nomeadas e sem `transform: none` cortando saida. Commit `ba959f7`.
- [x] Foot sync compacto/expandido reduzido, centralizado e sem barra gigante/bolha preta indevida. Commit `ba959f7`.
- [x] Tonearm manual preserva posicao solta e vinil reduz/retoma com transicoes transform-only. Commit `ba959f7`.
- [x] `npm run lint`, `npm run build`, `npm run build:report`, `git diff --check` e varredura `transition-all|setInterval|100vh|100dvh` passaram no lote `ba959f7`.
- [x] Validação Browser Home -> Stats -> Home sem overflow; cover de rota limpa após a transição.
- [x] Validação Browser dos loops `Engine*`: elementos inativos ficam com `animation-name: none` e `animation-play-state: paused`.

## Próximo passo concreto

Auditar loops e filas restantes na Home, Circle, Stats e mini tray em `390x844`, depois atacar as entradas abruptas que ainda restarem em `docs/abrupt-entry-audit.md`.
