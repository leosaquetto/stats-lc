import React, { useEffect, useState } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { 
  MusicCard, 
  Skeleton, 
  LeoHeader, 
  SectionHeader, 
  FriendsHorizontalCard, 
  FriendsCardSkeleton, 
  LiveGroupOverview, 
  StatsLCLogo, 
  TrackLeaderboardModal,
  MusicPlatformBadge,
  SmartImage,
  MonthlyGroupLeaderboard
} from '../components/MusicUI';
import { HomeHighlights } from '../components/HomeHighlights';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, Bell, AlertTriangle, Users, ChevronRight, ChevronLeft, History } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { coreUtils } from '../services/statsCore';
import { statsService } from '../services/statsService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function HomeScreen() {
  const { 
    groupStats, 
    isLoading, 
    isRefreshing, 
    error, 
    fetchGroup, 
    featuredUserId, 
    setFeaturedUserId,
    hiddenUsers 
  } = useStatsStore();
  
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [viewingFullHistoryUser, setViewingFullHistoryUser] = useState<any>(null);
  const [showUserSelector, setShowUserSelector] = useState(false);
  
  const allMembers = groupStats?.members || [];
  const members = allMembers.filter(m => !hiddenUsers.includes(m.id));
  const primaryUser = members.find(m => m.id === featuredUserId) || members[0];
  const FEATURED_ID = primaryUser?.id;

  const cycleUser = () => {
    if (members.length <= 1) return;
    const currentIndex = members.findIndex(m => m.id === FEATURED_ID);
    const nextIndex = (currentIndex + 1) % members.length;
    setFeaturedUserId(members[nextIndex].id);
  };

  useEffect(() => {
    // Escuta evento customizado para abrir histórico completo
    const handleOpenHistory = (e: any) => {
      setViewingFullHistoryUser(e.detail);
    };
    window.addEventListener('openHistory', handleOpenHistory);
    return () => window.removeEventListener('openHistory', handleOpenHistory);
  }, []);

  useEffect(() => {
    // Só busca se não tiver os dados globais.
    if (!groupStats) {
      fetchGroup();
    }
  }, [groupStats, fetchGroup]);

  if (primaryUser) {
    console.log("MAIN MEMBER", primaryUser);
  }
  
  const friendsSelection = members.filter(u => u && u.id && u.id !== FEATURED_ID);
  
  // Amigos em Sintonia: Todos os amigos, ordenados por Nome
  const sortedFriends = [...friendsSelection].sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  const liveCount = friendsSelection.filter(u => coreUtils.getPlaybackStatus(u).status === "live").length;

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {viewingFullHistoryUser && (
          <UserHistoryModal 
            user={viewingFullHistoryUser} 
            onClose={() => setViewingFullHistoryUser(null)}
            onTrackClick={(track) => setSelectedTrack(track)}
          />
        )}
        {selectedTrack && (
          <TrackLeaderboardModal 
            track={selectedTrack} 
            onClose={() => setSelectedTrack(null)} 
          />
        )}
      </AnimatePresence>

      {/* Top Bar Navigation */}
      <header className="flex items-center justify-between mb-6 px-1 pt-2">
        <div 
          onClick={cycleUser}
          className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-all"
        >
          <StatsLCLogo size={36} />
          <div className="flex flex-col">
            <h1 className="font-mundial text-xl font-semibold tracking-wider leading-none lowercase group-hover:text-orange-500 transition-colors">
              stats.lc
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
               <div className={clsx("h-1.5 w-1.5 rounded-full", (isLoading || isRefreshing) ? "bg-orange-500 animate-pulse" : "bg-green-500")} />
               <span className="text-[9px] font-black uppercase tracking-widest text-white/50">
                 {primaryUser?.name ? `${primaryUser.name.split(' ')[0]}'s Circle Live` : 'Circle Live'}
               </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 relative">
          <button 
            onClick={() => setShowUserSelector(!showUserSelector)} 
            className={clsx(
              "h-11 w-11 glass rounded-2xl flex items-center justify-center transition-all overflow-hidden p-0",
              showUserSelector && "bg-white/20 border-white/20 opacity-80"
            )}
          >
             {primaryUser?.avatar ? (
                <SmartImage src={coreUtils.getUserAvatar(primaryUser.id, primaryUser.avatar)} rounded="2xl" className="h-full w-full object-cover" />
             ) : (
                <Users className="h-5 w-5 text-white/60" />
             )}
          </button>

          <button 
            onClick={() => fetchGroup(true)}
            aria-label="Atualizar dados"
            className="h-11 w-11 glass rounded-2xl flex items-center justify-center active:scale-95 transition-all hover:bg-white/10"
          >
            <RefreshCcw className={clsx("h-5 w-5 text-white/60", (isLoading || isRefreshing) && "animate-spin")} />
          </button>

          <AnimatePresence>
            {showUserSelector && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowUserSelector(false)}
                  className="fixed inset-0 z-40"
                />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-3 w-56 glass-card border-white/10 p-2 z-50 shadow-2xl backdrop-blur-3xl overflow-hidden"
                >
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/20 px-3 py-2.5 mb-1 border-b border-white/5">Trocar Perfil Principal</div>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {members.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setFeaturedUserId(u.id);
                          setShowUserSelector(false);
                        }}
                        className={clsx(
                          "w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all",
                          featuredUserId === u.id 
                            ? "bg-white/10 border border-white/10 shadow-lg" 
                            : "hover:bg-white/5"
                        )}
                      >
                        <div className={clsx("h-8 w-8 rounded-full border overflow-hidden relative shrink-0", featuredUserId === u.id ? "border-orange-500" : "border-white/10")}>
                           <SmartImage 
                             src={coreUtils.getUserAvatar(u.id, u.avatar)} 
                             className="h-full w-full object-cover" 
                             fallback=""
                             rounded="full"
                           />
                           {featuredUserId === u.id && (
                             <div className="absolute inset-0 bg-orange-500/10" />
                           )}
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className={clsx(
                            "text-sm font-bold transition-colors truncate w-full",
                            featuredUserId === u.id ? "text-white" : "text-white/60"
                          )}>
                            {u.name}
                          </span>
                          <span className="text-[9px] text-white/30 uppercase tracking-widest font-black">
                            {"Membro"}
                          </span>
                        </div>
                        {featuredUserId === u.id && (
                          <div className="ml-auto h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Primary Highlight: Dynamic User */}
      <AnimatePresence mode="wait">
        {isLoading && !primaryUser ? (
          <Skeleton className="h-[340px] w-full rounded-[42px]" />
        ) : error ? (
            <motion.div 
             key="error"
             initial={{ opacity: 0 }} animate={{ opacity: 1 }}
             className="glass-card flex flex-col items-center justify-center gap-4 py-12 border-red-500/10 bg-red-500/5 px-6"
            >
               <AlertTriangle className="h-8 w-8 text-red-500/50" />
               <div className="text-center">
                 <p className="text-sm font-bold text-white/90">Erro de Sincronia</p>
                 <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1 mb-4 leading-tight">
                    {error || "Verifique sua conexão ou o status do backend."}
                 </p>
               </div>
               <button 
                 onClick={() => fetchGroup(true)}
                 disabled={isLoading || isRefreshing}
                 className="flex items-center gap-2 px-6 py-2 glass rounded-full text-[10px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 disabled:opacity-50"
               >
                 {(isLoading || isRefreshing) && <RefreshCcw className="h-3 w-3 animate-spin" />}
                 {isLoading || isRefreshing ? "Sincronizando..." : "Tentar Sincronizar Agora"}
               </button>
            </motion.div>
        ) : primaryUser ? (
          <LeoHeader 
            key={primaryUser.id}
            user={primaryUser}
            streamsToday={primaryUser.streamsToday || 0} 
            onTrackClick={(track) => setSelectedTrack(track)}
          />
        ) : null}
      </AnimatePresence>

      {primaryUser && <HomeHighlights userId={primaryUser.id} onItemClick={(item) => setSelectedTrack(item)} />}

      {groupStats && (
        <LiveGroupOverview 
          users={members} 
          lastUpdate={groupStats.lastUpdated}
        />
      )}

      {/* Amigos em Sintonia: Horizontal Scroll */}
      <SectionHeader 
        title="Amigos em Sintonia" 
        action={
          <div className="flex items-center gap-2">
            <span className={clsx("text-[9px] font-black uppercase tracking-tighter", liveCount > 0 ? "text-orange-500" : "text-white/20")}>
              {liveCount} ativos
            </span>
          </div>
        }
      />
      
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 -mx-1 px-1 scroll-fade-h">
        <AnimatePresence mode="popLayout">
          {isLoading && friendsSelection.length === 0 ? (
            [1, 2, 3, 4].map(i => <FriendsCardSkeleton key={i} />)
          ) : (
            sortedFriends.map((user) => {
              const track = user.nowPlaying?.track;
              const artistName = track?.artists
                ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')
                : (user.nowPlaying ? "Unknown Artist" : "-");
              
              const playback = coreUtils.getPlaybackStatus(user);

              return (
                <div key={user.id} className="min-w-[100px] w-[100px] shrink-0">
                  <FriendsHorizontalCard
                    userId={user.id}
                    userName={user.name}
                    userAvatar={user.avatar}
                    songName={track?.name}
                    artistName={artistName}
                    imageUrl={track?.image} 
                    isNowPlaying={playback.status === "live"}
                    timestamp={user.nowPlaying?.timestamp}
                    playedCount={track?.playedCount}
                    onClick={() => track && setSelectedTrack(track)}
                  />
                </div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <SectionHeader title="Histórico da Sessão" />
      <div className="flex flex-col gap-3">
         {isLoading && members.length === 0 ? (
           [1, 2, 3].map(i => (
             <div key={i} className="glass-card p-3 flex items-center justify-between bg-white/[0.01] border-white/5 animate-pulse">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 shrink-0 rounded-full bg-white/5" />
                   <div className="flex flex-col gap-1.5">
                      <div className="h-2 w-16 bg-white/5 rounded-full" />
                      <div className="h-1.5 w-24 bg-white/5 rounded-full opacity-50" />
                   </div>
                </div>
                <div className="h-6 w-6 rounded-lg bg-white/5" />
             </div>
           ))
         ) : (
           [primaryUser, ...members.filter(u => u && u.id && u.id !== FEATURED_ID)]
            .map((user, idx) => (
              <FriendHistoryCard 
                key={user.id || `hist-${idx}`} 
                user={user} 
                onTrackClick={setSelectedTrack}
              />
            ))
         )}
      </div>

      {groupStats && members && (
        <div className="mt-8">
          <MonthlyGroupLeaderboard users={members} type="month" />
        </div>
      )}

      <p className="mt-12 text-center text-[9px] text-white/20 lowercase tracking-[0.4em] font-mundial font-semibold mb-20">
        stats.lc • Leo's Circle Exclusive v1.0
      </p>
    </div>
  );
}

const FriendHistoryCard = React.memo(({ user, onTrackClick }: { user: any, onTrackClick: (track: any) => void }) => {
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
                    {(() => {
                      let displayItems = [...recents];
                      if (isLive && user.nowPlaying?.track) {
                        const liveTrackItem = {
                          id: 'live-' + user.nowPlaying.track.id,
                          track: user.nowPlaying.track,
                          platformCandidate: user.platform,
                          playedAt: user.nowPlaying.timestamp
                        };
                        if (!recents.some(r => r.track?.id === user.nowPlaying.track.id)) {
                          displayItems = [liveTrackItem, ...recents];
                        }
                      }
                      return displayItems.slice(0, 5);
                    })().map((item, idx) => {
                      const track = item.track;
                      const artistName = track?.artists?.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') || "-";
                      const playedAt = item.playedAt || item.timestamp || item.endTime;
                      const isNowPlayingTrack = isLive && track?.id === user.nowPlaying?.track?.id;
                      
                      return (
                        <motion.div 
                          key={`${item.id}-${idx}`}
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => onTrackClick(track)}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group",
                            isNowPlayingTrack && "bg-orange-500/10 border border-orange-500/20"
                          )}
                        >
                           <img src={track.image} className="h-9 w-9 rounded-lg shadow-lg border border-white/5" alt="" />
                           <div className="flex flex-col min-w-0 flex-1">
                              <span className={cn("text-[10px] font-bold truncate group-hover:text-orange-500 transition-colors", isNowPlayingTrack ? "text-orange-500" : "text-white/90")}>{track.name}</span>
                              <span className="text-[8px] font-medium text-white/40 truncate">{artistName}</span>
                           </div>
                           <div className="text-right flex flex-col items-end shrink-0">
                              {isNowPlayingTrack ? (
                                <motion.span 
                                  className="text-[7.5px] font-black text-orange-500 uppercase"
                                  animate={{ opacity: [1, 0, 1] }} 
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                  OUVINDO
                                </motion.span>
                              ) : (
                                <span className="text-[7.5px] font-mono text-white/30 uppercase">
                                  {playedAt ? coreUtils.formatTimeSP(new Date(playedAt)) : ""}
                                </span>
                              )}
                              <div className="mt-1">
                                <MusicPlatformBadge platform={item.platformCandidate || user.platform} className="p-0 border-none bg-transparent h-2.5 w-2.5 opacity-20 shadow-none grayscale" />
                              </div>
                           </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const event = new CustomEvent('openHistory', { detail: user });
                      window.dispatchEvent(event);
                    }}
                    className="w-full py-2.5 mt-2 rounded-xl bg-white/5 border border-white/5 text-[8px] font-black uppercase tracking-[0.2em] text-white/30 active:scale-95 transition-all text-center"
                  >
                    Ver Histórico Completo
                  </button>
                </>
              ) : (
                <div className="py-4 text-center">
                   <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Vazio</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

function UserHistoryModal({ user, onClose, onTrackClick }: { user: any, onClose: () => void, onTrackClick: (track: any) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(user.initialSearch || "");
  const LIMIT = 50;

  const loadData = async (newOffset = 0) => {
    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const data = await statsService.fetchRecent(user.id, LIMIT, newOffset);
      let newItems = data;
      
      if (newOffset === 0 && user.nowPlaying?.track) {
        // If it's the first page and there is a playing track, inject it if not already first
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
        {/* Header */}
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

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-32">
           {loading ? (
             <div className="flex flex-col gap-3 py-4">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 w-full bg-white/5 rounded-2xl animate-pulse" />)}
             </div>
           ) : filteredItems.length > 0 ? (
             <div className="flex flex-col gap-3 py-4">
                {filteredItems
                  .map((item, idx) => {
                    const isActuallyLive = idx === 0 && (item.isLive || (user.nowPlaying?.track && item.track?.id === user.nowPlaying.track.id));
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
