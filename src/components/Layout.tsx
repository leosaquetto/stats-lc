/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Home, AudioLines, SlidersHorizontal, WifiOff, Orbit, Music2, FileText, Loader2, Disc3, UserCircle, ListMusic, BookOpen, ExternalLink, Copy, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';
import { statsService } from '../services/statsService';
import { AnimatedNumber, SmartImage } from './shared/CommonUI';
import { attachLiveNowPlayingToMember, getCanonicalMembersWithLive } from '../lib/memberSelectors';
import { getMainArtist, getMainArtistName } from '../lib/artistUtils';
import { parseTrackTitleBadges } from '../lib/trackTitleBadges';
import type { LyricsFullResponse, LyricsMatch } from '../types/stats';

const NAV_ITEMS = [
  { label: 'Início', icon: Home, path: '/', activePaths: ['/'] },
  { label: 'Stats', icon: AudioLines, path: '/highlights', activePaths: ['/highlights'] },
  { label: 'Órbita', icon: Orbit, path: '/circle', activePaths: ['/circle', '/ranking', '/alike'] },
  { label: 'Ajustes', icon: SlidersHorizontal, path: '/settings', activePaths: ['/settings'] },
];

const EqualizerIcon = () => {
  return (
    <div className="flex items-end gap-[1.5px] h-3 w-3.5 shrink-0 select-none pb-[1px]" aria-hidden="true">
      <motion.span
        animate={{ scaleY: [0.2, 0.9, 0.2] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", repeatType: "mirror" }}
        className="h-full w-[1.5px] bg-orange-500 rounded-full inline-block origin-bottom shrink-0"
      />
      <motion.span
        animate={{ scaleY: [0.35, 1, 0.35] }}
        transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", repeatType: "mirror", delay: 0.15 }}
        className="h-full w-[1.5px] bg-orange-500 rounded-full inline-block origin-bottom shrink-0"
      />
      <motion.span
        animate={{ scaleY: [0.15, 0.8, 0.15] }}
        transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut", repeatType: "mirror", delay: 0.3 }}
        className="h-full w-[1.5px] bg-orange-500 rounded-full inline-block origin-bottom shrink-0"
      />
    </div>
  );
};

const GeniusLogo = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Genius">
    <path
      fill="currentColor"
      d="M12.897 1.235c-.36.001-.722.013-1.08.017-.218-.028-.371.225-.352.416-.035 1.012.023 2.025-.016 3.036-.037.841-.555 1.596-1.224 2.08-.5.345-1.118.435-1.671.663.121.78.434 1.556 1.057 2.07 1.189 1.053 3.224.86 4.17-.426.945-1.071.453-2.573.603-3.854.286-.48.937-.132 1.317-.49-.34-1.249-.81-2.529-1.725-3.472a11.125 11.125 0 00-1.08-.04zm-10.42.006C.53 2.992-.386 5.797.154 8.361c.384 2.052 1.682 3.893 3.45 4.997.134-.23.23-.476.09-.73-.95-2.814-.138-6.119 1.986-8.19.014-.986.043-1.976-.003-2.961l-.188-.214c-1.003-.051-2.008 0-3.01-.022zm17.88.055l-.205.356c.265.938.6 1.862.72 2.834.58 3.546-.402 7.313-2.614 10.14-1.816 2.353-4.441 4.074-7.334 4.773-2.66.66-5.514.45-8.064-.543-.068.079-.207.237-.275.318 2.664 2.629 6.543 3.969 10.259 3.498 3.075-.327 5.995-1.865 8.023-4.195 1.935-2.187 3.083-5.07 3.125-7.992.122-3.384-1.207-6.819-3.636-9.19z"
    />
  </svg>
);

const SpotifyMark = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 800 800" className={className} role="img" aria-label="Spotify">
    <path
      fill="currentColor"
      d="M400,17.3C188.7,17.3,17.3,188.7,17.3,400s171.4,382.7,382.7,382.7,382.7-171.3,382.7-382.7S611.4,17.3,400,17.3ZM575.5,569.2c-6.8,11.2-21.5,14.8-32.8,8-89.8-54.9-202.9-67.3-336.1-36.8-12.9,3-25.6-5.1-28.6-18-3-12.9,5.1-25.6,17.9-28.6,145.8-33.3,270.8-19,371.7,42.7,11.2,6.9,14.8,21.5,7.9,32.8h.1ZM622.3,465c-8.7,14.1-27.1,18.5-41,9.8-102.9-63.2-259.7-81.6-381.4-44.6-15.8,4.8-32.5-4.1-37.3-19.9-4.8-15.7,4.2-32.5,19.9-37.3,139-42.2,311.7-21.7,429.8,50.8,14,8.7,18.5,27.1,9.8,41h.1ZM626.6,356.4h-.2c-123.3-73.2-326.9-79.9-444.5-44.2-18.9,5.7-38.9-4.9-44.6-23.9-5.7-18.9,4.9-38.9,23.9-44.6,135.2-41,359.9-33.1,501.9,51.1,16.9,10,22.7,32,12.6,49-10,17-32.1,22.7-49,12.6Z"
    />
  </svg>
);

const AppleMark = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 800 800" className={className} role="img" aria-label="Apple Music">
    <path
      fill="currentColor"
      d="M508.7,122.8c-26.9,30.7-69.1,57.6-111.3,53.7-7.7-46.1,15.4-92.1,38.4-119C462.7,23,508.7,0,547.1,0c3.8,42.2-11.5,88.3-38.4,122.8h0Z"
    />
    <path
      fill="currentColor"
      d="M547.1,184.2c23,0,92.1,7.7,138.2,76.8-3.8,3.8-80.6,49.9-80.6,145.8s99.8,153.5,99.8,153.5c0,3.8-15.4,53.7-49.9,107.5-30.7,46.1-65.2,92.1-115.1,92.1s-65.2-30.7-122.8-30.7-76.8,30.7-122.8,30.7-88.3-49.9-119-95.9c-65.2-95.9-115.1-268.7-46.1-383.8,30.7-57.6,92.1-95.9,153.5-95.9s95.9,34.5,122.8,34.5c26.9,0,80.6-38.4,142-34.5h0Z"
    />
  </svg>
);

const StatsFmMark = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 800 800" className={className} role="img" aria-label="stats.fm">
    <rect fill="currentColor" x="16.6" y="248.1" width="173" height="534.4" rx="56.6" ry="56.6" />
    <rect fill="currentColor" x="610.4" y="452.5" width="173" height="329.9" rx="56.6" ry="56.6" />
    <rect fill="currentColor" x="313.3" y="17.6" width="173" height="764.6" rx="56.6" ry="56.6" />
  </svg>
);

const BottomNavigation = React.memo(({ pathname }: { pathname: string }) => {
  const activeNavIndex = Math.max(0, NAV_ITEMS.findIndex(item => item.activePaths.includes(pathname)));

  return (
    <nav className="w-full pb-[calc(env(safe-area-inset-bottom)+12px)] pointer-events-auto mx-auto">
      <div className="relative rounded-[9999px]">
        <div className="glass-aura relative rounded-[9999px] overflow-hidden">
          <div className="absolute inset-x-6 top-[0.5px] h-[0.5px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          <div className="absolute inset-0 rounded-[9999px] bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

          <div className="relative grid min-h-[68px] grid-cols-4 gap-0 px-2 py-2">
            <motion.div
              className="pointer-events-none absolute bottom-2 left-2 top-2 w-[calc((100%_-_1rem)/4)] rounded-[9999px] bg-white/[0.04]"
              animate={{ x: `calc(${activeNavIndex} * 100%)` }}
              transition={{ type: "spring", bounce: 0.12, duration: 0.38 }}
            />
            {NAV_ITEMS.map((item, index) => {
              const isActive = index === activeNavIndex;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-label={item.label}
                  className="relative flex flex-col items-center justify-center gap-1 outline-none touch-manipulation select-none"
                >
                  <motion.div
                    className="relative z-10 flex flex-col items-center gap-1"
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  >
                    <div className="relative flex h-7 w-7 items-center justify-center">
                      <Icon
                        className={clsx(
                          "transition-all duration-300 ease-out",
                          isActive
                            ? "h-[25px] w-[25px] text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.35)]"
                            : "h-[24px] w-[24px] text-white/45 hover:text-white/75"
                        )}
                        strokeWidth={isActive ? 2.3 : 1.7}
                      />
                    </div>

                    <span className={clsx(
                      "text-[9px] font-bold tracking-[0.12em] transition-all duration-300 leading-none mt-0.5",
                      isActive
                        ? "text-orange-500 font-extrabold"
                        : "text-white/40 font-medium"
                    )}>
                      {item.label}
                    </span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
});

BottomNavigation.displayName = 'BottomNavigation';

const getTrackArtwork = (track: any) => {
  return [
    track?.albumImage,
    track?.album?.image,
    track?.album?.images?.[0]?.url,
    track?.album?.images?.[0],
    track?.image,
    track?.images?.[0]?.url,
    track?.images?.[0],
    track?.albumArt,
    track?.coverArt,
    track?.cover_art,
    track?.album_image,
    track?.cover,
  ].find((url) => typeof url === 'string' && url.trim().length > 5) || '';
};

const getTrackArtistName = (track: any) => {
  const prioritized = getMainArtistName(track);
  if (prioritized) return prioritized;
  const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : undefined;
  if (typeof firstArtist === 'string') return firstArtist;
  if (firstArtist?.name) return firstArtist.name;
  if (typeof track?.artist === 'string') return track.artist;
  return track?.artist?.name || track?.artistName || 'Artista';
};

const getArtistDisplayName = (artist: any) => {
  if (!artist) return '';
  if (typeof artist === 'string') return artist;
  return artist.name || artist.artistName || artist.displayName || artist.primaryArtistName || '';
};

const getArtistDisplayId = (artist: any) => {
  if (!artist || typeof artist === 'string') return '';
  return String(artist.id || artist.statsfmId || artist.spotifyId || artist.appleMusicId || artist.artistId || '');
};

const getTrackArtists = (track: any) => {
  const rawArtists = Array.isArray(track?.artists) ? track.artists : [];
  const mainArtist = getMainArtist(track);
  const mainArtistId = getArtistDisplayId(mainArtist);
  const mainArtistName = getArtistDisplayName(mainArtist).trim().toLowerCase();
  const normalized = rawArtists
    .map((artist: any, index: number) => {
      if (typeof artist === 'string') {
        return { id: '', name: artist, image: '', key: `${artist}-${index}` };
      }
      const id = String(artist?.id || artist?.statsfmId || artist?.spotifyId || artist?.appleMusicId || '');
      const name = artist?.name || artist?.artistName || artist?.displayName || '';
      const image = artist?.image || artist?.avatar || artist?.artistImage || artist?.picture || '';
      return { id, name, image, key: id || `${name}-${index}` };
    })
    .filter((artist) => artist.name);

  if (normalized.length > 0) {
    const mainIndex = normalized.findIndex((artist) => {
      if (mainArtistId && artist.id === mainArtistId) return true;
      return !!mainArtistName && artist.name.trim().toLowerCase() === mainArtistName;
    });
    if (mainIndex > 0) {
      return [normalized[mainIndex], ...normalized.filter((_, index) => index !== mainIndex)];
    }
    return normalized;
  }

  const fallbackName = getTrackArtistName(track);
  const fallbackId = getMainArtistId(track);
  return fallbackName ? [{ id: fallbackId, name: fallbackName, image: getTrackArtistImage(track), key: fallbackId || fallbackName }] : [];
};

const getTrackArtistImage = (track: any) => {
  const mainArtist = getMainArtist(track);
  const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : undefined;
  return [
    mainArtist?.image,
    mainArtist?.avatar,
    mainArtist?.artistImage,
    firstArtist?.image,
    firstArtist?.avatar,
    firstArtist?.artistImage,
    track?.artist?.image,
    track?.artist?.avatar,
    track?.artistImage,
    track?.primaryArtistImage,
  ].find((url) => typeof url === 'string' && url.trim().length > 5) || '';
};

const getMainArtistId = (track: any) => {
  const mainArtist = getMainArtist(track);
  const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : undefined;
  return String(
    getArtistDisplayId(mainArtist) ||
    firstArtist?.id ||
    firstArtist?.statsfmId ||
    firstArtist?.spotifyId ||
    firstArtist?.appleMusicId ||
    track?.artist?.id ||
    track?.artistId ||
    ''
  );
};

const getAlbumId = (track: any) => String(track?.albumId || track?.album?.id || '');

const getAlbumReleaseDate = (track: any) => {
  const firstAlbum = Array.isArray(track?.albums) ? track.albums[0] : undefined;
  return [
    track?.album?.releaseDate,
    track?.album?.releasedAt,
    track?.album?.release_date,
    track?.album?.date,
    firstAlbum?.releaseDate,
    firstAlbum?.releasedAt,
    firstAlbum?.release_date,
    firstAlbum?.date,
    track?.albumReleaseDate,
    // Último recurso para payloads antigos: a data da faixa não deve sobrepor a do álbum.
    track?.releaseDate,
    track?.releasedAt,
  ].find((value) => typeof value === 'string' && value.trim().length > 0) || '';
};

const firstExternalId = (value: any) => {
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item.trim()) || '';
  return typeof value === 'string' ? value : '';
};

const getTrackLinks = (track: any, statsAppUrl?: string) => {
  const spotifyId = track?.spotifyId || firstExternalId(track?.externalIds?.spotify);
  const appleMusicId = track?.appleMusicId || firstExternalId(track?.externalIds?.appleMusic);
  const statsId = track?.id || track?.statsfmId;
  return [
    statsId && { kind: 'statsfm' as const, label: 'stats.fm', url: `https://stats.fm/track/${statsId}`, appUrl: statsAppUrl },
    spotifyId && { kind: 'spotify' as const, label: 'Spotify', url: `https://open.spotify.com/track/${spotifyId}`, appUrl: `spotify:track:${spotifyId}` },
    appleMusicId && { kind: 'apple' as const, label: 'Apple Music', url: `https://music.apple.com/song/${appleMusicId}`, appUrl: `music://music.apple.com/song/${appleMusicId}` },
  ].filter(Boolean) as Array<{ kind: 'statsfm' | 'spotify' | 'apple' | 'genius'; label: string; url: string; appUrl?: string }>;
};

const formatShortDate = (value: any) => {
  if (!value) return 'sem registro';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'sem registro';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatFullDate = (value: any) => {
  if (!value) return 'sem registro';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'sem registro';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatAlbumReleaseDate = (value: any) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const currentYear = new Date().getFullYear();
  const options: Intl.DateTimeFormatOptions = date.getFullYear() === currentYear
    ? { day: '2-digit', month: 'short' }
    : { day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('pt-BR', options).replace('.', '.');
};

const cleanLyricsForDisplay = (lyrics?: string | null) => {
  if (!lyrics) return '';

  const sectionPattern =
    /^(?:intro|outro|verse|chorus|hook|bridge|pre[-\s]?chorus|post[-\s]?chorus|refrain|interlude|instrumental|solo|spoken|skit|part|section|refr[aã]o|verso|ponte|coro)(?:\s+\d+)?(?:\s*:.*)?$/i;
  const isSectionMarker = (line: string) => {
    if (!line) return false;
    const bracketMatch = line.match(/^\[([^\]]+)\]$/);
    const label = (bracketMatch?.[1] || line).trim();
    return sectionPattern.test(label);
  };

  const lines = lyrics
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n');
  const output: string[] = [];
  let hasStarted = false;
  let previousBlank = false;
  let pendingSectionBreak = false;

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/\u200b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const isBracketLine = isSectionMarker(line);

    if (isBracketLine) {
      if (hasStarted) pendingSectionBreak = true;
      continue;
    }

    if (!line) {
      if (hasStarted && !previousBlank) {
        output.push('');
        previousBlank = true;
      }
      continue;
    }

    if (pendingSectionBreak && hasStarted && !previousBlank) {
      output.push('');
      previousBlank = true;
    }
    hasStarted = true;
    previousBlank = false;
    pendingSectionBreak = false;
    output.push(line);
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const getDayKey = (value: any) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const getStreamTime = (item: any) => {
  const value = item?.playedAt || item?.timestamp || item?.endTime || item?.date || item?.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const summarizeTrackHistory = (items: any[], currentTimestamp?: string) => {
  const currentTime = currentTimestamp ? new Date(currentTimestamp).getTime() : 0;
  const history = items
    .filter((item) => {
      const time = getStreamTime(item);
      if (!time) return false;
      if (!currentTime) return true;
      return Math.abs(time - currentTime) > 90_000;
    })
    .sort((a, b) => getStreamTime(a) - getStreamTime(b));
  const years = history.reduce<Record<string, number>>((acc, item) => {
    const year = new Date(getStreamTime(item)).getFullYear();
    if (Number.isFinite(year)) acc[String(year)] = (acc[String(year)] || 0) + 1;
    return acc;
  }, {});
  const bestYear = Object.entries(years).sort((a, b) => b[1] - a[1])[0];
  return {
    firstPlayedAt: history[0] ? getStreamTime(history[0]) : 0,
    lastPlayedAt: history[history.length - 1] ? getStreamTime(history[history.length - 1]) : 0,
    bestYear: bestYear ? bestYear[0] : '',
    bestYearCount: bestYear ? bestYear[1] : 0,
  };
};

const getEarliestStream = (items: any[]) => {
  return items
    .map((item) => getStreamTime(item))
    .filter((time) => time > 0)
    .sort((a, b) => a - b)[0] || 0;
};

const getRecentPlaybackTrack = (user: any) => {
  const recent = Array.isArray(user?.recent)
    ? user.recent
    : Array.isArray(user?.history)
      ? user.history
      : [];
  const latest = recent[0];
  const track = latest?.track || latest;
  if (!track?.name) return null;
  return {
    track,
    isNow: false,
    timestamp: latest?.playedAt || latest?.timestamp || latest?.endTime || latest?.date || user?.nowPlaying?.timestamp,
    platform: latest?.platform || latest?.source || user?.nowPlaying?.platform,
    durationMs: latest?.durationMs || track?.durationMs,
  };
};

const getUserTrackStatsSource = (user: any) => {
  if (!user) return null;
  if (user.nowPlaying?.track?.name) return user;
  const recentPlayback = getRecentPlaybackTrack(user);
  if (!recentPlayback) return user;
  return {
    ...user,
    nowPlaying: recentPlayback,
  };
};

const getPlaybackHistoryEntries = (user: any) => {
  const source = Array.isArray(user?.recent)
    ? user.recent
    : Array.isArray(user?.history)
      ? user.history
      : [];
  return source
    .map((item: any) => {
      const track = item?.track || item;
      if (!track?.name) return null;
      return {
        track,
        timestamp: item?.playedAt || item?.timestamp || item?.endTime || item?.date || item?.createdAt,
        platform: item?.platform || item?.source || user?.nowPlaying?.platform,
        durationMs: item?.durationMs || track?.durationMs,
      };
    })
    .filter(Boolean) as Array<{ track: any; timestamp?: any; platform?: any; durationMs?: any }>;
};

type TrackLink = ReturnType<typeof getTrackLinks>[number];

type BottomTrackStatsPanelData = {
  entityStats: { artist: number; track: number; album: number };
  artistStats: Array<{ id: string; name: string; image: string; key: string; count: number }>;
  circleFirstListen: { user: any; playedAt: number } | null;
  circleFirstListeners: Array<{ user: any; playedAt: number }>;
  hasFriendHistory: boolean;
  trackHistory: { firstPlayedAt: number; lastPlayedAt: number; bestYear: string; bestYearCount: number };
};

type BottomTrackStatsHydrationState = {
  metrics: boolean;
  artistStats: boolean;
  history: boolean;
  social: boolean;
};

type BottomTrackStatsPanelSnapshot = {
  data: BottomTrackStatsPanelData;
  hydration: BottomTrackStatsHydrationState;
};

const emptyBottomTrackStatsPanelData: BottomTrackStatsPanelData = {
  entityStats: { artist: 0, track: 0, album: 0 },
  artistStats: [],
  circleFirstListen: null,
  circleFirstListeners: [],
  hasFriendHistory: false,
  trackHistory: { firstPlayedAt: 0, lastPlayedAt: 0, bestYear: '', bestYearCount: 0 },
};

const emptyBottomTrackStatsHydration: BottomTrackStatsHydrationState = {
  metrics: false,
  artistStats: false,
  history: false,
  social: false,
};

const createInitialBottomTrackStatsPanelData = (knownTrackCount?: number): BottomTrackStatsPanelData => ({
  ...emptyBottomTrackStatsPanelData,
  entityStats: {
    artist: 0,
    track: typeof knownTrackCount === 'number' ? knownTrackCount : 0,
    album: 0,
  },
});

const BOTTOM_TRACK_STATS_CACHE_TTL = 15 * 60 * 1000;
const bottomTrackStatsCache = new Map<string, { expiresAt: number; data: BottomTrackStatsPanelSnapshot }>();
const bottomTrackStatsInFlight = new Map<string, Promise<BottomTrackStatsPanelSnapshot>>();
const bottomTrackStatsFastInFlight = new Map<string, Promise<BottomTrackStatsPanelSnapshot>>();
const lyricsMatchCache = new Map<string, { expiresAt: number; data: LyricsMatch }>();
const lyricsFullCache = new Map<string, { expiresAt: number; data: LyricsFullResponse }>();
const lyricsInFlight = new Map<string, Promise<LyricsMatch | LyricsFullResponse>>();

const getLyricsCacheKey = (trackName: string, artistName: string) => `${trackName.trim().toLowerCase()}::${artistName.trim().toLowerCase()}`;

const readExpiringCache = <T,>(cache: Map<string, { expiresAt: number; data: T }>, key: string) => {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.data;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  if (typeof window === 'undefined') return promise.catch(() => fallback);
  let timeoutId = 0;
  try {
    return await Promise.race([
      promise.catch(() => fallback),
      new Promise<T>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const runLimited = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
};

const loadLyricsMatch = (trackName: string, artistName: string) => {
  const key = getLyricsCacheKey(trackName, artistName);
  const cached = readExpiringCache(lyricsMatchCache, key);
  if (cached) return Promise.resolve(cached);

  const inFlightKey = `match:${key}`;
  const running = lyricsInFlight.get(inFlightKey);
  if (running) return running as Promise<LyricsMatch>;

  const promise = statsService.fetchLyricsMatch(trackName, artistName)
    .then((match) => {
      lyricsMatchCache.set(key, { data: match, expiresAt: Date.now() + BOTTOM_TRACK_STATS_CACHE_TTL });
      return match;
    })
    .finally(() => lyricsInFlight.delete(inFlightKey));
  lyricsInFlight.set(inFlightKey, promise);
  return promise;
};

const loadLyricsFull = (trackName: string, artistName: string) => {
  const key = getLyricsCacheKey(trackName, artistName);
  const cached = readExpiringCache(lyricsFullCache, key);
  if (cached) return Promise.resolve(cached);

  const inFlightKey = `full:${key}`;
  const running = lyricsInFlight.get(inFlightKey);
  if (running) return running as Promise<LyricsFullResponse>;

  const promise = statsService.fetchLyricsFull(trackName, artistName)
    .then((response) => {
      lyricsFullCache.set(key, { data: response, expiresAt: Date.now() + BOTTOM_TRACK_STATS_CACHE_TTL });
      lyricsMatchCache.set(key, { data: response, expiresAt: Date.now() + BOTTOM_TRACK_STATS_CACHE_TTL });
      return response;
    })
    .finally(() => lyricsInFlight.delete(inFlightKey));
  lyricsInFlight.set(inFlightKey, promise);
  return promise;
};

const getBottomTrackStatsCacheKey = (
  userId: string,
  trackId: string,
  albumId: string,
  artistIds: string,
  memberIds: string,
) => `${userId}:${trackId}:${albumId}:${artistIds}:${memberIds}`;

const getBottomTrackStatsLookupKey = (
  user: any,
  trackId: string,
  albumId: string,
  trackArtists: Array<{ id: string }>,
  members: any[],
) => getBottomTrackStatsCacheKey(
  user?.id || '',
  trackId,
  albumId,
  trackArtists.map((artist) => artist.id).filter(Boolean).sort().join('|'),
  members.map((member) => member.id).filter(Boolean).sort().join('|'),
);

const loadBottomTrackStatsPanelData = async ({
  user,
  trackId,
  albumId,
  trackArtists,
  members,
  currentTimestamp,
  knownTrackCount,
  mode = 'full',
}: {
  user: any;
  trackId: string;
  albumId: string;
  trackArtists: Array<{ id: string; name: string; image: string; key: string }>;
  members: any[];
  currentTimestamp?: any;
  knownTrackCount?: number;
  mode?: 'fast' | 'full';
}): Promise<BottomTrackStatsPanelSnapshot> => {
  const cacheKey = getBottomTrackStatsLookupKey(user, trackId, albumId, trackArtists, members);
  const cached = readExpiringCache(bottomTrackStatsCache, cacheKey);
  if (cached && mode === 'full') return cached;

  const inFlightMap = mode === 'fast' ? bottomTrackStatsFastInFlight : bottomTrackStatsInFlight;
  const running = inFlightMap.get(cacheKey);
  if (running) return running;

  const promise = (async () => {
    const artistsToFetch = trackArtists.filter((artist) => artist.id);
    const [artistCounts, trackCount, album, history] = await Promise.all([
      Promise.all(artistsToFetch.map((artist) =>
        withTimeout(statsService.fetchEntityStats(user.id, 'artist', artist.id), mode === 'fast' ? 1200 : 2200, 0)
      )),
      typeof knownTrackCount === 'number'
        ? Promise.resolve(knownTrackCount)
        : withTimeout(statsService.fetchEntityStats(user.id, 'track', trackId), mode === 'fast' ? 1200 : 2200, 0),
      albumId ? withTimeout(statsService.fetchEntityStats(user.id, 'album', albumId), mode === 'fast' ? 1200 : 2200, 0) : Promise.resolve(0),
      withTimeout(statsService.fetchEntityStreams(user.id, 'track', trackId, 240), mode === 'fast' ? 1400 : 2800, []),
    ]);
    const memberHistories = mode === 'fast'
      ? []
      : await runLimited(
        members.filter((member) => member.id !== user.id),
        3,
        (member) =>
        withTimeout(
          statsService.fetchEntityStreams(member.id, 'track', trackId, 80)
            .then((items) => ({ member, items })),
          1800,
          { member, items: [] }
        )
      );
    const nextArtistStats = artistsToFetch.map((artist, index) => ({
      ...artist,
      count: artistCounts[index] || 0,
    }));
    const primaryArtistCount = nextArtistStats[0]?.count || 0;
    const ownEntry = { member: user, playedAt: getEarliestStream(history), hasItems: history.length > 0 };
    const friendEntries = [
      ownEntry,
      ...memberHistories.map(({ member, items }) => {
        return { member, playedAt: getEarliestStream(items), hasItems: items.length > 0 };
      }),
    ]
      .filter((entry) => entry.playedAt > 0)
      .sort((a, b) => a.playedAt - b.playedAt);
    const friendsWithHistory = friendEntries.filter((entry) => entry.member.id !== user.id);
    const firstEntry = friendEntries[0];
    const firstDayEntries = firstEntry
      ? friendEntries.filter((entry) => getDayKey(entry.playedAt) === getDayKey(firstEntry.playedAt))
      : [];

    const data: BottomTrackStatsPanelData = {
      artistStats: nextArtistStats,
      entityStats: { artist: primaryArtistCount, track: trackCount, album },
      trackHistory: summarizeTrackHistory(history, currentTimestamp || user?.nowPlaying?.timestamp),
      circleFirstListen: friendsWithHistory.length > 0 && firstEntry
        ? { user: firstEntry.member, playedAt: firstEntry.playedAt }
        : null,
      circleFirstListeners: friendsWithHistory.length > 0
        ? firstDayEntries.map((entry) => ({ user: entry.member, playedAt: entry.playedAt }))
        : [],
      hasFriendHistory: friendsWithHistory.length > 0,
    };
    const snapshot: BottomTrackStatsPanelSnapshot = {
      data,
      hydration: {
        metrics: true,
        artistStats: true,
        history: true,
        social: mode === 'full',
      },
    };
    if (mode === 'full') {
      bottomTrackStatsCache.set(cacheKey, { data: snapshot, expiresAt: Date.now() + BOTTOM_TRACK_STATS_CACHE_TTL });
    }
    return snapshot;
  })().finally(() => inFlightMap.delete(cacheKey));

  inFlightMap.set(cacheKey, promise);
  return promise;
};

const ArtistNamesInline = ({ artists, fallback }: { artists: Array<{ name: string }>; fallback: string }) => {
  const names = artists.map((artist) => artist.name).filter(Boolean);
  const displayNames = names.length > 0 ? names : [fallback].filter(Boolean);

  return (
    <>
      {displayNames.map((name, index) => {
        const isLast = index === displayNames.length - 1;
        const separator = index === 0
          ? ''
          : isLast
            ? ' & '
            : ', ';

        return (
          <React.Fragment key={`${name}-${index}`}>
            {separator && <span className="text-orange-300/72">{separator}</span>}
            <span>{name}</span>
          </React.Fragment>
        );
      })}
    </>
  );
};

const TrackTitleBadges = ({ badges, className }: { badges: string[]; className?: string }) => {
  if (badges.length === 0) return null;
  return (
    <div className={clsx("flex max-w-[128px] shrink-0 flex-col items-start justify-start gap-px", className)}>
      {badges.map((badge, index) => (
        <span
          key={badge}
          className="rounded-full px-1.5 py-[3px] text-left text-[6px] font-black uppercase leading-none tracking-[0.11em] text-white/72 backdrop-blur-md"
          style={{ backgroundColor: index === 0 ? 'rgba(255,255,255,0.062)' : 'rgba(255,255,255,0.036)' }}
        >
          {badge}
        </span>
      ))}
    </div>
  );
};

const ModalScrollingTrackTitle = ({ title, wide = false }: { title: string; wide?: boolean }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const measureRef = React.useRef<HTMLSpanElement | null>(null);
  const [scrollDistance, setScrollDistance] = React.useState(0);
  const shouldScroll = scrollDistance > 0;

  React.useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const text = measureRef.current;
      if (!container || !text) return;
      const overflow = text.scrollWidth - container.clientWidth;
      setScrollDistance(overflow > 2 ? text.scrollWidth + 32 : 0);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [title]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative block min-w-0 shrink overflow-hidden text-left",
        wide ? "max-w-[250px]" : "max-w-[170px]",
        shouldScroll && "[mask-image:linear-gradient(90deg,black_0%,black_78%,transparent_100%)]"
      )}
      title={title}
    >
      {shouldScroll ? (
        <span
          className="stats-lc-track-marquee flex w-max whitespace-nowrap text-[22px] font-black leading-[1.02] text-white"
          style={{
            '--track-title-distance': `${scrollDistance}px`,
            '--track-title-duration': `${Math.min(18, Math.max(8, title.length * 0.34))}s`,
          } as React.CSSProperties}
        >
          <span className="pr-8">{title}</span>
          <span className="pr-8" aria-hidden="true">{title}</span>
        </span>
      ) : (
        <span className="block whitespace-nowrap text-[22px] font-black leading-[1.02] text-white">{title}</span>
      )}
      <span
        ref={measureRef}
        className="pointer-events-none absolute -z-10 whitespace-nowrap text-[22px] font-black leading-[1.02] opacity-0"
        aria-hidden="true"
      >
        {title}
      </span>
    </div>
  );
};

const TrackLinkIconButton = ({ link, onChoose }: { link: TrackLink; onChoose: (link: TrackLink, button: HTMLButtonElement) => void }) => {
  const icon = link.kind === 'statsfm'
    ? <StatsFmMark className="h-4 w-4 text-current" />
    : link.kind === 'spotify'
      ? <SpotifyMark className="h-4 w-4 text-current" />
      : link.kind === 'apple'
        ? <AppleMark className="h-4 w-4 text-current" />
        : <GeniusLogo className="h-4 w-4 text-current" />;

  return (
    <button
      type="button"
      onClick={(event) => onChoose(link, event.currentTarget)}
      aria-label={`Opções do ${link.label}`}
      className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-white/[0.045] text-white/72 transition-transform active:scale-95"
    >
      {icon}
    </button>
  );
};

const ModalMetricValue = ({
  fallbackValue,
  ready,
  value,
}: {
  fallbackValue?: number;
  ready: boolean;
  value: number;
}) => {
  const displayValue = ready ? value : fallbackValue;
  if (typeof displayValue === 'number') return <AnimatedNumber value={displayValue} />;
  return <span className="stats-lc-skeleton-shimmer block h-5 w-12 rounded-full" />;
};

const ModalSkeleton = ({ className = "" }: { className?: string }) => (
  <span className={clsx("stats-lc-skeleton-shimmer block rounded-full", className)} />
);

const BottomTrackStatsBubble = React.memo(({ user }: { user: any }) => {
  const groupStats = useStatsStore(state => state.groupStats);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const userTrackStats = useStatsStore(state => state.userTrackStats);
  const fetchTrackStatsForAll = useStatsStore(state => state.fetchTrackStatsForAll);
  const [isOpen, setIsOpen] = React.useState(false);
  const [lyricsMatch, setLyricsMatch] = React.useState<LyricsMatch | null>(null);
  const [lyricsText, setLyricsText] = React.useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = React.useState(false);
  const [panel, setPanel] = React.useState<'stats' | 'lyrics'>('stats');
  const [selectedTrackLink, setSelectedTrackLink] = React.useState<TrackLink | null>(null);
  const [trackLinkSheetAnchor, setTrackLinkSheetAnchor] = React.useState({ right: 16, bottom: 16 });
  const [toastMessage, setToastMessage] = React.useState('');
  const [panelData, setPanelData] = React.useState<BottomTrackStatsPanelData>(emptyBottomTrackStatsPanelData);
  const [panelHydration, setPanelHydration] = React.useState<BottomTrackStatsHydrationState>(emptyBottomTrackStatsHydration);
  const [playbackIndex, setPlaybackIndex] = React.useState(0);
  const modalPointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const ignoreBackdropClickUntilRef = React.useRef(0);
  const panelDataKeyRef = React.useRef('');
  const panelRequestKeyRef = React.useRef('');
  const lyricsRequestKeyRef = React.useRef('');

  const playbackHistory = React.useMemo(() => getPlaybackHistoryEntries(user), [user]);
  const liveTrack = user?.nowPlaying?.track;
  const activePlayback = React.useMemo(() => {
    if (playbackIndex <= 0 || playbackHistory.length === 0) {
      return {
        track: liveTrack,
        timestamp: user?.nowPlaying?.timestamp,
        platform: user?.nowPlaying?.platform,
        durationMs: user?.nowPlaying?.durationMs || liveTrack?.durationMs,
      };
    }
    return playbackHistory[Math.min(playbackIndex - 1, playbackHistory.length - 1)] || null;
  }, [liveTrack, playbackHistory, playbackIndex, user?.nowPlaying?.durationMs, user?.nowPlaying?.platform, user?.nowPlaying?.timestamp]);
  const track = activePlayback?.track;
  const trackId = String(track?.id || track?.track?.id || '');
  const artistId = getMainArtistId(track);
  const albumId = getAlbumId(track);
  const trackTitle = track?.name || 'Música';
  const parsedTrackTitle = React.useMemo(() => parseTrackTitleBadges(trackTitle), [trackTitle]);
  const artistName = getTrackArtistName(track);
  const trackArtists = React.useMemo(() => getTrackArtists(track), [track]);
  const artwork = getTrackArtwork(track);
  const artistImage = trackArtists[0]?.image || getTrackArtistImage(track) || artwork;
  const albumName = track?.albumName || track?.album?.name || 'Álbum';
  const dominantColor = user?.nowPlaying?.dominantColor || track?.dominantColor || '#ff5f00';
  const albumReleaseDate = React.useMemo(() => formatAlbumReleaseDate(getAlbumReleaseDate(track)), [track]);
  const isAppleMusicUser = user?.platform?.primary === 'appleMusic' || user?.platform === 'appleMusic' || user?.nowPlaying?.platform === 'appleMusic';
  const statsAppUrl = isAppleMusicUser && trackId ? `statsam://track/${trackId}` : undefined;
  const trackLinks = React.useMemo(() => getTrackLinks(track, statsAppUrl), [track, statsAppUrl]);
  const chooseTrackLink = React.useCallback((link: TrackLink, button: HTMLButtonElement) => {
    const modal = button.closest('.bottom-track-stats-modal');
    if (modal) {
      const modalRect = modal.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      setTrackLinkSheetAnchor({
        right: modalRect.right - buttonRect.left,
        bottom: modalRect.bottom - buttonRect.top + 4,
      });
    }
    setSelectedTrackLink(link);
  }, []);
  const members = React.useMemo(() => getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId), [groupStats, liveNowPlayingByUserId]);
  const membersSignature = React.useMemo(() => members.map((member) => member.id).filter(Boolean).sort().join('|'), [members]);
  const trackArtistsSignature = React.useMemo(() => trackArtists.map((artist) => artist.id || artist.name).filter(Boolean).sort().join('|'), [trackArtists]);
  const panelCacheKey = React.useMemo(
    () => getBottomTrackStatsLookupKey(user, trackId, albumId, trackArtists, members),
    [albumId, membersSignature, trackArtistsSignature, trackId, user?.id]
  );
  const knownUserTrackCount = userTrackStats[`${user?.id}:${trackId}`];
  const hasHydratedTrackRanking = React.useMemo(() => {
    if (!trackId || members.length === 0) return false;
    return members.every((member) => Object.prototype.hasOwnProperty.call(userTrackStats, `${member.id}:${trackId}`));
  }, [members, trackId, userTrackStats]);
  const { entityStats, artistStats, circleFirstListen, circleFirstListeners, hasFriendHistory, trackHistory } = panelData;
  const writerNames = React.useMemo(() => {
    return (lyricsMatch?.writers || [])
      .map((writer) => writer.trim())
      .filter(Boolean)
      .join(', ');
  }, [lyricsMatch?.writers]);
  const cleanedLyricsText = React.useMemo(() => cleanLyricsForDisplay(lyricsText), [lyricsText]);
  const isPanelFullyReady = panelHydration.metrics && panelHydration.artistStats && panelHydration.history && panelHydration.social;

  React.useEffect(() => {
    setPlaybackIndex(0);
  }, [liveTrack?.id, liveTrack?.name, user?.id]);

  React.useEffect(() => {
    lyricsRequestKeyRef.current = `${trackId}:${activePlayback?.timestamp || ''}`;
  }, [activePlayback?.timestamp, trackId]);

  React.useEffect(() => {
    if (!track?.name || !isOpen) {
      setLyricsMatch(null);
      setLyricsText(null);
      setLyricsLoading(false);
      return;
    }

    const cachedFullLyrics = readExpiringCache(lyricsFullCache, getLyricsCacheKey(track.name, artistName));
    let cancelled = false;
    const requestKey = `${trackId}:${activePlayback?.timestamp || ''}`;
    lyricsRequestKeyRef.current = requestKey;
    setLyricsText(cachedFullLyrics?.lyrics || null);
    if (cachedFullLyrics) {
      setLyricsMatch(cachedFullLyrics);
      setLyricsLoading(false);
      return;
    }

    const idleId = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        loadLyricsMatch(track.name, artistName)
          .then((match) => {
            if (cancelled || lyricsRequestKeyRef.current !== requestKey) return;
            setLyricsMatch(match);
          })
          .catch(() => undefined);
      });
    }, 420);
    return () => {
      cancelled = true;
      window.clearTimeout(idleId);
    };
  }, [activePlayback?.timestamp, artistName, isOpen, track?.name, trackId]);

  React.useEffect(() => {
    if (!isOpen || !trackId || !members.length || hasHydratedTrackRanking) return;
    const timer = window.setTimeout(() => {
      fetchTrackStatsForAll(trackId).catch(() => undefined);
    }, 360);
    return () => window.clearTimeout(timer);
  }, [fetchTrackStatsForAll, hasHydratedTrackRanking, isOpen, members.length, trackId]);

  React.useEffect(() => {
    if (!user?.id || !trackId) {
      setPanelData(emptyBottomTrackStatsPanelData);
      setPanelHydration(emptyBottomTrackStatsHydration);
      return;
    }

    if (isOpen && isPanelFullyReady && panelDataKeyRef.current === panelCacheKey) {
      return;
    }

    const cached = readExpiringCache(bottomTrackStatsCache, panelCacheKey);
    if (cached) {
      setPanelData(cached.data);
      setPanelHydration(cached.hydration);
      panelDataKeyRef.current = panelCacheKey;
      return;
    } else if (!isOpen) {
      setPanelData(createInitialBottomTrackStatsPanelData(knownUserTrackCount));
      setPanelHydration(emptyBottomTrackStatsHydration);
      return;
    }

    if (!isOpen) return;

    let cancelled = false;
    const requestKey = `${panelCacheKey}:${activePlayback?.timestamp || ''}`;
    panelRequestKeyRef.current = requestKey;
    setPanelData(createInitialBottomTrackStatsPanelData(knownUserTrackCount));
    setPanelHydration(emptyBottomTrackStatsHydration);
    const fastTimer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        loadBottomTrackStatsPanelData({
          user,
          trackId,
          albumId,
          trackArtists,
          members,
          currentTimestamp: activePlayback?.timestamp,
          knownTrackCount: knownUserTrackCount,
          mode: 'fast',
        }).then((snapshot) => {
          if (cancelled || panelRequestKeyRef.current !== requestKey) return;
          setPanelData(snapshot.data);
          setPanelHydration(snapshot.hydration);
        }).catch(() => undefined);
      });
    }, 40);

    const fullTimer = window.setTimeout(() => {
      loadBottomTrackStatsPanelData({
        user,
        trackId,
        albumId,
        trackArtists,
        members,
        currentTimestamp: activePlayback?.timestamp,
        knownTrackCount: knownUserTrackCount,
        mode: 'full',
      }).then((snapshot) => {
        if (cancelled || panelRequestKeyRef.current !== requestKey) return;
        setPanelData(snapshot.data);
        setPanelHydration(snapshot.hydration);
        panelDataKeyRef.current = panelCacheKey;
      });
    }, 420);

    return () => {
      cancelled = true;
      window.clearTimeout(fastTimer);
      window.clearTimeout(fullTimer);
    };
  }, [activePlayback?.timestamp, albumId, isOpen, isPanelFullyReady, knownUserTrackCount, membersSignature, panelCacheKey, trackArtistsSignature, trackId, user?.id]);

  const ranking = React.useMemo(() => {
    if (!trackId) return [];
    return members
      .map(member => ({
        user: member,
        count: userTrackStats[`${member.id}:${trackId}`] || 0,
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [members, trackId, userTrackStats]);
  const hasPreviousTrackHistory = panelHydration.history && !!trackHistory.firstPlayedAt;
  const visibleSocialRanking = hasHydratedTrackRanking ? ranking : [];
  const circleFirstName = circleFirstListen?.user?.name?.split(/\s+/)[0]?.toLowerCase() || '';
  const firstDayGroup = circleFirstListeners.length > 0
    ? circleFirstListeners
    : circleFirstListen
      ? [circleFirstListen]
      : [];
  const hasFirstDayGroup = firstDayGroup.length > 1;
  const socialInsight = circleFirstListen
    ? hasFirstDayGroup
      ? `Vocês foram os primeiros do círculo a ouvirem essa faixa em ${formatFullDate(circleFirstListen.playedAt)}.`
      : circleFirstListen.user.id === user.id
      ? `Você foi o primeiro do círculo a ouvir essa faixa em ${formatFullDate(circleFirstListen.playedAt)}.`
      : `${circleFirstName.charAt(0).toUpperCase()}${circleFirstName.slice(1)} foi o primeiro do círculo a ouvir essa faixa em ${formatFullDate(circleFirstListen.playedAt)}.`
    : hasFriendHistory
      ? 'O círculo já ouviu, mas sem data confiável.'
      : 'Só você ouviu essa faixa por enquanto.';
  const trackMetricReady = panelHydration.metrics || typeof knownUserTrackCount === 'number';
  const socialAvatarEntries = firstDayGroup.length > 0 ? firstDayGroup : [{ user, playedAt: 0 }];
  const artistStatSkeletons = (trackArtists.length > 0
    ? trackArtists
    : [{ id: 'artist-skeleton', name: artistName || 'Artista', image: artistImage || '', key: 'artist-skeleton' }]
  ).slice(0, Math.max(2, Math.min(trackArtists.length || 2, 3)));

  const showToast = React.useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 1800);
  }, []);

  const handleOpenStats = React.useCallback(() => {
    ignoreBackdropClickUntilRef.current = window.performance.now() + 260;
    const cached = readExpiringCache(bottomTrackStatsCache, panelCacheKey);
    if (cached) {
      setPanelData(cached.data);
      setPanelHydration(cached.hydration);
      panelDataKeyRef.current = panelCacheKey;
    } else {
      setPanelData(createInitialBottomTrackStatsPanelData(knownUserTrackCount));
      setPanelHydration(emptyBottomTrackStatsHydration);
    }
    setPanel('stats');
    setIsOpen(true);
  }, [knownUserTrackCount, panelCacheKey]);

  const copyTrackLink = async (url: string) => {
    try {
      await navigator.clipboard?.writeText(url);
      showToast('Link copiado para a área de transferência.');
    } catch {}
    setSelectedTrackLink(null);
  };

  const shareTrackLink = async (link: TrackLink) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${trackTitle} - ${artistName}`,
          text: `${trackTitle} - ${artistName}`,
          url: link.url,
        });
      } else {
        await navigator.clipboard?.writeText(link.url);
        showToast('Link copiado para a área de transferência.');
      }
    } catch {}
    setSelectedTrackLink(null);
  };

  const handleLyrics = React.useCallback(async () => {
    if (!track?.name) return;
    setPanel('lyrics');
    const requestKey = `${trackId}:${activePlayback?.timestamp || ''}`;
    lyricsRequestKeyRef.current = requestKey;
    const cachedFullLyrics = readExpiringCache(lyricsFullCache, getLyricsCacheKey(track.name, artistName));
    if (cachedFullLyrics) {
      setLyricsMatch(cachedFullLyrics);
      setLyricsText(cachedFullLyrics.lyrics || '');
      setLyricsLoading(false);
      return;
    }

    setLyricsLoading(true);
    try {
      const response = await loadLyricsFull(track.name, artistName);
      if (lyricsRequestKeyRef.current !== requestKey) return;
      setLyricsMatch(response);
      if (response.lyrics) {
        setLyricsText(response.lyrics);
      }
      return;
    } finally {
      if (lyricsRequestKeyRef.current === requestKey) setLyricsLoading(false);
    }
  }, [activePlayback?.timestamp, artistName, track?.name, trackId]);

  const copyLyrics = React.useCallback(async () => {
    if (!track?.name) return;
    const requestKey = `${trackId}:${activePlayback?.timestamp || ''}`;
    lyricsRequestKeyRef.current = requestKey;
    setLyricsLoading(true);
    try {
      const response = await loadLyricsFull(track.name, artistName);
      if (lyricsRequestKeyRef.current !== requestKey) return;
      setLyricsMatch(response);
      const cleaned = cleanLyricsForDisplay(response.lyrics);
      if (!cleaned) {
        showToast('Letra indisponível.');
        return;
      }
      setLyricsText(response.lyrics || '');
      try {
        await navigator.clipboard?.writeText(cleaned);
        showToast('Letra copiada para a área de transferência.');
      } catch {}
      setSelectedTrackLink(null);
    } finally {
      if (lyricsRequestKeyRef.current === requestKey) setLyricsLoading(false);
    }
  }, [activePlayback?.timestamp, artistName, showToast, track?.name, trackId]);

  React.useEffect(() => {
    const openTrackStats = (event: Event) => {
      const detail = (event as CustomEvent<{ panel?: 'stats' | 'lyrics' }>).detail;
      if (detail?.panel === 'lyrics') {
        handleOpenStats();
        handleLyrics();
      } else {
        handleOpenStats();
      }
    };
    window.addEventListener('stats-lc-open-track-stats', openTrackStats);
    return () => window.removeEventListener('stats-lc-open-track-stats', openTrackStats);
  }, [handleLyrics, handleOpenStats]);

  React.useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const previousBodyStyles = {
      left: body.style.left,
      overflow: body.style.overflow,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
      width: body.style.width,
    };
    const previousRootStyles = {
      overflow: documentElement.style.overflow,
      overscrollBehavior: documentElement.style.overscrollBehavior,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';

    return () => {
      Object.assign(body.style, previousBodyStyles);
      Object.assign(documentElement.style, previousRootStyles);
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!track && !user) return null;

  return (
    <>
      <motion.button
        type="button"
        onPointerDown={handleOpenStats}
        onClick={handleOpenStats}
        className="pointer-events-auto relative mb-[calc(env(safe-area-inset-bottom)+12px)] flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-black/[0.22] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
        whileTap={{ scale: 0.94 }}
        aria-label="Abrir stats da música"
      >
        <span className="pointer-events-none absolute inset-x-3 top-[0.5px] h-[0.5px] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {artistImage ? (
          <SmartImage src={artistImage} className="h-full w-full object-cover" rounded="full" fallback="" />
        ) : (
          <Music2 className="h-8 w-8 text-white/72" />
        )}
      </motion.button>

      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed left-0 right-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+112px)] z-[999] flex pointer-events-auto items-end justify-center px-4 pb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 pointer-events-auto touch-none cursor-default bg-black/[0.06] backdrop-blur-[1.5px]"
              aria-label="Fechar stats da música"
              onClick={() => {
                if (window.performance.now() < ignoreBackdropClickUntilRef.current) return;
                setIsOpen(false);
                setPanel('stats');
                setSelectedTrackLink(null);
              }}
            />
            <motion.section
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.y < -58) {
                  if (lyricsText) {
                    setPanel('lyrics');
                  } else {
                    handleLyrics();
                  }
                } else if (info.offset.y > 58) {
                  setPanel('stats');
                }
              }}
              onPointerDown={(event) => {
                if (selectedTrackLink) return;
                modalPointerStartRef.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerUp={(event) => {
                const start = modalPointerStartRef.current;
                modalPointerStartRef.current = null;
                if (!start || selectedTrackLink) return;
                const deltaX = event.clientX - start.x;
                const deltaY = event.clientY - start.y;
                if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.1) return;
                if (deltaX > 0 && playbackIndex < playbackHistory.length) {
                  setPlaybackIndex((index) => Math.min(index + 1, playbackHistory.length));
                  setPanel('stats');
                } else if (deltaX < 0 && playbackIndex > 0) {
                  setPlaybackIndex((index) => Math.max(index - 1, 0));
                  setPanel('stats');
                }
              }}
              onPointerCancel={() => {
                modalPointerStartRef.current = null;
              }}
              onClick={(event) => event.stopPropagation()}
              className="bottom-track-stats-modal glass-aura pointer-events-auto relative w-full max-w-[430px] overflow-hidden rounded-[34px] border-0 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65)] touch-pan-y [contain:layout_paint]"
              style={{ willChange: 'transform, opacity' }}
            >
              <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-white/22" aria-hidden="true" />

              <div className="flex items-center gap-4 pt-2">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[20px] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {artwork ? (
                    <SmartImage src={artwork} className="h-full w-full object-cover" rounded="none" fallback="" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music2 className="h-9 w-9 text-white/36" />
                    </div>
                  )}
                  {panel === 'lyrics' && (
                    <img
                      src="/genius_colored.svg"
                      alt=""
                      className="absolute bottom-1.5 right-1.5 h-6 w-6 object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.34)]"
                    />
                  )}
                </div>
                <div className="min-w-0 pt-1">
                  <span className="block text-[8px] font-black uppercase tracking-[0.24em] text-orange-400">
                    {panel === 'lyrics' ? 'Letra' : playbackIndex > 0 ? `Histórico - ${playbackIndex}` : 'Stats da música'}
                  </span>
                  <div className="mt-1 flex items-start gap-1.5">
                    <ModalScrollingTrackTitle title={parsedTrackTitle.displayTitle || trackTitle} wide={parsedTrackTitle.badges.length <= 1} />
                    {parsedTrackTitle.badges.length > 1 && <TrackTitleBadges badges={parsedTrackTitle.badges} />}
                  </div>
                  {parsedTrackTitle.badges.length === 1 && <TrackTitleBadges badges={parsedTrackTitle.badges} className="mt-1" />}
                  <p className="mt-1 text-sm font-semibold leading-tight text-white/48">
                    <ArtistNamesInline artists={trackArtists} fallback={artistName} />
                  </p>
                  <p className="mt-1 line-clamp-1 text-[10px] font-black uppercase leading-tight tracking-[0.05em] text-white/28">
                    {albumName}
                    {albumReleaseDate && (
                      <>
                        <span className="px-1.5 text-orange-300/60">•</span>
                        <span>{albumReleaseDate}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <AnimatePresence initial={false}>
              {panel === 'stats' ? (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
              >
              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="min-w-0 rounded-[22px] bg-white/[0.045] p-3">
                  <UserCircle className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="block text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">Artista</span>
                  <strong className="mt-1 block whitespace-nowrap font-black tabular-nums leading-none text-white" style={{ fontSize: 'clamp(17px, 5.2vw, 22px)' }}>
                    <ModalMetricValue ready={panelHydration.metrics} value={entityStats.artist} />
                  </strong>
                </div>
                <div className="min-w-0 rounded-[22px] bg-white/[0.045] p-3">
                  <ListMusic className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="block text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">Faixa</span>
                  <strong className="mt-1 block whitespace-nowrap font-black tabular-nums leading-none text-white" style={{ fontSize: 'clamp(17px, 5.2vw, 22px)' }}>
                    <ModalMetricValue ready={trackMetricReady} value={entityStats.track} fallbackValue={knownUserTrackCount} />
                  </strong>
                </div>
                <div className="min-w-0 rounded-[22px] bg-white/[0.045] p-3">
                  <Disc3 className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="block text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">Álbum</span>
                  <strong className="mt-1 block whitespace-nowrap font-black tabular-nums leading-none text-white" style={{ fontSize: 'clamp(17px, 5.2vw, 22px)' }}>
                    <ModalMetricValue ready={panelHydration.metrics} value={entityStats.album} />
                  </strong>
                </div>
              </div>

              {trackArtists.length > 1 && (
                panelHydration.artistStats && artistStats.length > 1 ? (
                <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1" data-home-horizontal-scroll="true">
                  {artistStats.map((artist) => (
                    <div
                      key={artist.key}
                      className={clsx(
                        "bottom-track-stats-surface flex min-w-0 items-center gap-2 rounded-full px-2.5 py-2",
                        artistStats.length <= 3 ? "flex-1 shrink" : "min-w-[128px] flex-1 shrink-0"
                      )}
                    >
                      <div className="h-8 w-8 overflow-hidden rounded-full bg-white/[0.05]">
                        <SmartImage src={artist.image || artistImage} className="h-full w-full object-cover" rounded="full" fallback={artist.name} />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-[9px] font-black text-white/78">{artist.name}</span>
                        <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-orange-300"><AnimatedNumber value={artist.count} /></span>
                      </div>
                    </div>
                  ))}
                </div>
                ) : (
                <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1" data-home-horizontal-scroll="true" aria-hidden="true">
                  {artistStatSkeletons.map((artist, index) => (
                    <div
                      key={`${artist.key || artist.id || artist.name}-${index}`}
                      className={clsx(
                        "bottom-track-stats-surface flex min-w-0 items-center gap-2 rounded-full px-2.5 py-2",
                        artistStatSkeletons.length <= 3 ? "flex-1 shrink" : "min-w-[128px] flex-1 shrink-0"
                      )}
                    >
                      <div className="h-8 w-8 overflow-hidden rounded-full bg-white/[0.05]">
                        {artist.image ? (
                          <SmartImage src={artist.image} className="h-full w-full object-cover" rounded="full" fallback="" />
                        ) : (
                          <ModalSkeleton className="h-full w-full rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <ModalSkeleton className="h-2.5 w-14 max-w-full" />
                        <ModalSkeleton className="mt-1 h-3 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
                )
              )}

              {panelHydration.history ? (
                hasPreviousTrackHistory ? (
                <motion.div
                  className="mt-3"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  <div className={clsx("grid gap-1.5", trackHistory.bestYear ? "grid-cols-[1fr_1fr_1.05fr]" : "grid-cols-2")}>
                    <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-1.5">
                      <span className="block text-[6px] font-black uppercase leading-none tracking-[0.08em] text-white/36">Primeiro stream</span>
                      <span className="mt-1 block whitespace-nowrap text-[10px] font-black leading-none text-white/82">{formatFullDate(trackHistory.firstPlayedAt)}</span>
                    </div>
                    <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-1.5">
                      <span className="block text-[6px] font-black uppercase leading-none tracking-[0.08em] text-white/36">Último stream</span>
                      <span className="mt-1 block whitespace-nowrap text-[10px] font-black leading-none text-white/82">{formatFullDate(trackHistory.lastPlayedAt)}</span>
                    </div>
                    {trackHistory.bestYear && (
                    <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-1.5">
                      <span className="block text-[6px] font-black uppercase leading-none tracking-[0.08em] text-white/36">Ano recorde</span>
                      <span className="mt-1 block whitespace-nowrap text-[10px] font-black leading-none text-white/82">
                        {trackHistory.bestYearCount}x em {trackHistory.bestYear}
                      </span>
                    </div>
                    )}
                  </div>
                </motion.div>
                ) : (
                <motion.div
                  className="mt-3 rounded-[22px] bg-orange-500/[0.09] px-4 py-3 text-[11px] font-black leading-snug text-orange-100/86"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  Essa é sua primeira reprodução dessa faixa!
                </motion.div>
                )
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-1.5" aria-hidden="true">
                  <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-2">
                    <ModalSkeleton className="h-2 w-16" />
                    <ModalSkeleton className="mt-1.5 h-3 w-20" />
                  </div>
                  <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-2">
                    <ModalSkeleton className="h-2 w-16" />
                    <ModalSkeleton className="mt-1.5 h-3 w-20" />
                  </div>
                  <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-2">
                    <ModalSkeleton className="h-2 w-14" />
                    <ModalSkeleton className="mt-1.5 h-3 w-24" />
                  </div>
                </div>
              )}

              <motion.div
                className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
                data-home-horizontal-scroll="true"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {visibleSocialRanking.length > 0 && (
                  <div
                    className="bottom-track-stats-surface flex h-[48px] w-max shrink-0 items-center rounded-full py-1.5 pl-3 pr-2"
                    aria-label="ranking de reproduções no círculo"
                  >
                    {visibleSocialRanking.map((item, index) => (
                      <div
                        key={item.user.id}
                        className="relative -mr-3 shrink-0 last:mr-0"
                        style={{ zIndex: visibleSocialRanking.length - index }}
                      >
                        <div className={clsx(
                          "h-[29px] w-[29px] overflow-hidden rounded-full bg-black shadow-[0_5px_12px_rgba(0,0,0,0.28)]",
                          "ring-0"
                        )}>
                          <SmartImage src={coreUtils.getUserAvatar(item.user.id, item.user.avatar)} className="h-full w-full object-cover" rounded="full" fallback="" />
                        </div>
                        <span className={clsx(
                          "absolute -bottom-1 left-1/2 min-w-[18px] -translate-x-1/2 rounded-full bg-black/42 px-1.5 py-[2px] text-center text-[7px] font-black leading-none shadow-[0_7px_14px_rgba(0,0,0,0.25)] backdrop-blur-md",
                          "text-white"
                        )}>
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {!hasHydratedTrackRanking && (
                  <div className="bottom-track-stats-surface flex h-[48px] min-w-[88px] shrink-0 items-center rounded-full px-3 py-1.5" aria-hidden="true">
                    <ModalSkeleton className="h-7 w-14" />
                  </div>
                )}
                {panelHydration.social ? (
                  <div className={clsx(
                    "bottom-track-stats-surface relative flex h-[48px] w-fit max-w-[310px] shrink-0 items-center gap-2 overflow-hidden rounded-full px-3 py-1",
                    visibleSocialRanking.length === 0 && "w-full min-w-full"
                  )}
                  >
                    <div
                      className="relative flex h-9 shrink-0 items-center py-0.5 pl-1 pr-2"
                    >
                      {socialAvatarEntries.map((entry, index) => (
                        <div
                          key={`${entry.user?.id || index}-${entry.playedAt}`}
                          className="-mr-2.5 h-[29px] w-[29px] shrink-0 overflow-hidden rounded-full bg-white/[0.055] ring-0 shadow-[0_4px_10px_rgba(0,0,0,0.24)]"
                          style={{ zIndex: socialAvatarEntries.length - index }}
                        >
                          <SmartImage
                            src={coreUtils.getUserAvatar(entry.user?.id || user.id, entry.user?.avatar || user.avatar)}
                            className="h-full w-full object-cover"
                            rounded="full"
                            fallback=""
                          />
                        </div>
                      ))}
                    </div>
                    <div
                      className="relative w-fit max-w-[220px] py-1"
                    >
                      <span className="block max-w-[220px] text-balance text-[9px] font-bold leading-[1.12] text-white/58">
                        {socialInsight}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={clsx(
                      "bottom-track-stats-surface relative flex h-[48px] w-fit max-w-[310px] shrink-0 items-center gap-2 overflow-hidden rounded-full px-3 py-1",
                      visibleSocialRanking.length === 0 && "w-full min-w-full"
                    )}
                    aria-hidden="true"
                  >
                    <div className="relative flex h-9 shrink-0 items-center py-0.5 pl-1 pr-2">
                      <ModalSkeleton className="-mr-2.5 h-[29px] w-[29px] rounded-full" />
                      <ModalSkeleton className="-mr-2.5 h-[29px] w-[29px] rounded-full opacity-75" />
                    </div>
                    <div className="relative w-full max-w-[220px] space-y-1.5 py-1">
                      <ModalSkeleton className="h-2.5 w-36 max-w-full" />
                      <ModalSkeleton className="h-2.5 w-24" />
                    </div>
                  </div>
                )}
              </motion.div>

              <div className="mt-4 flex items-center gap-2">
                {track?.name && (
                  <button
                    type="button"
                    onClick={handleLyrics}
                    disabled={lyricsLoading || lyricsMatch?.hasLyrics === false}
                    className={clsx(
                      "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition-colors",
                      lyricsMatch?.hasLyrics === false
                        ? "cursor-not-allowed bg-white/[0.035] text-white/28"
                        : "border-0 bg-white/[0.045] text-white/72 hover:text-white"
                    )}
                  >
                    {lyricsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4 text-current" strokeWidth={2.4} />}
                    <span className="whitespace-nowrap">
                      {lyricsLoading ? 'Buscando' : lyricsMatch?.hasLyrics === false ? 'Letra indisponível' : 'Ver letra'}
                    </span>
                  </button>
                )}
                {(trackLinks.length > 0 || lyricsMatch?.match?.url) && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {trackLinks.map((link) => (
                      <TrackLinkIconButton key={link.label} link={link} onChoose={chooseTrackLink} />
                    ))}
                    {lyricsMatch?.match?.url && (
                      <TrackLinkIconButton
                        link={{
                          kind: 'genius',
                          label: 'Genius',
                          url: lyricsMatch.match.url,
                          appUrl: lyricsMatch.match.url,
                        }}
                        onChoose={chooseTrackLink}
                      />
                    )}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {selectedTrackLink && (
                  <motion.div
                    className="absolute inset-0 z-30 rounded-[34px]"
                    initial={false}
                    onClick={() => setSelectedTrackLink(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.82 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.88 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.9 }}
                      drag="y"
                      dragConstraints={{ top: 0, bottom: 0 }}
                      dragElastic={0.16}
                      onDragEnd={(_, info) => {
                        if (info.offset.y > 44 || info.velocity.y > 420) setSelectedTrackLink(null);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="glass-aura absolute w-max max-w-[calc(100%_-_16px)] overflow-hidden rounded-[14px] px-1 py-1"
                      style={{
                        right: trackLinkSheetAnchor.right,
                        bottom: trackLinkSheetAnchor.bottom,
                        background: 'rgba(7, 9, 12, 0.68)',
                        backdropFilter: 'blur(148px) saturate(145%)',
                        WebkitBackdropFilter: 'blur(148px) saturate(145%)',
                        border: 'none',
                        transformOrigin: 'bottom right',
                      }}
                    >
                    <div className="space-y-1">
                      <a
                        href={selectedTrackLink.appUrl || selectedTrackLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setSelectedTrackLink(null)}
                        className="flex items-center gap-2 rounded-[10px] py-1.5 pl-2.5 pr-2 text-white/86 active:bg-white/[0.055]"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/74" strokeWidth={2.4} />
                        <span className="text-[11px] font-semibold leading-none">
                          Abrir no {selectedTrackLink.label === 'stats.fm' && isAppleMusicUser ? 'stats.am' : selectedTrackLink.label}
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() => copyTrackLink(selectedTrackLink.url)}
                        className="flex w-full items-center gap-2 rounded-[10px] py-1.5 pl-2.5 pr-2 text-left text-white/86 active:bg-white/[0.055]"
                      >
                        <Copy className="h-3.5 w-3.5 shrink-0 text-white/74" strokeWidth={2.4} />
                        <span className="text-[11px] font-semibold leading-none">Copiar link</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => shareTrackLink(selectedTrackLink)}
                        className="flex w-full items-center gap-2 rounded-[10px] py-1.5 pl-2.5 pr-2 text-left text-white/86 active:bg-white/[0.055]"
                      >
                        <Share className="h-3.5 w-3.5 shrink-0 text-white/74" strokeWidth={2.4} />
                        <span className="text-[11px] font-semibold leading-none">Compartilhar</span>
                      </button>
                      {selectedTrackLink.kind === 'genius' && (
                        <button
                          type="button"
                          onClick={copyLyrics}
                          className="flex w-full items-center gap-2 rounded-[10px] py-1.5 pl-2.5 pr-2 text-left text-white/86 active:bg-white/[0.055]"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-white/74" />
                          <span className="text-[11px] font-semibold leading-none">Copiar letra</span>
                        </button>
                      )}
                    </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {toastMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                    className="absolute inset-x-8 bottom-5 z-40 rounded-full bg-black/72 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.08em] text-white/82 shadow-[0_16px_38px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
                  >
                    {toastMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-3 text-center text-[8px] font-black uppercase tracking-[0.16em] text-white/24">
                {lyricsMatch?.hasLyrics === false ? 'letra indisponível' : 'arraste para cima para ver a letra'}
              </p>
              </motion.div>
              ) : (
              <motion.div
                key="lyrics"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                className="mt-5"
              >
                {lyricsLoading ? (
                  <div className="flex h-[34vh] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-300" />
                  </div>
                ) : cleanedLyricsText ? (
                  <div className="max-h-[34vh] overflow-y-auto pr-2 text-[17px] font-black leading-[1.36] text-white/92 sm:text-[18px]">
                    <div className="whitespace-pre-line">{cleanedLyricsText}</div>
                  </div>
                ) : lyricsMatch?.hasLyrics === false ? (
                  <div className="flex h-[34vh] flex-col items-center justify-center gap-3 px-5 text-center text-white/52">
                    <FileText className="h-7 w-7 text-orange-300/70" />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em]">letra indisponível</span>
                  </div>
                ) : lyricsMatch?.hasLyrics && lyricsMatch.match?.url ? (
                  <div className="flex h-[34vh] flex-col items-center justify-center gap-4 px-5 text-center">
                    <FileText className="h-8 w-8 text-orange-300" />
                    <div>
                      <p className="text-sm font-black leading-tight text-white/82">Letra encontrada</p>
                      <p className="mt-2 text-[11px] font-bold leading-snug text-white/45">
                        O Genius bloqueou a extração completa agora, mas o link oficial está pronto.
                      </p>
                    </div>
                    <a
                      href={lyricsMatch.match.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-white/[0.08] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/72"
                    >
                      abrir no Genius
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleLyrics}
                    className="flex h-[34vh] w-full flex-col items-center justify-center gap-3 text-white/52"
                  >
                    <FileText className="h-7 w-7 text-orange-300" />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em]">carregar letra</span>
                  </button>
                )}
                <div className="mt-4 rounded-[18px] bg-white/[0.055] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-orange-300">Composição</span>
                  <p className="mt-1 text-[11px] font-medium leading-snug text-white/62">
                    {writerNames || 'Autoria indisponível'}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-[0.16em] text-white/24">
                  <span>Powered by</span>
                  {lyricsMatch?.match?.url ? (
                    <a
                      href={lyricsMatch.match.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-1 text-white/24 transition-colors hover:text-white/42"
                      aria-label="Abrir Genius"
                    >
                      <img src="/genius-logo_hor.svg" alt="Genius" className="h-2.5 w-auto opacity-40 grayscale invert transition-opacity group-hover:opacity-60" />
                      <ExternalLink className="mt-[-2px] h-2 w-2 text-current" strokeWidth={2.6} />
                    </a>
                  ) : (
                    <img src="/genius-logo_hor.svg" alt="Genius" className="h-2.5 w-auto opacity-40 grayscale invert" />
                  )}
                </div>
              </motion.div>
              )}
              </AnimatePresence>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </>
  );
});

BottomTrackStatsBubble.displayName = 'BottomTrackStatsBubble';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isOffline = useStatsStore(state => state.isOffline);
  const groupStats = useStatsStore(state => state.groupStats);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const [homeReady, setHomeReady] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return window.__STATS_LC_HOME_READY__ === true || window.sessionStorage?.getItem('stats-lc-home-boot-ready') === '1';
  });
  
  const allUsers = React.useMemo(() => {
    return getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId);
  }, [groupStats, liveNowPlayingByUserId]);

  const activeMembersSorted = React.useMemo(() => {
    const list = allUsers.filter(u => {
      const pb = coreUtils.getPlaybackStatus(u);
      return pb.status === "live";
    });
    return list.sort((a, b) => {
      if (a.id === featuredUserId) return -1;
      if (b.id === featuredUserId) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [allUsers, featuredUserId]);

  const selectedStatsUser = React.useMemo(() => {
    const coldUser = groupStats?.users?.[featuredUserId] || allUsers.find((user) => user.id === featuredUserId) || allUsers[0];
    return coldUser ? attachLiveNowPlayingToMember(coldUser, liveNowPlayingByUserId) : coldUser;
  }, [allUsers, groupStats?.users, featuredUserId, liveNowPlayingByUserId]);

  const playingUser = React.useMemo(() => {
    return getUserTrackStatsSource(selectedStatsUser);
  }, [selectedStatsUser]);

  const track = playingUser?.nowPlaying?.track;
  const songName = track?.name || "Nenhuma música";
  const artistName = track?.artists
    ? (typeof track.artists[0] === 'string' ? track.artists[0] : (track.artists[0] as any)?.name || "Artista")
    : "Artista";
  
  const [isSyncInfoExpanded, setIsSyncInfoExpanded] = React.useState(() => {
    const saved = localStorage.getItem('sync_info_expanded');
    return saved !== null ? saved === 'true' : false;
  });

  const [highlightedBubbles, setHighlightedBubbles] = React.useState<Record<string, boolean>>({});
  const syncPointerStartRef = React.useRef<{ x: number; y: number; scrollLeft: number } | null>(null);
  const syncDidDragRef = React.useRef(false);

  React.useEffect(() => {
    const handleNowPlaying = (event: any) => {
      const { userId } = event.detail || {};
      if (userId && userId !== featuredUserId) {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReduced) {
          setHighlightedBubbles(prev => ({ ...prev, [userId]: true }));
          setTimeout(() => {
            setHighlightedBubbles(prev => {
              const next = { ...prev };
              delete next[userId];
              return next;
            });
          }, 2000);
        }
      }
    };
    window.addEventListener('nowPlayingChanged', handleNowPlaying);
    return () => window.removeEventListener('nowPlayingChanged', handleNowPlaying);
  }, [featuredUserId]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  React.useEffect(() => {
    const handleHomeReady = (event: Event) => {
      const ready = (event as CustomEvent<{ ready?: boolean }>).detail?.ready;
      if (ready === true) {
        window.__STATS_LC_HOME_READY__ = true;
        sessionStorage.setItem('stats-lc-home-boot-ready', '1');
      } else if (ready === false) {
        window.__STATS_LC_HOME_READY__ = false;
        sessionStorage.removeItem('stats-lc-home-boot-ready');
      }
      setHomeReady(ready === true);
    };
    window.addEventListener('stats-lc-home-ready', handleHomeReady);
    return () => window.removeEventListener('stats-lc-home-ready', handleHomeReady);
  }, []);

  React.useEffect(() => {
    if (!homeReady) return;
    window.__STATS_LC_HOME_READY__ = true;
    window.sessionStorage?.setItem('stats-lc-home-boot-ready', '1');
  }, [homeReady]);

  const toggleSyncInfo = () => {
    setIsSyncInfoExpanded(prev => {
      const next = !prev;
      localStorage.setItem('sync_info_expanded', String(next));
      return next;
    });
  };
  
  const shouldShowExpanded = isSyncInfoExpanded;
  
  const lastUpdate = groupStats?.lastUpdated;
  const isStatsOrRanking = location.pathname === '/highlights' || location.pathname === '/ranking';
  const isHomeRoute = location.pathname === '/';
  const shouldGateHome = isHomeRoute && !homeReady;

  return (
    <div
      className="app-shell relative flex w-full max-w-[480px] mx-auto flex-col overflow-x-clip overflow-y-visible font-sans"
      style={{ ['--app-background' as string]: '#050505' }}
    >
      {/* Scroll Fade Gradients removed to prevent overlaying headers */}

      {/* Offline Status */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="z-[100] min-h-7 bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 flex items-center justify-center gap-2"
          >
            <WifiOff className="h-3 w-3 text-red-500" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Modo Offline</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Content */}
      <main className={clsx(
        "flex-1 w-full pt-[max(env(safe-area-inset-top),40px)] pb-[calc(env(safe-area-inset-bottom)+100px)]",
        shouldGateHome && "pointer-events-none opacity-0"
      )}>
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.16,
            ease: [0.16, 1, 0.3, 1]
          }}
          className="w-full h-full"
        >
          {children}
        </motion.div>
      </main>

      {/* Tab Bar (Floating Bottom Nav) */}
      <div className={clsx(
        "stable-bottom-bar fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none gap-2",
        shouldGateHome && "hidden"
      )}>
        {/* Sync Info Footer - aparece apenas quando scrollar */}
        <AnimatePresence>
          {lastUpdate && activeMembersSorted.length > 0 && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                mass: 0.8
              }}
              onClick={() => {
                if (syncDidDragRef.current) {
                  syncDidDragRef.current = false;
                  return;
                }
                toggleSyncInfo();
              }}
              className={clsx(
                "pointer-events-auto flex items-center mb-1 select-none group relative transition-colors duration-300 overflow-hidden text-left",
                shouldShowExpanded
                  ? "bg-transparent border-none shadow-none min-h-10 gap-2 w-[min(95vw,456px)]"
                  : "leo-soft-badge cursor-pointer rounded-full h-7 pl-2.5 pr-2 gap-1.5"
              )}
              title={shouldShowExpanded ? "Minimizar informações" : "Exibir informações de sincronização"}
            >
              <motion.div 
                className={clsx(
                  "flex items-center min-w-0",
                  shouldShowExpanded ? "gap-2" : "gap-1"
                )}
              >
                <motion.div 
                  className={clsx(
                    "flex items-center min-w-0 transition-[background-color,opacity,transform] duration-300",
                    shouldShowExpanded 
                      ? "overflow-x-auto no-scrollbar w-full py-1.5 px-0.5 gap-1.5 snap-x snap-mandatory"
                      : "-space-x-1.5"
                  )}
                  onPointerDown={(event) => {
                    syncDidDragRef.current = false;
                    syncPointerStartRef.current = {
                      x: event.clientX,
                      y: event.clientY,
                      scrollLeft: event.currentTarget.scrollLeft,
                    };
                  }}
                  onPointerMove={(event) => {
                    const start = syncPointerStartRef.current;
                    if (!start) return;
                    const deltaX = Math.abs(event.clientX - start.x);
                    const deltaY = Math.abs(event.clientY - start.y);
                    const deltaScroll = Math.abs(event.currentTarget.scrollLeft - start.scrollLeft);
                    if (deltaX > 6 || deltaY > 6 || deltaScroll > 2) {
                      syncDidDragRef.current = true;
                    }
                  }}
                  onPointerUp={() => {
                    syncPointerStartRef.current = null;
                  }}
                  onPointerCancel={() => {
                    syncPointerStartRef.current = null;
                  }}
                >
                  {activeMembersSorted.map((user, index) => {
                    const userAvatar = coreUtils.getUserAvatar(user.id, user.avatar);
                    const userTrack = user.nowPlaying?.track;
                    const uSongName = userTrack?.name || "Nenhuma música";
                    const uArtistName = userTrack?.artists
                      ? (typeof userTrack.artists[0] === 'string' ? userTrack.artists[0] : (userTrack.artists[0] as any)?.name || "Artista")
                      : "Artista";
                    const isBubbleHighlighted = highlightedBubbles[user.id];

                    return (
                      <motion.div 
                        key={user.id}
                        animate={isBubbleHighlighted ? {
                          scale: [1, 1.2, 1],
                        } : {}}
                        transition={{ duration: 2, ease: "easeInOut" }}
                        className={clsx(
                          "flex items-center gap-2 shrink-0 min-w-0 transition-[background-color,border-color,opacity,transform] duration-300",
                          shouldShowExpanded && "leo-soft-badge w-[clamp(104px,25vw,142px)] snap-start hover:bg-white/[0.12] pr-2.5 pl-1.5 py-1.5 rounded-full hover:scale-[1.02] active:scale-[0.98]",
                          isBubbleHighlighted && !shouldShowExpanded && "relative z-30"
                        )}
                      >
                        {/* Avatar container with Equalizer Overlay (only when expanded) */}
                        <motion.div 
                          className="relative shrink-0"
                          animate={isBubbleHighlighted ? {
                            scale: [1, 1.08, 1]
                          } : {}}
                          transition={{ duration: 2, ease: "easeInOut" }}
                          style={{ borderRadius: "9999px" }}
                        >
                          <div className={clsx(
                            "h-6.5 w-6.5 rounded-full ring-[1px] ring-white/10 overflow-hidden bg-stone-900 flex items-center justify-center transition-transform duration-300",
                            !shouldShowExpanded && "scale-[0.77]"
                          )}>
                            <SmartImage 
                              src={userAvatar} 
                              className="h-full w-full object-cover" 
                              rounded="full" 
                              fallback={user.name?.charAt(0) || "👤"}
                            />
                          </div>
                          
                          {/* Status Indicator (Equalizer) - overlay on bottom right (ONLY WHEN EXPANDED) */}
                          {shouldShowExpanded && user.nowPlaying?.isNow && (
                            <div className="absolute -bottom-1 -right-1 flex items-center justify-center transition-all duration-300 z-10 scale-[0.6]">
                              <EqualizerIcon />
                            </div>
                          )}
                        </motion.div>

                        {/* Music info */}
                        <AnimatePresence mode="popLayout" initial={false}>
                          {shouldShowExpanded && (
                            <motion.div
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -5 }}
                              transition={{ duration: 0.25 }}
                              className="flex min-w-0 flex-1 flex-col overflow-hidden text-left"
                            >
                              <span className="text-[10px] font-bold text-white/95 truncate leading-tight tracking-tight">
                                {uSongName}
                              </span>
                              <span className="text-[8.5px] font-medium text-white/40 truncate leading-none mt-0.5 tracking-tight">
                                {uArtistName}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Global Equalizer in Minimized mode when someone is playing */}
                {!shouldShowExpanded && activeMembersSorted.some(u => u.nowPlaying?.isNow) && (
                  <motion.div className="opacity-80">
                    <EqualizerIcon />
                  </motion.div>
                )}
              </motion.div>
          </motion.div>
          )}
        </AnimatePresence>

        <div className="flex w-full max-w-[480px] items-end justify-center gap-2 px-3">
          {/* Navigation - Liquid Glass Capsule */}
          <div className="min-w-0 flex-1">
            <BottomNavigation pathname={location.pathname} />
          </div>
          <BottomTrackStatsBubble user={playingUser} />
        </div>
      </div>

      {/* Background Atmosphere */}
      <div className="app-background pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[70%] rounded-full bg-blue-600/[0.07] blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[10%] right-[-10%] h-[40%] w-[60%] rounded-full bg-purple-600/[0.07] blur-[120px] animate-pulse-slow ml-auto" />
        
        {/* Subtle Noise Texture */}
        <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay bg-[url('https://transparenttextures.com/patterns/asfalt-dark.png')]" />
      </div>
    </div>
  );
};
