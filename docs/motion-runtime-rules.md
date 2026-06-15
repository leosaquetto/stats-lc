# Motion Runtime Rules

Contrato vivo para animacoes, transicoes, loaders, loops e edicoes por agentes no stats.lc.

Este documento existe para impedir que novas superficies reintroduzam animacoes caras, duplicadas ou fora do runtime central.

## Regras Obrigatorias

1. Toda animacao recorrente deve passar pelo runtime central.
   - Use `motionRuntime`, `useMotionRuntime`, `useViewportMotionGate`, `useAutoOrbitRotation` ou os componentes `Engine*`.
   - Nao crie loops recorrentes locais com `setInterval`.
   - Coreografia visual unica, delays de entrada, pulso, dismiss de toast e fallback visual devem usar `motionRuntime.scheduleTask(...)`.
   - `setTimeout` cru so e aceitavel para polling/rede, timeout de API, safety timer funcional, deadline de asset/I/O ou retry de rede, e deve ter cleanup/cancelamento.

2. Superficies quentes devem animar apenas propriedades de compositor.
   - Permitido: `opacity`, `transform`, `translate3d`, `scale`, `rotate`.
   - Evitar em areas frequentes: `height`, `width`, `top`, `left`, `filter`, blur dinamico, sombras pesadas.
   - Se a dimensao visual precisa "expandir", manter a caixa estavel e animar escala interna.
   - Superficies repetidas com glass/backdrop devem manter blur base em ate `24px`; valores maiores so para modal unico e com justificativa.
   - Nao manter `will-change` fixo em entradas finitas, skeletons ou linhas repetidas. Reserve promocao de camada para drag, scroll-linked motion e loops visiveis, voltando a `auto` fora da viewport.

3. Entradas de tela/lista devem ser inteligentes, nao instantaneas.
   - Usar delays curtos e intencionais, normalmente entre `20ms` e `35ms`.
   - Escalonar apenas os primeiros itens visiveis.
   - Respeitar `motionRuntime.canRunMotion` e `motionRuntime.tier !== 'conserve'`.

4. Texto em controles nunca deve ser espremido ate cortar.
   - Pills, tabs e segmented controls com muitos itens devem usar scroll horizontal e `shrink-0`.
   - Nao use `flex-1 min-w-0` em uma linha de labels longos apenas para caber tudo na tela.
   - Badges compactos devem quebrar em segmentos, reduzir tracking ou reservar duas linhas antes de truncar palavras curtas.
   - Cards-resumo podem crescer verticalmente para nomes curtos como `Arena do Grupo`; nao usar `truncate` por reflexo.

5. Loaders de rota e modal devem cobrir viewport estavel.
   - Use `100svh` para overlays mobile.
   - Evite `100vh`, `100dvh` e `calc(100vh...)` no shell, modais e loaders.
   - Loaders de rota devem ser `fixed inset-0`, nao fallback preso ao `main`.
   - Depois que a Home foi liberada, navegacao quente de volta para `/#/` nao deve mostrar loader de rota; use `data-stats-lc-home-ready-ms`/sessionStorage como sinal de Home aquecida.
   - Fallback de `Suspense` de rota deve ter revelacao atrasada; se o chunk resolver rapido, nao mostre spinner curto.

6. Modais devem declarar escopo de motion.
   - Use `useModalMotionScope(...)` quando uma superficie modal abrir.
   - O container principal do modal/fallback deve ter `data-stats-lc-modal-surface="true"`.
   - Loops do cenario de fundo devem pausar; loops internos do modal podem continuar se forem essenciais.
   - `useViewportMotionGate` deve considerar o estado modal global: enquanto houver modal aberto, apenas refs dentro de `data-stats-lc-modal-surface="true"` podem manter motion de viewport.
   - `AnimatePresence` deve possuir diretamente o filho condicional que desmonta. Se o modal for lazy, use `Suspense > AnimatePresence > modal condicional`, nunca `AnimatePresence > Suspense sempre montado > modal condicional`.
   - Todo modal condicional lazy deve ter `key` estavel ligada a entidade aberta, para uma troca de faixa/usuario produzir uma saida e entrada coerentes.
   - Bottom sheets nao devem depender apenas do unmount do `AnimatePresence` para fechar; mantenha estado explicito de closing quando a superficie precisa descer antes de desmontar.
   - Uma folha standalone de letra nao deve montar nem hidratar o modal de stats da faixa.
   - Conteudo rolavel dentro de modal deve ter scroll proprio (`data-lyrics-scroll`, `overscroll-contain`, `touch-action: pan-y`) e o documento por tras deve ficar travado enquanto a superficie estiver aberta ou fechando.
   - O lock de scroll deve preservar `window.scrollY`, bloquear `wheel`/`touchmove` fora do scroller permitido e impedir scroll chaining nas extremidades. Nao use `body { position: fixed }`.
   - Handles visuais de bottom sheet devem ser controles acessiveis, iniciar drag apenas pelo proprio handle e compartilhar o mesmo contrato `data-bottom-track-drag-handle`.

7. Loops CSS precisam ser rastreaveis e pausaveis.
   - Elementos animados por CSS devem usar `stats-lc-engine-loop`.
   - Quando aplicavel, definir `data-active="true"` ou `data-active="false"`.
   - Nao assumir que `animation-play-state: running` significa loop real; verificar `animation-name !== none`.
   - Depois de troca de rota, auditar `data-stats-lc-active-route-running-loops` e `data-stats-lc-hidden-route-running-loops`; cena preservada pode existir, mas loop escondido nao pode computar como rodando.
   - Skeletons recorrentes devem usar `Skeleton`/`SkeletonSurface`; nao criar pseudo-elemento com shimmer infinito fora dos componentes `Engine*`.

8. Transicoes devem listar propriedades.
   - Nao usar `transition-all` em `src`.
   - Preferir `transition-[background-color,border-color,box-shadow,opacity,transform]` conforme a superficie.

9. Assets, cores e caches visuais devem respeitar memoria adaptativa.
   - Use `assetRuntime`, `memoryRuntime`, `readRuntimeCacheEntry` e `setRuntimeCacheEntry` para caches visuais.
   - Nao criar `Map`/arrays visuais sem limite para capas, paletas ou texturas.
   - Estatisticas de faixa e outros dados efemeros por entidade devem seguir o mesmo orçamento LRU; uma sessao longa nao pode acumular cada entidade visitada.
   - `Map` global, cache visual, cache de resposta e request in-flight precisam usar `memoryRuntime` (`readRuntimeCacheEntry`/`readRuntimeCacheResult`/`setRuntimeCacheEntry`) ou declarar explicitamente por que nao sobrevivem a sessao.
   - `SmartImage` deve preservar a ultima imagem boa sem shimmer por cima enquanto a proxima decodifica; use `data-stats-lc-smart-image-*` para auditar fallback, loading e imagem anterior.
   - Elementos de imagem com caixa propria podem usar `contain: layout paint style`; palcos orbitais ativos e areas com profundidade/overflow visivel nao devem receber paint containment generico.
   - Controles fisicos manipulados pelo usuario, como tonearm, devem preservar o estado manual ate troca real de faixa; automacao nao pode puxar o controle de volta no mesmo playback.
   - Vinil deve usar identidade estavel da faixa, nunca URL da capa como chave de troca. Enriquecimento tardio de artwork/cor pode entrar depois de preload critico, mas nao pode remontar disco, reiniciar rotacao ou mover tonearm.
   - Barra de reproducao da LeoHeader nao deve trocar para fallback laranja enquanto a paleta da capa ainda esta sendo extraida; mantenha a ultima paleta real ou use neutro ate `getArtworkPalette` resolver.
   - Barra de reproducao da LeoHeader deve ser uma unica camada mutavel. Nao use `key` dinamica ou `AnimatePresence` no fill interno; sincronizacao troca `scaleX`, `opacity` e shimmer na mesma barra.
   - Correcoes de progresso ao vivo devem acelerar ate o tempo corrigido; nao salte a bolinha/linha de uma posicao antiga para uma posicao nova.
   - RankingSummary do LeoHeader deve hidratar independentemente do modal de track. Se o store nao refletir os dados a tempo, use fallback local unico por faixa e exponha `data-stats-lc-leo-header-ranking-source`.

10. Telemetria deve permanecer separada por boot e pos-boot.
   - Preserve `window.__STATS_LC_PERFORMANCE__`.
   - Preserve atributos `data-stats-lc-*` usados para auditar long tasks, LoAF, loaders e loops.
   - Tarefas recorrentes ou longas do scheduler devem declarar `kind`; audite `data-stats-lc-motion-task-kinds`, nao apenas a contagem total.
   - Audite loops por `data-stats-lc-compositor-loop-kinds`; loops visiveis de profundidade nao devem ser removidos apenas para reduzir o numero bruto.
   - Audite loops CSS por `data-stats-lc-css-engine-running-loops`, `data-stats-lc-active-route-running-loops` e `data-stats-lc-hidden-route-running-loops`, nao por inspecao visual subjetiva.
   - Telemetria que depende de `requestAnimationFrame` deve ter fallback nomeado no scheduler central, pois abas ocultas podem suspender frames.
   - Callbacks de frame, tarefas sincronas/assincronas e listeners devem ser isolados por falha. Uma excecao ou rejeicao local nunca pode interromper o proximo frame nem as demais tarefas; audite `data-stats-lc-motion-runtime-errors`.

11. Browser QA deve usar rotas hash.
   - Home: `/#/`
   - Stats: `/#/stats`
   - Circle: `/#/circle`
   - Settings: `/#/settings`
   - Arena: `/#/ranking` ou `/#/circle` com aba Arena quando aplicavel.

12. Arquivos mortos nao devem morar em `src`.
   - Nao manter `.bak`, copias antigas ou snippets soltos dentro de `src`.
   - Se uma referencia historica for necessaria, documente em `docs/` em vez de deixar codigo morto importavel/auditavel.

13. Launch e splash fazem parte do runtime visual.
   - PWA iOS deve ter `apple-touch-icon` valido, icones `192/512`, `background_color` preto e launch images para os viewports suportados; nao depender do cartao branco gerado pelo sistema.
   - Em standalone, congele a altura de launch pelo viewport real antes do primeiro paint; nao use `screen.height` para recentralizar a splash quando o viewport do iOS estabilizar.
   - Um novo documento deve invalidar marcadores de Home quente herdados da sessao. Retorno quente dentro do mesmo documento usa estado React, `window.__STATS_LC_HOME_READY__` e telemetria do documento atual.
   - Depois que `data-stats-lc-home-ready-ms` existe no documento atual, nenhum evento tardio pode regredir a Home para fria ou remover o estado quente desse documento.
   - A primeira viewport deve preparar decisoes visuais essenciais antes de sair da splash: dados-base, capas criticas, atividade visivel e badges que mudariam a geometria do header.
   - Mova chamadas ja existentes para o boot e entregue o resultado preparado ao componente; nao duplique requests so para evitar uma entrada tardia.
   - Inicie a entrada finita da Home quando a splash ja estiver dissolvendo. Nao execute toda a coreografia atras de uma splash opaca para depois revelar tudo pronto.
   - Um controle persistente, como `Letra`, nao pode trocar de `key`, posicao ou identidade apenas porque ranking/repeats terminou de carregar.

14. Modo conservador reduz loops, nao elimina entradas finitas essenciais.
   - Entradas unicas curtas com `opacity`/`transform` podem continuar em tier `conserve`, com duracao reduzida.
   - Loops ambientais, equalizers e pulsos continuam condicionados a viewport, visibilidade e `motionRuntime`.
   - Ambientes caros e nao funcionais, como respirar de uma superficie grande ou vinil idle, rodam apenas em tier `full`; em `balanced` a aura estatica permanece e o movimento funcional continua.
   - Backdrops grandes da LeoHeader/Home podem pulsar durante entrada, troca de faixa ou troca de paleta, mas devem assentar em ate cerca de `1700ms`; depois disso, a profundidade fica estatica e apenas vinil/tonearm/progresso continuam funcionais.
   - Nao empilhe multiplos `EngineBreathe` em uma mesma bolha/avatar pequeno. Prefira camadas radiais estaticas e deixe no maximo uma camada viva ligada ao avatar ou estado principal.
   - `AnimatePresence initial={false}` nao deve ser usado no primeiro viewport quando a superficie precisa de uma entrada perceptivel.
   - Quando um elemento possui transform imperativo de drag/scroll, entrada e saida finitas devem viver em um wrapper visual interno. Nunca deixe Motion e `requestAnimationFrame` escreverem `transform` no mesmo no.
   - Na entrada em fileirinha do RankingSummary, os wrappers externos dos avatares e do `+N` ja nascem nos slots finais de `36px`; somente os wrappers visuais internos partem do primeiro slot e se distribuem em sequencia com stagger perceptivel de `180ms`. A saida faz o caminho inverso.

15. Rotas-tab pesadas sao cenas persistentes, nao paginas descartaveis.
   - Home, Stats, Circulo e Ajustes devem permanecer sob `PersistentRouteScene`/React `Activity`; trocar de secao alterna a cena visivel sem remontar toda a arvore.
   - Cenas ocultas devem ficar em `Activity mode="hidden"` para preservar DOM/estado e suspender effects, listeners e loops.
   - Deve existir exatamente uma cena `data-stats-lc-route-scene` visivel por vez.
   - Cenas inativas devem declarar `data-stats-lc-route-active="false"` e seus `.stats-lc-engine-loop` precisam computar `animation-name: none`, mesmo se um filho preservado ainda tiver `data-active="true"`.
   - Cenas de rota inativas podem usar `contain: layout style`; a cena ativa nao deve receber containment generico que quebre sticky, modais, popovers ou palcos orbitais.
   - Nao coloque `key={routeKey}` em volta da arvore inteira de uma rota-tab: isso destrói o estado aquecido e repete trabalho sincrono na volta.
   - Modais, detalhes efemeros e rotas fora do shell principal nao viram cenas persistentes automaticamente.
   - Preserve `data-stats-lc-last-route-settle` e `data-stats-lc-last-route-settle-ms` para medir a troca real de cena.

16. Bottom tray, stats sheet e letra usam coreografia curta, centrada e standalone.
   - O minitray de sync deve expandir a partir do centro e manter dimensoes compactas perto da bottom nav; nao crie uma barra de blur maior que o conteudo.
   - O minitray deve abrir compacto por padrao; expansao e estado efemero da sessao visual, nao preferencia persistida em `localStorage`.
   - Pills do minitray podem ficar levemente sobrepostas em repouso; scroll horizontal separa as pills e o reagrupamento deve ser agendado pelo `motionRuntime`, sem timer visual local.
   - A sheet de stats da musica deve sair por `transform` relativo ao proprio painel, nao por `100svh`/distancia de viewport inteira.
   - A letra aberta pelo LeoHeader deve ser standalone: nao precisa montar o modal de track antes.
   - Backdrop de letra nao pode clarear antes da sheet terminar de descer; overlay e painel precisam manter a mesma linguagem visual durante entrada e saida.
   - Enquanto stats/letra estiverem abertos ou fechando, loops ambientais por tras devem ficar pausados via `useModalMotionScope` e `data-bottom-track-modal-open`.
   - Icones selecionados da bottom nav devem ter microanimacoes proprias e transform-only. Nao aplique uma rotacao generica no wrapper que concorra com equalizer, orbita ou sliders.
   - Trocar a faixa ativa de um modal deve invalidar imediatamente letra/autoria anteriores; respostas assincronas so podem atualizar a UI se sua chave ainda corresponder a faixa atual.

## Padroes Permitidos

- `EngineSpinner` para loading rotativo.
- `EngineEqualizer` para barras de audio.
- `EngineBreathe`, `EnginePulse`, `EngineSpin`, `EngineShimmer` para loops pequenos e pausaveis.
- `motion.div`/`motion.button` com `initial`, `animate`, `exit` e transicoes curtas.
- `layout="position"` somente quando ha reposicionamento real de cards/listas.
- `LazyModalFallback` para chunks de modal.
- `PersistentRouteScene`/React `Activity` para as quatro rotas-tab principais.
- `RouteLoader` como fallback atrasado somente quando o chunk ativo realmente ainda nao existe.
- Timeouts funcionais de rede, API, deadline de asset/I/O, safety release, polling visibility-aware e sequenciamento de Web Animations API.

## Padroes Proibidos

- `transition-all` em componentes.
- `setInterval(` em `src`.
- `100vh`/`100dvh` em overlays, sheets, modais ou loaders mobile.
- Blur dinamico em `initial`, `animate` ou `exit`.
- Animar `width`/`height` em superficies que aparecem durante scroll, rota, tray ou modal.
- `will-change` permanente em listas ou animacoes finitas.
- Loops CSS sem `stats-lc-engine-loop` quando forem recorrentes.
- Shimmer de skeleton por pseudo-elemento ou loop fora de `Skeleton`/`SkeletonSurface`.
- Novo loader local de modal quando `LazyModalFallback` resolve.
- Nova politica paralela de motion fora de `motionRuntime`.
- Remontar Home, Stats, Circulo ou Ajustes a cada troca de bottom nav.
- Manter mais de uma `data-stats-lc-route-scene` visivel ao mesmo tempo.
- Reintroduzir cover de intencao sobre a bottom nav entre cenas persistentes.
- Colocar um `Suspense` sempre montado entre `AnimatePresence` e o modal condicional.
- Liberar a Home fria enquanto badges/atividade da primeira viewport ainda estao em estado provisório.
- Reutilizar marcador de Home quente de um documento anterior para pular o boot visual.
- Usar `100svh` como distancia de saida de sheets/modais.
- Fazer backdrop de modal sumir mais rapido que a propria sheet.
- Expandir tray persistente com largura/blur maior que o conteudo real.
- `setTimeout` local para delays de UI, toasts, pulsos, highlights, entrada de lista, fallback visual ou scroll de coreografia.
- Arquivos `.bak` ou copias antigas rastreadas dentro de `src`.

## Checklist Para Agentes

Antes de entregar qualquer patch visual:

1. Rode `rg -n "transition-all|setInterval\\(|100vh|100dvh" src`.
2. Rode `npm run lint`.
3. Rode `npm run build` para alteracoes de UI central.
4. Rode `git diff --check`.
5. Em mobile `390x844`, validar pelo menos:
   - zero overflow horizontal;
   - zero imagem quebrada;
   - troca Home -> outra rota -> Home;
   - exatamente uma cena de rota visivel e cenas ocultas sem loops rodando;
   - `data-stats-lc-hidden-route-running-loops="0"` depois de trocar de rota;
   - `data-stats-lc-last-route-settle-ms` atualizado depois de cada troca;
   - modal abre/fecha sem loops do fundo;
   - modal e detalhe aninhado continuam montados durante o primeiro frame de saida e desmontam apenas ao concluir o `exit`;
   - nenhuma superficie principal aparece em bloco seco.

## Inventario

Entradas abruptas conhecidas e historico de correcoes ficam em:

- `docs/abrupt-entry-audit.md`

Quando uma nova superficie aparecer "piscando", registre ali antes ou junto da correcao.
