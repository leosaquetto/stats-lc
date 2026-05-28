
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, AlertTriangle, WifiOff, Users, Sparkles, Loader2, Check, Info, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FriendActivityReel } from '../components/home/FriendActivityReel';
import { ReplaySection, type ReplayFilterPeriod, type ReplaySelectedSubValues } from '../components/home/ReplaySection';
import { UserSelectorModal } from '../components/home/UserSelectorModal';
import { UserSelectorExplosion } from '../components/home/UserSelectorExplosion';
import { VinylRecord } from '../components/home/VinylRecord';
import { TopAlbumsModal, TopArtistsModal, TopSongsModal } from '../components/home/ReplayModals';
import { coreUtils } from '../services/statsCore';
import { statsService, type ReplayPeriodQuery } from '../services/statsService';
import { trackEvent, identifyUser } from '../services/analyticsService';
import { getDominantColor } from '../lib/colorUtils';

// Novos componentes modulares
import {
  LeoHeader,
  LiveGroupOverview,
  LiveGroupOverviewSkeleton,
  FriendHistoryCard,
  UserHistoryModal,
  TrackLeaderboardModal,
  UserAlbumHistoryModal,
  CircleActivityModal,
  TrackHistoryModal,
  SectionHeader,
  SmartImage,
  FriendsMonthlyHighlights,
  StatsAlike,
  ShimmerOverlay
} from '../components/MusicUI';
import { AlbumDetailModal } from '../components/modals/AlbumDetailModal';
import { HomeInsights } from '../components/home/HomeInsights';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const REPLAY_MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

const getReplayQuery = (activeTab: ReplayFilterPeriod, selected: ReplaySelectedSubValues): ReplayPeriodQuery => {
  const now = new Date();
  if (activeTab === 'today') {
    return { period: 'today', after: getStartOfDay(now), limit: 30, force: true };
  }
  if (activeTab === 'week') {
    if (selected.weekMode === 'current') {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      return { period: 'week', after: getStartOfDay(monday), limit: 30, force: true };
    }
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { period: '7days', after: getStartOfDay(sevenDaysAgo), limit: 30, force: true };
  }
  if (activeTab === 'month') {
    const month = Number(selected.month ?? now.getMonth());
    const year = now.getFullYear();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    return { period: 'month', after: start.getTime(), before: end.getTime(), limit: 30, force: true };
  }
  if (activeTab === 'year') {
    const year = Number(selected.year || now.getFullYear());
    return { period: 'year', after: new Date(year, 0, 1).getTime(), before: new Date(year + 1, 0, 1).getTime(), limit: 30, force: true };
  }
  return { period: 'all', limit: 30, force: true };
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

export default function HomeScreen() {
  const {
    groupStats,
    isLoading,
    isRefreshing,
    isOffline,
    error,
    fetchGroup,
    fetchGroupLive,
    prefetchUserTops,
    prefetchNextFriend,
    featuredUserId, 
    setFeaturedUserId,
    hiddenUsers,
    historyOrder,
    historyCustomOrder
  } = useStatsStore();
  
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [selectedTrackHistory, setSelectedTrackHistory] = useState<any>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [viewingFullHistoryUser, setViewingFullHistoryUser] = useState<any>(null);
  const [viewingAlbumHistoryUser, setViewingAlbumHistoryUser] = useState<any>(null);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [avatarClickPosition, setAvatarClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectorMode, setSelectorMode] = useState<'header' | 'mini-header'>('header');
  const [showCircleActivity, setShowCircleActivity] = useState(false);
  const [visibleHistory, setVisibleHistory] = useState(5);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [toasts, setToasts] = useState<any[]>([]);
  const [processedItems, setProcessedItems] = useState(0);
  const [refreshStepText, setRefreshStepText] = useState('Status: Ciclo Sincronizado');
  const [refreshProgress, setRefreshProgress] = useState(100);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [headerHighlight, setHeaderHighlight] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [showInitialModal, setShowInitialModal] = useState(false);
  const [isManualLiveRefresh, setIsManualLiveRefresh] = useState(false);
  const [miniHeaderResolvedColor, setMiniHeaderResolvedColor] = useState('');
  const [replayState, setReplayState] = useState<'idle' | 'loading' | 'ready'>('idle');
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
  const liveRefreshActive = isManualLiveRefresh;
  const userTrackStatsForLayout = useStatsStore(state => state.userTrackStats);

  const allMembers = useMemo(() => {
    const source = groupStats?.members || Object.values(groupStats?.users || {});
    return source.filter((member, index, list) =>
      member?.id && list.findIndex(candidate => candidate?.id === member.id) === index
    );
  }, [groupStats?.members, groupStats?.users]);
  const members = useMemo(() => allMembers.filter(m => !hiddenUsers.includes(m.id)), [allMembers, hiddenUsers]);
  const primaryUser = useMemo(() => members.find(m => m.id === featuredUserId) || null, [members, featuredUserId]);
  const FEATURED_ID = primaryUser?.id;

  // Mini header vinyl states
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
  const currentTrackArenaPlayCount = currentTrackId
    ? Object.values(groupStats?.users || {})
        .filter(member => !hiddenUsers.includes(member.id))
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
        
        setIsHeaderScrolled((current) => {
          if (!current && shouldBeScrolled) return true;
          if (current && shouldBeReset) return false;
          return current;
        });
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

  useEffect(() => {
    let cancelled = false;
    if (!miniHeaderAlbumImage || primaryUser?.nowPlaying?.dominantColor) {
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
  }, [miniHeaderAlbumImage, primaryUser?.nowPlaying?.dominantColor]);

  const handleRefresh = useCallback(async () => {
    setIsManualLiveRefresh(true);
    try {
      await fetchGroupLive(true);
      showToast('Now Playing', 'Tocando agora atualizado.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Now Playing', 'Não foi possível atualizar o tocando agora.', 'error');
    } finally {
      setIsManualLiveRefresh(false);
    }
  }, [fetchGroupLive, showToast]);

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
    if (!primaryUser && members.length > 0 && groupStats && !isLoading) {
      setShowInitialModal(true);
    } else if (primaryUser) {
      setShowInitialModal(false);
    }

    if (primaryUser?.id) {
      prefetchUserTops(featuredUserId);
      prefetchNextFriend(featuredUserId);
    }
  }, [featuredUserId, primaryUser, members, groupStats, isLoading, prefetchUserTops, prefetchNextFriend]);

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
      fetchGroupLive(true);
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
      const timer = setTimeout(() => setIsAppReady(true), 650);
      return () => clearTimeout(timer);
    } else {
      setIsAppReady(false);
    }
  }, [isLoading, groupStats]);

  const [swipeDirection, setSwipeDirection] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const goToNextUser = () => {
    if (members.length <= 1) return;
    setSwipeDirection(1);
    const currentIndex = members.findIndex(m => m.id === FEATURED_ID);
    const nextIndex = (currentIndex + 1) % members.length;
    setFeaturedUserId(members[nextIndex].id);
    trackEvent('user_navigated', { method: 'swipe_right', targetUserId: members[nextIndex].id, targetUserName: members[nextIndex].name });
  };

  const goToPrevUser = () => {
    if (members.length <= 1) return;
    setSwipeDirection(-1);
    const currentIndex = members.findIndex(m => m.id === FEATURED_ID);
    const prevIndex = (currentIndex - 1 + members.length) % members.length;
    setFeaturedUserId(members[prevIndex].id);
    trackEvent('user_navigated', { method: 'swipe_left', targetUserId: members[prevIndex].id, targetUserName: members[prevIndex].name });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    
    // Confirma se o deslize foi principalmente horizontal com limite de 65px
    if (Math.abs(diffX) > Math.abs(diffY)) {
      const minSwipeDistance = 65;
      if (Math.abs(diffX) > minSwipeDistance) {
        if (diffX > 0) {
          // Deslizou para a esquerda (próximo amigo)
          goToNextUser();
        } else {
          // Deslizou para a direita (amigo anterior)
          goToPrevUser();
        }
      }
    }
    
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const cycleUser = () => {
    goToNextUser();
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : direction < 0 ? -100 : 0,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 350, damping: 35 },
        opacity: { duration: 0.25 },
      }
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : direction > 0 ? -100 : 0,
      opacity: 0,
      transition: {
        x: { type: 'spring' as const, stiffness: 350, damping: 35 },
        opacity: { duration: 0.2 },
      }
    })
  };

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

  const friendsSelection = useMemo(() => members.filter(u => u && u.id && u.id !== FEATURED_ID), [members, FEATURED_ID]);
  
  const sortedFriends = useMemo(() => {
    return [...friendsSelection].sort((a, b) => a.name.localeCompare(b.name));
  }, [friendsSelection]);

  const recentTracks = useMemo(() => {
    return members
      .filter(u => u && u.id)
      .sort((a, b) => {
        if (a.id === FEATURED_ID) return -1;
        if (b.id === FEATURED_ID) return 1;
        
        const order = historyOrder || 'lastPlayed';
        if (order === 'alphabetical') {
          return (a.name || '').localeCompare(b.name || '');
        } else if (order === 'custom') {
          const arr = historyCustomOrder || [];
          const indexA = arr.indexOf(a.id);
          const indexB = arr.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        } else {
          const timeA = new Date(a.nowPlaying?.timestamp || 0).getTime();
          const timeB = new Date(b.nowPlaying?.timestamp || 0).getTime();
          return timeB - timeA;
        }
      });
  }, [members, FEATURED_ID, historyOrder, historyCustomOrder]);

  useEffect(() => {
    let cancelled = false;
    if (!primaryUser?.id) {
      setReplayState('idle');
      setReplayTopItems({ artists: [], tracks: [], albums: [] });
      setReplayTotalMinutesCount(0);
      return;
    }

    setReplayState('loading');
    statsService.getReplayData(primaryUser.id, replayPeriodQuery)
      .then((replay) => ({
        artists: replay.topArtists,
        tracks: replay.topTracks,
        albums: replay.topAlbums,
        totalSongs: replay.totalSongs,
        totalDurationMs: replay.totalDurationMs
      }))
      .catch(async () => {
        const [artists, tracks, albums] = await Promise.all([
          statsService.getTopItems(primaryUser.id, 'artists', replayPeriodQuery).catch(() => []),
          statsService.getTopItems(primaryUser.id, 'tracks', replayPeriodQuery).catch(() => []),
          statsService.getTopItems(primaryUser.id, 'albums', replayPeriodQuery).catch(() => [])
        ]);
        return { artists, tracks, albums, totalSongs: undefined, totalDurationMs: undefined };
      })
      .then(({ artists, tracks, albums, totalSongs, totalDurationMs }) => {
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
    };
  }, [primaryUser?.id, replayPeriodQuery, replayActiveTab]);

  const replayArtists = replayTopItems.artists;
  const replayTracks = replayTopItems.tracks;
  const replayAlbums = replayTopItems.albums;
  const replayModalPeriod = getReplayModalPeriod(replayActiveTab, replaySelectedSubValues);
  const hasReplayData = replayArtists.length > 0 || replayTracks.length > 0 || replayAlbums.length > 0;
  const isReplayInitialLoading = isAppReady && !!primaryUser && replayState !== 'ready' && !hasReplayData;
  const isReplayUpdating = isAppReady && !!primaryUser && replayState !== 'ready' && hasReplayData;
  const showPipelineSync = false;
  return (
    <>
      {createPortal(
        <>
          <AnimatePresence>
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

            <CircleActivityModal
              isOpen={showCircleActivity}
              onClose={() => setShowCircleActivity(false)}
              onTrackClick={(track) => setSelectedTrack(track)}
              onFriendClick={(friend) => {
                setShowCircleActivity(false);
                setViewingFullHistoryUser(friend);
              }}
            />

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
            {selectedTrackHistory && (
              <TrackHistoryModal 
                track={selectedTrackHistory}
                onClose={() => setSelectedTrackHistory(null)}
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
          <header
            style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top, 0px))' }}
            className={cn(
              "fixed top-0 left-0 right-0 z-[150] flex items-center justify-end px-4 sm:px-6 lg:px-8 py-3.5 transition-all duration-500 ease-out will-change-transform",
              isHeaderScrolled
                ? "translate-y-0 opacity-100 pointer-events-auto"
                : "-translate-y-4 opacity-0 pointer-events-none"
            )}
          >
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-2 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl supports-[backdrop-filter]:bg-black/35">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefresh();
                }}
                disabled={liveRefreshActive}
                title="Atualizar tocando agora"
                aria-label="Atualizar tocando agora"
                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] active:scale-95 transition-all group shrink-0 disabled:opacity-50 disabled:cursor-wait"
              >
                <RefreshCcw
                  className={cn(
                    "h-4 w-4 text-white/45 group-hover:text-white transition-colors",
                    liveRefreshActive && "animate-spin text-orange-500"
                  )}
                />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setAvatarClickPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                  });
                  setSelectorMode('mini-header');
                  setShowUserSelector(true);
                }}
                title="Selecionar Usuário"
                aria-label="Selecionar Usuário"
                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] cursor-pointer active:scale-95 transition-all p-[1px] shrink-0 overflow-hidden"
              >
                <SmartImage
                  src={primaryUser ? coreUtils.getUserAvatar(primaryUser.id, primaryUser.avatar) : ""}
                  className="h-full w-full object-cover"
                  fallback=""
                  rounded="full"
                />
              </button>

              {hasMiniHeaderAlbumImage && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="h-12 w-12 -ml-1 shrink-0"
                >
                  <VinylRecord
                    albumImage={miniHeaderAlbumImage}
                    dominantColor={miniHeaderDominantColor || ""}
                    isPlaying={miniHeaderIsPlaying}
                    progressMs={0}
                    durationMs={undefined}
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    hideTonearm={true}
                  />
                </motion.div>
              )}
            </div>
          </header>
        </>,
        document.body
      )}

      <PullToRefresh 
      onRefresh={handleRefresh}
      pullingContent={
        <div className="flex flex-col items-center justify-center pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-9 gap-3 border-b border-orange-500/10 select-none bg-black/70 backdrop-blur-2xl shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <div className="h-11 w-11 rounded-full border border-orange-500/25 bg-orange-500/10 flex items-center justify-center shadow-[0_0_24px_rgba(249,115,22,0.18)]">
            <RefreshCcw className="h-4 w-4 text-orange-300" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.32em] text-white/55">
            Puxe para atualizar
          </span>
        </div>
      }
      refreshingContent={
        <div className="flex flex-col items-center justify-center pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-9 gap-3 border-b border-orange-500/10 select-none bg-black/75 backdrop-blur-2xl shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <div className="h-11 w-11 rounded-full border border-orange-500/30 bg-orange-500/12 flex items-center justify-center shadow-[0_0_28px_rgba(249,115,22,0.24)]">
            <RefreshCcw className="h-4 w-4 text-orange-500 animate-spin" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.32em] text-white/60">
            Atualizando agora
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pt-24">

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
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center px-6 gap-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.8, 1, 0.8]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-48 h-auto"
            >
              <img src="/statslc_white.svg" alt="Stats LC" className="w-full h-full" />
            </motion.div>
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                className="h-2 w-2 rounded-full bg-orange-500"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="h-2 w-2 rounded-full bg-orange-500"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="h-2 w-2 rounded-full bg-orange-500"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
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
                   onClick={() => fetchGroup(true)}
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
              custom={swipeDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col gap-3 overflow-visible"
            >
              <div 
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
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
                  onViewAll={() => setShowCircleActivity(true)}
                />
              </div>
            </motion.div>
          </div>
        ) : null}
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

      {isAppReady && primaryUser && (replayState === 'ready' || isReplayUpdating) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
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
              streams: t.playedCount || t.streams || t.playcount || t.count || 0
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
            isLoading={isReplayUpdating}
          />
        </motion.div>
      )}

      {isAppReady && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8"
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
        className="px-4 sm:px-6 lg:px-8"
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
        className="px-4 sm:px-6 lg:px-8"
      >
        <StatsAlike />
      </motion.div>
      )}

      {isAppReady && groupStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="px-4 sm:px-6 lg:px-8"
        >
        <div className="custom-scrollbar scroll-fade-v">
          <LiveGroupOverview 
            users={members} 
            lastUpdate={groupStats.lastUpdated}
          />
        </div>
        </motion.div>
      )}

      {!groupStats && isLoading && (
        <div className="px-4 sm:px-6 lg:px-8">
          <LiveGroupOverviewSkeleton />
        </div>
      )}

      {isAppReady && (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8 -mt-2"
      >
        <SectionHeader title="Timeline da Sessão" />
      </motion.div>
      )}
      {isAppReady && (
      <div className="flex flex-col gap-2 custom-scrollbar h-auto overflow-hidden px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            [1, 2, 3, 4, 5].map(i => (
              <motion.div 
                key={`hist-skeleton-${i}`} 
                initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col"
              >
                <div className="flex items-center justify-between p-3.5 rounded-[28px] glass border-white/10 relative overflow-hidden bg-white/[0.01]">
                  <ShimmerOverlay duration={3} />
                  <div className="flex items-center gap-3.5 min-w-0 z-10 w-full relative">
                    <div className="relative shrink-0">
                      <div className="h-12 w-12 rounded-full bg-white/5 border border-white/5 shadow-inner" />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="h-3 w-32 bg-white/10 rounded-full" />
                      <div className="h-2 w-20 bg-white/5 rounded-full" />
                    </div>
                  </div>
                  <div className="h-3 w-8 bg-white/10 rounded-full shrink-0 mr-1 relative z-10" />
                </div>
              </motion.div>
            ))
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              {recentTracks.slice(0, visibleHistory).map((user, idx) => (
                <motion.div
                  layout
                  key={`${user.id || 'hist'}-${idx}`}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ 
                    opacity: { duration: 0.2 },
                    layout: { type: "spring", stiffness: 350, damping: 35 }
                  }}
                >
                  <FriendHistoryCard
                    user={user}
                    index={idx}
                    onTrackClick={setSelectedTrackHistory}
                    onFullHistoryClick={(u) => setViewingFullHistoryUser(u)}
                    showFullHistoryButton={timelineExpanded}
                    showInlineHistory
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          
          {!isLoading && recentTracks.length > visibleHistory && (
            <button
              onClick={() => {
                setTimelineExpanded(true);
                setVisibleHistory(recentTracks.length);
              }}
              className="w-full mt-2 mb-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white/80 glass rounded-[28px] border border-white/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 group"
            >
              <Users className="h-3.5 w-3.5 text-orange-500/50 group-hover:text-orange-500 transition-colors" />
              <span>Expandir todos</span>
            </button>
          )}
      </div>
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
