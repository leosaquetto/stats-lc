/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { UserStats } from '../../types/stats';
import { 
  AnimatedNumber, 
  StatsLCLogo, 
  SmartImage, 
  SectionHeader,
  ShimmerOverlay,
  Skeleton
} from '../shared/CommonUI';
import { Headphones, Flame, ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LiveGroupOverview = React.memo(({ users, lastUpdate }: { users: UserStats[], lastUpdate?: string }) => {
  const totalStreams = users.reduce((sum, u) => sum + (u.streamsToday || 0), 0);
  const sortedParticipants = [...users]
    .sort((a, b) => (b.streamsToday || 0) - (a.streamsToday || 0));

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card overflow-hidden rounded-[40px] p-6 mb-6 premium-gradient border-white/5 shadow-2xl flex flex-col gap-6"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
             <motion.div 
               animate={{ 
                 scale: [1, 1.3, 1],
                 opacity: [0.6, 1, 0.6]
               }}
               transition={{ 
                 duration: 2,
                 repeat: Infinity,
                 ease: "easeInOut"
               }}
               className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] shrink-0" 
             />
             <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 whitespace-nowrap">Arena Group Live</span>
          </div>
          <div className="flex items-end gap-3 pt-6 pb-2">
            <span className="text-7xl sm:text-8xl font-display font-black tracking-tighter leading-[0.6] text-white drop-shadow-2xl">
              <AnimatedNumber value={totalStreams} />
            </span>
            <div className="flex flex-col shrink-0 mb-[4px]">
               <span className="text-[11px] font-black text-white/40 uppercase tracking-widest whitespace-nowrap leading-none mb-1">Streams</span>
               <span className="text-[11px] font-black text-orange-500 uppercase tracking-tighter whitespace-nowrap leading-none">Total Hoje</span>
            </div>
          </div>
        </div>
        <div className="shrink-0 pt-2 pr-1">
          <StatsLCLogo size={40} variant="black" className="rounded-xl shadow-inner border border-white/10" />
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 mt-2">
        <div className="flex -space-x-3 overflow-visible px-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {sortedParticipants.slice(0, 5).map((user, i) => (
              <motion.div 
                layout
                key={user.id}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 10, opacity: 0 }}
                transition={{ 
                  opacity: { duration: 0.2 },
                  layout: { type: "spring", stiffness: 350, damping: 35 }
                }}
                className="relative group shrink-0"
              >
              <div className="h-12 w-12 rounded-full ring-4 ring-[#0a0a0a] bg-[#1a1a1a] p-0.5 overflow-hidden transition-all group-hover:-translate-y-2 group-hover:scale-110 z-0 group-hover:z-10">
                <SmartImage 
                  src={coreUtils.getUserAvatar(user.id, user.avatar)} 
                  className="h-full w-full rounded-full" 
                  fallback="" 
                  rounded="full" 
                />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-orange-500/90 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg z-20">
                 <span className="text-[9px] font-bold text-white leading-none">{user.streamsToday}</span>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export const LiveGroupOverviewSkeleton = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.97, y: 12 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    className="glass-card overflow-hidden rounded-[40px] p-6 mb-6 premium-gradient border-white/5 shadow-2xl flex flex-col gap-6 relative"
  >
    <ShimmerOverlay duration={2.8} />
    <div className="flex justify-between items-start gap-4 relative z-10">
      <div className="flex flex-col gap-5 flex-1">
        <Skeleton className="h-3 w-36 rounded-full" />
        <div className="flex items-end gap-3">
          <Skeleton className="h-20 w-32 rounded-[24px]" />
          <div className="flex flex-col gap-2 mb-2">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-12 w-12 rounded-2xl" />
    </div>
    <div className="flex -space-x-3 relative z-10">
      {[0, 1, 2, 3, 4].map((item) => (
        <Skeleton key={item} className="h-12 w-12 rounded-full ring-4 ring-[#0a0a0a]" />
      ))}
    </div>
  </motion.div>
);

export const MonthlyGroupLeaderboard = React.memo(({ users, type = 'month' }: { users: UserStats[], type?: 'today' | 'week' | 'month' | 'year' | 'lifetime' }) => {
  const isYear = type === 'year';
  const isWeek = type === 'week';
  const isToday = type === 'today';
  const isLifetime = type === 'lifetime';
  
  const sortField = isYear ? 'streamsYear' : isWeek ? 'streamsWeek' : isToday ? 'streamsToday' : isLifetime ? 'totalStreams' : 'streamsMonth';
  const sorted = [...users].sort((a, b) => ((b as any)[sortField] || 0) - ((a as any)[sortField] || 0));
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: "America/Sao_Paulo", 
    month: 'long' 
  };
  const currentMonth = new Intl.DateTimeFormat('pt-BR', options).format(now);
  const currentMonthCapitalized = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
  
  const title = isToday
      ? "Arena Group Leaderboard (Hoje)"
      : isWeek 
        ? "Arena Group Leaderboard (Semana)" 
        : isYear
          ? `Arena Group Leaderboard (${currentYear})`
          : isLifetime
            ? "Arena Group Leaderboard (Total)"
            : `Arena Group Leaderboard (${currentMonthCapitalized})`;

  return (
    <div className="flex flex-col gap-2 mb-10">
      <SectionHeader title={title} />
      <div className="flex gap-4 overflow-x-auto no-scrollbar pt-2 pb-4 -mx-4 px-4">
        {sorted.map((user, i) => {
          const isFeatured = user.id === featuredUserId;
          return (
            <motion.div 
              layout
              key={user.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                delay: i * 0.05,
                layout: { type: "spring", stiffness: 350, damping: 35 }
              }}
              className={cn(
                "glass-card min-w-[140px] p-6 flex flex-col items-center gap-4 border-white/5",
                isFeatured ? "border-orange-500/20 bg-orange-500/10 shadow-[0_15px_35px_rgba(255,159,10,0.1)]" : "bg-white/[0.02]"
              )}
            >
              <div className="relative">
                <div className={cn(
                  "h-16 w-16 rounded-full p-1",
                  i === 0 ? "bg-gradient-to-tr from-yellow-500 via-yellow-200 to-yellow-600" : 
                  isFeatured ? "bg-gradient-to-tr from-orange-500 to-orange-300" : "bg-white/10"
                )}>
                   <div className="h-full w-full rounded-full bg-[#050505] p-0.5 overflow-hidden">
                     <SmartImage 
                       src={coreUtils.getUserAvatar(user.id, user.avatar)} 
                       className="h-full w-full rounded-full" 
                       fallback="" 
                       rounded="full" 
                     />
                  </div>
                </div>
                {i < 3 && (
                   <div className="absolute -top-1 -right-1 h-7 w-7 glass rounded-full flex items-center justify-center text-xs shadow-xl border border-white/10">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                   </div>
                )}
              </div>
              <div className="text-center w-full">
                 <span className={cn("block text-[11px] font-black uppercase tracking-[0.1em] truncate", isFeatured ? "text-orange-400" : "text-white/60")}>
                    {user.name.toUpperCase()}
                 </span>
                 <div className="mt-3 flex flex-col items-center gap-0.5">
                    <span className="text-xl font-display font-black text-white/95 leading-none tracking-tighter">
                       {coreUtils.formatNumber((user as any)[sortField] || 0)}
                    </span>
                    <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">
                      {isToday ? "Streams Hoje" : isWeek ? "Streams na Semana" : isYear ? "Streams no Ano" : isLifetime ? "Total Streams" : "Streams no Mês"}
                    </span>
                 </div>
                 
                 <div className="mt-4 pt-4 border-t border-white/5 w-full flex flex-col gap-1 items-center">
                    <span className="text-[7px] font-black text-white/10 uppercase tracking-widest">Hoje</span>
                    <span className={cn("text-[10px] font-black", isFeatured ? "text-orange-500/80" : "text-white/40")}>
                      +{user.streamsToday}
                    </span>
                 </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export const FriendsLiveCarousel = React.memo(() => {
  const { groupStats, hiddenUsers, featuredUserId } = useStatsStore();
  
  const members = (groupStats?.members || Object.values(groupStats?.users || {}))
    .filter((u: UserStats) => !hiddenUsers.includes(u.id) && u.id !== featuredUserId);

  const friendsNowPlaying = members.filter(user => {
    const isNow = user.nowPlaying?.isNow;
    if (!isNow) return false;
    
    // Check if it's recently playing (last 10 mins) to avoid stale "now playing"
    const timestamp = new Date(user.nowPlaying?.timestamp || 0).getTime();
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return timestamp > tenMinutesAgo;
  });

  if (friendsNowPlaying.length === 0) return null;

  const handleFriendClick = (friend: UserStats) => {
    window.dispatchEvent(new CustomEvent('openHistory', { detail: friend }));
  };

  return (
    <div className="flex flex-col gap-2 mb-6">
      <SectionHeader 
        title="Amigos Ouvindo Agora" 
        icon={<div className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />} 
      />
      
      <div className="flex gap-3 overflow-x-auto no-scrollbar scroll-fade-h -mx-4 px-4 pb-2">
        {friendsNowPlaying.map((friend, idx) => {
          const trackName = friend.nowPlaying?.track?.name || 'Música Desconhecida';
          const artistName = typeof friend.nowPlaying?.track?.artists[0] === 'string' 
            ? friend.nowPlaying?.track?.artists[0] 
            : friend.nowPlaying?.track?.artists[0]?.name || 'Artista';

          return (
            <motion.div
              key={friend.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => handleFriendClick(friend)}
              className="glass-card min-w-[180px] max-w-[220px] p-4 flex items-center gap-3 relative overflow-hidden transition-all border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] active:scale-95"
            >
              <div className="relative shrink-0">
                <motion.div 
                   animate={{ 
                     boxShadow: [
                       "0 0 0 0px rgba(249, 115, 22, 0)",
                       "0 0 0 4px rgba(249, 115, 22, 0.3)",
                       "0 0 0 0px rgba(249, 115, 22, 0)"
                     ]
                   }}
                   transition={{ 
                     duration: 2,
                     repeat: Infinity,
                     ease: "easeInOut"
                   }}
                   className="h-12 w-12 rounded-full p-0.5 bg-gradient-to-tr from-orange-500 to-yellow-500"
                >
                  <div className="h-full w-full rounded-full bg-[#0a0a0a] overflow-hidden">
                    <SmartImage 
                      src={coreUtils.getUserAvatar(friend.id, friend.avatar)} 
                      className="h-full w-full object-cover" 
                      fallback=""
                      rounded="full"
                    />
                  </div>
                </motion.div>
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-orange-500 border border-[#0a0a0a] flex items-center justify-center">
                  <Headphones className="h-2 w-2 text-white" />
                </div>
              </div>
              
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest truncate leading-tight mb-0.5">
                  {friend.name.split(' ')[0]}
                </span>
                <span className="text-[11px] font-bold text-white truncate leading-tight">
                  {trackName}
                </span>
                <span className="text-[9px] font-medium text-white/50 truncate leading-tight mt-0.5">
                  {artistName}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export const HomeHighlights = React.memo(({ userId, onItemClick }: { userId: string, onItemClick?: (item: any, type: 'track' | 'artist' | 'album') => void }) => {
  const [tops, setTops] = useState<{ tracks: any[], artists: any[], albums: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('month');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [tracks, artists, albums] = await Promise.all([
          statsService.getTopItems(userId, 'tracks', period),
          statsService.getTopItems(userId, 'artists', period),
          statsService.getTopItems(userId, 'albums', period)
        ]);
        setTops({ 
          tracks: tracks.slice(0, 20), 
          artists: artists.slice(0, 20), 
          albums: albums.slice(0, 20) 
        });
      } catch (e) {
        console.error("Failed to load highlights", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, period]);

  const periodLabels: Record<string, string> = {
    'today': 'Hoje',
    'week': 'Semana',
    '7days': '7 dias',
    'month': 'Mês',
    'year': 'Ano',
    'lifetime': 'Tudo'
  };

  const renderHighlightsSkeleton = () => (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-3 my-2 relative"
    >
      <SectionHeader title="Seus Destaques" icon={<Flame className="h-3.5 w-3.5 text-orange-500" />} />
      <Skeleton className="h-8 w-full rounded-lg" />
      {['artistas', 'faixas', 'álbuns'].map((label, sectionIndex) => (
        <div key={label} className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-24 rounded-full" />
          <div className="flex gap-2 overflow-hidden -mx-4 px-4">
            {[0, 1, 2, 3, 4, 5, 6].map((item) => (
              <motion.div
                key={`${label}-${item}`}
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, delay: sectionIndex * 0.04 + item * 0.02, ease: "easeOut" }}
                className="flex flex-col items-center gap-1 shrink-0 w-[48px]"
              >
                <Skeleton className={cn("h-[48px] w-[48px]", label === 'artistas' ? "rounded-full" : "rounded-lg")} />
                <Skeleton className="h-2 w-10 rounded-full" />
                <Skeleton className="h-2 w-8 rounded-full" />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );

  if (loading && !tops) {
    return renderHighlightsSkeleton();
  }
  
  if (!loading && (!tops || (!tops.tracks.length && !tops.artists.length && !tops.albums.length))) {
    return (
      <div className="flex flex-col gap-6 pt-2 pb-2">
        <SectionHeader title="Destaques" />
        <div className="h-32 glass-card flex flex-col items-center justify-center gap-2 border-white/5 bg-white/[0.01]">
          <Headphones className="h-6 w-6 text-white/10" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Sem destaques para este período</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 my-2"
      key={`highlights-${userId}-${period}`}
    >
      <div className="relative">
        <SectionHeader
          title="Seus Destaques"
          icon={<Flame className="h-3.5 w-3.5 text-orange-500" />}
          action={loading ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-orange-500"
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span className="text-[7px] font-black uppercase tracking-widest text-orange-400">Atualizando</span>
            </div>
          ) : null}
        />
      </div>
      
      <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg glass border border-white/5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-0.5">
        {(['today', 'week', '7days', 'month', 'year', 'lifetime'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-2 py-0.5 rounded text-[7.5px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              period === p ? "bg-white text-[#050505] shadow-md shadow-white/5" : "text-white/40 hover:text-white/90 cursor-pointer"
            )}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Artistas */}
      {tops.artists.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center opacity-30">
            <span className="text-[7.5px] font-black uppercase tracking-[0.2em] text-white">Top Artistas</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1 pb-1 scroll-fade-h scrolling-touch -mx-4 px-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {tops.artists.map((artist, idx) => (
                <motion.div 
                  key={artist.id || artist.name || idx} 
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ 
                    duration: 0.3,
                    ease: "easeOut",
                    delay: idx * 0.015
                  }}
                  className="flex flex-col items-center gap-0.5 shrink-0 w-[48px] cursor-pointer"
                  onClick={() => onItemClick?.({...artist, type: 'artist'}, 'artist')}
                >
                  <div className="relative h-[48px] w-[48px] shrink-0">
                    <SmartImage src={artist.image || artist.artist?.image} className="h-full w-full border border-white/10" rounded="full" fallback="" />
                    <div className="absolute -bottom-1 left-1 h-3.5 w-3.5 rounded-full bg-[#0a0a0a]/90 backdrop-blur-md border border-white/20 flex items-center justify-center text-[7px] font-black text-white z-20 shadow-lg">{idx + 1}</div>
                    <div className="absolute -top-1 -right-1 min-w-[16px] h-3.5 px-1 rounded-full bg-orange-600 border border-[#0a0a0a] flex items-center justify-center shadow-lg z-20">
                      <span className="text-[7px] font-black text-white leading-none">{artist.playcount || artist.streams || artist.count || artist.c || 0}</span>
                    </div>
                  </div>
                  <div className="text-center w-full min-w-0 px-0.5 overflow-hidden mt-0.5">
                    <span className="text-[7.5px] font-bold text-white/50 line-clamp-2 leading-tight block h-[18px]">{artist.name || artist.artist?.name}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Faixas */}
      {tops.tracks.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center opacity-30">
            <span className="text-[7.5px] font-black uppercase tracking-[0.2em] text-white">Top Faixas</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1 pb-1 scroll-fade-h scrolling-touch -mx-4 px-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {tops.tracks.map((track, idx) => (
                <motion.div 
                  key={track.id || track.name || idx} 
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ 
                    duration: 0.3,
                    ease: "easeOut",
                    delay: idx * 0.015
                  }}
                  className="flex flex-col items-center gap-0.5 shrink-0 w-[48px] cursor-pointer"
                  onClick={() => onItemClick?.({...track, type: 'track'}, 'track')}
                >
                  <div className="relative h-[48px] w-[48px] shrink-0">
                    <SmartImage src={track.image || track.album?.image} className="h-full w-full border border-white/10 shadow-md shadow-black/30" rounded="lg" fallback="" />
                    <div className="absolute -bottom-1 left-1 h-3.5 w-3.5 rounded-full bg-[#0a0a0a]/90 backdrop-blur-md border border-white/20 flex items-center justify-center text-[7px] font-black text-white z-20 shadow-lg">{idx + 1}</div>
                    <div className="absolute -top-1 -right-1 min-w-[16px] h-3.5 px-1 rounded-full bg-orange-600 border border-[#0a0a0a] flex items-center justify-center shadow-lg z-20">
                      <span className="text-[7px] font-black text-white leading-none">{track.playcount || track.streams || track.count || track.c || 0}</span>
                    </div>
                  </div>
                  <div className="flex flex-col w-full text-center min-w-0 px-0.5 overflow-hidden mt-0.5">
                    <span className="text-[7.5px] font-bold text-white/60 line-clamp-2 leading-tight block h-[18px]">{track.name}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Álbuns */}
      {tops.albums.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center opacity-30">
            <span className="text-[7.5px] font-black uppercase tracking-[0.2em] text-white">Top Álbuns</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1 pb-1 scroll-fade-h scrolling-touch -mx-4 px-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {tops.albums.map((album, idx) => (
                <motion.div 
                  key={album.id || album.name || idx} 
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ 
                    duration: 0.3,
                    ease: "easeOut",
                    delay: idx * 0.015
                  }}
                  className="flex flex-col items-center gap-0.5 shrink-0 w-[48px] cursor-pointer"
                  onClick={() => onItemClick?.({...album, type: 'album'}, 'album')}
                >
                  <div className="relative h-[48px] w-[48px] shrink-0">
                    <SmartImage src={album.image || album.album?.image} className="h-full w-full border border-white/10 shadow-md shadow-black/30" rounded="lg" fallback="" />
                    <div className="absolute -bottom-1 left-1 h-3.5 w-3.5 rounded-full bg-[#0a0a0a]/90 backdrop-blur-md border border-white/20 flex items-center justify-center text-[7px] font-black text-white z-20 shadow-lg">{idx + 1}</div>
                    <div className="absolute -top-1 -right-1 min-w-[16px] h-3.5 px-1 rounded-full bg-orange-600 border border-[#0a0a0a] flex items-center justify-center shadow-lg z-20">
                      <span className="text-[7px] font-black text-white leading-none">{album.playcount || album.streams || album.count || album.c || 0}</span>
                    </div>
                  </div>
                  <div className="flex flex-col w-full text-center min-w-0 px-0.5 overflow-hidden mt-0.5">
                    <span className="text-[7.5px] font-bold text-white/60 line-clamp-2 leading-tight block h-[18px]">{album.name || album.album?.name}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => navigate('/highlights')}
        className="w-full mt-1.5 flex items-center justify-between py-2 px-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl shadow-md border border-white/10 relative overflow-hidden transition-all text-[9px] font-black uppercase tracking-widest active:scale-95"
      >
        <span>Explorar destaques</span>
        <ArrowRight className="h-3 w-3" />
      </motion.button>
    </motion.div>
  );
};
