/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, AudioLines, SlidersHorizontal, WifiOff, Orbit, Music2, X, FileText, Loader2, Disc3, UserCircle, ListMusic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';
import { statsService } from '../services/statsService';
import { AnimatedNumber, SmartImage } from './shared/CommonUI';
import { attachLiveNowPlayingToMember, getCanonicalMembersWithLive } from '../lib/memberSelectors';
import type { LyricsMatch } from '../types/stats';

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
  const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : undefined;
  if (typeof firstArtist === 'string') return firstArtist;
  if (firstArtist?.name) return firstArtist.name;
  if (typeof track?.artist === 'string') return track.artist;
  return track?.artist?.name || track?.artistName || 'Artista';
};

const getTrackArtists = (track: any) => {
  const rawArtists = Array.isArray(track?.artists) ? track.artists : [];
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

  if (normalized.length > 0) return normalized;

  const fallbackName = getTrackArtistName(track);
  const fallbackId = getMainArtistId(track);
  return fallbackName ? [{ id: fallbackId, name: fallbackName, image: getTrackArtistImage(track), key: fallbackId || fallbackName }] : [];
};

const getTrackArtistImage = (track: any) => {
  const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : undefined;
  return [
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
  const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : undefined;
  return String(firstArtist?.id || firstArtist?.statsfmId || firstArtist?.spotifyId || firstArtist?.appleMusicId || track?.artist?.id || track?.artistId || '');
};

const getAlbumId = (track: any) => String(track?.albumId || track?.album?.id || '');

const firstExternalId = (value: any) => {
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item.trim()) || '';
  return typeof value === 'string' ? value : '';
};

const getTrackLinks = (track: any) => {
  const spotifyId = track?.spotifyId || firstExternalId(track?.externalIds?.spotify);
  const appleMusicId = track?.appleMusicId || firstExternalId(track?.externalIds?.appleMusic);
  const statsId = track?.id || track?.statsfmId;
  return [
    statsId && { kind: 'statsfm' as const, label: 'stats.fm', url: `https://stats.fm/track/${statsId}` },
    spotifyId && { kind: 'spotify' as const, label: 'Spotify', url: `https://open.spotify.com/track/${spotifyId}`, appUrl: `spotify:track:${spotifyId}` },
    appleMusicId && { kind: 'apple' as const, label: 'Apple Music', url: `https://music.apple.com/song/${appleMusicId}`, appUrl: `music://music.apple.com/song/${appleMusicId}` },
  ].filter(Boolean) as Array<{ kind: 'statsfm' | 'spotify' | 'apple'; label: string; url: string; appUrl?: string }>;
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

type TrackLink = ReturnType<typeof getTrackLinks>[number];

const TrackLinkIconButton = ({ link, onChoose }: { link: TrackLink; onChoose: (link: TrackLink) => void }) => {
  const icon = link.kind === 'statsfm'
    ? <StatsFmMark className="h-4 w-4 text-current" />
    : link.kind === 'spotify'
      ? <SpotifyMark className="h-4 w-4 text-current" />
      : <AppleMark className="h-4 w-4 text-current" />;

  if (link.kind === 'statsfm') {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir no stats.fm"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.065] text-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform active:scale-95"
      >
        {icon}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onChoose(link)}
      aria-label={`Opções do ${link.label}`}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.065] text-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform active:scale-95"
    >
      {icon}
    </button>
  );
};

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
  const [entityStats, setEntityStats] = React.useState({ artist: 0, track: 0, album: 0 });
  const [artistStats, setArtistStats] = React.useState<Array<{ id: string; name: string; image: string; key: string; count: number }>>([]);
  const [circleFirstListen, setCircleFirstListen] = React.useState<{ user: any; playedAt: number } | null>(null);
  const [circleFirstListeners, setCircleFirstListeners] = React.useState<Array<{ user: any; playedAt: number }>>([]);
  const [hasFriendHistory, setHasFriendHistory] = React.useState(false);
  const [trackHistory, setTrackHistory] = React.useState<{ firstPlayedAt: number; lastPlayedAt: number; bestYear: string; bestYearCount: number }>({
    firstPlayedAt: 0,
    lastPlayedAt: 0,
    bestYear: '',
    bestYearCount: 0,
  });

  const track = user?.nowPlaying?.track;
  const trackId = String(track?.id || track?.track?.id || '');
  const artistId = getMainArtistId(track);
  const albumId = getAlbumId(track);
  const trackTitle = track?.name || 'Música';
  const artistName = getTrackArtistName(track);
  const trackArtists = React.useMemo(() => getTrackArtists(track), [track]);
  const artwork = getTrackArtwork(track);
  const artistImage = trackArtists[0]?.image || getTrackArtistImage(track) || artwork;
  const albumName = track?.albumName || track?.album?.name || 'Álbum';
  const trackLinks = React.useMemo(() => getTrackLinks(track), [track]);
  const members = React.useMemo(() => getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId), [groupStats, liveNowPlayingByUserId]);

  React.useEffect(() => {
    if (!track?.name) {
      setLyricsMatch(null);
      setLyricsText(null);
      return;
    }

    let cancelled = false;
    setLyricsText(null);
    statsService.fetchLyricsMatch(track.name, artistName)
      .then((match) => {
        if (!cancelled) setLyricsMatch(match);
      });
    return () => {
      cancelled = true;
    };
  }, [track?.name, artistName]);

  React.useEffect(() => {
    if (!trackId || !members.length) return;
    fetchTrackStatsForAll(trackId).catch(() => undefined);
  }, [trackId, members.length, fetchTrackStatsForAll]);

  React.useEffect(() => {
    if (!user?.id || !trackId) {
      setEntityStats({ artist: 0, track: 0, album: 0 });
      setArtistStats([]);
      setTrackHistory({ firstPlayedAt: 0, lastPlayedAt: 0, bestYear: '', bestYearCount: 0 });
      setCircleFirstListen(null);
      setCircleFirstListeners([]);
      setHasFriendHistory(false);
      return;
    }

    let cancelled = false;
    const artistsToFetch = trackArtists.filter((artist) => artist.id);
    Promise.all([
      Promise.all(artistsToFetch.map((artist) => statsService.fetchEntityStats(user.id, 'artist', artist.id).catch(() => 0))),
      statsService.fetchEntityStats(user.id, 'track', trackId).catch(() => 0),
      albumId ? statsService.fetchEntityStats(user.id, 'album', albumId).catch(() => 0) : Promise.resolve(0),
      statsService.fetchEntityStreams(user.id, 'track', trackId, 240).catch(() => []),
      Promise.all(members.map((member) =>
        statsService.fetchEntityStreams(member.id, 'track', trackId, 80)
          .then((items) => ({ member, items }))
          .catch(() => ({ member, items: [] }))
      )),
    ]).then(([artistCounts, trackCount, album, history, memberHistories]) => {
      if (cancelled) return;
      const nextArtistStats = artistsToFetch.map((artist, index) => ({
        ...artist,
        count: artistCounts[index] || 0,
      }));
      const primaryArtistCount = nextArtistStats[0]?.count || 0;
      const friendEntries = memberHistories
        .map(({ member, items }) => {
          const sourceItems = member.id === user.id ? history : items;
          return { member, playedAt: getEarliestStream(sourceItems), hasItems: sourceItems.length > 0 };
        })
        .filter((entry) => entry.playedAt > 0)
        .sort((a, b) => a.playedAt - b.playedAt);
      const friendsWithHistory = friendEntries.filter((entry) => entry.member.id !== user.id);
      const firstEntry = friendEntries[0];
      const firstDayEntries = firstEntry
        ? friendEntries.filter((entry) => getDayKey(entry.playedAt) === getDayKey(firstEntry.playedAt))
        : [];

      setArtistStats(nextArtistStats);
      setEntityStats({ artist: primaryArtistCount, track: trackCount, album });
      setTrackHistory(summarizeTrackHistory(history, user?.nowPlaying?.timestamp));
      setCircleFirstListen(friendsWithHistory.length > 0 && firstEntry
        ? { user: firstEntry.member, playedAt: firstEntry.playedAt }
        : null);
      setCircleFirstListeners(friendsWithHistory.length > 0
        ? firstDayEntries.map((entry) => ({ user: entry.member, playedAt: entry.playedAt }))
        : []);
      setHasFriendHistory(friendsWithHistory.length > 0);
    });

    return () => {
      cancelled = true;
    };
  }, [albumId, members, trackArtists, trackId, user?.id, user?.nowPlaying?.timestamp]);

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
  const hasPreviousTrackHistory = !!trackHistory.firstPlayedAt;
  const visibleSocialRanking = hasFriendHistory ? ranking.slice(0, 3) : [];
  const hiddenSocialRankingCount = hasFriendHistory ? Math.max(0, ranking.length - visibleSocialRanking.length) : 0;
  const circleFirstName = circleFirstListen?.user?.name?.split(/\s+/)[0]?.toLowerCase() || '';
  const firstDayGroup = circleFirstListeners.length > 0
    ? circleFirstListeners
    : circleFirstListen
      ? [circleFirstListen]
      : [];
  const visibleFirstDayGroup = firstDayGroup.slice(0, 3);
  const hiddenFirstDayGroupCount = Math.max(0, firstDayGroup.length - visibleFirstDayGroup.length);
  const hasFirstDayGroup = firstDayGroup.length > 1;
  const socialInsight = circleFirstListen
    ? hasFirstDayGroup
      ? 'Vocês ouviram primeiro juntos!'
      : circleFirstListen.user.id === user.id
      ? `Você ouviu primeiro em ${formatShortDate(circleFirstListen.playedAt)}.`
      : `${circleFirstName.charAt(0).toUpperCase()}${circleFirstName.slice(1)} ouviu primeiro em ${formatShortDate(circleFirstListen.playedAt)}.`
    : hasFriendHistory
      ? 'O círculo já ouviu, mas sem data confiável.'
      : 'Só você ouviu essa faixa por enquanto.';

  const copyTrackLink = async (url: string) => {
    try {
      await navigator.clipboard?.writeText(url);
    } catch {}
    setSelectedTrackLink(null);
  };

  const handleLyrics = async () => {
    if (!track?.name) return;
    setLyricsLoading(true);
    const response = await statsService.fetchLyricsFull(track.name, artistName);
    setLyricsLoading(false);
    setLyricsMatch(response);
    if (response.lyrics) {
      setLyricsText(response.lyrics);
      setPanel('lyrics');
      return;
    }
    setPanel('lyrics');
  };

  React.useEffect(() => {
    const openTrackStats = (event: Event) => {
      const detail = (event as CustomEvent<{ panel?: 'stats' | 'lyrics' }>).detail;
      setIsOpen(true);
      if (detail?.panel === 'lyrics') {
        handleLyrics();
      } else {
        setPanel('stats');
      }
    };
    window.addEventListener('stats-lc-open-track-stats', openTrackStats);
    return () => window.removeEventListener('stats-lc-open-track-stats', openTrackStats);
  }, [handleLyrics]);

  if (!track && !user) return null;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed left-0 right-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+112px)] z-40 flex pointer-events-none items-end justify-center px-4 pb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              initial={{ y: 42, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 28, scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 28 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x < -58) {
                  if (!lyricsText) handleLyrics();
                  else setPanel('lyrics');
                } else if (info.offset.x > 58) {
                  setPanel('stats');
                }
              }}
              onClick={(event) => event.stopPropagation()}
              className="glass-aura pointer-events-auto relative w-full max-w-[430px] overflow-hidden rounded-[34px] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsOpen(false);
                  setPanel('stats');
                }}
                className="absolute right-4 top-4 z-20 rounded-full bg-white/[0.055] p-2 text-white/45 transition-colors hover:text-white"
                aria-label="Fechar stats"
              >
                <X className="h-4 w-4" />
              </button>

              <motion.div
                animate={{ x: panel === 'stats' ? '0%' : '-108%' }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className="flex w-full"
              >
              <div className="w-full shrink-0">
              <div className="flex items-start gap-4 pr-10">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-white/[0.04]">
                  {artwork ? (
                    <SmartImage src={artwork} className="h-full w-full object-cover" rounded="none" fallback="" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music2 className="h-9 w-9 text-white/36" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 pt-1">
                  <span className="block text-[8px] font-black uppercase tracking-[0.24em] text-orange-400">Stats da música</span>
                  <h3 className="mt-1 line-clamp-2 text-[22px] font-black leading-[1.02] text-white">{trackTitle}</h3>
                  <p className="mt-1 truncate text-sm font-semibold text-white/48">{artistName}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="min-w-0 rounded-[22px] bg-white/[0.045] p-3">
                  <UserCircle className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="block text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">Artista</span>
                  <strong className="mt-1 block whitespace-nowrap font-black tabular-nums leading-none text-white" style={{ fontSize: 'clamp(17px, 5.2vw, 22px)' }}><AnimatedNumber value={entityStats.artist} /></strong>
                </div>
                <div className="min-w-0 rounded-[22px] bg-white/[0.045] p-3">
                  <ListMusic className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="block text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">Faixa</span>
                  <strong className="mt-1 block whitespace-nowrap font-black tabular-nums leading-none text-white" style={{ fontSize: 'clamp(17px, 5.2vw, 22px)' }}><AnimatedNumber value={entityStats.track || userTrackStats[`${user?.id}:${trackId}`] || 0} /></strong>
                </div>
                <div className="min-w-0 rounded-[22px] bg-white/[0.045] p-3">
                  <Disc3 className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="block text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">Álbum</span>
                  <strong className="mt-1 block whitespace-nowrap font-black tabular-nums leading-none text-white" style={{ fontSize: 'clamp(17px, 5.2vw, 22px)' }}><AnimatedNumber value={entityStats.album} /></strong>
                </div>
              </div>

              {artistStats.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1" data-home-horizontal-scroll="true">
                  {artistStats.map((artist) => (
                    <div key={artist.key} className="flex min-w-[118px] shrink-0 items-center gap-2 rounded-full bg-black/18 px-2.5 py-2">
                      <div className="h-8 w-8 overflow-hidden rounded-full bg-white/[0.05]">
                        <SmartImage src={artist.image || artistImage} className="h-full w-full object-cover" rounded="full" fallback={artist.name} />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-[9px] font-black text-white/78">{artist.name}</span>
                        <span className="block text-[8px] font-black uppercase tracking-[0.12em] text-orange-300"><AnimatedNumber value={artist.count} /></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasPreviousTrackHistory ? (
                <div className="mt-2">
                  <div className={clsx("grid gap-1.5", trackHistory.bestYear ? "grid-cols-[1fr_1fr_1.05fr]" : "grid-cols-2")}>
                    <div className="min-w-0 rounded-full bg-black/20 px-3 py-2">
                      <span className="block text-[5px] font-black uppercase leading-none tracking-[0.08em] text-white/32">Primeiro stream</span>
                      <span className="mt-1 block whitespace-nowrap text-[10px] font-black leading-none text-white/82">{formatFullDate(trackHistory.firstPlayedAt)}</span>
                    </div>
                    <div className="min-w-0 rounded-full bg-black/20 px-3 py-2">
                      <span className="block text-[5px] font-black uppercase leading-none tracking-[0.08em] text-white/32">Último stream</span>
                      <span className="mt-1 block whitespace-nowrap text-[10px] font-black leading-none text-white/82">{formatFullDate(trackHistory.lastPlayedAt)}</span>
                    </div>
                    {trackHistory.bestYear && (
                    <div className="min-w-0 rounded-full bg-black/20 px-3 py-2">
                      <span className="block text-[5px] font-black uppercase leading-none tracking-[0.08em] text-white/32">Mais ouviu em</span>
                      <span className="mt-1 block whitespace-nowrap text-[10px] font-black leading-none text-white/82">
                        {trackHistory.bestYearCount}x em {trackHistory.bestYear}
                      </span>
                    </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-[22px] bg-orange-500/[0.09] px-4 py-3 text-[11px] font-black leading-snug text-orange-100/86">
                  Essa é sua primeira reprodução dessa faixa!
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                {visibleSocialRanking.length > 0 && (
                  <div className="relative h-[48px] w-[92px] shrink-0" aria-label="ranking de reproduções no círculo">
                    {visibleSocialRanking.map((item, index) => (
                      <div
                        key={item.user.id}
                        className="absolute top-1"
                        style={{ left: index * 20, zIndex: visibleSocialRanking.length - index }}
                      >
                        <div className={clsx(
                          "h-9 w-9 overflow-hidden rounded-full bg-black shadow-[0_8px_18px_rgba(0,0,0,0.35)]",
                          "ring-1 ring-white/12"
                        )}>
                          <SmartImage src={coreUtils.getUserAvatar(item.user.id, item.user.avatar)} className="h-full w-full object-cover" rounded="full" fallback="" />
                        </div>
                        <span className={clsx(
                          "absolute -bottom-1.5 left-1/2 min-w-[18px] -translate-x-1/2 rounded-full px-1.5 py-[2px] text-center text-[7px] font-black leading-none shadow-[0_4px_10px_rgba(0,0,0,0.35)]",
                          index === 0 ? "bg-orange-500 text-white" : "bg-[#272727] text-white/86"
                        )}>
                          {item.count}
                        </span>
                      </div>
                    ))}
                    {hiddenSocialRankingCount > 0 && (
                      <div
                        className="absolute top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] bg-black/38 text-[10px] font-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] backdrop-blur-xl"
                        style={{ left: visibleSocialRanking.length * 20, zIndex: 0 }}
                      >
                        +{hiddenSocialRankingCount}
                      </div>
                    )}
                  </div>
                )}
                <div className={clsx(
                  "relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-full bg-white/[0.055] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_30px_rgba(0,0,0,0.24)]",
                  visibleSocialRanking.length === 0 && "w-full"
                )}>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/[0.035] via-transparent to-white/[0.025]" />
                  <div
                    className="relative h-9 shrink-0"
                    style={{ width: visibleFirstDayGroup.length > 1 ? 36 + (visibleFirstDayGroup.length - 1) * 18 + (hiddenFirstDayGroupCount > 0 ? 18 : 0) : 36 }}
                  >
                    {(visibleFirstDayGroup.length > 0 ? visibleFirstDayGroup : [{ user, playedAt: 0 }]).map((entry, index) => (
                      <div
                        key={`${entry.user.id || index}-${entry.playedAt}`}
                        className="absolute top-0 h-9 w-9 overflow-hidden rounded-full bg-white/[0.055] ring-1 ring-white/12 shadow-[0_6px_14px_rgba(0,0,0,0.28)]"
                        style={{ left: index * 18, zIndex: visibleFirstDayGroup.length - index }}
                      >
                        <SmartImage
                          src={coreUtils.getUserAvatar(entry.user?.id || user.id, entry.user?.avatar || user.avatar)}
                          className="h-full w-full object-cover"
                          rounded="full"
                          fallback=""
                        />
                      </div>
                    ))}
                    {hiddenFirstDayGroupCount > 0 && (
                      <div
                        className="absolute top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/42 text-[9px] font-black text-white ring-1 ring-white/10 backdrop-blur-xl"
                        style={{ left: visibleFirstDayGroup.length * 18, zIndex: 0 }}
                      >
                        +{hiddenFirstDayGroupCount}
                      </div>
                    )}
                  </div>
                  <span className="relative min-w-0 line-clamp-2 text-[10px] font-bold leading-[1.12] text-white/58">
                    {socialInsight}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {track?.name && (
                  <button
                    type="button"
                    onClick={handleLyrics}
                    className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/72 transition-colors hover:bg-white/[0.1] hover:text-white"
                  >
                    {lyricsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GeniusLogo className="h-4 w-4 text-current" />}
                    <span className="whitespace-nowrap">{lyricsMatch?.hasLyrics === false ? 'Buscar letra' : 'Letra'}</span>
                  </button>
                )}
                {trackLinks.length > 0 && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {trackLinks.map((link) => (
                      <TrackLinkIconButton key={link.label} link={link} onChoose={setSelectedTrackLink} />
                    ))}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {selectedTrackLink && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                    className="absolute inset-x-5 bottom-20 z-30 rounded-[24px] border border-white/[0.08] bg-black/72 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 px-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/48">{selectedTrackLink.label}</span>
                      <button type="button" onClick={() => setSelectedTrackLink(null)} className="rounded-full p-1 text-white/36" aria-label="Fechar opções">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={selectedTrackLink.appUrl || selectedTrackLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setSelectedTrackLink(null)}
                        className="rounded-full bg-white/[0.08] px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-white/72"
                      >
                        Abrir no app
                      </a>
                      <button
                        type="button"
                        onClick={() => copyTrackLink(selectedTrackLink.url)}
                        className="rounded-full bg-white/[0.08] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white/72"
                      >
                        Copiar link
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-3 text-center text-[8px] font-black uppercase tracking-[0.16em] text-white/24">
                arraste para a esquerda para ver a letra
              </p>
              </div>

              <div className="w-full shrink-0 pl-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-[8px] font-black uppercase tracking-[0.24em] text-orange-400">Letra</span>
                    <h3 className="mt-1 line-clamp-1 text-xl font-black text-white">{trackTitle}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanel('stats')}
                    className="rounded-full bg-white/[0.055] px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/52"
                  >
                    stats
                  </button>
                </div>
                {lyricsLoading ? (
                  <div className="flex h-[34vh] items-center justify-center rounded-[24px] bg-black/22">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-300" />
                  </div>
                ) : lyricsText ? (
                  <div className="max-h-[42vh] overflow-y-auto rounded-[24px] bg-black/22 p-4 text-sm font-medium leading-relaxed text-white/72 whitespace-pre-line">
                  {lyricsText}
                  </div>
                ) : lyricsMatch?.hasLyrics && lyricsMatch.match?.url ? (
                  <div className="flex h-[34vh] flex-col items-center justify-center gap-4 rounded-[24px] bg-black/22 px-5 text-center">
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
                    className="flex h-[34vh] w-full flex-col items-center justify-center gap-3 rounded-[24px] bg-black/22 text-white/52"
                  >
                    <FileText className="h-7 w-7 text-orange-300" />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em]">carregar letra</span>
                  </button>
                )}
              </div>
              </motion.div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
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
    return window.__STATS_LC_HOME_READY__ === true || sessionStorage.getItem('stats-lc-home-boot-ready') === '1';
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
        sessionStorage.setItem('stats-lc-home-boot-ready', '1');
      }
      setHomeReady(ready === true);
    };
    window.addEventListener('stats-lc-home-ready', handleHomeReady);
    return () => window.removeEventListener('stats-lc-home-ready', handleHomeReady);
  }, []);

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
          key={location.pathname}
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
        "fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none gap-2",
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
                  : "cursor-pointer rounded-full bg-white/5 border border-white/5 backdrop-blur-md shadow-lg h-7 pl-2.5 pr-2 gap-1.5"
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
                        key={`${user.id}-${index}`}
                        animate={isBubbleHighlighted ? {
                          scale: [1, 1.2, 1],
                        } : {}}
                        transition={{ duration: 2, ease: "easeInOut" }}
                        className={clsx(
                          "flex items-center gap-2 shrink-0 min-w-0 transition-[background-color,border-color,opacity,transform] duration-300",
                          shouldShowExpanded && "w-[clamp(104px,25vw,142px)] snap-start bg-white/[0.07] hover:bg-white/[0.12] pr-2.5 pl-1.5 py-1.5 rounded-full border border-white/10 backdrop-blur-xl shadow-xl hover:scale-[1.02] active:scale-[0.98]",
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
