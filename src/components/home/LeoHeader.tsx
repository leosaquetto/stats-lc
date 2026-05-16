import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Headphones, ChevronLeft, Music2 } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { formatTimeSP } from '../../lib/time';
import { UserStats } from '../../types/stats';
import { 
  SmartImage, 
  MusicPlatformBadge, 
  ScrollingText, 
  AnimatedNumber 
} from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LiveTrackProgress = ({ 
  progressMs,
  playedMs, 
  durationMs, 
  timestamp, 
  isNowPlaying,
  platform
}: { 
  progressMs?: number,
  playedMs?: number, 
  durationMs?: number, 
  timestamp: string | number,
  isNowPlaying: boolean;
  platform: "spotify" | "appleMusic" | "unknown";
}) => {
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    if (!isNowPlaying) {
      setCurrentProgress(100);
      return;
    }

    const baseProgress = progressMs ?? playedMs ?? 0;
    
    if (durationMs) {
      const calculateProgress = () => {
        const startTime = new Date(timestamp).getTime();
        const now = Date.now();
        const elapsedSinceLog = Math.max(0, now - startTime);
        const totalProgressMs = baseProgress + elapsedSinceLog;
        const percent = (totalProgressMs / durationMs) * 100;
        setCurrentProgress(Math.min(percent, 100));
      };

      calculateProgress();
      const interval = setInterval(calculateProgress, 1000);
      return () => clearInterval(interval);
    } 
    else if (isNowPlaying) {
      const interval = setInterval(() => {
        setCurrentProgress(prev => (prev + 0.5) % 100);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setCurrentProgress(100);
    }
  }, [progressMs, playedMs, durationMs, timestamp, isNowPlaying, platform]);

  if (!isNowPlaying) {
    return (
      <div className="flex flex-col gap-1.5 opacity-20">
        <div className="h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
           <div className="h-full w-full bg-white/30" />
        </div>
        <div className="flex justify-between items-center px-0.5">
           <span className="text-[7px] font-black uppercase tracking-widest text-white/30">Concluído</span>
           {durationMs && (
              <span className="text-[7.5px] font-mono text-white/30">{coreUtils.formatDurationSmart(durationMs)}</span>
           )}
        </div>
      </div>
    );
  }

  if (!durationMs) {
     return (
       <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <motion.div 
            animate={{ x: ["-100%", "100%"] }} 
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="h-full w-1/3 bg-orange-500/20" 
          />
       </div>
     );
  }

  const elapsedMs = (currentProgress / 100) * durationMs;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden relative">
        <motion.div 
          initial={false}
          animate={{ width: `${currentProgress}%` }}
          transition={{ ease: "linear", duration: 1 }}
          className="h-full bg-gradient-to-r from-orange-600 via-orange-400 to-yellow-500 shadow-[0_0_8px_rgba(255,159,10,0.4)]" 
        />
      </div>
      <div className="flex justify-between items-center px-0.5">
        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest leading-none">
           {coreUtils.formatDurationSmart(elapsedMs)}
        </span>
        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest leading-none">
           {coreUtils.formatDurationSmart(durationMs)}
        </span>
      </div>
    </div>
  );
};

export const LeoHeader = ({ user, streamsToday, onTrackClick }: { user: UserStats, streamsToday: number, onTrackClick?: (track: any) => void }) => {
  if (!user) return null;
  const accentColor = ({id: "leo", name: "Leo", color: "#FF9F0A"}).color;
  const profileAvatar = coreUtils.getUserAvatar(user.id, user.avatar);
  const nowPlaying = user.nowPlaying;
  const track = nowPlaying?.track;
  const albumImage = track?.image;
  const playback = coreUtils.getPlaybackStatus({ nowPlaying });
  const isActuallyLive = playback.status === "live";
  const platform = user.platform || coreUtils.getUserPlaybackPlatform(user.id);
  
  const [arenaExpanded, setArenaExpanded] = useState(false);
  
  const fetchTrackStatsForAll = useStatsStore(state => state.fetchTrackStatsForAll);
  const userTrackStats = useStatsStore(state => state.userTrackStats);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const hideRankingBadge = useStatsStore(state => state.hideRankingBadge);
  const groupStats = useStatsStore(state => state.groupStats);
  const membersData = groupStats?.users || {};

  const trackStatsKey = `${user.id}:${track?.id}`;
  const playCount = userTrackStats[trackStatsKey];

  useEffect(() => {
    if (track?.id) {
      fetchTrackStatsForAll(track.id);
    }
  }, [track?.id, fetchTrackStatsForAll]);

  const allTrackArenaUsers = Object.values(membersData)
    .map(u => ({
      id: u.id,
      name: u.name,
      plays: userTrackStats[`${u.id}:${track?.id}`] || 0,
      avatar: coreUtils.getUserAvatar(u.id, u.avatar)
    }))
    .filter(u => u.plays > 0)
    .sort((a, b) => b.plays - a.plays);

  const trackArenaUsers = arenaExpanded ? allTrackArenaUsers : allTrackArenaUsers.slice(0, 5);
  const hasMoreArena = allTrackArenaUsers.length > 5;

  const formattedTime = nowPlaying?.timestamp ? formatTimeSP(new Date(nowPlaying.timestamp)) : "";
  const statusLabel = isActuallyLive ? "OUVINDO AGORA" : "REPRODUZIDO ÀS " + formattedTime;
  const showRankingSummary = !hideRankingBadge && allTrackArenaUsers.filter(u => u.id !== featuredUserId).length > 0;

  const durationMs = track?.durationMs || nowPlaying?.durationMs || null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[42px] bg-[#0A0A0A] border border-white/5 p-6 mb-6 shadow-2xl"
    >
      <AnimatePresence>
        {isActuallyLive && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
            <motion.div 
              animate={{ 
                scale: [1, 1.3, 1],
                rotate: [0, 120, 0],
                x: ['-20%', '20%', '-20%'],
                y: ['-15%', '10%', '-15%'],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-[50%] bg-[radial-gradient(circle_at_center,rgba(255,159,10,0.25)_0%,transparent_50%)] pointer-events-none"
            />
            <motion.div 
              animate={{ 
                scale: [1.3, 1, 1.3],
                rotate: [360, 240, 360],
                x: ['20%', '-20%', '20%'],
                y: ['10%', '-15%', '10%'],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-[50%] bg-[radial-gradient(circle_at_center,rgba(255,80,0,0.18)_0%,transparent_45%)] pointer-events-none"
            />
            <motion.div 
              animate={{ 
                opacity: [0.5, 0.8, 0.5],
                scale: [1, 1.05, 1],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-t from-orange-500/[0.12] to-transparent pointer-events-none"
            />
          </div>
        )}
      </AnimatePresence>
      
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full p-[1.5px] bg-gradient-to-tr from-orange-500 to-yellow-500 shadow-lg">
               <SmartImage 
                 src={profileAvatar} 
                 className="h-full w-full rounded-full" 
                 fallback="" 
                 rounded="full"
               />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-mundial font-bold text-white/90 leading-tight truncate">{user.name}</span>
                <MusicPlatformBadge platform={platform} className="bg-white/[0.03] border-white/5 opacity-50" />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={cn(
                   "h-1 w-1 rounded-full",
                   isActuallyLive ? "bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(255,159,10,0.8)]" : "bg-white/20"
                )} />
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/20">
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
             <span className="text-3xl font-display font-black text-white tracking-tighter leading-none">
                <AnimatedNumber value={streamsToday} />
             </span>
             <span className="text-[7.5px] font-black uppercase tracking-[0.25em] text-white/25 mt-1.5">Total Hoje</span>
          </div>
        </div>
        
        {track ? (
           <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                 <div className="relative shrink-0">
                    <motion.div 
                      onClick={() => onTrackClick?.(track)}
                      whileTap={{ scale: 0.95 }}
                      className="relative h-36 w-36 rounded-[36px] overflow-hidden shadow-2xl border border-white/10 cursor-pointer group z-10"
                    >
                       <SmartImage src={albumImage} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" fallback="" />
                    </motion.div>
                 </div>

                 <div className="flex flex-1 flex-col min-w-0">
                    <ScrollingText 
                      text={track.name} 
                      className="text-[20px] font-display font-black text-white leading-tight tracking-tight" 
                    />
                    <div className="text-[13px] font-medium text-white/60 line-clamp-1 mt-0.5">
                       {Array.isArray(track.artists) ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') : "Artista Desconhecido"}
                    </div>
                    {track.albumName && (
                      <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1 line-clamp-1 opacity-40">
                        {track.albumName}
                      </div>
                    )}

                    <div className="flex justify-start items-center gap-2 mt-4">
                       {!showRankingSummary ? (
                          playCount !== undefined && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 flex items-center gap-2 shrink-0 shadow-lg"
                            >
                               <div className="h-4 w-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                                  <Headphones className="h-2.5 w-2.5 text-orange-500" />
                               </div>
                               <span className="text-[9px] font-black text-white/70 uppercase tracking-[0.1em] whitespace-nowrap">{coreUtils.formatPlayCount(playCount)}</span>
                            </motion.div>
                          )
                       ) : (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-start items-center gap-3"
                          >
                             <div className={cn(
                                "flex items-center gap-2 !pl-0 px-2.5 py-1.5 rounded-[22px] !border-none shadow-2xl transition-all",
                                arenaExpanded && "flex-wrap max-w-[200px] justify-center"
                             )}>
                                <div className="flex -space-x-2.5 overflow-visible px-0.5">
                                   {trackArenaUsers.map((u, i) => (
                                     <motion.div 
                                       key={u.id}
                                       layout
                                       className="relative group/arena shrink-0"
                                       style={{ zIndex: trackArenaUsers.length - i }}
                                     >
                                        <div className={cn(
                                           "h-7 w-7 rounded-full transition-all duration-300",
                                           u.id === featuredUserId ? "ring-2 ring-orange-500/40 bg-orange-500/10" : ""
                                        )}>
                                           <div className="h-full w-full rounded-full p-[1.5px] overflow-hidden">
                                              <SmartImage src={u.avatar} className="h-full w-full rounded-full" fallback="" rounded="full" />
                                           </div>
                                        </div>
                                        <div className={cn(
                                           "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border border-white/10 flex items-center justify-center shadow-lg z-10",
                                           u.id === featuredUserId ? "bg-orange-500" : "bg-white/30 backdrop-blur-md"
                                        )}>
                                           <span className="text-[7px] font-black text-white leading-none tracking-tighter">{u.plays}</span>
                                        </div>
                                     </motion.div>
                                   ))}
                                </div>
                                
                                {hasMoreArena && (
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setArenaExpanded(!arenaExpanded);
                                     }}
                                     className="h-6 w-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all shrink-0 ml-1 origin-center active:scale-90"
                                   >
                                     {arenaExpanded ? <ChevronLeft className="h-3.5 w-3.5" /> : (
                                       <span className="text-[7px] font-black">+{allTrackArenaUsers.length - 5}</span>
                                     )}
                                   </button>
                                )}
                             </div>
                          </motion.div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="mt-1">
                 <LiveTrackProgress 
                    progressMs={nowPlaying.progressMs}
                    playedMs={nowPlaying.playedMs}
                    durationMs={durationMs || undefined}
                    timestamp={nowPlaying.timestamp}
                    isNowPlaying={isActuallyLive}
                    platform={platform.primary}
                 />
              </div>
           </div>
        ) : (
           <div className="py-12 glass-card rounded-[32px] flex flex-col items-center justify-center opacity-40 border-dashed border-white/10 bg-white/[0.02]">
              <Music2 className="h-8 w-8 mb-3" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Sinal Inativo</span>
           </div>
        )}
      </div>
    </motion.div>
  );
};
