
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { Award, Trophy, Users, Flame, TrendingUp, TrendingDown, RefreshCcw, AlertTriangle, Swords, Share2 } from 'lucide-react';
import { clsx } from 'clsx';
import { SectionHeader, Skeleton, SmartImage } from '../components/shared/CommonUI';
import { GlobalStatsComparer } from '../components/stats/GlobalStatsComparer';
import { MonthlyGroupLeaderboard } from '../components/home/HomeHighlights';
import { GROUP_USERS, coreUtils } from '../services/statsCore';
import { UserStats } from '../types/stats';
import { statsService } from '../services/statsService';
import { ShareButton } from '../components/shared/ShareButton';
import { getVisibleMembers } from '../lib/memberSelectors';

const UserDetailModal = lazy(() => import('../components/modals/UserModals').then(module => ({ default: module.UserDetailModal })));
const StatsBattleModal = lazy(() => import('../components/modals/UserModals').then(module => ({ default: module.StatsBattleModal })));

const RankingCard = ({ user, i, rankingType, sortVersion, isLeo, onClick, index, trend }: any) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  return (
    <motion.div
      layout
      ref={cardRef}
      key={user.id}
      initial={{ opacity: 0, rotateY: 90, scale: 0.9 }}
      animate={{ 
        opacity: 1, 
        rotateY: 0, 
        scale: 1,
        rotateX: sortVersion % 2 === 0 ? 0.01 : -0.01 
      }}
      exit={{ opacity: 0, rotateY: -90, scale: 0.9 }}
      transition={{ 
        layout: { duration: 0.6, type: 'spring', bounce: 0.4 },
        rotateY: { duration: 0.5, delay: i * 0.04, type: 'spring' },
        opacity: { duration: 0.3 }
      }}
      onClick={onClick}
      className={clsx(
        "relative flex items-center justify-between rounded-[28px] p-5 transition-all active:scale-[0.98] cursor-pointer group/card",
        isLeo ? "glass premium-gradient border-orange-500/20 shadow-orange-500/5 shadow-2xl" : "bg-white/[0.02] border border-white/[0.05]"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <div 
            className={clsx(
              "ranking-badge flex h-11 w-11 items-center justify-center rounded-2xl text-[15px] font-black italic shadow-inner border transition-all duration-500",
              trend > 0 
                ? "bg-green-500/10 border-green-400/40 text-green-400 glow-up" 
                : trend < 0
                  ? "bg-red-500/10 border-red-400/40 text-red-400"
                  : "bg-white/5 border-white/5 text-white/90 pulse"
            )}
          >
            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
          </div>
          
          {trend !== 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className={clsx(
                "absolute -top-2 -right-2 flex items-center gap-0.5 px-1 rounded-full text-[7px] font-black tracking-tighter border shadow-sm",
                trend > 0 ? "bg-green-500 text-white border-green-400" : "bg-red-500 text-white border-red-400"
              )}
            >
              {trend > 0 ? <TrendingUp className="h-2 w-2" /> : <TrendingDown className="h-2 w-2" />}
              {Math.abs(trend)}
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-3">
           <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10 bg-white/5 p-0.5">
              <SmartImage src={user.avatar} className="h-full w-full" fallback="" rounded="full" />
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
                    {i === 0 ? "Lendário" : "Membro Ativo"}
                 </span>
              </div>
           </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end gap-0.5">
           <span className={clsx("font-display text-lg font-black tracking-tighter leading-none", isLeo ? "text-orange-400" : "text-white/80")}>
              {rankingType === 'streams' 
                ? coreUtils.formatNumber(user.displayCount)
                : coreUtils.formatDuration(user.displayDuration)
              }
           </span>
           <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
              {rankingType === 'streams' ? 'Streams' : 'Tempo de audição'}
           </span>
        </div>
        <ShareButton 
          targetRef={cardRef} 
          variant="minimal" 
          title={`Ranking de ${user.name}`}
          className="opacity-0 group-hover/card:opacity-100 transition-opacity"
        />
      </div>
    </motion.div>
  );
};

type Range = 'today' | 'weeks' | 'months' | 'years' | 'lifetime';

export default function RankingScreen() {
  const { groupStats, isLoading: isGlobalLoading, isOffline, fetchGroup, fetchGroupLive } = useStatsStore();
  const [activeRange, setActiveRange] = useState<Range>('months');
  const [rankingType, setRankingType] = useState<'streams' | 'duration'>('streams');
  const [rankingsData, setRankingsData] = useState<Record<string, { count: number, durationMs: number }>>({});
  const [weeklyRankings, setWeeklyRankings] = useState<Record<string, { count: number, durationMs: number }>>({});
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [battleOpponent, setBattleOpponent] = useState<UserStats | null>(null);
  const LEO_ID = "leo";
  const { setFeaturedUserId, featuredUserId } = useStatsStore();
  const podiumRef = useRef<HTMLDivElement>(null);
  
  const [sortVersion, setSortVersion] = useState(0);
  const prevRankings = useRef<Record<string, number>>({});
  
  useEffect(() => {
    async function loadWeeklyRankings() {
      try {
        const data = await statsService.getRankings('weeks');
        setWeeklyRankings(data);
      } catch (e) {
        console.error("Failed to load weekly rankings", e);
      }
    }
    loadWeeklyRankings();
  }, [groupStats]);

  useEffect(() => {
    async function loadRankings() {
      setIsLocalLoading(true);
      setErrorLocal(null);
      try {
        const data = await statsService.getRankings(activeRange);
        setRankingsData(data);
        // Increment version to trigger re-layout animations
        setSortVersion(v => v + 1);
      } catch (e) {
        console.error("Failed to load rankings", e);
        setErrorLocal("Não foi possível carregar o ranking. Tente novamente mais tarde.");
      } finally {
        setIsLocalLoading(false);
      }
    }
    loadRankings();
  }, [activeRange]);

  // Trigger flip animation when sorting type changes
  useEffect(() => {
    setSortVersion(v => v + 1);
  }, [rankingType]);
  
  const hiddenUsers = useStatsStore(s => s.hiddenUsers);
  const members = getVisibleMembers(groupStats, hiddenUsers);
  
  // Prioriza os dados do ranking específico se disponível
  const displayUsers = members.map(user => {
    const stats: any = rankingsData[user.id] || {};
    return {
      ...user,
      displayCount: stats.count || 0,
      displayDuration: stats.durationMs || 0
    };
  });

  const sortedUsers = [...displayUsers]
    .filter(u => rankingType === 'streams' ? u.displayCount > 0 : u.displayDuration > 0)
    .sort((a, b) => {
      if (rankingType === 'streams') return b.displayCount - a.displayCount;
      return b.displayDuration - a.displayDuration;
    });

  // Rivalidade da Semana
  const weeklyUsers = members.map(user => {
    const stats: any = weeklyRankings[user.id] || {};
    return {
      ...user,
      displayCount: stats.count || 0,
      displayDuration: stats.durationMs || 0
    };
  });

  const sortedWeeklyUsers = [...weeklyUsers].sort((a, b) => b.displayCount - a.displayCount);
  
  const featuredIndex = sortedWeeklyUsers.findIndex(u => u.id === featuredUserId);
  let rival: any = null;
  let featuredIsAhead = false;
  let diffStreams = 0;
  let diffDurationMs = 0;

  if (featuredIndex !== -1 && sortedWeeklyUsers.length > 1) {
    const featuredUser = sortedWeeklyUsers[featuredIndex];
    if (featuredIndex === 0) {
      rival = sortedWeeklyUsers[1];
    } else if (featuredIndex === sortedWeeklyUsers.length - 1) {
      rival = sortedWeeklyUsers[featuredIndex - 1];
    } else {
      const neighborAbove = sortedWeeklyUsers[featuredIndex - 1];
      const neighborBelow = sortedWeeklyUsers[featuredIndex + 1];
      const diffAbove = Math.abs(neighborAbove.displayCount - featuredUser.displayCount);
      const diffBelow = Math.abs(neighborBelow.displayCount - featuredUser.displayCount);
      
      if (diffAbove <= diffBelow) {
        rival = neighborAbove;
      } else {
        rival = neighborBelow;
      }
    }
    
    if (rival) {
      featuredIsAhead = featuredUser.displayCount >= rival.displayCount;
      diffStreams = Math.abs(featuredUser.displayCount - rival.displayCount);
      diffDurationMs = Math.abs(featuredUser.displayDuration - rival.displayDuration);
    }
  }

  // Track rank changes
  useEffect(() => {
    const newRankings: Record<string, number> = {};
    sortedUsers.forEach((user, idx) => {
      newRankings[user.id] = idx;
    });
    
    // We update the ref after a delay to maintain the "up" state for visuals during this session
    // Or we update it immediately if we want to reset trends on every data refresh
    const timer = setTimeout(() => {
      prevRankings.current = newRankings;
    }, 5000); // Keep the trend visible for 5s after a change
    
    return () => clearTimeout(timer);
  }, [sortedUsers]);

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
      <div className="flex flex-col gap-6 px-4">
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

  if (!groupStats && !isGlobalLoading && !isLocalLoading && sortedUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4 text-center">
        <Trophy className="h-12 w-12 text-white/20" />
        <p className="text-white/40">Nenhum dado da arena disponível</p>
      </div>
    );
  }

  const ranges: { id: Range; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: 'weeks', label: 'Semana' },
    { id: 'months', label: 'Mês' },
    { id: 'years', label: 'Ano' },
    { id: 'lifetime', label: 'Total' }
  ];

  return (
    <div className="flex flex-col gap-6 pb-32 px-4">
      <Suspense fallback={null}>
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
      </Suspense>

      <header className="px-1 flex justify-between items-start">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white/95">Arena do Grupo</h1>
          <p className="text-white/60 text-sm">
            {isOffline ? "Arena offline (exibindo dados locais)" : "Disputa sonora entre os amigos"}
          </p>
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
          <button onClick={() => fetchGroupLive()} className="h-10 w-10 glass rounded-2xl flex items-center justify-center">
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
                           <SmartImage 
                             src={coreUtils.getUserAvatar(u.id)} 
                             className="h-full w-full" 
                             fallback={u.name}
                             rounded="full" 
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

      {/* Rivalidade da Semana */}
      {rival && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-red-500/10 via-orange-500/[0.08] to-amber-500/10 border border-orange-500/15 p-6 flex flex-col items-center justify-between gap-4 shadow-2xl"
        >
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center -space-x-4">
              <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-orange-500 bg-black/40 shadow-xl p-0.5">
                <SmartImage 
                  src={coreUtils.getUserAvatar(featuredUserId, members.find(m => m.id === featuredUserId)?.avatar)} 
                  className="h-full w-full" 
                  fallback={members.find(m => m.id === featuredUserId)?.name || ""} 
                  rounded="full" 
                />
              </div>
              <div className="z-10 h-10 w-10 rounded-full flex items-center justify-center bg-[#111] border border-orange-500/30 shadow-md">
                <span className="text-xs font-black text-white/80">VS</span>
              </div>
              <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-orange-500 bg-black/40 shadow-xl p-0.5">
                <SmartImage 
                  src={coreUtils.getUserAvatar(rival.id, rival.avatar)} 
                  className="h-full w-full" 
                  fallback={rival.name || ""} 
                  rounded="full" 
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black tracking-[0.2em] text-orange-400 uppercase">⚔️ Rivalidade da Semana</span>
              <h3 className="text-sm font-extrabold text-white leading-tight">
                {featuredIsAhead ? (
                  <>Você está na frente de <span className="font-black text-orange-400">{rival.name?.toUpperCase()}</span></>
                ) : (
                  <><span className="font-black text-orange-400">{rival.name?.toUpperCase()}</span> está na frente de você</>
                )}
              </h3>
              <p className="text-xs text-white/60 font-medium">
                Diferença de <span className="text-white font-extrabold">{diffStreams} streams</span> e <span className="text-white font-extrabold">{coreUtils.formatDuration(diffDurationMs)}</span> de audição.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setBattleOpponent(rival)}
            className="shrink-0 px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
          >
            Ver batalha →
          </button>
        </motion.div>
      )}

      {/* Podium Effect (First Place Spotlight) and main ranking list */}
      {sortedUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white/[0.02] border border-white/5 rounded-[40px] gap-4 my-4">
          <div className="h-14 w-14 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400">
             <Trophy className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1.5 max-w-sm">
             <p className="text-sm font-extrabold text-white/90">
               Ninguém pontuou ainda!
             </p>
             <p className="text-xs text-white/50 leading-relaxed font-medium">
               Ainda não há reproduções registradas de nenhum integrante do grupo para o período de <span className="text-orange-400 font-bold">{ranges.find(r => r.id === activeRange)?.label}</span>.
             </p>
          </div>
          <p className="text-[10px] text-white/30 italic">
             Abra o Spotify ou seu player favorito para pontuar agora mesmo!
          </p>
        </div>
      ) : (
        <>
          {sortedUsers.length > 0 && (
            <motion.div
              key={`leader-${activeRange}-${sortVersion}`}
              ref={podiumRef}
              initial={{ opacity: 0, rotateY: -180, scale: 0.8 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              transition={{ duration: 0.8, type: 'spring', bounce: 0.3 }}
              onClick={() => setSelectedUser(sortedUsers[0])}
              className="relative overflow-hidden rounded-[40px] bg-[#0A0A0A] border border-white/5 p-8 flex flex-col items-center text-center active:scale-[0.98] transition-transform cursor-pointer group/podium"
              style={{ perspective: '1000px' }}
            >
              <div 
                className="absolute -top-10 -left-10 h-32 w-32 blur-[60px] opacity-20" 
                style={{ backgroundColor: sortedUsers[0].id === LEO_ID ? ({id: "leo", name: "Leo", color: "#FF9F0A"}).color : '#ffd700' }}
              />

              <ShareButton 
                targetRef={podiumRef} 
                variant="minimal" 
                title={`🏆 Líder do Grupo: ${sortedUsers[0].name}`}
                className="absolute top-4 right-4 z-20 opacity-0 group-hover/podium:opacity-100 transition-opacity"
              />
              
              <div className="relative mb-4">
                 <div 
                    className="h-24 w-24 rounded-full border border-white/10 overflow-hidden p-1 shadow-2xl"
                    style={{ borderColor: sortedUsers[0].id === LEO_ID ? ({id: "leo", name: "Leo", color: "#FF9F0A"}).color : '#ffd700' }}
                 >
                    <SmartImage src={sortedUsers[0].avatar} className="h-full w-full" fallback="" rounded="full" />
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
            icon={<Trophy className="h-4 w-4 text-orange-500" />}
            action={<TrendingUp className="h-4 w-4 text-white/20" />}
          />

          <motion.section 
            layout
            className="flex flex-col gap-4 [perspective:1200px]"
          >
            {sortedUsers.map((user, i) => {
              const isLeo = user.id === LEO_ID;
              const prevRank = prevRankings.current[user.id];
              const trend = prevRank !== undefined ? prevRank - i : 0;

              return (
                <RankingCard
                  key={user.id}
                  user={user}
                  i={i}
                  index={i}
                  rankingType={rankingType}
                  sortVersion={sortVersion}
                  isLeo={isLeo}
                  trend={trend}
                  onClick={() => setSelectedUser(user)}
                />
              );
            })}
          </motion.section>
        </>
      )}

      {groupStats && (
        <div className="mt-6 flex flex-col gap-4">
          <SectionHeader 
            title="Arena Battle (Global)" 
            icon={<Swords className="h-4 w-4 text-orange-500" />}
            action={<Swords className="h-4 w-4 text-white/20" />} 
          />
          <GlobalStatsComparer members={members} />
        </div>
      )}

      {groupStats && (
        <div className="mt-4 flex flex-col gap-4">
          <MonthlyGroupLeaderboard users={members} type="month" />
        </div>
      )}

      {/* Meta Coletiva Oculta */}
    </div>
  );
}
