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

6. Modais devem declarar escopo de motion.
   - Use `useModalMotionScope(...)` quando uma superficie modal abrir.
   - O container principal do modal/fallback deve ter `data-stats-lc-modal-surface="true"`.
   - Loops do cenario de fundo devem pausar; loops internos do modal podem continuar se forem essenciais.

7. Loops CSS precisam ser rastreaveis e pausaveis.
   - Elementos animados por CSS devem usar `stats-lc-engine-loop`.
   - Quando aplicavel, definir `data-active="true"` ou `data-active="false"`.
   - Nao assumir que `animation-play-state: running` significa loop real; verificar `animation-name !== none`.

8. Transicoes devem listar propriedades.
   - Nao usar `transition-all` em `src`.
   - Preferir `transition-[background-color,border-color,box-shadow,opacity,transform]` conforme a superficie.

9. Assets, cores e caches visuais devem respeitar memoria adaptativa.
   - Use `assetRuntime`, `memoryRuntime`, `readRuntimeCacheEntry` e `setRuntimeCacheEntry` para caches visuais.
   - Nao criar `Map`/arrays visuais sem limite para capas, paletas ou texturas.

10. Telemetria deve permanecer separada por boot e pos-boot.
   - Preserve `window.__STATS_LC_PERFORMANCE__`.
   - Preserve atributos `data-stats-lc-*` usados para auditar long tasks, LoAF, loaders e loops.

11. Browser QA deve usar rotas hash.
   - Home: `/#/`
   - Stats: `/#/stats`
   - Circle: `/#/circle`
   - Settings: `/#/settings`
   - Arena: `/#/ranking` ou `/#/circle` com aba Arena quando aplicavel.

12. Arquivos mortos nao devem morar em `src`.
   - Nao manter `.bak`, copias antigas ou snippets soltos dentro de `src`.
   - Se uma referencia historica for necessaria, documente em `docs/` em vez de deixar codigo morto importavel/auditavel.

## Padroes Permitidos

- `EngineSpinner` para loading rotativo.
- `EngineEqualizer` para barras de audio.
- `EngineBreathe`, `EnginePulse`, `EngineSpin`, `EngineShimmer` para loops pequenos e pausaveis.
- `motion.div`/`motion.button` com `initial`, `animate`, `exit` e transicoes curtas.
- `layout="position"` somente quando ha reposicionamento real de cards/listas.
- `LazyModalFallback` para chunks de modal.
- `RouteIntentCover` e `RouteLoader` para troca de rota.
- Timeouts funcionais de rede, API, deadline de asset/I/O, safety release, polling visibility-aware e sequenciamento de Web Animations API.

## Padroes Proibidos

- `transition-all` em componentes.
- `setInterval(` em `src`.
- `100vh`/`100dvh` em overlays, sheets, modais ou loaders mobile.
- Blur dinamico em `initial`, `animate` ou `exit`.
- Animar `width`/`height` em superficies que aparecem durante scroll, rota, tray ou modal.
- Loops CSS sem `stats-lc-engine-loop` quando forem recorrentes.
- Novo loader local de modal quando `LazyModalFallback` resolve.
- Nova politica paralela de motion fora de `motionRuntime`.
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
   - modal abre/fecha sem loops do fundo;
   - nenhuma superficie principal aparece em bloco seco.

## Inventario

Entradas abruptas conhecidas e historico de correcoes ficam em:

- `docs/abrupt-entry-audit.md`

Quando uma nova superficie aparecer "piscando", registre ali antes ou junto da correcao.
