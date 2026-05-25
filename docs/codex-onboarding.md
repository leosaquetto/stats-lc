# Codex Onboarding For stats.lc

Use este arquivo para iniciar uma nova janela do Codex sem precisar redescobrir o projeto.

## Projeto

- Repo: `/Users/leosaquetto/Developer/GitHub/stats-lc`
- App: frontend web/mobile do `stats.lc`, feito com Vite, React 19, Tailwind, Zustand, Motion e API via `src/services/statsService.ts`.
- Experiencia principal: Home mobile com `LeoHeader`, vinil, ranking summary, atividade do circulo, replay e seletores de usuario.
- API em desenvolvimento: o Vite usa o proprio origin local; em producao o frontend fala com `https://statslc.leosaquetto.com`.

## Como Comecar

1. Entre no repo:

   ```bash
   cd /Users/leosaquetto/Developer/GitHub/stats-lc
   ```

2. Veja estado atual antes de editar:

   ```bash
   git status --short
   ```

3. Suba o servidor:

   ```bash
   npm run dev
   ```

   O script ja sobe em `0.0.0.0:3000`, entao o app fica em:

   - `http://localhost:3000/`
   - `http://192.168.0.8:3000/` para testar no iPhone na mesma rede.

4. Validacoes normais:

   ```bash
   npm run lint
   npm run build
   git diff --check
   ```

   `npm run lint` e `npm run build` sao as validacoes principais. O build pode avisar sobre chunks grandes e imports dinamicos; isso ja existia e nao necessariamente bloqueia a entrega.

## Navegador In-App

- Usar o in-app browser do Codex quando o usuario pedir inspecao visual.
- URL padrao: `http://localhost:3000/`.
- Para comparar com o celular do Leo, usar viewport mobile proxima do iPhone 16e: `390 x 844`.
- Se a ferramenta de browser/CDP falhar, nao gastar muito tempo brigando com ela quando `lint` e `build` ja passaram; avisar claramente.
- O usuario autorizou testes visuais nesta conversa, mas em novas janelas confirme a intencao antes de rodar verificacao visual demorada, porque ele ja pediu em outro momento para nao fazer teste visual sem autorizacao.

## Fluxo De Trabalho Preferido

- Implementar direto quando o pedido for claro.
- Antes de editar, ler os arquivos relevantes com `rg`/`sed`.
- Nao reverter mudancas existentes do usuario.
- Usar `apply_patch` para edicoes manuais.
- Manter o trabalho estreito: corrigir o que foi pedido sem refatorar o app inteiro.
- Depois de mudancas de UI, validar no minimo com `npm run lint`; usar `npm run build` quando a alteracao mexer em componentes centrais.

## Arquivos-Chave

- `src/screens/HomeScreen.tsx`: composicao da Home, pull-to-refresh, splash/loading, portal de modais, atividade do circulo, replay.
- `src/components/home/LeoHeader.tsx`: header principal, estado reproduzindo/ocioso, vinil, progresso, ranking summary, botao/popover de contagens.
- `src/components/home/VinylRecord.tsx`: vinil, texturas procedurais, tonearm, transparencia/plastico.
- `src/components/home/UserSelectorExplosion.tsx`: seletor visual de usuarios.
- `src/components/modals/TrackLeaderboardModal.tsx`: ranking de faixa/artista/album e selecao de artistas secundarios.
- `src/services/statsService.ts`: normalizacao da API, cache de requests, shape de `nowPlaying`.
- `src/store/useStatsStore.ts`: store Zustand, `fetchGroup`, `fetchGroupLive`, throttling/cache local.
- `src/lib/colorUtils.ts`: cor dominante/fallback. Cuidado com `colorthief`: neste repo ele deve ser tratado como API de funcoes, nao como classe com `new`.
- `src/lib/artistUtils.ts`: prioridade de artista principal. Regra importante: quando existir `albumArtist`, ele deve vencer a ordem instavel de artistas da faixa.

## Decisoes Recentes Importantes

- Pull-to-refresh e mini-header devem chamar refresh leve de live (`fetchGroupLive(true)`), nao a sincronizacao pesada.
- Ao final da faixa, a barra deve esperar a duracao real e so entao buscar live. Nao somar duas vezes `progressMs` com timestamp da faixa.
- O app deve mostrar splash/loading no F5 antes de renderizar Replay/Home.
- Quando um usuario for selecionado, o seletor deve fechar.
- O vinil nao deve ser movido de lugar sem pedido explicito.
- Existem 3 variantes procedurais de vinil, geradas por hash de capa/cor e memoizadas localmente. Elas devem ser leves, sem assets pesados no bundle.
- O plastico do vinil deve parecer translucido.
- `albumArtist` tem prioridade para casos como Anitta/Shakira em singles/feats quando o artista principal do album/single e diferente da ordem retornada pela faixa.
- O popover de contagens fica no `LeoHeader`, na linha do nome do usuario, perto do vinil. Ele abre com botao pequeno, fecha no scroll ou clique fora, e mostra:
  - artista: badge de contagem + nome
  - musica: badge de contagem + nome
  - album: badge de contagem + nome, somente se a contagem for maior que zero

## Cuidados De UI Mobile

- Priorizar tela mobile primeiro.
- Nao deixar elementos sobreporem o vinil, ranking summary ou "Atividade do circulo".
- Safe area/notch: backgrounds e splash devem cobrir a area superior.
- Evitar textos explicativos quando o elemento ja e autoexplicativo.
- Badges de contagem devem ficar fora do recorte da imagem quando forem sobre avatares/capas.
- Barra de progresso no estado reproduzindo deve ocupar no maximo cerca de 50% da largura util.
- Se mexer no `LeoHeader`, testar tambem o estado ocioso, porque espacamentos negativos podem invadir areas erradas.

## Referencias Locais

- `referencia_vinis/`: pasta local com referencias visuais de vinis. Nao apagar e nao stagear sem pedido.

## Prompt Curto Para Nova Janela

Cole isto no inicio de uma nova conversa quando quiser economizar contexto:

```text
Leia primeiro /Users/leosaquetto/Developer/GitHub/stats-lc/docs/codex-onboarding.md e use esse arquivo como contexto operacional do projeto stats.lc. Trabalhe no repo /Users/leosaquetto/Developer/GitHub/stats-lc. Se precisar ver visualmente, use o in-app browser em http://localhost:3000/ com viewport mobile 390x844, e suba o servidor com npm run dev se ele nao estiver ativo.
```
