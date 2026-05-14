/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, TrendingUp, Music2, Calendar, RefreshCcw, AlertTriangle, Swords } from 'lucide-react';
import { clsx } from 'clsx';
import { SectionHeader, Skeleton, MonthlyGroupLeaderboard, StatsBattleModal } from '../components/MusicUI';
import { coreUtils, GROUP_USERS } from '../services/statsCore';
import { UserStats, TopItem } from '../types/stats';
import { statsService } from '../services/statsService';

type Filter = 'Hoje' | 'Semana' | 'Mês' | 'Geral';

export default function StatsScreen() {
  const [activeFilter, setActiveFilter] = useState<Filter>('Hoje');
  const [battleOpponent, setBattleOpponent] = useState<UserStats | null>(null);
  const [fullUserData, setFullUserData] = useState<any>(null);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  
  const { groupStats, isLoading: isGlobalLoading, error: globalError, fetchGroupStats } = useStatsStore();
  const LEO_ID = GROUP_USERS.LEO.id;
  const leo = groupStats?.users[LEO_ID];
  const accentColor = GROUP_USERS.LEO.color;

  const filters: Filter[] = ['Hoje', 'Semana', 'Mês', 'Geral'];

  useEffect(() => {
    async function loadFullData() {
      setIsLocalLoading(true);
      try {
        const data = await statsService.getRankings('months'); // Mock or fetch real
        // Para StatsScreen, queremos os detalhes do Leo
        const res = await fetch(`/api/stats/user/${LEO_ID}`);
        const fullData = await res.json();
        setFullUserData(fullData);
      } catch (e) {
        console.error("Failed to load full user data");
      } finally {
        setIsLocalLoading(false);
      }
    }
    loadFullData();
  }, [LEO_ID]);

  // Mapeia o filtro para o campo de stats correto
  const getStatsByFilter = () => {
    if (!fullUserData) return null;
    switch (activeFilter) {
      case 'Hoje': return fullUserData.stats.today;
      case 'Semana': // API doesn't have direct week but we estimate or use month
      case 'Mês': return fullUserData.stats.month;
      case 'Geral': return fullUserData.stats.lifetime;
      default: return fullUserData.stats.today;
    }
  };

  const currentStats = getStatsByFilter();

  const statsCards = [
    { 
      label: `Streams ${activeFilter}`, 
      value: coreUtils.formatNumber(currentStats?.count || (activeFilter === 'Hoje' ? leo?.streamsToday : 0) || 0), 
      icon: Music2, 
      color: accentColor 
    },
    { 
      label: 'Tempo de Audição', 
      value: coreUtils.formatDuration(currentStats?.durationMs || (activeFilter === 'Hoje' ? (leo as any)?.totalDurationMs : 0) || 0), 
      icon: TrendingUp, 
      color: accentColor 
    },
  ];

  if ((isGlobalLoading || isLocalLoading) && !leo) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-48" />
        <div className="flex gap-4">
           <Skeleton className="h-32 flex-1 rounded-[32px]" />
           <Skeleton className="h-32 flex-1 rounded-[32px]" />
        </div>
        <Skeleton className="h-80 w-full rounded-[40px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-32">
      <AnimatePresence>
        {battleOpponent && leo && (
          <StatsBattleModal 
            userA={leo}
            userB={battleOpponent}
            onClose={() => setBattleOpponent(null)}
          />
        )}
      </AnimatePresence>

      <header className="px-1 flex justify-between items-end">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white/95">Estatísticas</h1>
          <p className="text-white/60 text-sm">O legado sonoro de {leo?.name || 'Leo'}</p>
        </div>
        <button onClick={() => fetchGroupStats(true)} className="h-8 w-8 glass rounded-xl flex items-center justify-center">
           <RefreshCcw className={clsx("h-3 w-3 text-white/40", (isGlobalLoading || isLocalLoading) && "animate-spin")} />
        </button>
      </header>

      {(globalError) && !leo && (
        <div className="glass-card p-10 flex flex-col items-center gap-4 border-orange-500/10">
           <AlertTriangle className="h-8 w-8 text-orange-500/60" />
           <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Sincronia Indisponível</p>
           <button onClick={() => fetchGroupStats(true)} className="text-[9px] font-bold text-orange-500 uppercase tracking-widest py-2 px-4 glass rounded-full">Forçar Busca</button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="relative mb-2">
        <div className="flex gap-2 p-1 bg-white/[0.03] rounded-3xl overflow-x-auto no-scrollbar scroll-fade-h">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={clsx(
                "px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shrink-0",
                activeFilter === f 
                  ? "bg-white text-black shadow-lg shadow-white/10" 
                  : "text-white/30 hover:text-white/60"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <AnimatePresence mode="wait">
          {statsCards.map((card, i) => (
            <motion.div
              key={`${card.label}-${activeFilter}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card flex flex-col gap-3 p-6 border-white/5"
              style={{ borderColor: activeFilter === 'Hoje' ? `${accentColor}10` : undefined }}
            >
              <card.icon className="h-4 w-4" style={{ color: card.color }} />
              <div className="flex flex-col">
                <span className="text-2xl font-display font-medium tracking-tight text-white">{card.value}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">{card.label}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {groupStats && (
        <div className="mt-2 text-center">
          <SectionHeader title="Arena Battle" />
          <div className="relative overflow-hidden">
            <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-2 px-2 pb-2 scroll-fade-h">
              {Object.values(groupStats.users)
                .filter(u => u.id !== LEO_ID)
                .map(user => (
                  <button
                    key={user.id}
                    onClick={() => setBattleOpponent(user)}
                    className="glass-card min-w-[110px] p-5 flex flex-col items-center gap-4 active:scale-95 transition-all border-white/5 hover:bg-white/[0.05]"
                  >
                    <div className="relative">
                      <div className="h-14 w-14 rounded-full p-0.5 bg-white/10">
                        <img src={user.avatar} className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" alt="" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-orange-500 rounded-full flex items-center justify-center border-2 border-[#050505] shadow-lg">
                        <Swords className="h-3 w-3 text-white" />
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-white/60 truncate w-20">
                        {user.name.split(' ')[0]}
                      </span>
                      <span className="text-[8px] font-black text-orange-500/60 uppercase tracking-tighter mt-1 block">VS LEO</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {groupStats && (activeFilter === 'Mês' || activeFilter === 'Geral') && (
        <MonthlyGroupLeaderboard users={Object.values(groupStats.users)} />
      )}

      <SectionHeader title={`Top Artistas (${activeFilter})`} />
      
      <div className="flex flex-col gap-3">
        {fullUserData && fullUserData.tops.artists.slice(0, 5).map((artist: any, i: number) => (
          <motion.div 
            key={artist.id} 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass flex items-center justify-between rounded-[28px] p-4 border-white/5 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-white/30 w-4">#{i + 1}</span>
              <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/10 relative overflow-hidden">
                <img src={artist.image || artist.artist?.image } className="h-full w-full object-cover opacity-60 grayscale" referrerPolicy="no-referrer" alt={artist.name || artist.artist?.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-[13px] text-white/90">{artist.name || artist.artist?.name}</span>
                <span className="text-[9px] text-white/50 uppercase font-black tracking-widest mt-0.5">{coreUtils.formatNumber(artist.playcount || artist.streams || 0)} scrobbles</span>
              </div>
            </div>
            <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center">
               <TrendingUp className="h-3 w-3 text-white/40" />
            </div>
          </motion.div>
        ))}
        {(!fullUserData || fullUserData.tops.artists.length === 0) && !isLocalLoading && (
           <p className="text-center text-[10px] text-white/20 uppercase tracking-widest py-4">Sem dados de artistas para este período</p>
        )}
      </div>
      
      {/* Time Tracking Widget */}
      <div className="mt-4 p-8 rounded-[40px] bg-white/[0.02] border border-white/5 mb-12">
         <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-4 w-4" style={{ color: accentColor }} />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>Frequência Sonora</h4>
         </div>
         <p className="text-white/60 text-[13px] leading-relaxed font-medium">
           {leo?.name || 'Leo'} ouviu <span className="text-white font-bold">{coreUtils.formatDuration(currentStats?.durationMs || 0)}</span> de música no período selecionado ({activeFilter.toLowerCase()}).
         </p>
      </div>
    </div>
  );
}
