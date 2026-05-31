/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, AudioLines, SlidersHorizontal, WifiOff, Orbit, Music2, X, FileText, ExternalLink, Loader2, Copy, Disc3, UserCircle, ListMusic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';
import { statsService } from '../services/statsService';
import { AnimatedNumber, SmartImage } from './shared/CommonUI';
import { getCanonicalMembers } from '../lib/memberSelectors';
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

const BottomNavigation = React.memo(({ pathname }: { pathname: string }) => {
  const activeNavIndex = Math.max(0, NAV_ITEMS.findIndex(item => item.activePaths.includes(pathname)));

  return (
    <nav className="w-full max-w-[460px] px-6 pb-6 pb-[calc(env(safe-area-inset-bottom)+12px)] pointer-events-auto mx-auto">
      <div className="relative rounded-[9999px]">
        <div className="glass-aura relative rounded-[9999px] overflow-hidden">
          <div className="absolute inset-x-6 top-[0.5px] h-[0.5px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          <div className="absolute inset-0 rounded-[9999px] bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

          <div className="relative grid grid-cols-4 gap-0 px-2 py-2.5 min-h-[74px]">
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
    statsId && { label: 'stats.fm', url: `https://stats.fm/track/${statsId}` },
    spotifyId && { label: 'Spotify', url: `https://open.spotify.com/track/${spotifyId}` },
    appleMusicId && { label: 'Apple Music', url: `https://music.apple.com/song/${appleMusicId}` },
  ].filter(Boolean) as Array<{ label: string; url: string }>;
};

const formatShortDate = (value: any) => {
  if (!value) return 'sem registro';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'sem registro';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
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

const CopyableLinkButton = ({ label, url }: { label: string; url: string }) => {
  const copyTimerRef = React.useRef<number | null>(null);
  const [copied, setCopied] = React.useState(false);

  const clearCopyTimer = () => {
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {}
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={() => {
        clearCopyTimer();
        copyTimerRef.current = window.setTimeout(copyUrl, 520);
      }}
      onPointerUp={clearCopyTimer}
      onPointerLeave={clearCopyTimer}
      onContextMenu={(event) => {
        event.preventDefault();
        copyUrl();
      }}
      className="flex items-center gap-1.5 rounded-full bg-white/[0.055] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-white/58 transition-colors hover:bg-white/[0.1] hover:text-white"
    >
      {copied ? <Copy className="h-3 w-3 text-orange-300" /> : <ExternalLink className="h-3 w-3" />}
      {copied ? 'copiado' : label}
    </a>
  );
};

const BottomTrackStatsBubble = React.memo(({ user }: { user: any }) => {
  const groupStats = useStatsStore(state => state.groupStats);
  const userTrackStats = useStatsStore(state => state.userTrackStats);
  const fetchTrackStatsForAll = useStatsStore(state => state.fetchTrackStatsForAll);
  const [isOpen, setIsOpen] = React.useState(false);
  const [lyricsMatch, setLyricsMatch] = React.useState<LyricsMatch | null>(null);
  const [lyricsText, setLyricsText] = React.useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = React.useState(false);
  const [panel, setPanel] = React.useState<'stats' | 'lyrics'>('stats');
  const [entityStats, setEntityStats] = React.useState({ artist: 0, track: 0, album: 0 });
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
  const artwork = getTrackArtwork(track);
  const artistImage = getTrackArtistImage(track) || artwork;
  const albumName = track?.albumName || track?.album?.name || 'Álbum';
  const trackLinks = React.useMemo(() => getTrackLinks(track), [track]);
  const members = React.useMemo(() => getCanonicalMembers(groupStats), [groupStats]);

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
      setTrackHistory({ firstPlayedAt: 0, lastPlayedAt: 0, bestYear: '', bestYearCount: 0 });
      return;
    }

    let cancelled = false;
    Promise.all([
      artistId ? statsService.fetchEntityStats(user.id, 'artist', artistId).catch(() => 0) : Promise.resolve(0),
      statsService.fetchEntityStats(user.id, 'track', trackId).catch(() => 0),
      albumId ? statsService.fetchEntityStats(user.id, 'album', albumId).catch(() => 0) : Promise.resolve(0),
      statsService.fetchEntityStreams(user.id, 'track', trackId, 240).catch(() => []),
    ]).then(([artist, trackCount, album, history]) => {
      if (cancelled) return;
      setEntityStats({ artist, track: trackCount, album });
      setTrackHistory(summarizeTrackHistory(history, user?.nowPlaying?.timestamp));
    });

    return () => {
      cancelled = true;
    };
  }, [albumId, artistId, trackId, user?.id, user?.nowPlaying?.timestamp]);

  const ranking = React.useMemo(() => {
    if (!trackId) return [];
    return members
      .map(member => ({
        user: member,
        count: userTrackStats[`${member.id}:${trackId}`] || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [members, trackId, userTrackStats]);

  const handleLyrics = async () => {
    if (!track?.name || !lyricsMatch?.hasLyrics) return;
    setLyricsLoading(true);
    const response = await statsService.fetchLyricsFull(track.name, artistName);
    setLyricsLoading(false);
    if (response.lyrics) {
      setLyricsText(response.lyrics);
      setPanel('lyrics');
      return;
    }
    const url = response.match?.url || lyricsMatch.match?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!track && !user) return null;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        className="pointer-events-auto relative mb-6 mb-[calc(env(safe-area-inset-bottom)+12px)] mr-4 flex h-[74px] w-[74px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-black/[0.22] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
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
                if (info.offset.x < -58 && lyricsMatch?.hasLyrics) {
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
                <div className="rounded-[22px] bg-white/[0.045] p-3">
                  <UserCircle className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/34">Artista</span>
                  <strong className="mt-1 block text-2xl font-black tabular-nums text-white"><AnimatedNumber value={entityStats.artist} /></strong>
                </div>
                <div className="rounded-[22px] bg-white/[0.045] p-3">
                  <ListMusic className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/34">Faixa</span>
                  <strong className="mt-1 block text-2xl font-black tabular-nums text-white"><AnimatedNumber value={entityStats.track || userTrackStats[`${user?.id}:${trackId}`] || 0} /></strong>
                </div>
                <div className="rounded-[22px] bg-white/[0.045] p-3">
                  <Disc3 className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/34">Álbum</span>
                  <strong className="mt-1 block text-2xl font-black tabular-nums text-white"><AnimatedNumber value={entityStats.album} /></strong>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-[20px] bg-black/18 p-3">
                  <span className="text-[7px] font-black uppercase tracking-[0.16em] text-white/30">1ª vez</span>
                  <span className="mt-1 block text-[11px] font-black leading-tight text-white/76">{formatShortDate(trackHistory.firstPlayedAt)}</span>
                </div>
                <div className="rounded-[20px] bg-black/18 p-3">
                  <span className="text-[7px] font-black uppercase tracking-[0.16em] text-white/30">última</span>
                  <span className="mt-1 block text-[11px] font-black leading-tight text-white/76">{formatShortDate(trackHistory.lastPlayedAt)}</span>
                </div>
                <div className="rounded-[20px] bg-black/18 p-3">
                  <span className="text-[7px] font-black uppercase tracking-[0.16em] text-white/30">ano pico</span>
                  <span className="mt-1 block text-[11px] font-black leading-tight text-white/76">
                    {trackHistory.bestYear ? `${trackHistory.bestYear} · ${trackHistory.bestYearCount}` : 'sem registro'}
                  </span>
                </div>
              </div>

              {trackLinks.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {trackLinks.map((link) => <CopyableLinkButton key={link.label} label={link.label} url={link.url} />)}
                </div>
              )}

              {ranking.length > 0 && (
                <div className="mt-4 flex items-end gap-2 overflow-x-auto no-scrollbar pb-1 opacity-55" data-home-horizontal-scroll="true">
                  {ranking.map((item, index) => (
                    <div key={item.user.id} className="flex shrink-0 flex-col items-center gap-1">
                      <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-black">
                        <SmartImage src={coreUtils.getUserAvatar(item.user.id, item.user.avatar)} className="h-full w-full object-cover" rounded="full" fallback="" />
                      </div>
                      <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-black", index === 0 ? "bg-orange-500 text-white" : "bg-white/[0.08] text-white/72")}>
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {lyricsMatch?.hasLyrics && (
                <button
                  type="button"
                  onClick={handleLyrics}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/72 transition-colors hover:bg-white/[0.1] hover:text-white"
                >
                  {lyricsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : lyricsText ? <FileText className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                  Letra
                </button>
              )}

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
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const [homeReady, setHomeReady] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return window.__STATS_LC_HOME_READY__ === true || sessionStorage.getItem('stats-lc-home-boot-ready') === '1';
  });
  
  const allUsers = React.useMemo(() => {
    return getCanonicalMembers(groupStats);
  }, [groupStats]);

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

  const playingUser = React.useMemo(() => {
    return activeMembersSorted[0] || groupStats?.users[featuredUserId] || allUsers[0];
  }, [activeMembersSorted, groupStats?.users, featuredUserId, allUsers]);

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
                  ? "bg-transparent border-none shadow-none h-10 gap-2 max-w-[95vw]"
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
                      ? "overflow-x-auto no-scrollbar w-[min(95vw,456px)] py-1.5 px-0.5 gap-2" 
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
                          shouldShowExpanded && "bg-white/[0.07] hover:bg-white/[0.12] pr-3.5 pl-1.5 py-1.5 rounded-full border border-white/10 backdrop-blur-xl shadow-xl hover:scale-[1.02] active:scale-[0.98]",
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
                              className="flex w-[140px] flex-col overflow-hidden text-left"
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

        <div className="flex w-full max-w-[460px] items-end justify-center gap-2 px-2">
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
