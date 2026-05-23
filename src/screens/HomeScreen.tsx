
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, AlertTriangle, WifiOff, Users, ArrowDown, Sparkles, Loader2, Check, Info, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FriendActivityReel } from '../components/home/FriendActivityReel';
import { coreUtils } from '../services/statsCore';
import { trackEvent, identifyUser } from '../services/analyticsService';

// Novos componentes modulares
import {
  LeoHeader,
  HomeHighlights,
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

export default function HomeScreen() {
  const { 
    groupStats, 
    isLoading, 
    isRefreshing, 
    isLiveFetching,
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
  const [showCircleActivity, setShowCircleActivity] = useState(false);
  const [visibleHistory, setVisibleHistory] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [toasts, setToasts] = useState<any[]>([]);
  const [processedItems, setProcessedItems] = useState(0);
  const [refreshStepText, setRefreshStepText] = useState('Status: Ciclo Sincronizado');
  const [refreshProgress, setRefreshProgress] = useState(100);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [headerHighlight, setHeaderHighlight] = useState(false);
  const toastIdRef = useRef(0);

  const allMembers = groupStats?.members || [];
  const members = useMemo(() => allMembers.filter(m => !hiddenUsers.includes(m.id)), [allMembers, hiddenUsers]);
  const primaryUser = useMemo(() => members.find(m => m.id === featuredUserId) || members[0], [members, featuredUserId]);
  const FEATURED_ID = primaryUser?.id;

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

  const showToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${toastIdRef.current++}`;
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setToasts(prev => [...prev, { id, title, message, type, timestamp }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const handleRefresh = async () => {
    try {
      await fetchGroupLive();
      showToast('Sincronização Live', 'Status do grupo atualizado com sucesso.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Filtro de Ruído', 'Não foi possível completar a sincronização live.', 'error');
    }
  };

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
    if (!featuredUserId && members.length > 0) {
      setFeaturedUserId(members[0].id);
    }

    if (featuredUserId) {
      // Phase 3: Proactive Data Loading
      // 1. Priority Prefetch for current featured user
      prefetchUserTops(featuredUserId);
      // 2. Background Warm-up for the next friend in carousel
      prefetchNextFriend(featuredUserId);
    }
  }, [featuredUserId, members, setFeaturedUserId, prefetchUserTops, prefetchNextFriend]);

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

  const friendsSelection = useMemo(() => members.filter(u => u && u.id && u.id !== FEATURED_ID), [members, FEATURED_ID]);
  
  const sortedFriends = useMemo(() => {
    return [...friendsSelection].sort((a, b) => a.name.localeCompare(b.name));
  }, [friendsSelection]);

  const recentTracks = useMemo(() => {
    return members
      .filter(u => u && u.id)
      .sort((a, b) => {
        if (a.id === featuredUserId) return -1;
        if (b.id === featuredUserId) return 1;
        
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
  }, [members, featuredUserId, historyOrder, historyCustomOrder]);
  return (
    <>
      {createPortal(
        <>
          <AnimatePresence>
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
            
            {showUserSelector && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowUserSelector(false)}
                  className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  className="fixed top-[calc(env(safe-area-inset-top,0px)+76px)] right-4 sm:right-10 w-64 glass-card border-white/10 p-2 z-[120] shadow-2xl backdrop-blur-3xl overflow-hidden rounded-3xl"
                >
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 px-3 py-2.5 mb-1 border-b border-white/5">Selecionar Usuário</div>
                  <div className="flex flex-col gap-1.5 mt-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {members.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setFeaturedUserId(u.id);
                          setShowUserSelector(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all",
                          featuredUserId === u.id 
                            ? "bg-white/10 border border-white/10 shadow-lg" 
                            : "hover:bg-white/5 opacity-70 hover:opacity-100"
                        )}
                      >
                        <div className={cn(
                          "rounded-full border overflow-hidden relative shrink-0 transition-all duration-300",
                          featuredUserId === u.id 
                            ? "h-11 w-11 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]" 
                            : "h-9 w-9 border-white/10"
                        )}>
                            <SmartImage 
                              src={coreUtils.getUserAvatar(u.id, u.avatar)} 
                              className="h-full w-full object-cover" 
                              fallback=""
                              rounded="full"
                            />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className={cn(
                            "text-sm font-bold transition-colors truncate w-full",
                            featuredUserId === u.id ? "text-white" : "text-white/80"
                          )}>
                            {u.name}
                          </span>
                        </div>
                        {featuredUserId === u.id && (
                          <div className="ml-auto h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Top Bar Navigation - Floating */}
          <header
            style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top, 0px))' }}
            className={cn(
              "fixed top-0 left-0 right-0 z-[150] flex justify-end px-4 sm:px-6 lg:px-8 py-3.5 transition-all duration-500 ease-out will-change-transform",
              isHeaderScrolled
                ? "translate-y-0 opacity-100 pointer-events-auto"
                : "-translate-y-4 opacity-0 pointer-events-none"
            )}
          >
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-2 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <button
                onClick={handleRefresh}
                disabled={isLiveFetching || isRefreshing}
                title="Sincronizar Live"
                aria-label="Sincronizar Live"
                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] backdrop-blur-md active:scale-95 transition-all group shrink-0 disabled:opacity-50 disabled:cursor-wait"
              >
                <RefreshCcw
                  className={cn(
                    "h-4 w-4 text-white/45 group-hover:text-white transition-colors",
                    (isLiveFetching || isRefreshing) && "animate-spin text-orange-500"
                  )}
                />
              </button>
              <button
                onClick={() => setShowUserSelector(true)}
                title="Selecionar Usuário"
                aria-label="Selecionar Usuário"
                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] backdrop-blur-md cursor-pointer active:scale-95 transition-all p-[1px] shrink-0 overflow-hidden"
              >
                <SmartImage
                  src={primaryUser ? coreUtils.getUserAvatar(primaryUser.id, primaryUser.avatar) : ""}
                  className="h-full w-full object-cover"
                  fallback=""
                  rounded="full"
                />
              </button>
            </div>
          </header>
        </>,
        document.body
      )}

      <PullToRefresh 
      onRefresh={handleRefresh}
      pullingContent={
        <div className="flex flex-col items-center justify-center py-14 gap-6 bg-gradient-to-b from-orange-500/[0.1] via-orange-500/[0.02] to-transparent border-b border-white/5 select-none transition-all duration-300 relative overflow-hidden">
          {/* Depth Scanning Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.1)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] opacity-20" />
          
          <div className="relative">
            {/* Outer Rings */}
            <motion.div 
               className="absolute -inset-8 rounded-full border border-orange-500/10"
               animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.1, 0.3, 0.1] }}
               transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div 
               className="absolute -inset-4 rounded-full border border-orange-500/20"
               animate={{ rotate: 360 }}
               transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />
            
            <div className="h-16 w-16 rounded-2xl glass border border-orange-500/30 flex items-center justify-center bg-black/60 shadow-[0_0_30px_rgba(249,115,22,0.2)] relative z-10 backdrop-blur-xl group">
              <motion.div
                animate={{ 
                  y: [0, 4, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ArrowDown className="h-7 w-7 text-orange-400 opacity-70 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            </div>

            {/* Scanning Line */}
            <motion.div 
              className="absolute left-[-40px] right-[-40px] h-[1px] bg-gradient-to-r from-transparent via-orange-500 to-transparent z-20"
              animate={{ top: ['0%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          </div>
          
          <div className="flex flex-col items-center gap-2 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40 font-display">
              Puxe para Sincronizar
            </span>
            <div className="flex items-center gap-2 opacity-30">
              <div className="h-[1px] w-4 bg-white/20" />
              <span className="text-[7px] font-mono uppercase tracking-widest text-white/60">Ready to Handshake</span>
              <div className="h-[1px] w-4 bg-white/20" />
            </div>
          </div>
        </div>
      }
      refreshingContent={
        <div className="flex flex-col items-center justify-center py-20 gap-12 bg-[#020202] border-b border-orange-500/50 select-none shadow-[inset_0_-60px_120px_rgba(249,115,22,0.15)] relative overflow-hidden h-[90vh]">
          {/* Enhanced Background Effects */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.12)_0%,transparent_75%)]" />
          <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/real-carbon-fibre.png')] opacity-[0.04] mix-blend-overlay" />
          
          {/* Vertical Stream Lines */}
          <div className="absolute inset-x-0 top-0 bottom-0 overflow-hidden pointer-events-none">
            {pipelineStreamLinesMemo.map((line, i) => (              <motion.div
                key={i}
                className="absolute w-[1px] bg-gradient-to-b from-transparent via-orange-500/20 to-transparent"
                style={{ left: line.left, height: '100%' }}
                animate={{ 
                  opacity: [0, 1, 0],
                  top: ['-50%', '100%']
                }}
                transition={{ 
                  duration: line.duration,
                  repeat: Infinity, 
                  delay: line.delay,
                  ease: "linear"
                }}
              />
            ))}
          </div>
          
          {/* Circular HUD - Advanced Version */}
          <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none">
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
               className="h-[600px] w-[600px] rounded-full border border-orange-500/5 absolute" 
             />
             <motion.div 
               animate={{ rotate: -360 }}
               transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
               className="h-[450px] w-[450px] rounded-full border border-dashed border-orange-500/10 absolute" 
             />
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
               className="h-96 w-96 rounded-full border-t border-orange-500/40 absolute" 
             />
             
             {/* Data Points */}
             {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
               <motion.div
                 key={angle}
                 className="absolute h-1 w-1 bg-orange-400 rounded-full"
                 animate={{ opacity: [0, 1, 0] }}
                 transition={{ duration: 1.5, repeat: Infinity, delay: angle / 360 }}
                 style={{ 
                   transform: `rotate(${angle}deg) translate(225px)` 
                 }}
               />
             ))}
          </div>

          <div className="relative z-40 flex flex-col items-center gap-12 w-full max-w-sm px-8">
            {/* Core Processor High Fidelity Overlay */}
            <div className="relative flex items-center justify-center h-28 w-28">
              <motion.div 
                className="absolute inset-0 rounded-[40px] border-2 border-orange-500/40 shadow-[0_0_50px_rgba(249,115,22,0.5)]"
                animate={{ 
                  rotate: [0, 90, 0], 
                  borderRadius: ["40px", "56px", "40px"],
                  scale: [1, 1.08, 1]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
              
              <div className="h-14 w-14 bg-[#080808] border border-orange-500/30 rounded-2xl flex items-center justify-center shadow-inner relative overflow-hidden group">
                 <motion.div 
                   className="absolute inset-0 bg-orange-500/10" 
                   animate={{ opacity: [0.1, 0.4, 0.1] }} 
                   transition={{ duration: 2, repeat: Infinity }} 
                 />
                 <motion.div 
                   animate={{ rotate: 360 }}
                   transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                 >
                    <RefreshCcw className="h-6 w-6 text-orange-500" />
                 </motion.div>
              </div>
            </div>

            {/* Diagnostic Interface Upgrade */}
            <div className="flex flex-col items-center gap-6 w-full glass border-white/10 p-7 rounded-[40px] shadow-3xl relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent" />
               
               <AnimatePresence mode="wait">
                <motion.div 
                  key={refreshStepText}
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 1.05 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex flex-col items-center gap-4 w-full"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-mono font-black text-orange-500/50 uppercase tracking-[0.4em] leading-none mb-1">Status do Pipeline</span>
                    <h2 className="text-[14px] font-black text-white uppercase tracking-[0.25em] font-display text-center leading-tight">
                      {refreshStepText}
                    </h2>
                  </div>
                  
                  <div className="w-full flex flex-col gap-5 mt-4">
                     <div className="flex items-center justify-between px-1">
                        <span className="text-[7px] font-mono text-orange-500/60 uppercase tracking-widest">Processamento Digital</span>
                        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Nodes: {processedItems} unidades</span>
                     </div>
                     <div className="h-[4px] w-full bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                       <motion.div 
                         className="h-full bg-gradient-to-r from-orange-600 via-white to-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.8)]" 
                         animate={{ width: `${refreshProgress}%` }} 
                         transition={{ duration: 0.7, ease: "linear" }} 
                       />
                     </div>
                     
                     {/* Stream Analytics Panel */}
                     <div className="grid grid-cols-2 gap-2.5 w-full">
                        <div className="flex flex-col gap-1 px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/5">
                           <span className="text-[6px] font-bold text-white/30 uppercase tracking-[0.2em] leading-none">Latência de Sync</span>
                           <span className="text-[10px] font-black text-orange-500/70 font-mono tracking-widest">{12 + (processedItems % 9)}ms</span>
                        </div>
                        <div className="flex flex-col gap-1 px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/5 items-end text-right">
                           <span className="text-[6px] font-bold text-white/30 uppercase tracking-[0.2em] leading-none">Estabilidade</span>
                           <span className="text-[10px] font-black text-green-500/70 font-mono tracking-widest">99.8%</span>
                        </div>
                     </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Status Ticker */}
            <div className="flex flex-col items-center gap-3 opacity-30">
               <div className="flex items-center gap-3">
                 <div className="h-1 w-1 rounded-full bg-orange-500 animate-ping" />
                 <span className="text-[7px] font-black text-white uppercase tracking-[0.4em] font-mono">X-Terminal Linked</span>
               </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pt-24">

      {/* Custom Background Sync Bar */}
      <AnimatePresence>
        {isRefreshing && (
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
        {isLoading && !primaryUser ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 gap-6 min-h-[60vh] text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="text-orange-500"
            >
              <Loader2 className="h-10 w-10" />
            </motion.div>
            <div className="flex flex-col items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">Sincronizando Loop...</h3>
              <p className="text-[11px] font-medium text-white/40">Conectando ao gateway de scrobbling e processando métricas</p>
            </div>
          </div>
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
                className="relative -mt-[4px] touch-pan-y"
              >
                <LeoHeader 
                  user={primaryUser}
                  streamsToday={primaryUser.streamsToday || 0} 
                  onTrackClick={(track) => setSelectedTrack(track)}
                  onAvatarClick={() => setShowUserSelector(true)}
                  isHighlighted={headerHighlight}
                />
              </div>

              <div className="px-4 sm:px-6 lg:px-8">
                <FriendActivityReel 
                  excludeUserId={primaryUser.id}
                  onTrackClick={(track) => setSelectedTrack(track)} 
                  onFriendClick={(friend) => setViewingFullHistoryUser(friend)}
                  onViewAll={() => setShowCircleActivity(true)}
                />

                <HomeHighlights userId={primaryUser.id} onItemClick={(item, type) => {
                  if (type === 'album') setSelectedAlbum(item);
                  else setSelectedTrack(item); 
                }} />
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-6 gap-6 min-h-[60vh] text-center">
            <div className="h-16 w-16 rounded-[22px] bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shadow-xl shadow-orange-500/5">
              <Users className="h-7 w-7" />
            </div>
            <div className="max-w-md flex flex-col gap-2">
              <h3 className="text-lg font-black text-white/95 uppercase tracking-wider">Identifique seu Perfil</h3>
              <p className="text-sm font-medium text-white/50 leading-relaxed">
                Nenhum usuário ativo foi selecionado ou salvo. Selecione o seu perfil no modal de início para acessar as estatísticas personalizadas da sua Arena do Loop.
              </p>
            </div>
            <button
              onClick={() => fetchGroup(true)}
              className="flex items-center gap-2 px-6 py-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_10px_20px_rgba(234,88,12,0.25)]"
            >
              <RefreshCcw className="h-4 w-4" />
              Sincronizar Loop
            </button>
          </div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8"
      >
        <FriendsMonthlyHighlights />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8"
      >
        <HomeInsights onFriendClick={(friend) => setViewingFullHistoryUser(friend)} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8"
      >
        <StatsAlike />
      </motion.div>

      {groupStats && (
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

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8 -mt-2"
      >
        <SectionHeader title="Timeline da Sessão" />
      </motion.div>
      <div className="flex flex-col gap-2 custom-scrollbar scroll-fade-v h-auto overflow-hidden px-4 sm:px-6 lg:px-8">
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
                  key={user.id || `hist-${idx}`}
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
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          
          {!isLoading && recentTracks.length > visibleHistory && (
            <button
              onClick={() => setShowCircleActivity(true)}
              className="w-full mt-2 mb-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white/80 glass rounded-[28px] border border-white/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 group"
            >
              <Users className="h-3.5 w-3.5 text-orange-500/50 group-hover:text-orange-500 transition-colors" />
              <span>Ver Atividade Completa</span>
            </button>
          )}
      </div>

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
