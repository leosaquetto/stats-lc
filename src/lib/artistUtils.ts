// Utilities para manipulação de arrays de artistas
// Reutilizado em: TrackLeaderboardModal, FriendHistoryCard, HomeHighlights

const getArtistName = (artist: any): string => {
  if (!artist) return '';
  if (typeof artist === 'string') return artist;
  return artist.name || artist.artistName || artist.displayName || artist.primaryArtistName || '';
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

  if (track.artist) {
    return track.artist;
  }
  if (track.artistId || track.artistName) {
    return { id: track.artistId, name: track.artistName, artistName: track.artistName };
  }

  if (track.albumArtist) {
    return track.albumArtist;
  }
  if (track.albumArtistName) {
    return { id: track.albumArtistId, name: track.albumArtistName, artistName: track.albumArtistName };
  }

  if (Array.isArray(track.artists) && track.artists.length > 0) {
    const mainArtist = track.artists.find((a: any) => a.isMainArtist === true);
    if (mainArtist) return mainArtist;
    return track.artists[0];
  }

  if (track.album?.primaryArtist) return track.album.primaryArtist;
  if (track.album?.artist) return track.album.artist;
  if (track.album?.primaryArtistName || track.album?.artistName) {
    const name = track.album.primaryArtistName || track.album.artistName;
    return { id: track.album.primaryArtistId || track.album.artistId, name, artistName: name };
  }

  return null;
};

export const getMainArtistName = (track: any): string => {
  const artist = getMainArtist(track);
  if (typeof artist === 'string') return artist;
  return getArtistName(artist) || '';
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
    mainName: getMainArtistName(track) || 'Artista',
    secondary: getSecondaryArtists(track)
  };
};
