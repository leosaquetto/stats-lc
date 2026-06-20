/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AudioLines,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Disc3,
  ExternalLink,
  Flame,
  Headphones,
  History,
  Link2,
  ListMusic,
  Loader2,
  Play,
  Radio,
  Repeat2,
  Share2,
  Sparkles,
  Trophy,
  UserCircle,
  UsersRound,
  X,
} from 'lucide-react';
import { statsService, type TrackStoryResponse } from '../../services/statsService';
import { coreUtils } from '../../services/statsCore';
import { useStatsStore } from '../../store/useStatsStore';
import { getCanonicalMembers, getVisibleMembers } from '../../lib/memberSelectors';
import { getMainArtist, getMainArtistName, getSecondaryArtists } from '../../lib/artistUtils';
import { readRuntimeCacheEntry, setRuntimeCacheEntry } from '../../lib/memoryRuntime';
import { motionRuntime as motionRuntimeScheduler } from '../../lib/motionRuntime';
import { useMotionRuntime } from '../../hooks/useMotionRuntime';
import { useModalMotionScope } from '../../hooks/useModalMotionScope';
import { SmartImage, Skeleton } from '../shared/CommonUI';
import { clsx } from 'clsx';

type TrackLeaderboardModalProps = {
  track: any;
  userId?: string;
  playback?: any;
  onClose: () => void;
  onArtistClick?: (artist: any) => void;
};

type PlaybackEntry = {
  key: string;
  track: any;
  playback?: any;
};

type StoryArtist = {
  id: string;
  key: string;
  name: string;
  image: string;
  count: number;
};

type StoryRankingEntry = {
  user: any;
  count: number;
  position: number;
};

const STORY_CACHE_TTL = 15 * 60 * 1000;
const storyCache = new Map<string, { expiresAt: number; data: TrackStoryResponse }>();
const storyInFlight = new Map<string, Promise<TrackStoryResponse>>();

const firstExternalId = (value: any) => {
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item.trim()) || '';
  return typeof value === 'string' ? value : '';
};

const parseDateMs = (value: any) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (/^\d+$/.test(trimmed) && Number.isFinite(numeric)) return numeric;
    const parsed = new Date(trimmed).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const getReleaseDayKey = (value: any) => {
  const time = parseDateMs(value);
  if (!time) return '';
  const date = new Date(time);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

const formatCatalogDate = (value: any) => {
  const dayKey = getReleaseDayKey(value);
  if (!dayKey) return '—';
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
};

const formatDate = (value: any) => {
  const time = parseDateMs(value);
  if (!time) return '—';
  return new Date(time).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
};

const formatContextTime = (value: any, isLive?: boolean) => {
  if (isLive) return 'AGORA';
  const time = parseDateMs(value);
  if (!time) return 'RECENTE';
  const date = new Date(time);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const clock = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (day === today) return `HOJE, ${clock}`;
  if (day === today - 86_400_000) return `ONTEM, ${clock}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${clock}`;
};

const getAlbumId = (track: any) => String(
  track?.albumId
  || track?.album?.id
  || (Array.isArray(track?.albums) ? track.albums[0]?.id : '')
  || ''
);

const getAlbumName = (track: any) => (
  track?.albumName
  || track?.album?.name
  || (Array.isArray(track?.albums) ? track.albums[0]?.name : '')
  || ''
);

const getAlbumImage = (track: any) => (
  track?.albumImage
  || track?.album?.image
  || (Array.isArray(track?.albums) ? track.albums[0]?.image : '')
  || track?.image
  || ''
);

const getReleaseDate = (track: any) => {
  const firstAlbum = Array.isArray(track?.albums) ? track.albums[0] : undefined;
  return [
    track?.album?.releaseDate,
    track?.album?.releasedAt,
    track?.album?.release_date,
    firstAlbum?.releaseDate,
    firstAlbum?.releasedAt,
    firstAlbum?.release_date,
    track?.albumReleaseDate,
    track?.releaseDate,
    track?.releasedAt,
  ].find((value) => (
    typeof value === 'number'
      ? Number.isFinite(value) && value > 0
      : typeof value === 'string' && value.trim().length > 0
  )) || '';
};

const getPlaybackTimestamp = (playback: any) => (
  playback?.playedAt
  || playback?.timestamp
  || playback?.endTime
  || playback?.date
  || playback?.createdAt
  || ''
);

const getArtistOptions = (track: any) => {
  const main = getMainArtist(track);
  const mainName = getMainArtistName(track);
  const options = [
    main ? {
      ...main,
      id: String(main.id || track?.artistId || ''),
      name: mainName,
      image: main.image || main.avatar || track?.artist?.image || '',
    } : null,
    ...getSecondaryArtists(track).map((artist: any) => (
      typeof artist === 'string'
        ? { id: '', name: artist, image: '' }
        : {
            ...artist,
            id: String(artist.id || ''),
            name: artist.name || artist.artistName || '',
            image: artist.image || artist.avatar || '',
          }
    )),
  ].filter((artist): artist is any => Boolean(artist?.name));

  const seen = new Set<string>();
  return options.filter((artist) => {
    const key = artist.id || artist.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getStoryKey = (track: any, userId: string, playback?: any) => {
  const artists = getArtistOptions(track).map((artist) => artist.id).filter(Boolean).sort().join('|');
  return [
    userId,
    track?.id || '',
    getAlbumId(track),
    artists,
    getPlaybackTimestamp(playback),
  ].join(':');
};

const readStoryCache = (key: string) => {
  const cached = readRuntimeCacheEntry(storyCache, key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    storyCache.delete(key);
    return null;
  }
  return cached.data;
};

const loadTrackStory = (track: any, userId: string, playback?: any) => {
  const key = getStoryKey(track, userId, playback);
  const cached = readStoryCache(key);
  if (cached) return Promise.resolve(cached);
  const running = readRuntimeCacheEntry(storyInFlight, key);
  if (running) return running;

  const promise = statsService.fetchTrackStory({
    userId,
    trackId: String(track?.id || ''),
    albumId: getAlbumId(track) || undefined,
    artistIds: getArtistOptions(track).map((artist) => artist.id).filter(Boolean),
    releaseDate: getReleaseDate(track) || undefined,
    currentPlayedAt: getPlaybackTimestamp(playback) || undefined,
  }).then((story) => {
    setRuntimeCacheEntry(storyCache, key, {
      data: story,
      expiresAt: Date.now() + STORY_CACHE_TTL,
    }, 'medium');
    return story;
  }).finally(() => storyInFlight.delete(key));

  setRuntimeCacheEntry(storyInFlight, key, promise, 'small');
  return promise;
};

export const preloadTrackLeaderboardStats = (
  track: any,
  members: any[],
  userId?: string,
  playback?: any,
) => {
  const targetUserId = userId || members[0]?.id || '';
  if (!track?.id || !targetUserId) return Promise.resolve(null);
  return loadTrackStory(track, targetUserId, playback).catch(() => null);
};

const normalizeRecentEntries = (user: any) => {
  const source = Array.isArray(user?.recent)
    ? user.recent
    : Array.isArray(user?.history)
      ? user.history
      : [];
  return source
    .map((item: any) => statsService.normalizeRecentStream(item))
    .filter((item: any) => item?.track?.name)
    .map((item: any, index: number): PlaybackEntry => ({
      key: `${item.track.id || item.track.name}:${getPlaybackTimestamp(item) || index}`,
      track: item.track,
      playback: item,
    }));
};

const buildPlaybackEntries = (track: any, playback: any, user: any, cachedRecent: any[]) => {
  const normalizedCached = (cachedRecent || [])
    .map((item: any) => statsService.normalizeRecentStream(item))
    .filter((item: any) => item?.track?.name)
    .map((item: any, index: number): PlaybackEntry => ({
      key: `${item.track.id || item.track.name}:${getPlaybackTimestamp(item) || `cache-${index}`}`,
      track: item.track,
      playback: item,
    }));
  const current: PlaybackEntry = {
    key: `current:${track?.id || track?.name}:${getPlaybackTimestamp(playback)}`,
    track,
    playback,
  };
  const entries = [current, ...normalizeRecentEntries(user), ...normalizedCached];
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const identity = `${String(entry.track?.name || entry.track?.id || '').trim().toLowerCase()}:${getPlaybackTimestamp(entry.playback)}`;
    if (!entry.track?.name || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).slice(0, 20);
};

const getTrackLinks = (track: any) => {
  const spotifyId = track?.spotifyId || firstExternalId(track?.externalIds?.spotify);
  const appleMusicId = track?.appleMusicId || firstExternalId(track?.externalIds?.appleMusic);
  const statsId = track?.id || track?.statsfmId;
  return {
    stats: statsId ? `https://stats.fm/track/${statsId}` : '',
    spotify: spotifyId ? `https://open.spotify.com/track/${spotifyId}` : '',
    apple: appleMusicId ? `https://music.apple.com/song/${appleMusicId}` : '',
  };
};

const getPreferredMusicLink = (user: any, links: ReturnType<typeof getTrackLinks>) => {
  const platform = JSON.stringify(user?.platform || '').toLowerCase();
  if (platform.includes('apple') && links.apple) return links.apple;
  if (platform.includes('spotify') && links.spotify) return links.spotify;
  return links.spotify || links.apple;
};

const Section = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={clsx(
    'min-w-0 rounded-[22px] border border-white/[0.09] bg-[#0d0e11]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_12px_30px_rgba(0,0,0,0.24)]',
    className,
  )}>
    {children}
  </div>
);

const SectionHeading = ({
  icon: Icon,
  children,
  accent = false,
}: {
  icon: typeof Trophy;
  children: React.ReactNode;
  accent?: boolean;
}) => (
  <div className={clsx('flex items-center gap-2', accent ? 'text-orange-400' : 'text-white/56')}>
    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} />
    <span className="text-[10px] font-black uppercase tracking-[0.13em]">{children}</span>
  </div>
);

const StoryLoading = () => (
  <div className="space-y-2.5" aria-label="Carregando história da faixa">
    <Skeleton className="h-20 w-full" rounded="3xl" />
    <Skeleton className="h-36 w-full" rounded="3xl" />
    <Skeleton className="h-28 w-full" rounded="3xl" />
    <div className="grid grid-cols-2 gap-2.5">
      <Skeleton className="h-36 w-full" rounded="3xl" />
      <Skeleton className="h-36 w-full" rounded="3xl" />
    </div>
  </div>
);

const TimelineNode = ({
  icon: Icon,
  label,
  value,
  detail,
  accent,
  shouldAnimate,
  index,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  detail?: string;
  accent?: 'orange' | 'violet';
  shouldAnimate: boolean;
  index: number;
}) => (
  <motion.div
    initial={shouldAnimate ? { opacity: 0, scale: 0.78, y: 5 } : false}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ duration: shouldAnimate ? 0.28 : 0.01, delay: shouldAnimate ? 0.08 + index * 0.055 : 0 }}
    className="relative z-10 flex min-w-0 flex-col items-center text-center"
  >
    <div className={clsx(
      'flex h-10 w-10 items-center justify-center rounded-full border bg-[#0b0c0f] shadow-[0_0_20px_rgba(249,115,22,0.12)]',
      accent === 'violet'
        ? 'border-violet-400/65 text-violet-300 shadow-[0_0_22px_rgba(168,85,247,0.22)]'
        : 'border-orange-500/65 text-orange-400',
    )}>
      <Icon className="h-4 w-4" strokeWidth={2} />
    </div>
    <span className="mt-2 text-[7px] font-black uppercase tracking-[0.08em] text-white/42">{label}</span>
    <span className={clsx(
      'mt-1 text-[11px] font-semibold tabular-nums',
      accent === 'violet' ? 'text-violet-300' : 'text-white/72',
    )}>
      {value}
    </span>
    {detail ? <span className="mt-0.5 text-[7px] text-white/36">{detail}</span> : null}
  </motion.div>
);

const WrappedChart = ({
  wrapped,
  shouldAnimate,
}: {
  wrapped: NonNullable<TrackStoryResponse['history']['wrapped']>;
  shouldAnimate: boolean;
}) => {
  const max = Math.max(...wrapped.periods.map((period) => period.count), 1);
  return (
    <Section className="p-3.5">
      <SectionHeading icon={CalendarDays}>Wrapped</SectionHeading>
      <div className="mt-3 grid h-[102px] grid-cols-3 items-end gap-3">
        {wrapped.periods.slice(0, 3).map((period, index) => (
          <div key={period.key} className="flex min-w-0 flex-col items-center">
            <span className="mb-1 text-[10px] font-black tabular-nums text-white/82">
              {coreUtils.formatNumber(period.count)}
            </span>
            <div className="flex h-12 w-full items-end justify-center border-b border-white/[0.06]">
              <motion.div
                initial={shouldAnimate ? { scaleY: 0 } : false}
                animate={{ scaleY: Math.max(0.18, period.count / max) }}
                transition={{ duration: shouldAnimate ? 0.42 : 0.01, delay: shouldAnimate ? 0.1 + index * 0.06 : 0 }}
                className={clsx(
                  'h-full w-[70%] origin-bottom rounded-t-[10px] border',
                  period.highlight
                    ? 'border-orange-400/45 bg-gradient-to-t from-orange-700/65 to-orange-400/88 shadow-[0_0_18px_rgba(249,115,22,0.18)]'
                    : 'border-white/[0.10] bg-gradient-to-t from-white/[0.05] to-white/[0.17]',
                )}
              />
            </div>
            <span className="mt-1.5 line-clamp-2 text-center text-[7px] font-black uppercase leading-[1.2] tracking-[0.06em] text-white/44">
              {period.label}
            </span>
            {period.highlight ? <Crown className="mt-1 h-3.5 w-3.5 text-orange-400" /> : null}
          </div>
        ))}
      </div>
    </Section>
  );
};

const GroupRing = ({
  percent,
  total,
}: {
  percent: number;
  total: number;
}) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <div className="text-[24px] font-black leading-none tabular-nums text-white">
        {coreUtils.formatNumber(total)}
      </div>
      <div className="mt-1 text-[8px] font-semibold text-white/44">plays totais</div>
    </div>
    <div
      className="relative flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#ff7919 ${percent * 3.6}deg, rgba(255,255,255,0.10) 0deg)` }}
      role="img"
      aria-label={`${percent}% das reproduções do grupo são suas`}
    >
      <div className="flex h-[56px] w-[56px] flex-col items-center justify-center rounded-full bg-[#0d0e11]">
        <span className="text-[17px] font-black tabular-nums text-white">{percent}%</span>
        <span className="text-[7px] text-white/46">da faixa</span>
      </div>
    </div>
  </div>
);

export const TrackLeaderboardModal = ({
  track,
  userId,
  playback,
  onClose,
  onArtistClick,
}: TrackLeaderboardModalProps) => {
  const groupStats = useStatsStore((state) => state.groupStats);
  const hiddenUsers = useStatsStore((state) => state.hiddenUsers);
  const featuredUserId = useStatsStore((state) => state.featuredUserId);
  const getHistoryCache = useStatsStore((state) => state.getHistoryCache);
  const allMembers = useMemo(() => getCanonicalMembers(groupStats), [groupStats]);
  const visibleMembers = useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);
  const targetUserId = userId || featuredUserId || visibleMembers[0]?.id || '';
  const targetUser = allMembers.find((member) => member.id === targetUserId) || visibleMembers[0];
  const cachedRecent = targetUserId ? getHistoryCache(targetUserId) || [] : [];
  const resolvedInitialPlayback = useMemo(() => {
    if (playback) return playback;
    const currentTrack = targetUser?.nowPlaying?.track;
    const sameTrack = currentTrack?.id && track?.id
      ? String(currentTrack.id) === String(track.id)
      : currentTrack?.name && track?.name && currentTrack.name === track.name;
    return sameTrack ? targetUser?.nowPlaying : undefined;
  }, [playback, targetUser?.nowPlaying, track?.id, track?.name]);
  const entries = useMemo(
    () => buildPlaybackEntries(track, resolvedInitialPlayback, targetUser, cachedRecent),
    [cachedRecent, resolvedInitialPlayback, targetUser, track],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [story, setStory] = useState<TrackStoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentPickerOpen, setRecentPickerOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const statusCancelRef = useRef<() => void>(() => {});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const runtime = useMotionRuntime();
  const shouldAnimate = runtime.canRunMotion && runtime.tier !== 'conserve';
  useModalMotionScope();

  const activeEntry = entries[Math.min(activeIndex, Math.max(0, entries.length - 1))] || {
    key: 'current',
    track,
    playback: resolvedInitialPlayback,
  };
  const activeTrack = activeEntry.track;
  const activePlayback = activeEntry.playback;
  const activeArtists = useMemo(() => getArtistOptions(activeTrack), [activeTrack]);
  const albumName = getAlbumName(activeTrack);
  const albumImage = getAlbumImage(activeTrack);
  const storyKey = getStoryKey(activeTrack, targetUserId, activePlayback);
  const visibleMemberIds = useMemo(
    () => new Set(visibleMembers.map((member) => member.id)),
    [visibleMembers],
  );

  useEffect(() => {
    if (activeIndex < entries.length) return;
    setActiveIndex(0);
  }, [activeIndex, entries.length]);

  useEffect(() => {
    let cancelled = false;
    if (!activeTrack?.id || !targetUserId) {
      setStory(null);
      setLoading(false);
      setError('Esta faixa ainda não possui identidade suficiente para carregar a história.');
      return;
    }

    const cached = readStoryCache(storyKey);
    if (cached) {
      setStory(cached);
      setLoading(false);
      setError('');
      return;
    }

    setStory(null);
    setLoading(true);
    setError('');
    loadTrackStory(activeTrack, targetUserId, activePlayback)
      .then((response) => {
        if (cancelled) return;
        setStory(response);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar a história completa desta faixa agora.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activePlayback, activeTrack, storyKey, targetUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [storyKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const body = document.body;
    const lockedScrollY = window.scrollY;
    const previousOverflow = body.style.overflow;
    const previousOverscroll = body.style.overscrollBehavior;
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    const preventOutsideScroll = (event: WheelEvent | TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-track-leaderboard-scroll="true"]')) return;
      event.preventDefault();
    };

    document.addEventListener('wheel', preventOutsideScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', preventOutsideScroll, { passive: false, capture: true });
    return () => {
      document.removeEventListener('wheel', preventOutsideScroll, true);
      document.removeEventListener('touchmove', preventOutsideScroll, true);
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscroll;
      window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'auto' });
    };
  }, []);

  useEffect(() => () => statusCancelRef.current(), []);

  const notify = (message: string) => {
    statusCancelRef.current();
    setStatusMessage(message);
    statusCancelRef.current = motionRuntimeScheduler.scheduleTask(
      () => setStatusMessage(''),
      1800,
      'interaction',
      'track-leaderboard-status-dismiss',
    );
  };

  const chooseEntry = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= entries.length || nextIndex === activeIndex) return;
    setDirection(nextIndex > activeIndex ? 1 : -1);
    setActiveIndex(nextIndex);
    setRecentPickerOpen(false);
  };

  const openArtist = (artist: any) => {
    if (!onArtistClick) return;
    onClose();
    motionRuntimeScheduler.scheduleTask(
      () => onArtistClick(artist),
      shouldAnimate ? 250 : 20,
      'interaction',
      'track-leaderboard-open-artist',
    );
  };

  const openLyrics = () => {
    onClose();
    motionRuntimeScheduler.scheduleTask(() => {
      window.dispatchEvent(new CustomEvent('stats-lc-open-track-stats', {
        detail: {
          panel: 'lyrics',
          userId: targetUserId,
          track: activeTrack,
          playback: activePlayback,
        },
      }));
    }, shouldAnimate ? 250 : 20, 'interaction', 'track-leaderboard-open-lyrics');
  };

  const shareTrack = async () => {
    const artistName = activeArtists.map((artist) => artist.name).join(' & ');
    const text = `${activeTrack?.name || 'Faixa'} — ${artistName}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: activeTrack?.name || 'stats.lc', text, url: window.location.href });
        notify('Faixa compartilhada');
        return;
      }
      await navigator.clipboard?.writeText(`${text} ${window.location.href}`);
      notify('Link copiado');
    } catch (shareError: any) {
      if (shareError?.name !== 'AbortError') notify('Compartilhamento indisponível');
    }
  };

  const links = getTrackLinks(activeTrack);
  const preferredMusicLink = getPreferredMusicLink(targetUser, links);
  const ranking = useMemo<StoryRankingEntry[]>(() => {
    if (!story) return [];
    return story.social.ranking
      .filter((entry) => visibleMemberIds.has(entry.id))
      .map((entry) => ({
        user: visibleMembers.find((member) => member.id === entry.id || (member as any).key === entry.key)
          || { id: entry.id, name: entry.key || entry.id, avatar: '' },
        count: entry.count,
        position: 0,
      }))
      .sort((a, b) => b.count - a.count)
      .map((entry, index) => ({ ...entry, position: index + 1 }));
  }, [story, visibleMemberIds, visibleMembers]);
  const ownRank = ranking.find((entry) => entry.user?.id === targetUserId);
  const visibleRanking = ownRank && ownRank.position > 5
    ? [...ranking.slice(0, 4), ownRank]
    : ranking.slice(0, 5);
  const groupTotal = ranking.reduce((total, entry) => total + entry.count, 0);
  const ownTrackCount = story?.counts.track || 0;
  const groupPercent = groupTotal > 0
    ? Math.max(0, Math.min(100, Math.round((ownTrackCount / groupTotal) * 100)))
    : Math.max(0, Math.min(100, Math.round(story?.social.cakePiecePercent || 0)));
  const artistCountById = new Map((story?.counts.artists || []).map((artist) => [artist.id, artist.count || 0]));
  const storyArtists: StoryArtist[] = activeArtists.map((artist, index) => ({
    id: artist.id,
    key: artist.id || `${artist.name}-${index}`,
    name: artist.name,
    image: artist.image || (index === 0 ? activeTrack?.artist?.image : ''),
    count: artistCountById.get(artist.id) || 0,
  }));
  const socialSource = story?.social.releaseListeners?.length
    ? story.social.releaseListeners
    : story?.social.firstListeners || [];
  const socialEntries = socialSource
    .filter((entry) => visibleMemberIds.has(entry.id))
    .map((entry) => ({
      ...entry,
      user: visibleMembers.find((member) => member.id === entry.id || (member as any).key === entry.key),
    }))
    .filter((entry) => entry.user);
  const socialLabel = story?.social.releaseListeners?.length
    ? socialEntries.length === 1 ? 'Ouviu no lançamento' : 'Ouviram no lançamento'
    : socialEntries.length === 1 ? 'Ouviu primeiro' : 'Ouviram primeiro';
  const showAdvanced = ownTrackCount > 10 && Boolean(story?.advanced);
  const showWrapped = Boolean(story?.history.wrapped);
  const showRanking = ranking.length > 0;
  const timelineItems = story ? [
    {
      icon: CalendarDays,
      label: 'Release',
      value: formatCatalogDate(getReleaseDate(activeTrack)),
      accent: 'orange' as const,
    },
    {
      icon: Play,
      label: 'Primeiro play',
      value: formatDate(story.history.firstPlayedAt),
      accent: 'orange' as const,
    },
    ...(showAdvanced && story.advanced?.loopFactor ? [{
      icon: Repeat2,
      label: 'Looping day',
      value: `${story.advanced.loopFactor.count}x`,
      detail: formatDate(`${story.advanced.loopFactor.day}T12:00:00.000Z`),
      accent: 'violet' as const,
    }] : []),
    {
      icon: History,
      label: 'Último play',
      value: formatDate(story.history.previousPlayedAt || story.history.lastPlayedAt),
      accent: 'orange' as const,
    },
  ] : [];

  return (
    <motion.div
      data-stats-lc-modal-surface="true"
      initial={shouldAnimate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldAnimate ? 0.18 : 0.01 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/82 p-1 backdrop-blur-[18px]"
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={`História competitiva de ${activeTrack?.name || 'faixa'}`}
        initial={shouldAnimate ? { opacity: 0, y: 18, scale: 0.975 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={shouldAnimate ? { opacity: 0, y: 22, scale: 0.98 } : { opacity: 0 }}
        transition={{ duration: shouldAnimate ? 0.28 : 0.01, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex h-[calc(100svh-8px)] max-h-[760px] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-white/[0.11] bg-[#08090b]/96 shadow-[0_34px_90px_rgba(0,0,0,0.72)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_24%_10%,rgba(249,115,22,0.14),transparent_48%)]" />

        <div className="relative z-20 shrink-0 border-b border-white/[0.07] bg-[#08090b]/94 px-3 pb-3 pt-3 backdrop-blur-xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeEntry.key}
              initial={shouldAnimate ? { opacity: 0, x: direction * 24 } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldAnimate ? { opacity: 0, x: direction * -18 } : { opacity: 0 }}
              transition={{ duration: shouldAnimate ? 0.24 : 0.01, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-[88px_minmax(0,1fr)_84px] items-center gap-3 pr-8"
            >
              <SmartImage
                src={albumImage}
                className="h-[88px] w-[88px] border border-white/[0.10] object-cover shadow-[0_14px_30px_rgba(0,0,0,0.48)]"
                rounded="[22px]"
                fallback={activeTrack?.name || ''}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.15em] text-white/46">
                  <span className="truncate">{formatContextTime(getPlaybackTimestamp(activePlayback), activePlayback?.isLive)}</span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                </div>
                <h2 className="mt-2 line-clamp-2 text-[21px] font-black leading-[0.95] text-white font-display">
                  {activeTrack?.name || 'Faixa'}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-1 text-[10px] font-black leading-tight text-orange-400">
                  {activeArtists.map((artist, index) => (
                    <React.Fragment key={artist.id || `${artist.name}-${index}`}>
                      {index > 0 ? <span className="text-white/24">&</span> : null}
                      <button
                        type="button"
                        onClick={() => openArtist(artist)}
                        className="transition-colors hover:text-orange-200"
                      >
                        {artist.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                {albumName ? (
                  <p className="mt-2 truncate text-[8px] font-black uppercase tracking-[0.16em] text-white/35">{albumName}</p>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                {loading ? (
                  <>
                    <Skeleton className="h-8 w-full" rounded="xl" />
                    <Skeleton className="h-8 w-full" rounded="xl" />
                  </>
                ) : (
                  <>
                    {story?.advanced?.top1kPosition ? (
                      <div className="flex min-w-0 items-center justify-between rounded-[13px] border border-white/[0.10] bg-white/[0.025] px-2 py-2">
                        <Trophy className="h-3.5 w-3.5 text-orange-400" />
                        <span className="text-[6px] font-black uppercase text-white/50">Top 1K</span>
                        <span className="text-[10px] font-black tabular-nums text-orange-400">#{story.advanced.top1kPosition}</span>
                      </div>
                    ) : null}
                    {story?.advanced?.topYearPosition ? (
                      <div className="flex min-w-0 items-center justify-between rounded-[13px] border border-white/[0.10] bg-white/[0.025] px-2 py-2">
                        <Flame className="h-3.5 w-3.5 text-orange-400" />
                        <span className="text-[6px] font-black uppercase text-white/50">Top ano</span>
                        <span className="text-[10px] font-black tabular-nums text-orange-400">
                          #{String(story.advanced.topYearPosition).padStart(2, '0')}
                        </span>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.10] bg-black/35 text-white/56 transition-[background-color,color,transform] hover:bg-white/[0.08] hover:text-white active:scale-90"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={scrollRef}
          data-track-leaderboard-scroll="true"
          className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 custom-scrollbar [touch-action:pan-y]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`body-${activeEntry.key}`}
              initial={shouldAnimate ? { opacity: 0, x: direction * 18 } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldAnimate ? { opacity: 0, x: direction * -14 } : { opacity: 0 }}
              transition={{ duration: shouldAnimate ? 0.24 : 0.01, ease: [0.16, 1, 0.3, 1] }}
            >
              {loading ? <StoryLoading /> : error || !story ? (
                <Section className="flex min-h-44 flex-col items-center justify-center p-5 text-center">
                  <Radio className="h-8 w-8 text-orange-400/70" />
                  <p className="mt-3 max-w-[250px] text-[11px] font-bold leading-relaxed text-white/62">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      storyCache.delete(storyKey);
                      setLoading(true);
                      setError('');
                      loadTrackStory(activeTrack, targetUserId, activePlayback)
                        .then(setStory)
                        .catch(() => setError('Não foi possível carregar a história completa desta faixa agora.'))
                        .finally(() => setLoading(false));
                    }}
                    className="mt-4 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-orange-300"
                  >
                    Tentar novamente
                  </button>
                </Section>
              ) : (
                <div className="space-y-2.5">
                  {socialEntries.length > 0 ? (
                    <motion.div
                      initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: shouldAnimate ? 0.24 : 0.01, delay: shouldAnimate ? 0.03 : 0 }}
                    >
                      <Section className="flex items-center justify-between gap-3 border-orange-400/20 bg-[linear-gradient(110deg,rgba(249,115,22,0.09),rgba(13,14,17,0.94)_54%)] px-4 py-3">
                        <SectionHeading icon={Headphones} accent>{socialLabel}</SectionHeading>
                        <div className="flex min-w-0 items-center">
                          <div className="flex -space-x-2">
                            {socialEntries.slice(0, 5).map((entry) => (
                              <SmartImage
                                key={entry.id}
                                src={coreUtils.getUserAvatar(entry.user.id, entry.user.avatar)}
                                className="h-8 w-8 rounded-full border border-white/14 object-cover"
                                rounded="full"
                                fallback={entry.user.name}
                              />
                            ))}
                          </div>
                          {socialEntries.length > 5 ? (
                            <span className="ml-2 text-[11px] font-black text-orange-400">+{socialEntries.length - 5}</span>
                          ) : null}
                        </div>
                      </Section>
                    </motion.div>
                  ) : null}

                  <motion.div
                    initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: shouldAnimate ? 0.24 : 0.01, delay: shouldAnimate ? 0.06 : 0 }}
                  >
                    <Section className="p-4">
                      <SectionHeading icon={AudioLines}>Sua história</SectionHeading>
                      <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.09]">
                        <div className="min-w-0 pr-3">
                          <div className="text-[29px] font-black leading-none tabular-nums text-white">
                            {coreUtils.formatNumber(story.counts.track || 0)}
                          </div>
                          <div className="mt-2 text-[9px] leading-relaxed text-white/48">plays<br />desta faixa</div>
                        </div>
                        <div className="min-w-0 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-400/35 text-violet-300">
                              <UserCircle className="h-4 w-4" />
                            </div>
                            <span className="text-[18px] font-black tabular-nums text-white">
                              {coreUtils.formatNumber(story.counts.artists[0]?.count || 0)}
                            </span>
                          </div>
                          <div className="mt-2 flex min-w-0 items-center gap-2">
                            <SmartImage
                              src={storyArtists[0]?.image}
                              className="h-7 w-7 shrink-0 rounded-full object-cover"
                              rounded="full"
                              fallback=""
                            />
                            <span className="truncate text-[8px] text-white/48">{storyArtists[0]?.name || 'Artista'}</span>
                          </div>
                        </div>
                        <div className="min-w-0 pl-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-400/35 text-orange-400">
                              <Disc3 className="h-4 w-4" />
                            </div>
                            <span className="text-[18px] font-black tabular-nums text-white">
                              {coreUtils.formatNumber(story.counts.album || 0)}
                            </span>
                          </div>
                          <div className="mt-2 flex min-w-0 items-center gap-2">
                            <SmartImage
                              src={albumImage}
                              className="h-7 w-7 shrink-0 object-cover"
                              rounded="[8px]"
                              fallback=""
                            />
                            <span className="truncate text-[8px] text-white/48">{albumName || 'Álbum'}</span>
                          </div>
                        </div>
                      </div>
                    </Section>
                  </motion.div>

                  <motion.div
                    initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: shouldAnimate ? 0.24 : 0.01, delay: shouldAnimate ? 0.09 : 0 }}
                  >
                    <Section className="overflow-hidden p-4">
                      <SectionHeading icon={Clock3}>Linha do tempo</SectionHeading>
                      <div className="relative mt-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${timelineItems.length}, minmax(0, 1fr))` }}>
                        <motion.div
                          initial={shouldAnimate ? { scaleX: 0 } : false}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: shouldAnimate ? 0.4 : 0.01, delay: shouldAnimate ? 0.08 : 0 }}
                          className="absolute left-[10%] right-[10%] top-5 h-px origin-left bg-gradient-to-r from-orange-500/70 via-violet-400/70 to-orange-500/70"
                        />
                        {timelineItems.map((item, index) => (
                          <TimelineNode
                            key={item.label}
                            {...item}
                            shouldAnimate={shouldAnimate}
                            index={index}
                          />
                        ))}
                      </div>
                    </Section>
                  </motion.div>

                  <div className={clsx(
                    'grid min-w-0 gap-2.5',
                    showWrapped && showAdvanced ? 'grid-cols-2' : 'grid-cols-1',
                  )}>
                    {story.history.wrapped ? (
                      <motion.div
                        initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: shouldAnimate ? 0.24 : 0.01, delay: shouldAnimate ? 0.12 : 0 }}
                      >
                        <WrappedChart wrapped={story.history.wrapped} shouldAnimate={shouldAnimate} />
                      </motion.div>
                    ) : null}
                    {showAdvanced && story.advanced ? (
                      <motion.div
                        initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: shouldAnimate ? 0.24 : 0.01, delay: shouldAnimate ? 0.15 : 0 }}
                      >
                        <Section className="h-full overflow-hidden p-3.5">
                          <SectionHeading icon={Sparkles}>Insights</SectionHeading>
                          <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.09] text-center">
                            <div className="min-w-0 px-1">
                              <Flame className="mx-auto h-5 w-5 text-orange-400" />
                              <div className="mt-2 text-[18px] font-black tabular-nums">{story.advanced.streak.days || 0}</div>
                              <div className="mt-1 text-[7px] leading-tight text-white/42">dias<br />seguidos</div>
                            </div>
                            <div className="min-w-0 px-1">
                              <Repeat2 className="mx-auto h-5 w-5 text-violet-300" />
                              <div className="mt-2 text-[18px] font-black tabular-nums">{story.advanced.loopFactor?.count || 0}x</div>
                              <div className="mt-1 text-[7px] leading-tight text-white/42">em um<br />dia</div>
                            </div>
                            <div className="min-w-0 px-1">
                              <Clock3 className="mx-auto h-5 w-5 text-orange-400" />
                              <div className="mt-2 text-[18px] font-black tabular-nums">{Math.round(story.advanced.daypart?.percent || 0)}%</div>
                              <div className="mt-1 text-[7px] leading-tight text-white/42">{story.advanced.daypart?.label || 'período'}</div>
                            </div>
                          </div>
                        </Section>
                      </motion.div>
                    ) : null}
                  </div>

                  <div className={clsx(
                    'grid min-w-0 gap-2.5',
                    showRanking ? 'grid-cols-[0.92fr_1.08fr]' : 'grid-cols-1',
                  )}>
                    <motion.div
                      initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: shouldAnimate ? 0.24 : 0.01, delay: shouldAnimate ? 0.18 : 0 }}
                    >
                      <Section className="h-full overflow-hidden p-3">
                        <SectionHeading icon={UsersRound}>Seu grupo</SectionHeading>
                        <div className="mt-3">
                          <GroupRing percent={groupPercent} total={groupTotal} />
                        </div>
                        {socialEntries.length > 0 ? (
                          <div className="mt-3 flex items-center">
                            <div className="flex -space-x-2">
                              {socialEntries.slice(0, 4).map((entry) => (
                                <SmartImage
                                  key={`group-${entry.id}`}
                                  src={coreUtils.getUserAvatar(entry.user.id, entry.user.avatar)}
                                  className="h-6 w-6 rounded-full border border-[#0d0e11] object-cover"
                                  rounded="full"
                                  fallback=""
                                />
                              ))}
                            </div>
                            <span className="ml-2 text-[7px] font-semibold leading-tight text-orange-400">
                              {socialEntries.length} pessoa{socialEntries.length === 1 ? '' : 's'} no primeiro dia
                            </span>
                          </div>
                        ) : null}
                      </Section>
                    </motion.div>

                    {showRanking ? (
                      <motion.div
                        initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: shouldAnimate ? 0.24 : 0.01, delay: shouldAnimate ? 0.21 : 0 }}
                      >
                        <Section className="h-full overflow-hidden p-3">
                          <SectionHeading icon={Trophy}>Ranking</SectionHeading>
                          <div className="mt-3 flex items-end justify-between gap-1">
                            {visibleRanking.map((entry, index) => {
                              const isOwn = entry.user?.id === targetUserId;
                              return (
                                <motion.button
                                  key={entry.user?.id || entry.position}
                                  type="button"
                                  initial={shouldAnimate ? { opacity: 0, scale: 0.76, x: -10 } : false}
                                  animate={{ opacity: 1, scale: 1, x: 0 }}
                                  transition={{ duration: shouldAnimate ? 0.24 : 0.01, delay: shouldAnimate ? 0.2 + index * 0.055 : 0 }}
                                  onClick={() => {
                                    onClose();
                                    motionRuntimeScheduler.scheduleTask(() => {
                                      window.dispatchEvent(new CustomEvent('openHistory', {
                                        detail: {
                                          id: entry.user.id,
                                          name: entry.user.name,
                                          avatar: entry.user.avatar,
                                          initialSearch: activeTrack?.name,
                                        },
                                      }));
                                    }, shouldAnimate ? 250 : 20, 'interaction', 'track-leaderboard-open-history');
                                  }}
                                  className="flex min-w-0 flex-1 flex-col items-center"
                                  aria-label={`Abrir histórico de ${entry.user?.name}, posição ${entry.position}`}
                                >
                                  <div className={clsx(
                                    'relative h-7 w-7 rounded-full',
                                    isOwn && 'ring-2 ring-orange-400 ring-offset-2 ring-offset-[#0d0e11]',
                                  )}>
                                    <SmartImage
                                      src={coreUtils.getUserAvatar(entry.user?.id, entry.user?.avatar)}
                                      className="h-full w-full rounded-full object-cover"
                                      rounded="full"
                                      fallback={entry.user?.name || ''}
                                    />
                                    <span className={clsx(
                                      'absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[6px] font-black',
                                      isOwn ? 'bg-orange-500 text-white' : 'bg-white/[0.12] text-white/72',
                                    )}>
                                      #{entry.position}
                                    </span>
                                  </div>
                                  <span className={clsx('mt-3 text-[9px] font-black tabular-nums', isOwn ? 'text-orange-400' : 'text-white/58')}>
                                    {coreUtils.formatNumber(entry.count)}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                          {ownRank ? (
                            <div className="mt-3 text-[8px] text-white/42">
                              Você está em <span className="font-black text-white">#{ownRank.position}</span> de {ranking.length}
                            </div>
                          ) : null}
                        </Section>
                      </motion.div>
                    ) : null}
                  </div>

                  {storyArtists.length > 0 ? (
                    <motion.div
                      initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: shouldAnimate ? 0.24 : 0.01, delay: shouldAnimate ? 0.24 : 0 }}
                    >
                      <Section className="p-3">
                        <div className="flex gap-2 overflow-x-auto overscroll-x-contain no-scrollbar">
                          {storyArtists.map((artist) => (
                            <button
                              key={artist.key}
                              type="button"
                              onClick={() => openArtist(artist)}
                              className="flex min-w-[122px] flex-1 shrink-0 items-center gap-2 border-r border-white/[0.08] pr-3 text-left last:border-0"
                            >
                              <SmartImage
                                src={artist.image}
                                className="h-12 w-12 shrink-0 rounded-full object-cover"
                                rounded="full"
                                fallback={artist.name}
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-[9px] font-bold text-white/82">{artist.name}</span>
                                <span className="mt-1 block text-[15px] font-black tabular-nums text-violet-300">
                                  {coreUtils.formatNumber(artist.count)}
                                </span>
                                <span className="text-[7px] text-violet-300/70">plays</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </Section>
                    </motion.div>
                  ) : null}

                  {story.coverage?.partial ? (
                    <div className="rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-center text-[7px] font-black uppercase tracking-[0.10em] text-white/34">
                      Dados parciais nesta abertura
                    </div>
                  ) : null}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          className="relative z-30 shrink-0 border-t border-white/[0.08] bg-[#090a0c]/96 px-3 pt-2.5 backdrop-blur-xl"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
          <AnimatePresence>
            {statusMessage ? (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/[0.09] bg-[#17181c] px-3 py-2 text-[8px] font-black text-white/72 shadow-xl"
              >
                {statusMessage}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {recentPickerOpen ? (
              <motion.div
                initial={shouldAnimate ? { opacity: 0, y: 8, scale: 0.98 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={shouldAnimate ? { opacity: 0, y: 8, scale: 0.98 } : { opacity: 0 }}
                className="absolute inset-x-3 bottom-[84px] max-h-[245px] overflow-y-auto rounded-[22px] border border-white/[0.11] bg-[#111216]/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.70)] custom-scrollbar"
                data-track-leaderboard-scroll="true"
              >
                {entries.slice(0, 10).map((entry, index) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => chooseEntry(index)}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-[16px] p-2 text-left transition-[background-color,transform] active:scale-[0.985]',
                      index === activeIndex ? 'bg-orange-500/10' : 'hover:bg-white/[0.045]',
                    )}
                  >
                    <SmartImage
                      src={getAlbumImage(entry.track)}
                      className="h-10 w-10 shrink-0 object-cover"
                      rounded="[12px]"
                      fallback=""
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-black text-white/82">{entry.track.name}</span>
                      <span className="mt-1 block truncate text-[8px] text-white/38">
                        {getMainArtistName(entry.track)} · {formatContextTime(getPlaybackTimestamp(entry.playback), entry.playback?.isLive)}
                      </span>
                    </span>
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="grid grid-cols-[1.65fr_repeat(3,0.62fr)] gap-2">
            <button
              type="button"
              onClick={openLyrics}
              className="flex h-10 items-center justify-center gap-2 rounded-[16px] border border-orange-500/55 bg-orange-500/[0.06] text-[10px] font-black uppercase tracking-[0.11em] text-orange-300 shadow-[0_0_22px_rgba(249,115,22,0.10)] transition-[background-color,border-color,transform] hover:bg-orange-500/[0.10] active:scale-[0.97]"
            >
              <BookOpen className="h-4 w-4" />
              Ver letra
            </button>
            <button
              type="button"
              onClick={() => links.stats && window.open(links.stats, '_blank', 'noopener,noreferrer')}
              disabled={!links.stats}
              className="flex h-10 items-center justify-center rounded-[16px] border border-white/[0.10] bg-white/[0.025] text-white/68 transition-[background-color,transform] hover:bg-white/[0.07] active:scale-[0.96] disabled:opacity-25"
              aria-label="Abrir no stats.fm"
            >
              <BarChart3 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={shareTrack}
              className="flex h-10 items-center justify-center rounded-[16px] border border-white/[0.10] bg-white/[0.025] text-white/68 transition-[background-color,transform] hover:bg-white/[0.07] active:scale-[0.96]"
              aria-label="Compartilhar faixa"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => preferredMusicLink && window.open(preferredMusicLink, '_blank', 'noopener,noreferrer')}
              disabled={!preferredMusicLink}
              className="flex h-10 items-center justify-center rounded-[16px] border border-white/[0.10] bg-white/[0.025] text-white/68 transition-[background-color,transform] hover:bg-white/[0.07] active:scale-[0.96] disabled:opacity-25"
              aria-label="Abrir no serviço de música"
            >
              {preferredMusicLink ? <Link2 className="h-5 w-5" /> : <ExternalLink className="h-5 w-5" />}
            </button>
          </div>

          <div className="mt-1.5 grid grid-cols-[50px_1fr_50px] items-center gap-2">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => chooseEntry(activeIndex - 1)}
              className="flex h-8 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.025] text-white/62 transition-[background-color,transform] active:scale-95 disabled:opacity-25"
              aria-label="Faixa mais recente"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setRecentPickerOpen((open) => !open)}
              className="flex h-8 min-w-0 items-center justify-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.025] px-3 text-[9px] font-black uppercase tracking-[0.10em] text-orange-300 transition-[background-color,transform] hover:bg-white/[0.06] active:scale-[0.98]"
              aria-expanded={recentPickerOpen}
            >
              <ListMusic className="h-4 w-4 shrink-0" />
              <span className="truncate">Recentes</span>
              <span className="text-white/30">{activeIndex + 1}/{entries.length}</span>
            </button>
            <button
              type="button"
              disabled={activeIndex >= entries.length - 1}
              onClick={() => chooseEntry(activeIndex + 1)}
              className="flex h-8 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.025] text-white/62 transition-[background-color,transform] active:scale-95 disabled:opacity-25"
              aria-label="Faixa anterior"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};
