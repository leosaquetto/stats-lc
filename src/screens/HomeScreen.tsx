
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, AlertTriangle, WifiOff, Users, Sparkles, Loader2, Check, Info, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FriendActivityReel } from '../components/home/FriendActivityReel';
import type { ReplayFilterPeriod, ReplaySelectedSubValues } from '../components/home/replayUtils';
import { UserSelectorModal } from '../components/home/UserSelectorModal';
import { UserSelectorExplosion } from '../components/home/UserSelectorExplosion';
import { TopAlbumsModal, TopArtistsModal, TopSongsModal } from '../components/home/ReplayModals';
import { coreUtils } from '../services/statsCore';
import { statsService, type ReplayPeriodQuery } from '../services/statsService';
import { trackEvent, identifyUser } from '../services/analyticsService';

import { LeoHeader } from '../components/home/LeoHeader';
import { FriendsMonthlyHighlights } from '../components/home/FriendsMonthlyHighlights';
import { StatsAlike } from '../components/home/StatsAlike';
import { ShimmerOverlay } from '../components/shared/CommonUI';
import { HomeInsights } from '../components/home/HomeInsights';
import { getCanonicalMembers, getVisibleMembers } from '../lib/memberSelectors';
import { getDominantColor } from '../lib/colorUtils';
import { VinylRecord } from '../components/home/VinylRecord';

const ReplaySection = React.lazy(() => import('../components/home/ReplaySection').then(module => ({ default: module.ReplaySection })));
const UserHistoryModal = React.lazy(() => import('../components/modals/UserHistoryModal').then(module => ({ default: module.UserHistoryModal })));
const TrackLeaderboardModal = React.lazy(() => import('../components/modals/TrackLeaderboardModal').then(module => ({ default: module.TrackLeaderboardModal })));
const AlbumDetailModal = React.lazy(() => import('../components/modals/AlbumDetailModal').then(module => ({ default: module.AlbumDetailModal })));
const UserAlbumHistoryModal = React.lazy(() => import('../components/modals/UserAlbumHistoryModal').then(module => ({ default: module.UserAlbumHistoryModal })));

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FloatingMiniHeader = React.memo(({
  visible,
  albumImage,
  dominantColor,
  isPlaying,
  onClick
}: {
  visible: boolean;
  albumImage: string;
  dominantColor: string;
  isPlaying: boolean;
  onClick: () => void;
}) => {
  if (!albumImage) return null;

  return (
    <header
      className={cn(
        "pointer-events-none fixed top-0 left-0 right-0 z-[150] h-[calc(150px+env(safe-area-inset-top,0px))] overflow-visible",
        visible
          ? "opacity-100"
          : "opacity-0"
      )}
    >
      <motion.div
        initial={false}
        animate={visible ? { y: 0, opacity: 1, scale: 1, rotate: 0 } : { y: -32, opacity: 0, scale: 0.82, rotate: -7 }}
        transition={{ type: 'spring', stiffness: 560, damping: 30, mass: 0.72 }}
        className="pointer-events-auto absolute right-[-76px] top-[calc(env(safe-area-inset-top,0px)-78px)] h-[188px] w-[188px] sm:right-[calc(50%-326px)] sm:h-[206px] sm:w-[206px]"
      >
        <VinylRecord
          albumImage={albumImage}
          dominantColor={dominantColor}
          isPlaying={isPlaying}
          progressMs={0}
          durationMs={undefined}
          onClick={onClick}
          hideTonearm
        />
      </motion.div>
    </header>
  );
});

FloatingMiniHeader.displayName = 'FloatingMiniHeader';

const HomeSectionLoader = ({ label = 'Carregando dados do círculo' }: { label?: string }) => (
  <div className="mx-4 sm:mx-6 lg:mx-8 flex flex-col items-center justify-center gap-3 rounded-[28px] border border-white/10 bg-white/[0.035] px-5 py-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
    <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">{label}</span>
  </div>
);

const HomeEmptyState = ({ onRetry }: { onRetry: () => void }) => (
  <motion.div
    key="empty-group"
    initial={{ opacity: 0, scale: 0.96, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    className="glass-card mx-4 sm:mx-6 lg:mx-8 flex flex-col items-center justify-center gap-5 rounded-[36px] border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent px-7 py-10 text-center shadow-2xl"
  >
    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-orange-500/20 bg-orange-500/10">
      <Users className="h-6 w-6 text-orange-400" />
    </div>
    <div className="flex max-w-sm flex-col gap-2">
      <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/90">Carregando círculo</h2>
      <p className="text-xs font-medium leading-relaxed text-white/50">
        Ainda não encontramos membros válidos para montar a Home. Tente sincronizar novamente.
      </p>
    </div>
    <button
      type="button"
      onClick={onRetry}
      className="flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_25px_rgba(234,88,12,0.28)] active:scale-95"
    >
      <RefreshCcw className="h-4 w-4" />
      Tentar novamente
    </button>
  </motion.div>
);

const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const REPLAY_MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

const getReplayQuery = (activeTab: ReplayFilterPeriod, selected: ReplaySelectedSubValues): ReplayPeriodQuery => {
  const now = new Date();
  if (activeTab === 'today') {
    return { period: 'today', after: getStartOfDay(now), limit: 30 };
  }
  if (activeTab === 'week') {
    if (selected.weekMode === 'current') {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      return { period: 'week', after: getStartOfDay(monday), limit: 30 };
    }
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { period: '7days', after: getStartOfDay(sevenDaysAgo), limit: 30 };
  }
  if (activeTab === 'month') {
    const month = Number(selected.month ?? now.getMonth());
    const year = now.getFullYear();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    return { period: 'month', after: start.getTime(), before: end.getTime(), limit: 30 };
  }
  if (activeTab === 'year') {
    const year = Number(selected.year || now.getFullYear());
    return { period: 'year', after: new Date(year, 0, 1).getTime(), before: new Date(year + 1, 0, 1).getTime(), limit: 30 };
  }
  return { period: 'all', limit: 30 };
};

const getReplayModalPeriod = (activeTab: ReplayFilterPeriod, selected: ReplaySelectedSubValues) => {
  const now = new Date();
  if (activeTab === 'today') return 'hoje';
  if (activeTab === 'week') return selected.weekMode === 'current' ? 'esta semana' : 'últimos 7 dias';
  if (activeTab === 'month') {
    const month = Number(selected.month ?? now.getMonth());
    return `${REPLAY_MONTHS_LONG[month] || 'mês'} de ${now.getFullYear()}`;
  }
  if (activeTab === 'year') return selected.year || String(now.getFullYear());
  return 'total';
};

const getReplayMinutes = (item: any) => {
  const durationMs = item?.durationMs ?? item?.totalDurationMs ?? item?.playedDurationMs ?? item?.playDurationMs;
  if (Number.isFinite(durationMs) && durationMs > 0) return Math.max(1, Math.round(durationMs / 60000));
  return Math.round(item?.minutes ?? item?.playedMinutes ?? item?.streams ?? item?.playcount ?? item?.playedCount ?? item?.count ?? 0);
};

const getReplayDurationMs = (item: any) => {
  const durationMs = item?.durationMs ?? item?.totalDurationMs ?? item?.playedDurationMs ?? item?.playDurationMs;
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
};

const getReplayFallbackTotalMinutes = (tracks: any[], totalSongs?: number) => {
  const summedTrackDuration = tracks.reduce((total, track) => total + getReplayDurationMs(track), 0);
  if (summedTrackDuration > 0) return Math.max(1, Math.round(summedTrackDuration / 60000));
  if (Number.isFinite(totalSongs) && totalSongs && totalSongs > 0) {
    return totalSongs;
  }
  return tracks.reduce((total, track) => total + getReplayMinutes(track), 0);
};

const getReplayArtistName = (item: any) => {
  const candidates = [
    item?.albumArtist,
    item?.albumArtistName,
    item?.album?.artist,
    item?.album?.artistName,
    item?.album?.primaryArtist,
    item?.album?.primaryArtistName,
    item?.primaryArtist,
    item?.primaryArtistName,
    item?.artistName,
    item?.artist,
    Array.isArray(item?.artists) ? item.artists[0] : undefined,
    item?.track?.primaryArtist,
    item?.track?.primaryArtistName,
    item?.track?.artistName,
    Array.isArray(item?.track?.artists) ? item.track.artists[0] : undefined
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (candidate && typeof candidate === 'object') {
      const name = candidate.name || candidate.artistName || candidate.displayName;
      if (typeof name === 'string' && name.trim()) return name;
    }
  }
  return 'Artista Desconhecido';
};

const getReplayAlbumArtistName = (album: any, tracks: any[]) => {
  const directArtist = getReplayArtistName(album);
  if (directArtist !== 'Artista Desconhecido') return directArtist;

  // Defesa: tracks pode ser undefined ao restaurar do cache
  if (!Array.isArray(tracks) || tracks.length === 0) return directArtist;

  const albumName = coreUtils.normalizeText(album?.name);
  const albumImage = album?.image || album?.albumImage;
  const albumId = album?.id || album?.albumId || album?.album?.id;
  const matchingTrack = tracks.find((track) => {
    const trackAlbumId = track?.albumId || track?.album?.id;
    const trackAlbumName = coreUtils.normalizeText(track?.albumName || track?.album?.name);
    const trackAlbumImage = track?.albumImage || track?.album?.image || track?.image;
    return (
      (albumId && trackAlbumId && String(albumId) === String(trackAlbumId)) ||
      (albumName && trackAlbumName && albumName === trackAlbumName) ||
      (albumImage && trackAlbumImage && albumImage === trackAlbumImage)
    );
  });

  return matchingTrack ? getReplayArtistName(matchingTrack) : directArtist;
};

const firstExternalId = (value: any) => {
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item.trim());
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const getReplayTrackUrl = (track: any) => {
  const directUrl = track?.url || track?.externalUrl || track?.spotifyUrl || track?.appleMusicUrl;
  if (typeof directUrl === 'string' && directUrl.trim()) return directUrl;

  const spotifyId = track?.spotifyId || firstExternalId(track?.externalIds?.spotify) || firstExternalId(track?.track?.externalIds?.spotify);
  if (spotifyId) return `https://open.spotify.com/track/${spotifyId}`;

  const appleMusicId = track?.appleMusicId || firstExternalId(track?.externalIds?.appleMusic) || firstExternalId(track?.track?.externalIds?.appleMusic);
  if (appleMusicId) return `https://music.apple.com/search?term=${encodeURIComponent(`${track?.name || ''} ${getReplayArtistName(track)}`.trim())}`;

  if (track?.name) return `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${getReplayArtistName(track)}`)}`;
  return '';
};

export default function HomeScreen() {
  const groupStats = useStatsStore(state => state.groupStats);
  const isLoading = useStatsStore(state => state.isLoading);
  const isRefreshing = useStatsStore(state => state.isRefreshing);
  const isOffline = useStatsStore(state => state.isOffline);
  const error = useStatsStore(state => state.error);
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const fetchGroupLive = useStatsStore(state => state.fetchGroupLive);
  const prefetchUserTops = useStatsStore(state => state.prefetchUserTops);
  const prefetchNextFriend = useStatsStore(state => state.prefetchNextFriend);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const setFeaturedUserId = useStatsStore(state => state.setFeaturedUserId);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const navigate = useNavigate();
  
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [viewingFullHistoryUser, setViewingFullHistoryUser] = useState<any>(null);
  const [viewingAlbumHistoryUser, setViewingAlbumHistoryUser] = useState<any>(null);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [avatarClickPosition, setAvatarClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectorMode, setSelectorMode] = useState<'header' | 'mini-header'>('header');
  const [toasts, setToasts] = useState<any[]>([]);
  const [processedItems, setProcessedItems] = useState(0);
  const [refreshStepText, setRefreshStepText] = useState('Status: Ciclo Sincronizado');
  const [refreshProgress, setRefreshProgress] = useState(100);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [headerHighlight, setHeaderHighlight] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [showInitialModal, setShowInitialModal] = useState(false);
  const [isManualLiveRefresh, setIsManualLiveRefresh] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const REFRESH_COOLDOWN_MS = 2000; // 2 seconds
  const [miniHeaderResolvedColor, setMiniHeaderResolvedColor] = useState('');
  const isHeaderScrolledRef = useRef(false);
  const [replayState, setReplayState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [replayTopItems, setReplayTopItems] = useState<{ artists: any[]; tracks: any[]; albums: any[] }>({
    artists: [],
    tracks: [],
    albums: []
  });
  const [replayTotalMinutesCount, setReplayTotalMinutesCount] = useState(0);
  const [openReplayModal, setOpenReplayModal] = useState<'artists' | 'songs' | 'albums' | null>(null);
  const [replayActiveTab, setReplayActiveTab] = useState<ReplayFilterPeriod>('month');
  const [replaySelectedSubValues, setReplaySelectedSubValues] = useState<ReplaySelectedSubValues>({
    weekMode: 'last-7',
    month: String(new Date().getMonth()).padStart(2, '0'),
    year: String(new Date().getFullYear())
  });
  const toastIdRef = useRef(0);
  const horizontalTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const userTrackStatsForLayout = useStatsStore(state => state.userTrackStats);

  const allMembers = useMemo(() => getCanonicalMembers(groupStats) || [], [groupStats]);
  const members = useMemo(() => getVisibleMembers(groupStats, hiddenUsers) || [], [groupStats, hiddenUsers]);
  const primaryUser = useMemo(() => {
    if (!groupStats) return null;
    // Prioriza allMembers para permitir usuário oculto como featuredUserId
    return (
      allMembers.find(m => m.id === featuredUserId) ||
      members.find(m => m.id === featuredUserId) ||
      members[0] ||
      allMembers[0] ||
      null
    );
  }, [allMembers, featuredUserId, groupStats, members]);
  const FEATURED_ID = primaryUser?.id || '';

  // Mini header mirrors the now playing vinyl once the hero scrolls away.
  const miniHeaderTrack = primaryUser?.nowPlaying?.track as any;
  const miniHeaderAlbumImage = (
    miniHeaderTrack?.image ||
    miniHeaderTrack?.albumImage ||
    miniHeaderTrack?.album?.image ||
    miniHeaderTrack?.album?.images?.[0]?.url ||
    miniHeaderTrack?.album?.images?.[0] ||
    miniHeaderTrack?.images?.[0]?.url ||
    miniHeaderTrack?.images?.[0] ||
    miniHeaderTrack?.albumArt ||
    miniHeaderTrack?.coverArt ||
    miniHeaderTrack?.cover_art ||
    miniHeaderTrack?.album_image ||
    miniHeaderTrack?.cover ||
    ''
  );
  const hasMiniHeaderAlbumImage = typeof miniHeaderAlbumImage === 'string' && miniHeaderAlbumImage.trim().length > 5;
  const miniHeaderDominantColor = primaryUser?.nowPlaying?.dominantColor || miniHeaderResolvedColor || '';
  const miniHeaderPlayback = primaryUser ? coreUtils.getPlaybackStatus({ nowPlaying: primaryUser.nowPlaying }) : null;
  const miniHeaderIsPlaying = miniHeaderPlayback?.status === 'live' && primaryUser?.nowPlaying?.isNow === true;
  const primaryPlayback = primaryUser ? coreUtils.getPlaybackStatus({ nowPlaying: primaryUser.nowPlaying }) : null;
  const primaryTrack = primaryUser?.nowPlaying?.track;
  const primaryIsPlaying = primaryPlayback?.status === 'live' && primaryUser?.nowPlaying?.isNow === true;
  const visibleMembersCount = members.length || 1;
  const currentTrackId = (primaryTrack as any)?.id;
  const currentTrackArenaPlayCount = currentTrackId && Array.isArray(members)
    ? members
        .reduce((total, member) => total + (userTrackStatsForLayout[`${member.id}:${currentTrackId}`] || 0), 0)
    : 0;
  const friendActivityOffset = primaryIsPlaying
    ? (currentTrackArenaPlayCount > visibleMembersCount ? "-mt-16" : "-mt-18")
    : "-mt-14";
  const replayPeriodQuery = useMemo(
    () => getReplayQuery(replayActiveTab, replaySelectedSubValues),
    [replayActiveTab, replaySelectedSubValues]
  );

  const pipelineStreamLinesMemo = useMemo(() => [
    { left: '16.6%', duration: 2.2, delay: 0 },
    { left: '33.2%', duration: 3.1, delay: 0.35 },
    { left: '49.8%', duration: 2.6, delay: 0.7 },
    { left: '66.4%', duration: 3.4, delay: 0.2 },
    { left: '83%', duration: 2.9, delay: 0.95 },
    { left: '91.5%', duration: 3.7, delay: 0.55 },
  ], []);

  useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const shouldBeScrolled = scrollY >= 160;
        const shouldBeReset = scrollY <= 90;

        let nextValue = isHeaderScrolledRef.current;
        if (!isHeaderScrolledRef.current && shouldBeScrolled) {
          nextValue = true;
        } else if (isHeaderScrolledRef.current && shouldBeReset) {
          nextValue = false;
        }

        if (nextValue !== isHeaderScrolledRef.current) {
          isHeaderScrolledRef.current = nextValue;
          setIsHeaderScrolled(nextValue);
        }

        frame = 0;
      });
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const handleNowPlaying = (event: any) => {
      const { userId } = event.detail || {};
      if (userId === featuredUserId) {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReduced) {
          setHeaderHighlight(true);
          const timer = setTimeout(() => {
            setHeaderHighlight(false);
          }, 3000);
          return () => clearTimeout(timer);
        }
      }
    };
    window.addEventListener('nowPlayingChanged', handleNowPlaying);
    return () => window.removeEventListener('nowPlayingChanged', handleNowPlaying);
  }, [featuredUserId]);

  const showToast = useCallback((title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${toastIdRef.current++}`;
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setToasts(prev => [...prev, { id, title, message, type, timestamp }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const stopPullToRefreshOnHorizontalGesture = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const insideHorizontalArea = !!target?.closest('[data-home-horizontal-scroll="true"]');
    const touch = event.touches[0];

    if (!insideHorizontalArea || !touch) {
      horizontalTouchStartRef.current = null;
      return;
    }

    if (event.type === 'touchstart') {
      horizontalTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
      return;
    }

    const start = horizontalTouchStartRef.current;
    if (!start) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > 10 && absX > absY * 1.2) {
      event.nativeEvent.stopImmediatePropagation();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!hasMiniHeaderAlbumImage || primaryUser?.nowPlaying?.dominantColor) {
      setMiniHeaderResolvedColor('');
      return;
    }

    getDominantColor(miniHeaderAlbumImage)
      .then((color) => {
        if (!cancelled) setMiniHeaderResolvedColor(color || '');
      })
      .catch(() => {
        if (!cancelled) setMiniHeaderResolvedColor('');
      });

    return () => {
      cancelled = true;
    };
  }, [hasMiniHeaderAlbumImage, miniHeaderAlbumImage, primaryUser?.nowPlaying?.dominantColor]);

  const handleRefresh = useCallback(async () => {
    // Rate limiting: prevent spam refresh
    const now = Date.now();
    if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
      showToast('Now Playing', 'Aguarde alguns segundos antes de atualizar novamente.', 'error');
      return;
    }

    setIsManualLiveRefresh(true);
    setLastRefreshTime(now);
    try {
      await fetchGroupLive(false);
      showToast('Now Playing', 'Tocando agora atualizado.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Now Playing', 'Não foi possível atualizar o tocando agora.', 'error');
    } finally {
      setIsManualLiveRefresh(false);
    }
  }, [fetchGroupLive, showToast, lastRefreshTime, REFRESH_COOLDOWN_MS]);

  useEffect(() => {
    if (!isRefreshing) {
      setRefreshStepText('Status: Ciclo Sincronizado');
      setRefreshProgress(100);
      setProcessedItems(0);
      return;
    }

    const steps = [
      { text: 'Validando cache local', progress: 18, items: 2 },
      { text: 'Consultando grupo', progress: 42, items: 8 },
      { text: 'Atualizando destaques', progress: 68, items: 18 },
      { text: 'Persistindo snapshot', progress: 88, items: 26 },
      { text: 'Sincronia concluindo', progress: 96, items: 32 },
    ];
    let index = 0;

    setRefreshStepText(steps[0].text);
    setRefreshProgress(steps[0].progress);
    setProcessedItems(steps[0].items);

    const timer = window.setInterval(() => {
      index = Math.min(index + 1, steps.length - 1);
      setRefreshStepText(steps[index].text);
      setRefreshProgress(steps[index].progress);
      setProcessedItems(steps[index].items);
    }, 700);

    return () => window.clearInterval(timer);
  }, [isRefreshing]);
  
  useEffect(() => {
    // Busca inicial se não houver dados no store
    if (!groupStats && !isLoading) {
      fetchGroup();
    }
  }, [groupStats, isLoading, fetchGroup]);

  useEffect(() => {
    if (!groupStats || isLoading) return;

    const hasPreviouslySelectedUser =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('stats-lc-has-selected-user') === '1';

    if (!featuredUserId && members.length > 0 && !hasPreviouslySelectedUser) {
      setShowInitialModal(true);
      return;
    }

    // Só recupera featuredUserId se ele estiver vazio ou não existir em allMembers
    const featuredUserExists = allMembers.some(m => m.id === featuredUserId);

    if (!featuredUserId || !featuredUserExists) {
      if (primaryUser?.id) {
        if ((import.meta as any).env?.DEV) {
          console.warn('[HomeScreen] Invalid featuredUserId recovered', {
            featuredUserId,
            fallbackUserId: primaryUser.id,
          });
        }
        setFeaturedUserId(primaryUser.id);
        setShowInitialModal(false);
        return;
      }
    }

    if (primaryUser?.id) {
      setShowInitialModal(false);
      prefetchUserTops(primaryUser.id);
      prefetchNextFriend(primaryUser.id);
    } else if (allMembers.length > 0) {
      setShowInitialModal(true);
    }
  }, [allMembers, featuredUserId, primaryUser, members, groupStats, isLoading, prefetchUserTops, prefetchNextFriend, setFeaturedUserId]);

  useEffect(() => {
    const nowPlaying = primaryUser?.nowPlaying;
    const track = nowPlaying?.track as any;
    if (!primaryUser?.id || nowPlaying?.isNow !== true || !track) return;

    const durationMs = Number(nowPlaying.durationMs || track.durationMs || track.duration_ms || 0);
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;

    const progressMs = Number(nowPlaying.progressMs || track.progressMs || track.progress_ms || 0);
    const timestampMs = nowPlaying.timestamp ? new Date(nowPlaying.timestamp).getTime() : Date.now();
    const elapsedSincePayload = Number.isFinite(timestampMs) ? Math.max(0, Date.now() - timestampMs) : 0;
    const remainingMs = durationMs - Math.max(0, progressMs) - elapsedSincePayload;
    const delay = Math.min(Math.max(remainingMs + 1500, 1200), 45000);

    const timer = window.setTimeout(() => {
      fetchGroupLive(false);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    primaryUser?.id,
    primaryUser?.nowPlaying?.track?.id,
    primaryUser?.nowPlaying?.timestamp,
    primaryUser?.nowPlaying?.isNow,
    primaryUser?.nowPlaying?.progressMs,
    primaryUser?.nowPlaying?.durationMs,
    fetchGroupLive
  ]);

  // Mark app as ready when group data is available; the empty-user state renders below.
  useEffect(() => {
    if (!isLoading && groupStats) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => setIsAppReady(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsAppReady(false);
    }
  }, [isLoading, groupStats]);

  useEffect(() => {
    // Escuta evento customizado para abrir histórico completo
    const handleOpenHistory = (e: any) => {
      setViewingFullHistoryUser(e.detail);
    };
    window.addEventListener('openHistory', handleOpenHistory);
    return () => window.removeEventListener('openHistory', handleOpenHistory);
  }, []);

  // Track featured user changes
  useEffect(() => {
    if (primaryUser) {
      identifyUser(primaryUser.id, {
        name: primaryUser.name,
        platform: primaryUser.platform,
        streamsToday: primaryUser.streamsToday
      });
      trackEvent('featured_user_changed', {
        userId: primaryUser.id,
        userName: primaryUser.name,
        platform: primaryUser.platform
      });
    }
  }, [primaryUser?.id]);

  // Track modal opening states
  useEffect(() => {
    if (selectedTrack) {
      trackEvent('modal_opened', { 
        modalName: 'track_detail', 
        trackId: selectedTrack.id,
        trackName: selectedTrack.name || selectedTrack.track?.name,
        artistName: selectedTrack.artistName || selectedTrack.artist?.name
      });
    }
  }, [selectedTrack]);

  useEffect(() => {
    if (selectedAlbum) {
      trackEvent('modal_opened', { 
        modalName: 'album_detail', 
        albumId: selectedAlbum.id,
        albumName: selectedAlbum.name,
        artistName: selectedAlbum.artistName
      });
    }
  }, [selectedAlbum]);

  useEffect(() => {
    if (viewingFullHistoryUser) {
      trackEvent('modal_opened', { 
        modalName: 'user_full_history', 
        userId: viewingFullHistoryUser.id, 
        userName: viewingFullHistoryUser.name 
      });
    }
  }, [viewingFullHistoryUser]);

  useEffect(() => {
    if (viewingAlbumHistoryUser) {
      trackEvent('modal_opened', { 
        modalName: 'user_album_history', 
        userId: viewingAlbumHistoryUser.id, 
        userName: viewingAlbumHistoryUser.name 
      });
    }
  }, [viewingAlbumHistoryUser]);

  useEffect(() => {
    if (showUserSelector) {
      trackEvent('user_selector_opened');
    }
  }, [showUserSelector]);

  useEffect(() => {
    setShowUserSelector(false);
    setAvatarClickPosition(null);
  }, [featuredUserId]);

  const friendsSelection = useMemo(() => {
    if (!Array.isArray(members)) return [];
    return members.filter(u => u && u.id && u.id !== FEATURED_ID);
  }, [members, FEATURED_ID]);

  const sortedFriends = useMemo(() => {
    return [...friendsSelection].sort((a, b) => a.name.localeCompare(b.name));
  }, [friendsSelection]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    if (!primaryUser?.id) {
      setReplayState('idle');
      setReplayTopItems({ artists: [], tracks: [], albums: [] });
      setReplayTotalMinutesCount(0);
      return;
    }

    setReplayState('loading');
    statsService.getReplayData(primaryUser.id, { ...replayPeriodQuery, signal: controller.signal })
      .then((replay) => ({
        artists: replay.topArtists,
        tracks: replay.topTracks,
        albums: replay.topAlbums,
        totalSongs: replay.totalSongs,
        totalDurationMs: replay.totalDurationMs,
        failed: false
      }))
      .catch((error: any) => {
        if (controller.signal.aborted || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
          return null;
        }
        return { artists: [], tracks: [], albums: [], totalSongs: undefined, totalDurationMs: undefined, failed: true };
      })
      .then((payload) => {
      if (!payload || cancelled) return;
      const { artists, tracks, albums, totalSongs, totalDurationMs, failed } = payload;
      if (failed) {
        setReplayTopItems({ artists, tracks, albums });
        setReplayTotalMinutesCount(0);
        setReplayState('error');
        return;
      }
      if (!cancelled) {
        setReplayTopItems({ artists, tracks, albums });
        const fallbackTotal = getReplayFallbackTotalMinutes(tracks, totalSongs) || tracks.length;
        setReplayTotalMinutesCount(
          Number.isFinite(totalDurationMs) && totalDurationMs && totalDurationMs > 0
            ? Math.max(1, Math.round(totalDurationMs / 60000))
            : fallbackTotal
        );
        setReplayState('ready');
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [primaryUser?.id, replayPeriodQuery, replayActiveTab]);

  const replayArtists = replayTopItems.artists || [];
  const replayTracks = replayTopItems.tracks || [];
  const replayAlbums = replayTopItems.albums || [];
  const replayModalPeriod = getReplayModalPeriod(replayActiveTab, replaySelectedSubValues);

  const handleShareReplay = useCallback(async () => {
    if (!primaryUser) return;
    const topArtist = replayArtists[0]?.name ? ` Artista #1: ${replayArtists[0].name}.` : '';
    const text = `${primaryUser.name} ouviu ${coreUtils.formatNumber(replayTotalMinutesCount)} minutos de musica ${replayModalPeriod}.${topArtist}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'stats.lc Replay',
          text,
          url: window.location.href
        });
        showToast('Replay compartilhado', 'Seu resumo foi enviado para o compartilhamento do sistema.', 'success');
        return;
      }

      await navigator.clipboard?.writeText(`${text} ${window.location.href}`);
      showToast('Replay copiado', 'O resumo do Replay foi copiado para a area de transferencia.', 'success');
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        showToast('Compartilhamento indisponivel', 'Nao foi possivel abrir o compartilhamento agora.', 'error');
      }
    }
  }, [primaryUser, replayArtists, replayModalPeriod, replayTotalMinutesCount, showToast]);

  const handleOpenReplayTrack = useCallback((track: any) => {
    const url = getReplayTrackUrl(track);
    if (!url) {
      showToast('Link indisponivel', 'Esta musica ainda nao trouxe link de catalogo pela API.', 'info');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [showToast]);

  const hasReplayData = replayArtists.length > 0 || replayTracks.length > 0 || replayAlbums.length > 0;
  const isReplayInitialLoading = isAppReady && !!primaryUser && replayState !== 'ready' && !hasReplayData;
  const isReplayUpdating = isAppReady && !!primaryUser && replayState !== 'ready' && hasReplayData;
  const showPipelineSync = false;
  return (
    <>
      {createPortal(
        <>
          {/* Modal inicial - primeira vez */}
          <UserSelectorModal
            isOpen={showInitialModal}
            members={members}
            featuredUserId={featuredUserId || ''}
            onSelectUser={(userId) => {
              setFeaturedUserId(userId);
              localStorage.setItem('stats-lc-has-selected-user', '1');
              setShowInitialModal(false);
            }}
            onClose={() => {
              if (!primaryUser && members.length > 0) {
                setFeaturedUserId(members[0].id);
                localStorage.setItem('stats-lc-has-selected-user', '1');
              }
              setShowInitialModal(false);
            }}
          />

          <AnimatePresence>
            <React.Suspense fallback={<HomeSectionLoader label="Abrindo detalhe" />}>
              {viewingFullHistoryUser && (
                <UserHistoryModal 
                  user={viewingFullHistoryUser} 
                  onClose={() => setViewingFullHistoryUser(null)}
                  onTrackClick={(track) => setSelectedTrack(track)}
                  groupStats={groupStats}
                />
              )}
              {selectedTrack && (
                <TrackLeaderboardModal 
                  track={selectedTrack} 
                  onClose={() => setSelectedTrack(null)} 
                />
              )}
              {selectedAlbum && (
                 <AlbumDetailModal 
                   user={primaryUser}
                   album={selectedAlbum}
                   onClose={() => setSelectedAlbum(null)}
                 />
              )}
              {viewingAlbumHistoryUser && (
                <UserAlbumHistoryModal 
                  user={viewingAlbumHistoryUser}
                  onClose={() => setViewingAlbumHistoryUser(null)}
                />
              )}
            </React.Suspense>
            <TopArtistsModal
              isOpen={openReplayModal === 'artists'}
              onClose={() => setOpenReplayModal(null)}
              artists={replayArtists.slice(0, 20).map((a: any) => ({
                id: a.id,
                name: a.name,
                image: a.image,
                streams: getReplayMinutes(a)
              }))}
              period={replayModalPeriod}
            />
            <TopSongsModal
              isOpen={openReplayModal === 'songs'}
              onClose={() => setOpenReplayModal(null)}
              tracks={replayTracks.slice(0, 30).map((t: any) => ({
                id: t.id,
                name: t.name,
                artist: getReplayArtistName(t),
                image: t.image || t.albumImage,
                streams: t.playedCount || t.streams || t.playcount || t.count || 0
              }))}
              period={replayModalPeriod}
            />
            <TopAlbumsModal
              isOpen={openReplayModal === 'albums'}
              onClose={() => setOpenReplayModal(null)}
              albums={replayAlbums.slice(0, 15).map((a: any) => ({
                id: a.id,
                name: a.name,
                artist: getReplayAlbumArtistName(a, replayTracks),
                image: a.image,
                streams: getReplayMinutes(a)
              }))}
              period={replayModalPeriod}
            />

            {/* Explosão contextual de usuários */}
            <UserSelectorExplosion
              isOpen={showUserSelector}
              members={members}
              featuredUserId={featuredUserId || ''}
              onSelectUser={(userId) => {
                setFeaturedUserId(userId);
                localStorage.setItem('stats-lc-has-selected-user', '1');
                setShowUserSelector(false);
                setAvatarClickPosition(null);
              }}
              onClose={() => {
                setShowUserSelector(false);
                setAvatarClickPosition(null);
              }}
              triggerPosition={avatarClickPosition || undefined}
              mode={selectorMode}
            />
          </AnimatePresence>

          {/* Top Bar Navigation - Floating */}
          <FloatingMiniHeader
            visible={isHeaderScrolled && hasMiniHeaderAlbumImage}
            albumImage={miniHeaderAlbumImage}
            dominantColor={miniHeaderDominantColor}
            isPlaying={miniHeaderIsPlaying}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
        </>,
        document.body
      )}

      <PullToRefresh
      onRefresh={handleRefresh}
      pullDownThreshold={80}
      maxPullDownDistance={120}
      resistance={2.5}
      pullingContent={
        <div className="flex flex-col items-center justify-center pt-[calc(1.8rem+env(safe-area-inset-top,0px))] pb-10 gap-3 border-b border-orange-500/15 select-none bg-black/85 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="relative h-14 w-14 rounded-full border border-orange-500/30 bg-orange-500/10 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.22)]">
            <div className="absolute inset-1 rounded-full border border-orange-400/20" />
            <RefreshCcw className="h-5 w-5 text-orange-300" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/75">Puxe para atualizar</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-orange-300/70">Sincronizar círculo</span>
          </div>
        </div>
      }
      refreshingContent={
        <div className="flex flex-col items-center justify-center pt-[calc(1.8rem+env(safe-area-inset-top,0px))] pb-10 gap-3 border-b border-orange-500/15 select-none bg-black/90 backdrop-blur-2xl shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
          <div className="relative h-14 w-14 rounded-full border border-orange-500/40 bg-orange-500/15 flex items-center justify-center shadow-[0_0_34px_rgba(249,115,22,0.30)]">
            <motion.div className="absolute inset-0 rounded-full border-2 border-orange-500/30 border-t-orange-300" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
            <RefreshCcw className="h-5 w-5 text-orange-400 animate-spin" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/80">Atualizando</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-orange-300/75">Buscando atividade recente</span>
          </div>
        </div>
      }
    >
      <div
        className="flex flex-col gap-3 pt-24"
        onTouchStartCapture={stopPullToRefreshOnHorizontalGesture}
        onTouchMoveCapture={stopPullToRefreshOnHorizontalGesture}
      >

      {/* Custom Background Sync Bar */}
      <AnimatePresence>
        {showPipelineSync && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, height: 'auto', scale: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="mx-4 sm:mx-6 lg:mx-8 mb-6 relative overflow-hidden"
          >
            <div className="glass-card premium-gradient border-orange-500/20 px-5 py-3.5 flex flex-col gap-3.5 rounded-[32px] shadow-2xl relative z-10">
              {/* Internal Gloss Effect */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20 z-20" />
              
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center relative overflow-hidden">
                       <ShimmerOverlay duration={2} />
                       <RefreshCcw className="h-4 w-4 text-orange-500 animate-spin" />
                    </div>
                    <motion.div 
                      className="absolute -inset-1 rounded-full border border-orange-500/30"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 leading-none">Data Pipeline Sync</span>
                     <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500 relative overflow-hidden">
                          <ShimmerOverlay duration={1.5} />
                        </div>
                        <span className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Transmissão Ativa</span>
                     </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <motion.span 
                    key={refreshStepText}
                    initial={{ opacity: 0, x: 5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[9px] font-black text-orange-400 uppercase tracking-widest truncate max-w-[120px]"
                  >
                    {refreshStepText}
                  </motion.span>
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-mono text-white/20 uppercase tracking-widest">
                      {processedItems} OBJECTS
                    </span>
                    <div className="h-2 w-[1px] bg-white/10" />
                    <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">
                      {refreshProgress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced Progress Indicator */}
              <div className="relative w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-600 via-white/80 to-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.8)] z-10"
                  animate={{ width: `${refreshProgress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                {/* Secondary Pulse Animation */}
                <motion.div 
                  className="absolute inset-0 bg-orange-500/20"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              </div>
            </div>
            
            {/* Background Glow */}
            <div className="absolute -inset-10 bg-orange-500/10 blur-[60px] -z-10 rounded-full animate-pulse-slow" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Highlight: Dynamic User */}
      <AnimatePresence mode="wait">
        {!isAppReady && !error ? (
          <motion.div
            key="loading-splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center px-6 gap-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            {/* Logo Container */}
            <div className="flex items-center gap-4">
              {/* Animated Icon - 3 bars equalizer */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-12 h-12 flex items-end justify-center gap-1.5"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full" />

                {/* Left bar */}
                <motion.div
                  className="relative w-2.5 h-full bg-orange-500 rounded-full origin-bottom"
                  animate={{
                    scaleY: [0.65, 0.95, 0.65],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0
                  }}
                />

                {/* Center bar - tallest */}
                <motion.div
                  className="relative w-2.5 h-full bg-orange-500 rounded-full origin-bottom"
                  animate={{
                    scaleY: [0.85, 1.12, 0.85],
                    opacity: [0.8, 1, 0.8]
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.15
                  }}
                />

                {/* Right bar */}
                <motion.div
                  className="relative w-2.5 h-full bg-orange-500 rounded-full origin-bottom"
                  animate={{
                    scaleY: [0.55, 0.85, 0.55],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.3
                  }}
                />
              </motion.div>

              {/* Text logo - single line */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="text-4xl font-black text-white tracking-tight leading-none whitespace-nowrap">
                  stats.lc
                </span>
              </motion.div>
            </div>

            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <span className="text-xs font-medium text-white/50 tracking-wide">
                sintonizando seu círculo…
              </span>
            </motion.div>

            {/* Subtle pulse indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex items-center gap-1.5 mt-2"
            >
              <motion.div
                className="h-1 w-1 rounded-full bg-orange-500/60"
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="h-1 w-1 rounded-full bg-orange-500/60"
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
              />
              <motion.div
                className="h-1 w-1 rounded-full bg-orange-500/60"
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
              />
            </motion.div>
          </motion.div>
        ) : error ? (
            <motion.div 
             key="error"
             initial={{ opacity: 0, scale: 0.95, y: 10 }} 
             animate={{ opacity: 1, scale: 1, y: 0 }}
             className="glass-card mx-4 sm:mx-6 lg:mx-8 flex flex-col items-center justify-center gap-6 py-12 px-8 border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent rounded-[42px] text-center relative overflow-hidden group shadow-2xl"
            >
               {/* Background Decorative Rings */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
               <div className="absolute -bottom-10 left-0 w-32 h-32 bg-orange-500/5 blur-[60px] rounded-full pointer-events-none" />
               
               <div className="relative flex items-center justify-center h-16 w-16 rounded-[22px] glass border border-white/10 shadow-inner group-hover:scale-105 transition-transform duration-500">
                 <div className="absolute inset-0 bg-orange-500/10 rounded-[22px] blur-xl opacity-50" />
                 {error.toLowerCase().includes('conexão') || isOffline ? (
                   <WifiOff className="h-7 w-7 text-orange-400 relative z-10" />
                 ) : (
                   <AlertTriangle className="h-7 w-7 text-orange-500 relative z-10" />
                 )}
                 <motion.span 
                   animate={{ opacity: [0.3, 1, 0.3] }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="absolute -top-1 -right-1 flex h-4 w-4"
                 >
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-20"></span>
                   <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500/20 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 bg-orange-500 rounded-full" />
                   </span>
                 </motion.span>
               </div>

               <div className="max-w-md relative z-10 flex flex-col gap-3">
                 <h2 className="text-xl font-mundial font-black uppercase tracking-[0.2em] text-white/95">
                   {isOffline || error.toLowerCase().includes('conexão') 
                     ? 'Sincronização Interrompida' 
                     : 'Anomalia no Pipeline'}
                 </h2>
                 <p className="text-sm font-medium text-white/60 leading-relaxed px-4">
                   {isOffline || error.toLowerCase().includes('conexão')
                     ? 'Seu dispositivo oscilou ou a rede está instável. Mas não se preocupe: você ainda pode ver os últimos dados salvos do grupo enquanto recuperamos o sinal.'
                     : 'Encontramos uma instabilidade nos metadados do Last.fm. Nossos algoritmos de scrobbling estão tentando restabelecer o fluxo de dados.'}
                 </p>
                 
                 {typeof error === "string" && !error.toLowerCase().includes('conexão') && (
                   <div className="flex flex-col items-center gap-1.5 mt-2">
                     <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-mono font-bold text-orange-500/50 uppercase tracking-widest">
                       Diagnostics: {error}
                     </span>
                     <span className="text-[10px] font-medium text-white/20 italic">
                       Timestamp local: {new Date().toLocaleTimeString()}
                     </span>
                   </div>
                 )}
               </div>

               <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs relative z-10">
                 <button 
                   onClick={() => fetchGroup(false)}
                   disabled={isLoading || isRefreshing}
                   className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.15em] shadow-[0_10px_25px_rgba(234,88,12,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait"
                 >
                   {isLoading || isRefreshing ? (
                     <Loader2 className="h-4 w-4 animate-spin" />
                   ) : (
                     <RefreshCcw className="h-4 w-4" />
                   )}
                   <span className="truncate">{isLoading || isRefreshing ? "Recalibrando..." : "Forçar Sincronia"}</span>
                 </button>
                 
                 <button 
                   onClick={() => window.location.reload()}
                   className="w-full px-6 py-3.5 glass hover:bg-white/10 text-white/70 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all active:scale-95"
                 >
                   <span className="truncate">Reiniciar App</span>
                 </button>
               </div>

               <div className="flex items-center gap-2 mt-2 opacity-30 hover:opacity-100 transition-opacity cursor-help group-hover:translate-y-[-2px] duration-500">
                  <Sparkles className="h-3 w-3 text-white/50" />
                  <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em]">
                    Algoritmo de Auto-Recuperação Ativo
                  </span>
               </div>
            </motion.div>
        ) : primaryUser ? (
          <div 
            className="flex flex-col gap-3"
          >
            <motion.div 
              key={primaryUser.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-3 overflow-visible"
            >
              <div 
                className="relative -mt-[4px] touch-pan-y overflow-visible"
              >
                <LeoHeader
                  user={primaryUser}
                  streamsToday={primaryUser.streamsToday || 0}
                  onTrackClick={(track) => setSelectedTrack(track)}
                  onAvatarClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setAvatarClickPosition({
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2
                    });
                    setSelectorMode('header');
                    setShowUserSelector(true);
                  }}
                  isHighlighted={headerHighlight}
                />
              </div>

              <div className={cn("px-4 sm:px-6 lg:px-8 transition-[margin] duration-500", friendActivityOffset)}>
                <FriendActivityReel
                  excludeUserId={primaryUser.id}
                  onTrackClick={(track) => setSelectedTrack(track)}
                  onFriendClick={(friend) => setViewingFullHistoryUser(friend)}
                  onViewAll={() => navigate('/circle')}
                />
              </div>
            </motion.div>
          </div>
        ) : groupStats && !isLoading ? (
          <HomeEmptyState onRetry={() => fetchGroup(false)} />
        ) : (
          <HomeSectionLoader />
        )}
      </AnimatePresence>

      {/* Replay Section */}
      {isReplayInitialLoading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="px-4 sm:px-6 lg:px-8 py-8"
        >
          <div className="rounded-[28px] border border-white/10 bg-white/[0.035] px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="h-9 w-28 rounded-2xl bg-white/10 animate-pulse" />
              <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="aspect-[0.82] rounded-[18px] bg-white/[0.07] animate-pulse" />
              ))}
            </div>
            <div className="mt-4 h-3 w-44 rounded-full bg-orange-500/15 animate-pulse" />
          </div>
        </motion.div>
      )}

      {isAppReady && primaryUser && replayState === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 sm:px-6 lg:px-8 py-4"
        >
          <div className="rounded-[28px] border border-orange-500/15 bg-orange-500/[0.04] px-5 py-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <AlertTriangle className="mx-auto h-6 w-6 text-orange-400" />
            <h2 className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-white/85">Replay indisponivel</h2>
            <p className="mx-auto mt-2 max-w-xs text-xs font-medium leading-relaxed text-white/45">
              Nao conseguimos carregar esse periodo agora. Os demais blocos seguem funcionando.
            </p>
            <button
              type="button"
              onClick={() => setReplaySelectedSubValues((values) => ({ ...values }))}
              className="mt-4 rounded-2xl bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/75 active:scale-95"
            >
              Tentar novamente
            </button>
          </div>
        </motion.div>
      )}

      {isAppReady && primaryUser && (replayState === 'ready' || isReplayUpdating) && (
        <div className="relative [contain:layout_paint] [content-visibility:auto] [contain-intrinsic-size:720px]">
          <React.Suspense fallback={<HomeSectionLoader label="Carregando replay" />}>
            <ReplaySection
              topArtists={replayArtists.slice(0, 20).map((a: any) => ({
                id: a.id,
                name: a.name,
                image: a.image,
                streams: getReplayMinutes(a)
              })) || []}
              topTracks={replayTracks.slice(0, 30).map((t: any) => ({
                id: t.id,
                name: t.name,
                artist: getReplayArtistName(t),
                image: t.image || t.albumImage,
                streams: t.playedCount || t.streams || t.playcount || t.count || 0,
                url: getReplayTrackUrl(t),
                spotifyUrl: t.spotifyUrl,
                appleMusicUrl: t.appleMusicUrl,
                spotifyId: t.spotifyId,
                appleMusicId: t.appleMusicId,
                externalIds: t.externalIds || t.track?.externalIds
              })) || []}
              topAlbums={replayAlbums.slice(0, 15).map((a: any) => ({
                id: a.id,
                name: a.name,
                artist: getReplayAlbumArtistName(a, replayTracks),
                image: a.image,
                streams: getReplayMinutes(a)
              })) || []}
              totalMinutesCount={replayTotalMinutesCount}
              activeTab={replayActiveTab}
              selectedSubValues={replaySelectedSubValues}
              onActiveTabChange={setReplayActiveTab}
              onSelectedSubValuesChange={setReplaySelectedSubValues}
              onOpenArtistsModal={() => setOpenReplayModal('artists')}
              onOpenSongsModal={() => setOpenReplayModal('songs')}
              onOpenAlbumsModal={() => setOpenReplayModal('albums')}
              onShareReplay={handleShareReplay}
              onOpenTrack={handleOpenReplayTrack}
              isLoading={isReplayUpdating}
            />
          </React.Suspense>
        </div>
      )}

      {isAppReady && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8 [content-visibility:auto] [contain-intrinsic-size:520px]"
      >
        <FriendsMonthlyHighlights
          periodQuery={replayPeriodQuery}
          activeTab={replayActiveTab}
          selectedSubValues={replaySelectedSubValues}
        />
      </motion.div>
      )}

      {isAppReady && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8 [content-visibility:auto] [contain-intrinsic-size:620px]"
      >
        <HomeInsights onFriendClick={(friend) => setViewingFullHistoryUser(friend)} />
      </motion.div>
      )}

      {isAppReady && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8 [content-visibility:auto] [contain-intrinsic-size:560px]"
      >
        <StatsAlike />
      </motion.div>
      )}

      {/* Toast Notification Container */}
      <div className="fixed bottom-24 right-4 z-[200] flex flex-col gap-3 pointer-events-none w-[calc(100%-32px)] sm:w-80">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto glass-card border-white/10 p-4 rounded-3xl shadow-2xl relative overflow-hidden group"
            >
              <div className={clsx(
                "absolute inset-y-0 left-0 w-1",
                toast.type === 'success' ? "bg-green-500" : toast.type === 'error' ? "bg-red-500" : "bg-orange-500"
              )} />
              <div className="flex gap-3">
                <div className={clsx(
                  "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                  toast.type === 'success' ? "bg-green-500/10 text-green-500" : 
                  toast.type === 'error' ? "bg-red-500/10 text-red-500" : 
                  "bg-orange-500/10 text-orange-500"
                )}>
                  {toast.type === 'success' ? <Check className="h-4 w-4" /> : 
                   toast.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : 
                   <Info className="h-4 w-4" />}
                </div>
                <div className="flex flex-col min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white leading-none">
                      {toast.title}
                    </span>
                    <span className="text-[8px] font-mono text-white/30 ml-auto whitespace-nowrap">
                      {toast.timestamp}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-white/60 mt-1.5 leading-relaxed">
                    {toast.message}
                  </p>
                </div>
                <button 
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="absolute top-2 right-2 p-1 text-white/20 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      </div>
    </PullToRefresh>
    </>
  );
}
