# Active Goal Progress

## Objetivo ativo

> Então faça isso, torne tudo que engloba o app, do início ao fim, como se fosse um canvas/engine nativa com loop único, assets pré-processados, shaders na GPU, controle rígido de memória e renderização pensada desde o começo para 30/60/120 fps.
>
> Nunca mande a final answer se você ainda não atingiu 100% da realização da meta, ao identificar os riscos restantes já recomece todas as tarefas que englobam o que é enviado antes da resposta final (ou summary / result / diff summary. Pode commitar e fazer push na medida que achar necessário, mas realmente só finalize ao aceitar que a meta está 100% concluída.

## Subtarefas pendentes

- Nenhuma neste lote.

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
- [x] Auditoria de loops/filas em Home, Stats, Circle e Settings em `390x844`, com `LoAF=0`, overflow `0`, imagens quebradas `0`, console limpo e task/loop kinds registrados. Commit `b48db4d`.
- [x] Validação Browser Home -> Stats -> Home sem overflow; cover de rota limpa após a transição.
- [x] Validação Browser dos loops `Engine*`: elementos inativos ficam com `animation-name: none` e `animation-play-state: paused`.
- [x] Launch iOS com primeiro quadro preto, icones PWA validos e splash em altura standalone estavel.
- [x] Boot frio prepara atividade do circulo, ranking e letra da faixa atual antes de revelar a primeira viewport.
- [x] Marcador de Home quente deixa de vazar entre documentos; retorno quente dentro da mesma execucao continua sem loader.
- [x] Home, Stats, Circulo e Ajustes viraram cenas persistentes com React `Activity`; troca de bottom nav preserva DOM/estado e suspende effects/loops das cenas ocultas.
- [x] Retorno Ajustes -> Home revalidado com header e 3 cards presentes em menos de 80 ms, sem loader, cover, overflow ou imagem quebrada.
- [x] Telemetria de rota expoe `data-stats-lc-last-route-settle` e `data-stats-lc-last-route-settle-ms`.
- [x] Entradas abruptas restantes do inventario ativo foram corrigidas ou classificadas como codigo nao montado.
- [x] `AnimatePresence` possui diretamente modais condicionais lazy na Home e no Circulo; saidas de historico/detalhe foram medidas no Browser.
- [x] Regras definitivas de animacao/runtime foram consolidadas em `docs/motion-runtime-rules.md`.
- [x] Validacao Browser completa em `390x844` para Home -> Stats -> Circulo -> Ajustes -> Home, modais aninhados, batalha e seletor da Arena.
- [x] Telemetria de settle ganhou fallback nomeado no scheduler central para abas que suspendem `requestAnimationFrame`.
- [x] `npm run lint`, `npm run build`, `npm run build:report`, `git diff --check` e varreduras proibidas passaram no lote atual.
- [x] Orcamento final do lote: entry `140.9/160 kB` gzip; JS total `481.7/500 kB` gzip.
- [x] Barra de progresso consolidada em uma unica camada mutavel e `Sincronizando` ligado ao runtime.
- [x] Microanimacoes especificas de Stats, Orbita e Ajustes na bottom nav.
- [x] Tonearm com um unico loop compositor discreto e camadas ambientais mantidas atras do vinil.
- [x] RankingSummary com entrada/saida sequencial em wrapper interno, sem disputar transform com o drag imperativo.
- [x] Lock de scroll da letra reforcado sem `position: fixed`, com folha `88svh` e handle acessivel.
- [x] Reagrupamento do tray migrado de timer local para `motionRuntime`.
- [x] Letras/autoria antigas invalidadas imediatamente ao trocar a faixa do historico.
- [x] Browser `390x844`: tres ciclos completos por Home, Stats, Circulo e Ajustes, todos os filtros/abas acionados, uma cena ativa, overflow/imagens quebradas/console zerados apos assentamento.
- [x] Browser `390x844`: letra rolou de `scrollTop 0` para `420` mantendo `window.scrollY = 0`; chaining no limite foi bloqueado e os dois handles fecharam seus modais.
- [x] Browser `390x844`: tres faixas do historico cobriram letra completa e estado link-only, com Genius inline, capas validas, autoria e troca sem conteudo visual antigo.
- [x] Browser `390x844`: RankingSummary mostrou entrada sequencial no wrapper interno e drag continuo preservou slots de `36px`; barra/tonearm permaneceram singulares.
- [x] Browser `390x844`: fixture efemera removida apos validar tres pills do tray em `-14px`, separacao para `0px` no scroll e reagrupamento pelo runtime.
- [x] Lote final commitado e publicado em `origin/main`.

## Proximo passo concreto

Observar o lote publicado sem iniciar deploy Vercel.
