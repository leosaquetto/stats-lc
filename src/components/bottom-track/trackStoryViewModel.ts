import type { TrackStoryResponse, TrackStorySpecialCard } from '../../types/stats';

export type BottomTrackStoryAvatar = {
  id: string;
  name: string;
  avatar?: string;
  count?: number;
};

export type BottomTrackStoryArtist = {
  id: string;
  name: string;
  image?: string;
  count: number | null;
};

export type BottomTrackStoryViewModel = {
  artwork?: string;
  playbackTime: string;
  title: string;
  tags: string[];
  artists: BottomTrackStoryArtist[];
  artistLine: string;
  album: string;
  releaseDate: string;
  counts: {
    track: number | null;
    album: number | null;
  };
  history: {
    first: string;
    last: string;
    bestYear: TrackStoryResponse['history']['bestYear'];
    late?: {
      previousPlayedAt: string | null;
      returnedAt: string | null;
      gapDays: number;
    };
  };
  advanced: TrackStoryResponse['advanced'];
  social: {
    label: string;
    date: string;
    listeners: BottomTrackStoryAvatar[];
    ranking: BottomTrackStoryAvatar[];
    cakePiecePercent: number | null;
  };
  rarities: TrackStorySpecialCard[];
  primaryRarity: TrackStorySpecialCard | null;
  season: 'summer' | 'autumn' | 'winter' | 'spring' | null;
  partial: boolean;
};

type BuildInput = {
  artwork?: string;
  playbackTime: string;
  title: string;
  tags: string[];
  artists: BottomTrackStoryArtist[];
  album: string;
  releaseDate: string;
  story: TrackStoryResponse | null;
  fallback: {
    trackCount: number | null;
    albumCount: number | null;
    firstPlayedAt: string | number | null;
    lastPlayedAt: string | number | null;
    bestYear: TrackStoryResponse['history']['bestYear'];
    socialLabel: string;
    socialDate: string | number | null;
    listeners: BottomTrackStoryAvatar[];
    ranking: BottomTrackStoryAvatar[];
  };
};

const rarityPriority: Record<TrackStorySpecialCard['code'], number> = {
  shiny: 0,
  hiddenGem: 1,
  special: 2,
  late: 3,
  seasonal: 4,
};

const formatDateTime = (value: string | number | null | undefined) => {
  if (!value) return '--';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '--';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(/\sde\s/g, ' ').replace(',', ' ·').toUpperCase();
};

const getSeason = (rarities: TrackStorySpecialCard[]) => {
  const seasonal = rarities.find((card) => card.code === 'seasonal');
  const month = typeof seasonal?.value === 'number' ? seasonal.value : 0;
  if ([12, 1, 2].includes(month)) return 'summer';
  if ([3, 4, 5].includes(month)) return 'autumn';
  if ([6, 7, 8].includes(month)) return 'winter';
  if ([9, 10, 11].includes(month)) return 'spring';
  return null;
};

export const buildBottomTrackStoryViewModel = ({
  artwork,
  playbackTime,
  title,
  tags,
  artists,
  album,
  releaseDate,
  story,
  fallback,
}: BuildInput): BottomTrackStoryViewModel => {
  const rarities = (story?.specialCards || [])
    .filter((card) => String(card.code) !== 'jealous')
    .map((card) => String(card.code) === 'treasure'
      ? { ...card, code: 'hiddenGem' as const, label: 'HIDDEN GEM', tone: 'hiddenGem' }
      : card)
    .sort((left, right) => rarityPriority[left.code] - rarityPriority[right.code]);
  const lateValue = rarities.find((card) => card.code === 'late')?.value;
  const late = lateValue && typeof lateValue === 'object' && 'gapDays' in lateValue
    ? lateValue
    : undefined;
  const storySocialReady = !!story && !story.coverage.socialPartial;
  const releaseRows = story?.social.releaseListeners?.length
    ? story.social.releaseListeners
    : story?.social.firstListeners || [];

  return {
    artwork,
    playbackTime,
    title,
    tags,
    artists,
    artistLine: artists.map((artist) => artist.name).filter(Boolean).join(' & '),
    album,
    releaseDate,
    counts: {
      track: story?.coverage.counts?.track ? story.counts.track : fallback.trackCount,
      album: story?.coverage.counts?.album ? story.counts.album : fallback.albumCount,
    },
    history: {
      first: formatDateTime(!story?.coverage.historyPartial ? story?.history.firstPlayedAt : fallback.firstPlayedAt),
      last: formatDateTime(!story?.coverage.historyPartial ? story?.history.lastPlayedAt : fallback.lastPlayedAt),
      bestYear: !story?.coverage.historyPartial ? story?.history.bestYear || null : fallback.bestYear,
      late,
    },
    advanced: !story?.coverage.historyPartial ? story?.advanced || null : null,
    social: {
      label: storySocialReady
        ? story.social.heardOnRelease ? 'Ouviu no lançamento' : 'Ouviu primeiro'
        : fallback.socialLabel,
      date: formatDateTime(storySocialReady ? releaseRows[0]?.playedAt : fallback.socialDate),
      listeners: storySocialReady
        ? releaseRows.map((row) => ({ id: row.id, name: row.key || row.id, count: row.count }))
        : fallback.listeners,
      ranking: storySocialReady
        ? story.social.ranking.map((row) => ({ id: row.id, name: row.key || row.id, count: row.count }))
        : fallback.ranking,
      cakePiecePercent: storySocialReady ? story.social.cakePiecePercent : null,
    },
    rarities,
    primaryRarity: rarities[0] || null,
    season: getSeason(rarities),
    partial: !!story?.coverage.partial,
  };
};
