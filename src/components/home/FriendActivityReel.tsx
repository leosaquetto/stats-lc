
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { coreUtils } from '../../services/statsCore';
import { SmartImage, MusicPlatformBadge } from '../shared/CommonUI';
import { clsx } from 'clsx';
import { Music, Clock, Play } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { getVisibleMembers } from '../../lib/memberSelectors';

interface FriendActivityReelProps {
  onTrackClick: (track: any) => void;
  onFriendClick: (friend: any) => void;
  onViewAll?: () => void;
  excludeUserId?: string;
}

const EqualizerIcon = () => (
  <div className="flex items-center gap-[1px] h-1.5">
    <motion.div
      animate={{ height: ["20%", "100%", "50%", "100%", "20%"] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      className="w-[1.2px] bg-orange-500 rounded-full will-change-[height]"
    />
    <motion.div
      animate={{ height: ["50%", "20%", "100%", "20%", "50%"] }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="w-[1.2px] bg-orange-500 rounded-full will-change-[height]"
    />
    <motion.div
      animate={{ height: ["100%", "50%", "20%", "50%", "100%"] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      className="w-[1.2px] bg-orange-500 rounded-full will-change-[height]"
    />
  </div>
);

export const FriendActivityReel: React.FC<FriendActivityReelProps> = ({ 
  onTrackClick, 
  onFriendClick,
  onViewAll,
  excludeUserId
}) => {
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  
  const members = useMemo(
    () => getVisibleMembers(groupStats, hiddenUsers).filter(m =>
      String(m.id).trim() !== String(excludeUserId).trim()
    ),
    [groupStats, hiddenUsers, excludeUserId]
  );
  
  // Amigos ordenados por atividade recente (isNow primeiro, depois timestamp)
  const sortedFriends = useMemo(() => {
    return [...members].sort((a, b) => {
      const isPlayingA = a.nowPlaying?.isNow ? 1 : 0;
      const isPlayingB = b.nowPlaying?.isNow ? 1 : 0;
      if (isPlayingA !== isPlayingB) return isPlayingB - isPlayingA;

      return new Date(b.nowPlaying?.timestamp || 0).getTime() - new Date(a.nowPlaying?.timestamp || 0).getTime();
    });
  }, [members]);

  // Take top 5 friends
  const topFriends = useMemo(() => sortedFriends.slice(0, 5), [sortedFriends]);

  if (topFriends.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 my-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
            Atividade do Círculo
          </h3>
        </div>
        <div className="flex items-center gap-1.5 opacity-30 hover:opacity-100 transition-opacity cursor-default">
           <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Tempo Real</span>
        </div>
      </div>

      <div className="flex h-[184px] gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain no-scrollbar -mx-4 px-4 pb-2 scroll-fade-h scrolling-touch">
        <AnimatePresence>
          {topFriends.map((friend, idx) => {
            const isPlaying = friend.nowPlaying?.isNow;
            const track = friend.nowPlaying?.track;
            const trackImage = track?.image || "";
            const liveSeed = friend.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const livePulseDuration = 3.4 + (liveSeed % 7) * 0.34;
            const livePulseDelay = (liveSeed % 5) * 0.22;
            const artistName = track?.artists?.[0] 
              ? (typeof track.artists[0] === 'string' ? track.artists[0] : track.artists[0].name)
              : "Artista";
            const userAvatar = coreUtils.getUserAvatar(friend.id, friend.avatar);

            return (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, scale: 0.95, x: 15 }}
                whileInView={{ opacity: 1, scale: 1, x: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                exit={{ opacity: 0, scale: 0.95, x: -15 }}
                transition={{ 
                  delay: idx * 0.05,
                  duration: 0.5,
                  ease: [0.23, 1, 0.32, 1]
                }}
                className="flex-shrink-0 w-[144px] group cursor-pointer"
                onClick={() => onFriendClick(friend)}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative">
                  {isPlaying && (
                    <motion.div
                      className="absolute -inset-3 rounded-[30px] bg-orange-500/18 blur-xl"
                      animate={{ scale: [0.96, 1.08, 0.96], opacity: [0.26, 0.62, 0.26] }}
                      transition={{
                        duration: livePulseDuration,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: livePulseDelay
                      }}
                    />
                  )}

                  <div className={clsx(
                    "relative aspect-[4/5] rounded-[22px] overflow-hidden glass border transition-all duration-500 shadow-lg group-hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)]",
                    isPlaying ? "border-white/10 shadow-[0_16px_40px_rgba(249,115,22,0.12)]" : "border-white/10 group-hover:border-orange-500/40"
                  )}>

                  {/* Artwork Background */}
                  <div className="absolute inset-0 z-0">
                    <SmartImage 
                      src={trackImage} 
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-40 group-hover:opacity-60" 
                      rounded="none"
                      fallback=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-[#0a0a0a]" />
                  </div>

                  {/* Content Overlay */}
                  <div className="absolute inset-0 z-10 p-3.5 flex flex-col justify-between">
                    {/* Top: User Info */}
                    <div className="flex items-center gap-2">
                       <div className="relative">
                         <div className={clsx(
                           "h-7 w-7 rounded-full border-2 p-0.5 overflow-hidden transition-all duration-300",
                           isPlaying ? "border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" : "border-white/10"
                         )}>
                            <SmartImage src={userAvatar} className="h-full w-full object-cover rounded-full" rounded="full" fallback="" />
                         </div>
                         {isPlaying && (
                           <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-black/80 flex items-center justify-center border border-white/10">
                              <EqualizerIcon />
                           </div>
                         )}
                       </div>
                       <div className="flex flex-col min-w-0">
                          <span className="text-[9.5px] font-black text-white truncate leading-none mb-0.5 group-hover:text-orange-400 transition-colors">
                            {friend.name.split(' ')[0]}
                          </span>
                          <span className="text-[7px] font-bold text-white/40 uppercase tracking-widest leading-none">
                            {isPlaying ? "Ouvindo agora" : coreUtils.getTimeAgoSmart(new Date(friend.nowPlaying?.timestamp || 0))}
                          </span>
                       </div>
                    </div>

                    {/* Bottom: Track Info */}
                    <div className="flex flex-col gap-1">
                       <div 
                         className="flex flex-col min-w-0"
                         onClick={(e) => {
                           e.stopPropagation();
                           if (track) onTrackClick(track);
                         }}
                       >
                          <h4 className="text-[11px] font-bold text-white leading-tight line-clamp-2 mix-blend-plus-lighter">
                            {track?.name || "Silêncio"}
                          </h4>
                          <p className="text-[8.5px] font-medium text-white/50 truncate leading-tight mt-0.5">
                            {artistName}
                          </p>
                       </div>
                       
                       <div className="flex items-center gap-2 mt-0.5">
                          <MusicPlatformBadge platform={friend.platform} variant="minimal" />
                          {isPlaying && (
                            <motion.div 
                              animate={{ 
                                backgroundColor: ["rgba(255,255,255,0.05)", "rgba(249,115,22,0.1)", "rgba(255,255,255,0.05)"]
                              }}
                              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              className="px-1.5 py-0.5 rounded-full border border-orange-500/20 flex items-center gap-1 shadow-[0_0_8px_rgba(249,115,22,0.05)]"
                            >
                               <div className="relative flex h-1 w-1">
                                 <motion.span 
                                   animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 1] }}
                                   transition={{ duration: 2, repeat: Infinity }}
                                   className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"
                                 />
                                 <span className="relative inline-flex rounded-full h-1 w-1 bg-orange-500" />
                               </div>
                               <span className="text-[6px] font-black text-white uppercase tracking-widest">Live</span>
                            </motion.div>
                          )}
                       </div>
                    </div>
                  </div>
                  
                  {/* Glass Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.04] to-transparent pointer-events-none" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* View All Card */}
        <motion.div
          className="flex-shrink-0 w-[70px] h-full flex flex-col items-center justify-center gap-2.5 cursor-pointer group pr-4"
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onViewAll?.()}
        >
          <div className="h-10 w-10 rounded-full glass border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:border-orange-500/50 transition-all">
            <motion.div
              animate={{ x: [0, 3, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Play className="h-3.5 w-3.5 text-white/40 group-hover:text-orange-500 fill-transparent group-hover:fill-orange-500/20" />
            </motion.div>
          </div>
          <span className="text-[7.5px] font-black text-white/30 uppercase tracking-[0.2em] text-center leading-tight"> Ver<br/>Todos</span>
        </motion.div>
      </div>
    </div>
  );
};
