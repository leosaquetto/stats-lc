
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { Award, Trophy, Users, Flame, TrendingUp, RefreshCcw, AlertTriangle, Swords } from 'lucide-react';
import { clsx } from 'clsx';
import { SectionHeader, Skeleton } from '../components/MusicUI';
import { UserDetailModal, StatsBattleModal } from '../components/MusicUI';
import { GROUP_USERS, coreUtils } from '../services/statsCore';
import { UserStats } from '../types/stats';
import { statsService } from '../services/statsService';

type Range = 'today' | 'weeks' | 'months' | 'years' | 'lifetime';

export default function RankingScreen() {
  const { groupStats, isLoading: isGlobalLoading, fetchGroup } = useStatsStore();
  const [activeRange, setActiveRange] = useState<Range>('months');
  const [rankingType, setRankingType] = useState<'streams' | 'duration'>('streams');
  const [rankingsData, setRankingsData] = useState<Record<string, { count: number, durationMs: number }>>({});
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [battleOpponent, setBattleOpponent] = useState<UserStats | null>(null);
  const LEO_ID = "leo";
  const { setFeaturedUserId, featuredUserId } = useStatsStore();
  
  useEffect(() => {
    async function loadRankings() {
      setIsLocalLoading(true);
      setErrorLocal(null);
      try {
        const data = await statsService.getRankings(activeRange);
        setRankingsData(data);
      } catch (e) {
        console.error("Failed to load rankings", e);
        setErrorLocal("Não foi possível carregar o ranking. Tente novamente mais tarde.");
      } finally {
        setIsLocalLoading(false);
      }
    }
    loadRankings();
  }, [activeRange]);
  
  const hiddenUsers = useStatsStore(s => s.hiddenUsers);
  const members = (groupStats?.members || Object.values(groupStats?.users || {})).filter((m: any) => !hiddenUsers.includes(m.id));
  
  // Prioriza os dados do ranking específico se disponível
  const displayUsers = members.map(user => {
    const stats: any = rankingsData[user.id] || {};
    return {
      ...user,
      displayCount: stats.count || 0,
      displayDuration: stats.durationMs || 0
    };
  });

  const sortedUsers = [...displayUsers].sort((a, b) => {
    if (rankingType === 'streams') return b.displayCount - a.displayCount;
    return b.displayDuration - a.displayDuration;
  });
  console.log("[RankingScreen] sortedUsers:", sortedUsers);

  if (errorLocal) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4 text-center">
        <AlertTriangle className="h-12 w-12 text-orange-500" />
        <p className="text-white/60">{errorLocal}</p>
        <button 
          onClick={() => setActiveRange(activeRange)}
          className="px-4 py-2 bg-white/10 rounded-xl text-white text-sm"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

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
    { id: 'years', label: 'Ano' }
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
        {battleOpponent && (
          <StatsBattleModal 
            userA={members.find(m => m.id === featuredUserId)!}
            userB={battleOpponent}
            onClose={() => setBattleOpponent(null)}
          />
        )}
      </AnimatePresence>

      <header className="px-1 flex justify-between items-start">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white/95">Arena do Group</h1>
          <p className="text-white/60 text-sm">Disputa sonora entre os amigos</p>
        </div>
        <div className="flex gap-2 relative">
          <button 
                onClick={() => setShowUserSelector(!showUserSelector)} 
                className={clsx(
                  "h-10 w-10 glass rounded-2xl flex items-center justify-center transition-all",
                  showUserSelector && "bg-white/20 border-white/20"
                )}
              >
                 <Users className="h-4 w-4 text-white/40" />
          </button>
          <button onClick={() => fetchGroup(true)} className="h-10 w-10 glass rounded-2xl flex items-center justify-center">
             <RefreshCcw className={clsx("h-4 w-4 text-white/50", (isGlobalLoading || isLocalLoading) && "animate-spin")} />
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
                  className="absolute top-full right-0 mt-2 w-48 glass-card border-white/10 p-2 z-50 shadow-2xl backdrop-blur-3xl overflow-hidden"
                >
                  <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 px-3 py-2 mb-1">Focar Perfil</div>
                  <div className="flex flex-col gap-1">
                    {members.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setFeaturedUserId(u.id);
                          // setShowUserSelector(false);
                        }}
                        className={clsx(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                          featuredUserId === u.id 
                            ? "bg-white/10 border border-white/10" 
                            : "hover:bg-white/5"
                        )}
                      >
                        <div className="h-6 w-6 rounded-full border border-white/10 overflow-hidden relative grayscale shrink-0">
                           <img 
                             src={coreUtils.getUserAvatar(u.id)} 
                             className="h-full w-full object-cover" 
                             alt={u.name} 
                           />
                           {featuredUserId === u.id && (
                             <div className="absolute inset-0 bg-orange-500/20" />
                           )}
                        </div>
                        <span className={clsx(
                          "text-xs font-medium transition-colors",
                          featuredUserId === u.id ? "text-white" : "text-white/60"
                        )}>
                          {u.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
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
      
      {/* Ranking Type Selector */}
      <div className="flex gap-2 p-1 bg-white/[0.03] rounded-3xl self-start">
        <button
          onClick={() => setRankingType('streams')}
          className={clsx(
            "px-4 py-2 rounded-2xl text-[9px] font-bold uppercase tracking-widest transition-all duration-300",
            rankingType === 'streams' 
              ? "bg-orange-500/20 text-orange-500 border border-orange-500/20" 
              : "text-white/30 hover:text-white/60"
          )}
        >
          Mais Tocadas
        </button>
        <button
          onClick={() => setRankingType('duration')}
          className={clsx(
            "px-4 py-2 rounded-2xl text-[9px] font-bold uppercase tracking-widest transition-all duration-300",
            rankingType === 'duration' 
              ? "bg-orange-500/20 text-orange-500 border border-orange-500/20" 
              : "text-white/30 hover:text-white/60"
          )}
        >
          Tempo de Audição
        </button>
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
            style={{ backgroundColor: sortedUsers[0].id === LEO_ID ? ({id: "leo", name: "Leo", color: "#FF9F0A"}).color : '#ffd700' }}
          />
          
          <div className="relative mb-4">
             <div 
                className="h-24 w-24 rounded-full border border-white/10 overflow-hidden p-1 shadow-2xl"
                style={{ borderColor: sortedUsers[0].id === LEO_ID ? ({id: "leo", name: "Leo", color: "#FF9F0A"}).color : '#ffd700' }}
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
          <p className="text-[10px] uppercase font-bold tracking-[0.4em] mb-4" style={{ color: sortedUsers[0].id === LEO_ID ? ({id: "leo", name: "Leo", color: "#FF9F0A"}).color : '#ffd700' }}>
            Líder Absoluto
          </p>
          
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{ranges.find(r => r.id === activeRange)?.label}</span>
              <span className="text-lg font-bold text-white/90">
                {rankingType === 'streams' 
                  ? coreUtils.formatNumber(sortedUsers[0].displayCount)
                  : coreUtils.formatDuration(sortedUsers[0].displayDuration)
                }
              </span>
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
                    {rankingType === 'streams' 
                      ? coreUtils.formatNumber(user.displayCount)
                      : coreUtils.formatDuration(user.displayDuration)
                    }
                 </span>
                 <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                    {rankingType === 'streams' ? 'Streams' : 'Tempo'}
                 </span>
              </div>
            </motion.div>
          );
        })}
      </section>

      {groupStats && (
        <div className="mt-8 text-center">
          <SectionHeader title="Arena Battle" />
          <div className="relative overflow-hidden">
            <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-2 px-2 pb-2 scroll-fade-h">
              {members
                .filter(u => u.id !== featuredUserId)
                .map(opp => (
                  <button
                    key={opp.id}
                    onClick={() => setBattleOpponent(opp)}
                    className="glass-card min-w-[110px] p-5 flex flex-col items-center gap-4 active:scale-95 transition-all border-white/5 hover:bg-white/[0.05]"
                  >
                    <div className="relative">
                      <div className="h-14 w-14 rounded-full p-0.5 bg-white/10">
                        <img src={opp.avatar} className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" alt="" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-orange-500 rounded-full flex items-center justify-center border-2 border-[#050505] shadow-lg">
                        <Swords className="h-3 w-3 text-white" />
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-white/60 truncate w-20">
                        {opp.name.split(' ')[0]}
                      </span>
                      <span className="text-[8px] font-black text-orange-500/60 uppercase tracking-tighter mt-1 block">VS {members.find(m => m.id === featuredUserId)?.name.split(' ')[0].toUpperCase()}</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Meta Coletiva Oculta */}
    </div>
  );
}

