# plano de melhorias e follow‑ups para stats.lc

## visão geral dos .md do projeto

### documentos encontrados no repositório `stats‑lc`

- **IMPLEMENTATION_SUMMARY.md**  – resume a funcionalidade “Replay” implementada recentemente. Ele registra que a seção foi inspirada no *Spotify Wrapped*, adiciona filtros de tempo (hoje, semana, mês, ano e lifetime) e três listas (artistas, músicas e álbuns) com modais para visualização completa. O guia lista métricas (linhas de código, arquivos novos) e ressalta limitações, como o fato de que os filtros são apenas UI e ainda não chamam a API, o botão de compartilhamento e o botão “⋯” das músicas são placeholders e dependem de `primaryUser.topItems` populado【2†L153-L158】. O documento aponta próximos passos de alta prioridade: conectar os filtros à API `/api/top`, implementar o botão de compartilhamento e adicionar *deep links* para abrir músicas nas plataformas de streaming【2†L163-L168】.  
- **REPLAY_IMPLEMENTATION.md**  – documentação detalhada da implementação do Replay. Descreve os componentes novos (`ReplaySection`, `ReplayModals`, `UserSelectorModal`, `BassPulseIcon`), as melhorias visuais (splash screen com barra de progresso, novos ícones) e as otimizações de performance (uso de `useCallback`, `useMemo` e *lazy loading*). As limitações listadas repetem as do resumo: filtros sem ligação com a API e botões de compartilhamento e “⋯” sem funcionalidade【13†L265-L271】. Há uma seção de “próximos passos” com sugestões como conectar os filtros à API, gerar imagens com `html-to-image` para compartilhamento e criar *deep links*【13†L274-L289】.  
- **TECHNICAL_FOLLOW‑UPS.md** (docs/technical‑followups‑home‑circle.md)  – backlog técnico para as telas Home, Circle e Routing. Sugere corrigir o *warning* do Vite causado por importação circular entre `useStatsStore.ts` e `statsService.ts`, refatorar assinaturas amplas do Zustand para usar seletores estáveis e unificar cancelamento de requests nos *effects*【12†L37-L80】. O documento também recomenda evoluir a aba “Duelos” da Circle, melhorar o sistema de rotas legadas `/circle`, revisar *keys* em modais e listas, padronizar estados de loading/empty/error e consolidar sanitização do cache persistido【12†L104-L126】【12†L198-L220】. Ele sugere lazy‑load das abas de Ranking e Afinidade para reduzir o bundle da tela Circle【12†L281-L297】.
- **CLAUDE.md**  – guia geral para agentes sobre arquitetura, rotas e padrões de design. Explica o uso de Zustand com múltiplos caches, descreve os principais serviços (`statsService.ts` para chamadas de API, `statsCore.ts` para utilidades) e estabelece regras para persistência e performance (não salvar grandes caches em localStorage, usar `AbortController` nos *effects*, etc.). Há advertências sobre *glassmorphism* e guidelines de UX, além de regras de como lidar com orbitais, vinis e charts【3†L149-L167】.
- **docs/api‑contract.md** (no repositório `stats‑lc‑api`) – único documento encontrado no backend. Ele define o contrato público da API e apresenta conceitos chave:
  
  * **Campos de plataforma e catálogo** – define a estrutura de `member.platform` (plataforma primária do usuário), `nowPlaying.platformCandidate` (plataforma sugerida pelo item de stream) e `track.catalogAvailability` (disponibilidade em Spotify e Apple Music)【turn20file0†L7-L23】. O guia enfatiza que **`externalIds` devem ser usados apenas para mapeamento de catálogo e nunca para inferir a origem da reprodução**【turn20file0†L24-L31】.
  
  * **Resiliência das chamadas** – explica que todas as chamadas ao upstream stats.fm são feitas por meio de `statsfmFetch` com cache interno dividido por blocos mensais, TTL variável e deduplicação de requisições simultâneas. Há política de *retry* apenas para erros 5xx e `force=1` respeita um cooldown curto【turn20file0†L33-L47】. Erros são encapsulados e respostas em cache ainda podem ser retornadas como valor “stale” quando o upstream falha【turn20file0†L45-L47】.
  
  * **Lista de endpoints** – a seção “Public Endpoint Reference” documenta as rotas `/api/group`, `/api/group-live`, `/api/user`, `/api/stats`, `/api/stats-cardinality`, `/api/stats-dates`, `/api/top`, `/api/replay`, `/api/user-streams`, `/api/user-friends` e várias rotas de entidade e comparação【turn20file0†L59-L98】. Cada endpoint explica os parâmetros aceitos (`user`, `period`, `after`, `before`, `type`, `limit`, `force` etc.) e destaca que todas as rotas são `GET`. Essas informações confirmam que funcionalidades como ranking, replay e comparação devem consumir essas rotas.
  
  * **Melhorias sugeridas** – ao final, o documento propõe oportunidades futuras: criar um endpoint `/api/top-genres` para gêneros, ajustar a fórmula de pontuação de `/api/compare` com pesos, permitir filtros como `commonMode=all|any` e `minSharedBy` para limitar itens comuns, adicionar ordenação/paginação estável a `/api/user-streams` e `/api/entity-streams`, e consolidar testes【turn20file0†L122-L148】.
  
  Esses pontos mostram que o backend já possui um contrato robusto e resiliente, mas algumas funcionalidades (como gêneros e afinidade) ainda não são expostas por rotas dedicadas. A análise do backend considerará essas notas ao sugerir melhorias.

## observações do aplicativo (baseadas em testes no appstatslc.leosaquetto.com)

### 1. página **Início / Home**

- A tela mostra um vinil animado com a música atual e um botão de *play/pause*. Abaixo há a seção **Atividade do círculo** com um carrossel que traz a última música reproduzida pelos amigos, um contador de streams recentes e um menu “ver histórico” que abre um modal de histórico. A experiência é fluida, mas quando clicado o histórico abre um modal que parece não ter botão de fechar visível, exigindo clicar no “X” no canto (isso poderia ser mais intuitivo).  
- A seção **Replay** apresenta listas de artistas, músicas e álbuns mais ouvidos com filtros de período. Durante o teste, os cards foram renderizados corretamente mas os botões de compartilhar (ícone de *share*) e os botões “⋯” nas músicas não executam nenhuma ação (placeholders)【2†L155-L157】.  
- Há contagem de minutos ouvidos, porém ela não muda quando se troca de período, confirmando que os filtros não estão conectados à API (apenas UI)【2†L164-L168】.  
- Após o Replay há a seção **Top 1 do círculo** e um carrossel de usuários “Seu Círculo”. Estas áreas se renderizam, mas não há interações além do scroll.  
- A tela inicial é visualmente agradável, mas algumas ações geram sobreposição de modais sem sinalização clara ou carregam conteúdo vazio. É importante padronizar estados de carregamento e vazio aqui, conforme sugerido no backlog técnico【12†L198-L220】.

### 2. página **Stats (Estatísticas)**

- A aba **Stats** abre com *“Insights do dia”* e mostra cards de melhor faixa, artista mais ouvido e um resumo com total de streams e horas. Em alguns testes esses cards exibiram valores (por exemplo, **11 streams** e **38 m** no período de hoje), indicando que a consulta de stats funciona, mas **faltam indicadores de carregamento** e, enquanto os dados carregam, a área fica vazia.

  - A seção **Análise Temporal** pretende mostrar um gráfico de área com streams/horas ao longo do tempo. Mesmo quando havia alguns streams no dia, o gráfico exibiu “sem dados suficientes” e ficou em branco【27878859810645†screenshot】. É necessário implementar fallback com mensagem contextual e botão de *retry* e verificar se `statsService.getStats()` está retornando dados agregados suficientes para preencher o gráfico.

  - A subseção **Meus mais tocados** possui campos de busca e filtros, mas não listou nenhuma música; possivelmente a API não retornou dados ou a listagem não foi chamada. Essa área deve adotar estados de loading/empty padronizados e cache.

  - Os filtros (Hoje, Semana, Mês, Ano, Total) deveriam disparar requisições diferentes. O código do `StatsScreen` usa `useEffect` para buscar rankings e gráficos; o backlog técnico recomenda introduzir `AbortController` e limpeza para evitar atualizações de estado em componentes desmontados【12†L83-L103】.

### 3. página **Circle / Arena do Grupo**

- Na aba **Ranking**, a tela exibe tabs de período e tipo (streams versus tempo de audição). Em testes iniciais, a rivalidade semanal apareceu com valores **“0 vs 0”**, sugerindo ausência de dados ou cálculo incorreto. Após recarregar a página, os valores foram preenchidos (por exemplo, **4 128 streams vs 3 935 streams** com **8 h 59 m** de diferença), o que indica um problema de cache ou atualização. O botão “Comparar Top 5 artistas” continua sem ação, indicando placeholder.

  - A seção **Arena Battle Global** inicialmente exibia “0 vs 0”, mas, com dados carregados, mostra valores corretos. É necessário garantir que a tela consulte e exiba dados de `/api/compare` mesmo quando o cache local está vazio.

  - A aba **Duelos** permanece um placeholder. A aba **Afinidade** carrega `AlikeScreen`, mas todos os percentuais de afinidade aparecem como **0 %**; falta integrar a API ou implementar algoritmo de cálculo de afinidade. O backlog sugere evoluir a aba Duelos sem grande redesign, reaproveitando a rivalidade semanal【12†L104-L124】.

  - Recomenda‑se lazy‑load das abas Ranking e Afinidade para reduzir o bundle inicial da rota `/circle`【12†L281-L297】.

### 4. página **Ajustes / Settings**

- A tela de ajustes lista os usuários do grupo e permite escolher o “Usuário em destaque”. A interação troca a seleção corretamente. A seguir há a seção **Visibilidade** com um toggle para ocultar a badge de ranking e chips para ocultar membros; essas opções persistem no store de Zustand.  
- A seção **Ordem do histórico** oferece três opções (última reprodução, ordem alfabética e personalizada). Durante o teste elas não refletiram mudanças imediatas no histórico; verifica‑se se a função que reordena o array está implementada.  
- Em **Snaps & compartilhamento** há um campo “Nome da Arena” com valor editável e um botão “Abrir galeria”; entretanto, clicar no botão não abre nada – parece um placeholder.  
- **Notificações push** apresentam toggles, mas o app informa “Notificações bloqueadas pelo navegador” e os controles ficam desabilitados. Seria interessante checar a API de Notificações e pedir permissão adequadamente, exibindo fallback amigável.  
- A seção **Sincronização de dados** tem um slider para ajustar o intervalo de atualização (20–120s). O slider exibe valor atual mas não mostra confirmação de que o valor foi salvo; pode‑se adicionar callback para persistir no store e feedback visual.  
- Em **Ajustes visuais & animações** há três sliders (Fade‑in delay, Cascade delay e Shimmer velocity). Os sliders funcionam, mas não há indicação do valor exato nem tooltip; poderia mostrar o valor e adicionar uma pré‑visualização.  
- No final há **Reiniciar app** que apaga caches. Segundo o CLAUDE.md, o reset deve limpar localStorage, CacheStorage e sessionStorage com try/catch e pedir confirmação do usuário【3†L260-L276】. Atualmente o botão aparece sem confirmação.  
- Em geral, a tela de ajustes é completa, porém vários botões são placeholders e deveriam ser conectados a funções reais (galeria de snaps, renomear arena, ordenar histórico). A padronização de estado (enabled/disabled), persistência e feedback ao usuário deve ser reforçada.

## bugs e inconsistências identificados

1. **Placeholders sem função:** botões de compartilhamento e “⋯” no Replay; botão “Comparar Top 5 artistas” na Arena; botão “Abrir galeria” nos ajustes; campo “Nome da Arena” não persiste alteração; controle de notificações push inoperante.  
2. **Dados zerados ou atrasados:** em alguns testes a rivalidade semanal e a Arena Battle global mostraram **“0 vs 0”**, mas após recarregar a página surgiram valores corretos. Isso indica problemas de cache ou atualização da store ao ler `/api/group` e `/api/compare`. O gráfico de análise temporal e a lista “Meus mais tocados” continuaram vazios; é preciso verificar se `statsService.getStats()` e `/api/top` estão retornando dados e se o frontend os consome.
3. **Ausência de feedback de carregamento:** algumas seções ficam vazias enquanto aguardam dados, sem indicador de loading. O backlog recomenda criar componentes `SectionLoadingState`, `SectionEmptyState` e `SectionErrorState` reutilizáveis【12†L198-L220】.  
4. **Persistência de ajustes:** sliders e campos nos ajustes não mostram confirmação de salvamento. O reset do app não pede confirmação.  
5. **UI não responsiva a erros:** se a API falhar, os componentes tentam renderizar com dados `undefined`, causando modais vazios ou seções em branco. É importante utilizar verificações de null e estados de erro.

## sugestões de melhorias e código

### 1. conectar filtros e ranking à API

- **Implementar chamadas para `/api/top`** no `ReplaySection.tsx` passando o usuário e o período selecionado (`type=artists/tracks/albums`, `period=day/week/month/year/all`) e tratar a resposta. Utilizar `useEffect` com `AbortController` para cancelar requisições pendentes quando o usuário trocar de período. Exemplo:

  ```tsx
  useEffect(() => {
    const controller = new AbortController();
    async function fetchTop() {
      setLoading(true);
      try {
        const data = await statsService.getTopItems({
          userId: primaryUser.id,
          type: activeTab,       // 'artists' | 'tracks' | 'albums'
          period: selectedPeriod,
          limit: 12,
          signal: controller.signal,
        });
        setItems(data.items);
      } catch (err) {
        if (!controller.signal.aborted) setError(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchTop();
    return () => controller.abort();
  }, [activeTab, selectedPeriod, primaryUser.id]);
  ```

- **Implementar `/api/compare` e `/api/duels`** para preencher a rivalidade e a Arena Battle global. Na `RankingScreen` adicionar efeito para buscar dados comparativos e calcular diferença de streams/horas. Em `CircleScreen` criar componente `DuelsSection` com cards de confrontos semanais.

- **Melhorar hooks de fetch:** extrair lógica de cancelamento e loading para um hook utilitário (`useFetch`) para reduzir repetição.

### 2. padronizar estados de loading, empty e error

Criar componentes pequenos reutilizáveis:

```tsx
function SectionLoadingState({ title }: { title: string }) {
  return <div className="min-h-32 flex items-center justify-center text-white/50">Carregando {title}…</div>;
}
function SectionEmptyState({ title }: { title: string }) {
  return <div className="min-h-32 flex items-center justify-center text-white/30">Nenhum {title} encontrado.</div>;
}
function SectionErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-32 flex flex-col items-center justify-center gap-2 text-red-400">
      <span>Ocorreu um erro ao carregar os dados.</span>
      <button onClick={onRetry} className="px-3 py-1 bg-orange-500 rounded-md">Tentar novamente</button>
    </div>
  );
}
```

Usar esses componentes em Home, Stats, Circle e Ajustes para melhorar UX em redes lentas ou falhas de API.

### 3. otimizações de Zustand e store

- Refatorar componentes que usam `useStatsStore()` inteiro para assinaturas pontuais, como recomenda o backlog【12†L37-L80】. Por exemplo:

  ```tsx
  const featuredUserId = useStatsStore(s => s.featuredUserId);
  const hiddenUsers   = useStatsStore(s => s.hiddenUsers);
  const setHiddenUsers = useStatsStore(s => s.setHiddenUsers);
  ```

- Desacoplar funções puras de normalização do `statsService` para um módulo sem dependência de Zustand, eliminando o *warning* de Vite sobre importação circular【12†L7-L36】.

- Criar função de sanitização do estado persistido para deduplicar membros, validar `featuredUserId` e limpar caches inválidos【12†L223-L252】. Executar essa sanitização ao iniciar a aplicação ou ao restaurar o store.

### 4. implementação de duelos e afinidade

- Evoluir a aba **Duelos** dentro da Circle sem redesign. Usar a rivalidade semanal existente para gerar confrontos automáticos: selecionar os dois usuários com maior diferença de streams na semana e exibir cards com progresso e botões de share.  
- Para a aba **Afinidade**, aproveitar o `StatsAlike` para calcular afinidade entre usuários e exibir conexões fortes. O cálculo deve ser feito no backend (`stats‑lc‑api`) para evitar expor lógica pesada no frontend.

### 5. melhorias de UI/UX

- **Animações e valores:** nos sliders das seções de ajustes, exibir o valor atual ao lado do controle e permitir reset para o padrão.  
- **Botões de share e ⋯:** implementar funcionalidade real usando a API `navigator.share()` (quando disponível) ou gerar imagens via `html-to-image` e abrir em nova aba. Para “⋯” nas músicas, detectar a plataforma do usuário (Spotify ou Apple Music) via `member.platform`【3†L46-L58】 e gerar *deep link* para a música (ex.: `https://open.spotify.com/track/${track.id}`).  
- **Feedback de persistência:** quando o usuário altera a ordem do histórico, renomeia a arena ou ajusta sliders, mostrar um *toast* confirmando salvamento.  
- **Modal de histórico:** adicionar botão de fechar mais evidente e permitir sair com swipe para baixo em mobile.  
- **Tema responsivo:** garantir que todos os componentes se ajustem em telas de diferentes alturas (incluindo iPhone SE) e que os carrosséis usem `scroll-snap-type` para scroll suave.

### 6. melhorias na página de ajustes

- Conectar o campo “Nome da Arena” ao store e persistir a alteração no `localStorage`/`stats-lc-storage`. Adicionar validação de tamanho (máx. 50 caracteres) e botão de salvar.  
- Implementar a “Galeria de snaps” integrando com `snapshotService.ts` e mostrando snapshots salvos. Permitir excluir ou compartilhar cada snap.  
- Para as notificações push, chamar `Notification.requestPermission()` e, se aprovado, registrar um `ServiceWorker` para receber mensagens; caso contrário, mostrar mensagem clara de que as notificações não estarão disponíveis.  
- Adicionar confirmação modal ao botão “Reiniciar app”; o modal deve explicar que caches locais serão apagados e solicitar confirmação do usuário.  
- Permitir ordenar manualmente os membros (arrastar e soltar) quando “Ordem do histórico” estiver como “Personalizada”.

### 7. diretrizes para o backend `stats‑lc‑api`

- **Resiliência e respostas parciais** – garantir que os endpoints retornem dados parciais ao invés de 500 em caso de falha, conforme orientado no codex onboarding. `/api/group` deve ser resiliente e retornar warnings e campos vazios quando houver erro de membro ou de upstream【turn4file1†L156-L167】. A implementação de `statsfmFetch` já deduplica e fragmenta requisições em blocos mensais com TTLs diferentes【turn20file0†L33-L47】; esse padrão deve ser mantido.

 - **Cumprir o contrato de plataforma** – nunca inferir plataforma a partir de `externalIds`; usar os campos `member.platform` e `nowPlaying.platformCandidate` para exibir ou filtrar links de música【turn20file0†L7-L31】. Ao normalizar entidades, incluir `catalogAvailability` com flags para Spotify e Apple Music【turn20file0†L18-L23】.

 - **Novos endpoints e extensões** – avaliar implementar `/api/top-genres` para permitir filtros de gêneros e enriquecer páginas de gêneros; ajustar a fórmula de pontuação em `/api/compare` com pesos de proximidade de posição, tempo mínimo de reprodução e equilíbrio, como sugerido na documentação【turn20file0†L122-L148】. Permitir parâmetros opcionais como `commonMode=all|any`, `minSharedBy` ou `order`/`cursor` para `/api/user-streams` e `/api/entity-streams` para facilitar paginação e pré-filtragem.

 - **Consolidar handlers e testes** – consolidar endpoints e remover handlers redundantes para não exceder o limite de funções do plano *Hobby*. Promover o setup temporário de testes para um comando suportado pelo repositório e garantir que contratos sejam cobertos por testes integrados.

 - **Documentação e campos faltantes** – documentar o contrato da API para tops, compare e stats; isso facilitará integrar o frontend e evitará campos faltantes (por exemplo, `albumArtistName` ainda chega como `null` em alguns álbuns). Usar `docs/api‑contract.md` como referência e atualizá-lo conforme novos endpoints forem criados.

### 8. roteiro de implementação sugerido

1. **Prioridade alta:**
   - Conectar filtros da seção Replay e Stats à API (`statsService.getTopItems`, `getStats`), com estados de loading/empty/error.  
   - Implementar funcionalidade de compartilhamento e *deep links*.  
   - Corrigir cálculo de rivalidades e ranking global, preenchendo valores na Arena.  
   - Implementar modais e botões ausentes (Comparar Top 5, Galeria de snaps).  
2. **Prioridade média:**
   - Refatorar store e cancelamento de requests; criar sanitização de cache; padronizar selectors de Zustand.  
   - Unificar componentes de estados (loading/empty/error) e aplicar em todas as telas.  
   - Evoluir a aba Duelos e otimizar lazy‑load das abas do Circle.  
3. **Prioridade baixa:**
   - Melhorias de UI/UX (valores nos sliders, tooltips, modais mais intuitivos).  
   - Ajustes visuais adicionais (animações de transição entre períodos, pull‑to‑refresh, skeleton loaders).  
   - Analytics (rastreamento de filtros e abertura de modais).  

## conclusão

A aplicação stats.lc é rica em funcionalidades e apresenta uma estética moderna, mas ainda possui diversas áreas com placeholders, ausência de dados e oportunidades de melhoria. Os documentos do repositório evidenciam que a equipe está ciente das limitações e já possui um backlog técnico estruturado. O plano acima organiza as observações do teste com o aplicativo e as recomendações dos documentos em ações concretas de desenvolvimento. Implementando as sugestões propostas, a experiência do usuário será mais robusta, a performance e a manutenibilidade do código melhorarão e novos recursos – como duelos e compartilhamento – poderão ser explorados.
