/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Artist {
  id?: string;
  name: string;
  image?: string;
}

export interface Track {
  id?: string;
  name: string;
  artists: (string | { name: string; id?: string })[];
  primaryArtist?: string | { name: string; id?: string };
  primaryArtistId?: string;
  primaryArtistName?: string;
  secondaryArtists?: (string | { name: string; id?: string })[];
  albumName?: string;
  albumArtist?: string;
  albumId?: string;
  albumImage?: string;
  albumReleaseDate?: string;
  releaseDate?: string;
  album?: {
    id?: string;
    name?: string;
    image?: string;
    releaseDate?: string;
    releasedAt?: string;
    release_date?: string;
  };
  albums?: Array<{
    id?: string;
    name?: string;
    image?: string;
    releaseDate?: string;
    releasedAt?: string;
    release_date?: string;
  }>;
  image?: string;
  spotifyId?: string;
  appleMusicId?: string;
  streams?: number;
  durationMs?: number;
  playedCount?: number;
  playCount?: number;
  catalogAvailability?: {
    appleMusic: boolean;
    spotify: boolean;
  };
  externalIds?: {
    isrc?: string;
    spotify?: string[];
    appleMusic?: string[];
  };
}

export interface LyricsMatch {
  ok: boolean;
  hasLyrics: boolean;
  source?: 'genius';
  reason?: string;
  writers?: string[];
  match?: {
    id?: string | number | null;
    title?: string | null;
    artist?: string | null;
    url?: string | null;
    path?: string | null;
    thumbnail?: string | null;
    confidence?: 'high' | 'medium';
    score?: number;
  } | null;
}

export interface LyricsFullResponse extends LyricsMatch {
  lyrics?: string | null;
}

export interface TrackStoryCountRow {
  key?: string;
  id: string;
  count: number;
  durationMs?: number;
  minutes?: number;
  position?: number;
  playedAt?: number;
}

export type TrackStorySpecialCode = 'shiny' | 'hiddenGem' | 'special' | 'late' | 'seasonal';

export interface TrackStorySpecialCard {
  code: TrackStorySpecialCode;
  label: string;
  tone: string;
  detail: string;
  value?: string | number | {
    previousPlayedAt: string | null;
    returnedAt: string | null;
    gapDays: number;
  } | null;
}

export interface TrackStoryResponse {
  ok: boolean;
  user: string;
  userId: string;
  trackId: string;
  albumId?: string | null;
  artistIds?: string[];
  generatedAt?: string;
  counts: {
    track: number | null;
    album: number | null;
    artists: Array<{ id: string; count: number | null; durationMs?: number | null }>;
  };
  history: {
    count: number;
    firstPlayedAt: string | null;
    lastPlayedAt: string | null;
    bestYear: {
      year: number;
      count: number;
      previousYearCount: number;
      nextYearCount: number;
    } | null;
  };
  advanced: {
    streak: { days: number; start: string | null; end: string | null };
    loopFactor: { day: string; count: number } | null;
    daypart: { key: string; label: string; count: number; percent: number } | null;
    daysSinceFirst: number | null;
    top1kPosition: number | null;
  } | null;
  social: {
    firstListeners: TrackStoryCountRow[];
    releaseListeners: TrackStoryCountRow[];
    ranking: TrackStoryCountRow[];
    ownPosition: number | null;
    cakePiecePercent: number | null;
    heardOnRelease: boolean;
    heardFirst: boolean;
  };
  specialCards: TrackStorySpecialCard[];
  coverage: {
    partial: boolean;
    counts?: {
      track: boolean;
      album: boolean;
      artists: Record<string, boolean>;
    };
    historyPartial?: boolean;
    socialPartial?: boolean;
    topPartial?: boolean;
    fetchedHistoryPages?: number;
    maxHistoryPages?: number;
    historyItems?: number;
    deadlineMs?: number;
    deadlineHit?: boolean;
  };
}

export interface NowPlaying {
  track: Track;
  isNow: boolean;
  timestamp: string;
  progressMs?: number;
  durationMs?: number;
  playedMs?: number;
  dominantColor?: string;
  platformCandidate?: {
    primary: "appleMusic" | "spotify" | "unknown";
  };
}

export interface TopItem {
  id: string;
  name: string;
  type?: 'artist' | 'track' | 'album';
  image?: string;
  streams?: number;
  playcount?: number;
  artistName?: string;
  primaryArtistName?: string;
  albumArtistName?: string;
  artist?: any;
  album?: any;
  artists?: Array<{ name: string; id?: string }>;
  externalIds?: any;
  durationMs?: number;
  playedMs?: number;
  endTime?: string;
  playedAt?: string;
  track?: {
    durationMs?: number;
    externalIds?: any;
    catalogAvailability?: any;
  };
}

export interface UserStats {
  id: string;
  key?: string;
  name: string;
  avatar?: string;
  nowPlaying?: NowPlaying;
  platform?: {
    primary: "appleMusic" | "spotify" | "unknown";
    confidence: string;
    source: string;
  };
  streamsToday: number;
  streamsWeek?: number;
  streamsMonth?: number;
  streamsYear?: number;
  totalStreams?: number;
  totalDurationMs?: number;
  scrobbles?: number;
  topItems?: {
    artists: TopItem[];
    tracks: TopItem[];
    albums: TopItem[];
  };
  topItemsFetchedAt?: number;
  catalogSummary?: any;
  errors?: Record<string, any>;
  recent?: any[];
}

export interface GroupStats {
  users: Record<string, UserStats>;
  members?: UserStats[];
  lastUpdated: string;
  featuredStats?: FeaturedStats;
}

export type LiveNowPlayingByUserId = Record<string, NowPlaying | undefined>;

export interface FeaturedStats {
  userId: string;
  day: string;
  streams: number;
  durationMs: number;
  generatedAt: string;
}

export type LiveStreamsTodayByUserId = Record<string, FeaturedStats | undefined>;
