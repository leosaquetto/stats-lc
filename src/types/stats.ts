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
  image?: string;
  streams?: number;
  playcount?: number;
  artists?: { name: string; id: string }[];
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
}
