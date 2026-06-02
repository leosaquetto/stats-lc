# Plano dos Modais de Album e Artista

## Resumo

Criar dois modais novos, separados da arena ranking:

- `UserAlbumStatsModal`
- `UserArtistStatsModal`

Esses modais mostram stats pessoais do usuario principal para um album ou
artista, com comparacao do circulo, historico paginado, rankings por ano/total,
acoes externas e letras. O modal da arena (`TrackLeaderboardModal`) continua
existindo para ranking competitivo.

## Endpoints Reutilizados

- `/api/entity`
- `/api/entity-stats`
- `/api/entity-group-stats`
- `/api/entity-streams`
- `/api/entity-listeners`
- `/api/album-tracks`
- `/api/artist-catalog`
- `/api/top`
- `/api/lyrics`

Nenhum endpoint novo e necessario para a primeira versao.

## Modal De Album

- Header com capa, nome, artista, total de reproducoes, minutos/horas, primeira
  e ultima reproducao quando disponivel.
- Badges:
  - Top 100 do ano.
  - Top 100 total.
  - Ano mais forte.
- Abas:
  - `Resumo`
  - `Faixas`
  - `Circulo`
  - `Historico`
  - `Letras`
- Ordenacao das faixas por reproducoes do usuario ou numero da faixa.
- Agregacao por faixa feita a partir de `/api/entity-streams?type=album`.

## Modal De Artista

- Header com imagem, nome, total de reproducoes, minutos/horas e melhor ano.
- Badges:
  - Top 100 do ano.
  - Top 100 total.
- Abas:
  - `Resumo`
  - `Musicas`
  - `Circulo`
  - `Historico`
  - `Letras`
- Agregacao por musica feita a partir de `/api/entity-streams?type=artist`.

## Acoes Por Faixa

Cada faixa listada deve oferecer, quando possivel:

- abrir no stats.fm;
- abrir no Spotify;
- abrir no Apple Music;
- ver letra in-app;
- abrir letra no Genius;
- copiar letra;
- compartilhar letra.

IDs reais vencem buscas externas. Quando nao houver ID confiavel, usar busca
externa como fallback indicado visualmente.

## Performance

- Modal abre imediatamente com shell animado e skeleton leve.
- Dados pesados carregam progressivamente.
- Historico completo fica na aba de historico ou em background.
- Cache em memoria por `userId:type:id:period`.
- In-flight dedupe para evitar requests duplicadas.
- Cancelamento via `AbortController` ao fechar/trocar entidade.
- Nao fazer uma request por faixa para montar ranking.

## Status De Implementacao

- `UserAlbumStatsModal` e `UserArtistStatsModal` foram implementados em uma
  superficie compartilhada.
- O modal antigo de album deixou de ser usado nos fluxos principais de stats do
  usuario.
- A arena ranking continua usando `TrackLeaderboardModal`.
- Entradas ja conectadas: Home/LeoHeader, Replay, Stats, MusicCard e historico
  de albuns.
- Validado no navegador in-app: artista pelo destaque orbital, album pelo
  LeoHeader, abas principais, historico/acoes de faixa e letra in-app com
  Genius/copiar/compartilhar.

## Validacao

- `git diff --check`
- `npm run lint`
- `npm run build`
- navegador in-app mobile `390x844`
- abrir album vindo da Home/Replay/historico;
- abrir artista vindo da Home/Stats/Alike;
- alternar ordenacao;
- comparar com amigos;
- abrir historico e paginar;
- testar letras, Genius, copiar, compartilhar e links externos.
