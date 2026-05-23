import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShimmerOverlay, Skeleton, SmartImage } from '../shared/CommonUI';
import { cn } from '../../lib/utils';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { getArtistListString } from '../../lib/artistUtils';
import { statsCacheService } from '../../services/statsCacheService';
import { useStatsStore } from '../../store/useStatsStore';

interface FriendHistoryCardProps {
  user: any;
  onTrackClick: (track: any) => void;
  index?: number;
}

const EqualizerIcon = () => (
  <div className="flex items-end gap-[1.5px] h-3 mr-2">
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        className="w-[2px] bg-orange-500 rounded-[1px]"
        animate={{ height: ["30%", "100%", "40%"] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
      />
    ))}
  </div>
);

export const FriendHistoryCard = memo(({ 
  user, 
  onTrackClick, 
  index = 0 
}: FriendHistoryCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [recents, setRecents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<any>(null);
  
  const storeUser = useStatsStore(state => state.groupStats?.members?.find(m => m.id === user.id)) || user;
  const animationDuration = useStatsStore(state => state.animationDuration) || 0.5;
  const animationDelay = useStatsStore(state => state.animationDelay) || 0.04;
  
  const isLive = storeUser.nowPlaying?.isNow === true;

  const getHistoryList = (): any[] => {
    if (isLive && user.nowPlaying?.track) {
      const liveTrack = {
        track: user.nowPlaying.track,
        playedAt: new Date().toISOString(),
        isLive: true
      };

      const otherRecents = recents.filter(
        item => item.track?.id !== user.nowPlaying?.track?.id
      );

      return [liveTrack, ...otherRecents.slice(0, 4)];
    }

    return recents.slice(0, 5);
  };

  useEffect(() => {
    let mounted = true;
    const store = useStatsStore.getState();

    const fetchData = async () => {
      try {
        setLoading(true);

        // Primeiro tentamos o cache
        const cachedHistory = store.getHistoryCache(user.id);
        if (cachedHistory && mounted) {
           setRecents(cachedHistory);
           setLoading(false);
           // Mesmo com cache, podemos atualizar em background se quisermos, 
           // mas para performance imediata paramos aqui se tiver cache.
        }

        // Busca histórico completo via service (que já lida com playcounts e cache)
        const historyData = await statsCacheService.cacheUserHistory(user.id);
        
        if (mounted) {
          setRecents(historyData);
        }

        // Stats do topo (Hoje, Mês, Ano)
        const stats = await statsCacheService.cacheUserStats(user.id);
        if (mounted && stats) setUserStats(stats);
      } catch (e) {
        console.error("Failed to load history for", user.id, e);
        if (mounted) setRecents([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (isExpanded) {
      fetchData();
    }
    
    // Initial load of stats if available in cache
    const initialStats = statsCacheService.getStats(user.id);
    if (initialStats && (initialStats.streamsToday > 0 || initialStats.totalStreamsThisMonth > 0)) {
      setUserStats(initialStats);
    }
    
    // Tenta carregar histórico do cache mesmo sem expandir para estar pronto
    const quickHistory = store.getHistoryCache(user.id);
    if (quickHistory && mounted && recents.length === 0) {
      setRecents(quickHistory);
    }

    return () => { mounted = false; };
  }, [user.id, isExpanded]);

  const historyList = getHistoryList();

  const currentStats = userStats || {
    streamsToday: user.streamsToday || 0,
    totalStreamsThisMonth: user.streamsMonth || 0,
    totalStreamsThisYear: user.streamsYear || 0,
    lifetime: user.totalStreams || 0
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ 
        layout: { duration: 0.3, ease: "easeOut" },
        opacity: { duration: animationDuration },
        x: { delay: Math.min((index % 4) * animationDelay, animationDelay * 5), duration: animationDuration, ease: [0.16, 1, 0.3, 1] }
      }}
      className="flex flex-col"
    >
      {/* Header */}
      <motion.button
        layout="position"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center justify-between py-2.5 px-3.5 rounded-[24px] group transition-all relative overflow-hidden",
          isExpanded
            ? "glass-card border-white/20 shadow-2xl"
            : "glass hover:bg-white/[0.08] border-white/10"
        )}
        whileHover={{ scale: 1.015 }}
      >
        {isExpanded && <div className="absolute inset-0 premium-gradient opacity-50 pointer-events-none" />}
        
        <div className="flex items-center gap-3 min-w-0 relative z-10">
          <div className="relative">
            <SmartImage
              src={coreUtils.getUserAvatar(user.id, user.avatar)}
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-full shrink-0 border border-white/20 shadow-lg"
              fallback=""
              rounded="full"
            />
            {isLive && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-orange-500 rounded-full border-2 border-[#050505] flex items-center justify-center shadow-lg"
              >
                 <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
              </motion.div>
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1 text-left">
            <span className="text-[12px] font-bold text-white/90 truncate leading-tight">
              {user.name}
            </span>
            <span className="text-[9.5px] font-medium text-white/50 uppercase tracking-widest mt-0.5">
              {isLive ? (
                <span className="text-orange-400 font-black flex items-center gap-1">
                  Ouvindo Agora
                </span>
              ) : (
                'Ver Histórico'
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center shrink-0">
          {isLive && <EqualizerIcon />}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="text-white/40 shrink-0 text-sm"
          >
            ⌄
          </motion.div>
        </div>
      </motion.button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card premium-gradient rounded-[28px] rounded-t-none border-t-0 -mt-3.5 mx-px relative z-0">
              <div className="absolute inset-0 bg-black/20 pointer-events-none" />
              <div className="relative z-10">
                {currentStats && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    style={{ willChange: "opacity" }}
                    className="px-4 py-4 border-b border-white/5 flex gap-6 text-center"
                  >
                    <motion.div 
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05, ease: "easeOut" }}
                      style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
                      className="flex-1 flex flex-col gap-0.5"
                    >
                      <span className="text-[7px] font-black uppercase tracking-[0.25em] text-white/30 font-sans">
                        Hoje
                      </span>
                      <span className="text-[13px] font-black text-orange-500 font-sans">
                        {currentStats.streamsToday || 0}
                      </span>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
                      style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
                      className="flex-1 flex flex-col gap-0.5"
                    >
                      <span className="text-[7px] font-black uppercase tracking-[0.25em] text-white/30 font-sans">
                        Mês
                      </span>
                      <span className="text-[13px] font-black text-white/90 font-sans">
                        {currentStats.totalStreamsThisMonth || 0}
                      </span>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
                      style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
                      className="flex-1 flex flex-col gap-0.5"
                    >
                      <span className="text-[7px] font-black uppercase tracking-[0.25em] text-white/30 font-sans">
                        Ano
                      </span>
                      <span className="text-[13px] font-black text-white/90 font-sans">
                        {currentStats.totalStreamsThisYear || 0}
                      </span>
                    </motion.div>
                  </motion.div>
                )}

              <div className="p-4 flex flex-col gap-2">
                {loading ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="relative flex flex-col py-2 gap-2 overflow-hidden"
                  >
                    <ShimmerOverlay duration={2.6} />
                    {[0, 1, 2].map((row) => (
                      <motion.div
                        key={row}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: row * 0.05, ease: "easeOut" }}
                        className="flex items-center gap-3 p-2 rounded-xl"
                      >
                        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                          <Skeleton className="h-2.5 w-32 rounded-full" />
                          <Skeleton className="h-2 w-24 rounded-full" />
                        </div>
                        <Skeleton className="h-2 w-10 rounded-full shrink-0" />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : historyList.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-[11px] font-medium text-white/40">Nenhum histórico</span>
                  </div>
                ) : (
                  historyList.map((item, idx) => (
                    <motion.div
                      key={`${item.track?.id}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ willChange: "transform, opacity" }}
                      transition={{ delay: Math.min(idx * 0.04, 0.2), duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => onTrackClick?.(item.track)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.2) + 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
                        className="shrink-0 relative"
                      >
                        <SmartImage
                          src={item.track?.image}
                          className="h-10 w-10 rounded-lg shrink-0"
                          fallback=""
                          rounded="lg"
                        />
                        {item.playCount > 1 && !item.isLive && (
                          <div className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-600 border border-[#111] flex items-center justify-center shadow-lg z-20">
                            <span className="text-[8px] font-black text-white leading-none">{item.playCount > 99 ? '99+' : item.playCount}</span>
                          </div>
                        )}
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, x: -3 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.2) + 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
                        className="flex flex-col min-w-0 flex-1"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-bold text-white/90 truncate leading-tight group-hover:text-orange-400 transition-colors">
                            {item.track?.name}
                          </span>
                          {item.playCount === 1 && (
                            <motion.div 
                               initial={{ opacity: 0, scale: 0.8 }}
                               animate={{ opacity: 1, scale: 1 }}
                               className="flex items-center gap-1 bg-gradient-to-r from-orange-500/20 to-orange-600/20 px-2 py-0.5 rounded-full border border-orange-500/30 shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.15)]"
                             >
                               <div className="relative h-1 w-1 shrink-0">
                                 <div className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-75" />
                                 <div className="relative h-1 w-1 rounded-full bg-orange-500" />
                               </div>
                               <span className="text-[6.5px] font-black text-white uppercase tracking-widest leading-none">Inédito</span>
                            </motion.div>
                          )}
                          {item.track && (
                            <div className="flex items-center gap-1 shrink-0">
                              {coreUtils.detectCatalogAvailability(item.track).hasSpotify && (
                                <img 
                                  src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg"
                                  className="h-2.5 w-2.5 object-contain opacity-60"
                                  alt="Spotify"
                                />
                              )}
                              {coreUtils.detectCatalogAvailability(item.track).hasAppleMusic && (
                                <img 
                                  src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
                                  className="h-2.5 w-2.5 object-contain opacity-60 invert"
                                  alt="Apple Music"
                                />
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] font-medium text-white/50 truncate">
                          {getArtistListString(item.track)}
                        </span>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, x: 3 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.2) + 0.12, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
                        className="flex flex-col items-end gap-0.5 shrink-0"
                      >
                        <span className="text-[7px] font-mono text-white/40">
                          {item.isLive ? '🔴' : coreUtils.formatTimeSP(new Date(item.playedAt))}
                        </span>
                      </motion.div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
  );
});

FriendHistoryCard.displayName = 'FriendHistoryCard';
