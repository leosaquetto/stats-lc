/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Headphones, Music2, Activity, TrendingUp, Trophy, Medal, X, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, History } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { coreUtils, GROUP_USERS } from '../services/statsCore';
import { statsService } from '../services/statsService';
import { useStatsStore } from '../store/useStatsStore';
import { UserStats, TopItem } from '../types/stats';
import { LOGO_ORANGE, LOGO_BLACK_ORANGE } from '../constants';
import { formatTimeSP, formatDateSP, formatRelativeTimeSP, isTodaySP } from '../lib/time';

import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Memoized List Item for Virtualization
const TopRankRow = React.memo(({ 
  index, 
  style,
  topItems
}: { 
  index: number; 
  style: React.CSSProperties;
  topItems: TopItem[];
}) => {
  const item = topItems[index];
  if (!item) return null;
  
  return (
    <div style={style} className="px-1 py-1">
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="glass flex items-center justify-between px-3 py-2 rounded-[20px] border-white/5 group hover:bg-white/[0.08] transition-all h-full"
      >
         <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-black text-white/30 w-4 pl-1">#{index + 1}</span>
            <SmartImage 
              src={item.image} 
              className="h-8 w-8 shadow-md border border-white/10" 
              rounded="xl"
              fallback=""
            />
            <div className="flex flex-col min-w-0 pr-2">
               <span className="text-[12px] font-black text-white tracking-tight truncate max-w-[150px]">{item.name}</span>
               <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest truncate max-w-[150px]">
                  {item.artists ? item.artists.map(a => a.name).join(', ') : 'Mais ouvidos'}
               </span>
            </div>
         </div>
         <div className="text-right shrink-0">
            <div className="bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded-full flex items-center justify-center">
               <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">
                  {coreUtils.formatNumber(item.streams || 0)}
               </span>
            </div>
         </div>
      </motion.div>
    </div>
  );
});

export const StatsLCLogo = ({ size = 32, className = "", variant = "orange" }: { size?: number, className?: string, variant?: 'orange' | 'black' }) => {
  return (
    <motion.div 
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Animated Glow behind the logo */}
      <motion.div 
        className="absolute inset-0 rounded-full bg-orange-500/20 blur-md"
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
      />
      
      {variant === 'orange' ? (
        <LOGO_ORANGE className="w-full h-full relative z-10 drop-shadow-lg" />
      ) : (
        <LOGO_BLACK_ORANGE className="w-full h-full relative z-10 drop-shadow-lg rounded-[20%] overflow-hidden" />
      )}
    </motion.div>
  );
};

export const SmartImage = ({ src, className, fallback = "👤", rounded = "2xl" }: { src?: string, className?: string, fallback?: string, rounded?: string }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const finalSrc = error || !src || src.includes("private.webp")
    ? `https://ui-avatars.com/api/?background=222&color=fff&name=${encodeURIComponent(fallback)}`
    : src;

  return (
    <div className={cn("relative overflow-hidden bg-white/5", className, `rounded-${rounded}`)}>
      {loading && <div className="absolute inset-0 animate-pulse bg-white/5" />}
      <img
        src={finalSrc}
        className={cn("h-full w-full object-cover transition-opacity duration-300", loading ? "opacity-0" : "opacity-100")}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        alt=""
      />
    </div>
  );
};

export const MarqueeText = ({ text, className }: { text: string; className?: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const diff = textRef.current.scrollWidth - containerRef.current.clientWidth;
      setOverflow(diff > 0 ? diff : 0);
    }
  }, [text]);

  return (
    <div 
      ref={containerRef}
      className={cn("overflow-hidden whitespace-nowrap w-full relative", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        animate={isHovered && overflow > 0 ? { x: -overflow - 12 } : { x: 0 }}
        transition={{ duration: overflow > 0 ? Math.max(overflow / 30, 0.4) : 0.3, ease: "linear" }}
        className="inline-block"
      >
        <span ref={textRef} title={text}>{text}</span>
      </motion.div>
    </div>
  );
}

export const UserDetailModal = ({ 
  user: initialUser, 
  onClose 
}: { 
  user: UserStats, 
  onClose: () => void 
}) => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const isLeo = initialUser.id === "leo";
  const [activeTab, setActiveTab] = useState<'artists' | 'tracks' | 'albums'>('artists');
  
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const full = await statsService.getUserFullStats(initialUser.id);
        const transformedTopItems = {
          artists: (full.tops.artists || []).map((a: any) => ({
            id: a.artist?.id || a.id,
            name: a.artist?.name || a.name,
            image: a.artist?.image || a.image,
            streams: a.playcount || a.streams || 0
          })),
          tracks: (full.tops.tracks || []).map((t: any) => ({
            id: t.track?.id || t.id,
            name: t.track?.name || t.name,
            image: t.track?.image || t.image,
            streams: t.playcount || t.streams || 0,
            artists: t.track?.artists || t.artists || []
          })),
          albums: (full.tops.albums || []).map((al: any) => ({
            id: al.album?.id || al.id,
            name: al.album?.name || al.name,
            image: al.album?.image || al.image,
            streams: al.playcount || al.streams || 0
          }))
        };
        setUserData({ ...full, transformedTopItems });
      } catch (e) {
        console.error("Failed to load user detail", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [initialUser.id]);

  const stats = userData?.stats || {
    today: { count: initialUser.streamsToday },
    month: { count: (initialUser as any).totalStreams },
    lifetime: { count: (initialUser as any).scrobbles }
  };

  const topItems = userData?.transformedTopItems?.[activeTab] || [];
  const avatar = coreUtils.withPeterFallback(initialUser.id, initialUser.avatar);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-[#050505] w-full h-[92vh] rounded-t-[48px] overflow-y-auto no-scrollbar border-t border-white/5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner Area */}
        <div className="relative h-64 overflow-hidden">
           <button 
             onClick={onClose}
             className="absolute top-8 right-8 z-50 h-11 w-11 glass rounded-2xl flex items-center justify-center text-white/40 hover:text-white/90 active:scale-90 transition-all border border-white/5 shadow-2xl"
           >
             <X className="h-5 w-5" />
           </button>
           <img 
              src={avatar} 
              className="w-full h-full object-cover blur-2xl opacity-20 scale-150" 
              alt="" 
           />
           <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505]" />
           
           <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
              <div className={cn(
                "h-32 w-32 rounded-[40px] p-1.5 shadow-2xl transition-all duration-500",
                isLeo ? "bg-orange-500/20" : "bg-white/5"
              )}>
                 <img 
                    src={avatar} 
                    className="h-full w-full object-cover rounded-[36px]" 
                    referrerPolicy="no-referrer" 
                    alt="" 
                 />
              </div>
              <h2 className={cn(
                "mt-6 text-2xl font-mundial font-semibold tracking-tight",
                isLeo ? "text-orange-400" : "text-white/90"
              )}>
                {initialUser.name}
              </h2>
              
              {initialUser.nowPlaying?.track && initialUser.nowPlaying.track.name !== "Desconhecido" ? (
                <div className="mt-4 flex flex-col items-center">
                  <MusicPlatformBadge track={initialUser.nowPlaying.track} showLabel />
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className={cn(
                       "h-1 w-1 rounded-full",
                       coreUtils.getPlaybackStatus(initialUser).status === "live" ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-white/20"
                    )} />
                    <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">
                       {coreUtils.getPlaybackStatus(initialUser).label}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-3">
                   <div className={cn(
                     "h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]",
                     loading ? "bg-white/20 animate-pulse" : "bg-green-500"
                   )} />
                   <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.25em]">
                      {loading ? "Sincronizando..." : "Sinal Inativo"}
                   </span>
                </div>
              )}
           </div>
           
           <button 
             onClick={onClose}
             className="absolute top-8 right-8 h-10 w-10 glass rounded-full flex items-center justify-center border-white/10 active:scale-90 transition-transform"
           >
              <span className="text-xl">×</span>
           </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-32 -mt-4 relative z-10">
           <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="glass-card p-6 flex flex-col gap-2 premium-gradient overflow-hidden">
                 <span className="text-[9px] font-black text-white/50 uppercase tracking-widest text-center">Streams Mês</span>
                 <span className="text-2xl font-display font-black text-center text-white/90">
                    {loading ? "..." : coreUtils.formatNumber(stats.month?.count || 0)}
                 </span>
              </div>
              <div className="glass-card p-6 flex flex-col gap-2 premium-gradient overflow-hidden">
                 <span className="text-[9px] font-black text-white/50 uppercase tracking-widest text-center">Tempo Mês</span>
                 <span className="text-2xl font-display font-black text-center text-white/90 truncate">
                    {loading ? "..." : coreUtils.formatDuration(stats.month?.durationMs || 0)}
                 </span>
              </div>
           </div>

           <div className="flex flex-col gap-8">
              <SectionHeader title="Destaques Hoje" />
              <div className="glass-card p-5 flex items-center justify-between border-orange-500/10 bg-orange-500/5">
                 <div className="flex items-center gap-4">
                    <div className="h-14 w-14 glass rounded-2xl flex items-center justify-center italic font-black text-orange-400 text-lg shadow-inner">
                       {loading ? "?" : stats.today?.count || 0}
                    </div>
                    <div>
                       <h4 className="text-[14px] font-black text-white/80 uppercase tracking-tight">Streams Hoje</h4>
                       <div className="flex items-center gap-2 mt-0.5">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest leading-none">Meta Ativa</span>
                       </div>
                    </div>
                 </div>
                 <div className="h-2 w-16 rounded-full bg-white/5 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: loading ? '20%' : `${Math.min((stats.today?.count || 0) * 2, 100)}%` }}
                      className="h-full bg-orange-500" 
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <SectionHeader title="Top Rankings" />
                   <div className="flex gap-1 bg-white/5 p-1 rounded-xl glass border border-white/5 self-start sm:self-center">
                      {(['artists', 'tracks', 'albums'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                            activeTab === tab ? "bg-white text-[#050505]" : "text-white/60"
                          )}
                        >
                          {tab === 'artists' ? 'Artistas' : tab === 'tracks' ? 'Músicas' : 'Álbuns'}
                        </button>
                      ))}
                   </div>
                </div>
 
                <div className="flex flex-col gap-3 h-[400px]">
                   {loading ? (
                     <div className="flex flex-col gap-3">
                        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-[28px]" />)}
                     </div>
                   ) : topItems.length > 0 ? (
                      <AutoSizer
                        renderProp={({ height, width }) => (
                          <List
                            style={{ height: height || 400, width: width || 320 }}
                            rowCount={topItems.slice(0, 20).length}
                            rowHeight={56}
                            rowComponent={TopRankRow as any}
                            rowProps={{ topItems: topItems.slice(0, 20) } as any}
                            className="no-scrollbar"
                          />
                        )}
                      />
                   ) : (
                      <div className="py-12 text-center glass rounded-[24px] border-dashed border-white/20">
                         <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Sem dados para este período</span>
                      </div>
                   )}
                </div>
              </div>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const StatsBattleModal = ({ 
  userA, 
  userB, 
  onClose 
}: { 
  userA: UserStats, 
  userB: UserStats, 
  onClose: () => void 
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="glass-card w-full max-w-lg rounded-t-[48px] p-8 max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
        
        <div className="flex items-center justify-between mb-12 px-4">
          <div className="flex flex-col items-center gap-3">
             <div className="h-20 w-20 rounded-full p-1 bg-gradient-to-tr from-orange-500 to-orange-300">
                <SmartImage 
                  src={coreUtils.getUserAvatar(userA.id, userA.avatar)} 
                  className="h-full w-full rounded-full" 
                  fallback="" 
                  rounded="full" 
                />
             </div>
             <span className="text-xs font-mundial font-semibold tracking-widest text-white/60">{userA.name}</span>
          </div>
          
          <div className="flex flex-col items-center">
             <span className="text-4xl font-display font-black italic text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">VS</span>
             <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mt-2">Arena Battle</span>
          </div>
 
          <div className="flex flex-col items-center gap-3">
             <div className="h-20 w-20 rounded-full p-1 bg-white/20">
                <SmartImage 
                  src={coreUtils.getUserAvatar(userB.id, userB.avatar)} 
                  className="h-full w-full rounded-full" 
                  fallback="" 
                  rounded="full" 
                />
             </div>
             <span className="text-xs font-mundial font-semibold tracking-widest text-white/60">{userB.name}</span>
          </div>
        </div>

        {/* Global Stats */}
        <div className="flex flex-col gap-6 mb-12">
           <BattleMetric 
              label="Streams Totais" 
              valA={coreUtils.formatNumber(userA.totalStreams || 0)} 
              valB={coreUtils.formatNumber(userB.totalStreams || 0)}
              winner={ (userA.totalStreams || 0) > (userB.totalStreams || 0) ? 'A' : 'B' }
           />
           <BattleMetric 
              label="Tempo Ouvido" 
              valA={coreUtils.formatDuration(userA.totalDurationMs || 0)} 
              valB={coreUtils.formatDuration(userB.totalDurationMs || 0)}
              winner={ (userA.totalDurationMs || 0) > (userB.totalDurationMs || 0) ? 'A' : 'B' }
           />
           <BattleMetric 
              label="Hoje" 
              valA={coreUtils.formatNumber(userA.streamsToday)} 
              valB={coreUtils.formatNumber(userB.streamsToday)}
              winner={ userA.streamsToday > userB.streamsToday ? 'A' : 'B' }
           />
        </div>

        {/* Detailed Comparisons */}
        <div className="flex flex-col gap-10 mt-12 pb-10">
           <ComparisonSection 
              title="Top Artistas do Mês" 
              itemsA={userA.topItems?.artists.slice(0, 3) || []} 
              itemsB={userB.topItems?.artists.slice(0, 3) || []} 
           />
           <ComparisonSection 
              title="Top Músicas do Mês" 
              itemsA={userA.topItems?.tracks.slice(0, 3) || []} 
              itemsB={userB.topItems?.tracks.slice(0, 3) || []} 
           />
        </div>

        <button 
          onClick={onClose}
          className="w-full h-16 rounded-[24px] bg-white/5 border border-white/10 text-sm font-black uppercase tracking-widest active:scale-95 transition-all sticky bottom-0"
        >
          Fechar Batalha
        </button>
      </motion.div>
    </motion.div>
  );
};

const ComparisonSection = ({ title, itemsA, itemsB }: { title: string, itemsA: TopItem[], itemsB: TopItem[] }) => (
  <div className="flex flex-col gap-6">
    <div className="flex items-center gap-4">
       <div className="h-px flex-1 bg-white/10" />
       <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] whitespace-nowrap">{title}</span>
       <div className="h-px flex-1 bg-white/10" />
    </div>
    
    <div className="flex flex-col gap-4 px-2">
      {[0, 1, 2].map(i => (
        <div key={i} className="flex items-center justify-between gap-4 h-14">
          {/* User A Item */}
          <div className="flex flex-1 items-center gap-3 overflow-hidden">
             {itemsA[i] ? (
               <>
                 <SmartImage 
                    src={itemsA[i].image} 
                    className="min-w-[36px] h-[36px] border border-white/10" 
                    fallback=""
                    rounded="lg"
                 />
                 <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black text-white/80 truncate leading-tight">{itemsA[i].name}</span>
                    <span className="text-[8px] font-black text-orange-500/60 uppercase tracking-widest">{coreUtils.formatNumber(itemsA[i].streams || 0)}</span>
                 </div>
               </>
             ) : (
               <div className="h-9 w-full bg-white/[0.02] border border-dashed border-white/5 rounded-lg" />
             )}
          </div>

          <span className="text-[9px] font-black text-white/10 italic">#{i+1}</span>

          {/* User B Item */}
          <div className="flex flex-1 items-center gap-3 overflow-hidden justify-end text-right">
             {itemsB[i] ? (
               <>
                 <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black text-white/80 truncate leading-tight">{itemsB[i].name}</span>
                    <span className="text-[8px] font-black text-orange-500/60 uppercase tracking-widest">{coreUtils.formatNumber(itemsB[i].streams || 0)}</span>
                 </div>
                 <SmartImage 
                    src={itemsB[i].image} 
                    className="min-w-[36px] h-[36px] border border-white/10" 
                    fallback=""
                    rounded="lg"
                 />
               </>
             ) : (
               <div className="h-9 w-full bg-white/[0.02] border border-dashed border-white/5 rounded-lg" />
             )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const BattleMetric = ({ label, valA, valB, winner }: { label: string, valA: string, valB: string, winner: 'A' | 'B' }) => (
  <div className="flex flex-col gap-2">
    <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] text-center">{label}</span>
    <div className="flex items-center justify-between px-4">
       <span className={cn(
         "text-xl font-display font-black tracking-tighter transition-all",
         winner === 'A' ? "text-orange-500 scale-110" : "text-white/60"
       )}>{valA}</span>
       <div className="h-px flex-1 mx-4 bg-white/10" />
       <span className={cn(
         "text-xl font-display font-black tracking-tighter transition-all",
         winner === 'B' ? "text-orange-500 scale-110" : "text-white/60"
       )}>{valB}</span>
    </div>
  </div>
);

interface MusicCardProps {
  key?: string | number;
  userId: string;
  userName: string;
  songName: string;
  artistName: string;
  track?: any; // Objeto track completo opcional
  imageUrl?: string;
  isNowPlaying?: boolean;
  className?: string;
  footer?: string;
  onClick?: () => void;
}

export const MusicCard = React.memo(({ 
  userId,
  userName, 
  songName, 
  artistName, 
  track,
  imageUrl, 
  isNowPlaying, 
  className,
  footer,
  onClick
}: MusicCardProps) => {
  const isLeo = userId === "leo";
  const accentColor = isLeo ? ({id: "leo", name: "Leo", color: "#FF9F0A"}).color : "#FFFFFF";
  const trackImage = coreUtils.getAvatarUrl(userId, imageUrl);
  const userAvatar = coreUtils.getUserAvatar(userId);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={onClick ? { y: -4, backgroundColor: "rgba(255, 255, 255, 0.08)" } : {}}
      onClick={onClick}
      className={cn(
        "glass-card group relative flex items-center gap-4 border-white/5 p-4 bg-white/[0.03]",
        onClick && "cursor-pointer active:scale-[0.98] transition-all",
        className
      )}
      style={{ 
        boxShadow: isNowPlaying ? `0 0 20px ${accentColor}10` : undefined,
        borderColor: isNowPlaying ? `${accentColor}30` : undefined
      }}
    >
      <div className="relative h-14 w-14 shrink-0">
        <div className="h-full w-full rounded-[14px] bg-white/5 overflow-hidden relative">
          <SmartImage 
            src={trackImage} 
            className="h-full w-full" 
            fallback=""
            rounded="[14px]"
          />
          {isNowPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
               <div className="flex items-end gap-[1.5px] h-2.5">
                  {[0,1,2].map(i => (
                    <motion.div key={i} animate={{ height: ["20%", "100%", "40%"] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} className="w-[1.5px] bg-white rounded-full" />
                  ))}
               </div>
            </div>
          )}
        </div>
        
        {/* User Badge Overlay */}
        <div className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-[#111] bg-black overflow-hidden shadow-lg shadow-black/80 z-20">
          <img src={userAvatar} className="h-full w-full object-cover" referrerPolicy="no-referrer" alt="" />
        </div>
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{userName}</span>
          <div className="flex items-center gap-1.5">
            {userId && <MusicPlatformBadge userId={userId} className="p-0 border-none bg-transparent h-2.5 w-2.5 opacity-50 shrink-0" />}
            {footer && <span className="text-[8px] font-bold text-white/30 uppercase tracking-tighter whitespace-nowrap">{footer}</span>}
          </div>
        </div>
        <MarqueeText 
          text={songName || ""} 
          className="font-display text-sm font-semibold text-white group-hover:text-orange-500 transition-colors"
        />
        <MarqueeText 
          text={artistName || ""} 
          className="text-[10px] font-medium text-white/50"
        />
      </div>
    </motion.div>
  );
}, (prev, next) => (
  prev.userId === next.userId &&
  prev.songName === next.songName &&
  prev.isNowPlaying === next.isNowPlaying &&
  prev.footer === next.footer &&
  prev.imageUrl === next.imageUrl
));

export const TruncatedTooltipText = ({ text, className, lineClamp = 2 }: { text: string; className?: string; lineClamp?: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      if (containerRef.current) {
        const { scrollHeight, clientHeight } = containerRef.current;
        setIsTruncated(scrollHeight > clientHeight);
      }
    };

    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [text, lineClamp]);

  return (
    <div className="relative w-full group/tooltip">
      <div 
        ref={containerRef}
        className={cn(className, lineClamp === 1 ? "truncate" : `line-clamp-${lineClamp}`)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {text}
      </div>

      <AnimatePresence>
        {isHovered && isTruncated && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-xl glass border border-white/10 shadow-2xl pointer-events-none w-max max-w-[160px] text-center"
          >
            <p className="text-[10px] font-bold text-white whitespace-normal leading-tight">{text}</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ScrollingText = ({ text, className, speed = 30 }: { text: string; className?: string; speed?: number }) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const check = () => {
      if (containerRef.current && measureRef.current) {
        const cWidth = containerRef.current.offsetWidth;
        const mWidth = measureRef.current.scrollWidth;
        setScrollWidth(mWidth);
        setShouldAnimate(mWidth > cWidth + 1);
      }
    };
    check();
    const t = setTimeout(check, 200);
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      clearTimeout(t);
    };
  }, [text]);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden w-full min-w-0", className)}>
      {/* Hidden element for measurement */}
      <span ref={measureRef} className="invisible absolute top-0 left-0 whitespace-nowrap pointer-events-none opacity-0">
        {text}
      </span>
      
      {shouldAnimate ? (
        <motion.div
          animate={{ x: [0, -(scrollWidth + 32)] }}
          transition={{
            duration: Math.max(scrollWidth / speed, 8),
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 3
          }}
          className="flex w-max whitespace-nowrap"
        >
          <span className="shrink-0 pr-8">{text}</span>
          <span className="shrink-0 pr-8">{text}</span>
        </motion.div>
      ) : (
        <div className="truncate w-full block whitespace-nowrap">
          {text}
        </div>
      )}
    </div>
  );
};

export const FriendsHorizontalCard = React.memo(({ 
  userId,
  userName, 
  userAvatar: providedAvatar,
  songName, 
  artistName,
  imageUrl, 
  isNowPlaying: rawIsNowPlaying,
  timestamp,
  onClick,
  playedCount
}: any) => {
  const playback = coreUtils.getPlaybackStatus({ nowPlaying: { isNow: rawIsNowPlaying, timestamp, track: { name: songName } } });
  const isActuallyLive = playback.status === "live";
  
  const trackImage = coreUtils.getAvatarUrl(userId, imageUrl);
  const userAvatar = coreUtils.getUserAvatar(userId, providedAvatar);
  const firstName = (userName || "").split(' ')[0].toUpperCase();
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 group w-full min-w-0 transition-opacity duration-500",
        !isActuallyLive && "opacity-60",
        onClick && "cursor-pointer active:scale-95 text-center"
      )}
    >
      {/* User Name ABOVE the photo */}
      <span className={cn(
        "text-[9px] font-mundial font-black tracking-widest uppercase truncate w-full text-center px-1",
        isActuallyLive ? "text-orange-500" : "text-white/40"
      )}>
        {firstName}
      </span>

      <div className="relative">
        <div className={cn(
          "h-14 w-14 sm:h-20 sm:w-20 rounded-[20px] sm:rounded-[28px] p-[1.5px] transition-all duration-500 shadow-xl",
          isActuallyLive ? "bg-gradient-to-tr from-orange-400 via-orange-500 to-yellow-500" : "bg-white/10"
        )}>
          <div className="h-full w-full rounded-[18px] sm:rounded-[26px] bg-[#050505] overflow-hidden relative">
            <SmartImage 
              src={trackImage} 
              className={cn("h-full w-full grayscale transition-all duration-700", isActuallyLive && "grayscale-0 scale-110")} 
              fallback=""
            />
          </div>
        </div>
        
        {/* Overlaid User Avatar */}
        <div className="absolute -bottom-1 -right-1 h-6 w-6 sm:h-7 sm:w-7 rounded-full border-2 border-[#050505] bg-black overflow-hidden shadow-2xl z-10 transition-transform group-hover:scale-110">
          <img src={userAvatar} className="h-full w-full object-cover" referrerPolicy="no-referrer" alt="" />
        </div>
      </div>

      <div className="flex flex-col items-center min-w-0 w-full gap-0.5">
        <MusicPlatformBadge userId={userId} className="p-0 border-none bg-transparent h-2 opacity-30 shadow-none mb-0.5" />
        
        {/* Artist Name: Uppercase, smaller font, 2 lines */}
        <TruncatedTooltipText 
          text={artistName || "-"}
          className="text-[7px] font-black text-white/30 uppercase tracking-[0.05em] leading-[1.1] min-h-[16px] text-center px-0.5"
          lineClamp={2}
        />

        {/* Track Name: 2 lines */}
        <TruncatedTooltipText 
          text={songName }
          className="text-[10px] font-black text-white/80 leading-tight min-h-[24px] text-center px-0.5"
          lineClamp={2}
        />

        {playedCount && (
           <div className="mt-0.5 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/5 flex items-center">
              <span className="text-[6.5px] font-black text-white/40 uppercase tracking-widest leading-none">
                {coreUtils.formatPlayCount(playedCount)}
              </span>
           </div>
        )}

        {/* Status Tag */}
        {isActuallyLive ? (
          <motion.div 
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="mt-1 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20"
          >
            <span className="text-[7px] font-black text-orange-500 uppercase tracking-widest whitespace-nowrap">Ouvindo</span>
          </motion.div>
        ) : (
          <div className="mt-1">
            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest text-center px-1">
              {timestamp ? coreUtils.formatRelativeTimeSP(timestamp) : "off"}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prev, next) => (
  prev.userId === next.userId &&
  prev.songName === next.songName &&
  prev.rawIsNowPlaying === next.rawIsNowPlaying &&
  prev.timestamp === next.timestamp &&
  prev.imageUrl === next.imageUrl
));
export const LiveTrackProgress = ({ 
  progressMs,
  playedMs, 
  durationMs, 
  timestamp, 
  isNowPlaying,
  platform
}: { 
  progressMs?: number,
  playedMs?: number, 
  durationMs?: number, 
  timestamp: string | number,
  isNowPlaying: boolean;
  platform: "spotify" | "appleMusic" | "unknown";
}) => {
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    if (!isNowPlaying) {
      setCurrentProgress(100);
      return;
    }

    // Base progress estimation: start from progressMs/playedMs and add time elapsed since the record's timestamp
    const baseProgress = progressMs ?? playedMs ?? 0;
    
    if (durationMs) {
      const calculateProgress = () => {
        const startTime = new Date(timestamp).getTime();
        const now = Date.now();
        const elapsedSinceLog = Math.max(0, now - startTime);
        const totalProgressMs = baseProgress + elapsedSinceLog;
        const percent = (totalProgressMs / durationMs) * 100;
        setCurrentProgress(Math.min(percent, 100));
      };

      calculateProgress();
      const interval = setInterval(calculateProgress, 1000);
      return () => clearInterval(interval);
    } 
    // Fallback: Progresso estimado
    else if (durationMs && isNowPlaying) {
      const calculateProgress = () => {
        const startTime = new Date(timestamp).getTime();
        const now = Date.now();
        const elapsedMs = now - startTime;
        const percent = (elapsedMs / durationMs) * 100;
        setCurrentProgress(Math.min(percent, 100));
      };

      calculateProgress();
      const interval = setInterval(calculateProgress, 1000);
      return () => clearInterval(interval);
    }
    // Apple Music ou outros sem duration: shimmer maroto apenas se live
    else if (isNowPlaying) {
      const interval = setInterval(() => {
        setCurrentProgress(prev => (prev + 0.5) % 100);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setCurrentProgress(100);
    }
  }, [progressMs, playedMs, durationMs, timestamp, isNowPlaying, platform]);

  // Se não for LIVE, mostramos apenas uma barra estática fina e discreta
  if (!isNowPlaying) {
    return (
      <div className="flex flex-col gap-1.5 opacity-20">
        <div className="h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
           <div className="h-full w-full bg-white/30" />
        </div>
        <div className="flex justify-between items-center px-0.5">
           <span className="text-[7px] font-black uppercase tracking-widest text-white/30">Concluído</span>
           {durationMs && (
              <span className="text-[7.5px] font-mono text-white/30">{coreUtils.formatDurationSmart(durationMs)}</span>
           )}
        </div>
      </div>
    );
  }

  // Se não tem duration e não é estimável (raro agora com o novo backend)
  if (!durationMs) {
     return (
       <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <motion.div 
            animate={{ x: ["-100%", "100%"] }} 
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="h-full w-1/3 bg-orange-500/20" 
          />
       </div>
     );
  }

  const elapsedMs = (currentProgress / 100) * durationMs;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden relative">
        <motion.div 
          initial={false}
          animate={{ width: `${currentProgress}%` }}
          transition={{ ease: "linear", duration: 1 }}
          className="h-full bg-gradient-to-r from-orange-600 via-orange-400 to-yellow-500 shadow-[0_0_8px_rgba(255,159,10,0.4)]" 
        />
      </div>
      <div className="flex justify-between items-center px-0.5">
        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest leading-none">
           {coreUtils.formatDurationSmart(elapsedMs)}
        </span>
        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest leading-none">
           {coreUtils.formatDurationSmart(durationMs)}
        </span>
      </div>
    </div>
  );
};

export const LeoHeader = ({ user, streamsToday, onTrackClick }: { user: UserStats, streamsToday: number, onTrackClick?: (track: any) => void }) => {
  if (!user) return null;
  const accentColor = ({id: "leo", name: "Leo", color: "#FF9F0A"}).color;
  const profileAvatar = coreUtils.getUserAvatar(user.id, user.avatar);
  const nowPlaying = user.nowPlaying;
  const track = nowPlaying?.track;
  const albumImage = track?.image;
  const playback = coreUtils.getPlaybackStatus({ nowPlaying });
  const isActuallyLive = playback.status === "live";
  const platform = user.platform || coreUtils.getUserPlaybackPlatform(user.id);
  
  const [arenaExpanded, setArenaExpanded] = useState(false);
  
  const fetchTrackStatsForAll = useStatsStore(state => state.fetchTrackStatsForAll);
  const userTrackStats = useStatsStore(state => state.userTrackStats);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const hideRankingBadge = useStatsStore(state => state.hideRankingBadge);
  const groupStats = useStatsStore(state => state.groupStats);
  const membersData = groupStats?.users || {};

  const trackStatsKey = `${user.id}:${track?.id}`;
  const playCount = userTrackStats[trackStatsKey];

  useEffect(() => {
    if (track?.id) {
      fetchTrackStatsForAll(track.id);
    }
  }, [track?.id, fetchTrackStatsForAll]);

  const allTrackArenaUsers = Object.values(membersData)
    .map(u => ({
      id: u.id,
      name: u.name,
      plays: userTrackStats[`${u.id}:${track?.id}`] || 0,
      avatar: coreUtils.getUserAvatar(u.id, u.avatar)
    }))
    .filter(u => u.plays > 0)
    .sort((a, b) => b.plays - a.plays);

  const trackArenaUsers = arenaExpanded ? allTrackArenaUsers : allTrackArenaUsers.slice(0, 5);
  const hasMoreArena = allTrackArenaUsers.length > 5;

  const formattedTime = nowPlaying?.timestamp ? formatTimeSP(new Date(nowPlaying.timestamp)) : "";
  const statusLabel = isActuallyLive ? "OUVINDO AGORA" : "REPRODUZIDO ÀS " + formattedTime;
  const showRankingSummary = !hideRankingBadge && allTrackArenaUsers.filter(u => u.id !== featuredUserId).length > 0;

  const durationMs = track?.durationMs || nowPlaying?.durationMs || null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[42px] bg-[#0A0A0A] border border-white/5 p-6 mb-6 shadow-2xl"
    >
      <AnimatePresence>
        {isActuallyLive && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
            {/* High Performance Mesh Gradient - Increased Speed and Intensity */}
            <motion.div 
              animate={{ 
                scale: [1, 1.3, 1],
                rotate: [0, 120, 0],
                x: ['-20%', '20%', '-20%'],
                y: ['-15%', '10%', '-15%'],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-[50%] bg-[radial-gradient(circle_at_center,rgba(255,159,10,0.25)_0%,transparent_50%)] pointer-events-none"
            />
            <motion.div 
              animate={{ 
                scale: [1.3, 1, 1.3],
                rotate: [360, 240, 360],
                x: ['20%', '-20%', '20%'],
                y: ['10%', '-15%', '10%'],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-[50%] bg-[radial-gradient(circle_at_center,rgba(255,80,0,0.18)_0%,transparent_45%)] pointer-events-none"
            />
            <motion.div 
              animate={{ 
                opacity: [0.5, 0.8, 0.5],
                scale: [1, 1.05, 1],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-t from-orange-500/[0.12] to-transparent pointer-events-none"
            />
          </div>
        )}
      </AnimatePresence>
      
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full p-[1.5px] bg-gradient-to-tr from-orange-500 to-yellow-500 shadow-lg">
               <SmartImage 
                 src={profileAvatar} 
                 className="h-full w-full rounded-full" 
                 fallback="" 
                 rounded="full"
               />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-mundial font-bold text-white/90 leading-tight truncate">{user.name}</span>
                <MusicPlatformBadge platform={platform} className="bg-white/[0.03] border-white/5 opacity-50" />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={cn(
                   "h-1 w-1 rounded-full",
                   isActuallyLive ? "bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(255,159,10,0.8)]" : "bg-white/20"
                )} />
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/20">
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
             <span className="text-3xl font-display font-black text-white tracking-tighter leading-none">
                <AnimatedNumber value={streamsToday} />
             </span>
             <span className="text-[7.5px] font-black uppercase tracking-[0.25em] text-white/25 mt-1.5">Total Hoje</span>
          </div>
        </div>

        {track ? (
           <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                 <div className="relative shrink-0">
                    <motion.div 
                      onClick={() => onTrackClick?.(track)}
                      whileTap={{ scale: 0.95 }}
                      className="relative h-36 w-36 rounded-[36px] overflow-hidden shadow-2xl border border-white/10 cursor-pointer group z-10"
                    >
                       <SmartImage src={albumImage} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" fallback="" />
                    </motion.div>
                 </div>

                 <div className="flex flex-1 flex-col min-w-0">
                    <ScrollingText 
                      text={track.name} 
                      className="text-[20px] font-display font-black text-white leading-tight tracking-tight" 
                    />
                    <div className="text-[13px] font-medium text-white/60 line-clamp-1 mt-0.5">
                       {Array.isArray(track.artists) ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') : "Artista Desconhecido"}
                    </div>
                    {track.albumName && (
                      <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1 line-clamp-1 opacity-40">
                        {track.albumName}
                      </div>
                    )}

                    {/* Ranking/Stats Logic - Using overlapping avatar style from Arena Group Live */}
                    <div className="flex justify-start items-center gap-2 mt-4">
                       {!showRankingSummary ? (
                          playCount !== undefined && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 flex items-center gap-2 shrink-0 shadow-lg"
                            >
                               <div className="h-4 w-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                                  <Headphones className="h-2.5 w-2.5 text-orange-500" />
                               </div>
                               <span className="text-[9px] font-black text-white/70 uppercase tracking-[0.1em] whitespace-nowrap">{coreUtils.formatPlayCount(playCount)}</span>
                            </motion.div>
                          )
                       ) : (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-start items-center gap-3"
                          >
                             <div className={cn(
                                "flex items-center gap-2 !pl-0 px-2.5 py-1.5 rounded-[22px] !border-none shadow-2xl transition-all",
                                arenaExpanded && "flex-wrap max-w-[200px] justify-center"
                             )}>
                                <div className="flex -space-x-2.5 overflow-visible px-0.5">
                                   {trackArenaUsers.map((u, i) => (
                                     <motion.div 
                                       key={u.id}
                                       layout
                                       className="relative group/arena shrink-0"
                                       style={{ zIndex: trackArenaUsers.length - i }}
                                     >
                                        <div className={cn(
                                           "h-7 w-7 rounded-full transition-all duration-300",
                                           u.id === featuredUserId ? "ring-2 ring-orange-500/40 bg-orange-500/10" : ""
                                        )}>
                                           <div className="h-full w-full rounded-full p-[1.5px] overflow-hidden">
                                              <SmartImage src={u.avatar} className="h-full w-full rounded-full" fallback="" rounded="full" />
                                           </div>
                                        </div>
                                        <div className={cn(
                                           "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border border-white/10 flex items-center justify-center shadow-lg z-10",
                                           u.id === featuredUserId ? "bg-orange-500" : "bg-white/30 backdrop-blur-md"
                                        )}>
                                           <span className="text-[7px] font-black text-white leading-none tracking-tighter">{u.plays}</span>
                                        </div>
                                     </motion.div>
                                   ))}
                                </div>
                                
                                {hasMoreArena && (
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setArenaExpanded(!arenaExpanded);
                                     }}
                                     className="h-6 w-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all shrink-0 ml-1 origin-center active:scale-90"
                                   >
                                     {arenaExpanded ? <ChevronLeft className="h-3.5 w-3.5" /> : (
                                       <span className="text-[7px] font-black">+{allTrackArenaUsers.length - 5}</span>
                                     )}
                                   </button>
                                )}
                             </div>
                          </motion.div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="mt-1">
                 <LiveTrackProgress 
                    progressMs={nowPlaying.progressMs}
                    playedMs={nowPlaying.playedMs}
                    durationMs={durationMs || undefined}
                    timestamp={nowPlaying.timestamp}
                    isNowPlaying={isActuallyLive}
                    platform={platform.primary}
                 />
              </div>
           </div>
        ) : (
           <div className="py-12 glass-card rounded-[32px] flex flex-col items-center justify-center opacity-40 border-dashed border-white/10 bg-white/[0.02]">
              <Music2 className="h-8 w-8 mb-3" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Sinal Inativo</span>
           </div>
        )}
      </div>
    </motion.div>
  );
};


export const SectionHeader = ({ title, icon: Icon, action }: { title: string, icon?: any, action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-4 mt-8 px-2">
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-3 w-3 text-white/40" />}
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">{title}</h2>
    </div>
    {action}
  </div>
);

export const InfoRow = ({ icon: Icon, label, value, onClick }: { icon: any, label: string, value: string, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center justify-between p-4 rounded-3xl bg-white/[0.02] border border-white/5 transition-all text-left",
      onClick && "active:scale-95 hover:bg-white/[0.04]"
    )}
  >
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
        <Icon className="h-4 w-4 text-white/40" />
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{label}</span>
        <span className="text-[13px] font-bold text-white line-clamp-1">{value}</span>
      </div>
    </div>
    {onClick && <Headphones className="h-3 w-3 text-white/40 rotate-[-45deg]" />}
  </button>
);

export const FriendsCardSkeleton = () => (
  <div className="flex flex-col items-center gap-2 w-full min-w-0 animate-pulse">
    {/* Name placeholder */}
    <div className="h-2 w-12 bg-white/5 rounded-full mb-1" />
    
    {/* Photo placeholder */}
    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-[22px] sm:rounded-[28px] bg-white/5 relative">
       <div className="absolute -bottom-1 -right-1 h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-white/10 border-2 border-[#050505]" />
    </div>

    <div className="flex flex-col items-center w-full gap-1.5 mt-1 px-1">
      {/* Artist - 2 lines */}
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="h-1.5 w-full max-w-[40px] bg-white/5 rounded-full" />
        <div className="h-1.5 w-full max-w-[30px] bg-white/5 rounded-full opacity-50" />
      </div>
      
      {/* Track - 2 lines */}
      <div className="flex flex-col items-center gap-1 w-full mt-1">
        <div className="h-2 w-full max-w-[50px] bg-white/10 rounded-full" />
        <div className="h-2 w-full max-w-[40px] bg-white/10 rounded-full opacity-50" />
      </div>
      
      {/* Status */}
      <div className="h-3.5 w-12 bg-white/5 rounded mt-1" />
    </div>
  </div>
);

export const Skeleton = ({ className }: { className?: string, key?: string | number }) => (
  <div className={cn("animate-pulse rounded-2xl bg-white/5", className)} />
);

const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  
  useEffect(() => {
    if (prevValueRef.current === value) return;
    
    let start = prevValueRef.current;
    const end = value;
    const duration = 800;
    const increment = (end - start) / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if ((increment > 0 && start >= end) || (increment < 0 && start <= end)) {
        setDisplayValue(end);
        prevValueRef.current = end;
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue}</span>;
};

export const MusicPlatformBadge = ({ userId, platform, track, className, showLabel = false }: { userId?: string, platform?: any, track?: any, className?: string, showLabel?: boolean }) => {
  // Preferência 1: Objeto platform da API
  const platformData = platform || (userId ? coreUtils.getUserPlaybackPlatform(userId) : null);
  
  if (platformData && platformData.primary && platformData.primary !== "unknown") {
    const isApple = platformData.primary === "appleMusic";
    const isSpotify = platformData.primary === "spotify";
    const label = isApple ? "Apple Music" : "Spotify";

    return (
      <div className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-lg glass border border-white/10 shadow-lg",
        className
      )}>
        <img 
          src={isSpotify 
            ? "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg"
            : "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
          } 
          className={cn("h-3 w-3", isApple && "invert")} 
          alt={label} 
        />
        {showLabel && (
          <span className="text-[8px] font-black uppercase tracking-widest text-white/70 pr-0.5">
            {label}
          </span>
        )}
      </div>
    );
  }

  // Senão, tentamos detectar a disponibilidade no catálogo para o modal de música
  if (track) {
    const availability = coreUtils.detectCatalogAvailability(track);
    if (availability.primary !== "unknown") {
      const isApple = availability.primary === "appleMusic";
      const isSpotify = availability.primary === "spotify";

      return (
        <div className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded-lg glass border border-white/10 shadow-lg",
          className
        )}>
          <img 
            src={isSpotify 
              ? "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg"
              : "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
            } 
            className={cn("h-3 w-3", isApple && "invert")} 
            alt="" 
          />
          {showLabel && (
            <span className="text-[8px] font-black uppercase tracking-widest text-white/70 pr-0.5">
              {isSpotify ? "Spotify" : "Apple Music"}
            </span>
          )}
        </div>
      );
    }
  }

  return null;
};

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

export const TrackLeaderboardModal = ({ 
  track, 
  onClose 
}: { 
  track: any, 
  onClose: () => void 
}) => {
  const [stats, setStats] = useState<Record<string, { track: number, album: number, artist: number }>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'track' | 'album' | 'artist'>('track');

  useEffect(() => {
    async function loadStats() {
      if (!track?.id) return;
      setLoading(true);
      
      const isArtist = !!track.artist || (track.id && !track.name && !track.album);
      const isAlbum = !!track.album && !track.artists;
      
      // Attempt to determine the type and set initial view
      if (track.type === 'artist' || isArtist) setView('artist');
      else if (track.type === 'album' || isAlbum) setView('album');
      else setView('track');

      const users = Object.values(useStatsStore.getState().groupStats?.users || {});
      
      const artistId = track.artists?.[0]?.id || (track.type === 'artist' ? track.id : null) || track.artistId;
      const albumId = track.albums?.[0]?.id || track.album?.id || (track.type === 'album' ? track.id : null) || track.albumId;
      const trackId = track.type === 'track' || (!artistId && !albumId) ? track.id : (track.type === 'track' ? track.id : null);
      
      const results: Record<string, { track: number, album: number, artist: number }> = {};
      
      await Promise.all(users.map(async (u) => {
        try {
          const [tCount, alCount, arCount] = await Promise.all([
            trackId ? statsService.fetchEntityStats(u.id, 'track', trackId) : Promise.resolve(0),
            albumId ? statsService.fetchEntityStats(u.id, 'album', albumId) : Promise.resolve(0),
            artistId ? statsService.fetchEntityStats(u.id, 'artist', artistId) : Promise.resolve(0)
          ]);
          results[u.id] = { track: tCount, album: alCount, artist: arCount };
        } catch (e) {
          results[u.id] = { track: 0, album: 0, artist: 0 };
        }
      }));

      setStats(results);
      setLoading(false);
    }
    loadStats();
  }, [track?.id]);

  const { groupStats } = useStatsStore();
  const membersData = groupStats?.users || {};

  const sortedUsers = Object.values(membersData)
    .map(u => {
      return { 
        ...u, 
        data: stats[u.id] || { track: 0, album: 0, artist: 0 } 
      };
    })
    .filter(u => u.data[view] > 0)
    .sort((a, b) => b.data[view] - a.data[view]);

  const albumId = track.albums?.[0]?.id || track.album?.id;
  const albumName = track.albums?.[0]?.name || track.album?.name || track.albumName;
  const artist = track.artists?.[0];
  const artistName = typeof artist === 'string' ? artist : artist?.name;
  const artistId = typeof artist === 'string' ? null : artist?.id;
  const artistImage = artistId ? `https://images.stats.fm/api/v1/artists/${artistId}/image` : null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-[#0c0c0c] w-full max-w-sm max-h-[85vh] rounded-[48px] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Abstract Background Glow */}
        <div 
          className="absolute top-0 left-0 w-full h-40 opacity-20 blur-[80px] pointer-events-none"
          style={{ backgroundColor: ({id: "leo", name: "Leo", color: "#FF9F0A"}).color }}
        />

        {/* Sticky Header Section */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-50 h-10 w-10 glass rounded-2xl flex items-center justify-center text-white/40 hover:text-white/90 active:scale-90 transition-all border border-white/5"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pt-8 px-6 pb-4 flex flex-col items-center text-center shrink-0 border-b border-white/5 relative z-10">
           <div className="relative group">
              <SmartImage 
                src={track.image} 
                className="h-24 w-24 shadow-[0_12px_32px_rgba(0,0,0,0.6)] border border-white/10" 
                rounded="2xl"
                fallback=""
              />
              <div className="absolute -bottom-2 -right-2 z-20">
                <MusicPlatformBadge platform={coreUtils.detectCatalogAvailability(track).hasSpotify ? 'spotify' : 'apple'} />
              </div>
           </div>
           
           <div className="mt-4 w-full px-2">
             <h2 className="text-lg font-display font-black text-white leading-tight truncate">
               {track.name || track.artist?.name || track.album?.name}
             </h2>
             <div className="flex items-center justify-center gap-2 mt-1">
               {artistName && (
                 <>
                   <span className="text-[10px] font-bold text-white/40 truncate max-w-[120px]">{artistName}</span>
                   {albumName && <span className="h-1 w-1 rounded-full bg-white/10" />}
                 </>
               )}
               {albumName && (
                 <span className="text-[10px] font-bold text-white/20 truncate max-w-[120px]">{albumName}</span>
               )}
             </div>
           </div>
           
           <div className="flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full bg-white/5 border border-white/5">
             <Trophy className="h-2.5 w-2.5 text-orange-500" />
             <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em]">Arena Rankings</span>
           </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {/* Tabs Selector */}
            <div className="flex bg-white/[0.03] p-1 rounded-2xl border border-white/5 shrink-0">
               {[
                 { id: 'track', label: 'Faixa' },
                 { id: 'artist', label: 'Artista' },
                 { id: 'album', label: 'Álbum' }
               ].map((tab) => (
                 <button
                   key={tab.id}
                   onClick={() => setView(tab.id as any)}
                   className={cn(
                     "flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                     view === tab.id ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-white/30 hover:text-white/50"
                   )}
                 >
                   {tab.label}
                 </button>
               ))}
            </div>

            <div className="flex flex-col gap-2">
              {loading ? (
                [1,2,3,4].map(i => <div key={i} className="h-14 w-full bg-white/5 rounded-2xl animate-pulse" />)
              ) : (
                <>
                  {sortedUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                      <Music2 className="h-8 w-8 mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-center">Nenhum competidor nesta categoria</p>
                    </div>
                  ) : sortedUsers.map((user, i) => {
                    const isLeo = user.id === "leo";
                    const isWinner = i === 0;
                    
                    return (
                      <div 
                        key={user.id} 
                        className={cn(
                          "flex items-center justify-between p-3.5 rounded-[22px] border transition-all",
                          isWinner ? "bg-orange-500/10 border-orange-500/20 shadow-[0_8px_16px_rgba(255,159,10,0.05)]" : "bg-white/[0.02] border-white/5",
                          isLeo && !isWinner && "border-white/20 bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                           <div className="h-5 w-5 flex items-center justify-center shrink-0">
                             {i === 0 ? <Medal className="h-4 w-4 text-yellow-500" /> : 
                              i === 1 ? <Medal className="h-4 w-4 text-slate-400" /> :
                              i === 2 ? <Medal className="h-4 w-4 text-orange-700" /> :
                              <span className="text-[10px] font-black text-white/20 italic">#{i + 1}</span>}
                           </div>
                           <div className="relative">
                             <SmartImage 
                               src={coreUtils.getUserAvatar(user.id, (user as any).avatar)} 
                               className={cn("h-8 w-8 rounded-full border", isWinner ? "border-orange-500/40" : "border-white/10")} 
                               rounded="full"
                             />
                             {isLeo && (
                               <div className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full border-2 border-[#111] flex items-center justify-center">
                                 <div className="h-1 w-1 bg-white rounded-full" />
                               </div>
                             )}
                           </div>
                           <div className="flex flex-col">
                             <span className={cn("text-[12px] font-bold", isLeo ? "text-white" : "text-white/80")}>
                               {user.name}
                             </span>
                             {isWinner && <span className="text-[8px] font-black text-orange-500/80 uppercase tracking-widest">Líder Arena</span>}
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               const event = new CustomEvent('openHistory', { 
                                 detail: { 
                                   id: user.id, 
                                   name: user.name, 
                                   avatar: user.avatar,
                                   initialSearch: view === 'track' ? track.name : view === 'artist' ? artistName : albumName 
                                 } 
                               });
                               window.dispatchEvent(event);
                             }}
                             className="text-white/20 hover:text-white/80 transition-colors active:scale-95"
                           >
                             <History className="h-3.5 w-3.5" />
                           </button>
                           <span className={cn(
                             "text-[15px] font-display font-black", 
                             isWinner ? "text-orange-500" : isLeo ? "text-white" : "text-white/60"
                           )}>
                              {coreUtils.formatNumber(user.data[view])}
                           </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Player Links Section */}
          <div className="mt-2">
               <div className="flex items-center justify-between px-1 mb-3">
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Ouvir na Íntegra</span>
                  <Headphones className="h-3 w-3 text-white/10" />
               </div>
               <div className="flex items-center gap-2">
                 {(track.spotifyId || coreUtils.detectCatalogAvailability(track).hasSpotify) && (
                   <a 
                    href={`https://open.spotify.com/track/${track.spotifyId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-[#1DB954]/10 border border-white/5 hover:border-[#1DB954]/20 flex items-center justify-center gap-2 active:scale-95 transition-all no-underline shrink-0 group"
                   >
                     <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" alt="" />
                     <span className="text-[9px] font-black text-white/30 group-hover:text-[#1DB954] uppercase tracking-widest transition-colors">Spotify</span>
                   </a>
                 )}
                 {(track.appleMusicId || coreUtils.detectCatalogAvailability(track).hasAppleMusic) && (
                   <a 
                    href={`https://music.apple.com/song/${track.appleMusicId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-pink-500/10 border border-white/5 hover:border-pink-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all no-underline shrink-0 group"
                   >
                     <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" className="h-3.5 w-3.5 invert opacity-30 group-hover:opacity-100 transition-opacity" alt="" />
                     <span className="text-[9px] font-black text-white/30 group-hover:text-pink-500 uppercase tracking-widest transition-colors">Apple</span>
                   </a>
                 )}
               </div>
            </div>
        </div>

        {/* Footer Action */}
        <div className="p-6 pt-2 pb-8 bg-gradient-to-t from-[#0c0c0c] via-[#0c0c0c] to-transparent shrink-0">
          <button 
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 active:scale-95 transition-all hover:bg-white/10"
          >
            Sair da Arena
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
