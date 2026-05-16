
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Music2, Headphones, Swords } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { statsService } from '../../services/statsService';
import { coreUtils } from '../../services/statsCore';
import { 
  SmartImage, 
  MusicPlatformBadge, 
  SectionHeader, 
  Skeleton, 
  AnimatedNumber
} from '../shared/CommonUI';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

const ListAny = List as any;
const AutoSizerAny = AutoSizer as any;
import { UserStats, TopItem } from '../../types/stats';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
        console.log("[UserDetailModal] full data raw:", full);
        const transformedTopItems = {
          artists: (full.tops?.artists || []).map((a: any) => ({
            id: a.artist?.id || a.id,
            name: a.artist?.name || a.name,
            image: a.artist?.image || a.image,
            streams: a.playcount || a.streams || 0
          })),
          tracks: (full.tops?.tracks || []).map((t: any) => {
            const trackObj = t.track || t;
            return {
              id: trackObj.id || t.id,
              name: trackObj.name || t.name,
              image: trackObj.image || t.image || (trackObj.album?.image),
              streams: t.playcount || t.streams || trackObj.playcount || 0,
              artists: trackObj.artists || t.artists || []
            };
          }),
          albums: (full.tops?.albums || []).map((al: any) => ({
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
    month: { count: initialUser.totalStreams || (initialUser as any).totalStreams, durationMs: initialUser.totalDurationMs },
    lifetime: { count: (initialUser as any).scrobbles || initialUser.scrobbles }
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
        </div>

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
                       <AutoSizerAny>
                        {({ height, width }: { height: number; width: number }) => (
                          <ListAny
                            rowCount={topItems.slice(0, 20).length}
                            rowHeight={56}
                            width={width || 320}
                            height={height || 400}
                            rowProps={{}}
                            rowComponent={({ index, style }: { index: number, style: any }) => (
                              <div style={style} className="px-1 py-1">
                                <motion.div 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="glass flex items-center justify-between px-3 py-2 rounded-[20px] border-white/5 group hover:bg-white/[0.08] transition-all h-full"
                                >
                                   <div className="flex items-center gap-3 min-w-0">
                                      <span className="text-[10px] font-black text-white/30 w-4 pl-1">#{index + 1}</span>
                                      <SmartImage 
                                        src={topItems[index].image} 
                                        className="h-8 w-8 shadow-md border border-white/10" 
                                        rounded="xl"
                                        fallback=""
                                      />
                                      <div className="flex flex-col min-w-0 pr-2">
                                         <span className="text-[12px] font-black text-white tracking-tight truncate max-w-[150px]">{topItems[index].name}</span>
                                         <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest truncate max-w-[150px]">
                                            {topItems[index].artists ? topItems[index].artists.map((a: any) => a.name).join(', ') : 'Mais ouvidos'}
                                         </span>
                                      </div>
                                   </div>
                                   <div className="text-right shrink-0">
                                      <div className="bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded-full flex items-center justify-center">
                                         <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">
                                            {coreUtils.formatNumber(topItems[index].streams || 0)}
                                         </span>
                                      </div>
                                   </div>
                                </motion.div>
                              </div>
                            )}
                          />
                        )}
                       </AutoSizerAny>
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
