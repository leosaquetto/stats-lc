
import React, { useEffect, useState } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, Bell, AlertTriangle, Users, ChevronRight, ChevronLeft, History } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { coreUtils } from '../services/statsCore';
import { statsService } from '../services/statsService';

// Novos componentes modulares
import { 
  LeoHeader,
  HomeHighlights, 
  LiveGroupOverview, 
  MonthlyGroupLeaderboard,
  FriendsHorizontalCard, 
  FriendsCardSkeleton,
  FriendHistoryCard,
  UserHistoryModal,
  TrackLeaderboardModal,
  UserDetailModal, 
  StatsBattleModal,
  MusicCard, 
  Skeleton, 
  SectionHeader, 
  StatsLCLogo, 
  MusicPlatformBadge, 
  SmartImage 
} from '../components/MusicUI';

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
    // Escuta evento customizado para abrir histórico completo
    const handleOpenHistory = (e: any) => {
      setViewingFullHistoryUser(e.detail);
    };
    window.addEventListener('openHistory', handleOpenHistory);
    return () => window.removeEventListener('openHistory', handleOpenHistory);
  }, []);

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
          {isLoading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={`skeleton-${i}`} className="min-w-[100px] w-[100px] shrink-0">
                <FriendsCardSkeleton />
              </div>
            ))
          ) : (
            sortedFriends.map((user) => {
              const track = user.nowPlaying?.track;
              const artistName = track?.artists
                ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')
                : (user.nowPlaying ? "Unknown Artist" : "-");
              
              const playback = coreUtils.getPlaybackStatus(user);

              return (
                <motion.div 
                  key={user.id} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="min-w-[100px] w-[100px] shrink-0"
                >
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
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <SectionHeader title="Histórico da Sessão" />
      <div className="flex flex-col gap-3">
          {isLoading ? (
            [1, 2, 3, 4, 5].map(i => (
              <div key={`hist-skeleton-${i}`} className="glass-card p-3 flex items-center justify-between bg-white/[0.01] border-white/5 animate-pulse">
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
            members
              .filter(u => u && u.id)
              .sort((a, b) => (a.id === FEATURED_ID ? -1 : b.id === FEATURED_ID ? 1 : 0))
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
