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
   - Controles fisicos manipulados pelo usuario, como tonearm, devem preservar o estado manual ate troca real de faixa; automacao nao pode puxar o controle de volta no mesmo playback.
   - Vinil deve usar identidade estavel da faixa, nunca URL da capa como chave de troca. Depois que a faixa atual entrou em `playing`, artwork/cor ficam travados ate a identidade mudar; enriquecimento tardio nao pode remontar disco, reiniciar rotacao ou mover tonearm.

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
   - Em standalone, congele a altura de launch antes do primeiro paint; nao permita que a splash recentralize quando o viewport do iOS estabilizar.
   - Um novo documento deve invalidar marcadores de Home quente herdados da sessao. Retorno quente dentro do mesmo documento usa estado React, `window.__STATS_LC_HOME_READY__` e telemetria do documento atual.
   - A primeira viewport deve preparar decisoes visuais essenciais antes de sair da splash: dados-base, capas criticas, atividade visivel e badges que mudariam a geometria do header.
   - Mova chamadas ja existentes para o boot e entregue o resultado preparado ao componente; nao duplique requests so para evitar uma entrada tardia.
   - Inicie a entrada finita da Home quando a splash ja estiver dissolvendo. Nao execute toda a coreografia atras de uma splash opaca para depois revelar tudo pronto.
   - Um controle persistente, como `Letra`, nao pode trocar de `key`, posicao ou identidade apenas porque ranking/repeats terminou de carregar.

14. Modo conservador reduz loops, nao elimina entradas finitas essenciais.
   - Entradas unicas curtas com `opacity`/`transform` podem continuar em tier `conserve`, com duracao reduzida.
   - Loops ambientais, equalizers e pulsos continuam condicionados a viewport, visibilidade e `motionRuntime`.
   - Ambientes caros e nao funcionais, como respirar de uma superficie grande ou vinil idle, rodam apenas em tier `full`; em `balanced` a aura estatica permanece e o movimento funcional continua.
   - `AnimatePresence initial={false}` nao deve ser usado no primeiro viewport quando a superficie precisa de uma entrada perceptivel.

15. Rotas-tab pesadas sao cenas persistentes, nao paginas descartaveis.
   - Home, Stats, Circulo e Ajustes devem permanecer sob `PersistentRouteScene`/React `Activity`; trocar de secao alterna a cena visivel sem remontar toda a arvore.
   - Cenas ocultas devem ficar em `Activity mode="hidden"` para preservar DOM/estado e suspender effects, listeners e loops.
   - Deve existir exatamente uma cena `data-stats-lc-route-scene` visivel por vez.
   - Cenas inativas devem declarar `data-stats-lc-route-active="false"` e seus `.stats-lc-engine-loop` precisam computar `animation-name: none`, mesmo se um filho preservado ainda tiver `data-active="true"`.
   - Nao coloque `key={routeKey}` em volta da arvore inteira de uma rota-tab: isso destrói o estado aquecido e repete trabalho sincrono na volta.
   - Modais, detalhes efemeros e rotas fora do shell principal nao viram cenas persistentes automaticamente.
   - Preserve `data-stats-lc-last-route-settle` e `data-stats-lc-last-route-settle-ms` para medir a troca real de cena.

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
