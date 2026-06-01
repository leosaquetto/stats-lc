import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { statsCacheService } from '../../services/statsCacheService';
import { SmartImage } from '../shared/CommonUI';
import { MusicCard } from '../shared/MusicCard';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStatsStore } from '../../store/useStatsStore';
import { getArtistListString } from '../../lib/artistUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LIMIT = 20;

const getTrackImage = (track: any) => {
  const candidates = [
    track?.albumImage,
    track?.album?.image,
    track?.album?.images?.[0]?.url,
    track?.album?.images?.[0],
    track?.image,
    track?.images?.[0]?.url,
    track?.images?.[0],
    track?.albumArt,
    track?.coverArt,
    track?.cover_art,
    track?.album_image,
    track?.cover,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 5) return candidate;
    if (candidate?.url && typeof candidate.url === 'string') return candidate.url;
  }

  return '';
};

interface HistoryRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    items: any[];
    user: any;
    onTrackClick: (track: any) => void;
    hasMore: boolean;
    loadingMore: boolean;
    loadMoreItems: () => void;
    groupStats: any;
  };
}

const HistoryRow = React.memo(({ index, style, data }: HistoryRowProps) => {
  const { items, user, onTrackClick, hasMore, loadingMore, loadMoreItems, groupStats } = data;

  if (index === items.length) {
    if (hasMore) {
      return (
        <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 10, paddingLeft: 4, paddingRight: 4 }}>
          <button 
            type="button"
            onClick={loadMoreItems}
            disabled={loadingMore}
            className="w-full py-4 rounded-3xl bg-white/5 border border-white/5 text-[11px] font-black uppercase tracking-[0.3em] text-orange-500 hover:bg-orange-500/10 hover:border-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-3">
              {loadingMore ? (
                <div className="h-4 w-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              ) : null}
              <span>{loadingMore ? "Carregando..." : "Carregar mais histórico"}</span>
            </div>
          </button>
        </div>
      );
    } else {
      return (
        <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 10, paddingLeft: 4, paddingRight: 4 }}>
          <div className="w-full text-center opacity-20 text-[9px] font-black uppercase tracking-[0.4em] py-4">
            Fim do histórico disponível
          </div>
        </div>
      );
    }
  }

  const item = items[index];
  if (!item) return null;

  // Header Divider
  if (item.type === 'header') {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', paddingLeft: 12, paddingRight: 12 }} key={item.id}>
        <div className="flex items-center gap-3 w-full border-b border-white/[0.04] pb-2 pt-1">
          {item.label === 'Agora' ? (
            <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
          ) : (
            <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
          )}
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40">
            {item.label}
          </span>
          {item.label === 'Agora' && (
            <div className="flex items-end gap-[1.5px] h-2.5 mb-[1px]">
               {[0,1,2].map(i => (
                 <motion.div 
                   key={i} 
                   animate={{ height: ["20%", "100%", "40%"] }} 
                   transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} 
                   className="w-[1.5px] bg-red-500 rounded-full" 
                 />
               ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const trackItem = item.data;
  const isActuallyLive = trackItem.isLive;

  const userPlayCount = trackItem.playCount || 0;
  const isFirstPlay = userPlayCount === 1;

  return (
    <div style={{ ...style, paddingBottom: 10, paddingLeft: 4, paddingRight: 4 }} key={`${trackItem.id}-${index}`}>
      <MusicCard 
        userId={user.id}
        userName={user.name}
        songName={trackItem.track?.name}
        artistName={getArtistListString(trackItem.track)}
        track={trackItem.track}
        imageUrl={getTrackImage(trackItem.track)}
        isNowPlaying={isActuallyLive}
        isFirstPlay={isFirstPlay}
        playCount={userPlayCount}
        progressMs={trackItem.progressMs}
        durationMs={trackItem.durationMs}
        className={cn(
          "bg-white/[0.02] border-white/[0.04] p-3 transition-colors h-full",
          isActuallyLive && "border-orange-500/30 bg-orange-500/5"
        )}
        onClick={() => onTrackClick(trackItem.track)}
        footer={isActuallyLive ? (
           <span className="text-orange-500 animate-pulse font-black uppercase">Ouvindo</span>
        ) : coreUtils.formatTimeSP(new Date(trackItem.playedAt || trackItem.timestamp))}
      />
    </div>
  );
});
HistoryRow.displayName = 'HistoryRow';

export const UserHistoryModal = ({ 
  user, 
  onClose, 
  onTrackClick,
  groupStats
}: { 
  user: any, 
  onClose: () => void, 
  onTrackClick: (track: any) => void,
  groupStats?: any
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(user.initialSearch || "");

  // Expandable filters state
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [artistFilter, setArtistFilter] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [albumFilter, setAlbumFilter] = useState('');

  const loadData = async (newOffset = 0, hasInitialCache = false) => {
    if (newOffset === 0) {
      if (!hasInitialCache && items.length === 0) setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const data = await statsCacheService.fetchPaginatedHistory(user.id, newOffset, LIMIT);
      let newItems = data;
      
      if (data.length < LIMIT) {
        setHasMore(false);
      }
      
      if (newOffset === 0 && user.nowPlaying?.track) {
        const liveTrackItem = {
           id: 'live-' + user.nowPlaying.track.id + '-' + Date.now(),
           track: user.nowPlaying.track,
           platformCandidate: user.platform,
           playedAt: user.nowPlaying.timestamp || Date.now(),
           progressMs: user.nowPlaying.progressMs,
           durationMs: user.nowPlaying.durationMs || user.nowPlaying.track.durationMs,
           isLive: true
        };
        newItems = newItems.filter((it: any) => it.track?.id !== user.nowPlaying?.track?.id);
        newItems = [liveTrackItem, ...newItems];
      }

      if (newOffset === 0) {
        setItems(newItems);
      } else {
        setItems(prev => [...prev, ...data]);
      }
      setOffset(newOffset);
    } catch (e) {
      console.error("Failed to load full history", e);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    let loadedCache = false;
    const store = useStatsStore.getState();
    const cachedItems = store.getHistoryCache(user.id);
    if (cachedItems && cachedItems.length > 0) {
      loadedCache = true;
      if (user.nowPlaying?.track) {
         const liveTrackItem = {
           id: 'live-' + user.nowPlaying.track.id + '-' + Date.now(),
           track: user.nowPlaying.track,
           platformCandidate: user.platform,
           playedAt: user.nowPlaying.timestamp || Date.now(),
           progressMs: user.nowPlaying.progressMs,
           durationMs: user.nowPlaying.durationMs || user.nowPlaying.track.durationMs,
           isLive: true
         };
         let newCached = cachedItems.filter((it: any) => it.track?.id !== user.nowPlaying?.track?.id);
         newCached = [liveTrackItem, ...newCached];
         setItems(newCached);
      } else {
         setItems(cachedItems);
      }
      setLoading(false);
    }

    loadData(0, loadedCache);
  }, [user.id]);
  
  // Filtering system
  const filteredItems = items.filter(item => {
     // 1. General search bar
     if (search) {
       const query = search.toLowerCase();
       const title = (item.track?.name || "").toLowerCase();
       const artist = getArtistListString(item.track).toLowerCase();
       const dateStr = coreUtils.formatTimeSP(new Date(item.playedAt || item.timestamp)).toLowerCase();
       if (!title.includes(query) && !artist.includes(query) && !dateStr.includes(query)) {
         return false;
       }
     }

     // 2. Date/Period Filter
     const dateMs = new Date(item.playedAt || item.timestamp || 0).getTime();
     const nowMs = Date.now();

     if (dateFilter === 'today') {
       const todayStartTemp = new Date();
       todayStartTemp.setHours(0,0,0,0);
       if (dateMs < todayStartTemp.getTime()) return false;
     } else if (dateFilter === 'week') {
       const sevenDaysAgo = nowMs - (7 * 24 * 60 * 60 * 1000);
       if (dateMs < sevenDaysAgo) return false;
     } else if (dateFilter === 'month') {
       const thirtyDaysAgo = nowMs - (30 * 24 * 60 * 60 * 1000);
       if (dateMs < thirtyDaysAgo) return false;
     } else if (dateFilter === 'custom') {
       if (customStartDate) {
         const startObj = new Date(customStartDate + 'T00:00:00');
         if (dateMs < startObj.getTime()) return false;
       }
       if (customEndDate) {
         const endObj = new Date(customEndDate + 'T23:59:59');
         if (dateMs > endObj.getTime()) return false;
       }
     }

     // 3. Specific fields search
     if (artistFilter) {
       const q = artistFilter.toLowerCase();
       const artistsStr = getArtistListString(item.track).toLowerCase();
       if (!artistsStr.includes(q)) return false;
     }

     if (trackFilter) {
       const q = trackFilter.toLowerCase();
       const songNameStr = (item.track?.name || "").toLowerCase();
       if (!songNameStr.includes(q)) return false;
     }

     if (albumFilter) {
       const q = albumFilter.toLowerCase();
       const albumNameStr = (item.track?.album?.name || item.track?.albumName || "").toLowerCase();
       if (!albumNameStr.includes(q)) return false;
     }

     return true;
  });

  // Group items by time divider
  const renderedListItems: any[] = [];
  let currentGroup = '';

  filteredItems.forEach((item) => {
    let group = 'Datas mais antigas';
    if (item.isLive) {
      group = 'Agora';
    } else {
      const itemDate = new Date(item.playedAt || item.timestamp);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const compareDate = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      if (compareDate.getTime() === today.getTime()) {
        group = 'Hoje';
      } else if (compareDate.getTime() === yesterday.getTime()) {
        group = 'Ontem';
      }
    }

    if (group !== currentGroup) {
      currentGroup = group;
      renderedListItems.push({
        type: 'header',
        id: `header-${group}`,
        label: group
      });
    }

    renderedListItems.push({
      type: 'item',
      id: item.id || `item-${item.track?.id}-${item.playedAt}`,
      data: item
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center liquid-glass-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="liquid-glass-modal w-full h-[95vh] rounded-t-[48px] overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Section */}
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
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Histórico completo</span>
                 </div>
             </div>
             <button onClick={onClose} className="h-10 w-10 glass rounded-full flex items-center justify-center text-xl">×</button>
           </div>
           
           {/* Expandable Filter UI Block */}
           <div className="pt-6 flex flex-col gap-3">
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

             {!showFilters ? (
               <button
                 type="button"
                 onClick={() => setShowFilters(true)}
                 className="w-full py-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-[10px] font-black uppercase tracking-widest text-orange-400 border border-orange-500/10 active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
               >
                 Filtros
               </button>
             ) : (
               <motion.div 
                 initial={{ opacity: 0, y: -10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="flex flex-col gap-3.5 p-4 rounded-3xl bg-white/[0.02] border border-white/5"
               >
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Filtros Avançados</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFilters(false);
                        setDateFilter('all');
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setArtistFilter('');
                        setTrackFilter('');
                        setAlbumFilter('');
                      }}
                      className="text-[9px] font-extrabold text-orange-500 hover:underline uppercase tracking-wider"
                    >
                      Ocultar / Limpar
                    </button>
                  </div>
                  
                  {/* Period selection */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/35">Filtrar Período</span>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        { id: 'all', label: 'Tudo' },
                        { id: 'today', label: 'Hoje' },
                        { id: 'week', label: 'Semana' },
                        { id: 'month', label: 'Mês' },
                        { id: 'custom', label: 'Pers.' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDateFilter(opt.id)}
                          className={cn(
                            "py-1.5 rounded-lg text-[9px] font-extrabold text-center border transition-all",
                            dateFilter === opt.id
                              ? "bg-orange-500/20 border-orange-500/30 text-orange-400"
                              : "bg-white/5 border-white/5 text-white/50 hover:text-white"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {dateFilter === 'custom' && (
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] text-white/40 uppercase">Início</span>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={e => setCustomStartDate(e.target.value)}
                            className="bg-white/5 border border-white/5 rounded-xl px-2 py-1 text-[10px] text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] text-white/40 uppercase">Fim</span>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={e => setCustomEndDate(e.target.value)}
                            className="bg-white/5 border border-white/5 rounded-xl px-2 py-1 text-[10px] text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text inputs for specific fields */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/35">Artista</span>
                      <input
                        type="text"
                        value={artistFilter}
                        onChange={e => setArtistFilter(e.target.value)}
                        placeholder=" Drake..."
                        className="bg-white/5 border border-[#fff]/5 rounded-xl p-2 text-[10px] font-medium text-white placeholder:text-white/20 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/35">Música</span>
                      <input
                        type="text"
                        value={trackFilter}
                        onChange={e => setTrackFilter(e.target.value)}
                        placeholder=" Hotline..."
                        className="bg-white/5 border border-[#fff]/5 rounded-xl p-2 text-[10px] font-medium text-white placeholder:text-white/20 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/35">Álbum</span>
                      <input
                        type="text"
                        value={albumFilter}
                        onChange={e => setAlbumFilter(e.target.value)}
                        placeholder=" Views..."
                        className="bg-white/5 border border-[#fff]/5 rounded-xl p-2 text-[10px] font-medium text-white placeholder:text-white/20 focus:outline-none"
                      />
                    </div>
                  </div>
               </motion.div>
             )}
           </div>
        </div>

        {/* History List */}
        <div className="flex-1 px-6 pb-20 relative">
           {loading ? (
             <div className="flex flex-col gap-3 py-4">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 w-full bg-white/5 rounded-2xl animate-pulse" />)}
             </div>
           ) : renderedListItems.length > 0 ? (
             <div className="h-full w-full overflow-y-auto no-scrollbar">
               {[
                 ...renderedListItems,
                 ...(hasMore ? [{ type: 'load-more', id: 'load-more' }] : [])
               ].map((item, index, listItems) => (
                 <HistoryRow
                   key={item.id}
                   index={item.type === 'load-more' ? renderedListItems.length : index}
                   style={{ height: item.type === 'header' ? 44 : 93 }}
                   data={{
                     items: renderedListItems,
                     user,
                     onTrackClick,
                     hasMore: item.type === 'load-more' && listItems.length > renderedListItems.length,
                     loadingMore,
                     loadMoreItems: () => loadData(offset + LIMIT),
                     groupStats
                   }}
                 />
               ))}
             </div>
           ) : (
             <div className="py-20 text-center opacity-30 italic uppercase tracking-widest text-xs">Sem dados correspondentes</div>
           )}
        </div>
      </motion.div>
    </motion.div>
  );
};
