# Live Playback Architecture

## Objetivo

A Home deve tratar dados de perfil/estatísticas como dados frios e o estado de reprodução como dado quente. Troca de faixa não deve invalidar avatar, nome, tops, insights, Stats Alike, replay ou outras seções que já foram preparadas na splash.

## Separação de Estado

- `groupStats` mantém a base estável dos usuários: id, key, nome, avatar, plataforma, stats, tops, recentes e preferências visuais.
- `liveNowPlayingByUserId` mantém o estado quente por usuário: faixa atual/última, progresso, timestamp, plataforma inferida e `dominantColor`.
- Componentes que precisam de playback devem combinar os dois usando helpers de `src/lib/memberSelectors.ts`:
  - `attachLiveNowPlayingToMember`
  - `getCanonicalMembersWithLive`
  - `getVisibleMembersWithLive`

## Regra de Merge

`/api/group-live?profile=0` é intencional para performance e pode vir sem nome/avatar reais. O app nunca deve deixar esse payload magro apagar um nome/avatar já conhecido por `/api/group` ou cache válido.

Na troca de faixa:

- atualizar `liveNowPlayingByUserId[userId]`;
- preservar o objeto frio do usuário sempre que só mudou `nowPlaying`;
- disparar `nowPlayingChanged` apenas quando faixa/status/playback key mudarem;
- pré-carregar capa e cor antes de liberar a alteração visual quando possível.

## Cor Dominante

A API deve calcular `dominantColor` a partir da capa e devolver esse campo já pronto em:

- `/api/group`
- `/api/group-live`
- `/api/recent`
- `/api/replay`

O app deve preferir `nowPlaying.dominantColor` ou `track.dominantColor`. O cálculo local via canvas em `src/lib/colorUtils.ts` fica apenas como fallback raro para payloads antigos ou falhas temporárias da API.

## Por Que Isso Importa

Separar dados frios e quentes reduz re-render em cascata. A troca de música deve acordar LeoHeader, vinil, progresso, mini stats e atividade ao vivo, mas não deve fazer seções frias pensarem tudo de novo.

## Nota De UI - Bottom Bubble e Flicker

O Bottom Bubble e avatares da Home nao devem remontar ou piscar quando apenas o
payload quente muda. Se a URL efetiva da imagem nao mudou, preserve a ultima
imagem valida enquanto qualquer nova `src` carrega. A animacao da bubble tambem
deve depender de live playback real: sem reproducao ao vivo, ela fica estatica;
com live playback, pode usar apenas `opacity`/`transform` e cor dominante ja
disponivel no payload/cache.
