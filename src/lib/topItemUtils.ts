import type { TopItem } from '../types/stats';

export type TopItemType = 'artist' | 'track' | 'album';

export const TOP_ITEMS_CACHE_VERSION = 'v2';

export const buildTopItemsCacheKey = (
  userCacheKey: string,
  type: `${TopItemType}s`,
  periodKey: string
) => `${TOP_ITEMS_CACHE_VERSION}:${userCacheKey}:${type}:${periodKey}`;

const normalizeType = (value: unknown): TopItemType | null => {
  const normalized = String(value || '').toLowerCase().replace(/s$/, '');
  return normalized === 'artist' || normalized === 'track' || normalized === 'album'
    ? normalized
    : null;
};

export const getTopItemArtistName = (item: any): string => {
  const candidates = [
    item?.primaryArtistName,
    item?.artistName,
    item?.albumArtistName,
    item?.primaryArtist,
    item?.artist,
    item?.albumArtist,
    item?.track?.primaryArtistName,
    item?.track?.artistName,
    item?.track?.primaryArtist,
    item?.track?.artist,
    item?.album?.primaryArtistName,
    item?.album?.artistName,
    item?.album?.primaryArtist,
    item?.album?.artist,
    Array.isArray(item?.artists) ? item.artists[0] : undefined,
    Array.isArray(item?.track?.artists) ? item.track.artists[0] : undefined,
    Array.isArray(item?.album?.artists) ? item.album.artists[0] : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === 'object') {
      const name = candidate.name || candidate.artistName || candidate.displayName;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
  }

  return '';
};

export const normalizeTopItemForType = (
  input: any,
  expectedType: TopItemType
): TopItem | null => {
  if (!input || typeof input !== 'object') return null;

  const wrapper = input.item && typeof input.item === 'object' ? input.item : input;
  const explicitType = normalizeType(
    input.type || input.itemType || input.entityType ||
    wrapper.type || wrapper.itemType || wrapper.entityType
  );
  if (explicitType && explicitType !== expectedType) return null;
  if (
    expectedType === 'track' &&
    !wrapper.track &&
    wrapper.album?.name &&
    String(wrapper.name || wrapper.title || '').trim().toLowerCase() ===
      String(wrapper.album.name).trim().toLowerCase()
  ) {
    return null;
  }

  const nestedExpected = wrapper[expectedType];
  const nestedOther = expectedType !== 'track' && wrapper.track
    ? wrapper.track
    : expectedType !== 'artist' && wrapper.artist && typeof wrapper.artist === 'object'
      ? wrapper.artist
      : expectedType !== 'album' && wrapper.album && !wrapper.track
        ? wrapper.album
        : null;
  if (!nestedExpected && nestedOther && !explicitType && !wrapper.id) return null;

  const entity = nestedExpected && typeof nestedExpected === 'object' ? nestedExpected : wrapper;
  const name = entity.name || entity.title || wrapper.name || wrapper.title || '';
  if (!name) return null;

  const artistName = getTopItemArtistName({ ...wrapper, ...entity });
  return {
    ...wrapper,
    ...entity,
    id: String(entity.id || wrapper.id || `${expectedType}:${name}`),
    name,
    type: expectedType,
    image:
      entity.image ||
      entity.albumImage ||
      entity.images?.[0]?.url ||
      entity.images?.[0] ||
      wrapper.image ||
      wrapper.albumImage ||
      wrapper.album?.image,
    streams: wrapper.streams ?? entity.streams,
    playcount: wrapper.playcount ?? wrapper.count ?? entity.playcount ?? entity.count,
    artistName: artistName || undefined,
    primaryArtistName: entity.primaryArtistName || wrapper.primaryArtistName || artistName || undefined,
    artists: entity.artists || wrapper.artists,
    externalIds: entity.externalIds || wrapper.externalIds,
    track: expectedType === 'track' ? { ...(wrapper.track || {}), ...entity } : wrapper.track,
    album: expectedType === 'album' ? { ...(wrapper.album || {}), ...entity } : wrapper.album,
    artist: expectedType === 'artist' ? { ...(wrapper.artist || {}), ...entity } : wrapper.artist,
  };
};

export const sanitizeTopItems = (items: any[], expectedType: TopItemType) =>
  (Array.isArray(items) ? items : [])
    .map((item) => normalizeTopItemForType(item, expectedType))
    .filter((item): item is TopItem => Boolean(item));
