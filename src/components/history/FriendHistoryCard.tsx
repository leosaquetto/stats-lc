/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History } from 'lucide-react';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { SmartImage, MusicCard } from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FriendHistoryCard = React.memo(({ user, onTrackClick }: { user: any, onTrackClick: (track: any) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [recents, setRecents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const playback = coreUtils.getPlaybackStatus(user);
  const isLive = playback.status === "live";

  useEffect(() => {
    let mounted = true;
    const fetchRecents = async () => {
      try {
        const data = await statsService.fetchRecent(user.id, 5);
        if (mounted) setRecents(data);
      } catch (e) {
        console.error("Failed to load recents for card", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchRecents();
    return () => { mounted = false; };
  }, [user.id]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleFullHistory = () => {
    const event = new CustomEvent('openHistory', { 
      detail: { 
        id: user.id, 
        name: user.name, 
        avatar: user.avatar 
      } 
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="flex flex-col gap-2">
      <div 
        onClick={toggleExpand}
        className={cn(
          "glass-card p-3 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all",
          isExpanded ? "bg-white/[0.08] rounded-b-none border-b-0" : "bg-white/[0.02] border-white/5"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 relative">
            <SmartImage 
              src={coreUtils.getUserAvatar(user.id, user.avatar)} 
              className="h-full w-full rounded-full border border-white/10" 
              fallback=""
              rounded="full"
            />
            {isLive && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-orange-500 rounded-full border-2 border-[#0a0a0a] animate-pulse" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
             <span className="text-[12px] font-bold text-white/90 leading-tight truncate">{user.name}</span>
             <span className="text-[9px] font-black text-white/30 uppercase tracking-widest truncate line-clamp-1">
               {isLive ? "OUVINDO AGORA" : "VER HISTÓRICO"}
             </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
           {isLive && (
             <div className="flex items-end gap-[1.5px] h-3">
                {[0,1,2].map(i => (
                  <motion.div key={i} animate={{ height: ["20%", "100%", "40%"] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} className="w-[1.5px] bg-orange-500 rounded-full shadow-[0_0_4px_rgba(255,159,10,0.5)]" />
                ))}
             </div>
           )}
           <motion.div 
             animate={{ rotate: isExpanded ? 180 : 0 }}
             className="h-6 w-6 rounded-lg bg-white/5 flex items-center justify-center"
           >
              <History className={cn("h-3 w-3 text-white/30", loading && "animate-spin")} />
           </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white/[0.04] rounded-b-[24px] border border-t-0 border-white/5 -mt-2 mx-px"
          >
            <div className="p-3 flex flex-col gap-2">
              {loading ? (
                [1,2,3].map(i => <div key={i} className="h-10 w-full bg-white/5 rounded-xl animate-pulse" />)
              ) : recents.length > 0 || (isLive && user.nowPlaying?.track) ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    {/* Combine now playing with recents for the mini list */}
                    {(isLive && user.nowPlaying?.track ? [ { track: user.nowPlaying.track, playedAt: new Date().toISOString(), isLive: true }, ...recents.slice(0, 3) ] : recents.slice(0, 4))
                      .map((item, idx) => (
                        <div 
                          key={idx}
                          onClick={() => onTrackClick(item.track)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                           <SmartImage 
                             src={item.track?.image} 
                             className="h-8 w-8 rounded-lg shrink-0" 
                             fallback="" 
                             rounded="lg" 
                           />
                           <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-white/90 truncate leading-tight group-hover:text-orange-500 transition-colors">{item.track?.name}</span>
                              <span className="text-[8px] font-black text-white/30 uppercase tracking-widest truncate">{item.isLive ? 'Live' : coreUtils.formatTimeSP(new Date(item.playedAt))}</span>
                           </div>
                        </div>
                      ))}
                  </div>
                  <button 
                    onClick={handleFullHistory}
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 active:scale-95 transition-all mt-1"
                  >
                    Ver Tudo
                  </button>
                </>
              ) : (
                <div className="py-4 text-center opacity-20 italic text-[10px]">Sem histórico recente</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
