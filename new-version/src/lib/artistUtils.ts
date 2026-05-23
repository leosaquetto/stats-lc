// Utilities para manipulação de arrays de artistas
// Reutilizado em: TrackLeaderboardModal, FriendHistoryCard, HomeHighlights

export const getMainArtist = (track: any): any => {
  if (!track) return null;
  // Prioridade 0: Novos campos da API
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

  // Prioridade 1: albumArtist (artista principal do álbum)
  if (track.albumArtist) {
    return track.albumArtist;
  }
  if (track.album?.artist) {
    return track.album.artist;
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
    secondary = track.artists.filter((a: any) => 
      a.id !== mainArtist?.id && 
      a.name !== mainArtist?.name
    );
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
