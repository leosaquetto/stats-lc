/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, AudioLines, SlidersHorizontal, WifiOff, Orbit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';
import { SmartImage } from './shared/CommonUI';
import { getCanonicalMembers } from '../lib/memberSelectors';

const EqualizerIcon = () => {
  return (
    <div className="flex items-end gap-[1.5px] h-3 w-3.5 shrink-0 select-none pb-[1px]" aria-hidden="true">
      <motion.span
        animate={{ height: ["20%", "90%", "20%"] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", repeatType: "mirror" }}
        className="w-[1.5px] bg-orange-500 rounded-full inline-block origin-bottom shrink-0"
      />
      <motion.span
        animate={{ height: ["35%", "100%", "35%"] }}
        transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", repeatType: "mirror", delay: 0.15 }}
        className="w-[1.5px] bg-orange-500 rounded-full inline-block origin-bottom shrink-0"
      />
      <motion.span
        animate={{ height: ["15%", "80%", "15%"] }}
        transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut", repeatType: "mirror", delay: 0.3 }}
        className="w-[1.5px] bg-orange-500 rounded-full inline-block origin-bottom shrink-0"
      />
    </div>
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isOffline = useStatsStore(state => state.isOffline);
  const groupStats = useStatsStore(state => state.groupStats);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  
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

  const [showSyncFooter, setShowSyncFooter] = React.useState(false);
  const [highlightedBubbles, setHighlightedBubbles] = React.useState<Record<string, boolean>>({});
  const showSyncFooterRef = React.useRef(false);
  const syncPointerStartRef = React.useRef<{ x: number; y: number; scrollLeft: number } | null>(null);
  const syncDidDragRef = React.useRef(false);

  React.useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const nextShowSyncFooter = window.scrollY > 400;
        if (nextShowSyncFooter !== showSyncFooterRef.current) {
          showSyncFooterRef.current = nextShowSyncFooter;
          setShowSyncFooter(nextShowSyncFooter);
        }
        frame = 0;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

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

  const toggleSyncInfo = () => {
    setIsSyncInfoExpanded(prev => {
      const next = !prev;
      localStorage.setItem('sync_info_expanded', String(next));
      return next;
    });
  };
  
  const shouldShowExpanded = isSyncInfoExpanded;
  
  const navItems = [
    { label: 'Início', icon: Home, path: '/', activePaths: ['/'] },
    { label: 'Stats', icon: AudioLines, path: '/highlights', activePaths: ['/highlights'] },
    { label: 'Órbita', icon: Orbit, path: '/circle', activePaths: ['/circle', '/ranking', '/alike'] },
    { label: 'Ajustes', icon: SlidersHorizontal, path: '/settings', activePaths: ['/settings'] },
  ];

  const lastUpdate = groupStats?.lastUpdated;
  const isStatsOrRanking = location.pathname === '/highlights' || location.pathname === '/ranking';

  return (
    <div className="relative flex min-h-screen w-full max-w-[480px] mx-auto flex-col bg-[#050505] overflow-x-clip overflow-y-visible font-sans">
      {/* Scroll Fade Gradients removed to prevent overlaying headers */}

      {/* Offline Status */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="z-[100] bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 flex items-center justify-center gap-2"
          >
            <WifiOff className="h-3 w-3 text-red-500" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Modo Offline</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Content */}
      <main className="flex-1 w-full pt-[40px] pt-[env(safe-area-inset-top)] pb-[120px] pb-[calc(env(safe-area-inset-bottom)+100px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              duration: 0.2,
              ease: [0.16, 1, 0.3, 1]
            }}
            className="w-full h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Tab Bar (Floating Bottom Nav) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none gap-2">
        {/* Sync Info Footer - aparece apenas quando scrollar */}
        <AnimatePresence>
          {showSyncFooter && lastUpdate && activeMembersSorted.length > 0 && (
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
              layout
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
                layout="position"
                className={clsx(
                  "flex items-center min-w-0",
                  shouldShowExpanded ? "gap-2" : "gap-1"
                )}
              >
                <motion.div 
                  layout="position"
                  className={clsx(
                    "flex items-center min-w-0 transition-all duration-300",
                    shouldShowExpanded 
                      ? "overflow-x-auto no-scrollbar max-w-[95vw] py-1.5 px-0.5 gap-2" 
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
                        layout 
                        key={user.id}
                        animate={isBubbleHighlighted ? {
                          scale: [1, 1.2, 1],
                          filter: [
                            "drop-shadow(0px 0px 0px rgba(249,115,22,0))",
                            "drop-shadow(0px 0px 8px rgba(249,115,22,0.6))",
                            "drop-shadow(0px 0px 0px rgba(249,115,22,0))"
                          ]
                        } : {}}
                        transition={{ duration: 2, ease: "easeInOut" }}
                        className={clsx(
                          "flex items-center gap-2 shrink-0 min-w-0 transition-all duration-300",
                          shouldShowExpanded && "bg-white/[0.07] hover:bg-white/[0.12] pr-3.5 pl-1.5 py-1.5 rounded-full border border-white/10 backdrop-blur-xl shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                          isBubbleHighlighted && !shouldShowExpanded && "relative z-30"
                        )}
                      >
                        {/* Avatar container with Equalizer Overlay (only when expanded) */}
                        <motion.div 
                          layout="position"
                          className="relative shrink-0"
                          animate={isBubbleHighlighted ? {
                            boxShadow: [
                              "0 0 0 0px rgba(249,115,22,0)",
                              "0 0 0 3px rgba(249,115,22,0.6)",
                              "0 0 0 0px rgba(249,115,22,0)"
                            ]
                          } : {}}
                          transition={{ duration: 2, ease: "easeInOut" }}
                          style={{ borderRadius: "9999px" }}
                        >
                          <motion.div layout="position" className={clsx(
                            "rounded-full ring-[1px] ring-white/10 overflow-hidden bg-stone-900 flex items-center justify-center transition-all duration-300",
                            shouldShowExpanded ? "h-6.5 w-6.5" : "h-5 w-5"
                          )}>
                            <SmartImage 
                              src={userAvatar} 
                              className="h-full w-full object-cover" 
                              rounded="full" 
                              fallback={user.name?.charAt(0) || "👤"}
                            />
                          </motion.div>
                          
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
                              layout="position"
                              initial={{ opacity: 0, width: 0, x: -5 }}
                              animate={{ opacity: 1, width: "auto", x: 0 }}
                              exit={{ opacity: 0, width: 0, x: -5 }}
                              transition={{ duration: 0.25 }}
                              className="flex flex-col min-w-0 text-left max-w-[140px] overflow-hidden"
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
                  <motion.div layout="position" className="opacity-80">
                    <EqualizerIcon />
                  </motion.div>
                )}
              </motion.div>
          </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation - Liquid Glass Capsule */}
        <nav className="w-full max-w-[480px] px-4 pb-6 pb-[calc(env(safe-area-inset-bottom)+8px)] pointer-events-auto mx-auto">
          <div className="relative rounded-[9999px] overflow-visible">
            {/* Liquid Glass Container */}
            <div className="relative bg-black/45 backdrop-blur-2xl rounded-[9999px] border border-white/16 shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden">
              {/* Top highlight reflection */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

              {/* Bottom highlight reflection */}
              <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

              {/* Inner glow for depth */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none rounded-[9999px]" />

              {/* Navigation Items Grid */}
              <div className="relative grid grid-cols-4 gap-0 px-3 py-3 min-h-[82px]">
                {navItems.map((item) => {
                  const isActive = item.activePaths.includes(location.pathname);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-label={item.label}
                      className="relative flex flex-col items-center justify-center gap-1.5 outline-none touch-manipulation min-h-[56px]"
                    >
                      {/* Active bubble/pill */}
                      {isActive && (
                        <motion.div
                          layoutId="active-bubble"
                          className="absolute inset-x-1 inset-y-1 rounded-[9999px] bg-gradient-to-b from-orange-500/20 to-orange-600/10 border border-orange-500/30 shadow-[0_4px_16px_rgba(249,115,22,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        >
                          {/* Inner highlight */}
                          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-orange-300/40 to-transparent rounded-t-[9999px]" />

                          {/* Orange glow behind */}
                          <div className="absolute inset-0 bg-orange-500/10 blur-md rounded-[9999px] -z-10" />
                        </motion.div>
                      )}

                      {/* Icon and Label */}
                      <motion.div
                        className="relative z-10 flex flex-col items-center gap-1"
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      >
                        <motion.div
                          animate={{
                            y: isActive ? -1 : 0
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <Icon
                            className={clsx(
                              "transition-all duration-300",
                              isActive
                                ? "h-[30px] w-[30px] text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                                : "h-[28px] w-[28px] text-white/45 hover:text-white/65"
                            )}
                            strokeWidth={isActive ? 2.2 : 1.8}
                          />
                        </motion.div>

                        <span className={clsx(
                          "text-[9px] font-black uppercase tracking-[0.18em] transition-all duration-300 leading-none",
                          isActive
                            ? "text-orange-400"
                            : "text-white/40"
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
      </div>

      {/* Background Atmosphere */}
      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[70%] rounded-full bg-blue-600/[0.07] blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[10%] right-[-10%] h-[40%] w-[60%] rounded-full bg-purple-600/[0.07] blur-[120px] animate-pulse-slow ml-auto" />
        
        {/* Subtle Noise Texture */}
        <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay bg-[url('https://transparenttextures.com/patterns/asfalt-dark.png')]" />
      </div>
    </div>
  );
};
