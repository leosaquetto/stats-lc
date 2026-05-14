/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { Award, Trophy, Users, Flame, TrendingUp, RefreshCcw, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { SectionHeader, Skeleton, UserDetailModal } from '../components/MusicUI';
import { GROUP_USERS, coreUtils } from '../services/statsCore';
import { UserStats } from '../types/stats';
import { statsService } from '../services/statsService';

type Range = 'today' | 'weeks' | 'months' | 'lifetime';

export default function RankingScreen() {
  const { groupStats, isLoading: isGlobalLoading, error, fetchGroup } = useStatsStore();
  const [activeRange, setActiveRange] = useState<Range>('months');
  const [rankingsData, setRankingsData] = useState<Record<string, any>>({});
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const LEO_ID = GROUP_USERS.LEO.id;

  useEffect(() => {
    async function loadRankings() {
      setIsLocalLoading(true);
      try {
        const data = await statsService.getRankings(activeRange);
        setRankingsData(data);
      } catch (e) {
        console.error("Failed to load rankings");
      } finally {
        setIsLocalLoading(false);
      }
    }
    loadRankings();
  }, [activeRange]);
  
  const members = groupStats?.members || Object.values(groupStats?.users || {});
  
  // Prioriza os dados do ranking específico se disponível
  const displayUsers = members.map(user => {
    const stats = rankingsData[user.id] || {};
    return {
      ...user,
      displayCount: stats.count || (activeRange === 'today' ? user.streamsToday : 0)
    };
  });

  const sortedUsers = displayUsers.sort((a, b) => b.displayCount - a.displayCount);

  if ((isGlobalLoading || isLocalLoading) && sortedUsers.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header className="px-1">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </header>
        <Skeleton className="h-64 w-full rounded-[40px]" />
        <Skeleton className="h-20 w-full rounded-[32px]" />
        <Skeleton className="h-20 w-full rounded-[32px]" />
      </div>
    );
  }

  const ranges: { id: Range; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: 'weeks', label: 'Semana' },
    { id: 'months', label: 'Mês' },
    { id: 'lifetime', label: 'Geral' }
  ];

  return (
    <div className="flex flex-col gap-6 pb-32">
      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal 
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>

      <header className="px-1 flex justify-between items-start">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white/95">Arena do Group</h1>
          <p className="text-white/60 text-sm">Disputa sonora entre os amigos</p>
        </div>
        <button onClick={() => fetchGroup(true)} className="h-10 w-10 glass rounded-2xl flex items-center justify-center">
           <RefreshCcw className={clsx("h-4 w-4 text-white/50", (isGlobalLoading || isLocalLoading) && "animate-spin")} />
        </button>
      </header>

      {/* Range Selector */}
      <div className="flex gap-2 p-1 bg-white/[0.03] rounded-3xl overflow-x-auto no-scrollbar scroll-fade-h">
        {ranges.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveRange(r.id)}
            className={clsx(
              "px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shrink-0",
              activeRange === r.id 
                ? "bg-white text-black shadow-lg shadow-white/10" 
                : "text-white/30 hover:text-white/60"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Podium Effect (First Place Spotlight) */}
      {sortedUsers.length > 0 && (
        <motion.div
          key={`leader-${activeRange}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setSelectedUser(sortedUsers[0])}
          className="relative overflow-hidden rounded-[40px] bg-[#0A0A0A] border border-white/5 p-8 flex flex-col items-center text-center active:scale-[0.98] transition-transform cursor-pointer"
        >
          <div 
            className="absolute -top-10 -left-10 h-32 w-32 blur-[60px] opacity-20" 
            style={{ backgroundColor: sortedUsers[0].id === LEO_ID ? GROUP_USERS.LEO.color : '#ffd700' }}
          />
          
          <div className="relative mb-4">
             <div 
                className="h-24 w-24 rounded-full border border-white/10 overflow-hidden p-1 shadow-2xl"
                style={{ borderColor: sortedUsers[0].id === LEO_ID ? GROUP_USERS.LEO.color : '#ffd700' }}
             >
                <img src={sortedUsers[0].avatar} className="h-full w-full object-cover rounded-full" alt="" />
             </div>
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
               className="absolute inset-[-12px] border-2 border-dashed border-white/5 rounded-full"
             />
          </div>
          
          <h2 className="text-2xl font-bold font-display text-white/90">{sortedUsers[0].name}</h2>
          <p className="text-[10px] uppercase font-bold tracking-[0.4em] mb-4" style={{ color: sortedUsers[0].id === LEO_ID ? GROUP_USERS.LEO.color : '#ffd700' }}>
            Líder Absoluto
          </p>
          
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{ranges.find(r => r.id === activeRange)?.label}</span>
              <span className="text-lg font-bold text-white/90">{coreUtils.formatNumber(sortedUsers[0].displayCount)}</span>
            </div>
            <div className="w-[1px] h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Pontos</span>
              <span className="text-lg font-bold text-white/90">{coreUtils.formatNumber(Math.floor(sortedUsers[0].displayCount * 1.5))}</span>
            </div>
          </div>
        </motion.div>
      )}

      <SectionHeader 
        title={`Ranking ${ranges.find(r => r.id === activeRange)?.label}`} 
        action={<TrendingUp className="h-4 w-4 text-white/20" />}
      />

      <section className="flex flex-col gap-4">
        {sortedUsers.map((user, i) => {
          const isLeo = user.id === LEO_ID;
          return (
            <motion.div
              key={user.id || i}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
              onClick={() => setSelectedUser(user)}
              className={clsx(
                "relative flex items-center justify-between rounded-[28px] p-5 transition-all active:scale-[0.98] cursor-pointer",
                isLeo ? "glass premium-gradient border-orange-500/20 shadow-orange-500/5 shadow-2xl" : "bg-white/[0.02] border border-white/[0.05]"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-[15px] font-black italic shadow-inner">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10 bg-white/5 p-0.5">
                      <img src={user.avatar} className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" alt="" />
                   </div>
                   <div>
                      <div className="flex items-center gap-2">
                        <h3 className={clsx("font-display text-[15px] font-black tracking-tight", isLeo ? "text-orange-500" : "text-white/90")}>
                          {user.name.toUpperCase()}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                         <div className={clsx("h-1.5 w-1.5 rounded-full", user.streamsToday > 30 ? "bg-orange-500 animate-pulse" : "bg-white/10")} />
                         <span className="text-[9px] text-white/20 uppercase font-black tracking-[0.15em]">
                            {i === 0 ? "Legendary" : "Active Member"}
                         </span>
                      </div>
                   </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-0.5">
                 <span className={clsx("font-display text-lg font-black tracking-tighter leading-none", isLeo ? "text-orange-400" : "text-white/80")}>
                    {coreUtils.formatNumber(user.displayCount)}
                 </span>
                 <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Streams</span>
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* Collective Goal */}
      <div className="mt-4 p-8 glass-card border-white/5 bg-gradient-to-tr from-white/[0.02] to-transparent rounded-[40px] mb-12">
        <div className="flex items-center gap-3 mb-6">
           <Award className="h-5 w-5 text-white/40" />
           <h4 className="font-bold text-sm tracking-tight">Meta Coletiva</h4>
        </div>
        <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-white/30 mb-3">
           <span>Audição em Grupo</span>
           <span className="text-white/60">84% Concluído</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '84%' }}
            transition={{ duration: 2, ease: "circOut" }}
            className="h-full bg-white/40" 
          />
        </div>
      </div>
    </div>
  );
}
