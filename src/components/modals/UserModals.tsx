
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Music2, Headphones, Swords, Disc, Sparkles, Tv, BarChart3, Maximize } from 'lucide-react';
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
import { FixedSizeList as List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { UserStats, TopItem } from '../../types/stats';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GroupGrowthChart } from '../battle/GroupGrowthChart';
import { AlbumDetailModal } from './AlbumDetailModal';

const ListAny = List as any;
const AutoSizerAny = AutoSizer as any;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


// Implementação consolidada de AlbumDetailModal agora importada de ./AlbumDetailModal.tsx

const PresentationStatsView = ({ stats, user, loading }: any) => {
  if (loading) {
     return <div className="p-12 text-center text-white/40 uppercase tracking-widest text-xs font-black">Carregando Apresentação...</div>;
  }

  const maxStreams = Math.max(stats.lifetime?.count || 1, 100);
  const monthlyPercent = Math.min(((stats.month?.count || 0) / maxStreams) * 100, 100);
  const todayPercent = Math.min(((stats.today?.count || 0) / maxStreams) * 100, 100);

  return (
    <div className="px-6 py-8 flex flex-col gap-10">
       <div className="text-center mb-4">
         <h3 className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300 drop-shadow-[0_0_20px_rgba(249,115,22,0.3)]">
            Estatísticas Principais
         </h3>
         <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mt-3">Modo de Apresentação</p>
       </div>

       <div className="flex flex-col gap-8">
          {/* Lifetime */}
          <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
             <div className="absolute top-0 right-0 p-6 opacity-10">
                <BarChart3 className="w-32 h-32 text-orange-500" />
             </div>
             <div className="flex flex-col gap-1 relative z-10">
                <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.25em]">Streams Totais (Lifetime)</span>
                <div className="text-5xl font-display font-black text-white">
                   <AnimatedNumber value={stats.lifetime?.count || 0} />
                </div>
             </div>
             <div className="h-3 w-full bg-white/5 rounded-full mt-4 overflow-hidden shadow-inner">
                <motion.div 
                   initial={{ scaleX: 0 }}
                   animate={{ scaleX: 1 }}
                   transition={{ duration: 1.5, ease: "easeOut" }}
                   className="h-full w-full origin-left bg-gradient-to-r from-orange-600 to-amber-400"
                   style={{ willChange: 'transform' }}
                />
             </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
             {/* Monthly */}
             <div className="glass-card p-6 flex flex-col gap-3 border-amber-500/10">
                <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Neste Mês</span>
                   <div className="text-4xl font-display font-black text-white/90">
                      <AnimatedNumber value={stats.month?.count || 0} />
                   </div>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                   <motion.div 
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: Math.min(1, Math.max(monthlyPercent * 5, 5) / 100) }} // Exaggerated for visual effect if small
                      transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
                      className="h-full w-full origin-left bg-amber-400"
                      style={{ willChange: 'transform' }}
                   />
                </div>
             </div>

             {/* Today */}
             <div className="glass-card p-6 flex flex-col gap-3 border-green-500/10">
                <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">No Dia de Hoje</span>
                   <div className="text-4xl font-display font-black text-white/90">
                      <AnimatedNumber value={stats.today?.count || 0} />
                   </div>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                   <motion.div 
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: Math.min(1, Math.max(todayPercent * 50, 5) / 100) }} // Exaggerated for visual effect if small
                      transition={{ duration: 1.5, delay: 0.4, ease: "easeOut" }}
                      className="h-full w-full origin-left bg-green-400"
                      style={{ willChange: 'transform' }}
                   />
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

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
  const [presentationMode, setPresentationMode] = useState(false);
  
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const full = await statsService.getUserFullStats(initialUser.id);
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
    month: { count: initialUser.streamsMonth || 0, durationMs: initialUser.totalDurationMs },
    lifetime: { count: initialUser.totalStreams || initialUser.scrobbles || 0 }
  };

  const topItems = userData?.transformedTopItems?.[activeTab] || [];
  const avatar = coreUtils.withPeterFallback(initialUser.id, initialUser.avatar);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center liquid-glass-overlay"
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
           <div className="absolute top-8 right-8 z-50 flex items-center gap-3">
             <button 
               onClick={() => setPresentationMode(!presentationMode)}
               className={cn(
                  "h-11 px-3 glass rounded-2xl flex items-center gap-2 transition-all border border-white/5 shadow-2xl",
                  presentationMode ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "text-white/40 hover:text-white/90 active:scale-95"
               )}
             >
               <Maximize className="h-4 w-4" />
               <span className="text-[10px] font-black uppercase tracking-widest hidden">Apresentação</span>
             </button>
             <button 
               onClick={onClose}
               className="h-11 w-11 glass rounded-2xl flex items-center justify-center text-white/40 hover:text-white/90 active:scale-90 transition-all border border-white/5 shadow-2xl"
             >
               <X className="h-5 w-5" />
             </button>
           </div>
           <img 
              src={avatar} 
              className="w-full h-full object-cover blur-2xl opacity-20 scale-150" 
              loading="lazy"
              alt="" 
           />
           <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505]" />
           
           <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
              <div className={cn(
                "h-32 w-32 rounded-[40px] p-1.5 shadow-2xl transition-all duration-500",
                isLeo ? "bg-orange-500/20" : "bg-white/5"
              )}>
                 <SmartImage 
                    src={avatar} 
                    className="h-full w-full" 
                    rounded="[36px]"
                    fallback="" 
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

        {presentationMode ? (
          <PresentationStatsView stats={stats} user={initialUser} loading={loading} />
        ) : (
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
                         {loading ? "?" : coreUtils.formatNumber(stats.today?.count || 0)}
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
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: loading ? 0.2 : Math.min((stats.today?.count || 0) * 2, 100) / 100 }}
                        className="h-full w-full origin-left bg-orange-500"
                        style={{ willChange: 'transform' }}
                      />
                   </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col justify-between gap-4">
                     <SectionHeader title="Top Rankings" />
                     <div className="flex gap-1 bg-white/5 p-1 rounded-xl glass border border-white/5 self-start">
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
        )}
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
  const [showArenaCalc, setShowArenaCalc] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center liquid-glass-overlay p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="glass-card w-full max-w-lg rounded-t-[48px] p-8 max-h-[90vh] overflow-y-auto no-scrollbar relative"
        onClick={e => e.stopPropagation()}
      >
        <AnimatePresence>
          {showArenaCalc && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute inset-x-8 top-24 bottom-24 z-[60] glass-card p-6 border-orange-500/30 flex flex-col items-center justify-center text-center gap-4 bg-black/90 backdrop-blur-3xl shadow-2xl"
            >
              <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center mb-2">
                <Swords className="h-6 w-6 text-orange-500" />
              </div>
              <h4 className="text-lg font-display font-black text-white uppercase tracking-widest">Arena Battle Level</h4>
              <p className="text-[11px] text-white/70 leading-relaxed font-medium">
                O cálculo do nível de <span className="text-orange-500 font-bold">Arena Battle</span> é gerado dinamicamente cruzando as métricas de <span className="text-white font-bold">Volume (40%)</span>, <span className="text-white font-bold">Tempo (30%)</span>, <span className="text-white font-bold">Consistência (20%)</span> e <span className="text-white font-bold">Diversidade (10%)</span>.
              </p>
              <p className="text-[10px] text-white/40 italic">
                O ranking é recalibrado a cada 5 minutos sincronizando com a atividade global da rede.
              </p>
              <button 
                onClick={() => setShowArenaCalc(false)}
                className="mt-4 px-6 py-2 rounded-full bg-orange-500 text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-orange-500/20"
              >
                Entendido
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
          
          <button 
            type="button" 
            onClick={() => setShowArenaCalc(true)}
            className="flex flex-col items-center group/arena-label hover:scale-110 active:scale-95 transition-all"
          >
             <span className="text-4xl font-display font-black italic text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">VS</span>
             <span className="text-[9px] font-black text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.3)] mt-1.5 uppercase tracking-[0.3em]">Arena Battle</span>
          </button>
  
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
              delay={0.2}
           />
           <BattleMetric 
              label="Tempo Ouvido" 
              valA={coreUtils.formatDuration(userA.totalDurationMs || 0)} 
              valB={coreUtils.formatDuration(userB.totalDurationMs || 0)}
              winner={ (userA.totalDurationMs || 0) > (userB.totalDurationMs || 0) ? 'A' : 'B' }
              delay={0.32}
           />
           <BattleMetric 
              label="Hoje" 
              valA={coreUtils.formatNumber(userA.streamsToday)} 
              valB={coreUtils.formatNumber(userB.streamsToday)}
              winner={ userA.streamsToday > userB.streamsToday ? 'A' : 'B' }
              delay={0.44}
           />
        </div>

        <div className="flex flex-col gap-10 mt-12 pb-10">
           <ComparisonSection 
              title="Top Artistas do Mês" 
              itemsA={userA.topItems?.artists.slice(0, 3) || []} 
              itemsB={userB.topItems?.artists.slice(0, 3) || []} 
              delay={0.56}
           />
           <ComparisonSection 
              title="Top Músicas do Mês" 
              itemsA={userA.topItems?.tracks.slice(0, 3) || []} 
              itemsB={userB.topItems?.tracks.slice(0, 3) || []} 
              delay={0.8}
           />
        </div>

        <div className="mt-4 mb-10">
           <GroupGrowthChart />
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

const BattleMetric = ({ label, valA, valB, winner, delay = 0 }: { label: string, valA: string, valB: string, winner: 'A' | 'B', delay?: number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    className="flex flex-col gap-2"
  >
    <motion.span 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: delay + 0.1, duration: 0.3 }}
      className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] text-center"
    >
      {label}
    </motion.span>
    <div className="flex items-center justify-between px-4 overflow-hidden">
       <motion.span 
         initial={{ x: -20, opacity: 0 }}
         animate={{ x: 0, opacity: 1 }}
         transition={{ delay: delay + 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
         className={cn(
           "text-xl font-display font-black tracking-tighter transition-all",
           winner === 'A' ? "text-orange-500 scale-110" : "text-white/60"
         )}
       >
         {valA}
       </motion.span>
       
       <motion.div 
         initial={{ scaleX: 0 }}
         animate={{ scaleX: 1 }}
         transition={{ delay: delay + 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
         className="h-px flex-1 mx-4 bg-white/10 origin-center" 
       />
       
       <motion.span 
         initial={{ x: 20, opacity: 0 }}
         animate={{ x: 0, opacity: 1 }}
         transition={{ delay: delay + 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
         className={cn(
           "text-xl font-display font-black tracking-tighter transition-all",
           winner === 'B' ? "text-orange-500 scale-110" : "text-white/60"
         )}
       >
         {valB}
       </motion.span>
    </div>
  </motion.div>
);

const ComparisonSection = ({ title, itemsA, itemsB, delay = 0 }: { title: string, itemsA: TopItem[], itemsB: TopItem[], delay?: number }) => (
  <div className="flex flex-col gap-6">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      className="flex items-center gap-4"
    >
       <div className="h-px flex-1 bg-white/10" />
       <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] whitespace-nowrap">{title}</span>
       <div className="h-px flex-1 bg-white/10" />
    </motion.div>
    
    <div className="flex flex-col gap-4 px-2">
      {[0, 1, 2].map(i => {
        const itemDelay = delay + 0.12 + i * 0.08;
        return (
          <div key={i} className="flex items-center justify-between gap-4 h-14 overflow-hidden">
            <motion.div 
              initial={{ x: -25, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: itemDelay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-1 items-center gap-3 overflow-hidden"
            >
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
            </motion.div>

            <motion.span 
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: itemDelay + 0.08, duration: 0.4 }}
              className="text-[9px] font-black text-white/10 italic"
            >
              #{i+1}
            </motion.span>

            <motion.div 
              initial={{ x: 25, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: itemDelay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-1 items-center gap-3 overflow-hidden justify-end text-right"
            >
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
            </motion.div>
          </div>
        );
      })}
    </div>
  </div>
);
