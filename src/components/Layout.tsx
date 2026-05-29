/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart3, Settings, WifiOff, Clock, X, HeartHandshake } from 'lucide-react';
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

  const [isScrolled, setIsScrolled] = React.useState(false);
  const [showSyncFooter, setShowSyncFooter] = React.useState(false);
  const [highlightedBubbles, setHighlightedBubbles] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 50;
      setIsScrolled(scrolled);
      // Mostra footer apenas quando scrollar para baixo (sair da área do LeoHeader)
      setShowSyncFooter(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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
    { label: 'Home', icon: Home, path: '/', activePaths: ['/'] },
    { label: 'Stats', icon: BarChart3, path: '/highlights', activePaths: ['/highlights'] },
    { label: 'Circle', icon: HeartHandshake, path: '/circle', activePaths: ['/circle', '/ranking', '/alike'] },
    { label: 'Ajustes', icon: Settings, path: '/settings', activePaths: ['/settings'] },
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
          {showSyncFooter && lastUpdate && (
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
                if (!shouldShowExpanded) {
                  toggleSyncInfo();
                }
              }}
              className={clsx(
                "pointer-events-auto flex items-center mb-1 select-none group relative transition-colors duration-300 overflow-hidden text-left",
                shouldShowExpanded
                  ? "bg-transparent border-none shadow-none h-10 gap-2 max-w-[95vw]"
                  : "cursor-pointer rounded-full bg-white/5 border border-white/5 backdrop-blur-md shadow-lg " +
                    (activeMembersSorted.length > 0 ? "h-7 pl-2.5 pr-2 gap-1.5" : "h-7 w-7 justify-center")
              )}
              title={shouldShowExpanded ? "Minimizar informações" : "Exibir informações de sincronização"}
            >
            {activeMembersSorted.length > 0 ? (
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
                      ? "overflow-x-auto no-scrollbar max-w-[calc(95vw-48px)] py-1.5 px-0.5 gap-2" 
                      : "-space-x-1.5"
                  )}
                  onClick={(e) => {
                    if (shouldShowExpanded) {
                      e.stopPropagation();
                    }
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
                
                {/* Close Button only when expanded to allow easy collapsing since users list has stopPropagation */}
                {shouldShowExpanded && (
                  <motion.button
                    layout="position"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSyncInfo();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 backdrop-blur-md text-white/80 hover:text-white shrink-0 shadow-md cursor-pointer pointer-events-auto ml-1"
                    title="Minimizar informações"
                  >
                    <X className="h-4 w-4" />
                  </motion.button>
                )}

                {/* Global Equalizer in Minimized mode when someone is playing */}
                {!shouldShowExpanded && activeMembersSorted.some(u => u.nowPlaying?.isNow) && (
                  <motion.div layout="position" className="opacity-80">
                    <EqualizerIcon />
                  </motion.div>
                )}
              </motion.div>
            ) : (
              /* Scenario when nobody is actively playing */
              <div 
                className="flex items-center gap-1.5"
                onClick={(e) => {
                  if (shouldShowExpanded) {
                    toggleSyncInfo();
                  }
                }}
              >
                <Clock className="h-3 w-3 text-white/30 group-hover:text-orange-500 transition-colors shrink-0" />
                <AnimatePresence mode="popLayout" initial={false}>
                  {shouldShowExpanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col text-left shrink-0"
                    >
                      <span className="text-[9px] font-black text-white/90 tracking-tight leading-none">Sincronizado</span>
                      <span className="text-[7.5px] font-medium text-white/40 tracking-tight leading-none mt-1">
                        {coreUtils.getTimeAgoSmart(new Date(lastUpdate))}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Scroll dot removed per user request */}
              </div>
            )}
          </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation - sempre visível */}
        <nav className="w-full max-w-[480px] px-3 pb-8 pb-[env(safe-area-inset-bottom)] pointer-events-auto mx-auto">
          <div className="glass-card premium-gradient flex h-[72px] items-center justify-around rounded-[32px] px-1 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-white/15 relative overflow-hidden group">
            {/* Glossy Reflection Overlay */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
            
            {navItems.map((item) => {
              const isActive = item.activePaths.includes(location.pathname);
              const Icon = item.icon;
              
              return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  className={clsx(
                    "relative flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-300 py-2 outline-none",
                    isActive ? "text-orange-500" : "text-white/30 hover:text-white/50"
                  )}
                >
                  <motion.div 
                    className="relative flex flex-col items-center overflow-visible"
                    whileTap={{ scale: 0.85 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <motion.div
                      animate={{ 
                        scale: isActive ? 1.2 : 1,
                        y: isActive ? -2 : 0
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 12 }}
                    >
                      <Icon 
                        className={clsx(
                          "h-5 w-5 transition-colors duration-300",
                          isActive ? "drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" : ""
                        )} 
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                    </motion.div>

                    <span className={clsx(
                      "text-[8px] font-mundial font-bold uppercase tracking-tight transition-all duration-300 mt-1.5",
                      isActive ? "text-orange-500 opacity-100" : "text-white/40 opacity-70"
                    )}>
                      {item.label}
                    </span>
                    
                    {isActive && (
                      <motion.div
                        layoutId="nav-glow"
                        className="absolute -bottom-[22px] h-1.5 w-10 rounded-full bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.6)]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
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
