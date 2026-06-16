
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { Award, Trophy, Users, Flame, TrendingUp, TrendingDown, RefreshCcw, AlertTriangle, ChevronDown, Swords, Share2 } from 'lucide-react';
import { clsx } from 'clsx';
import { EnginePulse, EngineSpin, EngineSpinner, SectionHeader, Skeleton, SmartImage } from '../components/shared/CommonUI';
import { GlobalStatsComparer } from '../components/stats/GlobalStatsComparer';
import { GROUP_USERS, coreUtils } from '../services/statsCore';
import { UserStats } from '../types/stats';
import { statsService } from '../services/statsService';
import { ShareButton } from '../components/shared/ShareButton';
import { getVisibleMembers } from '../lib/memberSelectors';
import { useRefreshCooldown } from '../hooks/useRefreshCooldown';
import { LazyModalFallback } from '../components/shared/LazyModalFallback';
import { useMotionRuntime } from '../hooks/useMotionRuntime';
import { motionRuntime as motionRuntimeScheduler } from '../lib/motionRuntime';

const UserDetailModal = lazy(() => import('../components/modals/UserModals').then(module => ({ default: module.UserDetailModal })));
const StatsBattleModal = lazy(() => import('../components/modals/UserModals').then(module => ({ default: module.StatsBattleModal })));

const isCanceledRequest = (error: any) => error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED';

const RankingCard = ({ user, i, rankingType, isLeo, onClick, trend }: any) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  return (
    <motion.div
      ref={cardRef}
      key={user.id}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.2, delay: Math.min(i, 4) * 0.025, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={clsx(
        "relative flex items-center justify-between rounded-[28px] p-5 transition-[background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.98] cursor-pointer group/card",
        isLeo ? "glass premium-gradient border-orange-500/20 shadow-orange-500/5 shadow-2xl" : "bg-white/[0.02] border border-white/[0.05]"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <div 
            className={clsx(
              "ranking-badge flex h-11 w-11 items-center justify-center rounded-2xl text-[15px] font-black italic shadow-inner border transition-[background-color,border-color,box-shadow,color,transform] duration-500",
              trend > 0 
                ? "bg-green-500/10 border-green-400/60 text-green-400 shadow-[0_0_18px_rgba(74,222,128,0.24)]"
                : trend < 0
                  ? "bg-red-500/10 border-red-400/40 text-red-400"
                  : "bg-white/5 border-white/5 text-white/90"
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
                 {user.streamsToday > 30 ? (
                   <EnginePulse active className="h-1.5 w-1.5 rounded-full bg-orange-500" duration={1.8} />
                 ) : (
                   <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                 )}
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

interface RankingScreenProps {
  embedded?: boolean;
}

export default function RankingScreen({ embedded = false }: RankingScreenProps) {
  const groupStats = useStatsStore(state => state.groupStats);
  const isGlobalLoading = useStatsStore(state => state.isLoading);
  const isOffline = useStatsStore(state => state.isOffline);
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const fetchGroupLive = useStatsStore(state => state.fetchGroupLive);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const setFeaturedUserId = useStatsStore(state => state.setFeaturedUserId);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const { executeWithCooldown } = useRefreshCooldown(2000);
  const motionRuntime = useMotionRuntime();
  const [activeRange, setActiveRange] = useState<Range>('months');
  const [rankingType, setRankingType] = useState<'streams' | 'duration'>('streams');
  const [rankingsData, setRankingsData] = useState<Record<string, { count: number, durationMs: number }>>({});
  const [weeklyRankings, setWeeklyRankings] = useState<Record<string, { count: number, durationMs: number }>>({});
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [battleOpponent, setBattleOpponent] = useState<UserStats | null>(null);
  const [showGlobalComparer, setShowGlobalComparer] = useState(false);
  const LEO_ID = "leo";
  const podiumRef = useRef<HTMLDivElement>(null);
  
  const prevRankings = useRef<Record<string, number>>({});
  const members = useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);
  const featuredUser = useMemo(
    () => members.find(m => m.id === featuredUserId) || members[0] || null,
    [members, featuredUserId]
  );
  const effectiveFeaturedUserId = featuredUser?.id || featuredUserId || '';
  const shouldAnimateSelector = motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve';
  
  useEffect(() => {
    let cancelled = false;
    async function loadWeeklyRankings() {
      try {
        const data = await statsService.getRankings('weeks');
        if (cancelled) return;
        setWeeklyRankings(data);
      } catch (e: any) {
        if (cancelled || isCanceledRequest(e)) return;
        console.error("Failed to load weekly rankings", e);
      }
    }
    loadWeeklyRankings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadRankings() {
      setIsLocalLoading(true);
      setErrorLocal(null);
      try {
        const data = await statsService.getRankings(activeRange);
        if (cancelled) return;
        setRankingsData(data);
      } catch (e: any) {
        if (cancelled || isCanceledRequest(e)) return;
        console.error("Failed to load rankings", e);
        setErrorLocal("Não foi possível carregar o ranking. Tente novamente mais tarde.");
      } finally {
        if (!cancelled) setIsLocalLoading(false);
      }
    }
    loadRankings();
    return () => {
      cancelled = true;
    };
  }, [activeRange, refreshNonce]);

  // Prioriza os dados do ranking específico se disponível
  const displayUsers = useMemo(() => members.map(user => {
    const stats: any = rankingsData[user.id] || {};
    return {
      ...user,
      displayCount: stats.count || 0,
      displayDuration: stats.durationMs || 0
    };
  }), [members, rankingsData]);

  const sortedUsers = useMemo(() => {
    return [...displayUsers]
      .filter(u => rankingType === 'streams' ? u.displayCount > 0 : u.displayDuration > 0)
      .sort((a, b) => {
        if (rankingType === 'streams') return b.displayCount - a.displayCount;
        return b.displayDuration - a.displayDuration;
      });
  }, [displayUsers, rankingType]);

  // Rivalidade da Semana
  const weeklyUsers = useMemo(() => members.map(user => {
    const stats: any = weeklyRankings[user.id] || {};
    return {
      ...user,
      displayCount: stats.count || 0,
      displayDuration: stats.durationMs || 0
    };
  }), [members, weeklyRankings]);

  const sortedWeeklyUsers = useMemo(
    () => [...weeklyUsers].sort((a, b) => b.displayCount - a.displayCount),
    [weeklyUsers]
  );

  const rivalry = useMemo(() => {
    const featuredIndex = sortedWeeklyUsers.findIndex(u => u.id === effectiveFeaturedUserId);
    let rival: any = null;
    let featuredIsAhead = false;
    let diffStreams = 0;
    let diffDurationMs = 0;

    if (featuredIndex !== -1 && sortedWeeklyUsers.length > 1) {
      const weeklyFeaturedUser = sortedWeeklyUsers[featuredIndex];
      if (featuredIndex === 0) {
        rival = sortedWeeklyUsers[1];
      } else if (featuredIndex === sortedWeeklyUsers.length - 1) {
        rival = sortedWeeklyUsers[featuredIndex - 1];
      } else {
        const neighborAbove = sortedWeeklyUsers[featuredIndex - 1];
        const neighborBelow = sortedWeeklyUsers[featuredIndex + 1];
        const diffAbove = Math.abs(neighborAbove.displayCount - weeklyFeaturedUser.displayCount);
        const diffBelow = Math.abs(neighborBelow.displayCount - weeklyFeaturedUser.displayCount);
        rival = diffAbove <= diffBelow ? neighborAbove : neighborBelow;
      }

      if (rival) {
        featuredIsAhead = weeklyFeaturedUser.displayCount >= rival.displayCount;
        diffStreams = Math.abs(weeklyFeaturedUser.displayCount - rival.displayCount);
        diffDurationMs = Math.abs(weeklyFeaturedUser.displayDuration - rival.displayDuration);
      }
    }

    return { rival, featuredIsAhead, diffStreams, diffDurationMs };
  }, [sortedWeeklyUsers, effectiveFeaturedUserId]);
  const { rival, featuredIsAhead, diffStreams, diffDurationMs } = rivalry;

  // Track rank changes
  useEffect(() => {
    const newRankings: Record<string, number> = {};
    sortedUsers.forEach((user, idx) => {
      newRankings[user.id] = idx;
    });
    
    // We update the ref after a delay to maintain the "up" state for visuals during this session
    // Or we update it immediately if we want to reset trends on every data refresh
    const cancelTask = motionRuntimeScheduler.scheduleTask(() => {
      prevRankings.current = newRankings;
    }, 5000, 'interaction'); // Keep the trend visible for 5s after a change
    
    return () => cancelTask();
  }, [sortedUsers]);

  if (errorLocal) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4 text-center">
        <AlertTriangle className="h-12 w-12 text-orange-500" />
        <p className="text-white/60">{errorLocal}</p>
        <button 
          onClick={() => setRefreshNonce(n => n + 1)}
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
        <button
          onClick={executeWithCooldown(() => fetchGroup(true))}
          className="px-4 py-2 bg-white/10 rounded-xl text-white text-sm"
        >
          Sincronizar
        </button>
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
    <div className={clsx("flex flex-col px-4", embedded ? "gap-4 pb-2" : "gap-6 pb-32")}>
      <Suspense fallback={<LazyModalFallback />}>
        <AnimatePresence>
          {selectedUser && (
            <UserDetailModal 
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
            />
          )}
          {battleOpponent && (
            featuredUser ? (
              <StatsBattleModal
                userA={featuredUser}
                userB={battleOpponent}
                onClose={() => setBattleOpponent(null)}
              />
            ) : null
          )}
        </AnimatePresence>
      </Suspense>

      <header className={clsx("relative flex items-start", embedded ? "justify-end" : "justify-between px-1")}>
        {!embedded && (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white/95">Arena do Grupo</h1>
            <p className="text-white/60 text-sm">
              {isOffline ? "Arena offline (exibindo dados locais)" : "Disputa sonora entre os amigos"}
            </p>
          </div>
        )}
        <div className="flex gap-2 relative">
          <button 
                type="button"
                aria-label="Focar perfil"
                aria-expanded={showUserSelector}
                onClick={() => setShowUserSelector(!showUserSelector)} 
                className={clsx(
                  "h-10 w-10 glass rounded-2xl flex items-center justify-center transition-[background-color,border-color,transform] duration-200 active:scale-[0.96]",
                  showUserSelector && "bg-white/20 border-white/20"
                )}
              >
                 <Users className="h-4 w-4 text-white/40" />
          </button>
          <button onClick={executeWithCooldown(() => fetchGroupLive())} className="h-10 w-10 glass rounded-2xl flex items-center justify-center">
             <EngineSpinner active={isGlobalLoading || isLocalLoading} className="h-4 w-4 text-white/50">
               <RefreshCcw className="h-full w-full" />
             </EngineSpinner>
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
                    {members.map((u, index) => (
                      <motion.button
                        key={u.id}
                        type="button"
                        initial={shouldAnimateSelector ? { opacity: 0, y: 6, scale: 0.985 } : false}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldAnimateSelector ? { opacity: 0, y: -3, scale: 0.99 } : undefined}
                        transition={{
                          duration: shouldAnimateSelector ? 0.18 : 0.01,
                          delay: shouldAnimateSelector ? Math.min(index, 5) * 0.024 : 0,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        onClick={() => {
                          setFeaturedUserId(u.id);
                          // setShowUserSelector(false);
                        }}
                        className={clsx(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98]",
                          effectiveFeaturedUserId === u.id
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
                           {effectiveFeaturedUserId === u.id && (
                             <div className="absolute inset-0 bg-orange-500/20" />
                           )}
                        </div>
                        <span className={clsx(
                          "text-xs font-medium transition-colors",
                          effectiveFeaturedUserId === u.id ? "text-white" : "text-white/60"
                        )}>
                          {u.name}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Range Selector */}
      <div className="stats-lc-glass-popover flex w-full max-w-full min-w-0 gap-1 rounded-3xl p-1">
        {ranges.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActiveRange(r.id)}
            aria-current={activeRange === r.id ? 'page' : undefined}
            aria-pressed={activeRange === r.id}
            className={clsx(
              "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-2xl px-1.5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.96]",
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
      <div className="stats-lc-glass-popover flex w-full max-w-full min-w-0 gap-1.5 overflow-x-auto rounded-3xl p-1 no-scrollbar sm:self-start sm:w-auto">
        <button
          type="button"
          onClick={() => setRankingType('streams')}
          aria-pressed={rankingType === 'streams'}
          className={clsx(
            "flex min-h-11 shrink-0 items-center justify-center rounded-2xl px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.96]",
            rankingType === 'streams' 
              ? "bg-orange-500/20 text-orange-500 border border-orange-500/20" 
              : "text-white/30 hover:text-white/60"
          )}
        >
          Mais Tocadas
        </button>
        <button
          type="button"
          onClick={() => setRankingType('duration')}
          aria-pressed={rankingType === 'duration'}
          className={clsx(
            "flex min-h-11 shrink-0 items-center justify-center rounded-2xl px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.96]",
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
                  src={coreUtils.getUserAvatar(effectiveFeaturedUserId, featuredUser?.avatar)}
                  className="h-full w-full"
                  fallback={featuredUser?.name || ""}
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
                Diferença de <span className="text-white font-extrabold">{coreUtils.formatNumber(diffStreams)} streams</span> e <span className="text-white font-extrabold">{coreUtils.formatDuration(diffDurationMs)}</span> de audição.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setBattleOpponent(rival)}
            className="shrink-0 px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-[background-color,box-shadow,transform] duration-200 cursor-pointer"
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
              key={`leader-${activeRange}-${rankingType}`}
              ref={podiumRef}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setSelectedUser(sortedUsers[0])}
              className="relative overflow-hidden rounded-[40px] bg-[#0A0A0A] border border-white/5 p-8 flex flex-col items-center text-center active:scale-[0.98] transition-transform cursor-pointer group/podium"
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
                 <EngineSpin
                   active
                   duration={15}
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

          <motion.section className="flex flex-col gap-4">
            {sortedUsers.map((user, i) => {
              const isLeo = user.id === LEO_ID;
              const prevRank = prevRankings.current[user.id];
              const trend = prevRank !== undefined ? prevRank - i : 0;

              return (
                <RankingCard
                  key={user.id}
                  user={user}
                  i={i}
                  rankingType={rankingType}
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
        <div className="mt-3 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowGlobalComparer((current) => !current)}
            className="flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/[0.025] px-4 py-3 text-left transition-[background-color,transform] duration-200 active:scale-[0.985]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
                <Swords className="h-4 w-4 text-orange-300" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/78">Arena Battle</span>
                <span className="mt-0.5 block text-[11px] font-medium text-white/40">Comparar artistas e stats do grupo sob demanda</span>
              </span>
            </span>
            <ChevronDown className={clsx("h-4 w-4 shrink-0 text-white/35 transition-transform duration-200", showGlobalComparer && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showGlobalComparer && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <GlobalStatsComparer members={members} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Meta Coletiva Oculta */}
    </div>
  );
}
