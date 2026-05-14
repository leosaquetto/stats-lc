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
  albumName?: string;
  albumArtist?: string;
  image?: string;
  spotifyId?: string;
  appleMusicId?: string;
  streams?: number;
  durationMs?: number;
  playedCount?: number;
}

export interface NowPlaying {
  track: Track;
  isNow: boolean;
  timestamp: string;
  progressMs?: number;
}

export interface TopItem {
  id: string;
  name: string;
  image?: string;
  streams?: number;
  playcount?: number;
  artists?: { name: string; id: string }[];
}

export interface UserStats {
  id: string;
  name: string;
  avatar?: string;
  nowPlaying?: NowPlaying;
  streamsToday: number;
  totalStreams?: number;
  totalDurationMs?: number;
  scrobbles?: number;
  topItems?: {
    artists: TopItem[];
    tracks: TopItem[];
    albums: TopItem[];
  };
}

export interface GroupStats {
  users: Record<string, UserStats>;
  members?: UserStats[];
  lastUpdated: string;
}
