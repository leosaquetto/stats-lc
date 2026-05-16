
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { SmartImage, MusicCard } from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LIMIT = 50;

export const UserHistoryModal = ({ 
  user, 
  onClose, 
  onTrackClick 
}: { 
  user: any, 
  onClose: () => void, 
  onTrackClick: (track: any) => void 
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(user.initialSearch || "");

  const loadData = async (newOffset = 0) => {
    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const data = await statsService.fetchRecent(user.id, LIMIT, newOffset);
      let newItems = data;
      
      if (newOffset === 0 && user.nowPlaying?.track) {
        const liveTrackItem = {
           id: 'live-' + user.nowPlaying.track.id + '-' + Date.now(),
           track: user.nowPlaying.track,
           platformCandidate: user.platform,
           playedAt: user.nowPlaying.timestamp || Date.now(),
           isLive: true
        };
        if (newItems.length > 0 && newItems[0].track?.id !== user.nowPlaying.track.id) {
           newItems = [liveTrackItem, ...newItems];
        } else if (newItems.length === 0) {
           newItems = [liveTrackItem];
        } else if (newItems.length > 0 && newItems[0].track?.id === user.nowPlaying.track.id) {
           newItems[0] = { ...newItems[0], isLive: true };
        }
      }

      if (newOffset === 0) {
        setItems(newItems);
      } else {
        setItems(prev => [...prev, ...data]);
      }
      setOffset(newOffset);
    } catch (e) {
      console.error("Failed to load full history", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadData(0);
  }, [user.id]);
  
  const filteredItems = items.filter(item => {
     if (!search) return true;
     const query = search.toLowerCase();
     const title = (item.track?.name || "").toLowerCase();
     const artist = (item.track?.artists?.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') || "").toLowerCase();
     const dateStr = coreUtils.formatTimeSP(new Date(item.playedAt || item.timestamp)).toLowerCase();
     return title.includes(query) || artist.includes(query) || dateStr.includes(query);
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/90 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 30, stiffness: 250 }}
        className="bg-[#050505] w-full h-[95vh] rounded-t-[48px] overflow-hidden border-t border-white/5 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 pb-4 flex flex-col shrink-0">
           <div className="flex items-center justify-between w-full">
             <div className="flex items-center gap-4">
                <SmartImage 
                   src={coreUtils.getUserAvatar(user.id, user.avatar)} 
                   className="h-12 w-12 rounded-full border-2 border-white/10" 
                   fallback="" 
                   rounded="full"
                 />
                <div className="flex flex-col">
                   <h2 className="text-xl font-mundial font-bold text-white">{user.name}</h2>
                   <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Histórico Completo</span>
                </div>
             </div>
             <button onClick={onClose} className="h-10 w-10 glass rounded-full flex items-center justify-center text-xl">×</button>
           </div>
           <div className="pt-6">
             <div className="relative">
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar título, artista ou data..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-xs font-semibold text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
             </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-32">
           {loading ? (
             <div className="flex flex-col gap-3 py-4">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 w-full bg-white/5 rounded-2xl animate-pulse" />)}
             </div>
           ) : filteredItems.length > 0 ? (
             <div className="flex flex-col gap-3 py-4">
                {filteredItems
                  .map((item, idx) => {
                    const isActuallyLive = item.isLive;
                    return (
                      <MusicCard 
                        key={`${item.id}-${idx}`}
                        userId={user.id}
                        userName={user.name}
                        songName={item.track?.name}
                        artistName={item.track?.artists?.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')}
                        track={item.track}
                        imageUrl={item.track?.image}
                        isNowPlaying={isActuallyLive}
                        className={clsx("bg-white/[0.02] border-white/[0.04] p-3 transition-colors", isActuallyLive && "border-orange-500/30 bg-orange-500/5")}
                        onClick={() => onTrackClick(item.track)}
                        footer={isActuallyLive ? (
                           <span className="text-orange-500 animate-pulse font-black uppercase">Ouvindo</span>
                        ) : coreUtils.formatTimeSP(new Date(item.playedAt || item.timestamp))}
                      />
                    );
                  })}
                
                <button 
                  onClick={() => loadData(offset + LIMIT)}
                  disabled={loadingMore}
                  className="w-full py-5 rounded-3xl bg-white/5 border border-white/5 text-[11px] font-black uppercase tracking-[0.3em] text-orange-500/80 active:scale-95 transition-all mt-4 mb-10 disabled:opacity-50"
                >
                  {loadingMore ? "Carregando..." : "Buscar mais"}
                </button>
             </div>
           ) : (
             <div className="py-20 text-center opacity-30 italic uppercase tracking-widest text-xs">Sem dados</div>
           )}
        </div>
      </motion.div>
    </motion.div>
  );
}
