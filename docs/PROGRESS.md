# Active Goal Progress

## Objetivo ativo

> Então faça isso, torne tudo que engloba o app, do início ao fim, como se fosse um canvas/engine nativa com loop único, assets pré-processados, shaders na GPU, controle rígido de memória e renderização pensada desde o começo para 30/60/120 fps.
>
> Nunca mande a final answer se você ainda não atingiu 100% da realização da meta, ao identificar os riscos restantes já recomece todas as tarefas que englobam o que é enviado antes da resposta final (ou summary / result / diff summary. Pode commitar e fazer push na medida que achar necessário, mas realmente só finalize ao aceitar que a meta está 100% concluída.

## Subtarefas pendentes

- [ ] Auditar os loops e filas restantes na Home, Circle, Stats e mini tray em viewport mobile.
- [ ] Eliminar entradas abruptas restantes registradas em `docs/abrupt-entry-audit.md`.
- [ ] Validar Home -> Stats -> Circle -> Settings -> Home, incluindo loaders, mini tray, letras e modais.
- [ ] Rodar `npm run lint`, `npm run build`, `npm run build:report` e `git diff --check` no estado final.
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
- [x] Validação Browser Home -> Stats -> Home sem overflow; cover de rota limpa após a transição.
- [x] Validação Browser dos loops `Engine*`: elementos inativos ficam com `animation-name: none` e `animation-play-state: paused`.

## Próximo passo concreto

Auditar as duas tarefas persistentes do scheduler e o único loop compositor funcional observados no retorno à Home, adicionando telemetria de identificação se necessário.
