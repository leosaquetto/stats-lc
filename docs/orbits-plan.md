# Orbits

Orbits sao sugestoes de musicas entre membros do circulo. A feature precisa de backend porque os estados de visto, aberto, ouvido e a contagem de plays depois do envio devem ser compartilhados entre usuarios e comparados contra historico real.

## Modelo

```ts
type OrbitStatus = 'sent' | 'seen' | 'opened' | 'listened' | 'dismissed';

interface Orbit {
  id: string;
  fromUserId: string;
  toUserId: string;
  track: NormalizedTrack;
  message?: string;
  status: OrbitStatus;
  createdAt: string;
  seenAt?: string;
  openedAt?: string;
  firstListenedAt?: string;
  listenCountSinceSent: number;
  lastCheckedAt?: string;
  targetPlatform?: string;
  listenUrl?: string;
}
```

## API

- `GET /api/orbits?user=<id>&box=received|sent|all`
- `GET /api/orbits/summary?user=<id>`
- `POST /api/orbits`
- `POST /api/orbits/:id/seen`
- `POST /api/orbits/:id/opened`
- `POST /api/orbits/:id/dismiss`
- `POST /api/orbits/:id/check-listens`

## Regras

- `listenUrl` deve priorizar a plataforma primaria do destinatario (`member.platform.primary`).
- Se a faixa nao existir na plataforma primaria, usar disponibilidade de catalogo como fallback.
- Nao inferir origem de playback por `externalIds`; eles servem so para match/catalogo.
- Para marcar como ouvido, contar streams do destinatario depois de `createdAt`.
- Match de faixa: `track.id` primeiro, depois `externalIds.spotify/appleMusic`.
- Nao usar `force=1` em checks automaticos.
- Nao persistir listas completas de Orbits no Zustand.

## UI em `/circle`

- Inserir bloco `Orbits` entre Arena Live e Timeline da sessao.
- Mostrar contadores: recebidos, enviados, enviados ouvidos.
- Abas: `Recebidos`, `Enviados`, `Criar`.
- Recebidos: quem enviou, capa, musica, artista, mensagem, status e acao ouvir.
- Enviados: destinatario, visto, link aberto, ouvido e plays desde envio.
- Criar: escolher amigo, buscar musica, preview, mensagem curta e enviar.

## Ordem

1. Contrato frontend: tipos e `orbitService`. Feito.
2. UI inicial em `/circle` com estados de loading/erro/vazio. Feito.
3. Composer com busca de musica e destinatario. Feito.
4. Backend real no `stats-lc-api`. Feito com fallback em memoria.
5. Persistencia duravel. Feito via Postgres/Neon quando `DATABASE_URL` ou `POSTGRES_URL` existir.
6. Integrar acoes de visto/aberto/ouvido. Parcial: visto, aberto e check de plays implementados.
7. Adicionar entrada `Enviar Orbit` nos modais/cards de musica. Feito na Timeline e no modal de faixa.

## Progresso em 2026-06-01

- `stats-lc-api` ganhou `lib/api-handlers/orbits.ts` e `lib/orbits-store.ts`.
- Rotas adicionadas no catch-all: `/api/orbits`, `/api/orbits/summary`, `/api/orbits/:id/seen`, `/opened`, `/dismiss`, `/check-listens`, `/delete-sent`, `/delete-received`.
- `lib/orbits-store.ts` usa Neon/Postgres com `@neondatabase/serverless` se `DATABASE_URL` ou `POSTGRES_URL` estiver configurado.
- Sem URL de banco, o store usa `Map` em memoria para desenvolvimento.
- Schema criado automaticamente:
  - tabela `orbits`
  - indices `orbits_to_user_idx`, `orbits_from_user_idx`, `orbits_track_idx`
  - exclusao por lado com `sender_deleted_at` e `recipient_deleted_at`
- `stats-lc` ganhou `src/services/orbitService.ts` e `src/components/circle/OrbitsSection.tsx`.
- `/circle` mostra Orbits entre Arena Live e Timeline.
- Timeline e `TrackHistoryModal` disparam `stats-lc:compose-orbit` para abrir composer com a faixa preenchida.
- Proximo passo recomendado: configurar Neon no Vercel e setar `DATABASE_URL` no projeto correto antes de validar em producao.

## Progresso em 2026-06-02

- `/circle` foi reorganizado como shell com `Agora`, `Orbits`, `Arena`,
  `Duelos` e `Afinidade`; somente a aba ativa monta.
- `/ranking` continua abrindo Arena e `/alike` continua abrindo Afinidade.
- `GET /api/orbits` passou a ser leitura rapida do store. Auditoria de plays nao
  bloqueia mais a listagem.
- O frontend chama `/check-listens` progressivamente para ate tres itens
  enviados desatualizados por montagem, com TTL de cinco minutos.
- Criacao de Orbit valida membros conhecidos, bloqueia autoenvio e exige
  identidade utilizavel da faixa.
- O projeto Vercel correto da API foi confirmado. A integracao Neon foi
  iniciada e aguarda aceite de termos para provisionar a URL do banco.
- Validacao atual da API: `npm run typecheck`, `npm test` e `git diff --check`.
  A suite passou com `55` testes.
- Neon `neon-cyan-queen` foi provisionado e conectado ao projeto
  `stats-lc-api`; a API publicada responde `durable: true`.
- Vercel ganhou rewrites explicitos para `/api/orbits/summary` e
  `/api/orbits/:id/:action`, pois caminhos aninhados nao chegavam ao catch-all.
- Smoke de producao criou, listou, atualizou e removeu um Orbit temporario dos
  dois lados, confirmando exclusao independente.
- Composer tenta `/api/search` primeiro e, quando o upstream volta vazio, usa
  recentes resolvidos e Top Tracks do usuario como fallback manual.
- Deep link fria em `/circle?tab=orbits` usa `leo` como identidade inicial
  estavel ate a hidratacao do usuario canonico. Isso impede loading infinito
  quando a Orbita abre antes da Home.
- Inbox inicia lista e resumo em paralelo; a leitura vazia nao depende da
  atualizacao secundaria dos contadores.
- Smoke final publicado em `390x844`: bundle `index-BqIdfJHs.js`, inbox vazia
  coerente e nenhum spinner restante.
