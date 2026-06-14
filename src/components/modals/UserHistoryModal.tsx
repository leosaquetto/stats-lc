import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { statsCacheService } from '../../services/statsCacheService';
import { SmartImage } from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStatsStore } from '../../store/useStatsStore';
import { getArtistListString } from '../../lib/artistUtils';
import { BarChart3, BookOpen, ExternalLink, Loader2, Music2, Search, SlidersHorizontal, X } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LIMIT = 15;
const MAX_CACHED_ITEMS = 200;

const getHistoryItemKey = (item: any) => {
  const track = item?.track || {};
  const trackKey = track?.id || track?.name || item?.trackId || item?.trackName || 'track';
  const playedKey = item?.playedAt || item?.timestamp || item?.endTime || item?.date || '';
  return `${item?.isLive ? 'live' : 'history'}:${item?.id || ''}:${trackKey}:${playedKey}`;
};

const dedupeHistoryItems = (items: any[]) => {
  const seen = new Set<string>();
  const unique: any[] = [];

  items.forEach((item) => {
    if (!item) return;
    const key = getHistoryItemKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });

  return unique;
};

const mergeFreshHistory = (freshItems: any[], existingItems: any[]) => {
  const merged: any[] = [];
  const seen = new Set<string>();

  const pushUnique = (item: any) => {
    if (!item) return;
    const key = getHistoryItemKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  freshItems.forEach(pushUnique);
  existingItems.forEach(pushUnique);

  return merged.slice(0, MAX_CACHED_ITEMS);
};

const appendHistoryPage = (existingItems: any[], nextItems: any[]) => {
  const merged: any[] = [];
  const seen = new Set<string>();

  const pushUnique = (item: any) => {
    if (!item) return;
    const key = getHistoryItemKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  existingItems.forEach(pushUnique);
  nextItems.forEach(pushUnique);

  return merged.slice(0, MAX_CACHED_ITEMS);
};

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

const getTrackAlbumName = (track: any) => (
  track?.albumName ||
  track?.album?.name ||
  track?.albums?.[0]?.name ||
  track?.album?.title ||
  ''
);

const getItemTimestamp = (item: any) => (
  item?.playedAt ||
  item?.timestamp ||
  item?.endTime ||
  item?.date ||
  item?.createdAt ||
  ''
);

const firstExternalId = (value: any) => {
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item.trim()) || '';
  return typeof value === 'string' ? value : '';
};

const getHistoryActionLinks = (track: any, user: any) => {
  const spotifyId = track?.spotifyId || firstExternalId(track?.externalIds?.spotify);
  const appleMusicId = track?.appleMusicId || firstExternalId(track?.externalIds?.appleMusic);
  const statsId = track?.id || track?.statsfmId;
  const isAppleUser = user?.platform?.primary === 'appleMusic' || user?.platform === 'appleMusic' || user?.nowPlaying?.platform === 'appleMusic';

  return {
    stats: statsId ? { label: isAppleUser ? 'stats.am' : 'stats.fm', url: `https://stats.fm/track/${statsId}` } : null,
    spotify: spotifyId ? { label: 'Spotify', url: `https://open.spotify.com/track/${spotifyId}` } : null,
    apple: appleMusicId ? { label: 'Apple', url: `https://music.apple.com/song/${appleMusicId}` } : null,
  };
};

const openExternalUrl = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const openBottomTrackPanel = (user: any, item: any, panel: 'stats' | 'lyrics') => {
  const track = item?.track;
  if (!track?.name) return;
  window.dispatchEvent(new CustomEvent('stats-lc-open-track-stats', {
    detail: {
      panel,
      userId: user?.id,
      track,
      playback: item,
    },
  }));
};

const HistorySectionHeader = ({ label }: { label: string }) => (
  <div className="sticky top-0 z-20 bg-[#090807]/88 px-1 pb-2 pt-3 backdrop-blur-xl">
    <div className="flex items-center gap-3 border-b border-white/[0.06] pb-2">
      {label === 'Agora' ? (
        <div className="relative h-2.5 w-2.5 rounded-full bg-red-500">
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping" />
        </div>
      ) : (
        <div className="h-1.5 w-1.5 rounded-full bg-white/24" />
      )}
      <span className="text-[9px] font-black uppercase tracking-[0.28em] text-white/42">{label}</span>
      {label === 'Agora' && (
        <div className="flex h-2.5 items-end gap-[1.5px]">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              animate={{ scaleY: [0.25, 1, 0.45] }}
              transition={{ duration: 0.62, repeat: Infinity, delay: index * 0.1 }}
              className="h-full w-[1.5px] origin-bottom rounded-full bg-red-500"
              style={{ willChange: 'transform' }}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);

const HistoryActionButton = ({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    className="flex h-11 w-10 flex-col items-center justify-center gap-0.5 rounded-[15px] bg-white/[0.075] text-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[background-color,transform,color] active:scale-95"
  >
    {children}
    <span className="max-w-full truncate px-0.5 text-[5.8px] font-black uppercase tracking-[0.04em]">{label}</span>
  </button>
);

const HistoryTrackRow = React.memo(({
  item,
  user,
  isOpen,
  onOpen,
  onClose,
  onTrackClick,
  openInBottomBubble,
}: {
  item: any;
  user: any;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onTrackClick?: (track: any, item?: any) => void;
  openInBottomBubble?: boolean;
}) => {
  const trackItem = item.data || item;
  const track = trackItem.track || {};
  const image = getTrackImage(track);
  const artistName = getArtistListString(track);
  const albumName = getTrackAlbumName(track);
  const links = getHistoryActionLinks(track, user);
  const timestamp = getItemTimestamp(trackItem);
  const playedAt = timestamp ? new Date(timestamp) : null;
  const timeLabel = trackItem.isLive
    ? 'ouvindo'
    : playedAt && Number.isFinite(playedAt.getTime())
      ? coreUtils.formatTimeSP(playedAt)
      : 'recente';
  const progress = trackItem.durationMs
    ? Math.max(0, Math.min(100, ((trackItem.progressMs || 0) / trackItem.durationMs) * 100))
    : 0;

  return (
    <div className="relative overflow-hidden rounded-[24px]">
      <div className="absolute inset-y-0 right-0 z-0 flex items-center justify-end gap-1 rounded-[24px] bg-orange-500/[0.055] pl-4 pr-2">
        {track?.name && artistName && (
          <HistoryActionButton label="Letra" onClick={() => openBottomTrackPanel(user, trackItem, 'lyrics')}>
            <BookOpen className="h-4 w-4 text-yellow-100/82" strokeWidth={2.2} />
          </HistoryActionButton>
        )}
        <HistoryActionButton label="Stats" onClick={() => openBottomTrackPanel(user, trackItem, 'stats')}>
          <BarChart3 className="h-4 w-4 text-orange-200" strokeWidth={2.2} />
        </HistoryActionButton>
        {links.stats && (
          <HistoryActionButton label={links.stats.label} onClick={() => openExternalUrl(links.stats!.url)}>
            <ExternalLink className="h-4 w-4 text-white/76" strokeWidth={2.2} />
          </HistoryActionButton>
        )}
        {links.spotify && (
          <HistoryActionButton label="Spotify" onClick={() => openExternalUrl(links.spotify!.url)}>
            <Music2 className="h-4 w-4 text-green-200/86" strokeWidth={2.2} />
          </HistoryActionButton>
        )}
        {links.apple && (
          <HistoryActionButton label="Apple" onClick={() => openExternalUrl(links.apple!.url)}>
            <Music2 className="h-4 w-4 text-white/84" strokeWidth={2.2} />
          </HistoryActionButton>
        )}
      </div>

      <motion.button
        type="button"
        drag="x"
        dragConstraints={{ left: -234, right: 0 }}
        dragElastic={0.08}
        initial={false}
        animate={{ x: isOpen ? -226 : 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -42 || info.velocity.x < -260) onOpen();
          else onClose();
        }}
        onClick={() => {
          if (isOpen) {
            onClose();
            return;
          }
          if (openInBottomBubble) {
            openBottomTrackPanel(user, trackItem, 'stats');
            return;
          }
          onTrackClick?.(track, trackItem);
        }}
        className={cn(
          "relative z-10 flex w-full touch-pan-y items-center gap-3 rounded-[24px] border px-3 py-3 text-left shadow-[0_18px_46px_rgba(0,0,0,0.24)] transition-colors",
          trackItem.isLive
            ? "border-orange-500/24 bg-orange-500/[0.075]"
            : "border-white/[0.07] bg-white/[0.035]"
        )}
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[17px] bg-white/[0.06]">
          {image ? (
            <SmartImage src={image} className="h-full w-full object-cover" rounded="none" fallback="" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 className="h-7 w-7 text-white/34" />
            </div>
          )}
          {trackItem.playCount > 1 && !trackItem.isLive && (
            <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-black/70 bg-orange-600 px-1 text-[8px] font-black leading-none text-white">
              {coreUtils.formatNumber(trackItem.playCount)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <span className="line-clamp-2 min-w-0 text-[13px] font-black leading-[1.08] text-white/92">
              {track.name || 'Música sem título'}
            </span>
            {trackItem.playCount === 1 && !trackItem.isLive && (
              <span className="mt-0.5 shrink-0 rounded-full border border-orange-500/18 bg-orange-500/13 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.1em] text-orange-300">
                Inédito
              </span>
            )}
          </div>
          <span className="mt-1 block truncate text-[10px] font-semibold text-white/48">{artistName}</span>
          {albumName && (
            <span className="mt-0.5 block truncate text-[8px] font-black uppercase tracking-[0.05em] text-orange-200/46">{albumName}</span>
          )}
          {trackItem.isLive && trackItem.durationMs && (
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <span className="block h-full rounded-full bg-orange-500" style={{ width: `${progress}%` }} />
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn(
            "text-[8px] font-black uppercase tracking-[0.08em]",
            trackItem.isLive ? "text-orange-300" : "text-white/38"
          )}>
            {timeLabel}
          </span>
          <span className="rounded-full border border-white/[0.06] bg-black/22 px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-white/28">
            arraste
          </span>
        </div>
      </motion.button>
    </div>
  );
});
HistoryTrackRow.displayName = 'HistoryTrackRow';

export const UserHistoryModal = ({ 
  user, 
  onClose, 
  onTrackClick,
  openRowsInBottomBubble = false
}: { 
  user: any, 
  onClose: () => void, 
  onTrackClick?: (track: any, item?: any) => void,
  groupStats?: any,
  openRowsInBottomBubble?: boolean
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
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);

  const buildLiveItem = () => {
    if (!user.nowPlaying?.track) return null;

    const timestamp = user.nowPlaying.timestamp || user.nowPlaying.playedAt || user.nowPlaying.endTime || Date.now();

    return {
      id: `live-${user.nowPlaying.track.id}-${timestamp}`,
      track: user.nowPlaying.track,
      platformCandidate: user.platform,
      playedAt: timestamp,
      progressMs: user.nowPlaying.progressMs,
      durationMs: user.nowPlaying.durationMs || user.nowPlaying.track.durationMs,
      isLive: true
    };
  };

  const injectLiveItem = (items: any[]) => {
    const liveItem = buildLiveItem();
    if (!liveItem) return items;

    const withoutLiveTrack = items.filter((item: any) => item.track?.id !== liveItem.track?.id);
    return dedupeHistoryItems([liveItem, ...withoutLiveTrack]);
  };

  const loadData = async (newOffset = 0, hasInitialCache = false) => {
    if (newOffset === 0) {
      if (!hasInitialCache && items.length === 0) setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const data = await statsCacheService.fetchPaginatedHistory(user.id, newOffset, LIMIT);
      const normalizedData = dedupeHistoryItems(data.map(statsService.normalizeRecentStream).filter(Boolean));
      let newItems = normalizedData;
      
      if (normalizedData.length < LIMIT) {
        setHasMore(false);
      }
      
      if (newOffset === 0) {
        setItems(injectLiveItem(newItems));
      } else {
        setItems(prev => appendHistoryPage(prev, normalizedData));
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
    let cancelled = false;
    const store = useStatsStore.getState();
    const cachedItems = dedupeHistoryItems((store.getHistoryCache(user.id) || []).map(statsService.normalizeRecentStream).filter(Boolean));

    if (cachedItems.length > 0) {
      const initialCachedItems = injectLiveItem(cachedItems).slice(0, LIMIT);
      setHasMore(cachedItems.length >= LIMIT);
      setItems(initialCachedItems);
      setLoading(false);

      if (cachedItems.length >= LIMIT) {
        void statsService.fetchRecent(user.id, LIMIT, 0)
          .then((freshItems) => {
            if (cancelled) return;

            const normalizedFresh = dedupeHistoryItems(freshItems.map(statsService.normalizeRecentStream).filter(Boolean));
            if (normalizedFresh.length === 0) return;

            const currentCache = dedupeHistoryItems((store.getHistoryCache(user.id) || []).map(statsService.normalizeRecentStream).filter(Boolean));
            const merged = injectLiveItem(mergeFreshHistory(normalizedFresh, currentCache.length > 0 ? currentCache : cachedItems));

            store.setHistoryCache(user.id, merged);

            if (cancelled) return;
            setItems(merged.slice(0, LIMIT));
            setHasMore(merged.length >= LIMIT);
            setOffset(0);
          })
          .catch((error) => {
            if (!cancelled) {
              console.error('Failed to refresh full history cache', error);
            }
          });
      }

      return () => {
        cancelled = true;
      };
    }

    void loadData(0, false);

    return () => {
      cancelled = true;
    };
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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/72 px-0 pt-8 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative flex h-[min(92dvh,760px)] max-h-[calc(100dvh-env(safe-area-inset-bottom,0px)-18px)] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[36px] border border-white/[0.09] bg-[#090807]/94 shadow-[0_-24px_90px_rgba(0,0,0,0.72)] backdrop-blur-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="shrink-0 px-5 pb-3 pt-6">
           <div className="flex w-full items-center justify-between gap-4">
             <div className="flex min-w-0 items-center gap-3">
                 <SmartImage 
                    src={coreUtils.getUserAvatar(user.id, user.avatar)} 
                    className="h-12 w-12 shrink-0 rounded-full border-2 border-white/10" 
                    fallback="" 
                    rounded="full"
                  />
                 <div className="flex min-w-0 flex-col">
                    <h2 className="truncate text-lg font-mundial font-bold text-white">{user.name}</h2>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Histórico completo</span>
                 </div>
             </div>
             <button
               type="button"
               onClick={onClose}
               className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.045] text-white/72 shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-[background-color,transform,color] active:scale-95"
               aria-label="Fechar histórico completo"
             >
               <X className="h-5 w-5" strokeWidth={2.3} />
             </button>
           </div>
           
           <div className="flex flex-col gap-3 pt-5">
             <div className="relative">
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar título, artista ou data..."
                  className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.055] py-3 pl-10 pr-4 text-xs font-semibold text-white placeholder:text-white/30 transition-all focus:border-white/20 focus:outline-none"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                  <Search className="h-4 w-4" strokeWidth={2.2} />
                </div>
             </div>

             {!showFilters ? (
               <button
                 type="button"
                 onClick={() => setShowFilters(true)}
                 className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/12 bg-orange-500/10 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-orange-400 transition-all active:scale-[0.99]"
               >
                 <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.4} />
                 Filtros
               </button>
             ) : (
               <motion.div 
                 initial={{ opacity: 0, y: -10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="flex flex-col gap-3.5 rounded-3xl border border-white/[0.07] bg-white/[0.035] p-4"
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

        <div className="relative min-h-0 flex-1 overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)]">
           {loading ? (
             <div className="flex flex-col gap-3 py-4">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 w-full bg-white/5 rounded-2xl animate-pulse" />)}
             </div>
           ) : renderedListItems.length > 0 ? (
             <div
               className="h-full w-full overflow-y-auto overscroll-contain pr-1 no-scrollbar"
               onScroll={() => setOpenRowKey(null)}
             >
               <div className="flex flex-col gap-2 pb-3">
                 {renderedListItems.map((item) => {
                   if (item.type === 'header') {
                     return <HistorySectionHeader key={item.id} label={item.label} />;
                   }

                   const rowKey = item.id || getHistoryItemKey(item.data);
                   return (
                     <HistoryTrackRow
                       key={rowKey}
                       item={item}
                       user={user}
                       isOpen={openRowKey === rowKey}
                       onOpen={() => setOpenRowKey(rowKey)}
                       onClose={() => setOpenRowKey(null)}
                       onTrackClick={onTrackClick}
                       openInBottomBubble={openRowsInBottomBubble}
                     />
                   );
                 })}

                 {hasMore ? (
                   <button
                     type="button"
                     onClick={() => loadData(offset + LIMIT)}
                     disabled={loadingMore}
                     className="mt-2 flex w-full items-center justify-center gap-3 rounded-3xl border border-white/[0.08] bg-white/[0.04] py-4 text-[10px] font-black uppercase tracking-[0.24em] text-orange-400 transition-[background-color,transform,opacity] active:scale-[0.99] disabled:opacity-55"
                   >
                     {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                     <span>{loadingMore ? "Carregando..." : "Carregar mais histórico"}</span>
                   </button>
                 ) : (
                   <div className="py-5 text-center text-[9px] font-black uppercase tracking-[0.32em] text-white/22">
                     Fim do histórico disponível
                   </div>
                 )}
               </div>
             </div>
           ) : (
             <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-white/30">Sem dados correspondentes</div>
           )}
        </div>
      </motion.div>
    </motion.div>
  );
};
