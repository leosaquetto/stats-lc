import React, { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { coreUtils } from '../../services/statsCore';
import { SmartImage } from '../shared/CommonUI';

export const DiscreetFriendsRow = ({ 
  friends, 
  onTrackClick,
  onFriendClick
}: { 
  friends: any[], 
  onTrackClick: (track: any) => void,
  onFriendClick?: (user: any) => void
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const prevLiveIds = React.useRef<Set<string>>(new Set());
  const [newlyLiveIds, setNewlyLiveIds] = React.useState<Set<string>>(new Set());

  const activeFriends = useMemo(() => {
    if (!friends) return [];
    return friends
      .filter(f => {
        const playback = coreUtils.getPlaybackStatus(f);
        return playback.status === "live" && !!f.nowPlaying?.track;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .slice(0, 12); 
  }, [friends]);

  useEffect(() => {
    if (!activeFriends.length) {
      prevLiveIds.current = new Set();
      return;
    }

    const currentIds = new Set(activeFriends.map(u => u.id));
    const newArrivals = new Set<string>();
    
    currentIds.forEach(id => {
      if (!prevLiveIds.current.has(id)) {
        newArrivals.add(id);
      }
    });

    if (newArrivals.size > 0) {
      setNewlyLiveIds(newArrivals);
      const timer = setTimeout(() => {
        setNewlyLiveIds(new Set());
      }, 4000);
      prevLiveIds.current = currentIds;
      return () => clearTimeout(timer);
    }
    
    prevLiveIds.current = currentIds;
  }, [activeFriends]);

  if (activeFriends.length === 0) return null;

  return (
    <div className="w-full flex justify-center mb-6 pt-2 pb-4 overflow-visible">
      <motion.div 
        className="flex items-center gap-0 max-w-full overflow-x-auto scroll-none px-4 py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onHoverStart={() => setIsExpanded(true)}
        onHoverEnd={() => setIsExpanded(false)}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {activeFriends.map((user, index) => {
            const track = user.nowPlaying?.track;
            const artistName = track?.artists
              ? (typeof track.artists[0] === 'string' ? track.artists[0] : track.artists[0]?.name)
              : (user.nowPlaying ? "Unknown Artist" : "");
            
            const userAvatar = coreUtils.getUserAvatar(user.id, user.avatar);
            const isNew = newlyLiveIds.has(user.id);

            return (
              <motion.div
                layout
                key={user.id}
                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  x: 0,
                  marginLeft: index === 0 ? 0 : isExpanded ? 8 : -30,
                  width: isExpanded ? 160 : 64,
                  zIndex: index
                }}
                exit={{ opacity: 0, scale: 0.8, x: -20 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 450, 
                  damping: 35,
                  layout: { duration: 0.4 } 
                }}
                whileHover={{ y: -6, scale: 1.05, zIndex: 100 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (onFriendClick) {
                    onFriendClick(user);
                  } else {
                    onTrackClick(track);
                  }
                }}
                className="relative group cursor-pointer shrink-0"
              >
                <div className="relative">
                  <motion.div 
                     animate={{
                       borderColor: isNew ? ["rgba(249,115,22,1)", "rgba(255,255,255,0.1)"] : "rgba(255,255,255,0.1)",
                       boxShadow: isNew ? ["0 0 25px rgba(249,115,22,0.8)", "0 4px 16px rgba(0,0,0,0)"] : "0 4px 16px rgba(0,0,0,0)"
                     }}
                     transition={{ duration: isNew ? 2 : 0.5, ease: "easeOut", repeat: isNew ? 1 : 0 }}
                     className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-stone-900/90 backdrop-blur-3xl border border-white/10 shadow-2xl ring-2 ring-stone-950 group-hover:border-orange-500/40 group-hover:shadow-[0_4px_20px_rgba(249,115,22,0.4)] transition-all overflow-hidden h-[42px] w-full"
                  >
                    {/* Avatar with Ring Border */}
                    <div className="relative z-10 shrink-0">
                      <div className="h-8 w-8 rounded-full ring-[1.5px] ring-white/10 overflow-hidden bg-stone-800">
                        <SmartImage 
                          src={userAvatar} 
                          className="h-full w-full" 
                          rounded="full" 
                          fallback={user.name?.[0]}
                        />
                      </div>
                    {/* Live Indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-stone-950 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                  </div>

                    {/* Info Column */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          className="flex flex-col min-w-0 flex-1"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -5 }}
                        >
                          <span className="text-[10px] font-black text-white/90 truncate leading-tight">
                            {track?.name || "Ouvindo..."}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400 truncate leading-tight mt-0.5 group-hover:text-orange-300 transition-colors">
                             {artistName || ""}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
