/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { UserStats } from '../../types/stats';
import { 
  AnimatedNumber, 
  StatsLCLogo, 
  SmartImage, 
  SectionHeader 
} from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LiveGroupOverview = ({ users, lastUpdate }: { users: UserStats[], lastUpdate?: string }) => {
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
          {sortedParticipants.slice(0, 5).map((user, i) => (
            <motion.div 
              key={user.id}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
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
        </div>
      </div>
    </motion.div>
  );
};

export const MonthlyGroupLeaderboard = ({ users, type = 'month' }: { users: UserStats[], type?: 'month' | 'lifetime' }) => {
  const isLifetime = type === 'lifetime';
  const sortField = isLifetime ? 'scrobbles' : 'totalStreams';
  const sorted = [...users].sort((a, b) => ((b as any)[sortField] || 0) - ((a as any)[sortField] || 0));
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: "America/Sao_Paulo", 
    month: 'long' 
  };
  const currentMonth = new Intl.DateTimeFormat('pt-BR', options).format(now);
  const currentMonthCapitalized = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
  
  const title = isLifetime ? "Arena Global Leaderboard" : `Arena Group Leaderboard (${currentMonthCapitalized})`;

  return (
    <div className="flex flex-col gap-2 mb-10">
      <SectionHeader title={title} />
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-2 px-2">
        {sorted.map((user, i) => {
          const isFeatured = user.id === featuredUserId;
          return (
            <motion.div 
              key={user.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
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
                      {isLifetime ? "Lifetime Scrobbles" : "Total Streams"}
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

export const HomeHighlights = ({ userId, onItemClick }: { userId: string, onItemClick?: (item: any) => void }) => {
  const [tops, setTops] = useState<{ tracks: any[], artists: any[], albums: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [tracks, artists, albums] = await Promise.all([
          statsService.getTopItems(userId, 'tracks', 'month'),
          statsService.getTopItems(userId, 'artists', 'month'),
          statsService.getTopItems(userId, 'albums', 'month')
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
  }, [userId]);

  if (loading) return <div className="h-40 bg-white/[0.02] rounded-3xl animate-pulse" />;
  if (!tops || (!tops.tracks.length && !tops.artists.length && !tops.albums.length)) return null;

  return (
    <div className="flex flex-col gap-6 pt-2 pb-2">
      <SectionHeader title="Destaques do Mês" action={<span className="text-[10px] text-white/40 font-bold uppercase">Top 20</span>} />
      
      <div className="flex flex-col gap-4">
        {/* Artistas */}
        {tops.artists.length > 0 && (
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">Artistas</span>
                <div className="h-[1px] flex-1 bg-white/5" />
             </div>
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 scroll-fade-h">
               {tops.artists.map((artist, idx) => (
                 <motion.div 
                   key={artist.id || idx} 
                   initial={{ opacity: 0, scale: 0.9 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true }}
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   className="flex flex-col items-center gap-2 shrink-0 w-[64px] cursor-pointer"
                   onClick={() => onItemClick?.(artist)}
                  >
                   <div className="relative h-[64px] w-[64px]">
                     <img src={artist.image || artist.artist?.image} alt={artist.name || artist.artist?.name} className="h-full w-full rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                     <div className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-md px-1 py-0.5 text-[7px] font-black border border-white/10">{idx + 1}</div>
                     <div className="absolute bottom-1 right-1 bg-orange-500/90 backdrop-blur-sm px-1 py-0.5 rounded text-[7px] font-black text-white">
                       {artist.playcount || artist.streams || 0}
                     </div>
                   </div>
                   <div className="text-center w-full">
                     <span className="text-[9px] font-bold text-white/80 line-clamp-1 leading-tight">{artist.name || artist.artist?.name}</span>
                   </div>
                 </motion.div>
               ))}
             </div>
          </div>
        )}

        {/* Faixas */}
        {tops.tracks.length > 0 && (
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">Faixas</span>
                <div className="h-[1px] flex-1 bg-white/5" />
             </div>
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 scroll-fade-h">
               {tops.tracks.map((track, idx) => (
                 <motion.div 
                   key={track.id || idx} 
                   initial={{ opacity: 0, scale: 0.9 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true }}
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   className="flex flex-col gap-1.5 shrink-0 w-[64px] cursor-pointer"
                   onClick={() => onItemClick?.(track)}
                  >
                   <div className="relative h-[64px] w-[64px]">
                     <img src={track.image || track.album?.image} alt={track.name} className="h-full w-full rounded-xl object-cover border border-white/10 shadow-lg shadow-black/40" referrerPolicy="no-referrer" />
                     <div className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-md px-1 py-0.5 text-[7px] font-black border border-white/10">{idx + 1}</div>
                     <div className="absolute bottom-1 right-1 bg-orange-500/90 backdrop-blur-sm px-1 py-0.5 rounded text-[7px] font-black text-white">
                        {track.playcount || track.streams || 0}
                     </div>
                   </div>
                   <div className="flex flex-col w-full">
                     <span className="text-[9px] font-bold text-white/90 truncate">{track.name}</span>
                   </div>
                 </motion.div>
               ))}
             </div>
          </div>
        )}

        {/* Álbuns */}
        {tops.albums.length > 0 && (
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">Álbuns</span>
                <div className="h-[1px] flex-1 bg-white/5" />
             </div>
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 scroll-fade-h">
               {tops.albums.map((album, idx) => (
                 <motion.div 
                   key={album.id || idx} 
                   initial={{ opacity: 0, scale: 0.9 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true }}
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   className="flex flex-col gap-1.5 shrink-0 w-[64px] cursor-pointer"
                   onClick={() => onItemClick?.(album)}
                  >
                   <div className="relative h-[64px] w-[64px]">
                     <img src={album.image || album.album?.image} alt={album.name || album.album?.name} className="h-full w-full rounded-xl object-cover border border-white/10 shadow-lg shadow-black/40" referrerPolicy="no-referrer" />
                     <div className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-md px-1 py-0.5 text-[7px] font-black border border-white/10">{idx + 1}</div>
                     <div className="absolute bottom-1 right-1 bg-orange-500/90 backdrop-blur-sm px-1 py-0.5 rounded text-[7px] font-black text-white">
                        {album.playcount || album.streams || 0}
                     </div>
                   </div>
                   <div className="flex flex-col w-full">
                     <span className="text-[9px] font-bold text-white/90 line-clamp-1 leading-tight">{album.name || album.album?.name}</span>
                   </div>
                 </motion.div>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
