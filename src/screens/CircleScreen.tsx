/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, HeartHandshake, Loader2, Swords, Trophy, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { LiveGroupOverview, LiveGroupOverviewSkeleton } from '../components/home/HomeHighlights';
import { FriendHistoryCard } from '../components/history/FriendHistoryCard';
import { SectionHeader, ShimmerOverlay, SmartImage } from '../components/shared/CommonUI';
import { coreUtils } from '../services/statsCore';
import { statsService } from '../services/statsService';
import { useStatsStore } from '../store/useStatsStore';
import { getCanonicalMembersWithLive, getVisibleMembersWithLive } from '../lib/memberSelectors';

const loadRankingScreen = () => import('./RankingScreen');
const loadAlikeScreen = () => import('./AlikeScreen');
const loadUserHistoryModal = () => import('../components/modals/UserHistoryModal').then(module => ({ default: module.UserHistoryModal }));
const loadTrackHistoryModal = () => import('../components/modals/TrackHistoryModal').then(module => ({ default: module.TrackHistoryModal }));

export const preloadCircleSections = () => Promise.allSettled([
  loadRankingScreen(),
  loadAlikeScreen(),
  loadUserHistoryModal(),
  loadTrackHistoryModal(),
]);

const RankingScreen = lazy(loadRankingScreen);
const AlikeScreen = lazy(loadAlikeScreen);
const UserHistoryModal = lazy(loadUserHistoryModal);
const TrackHistoryModal = lazy(loadTrackHistoryModal);

type CircleTab = 'ranking' | 'duels' | 'affinity';

interface CircleScreenProps {
  initialTab?: CircleTab;
}

const tabs: Array<{ id: CircleTab; label: string; icon: typeof Trophy }> = [
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'duels', label: 'Duelos', icon: Swords },
  { id: 'affinity', label: 'Afinidade', icon: HeartHandshake },
];

const CircleTabLoader = ({ label }: { label: string }) => (
  <div className="mx-4 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[28px] border border-white/5 bg-white/[0.02] px-6 text-center">
    <Loader2 className="h-6 w-6 animate-spin text-orange-400/80" />
    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{label}</p>
  </div>
);

function DuelsSection() {
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const members = useMemo(() => getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId), [groupStats, hiddenUsers, liveNowPlayingByUserId]);
  const [weeklyRankings, setWeeklyRankings] = useState<Record<string, { count: number; durationMs: number }>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    statsService.getRankings('weeks')
      .then((data) => {
        if (cancelled) return;
        setWeeklyRankings(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [members.length]);

  const duels = useMemo(() => {
    const ranked = members
      .map((member) => {
        const stats = weeklyRankings[member.id];
        return {
          ...member,
          displayCount: stats?.count ?? member.streamsWeek ?? 0,
          displayDuration: stats?.durationMs ?? 0,
        };
      })
      .filter((member) => member.displayCount > 0 || member.displayDuration > 0)
      .sort((a, b) => b.displayCount - a.displayCount);

    const pairs: Array<{ leader: any; challenger: any; diffStreams: number; diffDurationMs: number }> = [];
    for (let index = 0; index < ranked.length - 1 && pairs.length < 3; index += 1) {
      const leader = ranked[index];
      const challenger = ranked[index + 1];
      pairs.push({
        leader,
        challenger,
        diffStreams: Math.abs((leader.displayCount || 0) - (challenger.displayCount || 0)),
        diffDurationMs: Math.abs((leader.displayDuration || 0) - (challenger.displayDuration || 0)),
      });
    }

    return pairs;
  }, [members, weeklyRankings]);

  if (status === 'loading' && duels.length === 0) {
    return (
      <div className="mx-4 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[28px] border border-white/5 bg-white/[0.02] px-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-400/80" />
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Montando duelos</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-4 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[28px] border border-orange-500/15 bg-orange-500/[0.04] px-6 text-center">
        <AlertTriangle className="h-6 w-6 text-orange-400" />
        <p className="max-w-xs text-xs font-medium leading-relaxed text-white/50">
          Nao foi possivel atualizar os duelos da semana agora.
        </p>
      </div>
    );
  }

  if (duels.length === 0) {
    return (
      <div className="mx-4 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[28px] border border-white/5 bg-white/[0.02] px-6 text-center">
        <Swords className="h-7 w-7 text-orange-400/70" />
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-white/80">Sem duelos ativos</h2>
          <p className="max-w-xs text-xs font-medium leading-relaxed text-white/45">
            Assim que dois membros pontuarem na semana, a Arena monta os confrontos automaticamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-4 flex flex-col gap-4 pb-28">
      <div className="px-1">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">Duelos da Semana</h2>
        <p className="mt-1 text-xs font-medium leading-relaxed text-white/42">
          Confrontos montados a partir do ranking semanal atual.
        </p>
      </div>

      {duels.map((duel, index) => {
        const total = Math.max(duel.leader.displayCount + duel.challenger.displayCount, 1);
        const leaderShare = Math.max(8, Math.min(92, Math.round((duel.leader.displayCount / total) * 100)));

        return (
          <motion.article
            key={`${duel.leader.id}-${duel.challenger.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="rounded-[28px] border border-white/5 bg-white/[0.025] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]"
          >
            <div className="flex items-center justify-between gap-4">
              {[duel.leader, duel.challenger].map((user, userIndex) => (
                <div key={user.id} className={clsx("flex min-w-0 flex-1 items-center gap-3", userIndex === 1 && "flex-row-reverse text-right")}>
                  <SmartImage
                    src={coreUtils.getUserAvatar(user.id, user.avatar)}
                    className="h-12 w-12 shrink-0 rounded-full border border-white/10"
                    fallback={user.name}
                    rounded="full"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white/90">{user.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/32">
                      {coreUtils.formatNumber(user.displayCount)} streams
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="my-4 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-orange-500" style={{ width: `${leaderShare}%` }} />
              </div>
              <span className="text-[9px] font-black text-orange-400">VS</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="ml-auto h-full rounded-full bg-white/35" style={{ width: `${100 - leaderShare}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-4 py-3">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Diferença</span>
              <span className="text-xs font-black text-white/80">
                {coreUtils.formatNumber(duel.diffStreams)} streams
                {duel.diffDurationMs > 0 ? ` · ${coreUtils.formatDuration(duel.diffDurationMs)}` : ''}
              </span>
            </div>
          </motion.article>
        );
      })}
    </section>
  );
}

function OrbitOverviewSection() {
  const groupStats = useStatsStore(state => state.groupStats);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const isLoading = useStatsStore(state => state.isLoading);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const historyOrder = useStatsStore(state => state.historyOrder);
  const historyCustomOrder = useStatsStore(state => state.historyCustomOrder);
  const members = useMemo(() => getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId), [groupStats, hiddenUsers, liveNowPlayingByUserId]);
  const arenaMembers = useMemo(() => getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId), [groupStats, liveNowPlayingByUserId]);
  const [visibleHistory, setVisibleHistory] = useState(5);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [selectedTrackHistory, setSelectedTrackHistory] = useState<any>(null);
  const [viewingFullHistoryUser, setViewingFullHistoryUser] = useState<any>(null);

  const recentTracks = useMemo(() => {
    if (!Array.isArray(members)) return [];
    return [...members]
      .filter(user => user && user.id)
      .sort((a, b) => {
        if (a.id === featuredUserId) return -1;
        if (b.id === featuredUserId) return 1;

        const order = historyOrder || 'lastPlayed';
        if (order === 'alphabetical') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (order === 'custom') {
          const customOrder = historyCustomOrder || [];
          const indexA = customOrder.indexOf(a.id);
          const indexB = customOrder.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        }

        const timeA = new Date(a.nowPlaying?.timestamp || 0).getTime();
        const timeB = new Date(b.nowPlaying?.timestamp || 0).getTime();
        return timeB - timeA;
      });
  }, [featuredUserId, historyCustomOrder, historyOrder, members]);

  return (
    <>
      <Suspense fallback={null}>
        {viewingFullHistoryUser && (
          <UserHistoryModal
            user={viewingFullHistoryUser}
            onClose={() => setViewingFullHistoryUser(null)}
            onTrackClick={(track) => setSelectedTrackHistory(track)}
            groupStats={groupStats}
          />
        )}
        {selectedTrackHistory && (
          <TrackHistoryModal
            track={selectedTrackHistory}
            onClose={() => setSelectedTrackHistory(null)}
          />
        )}
      </Suspense>

      {groupStats ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="px-4 sm:px-6 lg:px-8"
        >
          <div className="custom-scrollbar">
            <LiveGroupOverview
              users={arenaMembers}
              lastUpdate={groupStats.lastUpdated}
            />
          </div>
        </motion.div>
      ) : isLoading ? (
        <div className="px-4 sm:px-6 lg:px-8">
          <LiveGroupOverviewSkeleton />
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8 -mt-2"
      >
        <SectionHeader title="Timeline da Sessão" />
      </motion.div>

      <div className="flex flex-col gap-2 custom-scrollbar h-auto overflow-hidden px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          [1, 2, 3, 4, 5].map(i => (
            <motion.div
              key={`orbit-hist-skeleton-${i}`}
              initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col"
            >
              <div className="flex items-center justify-between p-3.5 rounded-[28px] glass border-white/10 relative overflow-hidden bg-white/[0.01]">
                <ShimmerOverlay duration={3} />
                <div className="flex items-center gap-3.5 min-w-0 z-10 w-full relative">
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-full bg-white/5 border border-white/5 shadow-inner" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="h-3 w-32 bg-white/10 rounded-full" />
                    <div className="h-2 w-20 bg-white/5 rounded-full" />
                  </div>
                </div>
                <div className="h-3 w-8 bg-white/10 rounded-full shrink-0 mr-1 relative z-10" />
              </div>
            </motion.div>
          ))
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {recentTracks.slice(0, visibleHistory).map((user, idx) => (
              <motion.div
                layout
                key={user.id || `orbit-hist-${idx}`}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{
                  opacity: { duration: 0.2 },
                  layout: { type: "spring", stiffness: 350, damping: 35 }
                }}
              >
                <FriendHistoryCard
                  user={user}
                  index={idx}
                  onTrackClick={setSelectedTrackHistory}
                  onFullHistoryClick={(userStats) => setViewingFullHistoryUser(userStats)}
                  showFullHistoryButton={timelineExpanded}
                  showInlineHistory
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!isLoading && recentTracks.length > visibleHistory && (
          <button
            type="button"
            onClick={() => {
              setTimelineExpanded(true);
              setVisibleHistory(recentTracks.length);
            }}
            className="w-full mt-2 mb-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white/80 glass rounded-[28px] border border-white/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 group"
          >
            <Users className="h-3.5 w-3.5 text-orange-500/50 group-hover:text-orange-500 transition-colors" />
            <span>Expandir todos</span>
          </button>
        )}
      </div>
    </>
  );
}

export default function CircleScreen({ initialTab = 'ranking' }: CircleScreenProps) {
  const [activeTab, setActiveTab] = useState<CircleTab>(initialTab);

  return (
    <div className="flex flex-col gap-5">
      <OrbitOverviewSection />

      <div className="px-4">
        <div className="flex gap-2 rounded-3xl bg-white/[0.03] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all",
                  isActive ? "text-orange-400" : "text-white/35 hover:text-white/60"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="circle-active-tab"
                    className="absolute inset-0 rounded-2xl border border-orange-500/20 bg-orange-500/10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                  />
                )}
                <Icon className="relative h-3.5 w-3.5" />
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'ranking' && (
        <Suspense fallback={<CircleTabLoader label="Carregando ranking" />}>
          <RankingScreen />
        </Suspense>
      )}
      {activeTab === 'affinity' && (
        <Suspense fallback={<CircleTabLoader label="Carregando afinidade" />}>
          <AlikeScreen />
        </Suspense>
      )}
      {activeTab === 'duels' && <DuelsSection />}
    </div>
  );
}
