// Utilities para manipulação de arrays de artistas
// Reutilizado em: TrackLeaderboardModal, FriendHistoryCard, HomeHighlights

const getArtistName = (artist: any): string => {
  if (!artist) return '';
  if (typeof artist === 'string') return artist;
  return artist.name || artist.artistName || artist.displayName || '';
};

const getArtistId = (artist: any): string => {
  if (!artist || typeof artist === 'string') return '';
  return artist.id || artist.statsfmId || artist.spotifyId || artist.appleMusicId || '';
};

const sameArtist = (a: any, b: any) => {
  const idA = getArtistId(a);
  const idB = getArtistId(b);
  if (idA && idB && idA === idB) return true;
  const nameA = getArtistName(a).trim().toLowerCase();
  const nameB = getArtistName(b).trim().toLowerCase();
  return !!nameA && !!nameB && nameA === nameB;
};

export const getMainArtist = (track: any): any => {
  if (!track) return null;
  // Prioridade 0: albumArtist corrige singles/feats quando a API ordena artistas de forma instável.
  if (track.albumArtist) {
    return track.albumArtist;
  }
  if (track.album?.artist) {
    return track.album.artist;
  }
  if (track.albumArtistName || track.album?.artistName || track.album?.primaryArtistName) {
    const name = track.albumArtistName || track.album?.artistName || track.album?.primaryArtistName;
    return { id: track.albumArtistId || track.album?.artistId || track.album?.primaryArtistId, name, artistName: name };
  }

  // Prioridade 1: Novos campos da API
  if (track.primaryArtist) {
    return track.primaryArtist;
  }
  if (track.primaryArtistId || track.primaryArtistName) {
    return {
      id: track.primaryArtistId,
      name: track.primaryArtistName,
      artistName: track.primaryArtistName
    };
  }
  
  // Prioridade 2: artista marcado como main no array
  if (Array.isArray(track.artists) && track.artists.length > 0) {
    const mainArtist = track.artists.find((a: any) => a.isMainArtist === true);
    if (mainArtist) return mainArtist;
    
    // Fallback: primeiro artista
    return track.artists[0];
  }
  
  // Prioridade 3: artist object ou artistName
  return track.artist || { id: track.artistId, name: track.artistName };
};

export const getMainArtistName = (track: any): string => {
  const artist = getMainArtist(track);
  if (typeof artist === 'string') return artist;
  return artist?.name || artist?.artistName || 'Artista Desconhecido';
};

export const getSecondaryArtists = (track: any): any[] => {
  if (!track) return [];
  let secondary: any[] = [];
  if (Array.isArray(track.secondaryArtists)) {
    secondary = track.secondaryArtists;
  } else if (Array.isArray(track.artists) && track.artists.length > 0) {
    const mainArtist = getMainArtist(track);
    secondary = track.artists.filter((a: any) => !sameArtist(a, mainArtist));
  }
  
  return secondary.map(a => {
    if (typeof a === 'string') {
      return { id: '', name: a };
    }
    return {
      id: a.id || '',
      name: a.name || a.artistName || 'Artista'
    };
  });
};

export const getArtistListString = (track: any): string => {
  const main = getMainArtistName(track);
  const secondary = getSecondaryArtists(track);
  
  if (secondary.length === 0) return main;
  
  const secondaryNames = secondary
    .map((a: any) => typeof a === 'string' ? a : a.name)
    .join(', ');
  
  return `${main} feat. ${secondaryNames}`;
};

export const formatArtistJSX = (track: any) => {
  // Retorna objeto com main e secondary pra renderizar com JSX
  return {
    main: getMainArtist(track),
    mainName: getMainArtistName(track),
    secondary: getSecondaryArtists(track)
  };
};
