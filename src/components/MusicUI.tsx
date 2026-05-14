/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Headset, Music2, Activity, TrendingUp } from 'lucide-react';
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
    <div style={style} className="px-1 py-1.5">
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="glass flex items-center justify-between p-4 rounded-[28px] border-white/10 group hover:bg-white/[0.08] transition-all h-full"
      >
         <div className="flex items-center gap-4">
            <span className="text-[11px] font-black text-white/30 w-4">#{index + 1}</span>
            <SmartImage 
              src={item.image} 
              className="h-11 w-11 shadow-xl border border-white/20" 
              fallback={item.name.charAt(0)}
            />
            <div className="flex flex-col min-w-0">
               <span className="text-[14px] font-black text-white tracking-tight truncate w-40">{item.name}</span>
               <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest truncate">
                  {item.artists ? item.artists.map(a => a.name).join(', ') : coreUtils.formatNumber(item.streams || 0) + ' Streams'}
               </span>
            </div>
         </div>
         <div className="text-right shrink-0">
            <span className="text-[11px] font-black text-orange-500/80 uppercase">
               {item.artists ? coreUtils.formatNumber(item.streams || 0) : ''}
            </span>
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
  const isLeo = initialUser.id === GROUP_USERS.LEO.id;
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
                            rowCount={topItems.length}
                            rowHeight={76}
                            rowComponent={TopRankRow as any}
                            rowProps={{ topItems } as any}
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
                <img src={userA.avatar} className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" alt="" />
             </div>
             <span className="text-xs font-mundial font-semibold tracking-widest text-white/60">{userA.name}</span>
          </div>
          
          <div className="flex flex-col items-center">
             <span className="text-4xl font-display font-black italic text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">VS</span>
             <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mt-2">Arena Battle</span>
          </div>
 
          <div className="flex flex-col items-center gap-3">
             <div className="h-20 w-20 rounded-full p-1 bg-white/20">
                <img src={userB.avatar} className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" alt="" />
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
                    fallback={itemsA[i].name.charAt(0)}
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
                    fallback={itemsB[i].name.charAt(0)}
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
  imageUrl?: string;
  isNowPlaying?: boolean;
  className?: string;
  footer?: string;
  onClick?: () => void;
}

export const MusicCard = ({ 
  userId,
  userName, 
  songName, 
  artistName, 
  imageUrl, 
  isNowPlaying, 
  className,
  footer,
  onClick
}: MusicCardProps) => {
  const isLeo = userId === GROUP_USERS.LEO.id;
  const accentColor = isLeo ? GROUP_USERS.LEO.color : "#FFFFFF";
  const user = Object.values(useStatsStore.getState().groupStats?.users || {}).find(u => u.id === userId);
  const trackImage = coreUtils.getAvatarUrl(userId, imageUrl);
  const userAvatar = coreUtils.getUserAvatar(userId, user?.avatar);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={onClick ? { y: -4, backgroundColor: "rgba(255, 255, 255, 0.08)" } : {}}
      onClick={onClick}
      className={cn(
        "glass-card group relative flex items-center gap-4 border-white/5 p-4",
        onClick && "cursor-pointer active:scale-[0.98] transition-all",
        className
      )}
      style={{ 
        boxShadow: isNowPlaying ? `0 0 20px ${accentColor}08` : undefined,
        borderColor: isNowPlaying ? `${accentColor}25` : undefined
      }}
    >
      <div className="relative h-14 w-14 shrink-0">
        <div className="h-full w-full rounded-[14px] bg-white/5 overflow-hidden relative">
          <SmartImage 
            src={trackImage} 
            className="h-full w-full" 
            fallback={songName?.charAt(0) || "🎵"}
            rounded="[14px]"
          />
          {isNowPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
               <div className="flex items-end gap-[1.5px] h-2.5">
                  {[0,1,2].map(i => (
                    <motion.div key={i} animate={{ height: ["20%", "100%", "40%"] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} className="w-[2px] bg-white rounded-full" />
                  ))}
               </div>
            </div>
          )}
        </div>
        
        {/* User Badge Overlay */}
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-[#111] bg-black overflow-hidden shadow-lg shadow-black/80 z-20">
          <img src={userAvatar} className="h-full w-full object-cover" referrerPolicy="no-referrer" alt="" />
        </div>

        {/* Platform Badge overlay on image */}
        <div className="absolute top-0 right-0 p-1 z-20">
          <MusicPlatformBadge track={{ image: imageUrl, spotifyId: (user as any)?.nowPlaying?.track?.spotifyId, appleMusicId: (user as any)?.nowPlaying?.track?.appleMusicId }} className="p-0.5 px-0.5 rounded-md min-w-[14px] h-[14px] flex items-center justify-center border-none bg-black/40 backdrop-blur-sm" />
        </div>
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{userName}</span>
          {footer && <span className="text-[8px] font-bold text-white/30 uppercase tracking-tighter">{footer}</span>}
        </div>
        <MarqueeText 
          text={songName || ""} 
          className="font-display text-sm font-medium text-white group-hover:text-orange-500 transition-colors"
        />
        <MarqueeText 
          text={artistName || ""} 
          className="text-[10px] text-white/50"
        />
      </div>
    </motion.div>
  );
};

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

export const FriendsHorizontalCard = ({ 
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
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 group w-full min-w-0",
        onClick && "cursor-pointer active:scale-95 transition-all text-center"
      )}
    >
      {/* User Name ABOVE the photo */}
      <span className="text-[9px] font-mundial font-black text-white/60 tracking-widest uppercase truncate w-full text-center px-1">
        {firstName}
      </span>

      <div className="relative">
        <div className={cn(
          "h-16 w-16 sm:h-20 sm:w-20 rounded-[22px] sm:rounded-[28px] p-[2px] transition-all duration-500 shadow-xl",
          isActuallyLive ? "bg-gradient-to-tr from-orange-400 via-orange-500 to-yellow-500" : "bg-white/5"
        )}>
          <div className="h-full w-full rounded-[20px] sm:rounded-[26px] bg-[#050505] overflow-hidden relative">
            <img 
              src={trackImage} 
              className={cn("h-full w-full object-cover grayscale transition-all duration-700", isActuallyLive && "grayscale-0 scale-110")} 
              referrerPolicy="no-referrer" 
              alt=""
            />
          </div>
        </div>
        
        {/* Overlaid User Avatar */}
        <div className="absolute -bottom-1 -right-1 h-6 w-6 sm:h-7 sm:w-7 rounded-full border-2 border-[#050505] bg-black overflow-hidden shadow-2xl z-10 transition-transform group-hover:scale-110">
          <img src={userAvatar} className="h-full w-full object-cover" referrerPolicy="no-referrer" alt="" />
        </div>

        {/* Platform Badge overlay */}
        <div className="absolute top-0 right-0 p-1 z-10">
           <MusicPlatformBadge track={{ image: imageUrl }} className="p-0.5 px-0.5 rounded-md min-w-[14px] h-[14px] flex items-center justify-center border-none bg-black/40 backdrop-blur-sm" />
        </div>
      </div>

      <div className="flex flex-col items-center min-w-0 w-full gap-0.5">
        {/* Artist Name: Uppercase, smaller font, 2 lines */}
        <TruncatedTooltipText 
          text={artistName || "-"}
          className="text-[7px] font-black text-white/30 uppercase tracking-[0.05em] leading-[1.1] min-h-[16px] text-center px-0.5"
          lineClamp={2}
        />

        {/* Track Name: 2 lines */}
        <TruncatedTooltipText 
          text={songName || "Offline"}
          className="text-[10px] font-black text-white/80 leading-tight min-h-[24px] text-center px-0.5"
          lineClamp={2}
        />

        {playedCount && (
           <div className="mt-0.5 px-1 py-0.5 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
              <span className="text-[6px] font-black text-white/40 uppercase tracking-widest">#{playedCount}</span>
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
            <span className="text-[7px] font-black text-white/10 uppercase tracking-widest text-center px-1">
              {playback.status === 'inactive' ? "off" : playback.label}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const LiveTrackProgress = ({ 
  progressMs, 
  durationMs, 
  timestamp, 
  isNowPlaying
}: { 
  progressMs?: number, 
  durationMs?: number, 
  timestamp: string | number,
  isNowPlaying: boolean;
}) => {
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    if (!durationMs) return;

    if (!isNowPlaying) {
      const progress = progressMs ? (progressMs / durationMs) * 100 : 100;
      setCurrentProgress(Math.min(progress, 100));
      return;
    }

    const calculateProgress = () => {
      const startTime = new Date(timestamp).getTime();
      const now = Date.now();
      const elapsedSinceLog = now - startTime;
      const totalProgressMs = (progressMs || 0) + elapsedSinceLog;
      const percent = (totalProgressMs / durationMs) * 100;
      setCurrentProgress(Math.min(percent, 100));
    };

    calculateProgress();
    const interval = setInterval(calculateProgress, 1000);
    return () => clearInterval(interval);
  }, [progressMs, durationMs, timestamp, isNowPlaying]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center px-0.5 min-w-0">
        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-white/60 whitespace-nowrap truncate mr-2">
          {isNowPlaying ? "Live Progress" : "Track Completion"}
        </span>
        <span className={cn(
          "text-[8px] sm:text-[9px] font-mono font-bold shrink-0",
          isNowPlaying ? "text-orange-500 animate-pulse" : "text-white/40"
        )}>
          {isNowPlaying ? "LIVE" : "FINISHED"}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div 
          initial={false}
          animate={{ width: `${currentProgress}%` }}
          transition={{ ease: "linear", duration: isNowPlaying ? 1 : 0.5 }}
          className={cn(
            "h-full transition-colors duration-500",
            isNowPlaying 
              ? "bg-gradient-to-r from-orange-600 via-orange-400 to-yellow-500" 
              : "bg-white/40"
          )} 
        />
      </div>
      {durationMs && (
        <div className="flex justify-between">
          <span className="text-[8px] font-mono text-white/40">
            {coreUtils.formatDuration(Math.floor((currentProgress / 100) * durationMs))}
          </span>
          <span className="text-[8px] font-mono text-white/40">
            {coreUtils.formatDuration(durationMs)}
          </span>
        </div>
      )}
    </div>
  );
};

export const LeoHeader = ({ userId, userName, userAvatar, nowPlaying, streamsToday, onTrackClick }: { userId: string, userName?: string, userAvatar?: string, nowPlaying?: any, streamsToday: number, onTrackClick?: (track: any) => void }) => {
  const accentColor = GROUP_USERS.LEO.color;
  // Avatar do perfil (com Peter fallback logic)
  const profileAvatar = coreUtils.withPeterFallback(userId, userAvatar);
  // Imagem do álbum atual
  const albumImage = nowPlaying?.track?.image;
  const track = nowPlaying?.track;
  const playback = coreUtils.getPlaybackStatus({ nowPlaying });
  const isActuallyLive = playback.status === "live";
  const platform = coreUtils.detectMusicPlatform(track);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[42px] bg-gradient-to-br from-[#121212] to-[#050505] border border-white/10 p-5 mb-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
    >
      {/* Background Glow */}
      <div 
        className={cn(
          "absolute -right-10 -top-20 h-80 w-80 rounded-full blur-[110px] opacity-25 transition-all duration-1000",
          isActuallyLive ? "animate-pulse" : "opacity-10"
        )}
        style={{ backgroundColor: accentColor }}
      />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="h-11 w-11 rounded-full p-[2px] shadow-lg shadow-black/40 overflow-hidden"
              style={{ background: `linear-gradient(to tr, ${accentColor}, #ffd700)` }}
            >
              <SmartImage 
                src={profileAvatar} 
                className="h-full w-full rounded-full" 
                fallback={userName?.charAt(0) || "L"} 
                rounded="full"
              />
            </div>
            <div>
              <h1 className="font-mundial text-lg font-semibold tracking-tight text-white leading-tight truncate max-w-[200px]">{userName || "Sincronizando..."}</h1>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                   "h-1 w-1 rounded-full shadow-[0_0_8px_rgba(255,159,10,0.5)]",
                   isActuallyLive ? "bg-orange-500 animate-pulse" : "bg-white/20"
                )} />
                <p className={cn(
                  "text-[8px] font-mundial font-black tracking-[0.2em] uppercase transition-colors duration-500",
                  isActuallyLive ? "text-orange-500/90" : "text-white/30"
                )}>
                  {playback.label}
                </p>
              </div>
            </div>
          </div>
            <div className="flex flex-col items-end">
              <div className="text-3xl font-display font-black text-white leading-none tracking-tighter drop-shadow-lg">
                <AnimatedNumber value={streamsToday || 0} />
              </div>
              <div className="text-[7px] uppercase tracking-[0.3em] text-white/40 font-mundial font-black mt-1.5 pr-0.5">Total Hoje</div>
            </div>
        </div>

        {nowPlaying && nowPlaying.track && nowPlaying.track.name && nowPlaying.track.name !== "Desconhecido" ? (
          <div className="flex items-center gap-3">
            <div 
              className="relative h-32 w-32 shrink-0 -ml-2 group cursor-pointer active:scale-95 transition-all"
              onClick={() => onTrackClick?.(track)}
            >
               <div 
                 className={cn(
                   "absolute inset-0 rounded-[32px] blur-2xl opacity-40 transition-all duration-1000",
                   isActuallyLive ? "opacity-40" : "opacity-0"
                 )} 
                 style={{ backgroundColor: accentColor }}
               />
               <div className={cn(
                 "relative h-full w-full rounded-[30px] bg-white/5 overflow-hidden shadow-2xl border border-white/10",
                 !isActuallyLive && "opacity-80 grayscale-[0.3]"
               )}>
                  <img src={albumImage} className="h-full w-full object-cover" referrerPolicy="no-referrer" alt="" />
               </div>
               
               {/* Platform Icon Overlay */}
               <div className="absolute -bottom-2 -right-2 z-20">
                  <MusicPlatformBadge track={track} className="h-7 w-7 rounded-lg border-white/10 p-0" />
                  {!platform.hasAppleMusic && !platform.hasSpotify && (
                    <div className="h-7 w-7 rounded-lg glass border border-white/10 flex items-center justify-center shadow-2xl z-20 overflow-hidden">
                      <Music2 className="h-3.5 w-3.5 text-white/40" />
                    </div>
                  )}
               </div>
            </div>

            <div className="flex flex-1 flex-col min-w-0 justify-center">
               <div className="flex flex-col">
                  {/* Play Count Indicator (Badge) */}
                  {track.playedCount && (
                    <div className="flex justify-start mb-1.5">
                      <div className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/10 flex items-center gap-1">
                        <TrendingUp className="h-2 w-2 text-white/40" />
                        <span className="text-[7px] font-mundial font-bold text-white/50 uppercase tracking-widest leading-none">#{track.playedCount}</span>
                      </div>
                    </div>
                  )}
    
                  <ScrollingText 
                    text={track.name}
                    className={cn(
                      "text-xl font-display font-black leading-tight tracking-tight",
                      isActuallyLive ? "text-white" : "text-white/90"
                    )}
                  />
                  <p className="text-sm text-white/60 truncate font-medium mt-0.5">
                     {Array.isArray(track.artists) ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') : "Artista Desconhecido"}
                  </p>
                  {track.albumName && (
                    <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mt-1.5 line-clamp-2 leading-tight text-balance">
                      {track.albumName}
                    </p>
                  )}
               </div>
               
               <div className="mt-4 flex flex-col gap-3">
                  <LiveTrackProgress 
                    progressMs={nowPlaying.progressMs}
                    durationMs={track.durationMs}
                    timestamp={nowPlaying.timestamp}
                    isNowPlaying={isActuallyLive}
                  />
    
                  {/* External Links & Time */}
                  <div className="flex items-center gap-1.5">
                     {(platform.hasSpotify || track?.spotifyId) && (
                        <a 
                           href={`https://open.spotify.com/track/${track?.spotifyId || (track as any)?.externalIds?.spotify}`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="h-7 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center gap-2 active:scale-95 transition-all hover:bg-green-500/10 hover:border-green-500/20 group"
                        >
                           <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100 transition-opacity" alt="" />
                           <span className="text-[8px] font-black text-white/60 group-hover:text-green-500 uppercase tracking-widest">Spotify</span>
                        </a>
                     )}
                     {(platform.hasAppleMusic || track?.appleMusicId) && (
                        <a 
                           href={`https://music.apple.com/br/song/${track?.appleMusicId || (track as any)?.externalIds?.appleMusic}`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="h-7 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center gap-2 active:scale-95 transition-all hover:bg-pink-500/10 hover:border-pink-500/20 group"
                        >
                           <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" className="h-2.5 w-2.5 invert opacity-50 group-hover:opacity-100 transition-opacity" alt="" />
                           <span className="text-[8px] font-black text-white/60 group-hover:text-pink-500 uppercase tracking-widest">Apple</span>
                        </a>
                     )}
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center border border-dashed border-white/20 rounded-[40px] bg-white/[0.04]">
             <Activity className="h-10 w-10 text-white/10 mb-3 animate-pulse" />
             <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em]">Sinal Sonoro Inativo</p>
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
    {onClick && <Headset className="h-3 w-3 text-white/40 rotate-[-45deg]" />}
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
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const duration = 1000;
    const increment = end / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue}</span>;
};

export const MusicPlatformBadge = ({ track, className, showLabel = false }: { track: any, className?: string, showLabel?: boolean }) => {
  const platform = coreUtils.detectMusicPlatform(track);
  if (platform.primary === "unknown") return null;

  const isApple = platform.primary === "appleMusic";
  const isSpotify = platform.primary === "spotify";

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-lg glass border border-white/10 shadow-lg",
      className
    )}>
      {isSpotify && (
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" 
          className="h-3 w-3 drop-shadow-[0_0_2px_rgba(30,215,96,0.3)]" 
          alt="" 
        />
      )}
      {isApple && (
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" 
          className="h-3 w-3 invert drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]" 
          alt="" 
        />
      )}
      {showLabel && (
        <span className="text-[8px] font-black uppercase tracking-widest text-white/70">
          {isSpotify ? "Spotify" : "Apple Music"}
        </span>
      )}
    </div>
  );
};

export const LiveGroupOverview = ({ users, lastUpdate }: { users: UserStats[], lastUpdate?: string }) => {
  const totalStreams = users.reduce((sum, u) => sum + (u.streamsToday || 0), 0);
  const sortedParticipants = [...users]
    .sort((a, b) => (b.streamsToday || 0) - (a.streamsToday || 0));

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card overflow-hidden rounded-[40px] p-5 mb-6 premium-gradient border-white/5 shadow-2xl flex flex-col gap-6"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col min-w-0 shrink-0">
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
            <span className="text-8xl font-display font-black tracking-tighter leading-[0.6] text-white drop-shadow-2xl">
              <AnimatedNumber value={totalStreams} />
            </span>
            <div className="flex flex-col shrink-0 mb-[4px]">
               <span className="text-[11px] font-black text-white/40 uppercase tracking-widest whitespace-nowrap leading-none mb-1">Streams</span>
               <span className="text-[11px] font-black text-orange-500 uppercase tracking-tighter whitespace-nowrap leading-none">Total Hoje</span>
            </div>
          </div>
        </div>
        <div className="shrink-0 pt-2">
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
                <img src={user.avatar} className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" alt={user.name} title={user.name} />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-orange-500/90 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg z-20">
                 <span className="text-[9px] font-bold text-white leading-none">{user.streamsToday}</span>
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="flex flex-col items-end shrink-0 mb-1">
          <span className="text-[7.5px] font-black text-white/15 uppercase tracking-[0.2em] mb-1 whitespace-nowrap">Sync Status</span>
          <div className="h-5 px-3 glass rounded-full border-white/5 flex items-center justify-center">
            <span className="text-[8.5px] font-black text-white/40 uppercase tracking-wider whitespace-nowrap leading-none">
              {coreUtils.formatUpdateTime(lastUpdate)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const MonthlyGroupLeaderboard = ({ users }: { users: UserStats[] }) => {
  const sorted = [...users].sort((a, b) => (b.totalStreams || 0) - (a.totalStreams || 0));
  
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: "America/Sao_Paulo", 
    month: 'long' 
  };
  const currentMonth = new Intl.DateTimeFormat('pt-BR', options).format(now);
  const currentMonthCapitalized = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
  
  return (
    <div className="flex flex-col gap-2 mb-10">
      <SectionHeader title={`Arena Group Leaderboard (${currentMonthCapitalized})`} />
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-2 px-2">
        {sorted.map((user, i) => {
          const isLeo = user.id === GROUP_USERS.LEO.id;
          return (
            <motion.div 
              key={user.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "glass-card min-w-[140px] p-6 flex flex-col items-center gap-4 border-white/5",
                isLeo ? "border-orange-500/20 bg-orange-500/10 shadow-[0_15px_35px_rgba(255,159,10,0.1)]" : "bg-white/[0.02]"
              )}
            >
              <div className="relative">
                <div className={cn(
                  "h-16 w-16 rounded-full p-1",
                  i === 0 ? "bg-gradient-to-tr from-yellow-500 via-yellow-200 to-yellow-600" : 
                  isLeo ? "bg-gradient-to-tr from-orange-500 to-orange-300" : "bg-white/10"
                )}>
                   <div className="h-full w-full rounded-full bg-[#050505] p-0.5 overflow-hidden">
                      <img src={user.avatar} className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" alt="" />
                   </div>
                </div>
                {i < 3 && (
                   <div className="absolute -top-1 -right-1 h-7 w-7 glass rounded-full flex items-center justify-center text-xs shadow-xl border border-white/10">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                   </div>
                )}
              </div>
              <div className="text-center w-full">
                 <span className={cn("block text-[11px] font-black uppercase tracking-[0.1em] truncate", isLeo ? "text-orange-400" : "text-white/60")}>
                    {user.name.toUpperCase()}
                 </span>
                 <div className="mt-3 flex flex-col items-center gap-0.5">
                    <span className="text-xl font-display font-black text-white/95 leading-none tracking-tighter">
                       {coreUtils.formatNumber(user.totalStreams || 0)}
                    </span>
                    <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Total Streams</span>
                 </div>
                 
                 <div className="mt-4 pt-4 border-t border-white/5 w-full flex flex-col gap-1 items-center">
                    <span className="text-[7px] font-black text-white/10 uppercase tracking-widest">Hoje</span>
                    <span className={cn("text-[10px] font-black", isLeo ? "text-orange-500/80" : "text-white/40")}>
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
      
      const users = statsService.getUsers();
      const albumId = track.albums?.[0]?.id || track.album?.id;
      const artistId = track.artists?.[0]?.id;
      
      const results: Record<string, { track: number, album: number, artist: number }> = {};
      
      await Promise.all(users.map(async (u) => {
        const [tCount, alCount, arCount] = await Promise.all([
          statsService.fetchEntityStats(u.id, 'track', track.id),
          statsService.fetchEntityStats(u.id, 'album', albumId),
          statsService.fetchEntityStats(u.id, 'artist', artistId)
        ]);
        results[u.id] = { track: tCount, album: alCount, artist: arCount };
      }));

      setStats(results);
      setLoading(false);
    }
    loadStats();
  }, [track?.id]);

  const sortedUsers = Object.values(GROUP_USERS)
    .map(u => ({ ...u, data: stats[u.id] || { track: 0, album: 0, artist: 0 } }))
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 sm:p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-[#111111] w-full max-w-sm max-h-[90vh] rounded-[40px] border border-white/10 px-6 py-8 sm:py-10 shadow-2xl flex flex-col gap-6 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center shrink-0">
           <div className="relative">
              <SmartImage 
                src={track.image} 
                className="h-28 w-28 shadow-2xl border border-white/10 relative z-10" 
                rounded="2xl"
                fallback="🎵"
              />
              <div 
                className="absolute inset-2 blur-2xl opacity-40 rounded-full"
                style={{ backgroundColor: GROUP_USERS.LEO.color }}
              />
              <div className="absolute top-2 right-2 z-20">
                <MusicPlatformBadge track={track} showLabel />
              </div>
           </div>
           <h2 className="mt-5 text-lg font-display font-black text-white leading-tight truncate w-full px-4">
             {track.name}
           </h2>
           <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.4em] mt-2">Arena Rankings</p>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto pr-1 custom-scrollbar">
          {/* Navigation Section */}
          <div className="flex flex-col gap-2">
            <SectionHeader title="Informações" icon={Activity} />
            {artistName && (
              <div className="flex items-center gap-3 glass p-4 rounded-[24px] border-white/5">
                <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                  {artistImage ? (
                    <img src={artistImage} className="h-full w-full object-cover" referrerPolicy="no-referrer" alt="" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/20">
                      <Music2 className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Artista</span>
                  <span 
                    className="text-[13px] font-bold text-white truncate cursor-pointer hover:text-orange-500 transition-colors"
                    onClick={artistId ? () => window.open(`https://stats.fm/artist/${artistId}`, '_blank') : undefined}
                  >
                    {artistName}
                  </span>
                </div>
              </div>
            )}
            {albumName && (
              <InfoRow 
                icon={TrendingUp} 
                label="Álbum" 
                value={albumName} 
                onClick={albumId ? () => window.open(`https://stats.fm/album/${albumId}`, '_blank') : undefined} 
              />
            )}
          </div>

          <div className="flex flex-col gap-4">
            <SectionHeader title="Competição" icon={Activity} />
            
            {/* Tabs Selector */}
            <div className="flex bg-white/[0.03] p-1 rounded-2xl border border-white/5 shrink-0">
           {[
             { id: 'track', label: 'Track' },
             { id: 'artist', label: 'Artist' },
             { id: 'album', label: 'Album' }
           ].map((tab) => (
             <button
               key={tab.id}
               onClick={() => setView(tab.id as any)}
               className={cn(
                 "flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                 view === tab.id ? "bg-orange-500 text-white shadow-lg" : "text-white/30 hover:text-white/50"
               )}
             >
               {tab.label}
             </button>
           ))}
        </div>

        <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-16 w-full bg-white/5 rounded-2xl animate-pulse" />)
          ) : (
            <>
              {/* Context Header */}
              <div className="px-2 mb-1 flex items-center justify-between">
                <span className="text-[9px] font-black text-orange-500/80 uppercase tracking-widest italic">
                  Competidores
                </span>
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                  {view === 'track' ? 'Plays na Faixa' : view === 'artist' ? `Plays em ${artistName || 'Artista'}` : `Plays em ${albumName || 'Álbum'}`}
                </span>
              </div>

              {sortedUsers.map((user, i) => (
                <div 
                  key={user.id} 
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                    i === 0 ? "bg-orange-500/10 border-orange-500/20" : "bg-white/[0.02] border-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                     <div className="h-4 w-4 flex items-center justify-center text-[10px] font-black text-white/40 italic">
                       #{i + 1}
                     </div>
                     <SmartImage 
                       src={coreUtils.getAvatarUrl(user.id)} 
                       className="h-8 w-8 rounded-full border border-white/20" 
                       rounded="full"
                     />
                     <span className="text-[13px] font-bold text-white leading-tight">{user.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className={cn("text-lg font-display font-black", i === 0 ? "text-orange-500" : "text-white")}>
                        {coreUtils.formatNumber(user.data[view])}
                     </span>
                  </div>
                </div>
              ))}
            </>
          )}
          </div>
        </div>

          {/* Links Section */}
          <div className="flex flex-col gap-2">
               <SectionHeader title="Ouvir Agora" icon={Headset} />
               <div className="flex items-center gap-2">
                 {(track.spotifyId || coreUtils.detectMusicPlatform(track).hasSpotify) && (
                   <a 
                    href={`https://open.spotify.com/track/${track.spotifyId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-12 rounded-2xl bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center justify-center gap-2 active:scale-95 transition-all no-underline shrink-0"
                   >
                     <div className="h-5 w-5 flex items-center justify-center shrink-0">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" className="h-3.5 w-3.5" alt="" />
                     </div>
                     <span className="text-[9px] font-black text-[#1DB954] uppercase tracking-widest whitespace-nowrap">Spotify</span>
                   </a>
                 )}
                 {(track.appleMusicId || coreUtils.detectMusicPlatform(track).hasAppleMusic) && (
                   <a 
                    href={`https://music.apple.com/song/${track.appleMusicId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all no-underline shrink-0"
                   >
                     <div className="h-5 w-5 flex items-center justify-center shrink-0">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" className="h-3.5 w-3.5 invert" alt="" />
                     </div>
                     <span className="text-[9px] font-black text-pink-500 uppercase tracking-widest whitespace-nowrap">Apple</span>
                   </a>
                 )}
               </div>
            </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 active:scale-95 transition-all"
        >
          Fechar Arena
        </button>
      </motion.div>
    </motion.div>
  );
};
