/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Clock3, Flame, HeartHandshake, Headphones, Inbox, Loader2, Orbit, Radio, Send, Swords, Trophy, Users, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocation, useNavigate } from 'react-router-dom';
import { LiveGroupOverview, LiveGroupOverviewSkeleton } from '../components/home/HomeHighlights';
import { FriendHistoryCard } from '../components/history/FriendHistoryCard';
import { OrbitsSection } from '../components/circle/OrbitsSection';
import { SectionHeader, ShimmerOverlay, SmartImage } from '../components/shared/CommonUI';
import { coreUtils } from '../services/statsCore';
import { statsService } from '../services/statsService';
import { orbitService, type OrbitSummary } from '../services/orbitService';
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

export type CircleTab = 'now' | 'orbits' | 'arena' | 'duels' | 'affinity';

interface CircleScreenProps {
  initialTab?: CircleTab;
}

const tabs: Array<{ id: CircleTab; label: string; icon: typeof Trophy }> = [
  { id: 'now', label: 'Agora', icon: Radio },
  { id: 'orbits', label: 'Orbits', icon: Orbit },
  { id: 'arena', label: 'Arena', icon: Trophy },
  { id: 'duels', label: 'Duelos', icon: Swords },
  { id: 'affinity', label: 'Afinidade', icon: HeartHandshake },
];

const validTabs = new Set<CircleTab>(tabs.map((tab) => tab.id));
const emptyOrbitSummary: OrbitSummary = { received: 0, sent: 0, sentListened: 0, unread: 0 };
const defaultOrbitUserId = 'leo';

const getFirstName = (name?: string) => (name || 'amigo').split(' ')[0];
const getNowTimestamp = (user: any) => new Date(user?.nowPlaying?.timestamp || 0).getTime();
const isLiveUser = (user: any) => user?.nowPlaying?.isNow === true && Date.now() - getNowTimestamp(user) < 10 * 60 * 1000;
const getNowTrackName = (user: any) => user?.nowPlaying?.track?.name || 'Sem faixa recente';
const getNowArtistName = (user: any) => {
  const artists = user?.nowPlaying?.track?.artists;
  const first = Array.isArray(artists) ? artists[0] : null;
  return typeof first === 'string' ? first : first?.name || user?.nowPlaying?.track?.primaryArtistName || 'Artista';
};
const getNowTrackImage = (user: any) => {
  const track = user?.nowPlaying?.track || {};
  return track.image || track.albumImage || track.album?.image || track.album?.images?.[0]?.url || '';
};
const getStreamsToday = (user: any) => Number(user?.streamsToday || user?.stats?.today?.streams || 0);
const getStreamsWeek = (user: any) => Number(user?.streamsWeek || user?.stats?.week?.streams || 0);

const CircleTabLoader = ({ label }: { label: string }) => (
  <div className="mx-4 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[28px] border border-white/5 bg-white/[0.02] px-6 text-center">
    <Loader2 className="h-6 w-6 animate-spin text-orange-400/80" />
    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{label}</p>
  </div>
);

const CircleModalLoader = () => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-sm">
    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#141414]/95 px-5 py-3">
      <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Abrindo detalhes</span>
    </div>
  </div>
);

function OrbitSummaryPreview({ currentUserId, onOpen }: { currentUserId?: string; onOpen: () => void }) {
  const [summary, setSummary] = useState<OrbitSummary>(emptyOrbitSummary);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;
    const controller = new AbortController();
    orbitService.summary(currentUserId, controller.signal)
      .then((nextSummary) => {
        setSummary(nextSummary);
        setAvailable(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false);
      });
    return () => controller.abort();
  }, [currentUserId]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group mx-4 overflow-hidden rounded-[30px] border border-orange-500/15 bg-[radial-gradient(circle_at_12%_18%,rgba(249,115,22,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition-[background-color,transform,border-color] duration-200 active:scale-[0.985]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/[0.12]">
          <Inbox className="h-5 w-5 text-orange-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-200/85">Inbox social</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-white/48">
            {available ? `${summary.received} recebidos · ${summary.unread} novos · ${summary.sentListened} viraram plays` : 'Conectando com a inbox do circulo'}
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-orange-200 transition-transform duration-200 group-active:translate-x-0.5">
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: 'Recebidos', value: summary.received, icon: Inbox },
          { label: 'Enviados', value: summary.sent, icon: Send },
          { label: 'Ouvidos', value: summary.sentListened, icon: Headphones },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-white/6 bg-black/20 px-3 py-2.5">
              <Icon className="mb-1.5 h-3.5 w-3.5 text-orange-300/75" />
              <p className="text-lg font-black leading-none text-white/92">{item.value}</p>
              <p className="mt-1 text-[7px] font-black uppercase tracking-[0.13em] text-white/32">{item.label}</p>
            </div>
          );
        })}
      </div>
    </button>
  );
}

function CircleCockpitHero({ members, featuredUserId, onOpenOrbits }: { members: any[]; featuredUserId?: string; onOpenOrbits: () => void }) {
  const liveMembers = useMemo(() => members.filter(isLiveUser), [members]);
  const recentMembers = useMemo(() => [...members]
    .filter((member) => member?.nowPlaying?.track)
    .sort((a, b) => getNowTimestamp(b) - getNowTimestamp(a))
    .slice(0, 5), [members]);
  const totalToday = useMemo(() => members.reduce((sum, member) => sum + getStreamsToday(member), 0), [members]);
  const weeklyLeader = useMemo(() => [...members].sort((a, b) => getStreamsWeek(b) - getStreamsWeek(a))[0], [members]);
  const featuredUser = useMemo(
    () => members.find((member) => member.id === featuredUserId || member.key === featuredUserId) || members[0],
    [featuredUserId, members]
  );
  const spotlightUser = liveMembers[0] || recentMembers[0] || featuredUser || weeklyLeader;
  const spotlightImage = getNowTrackImage(spotlightUser) || coreUtils.getUserAvatar(spotlightUser?.id || 'leo', spotlightUser?.avatar);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className="mx-4 overflow-hidden rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_18%_12%,rgba(249,115,22,0.18),transparent_34%),radial-gradient(circle_at_86%_8%,rgba(255,255,255,0.12),transparent_24%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.018))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)]"
    >
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <div className="absolute inset-0 rounded-[28px] bg-orange-500/20 blur-2xl" />
          <SmartImage
            src={spotlightImage}
            className="relative h-20 w-20 rounded-[28px] border border-white/10"
            fallback={spotlightUser?.name || 'Orbita'}
            rounded="[28px]"
          />
          <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-2xl border border-orange-300/25 bg-[#18110d] text-orange-300">
            <Orbit className="h-4 w-4" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-orange-200">Órbita</span>
            <span className="rounded-full border border-white/8 bg-white/[0.035] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/40">
              {liveMembers.length} ao vivo
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-black leading-none tracking-[-0.04em] text-white">Pulso do círculo</h1>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-white/48">
            {spotlightUser?.nowPlaying?.track
              ? `${getFirstName(spotlightUser.name)} está em ${getNowTrackName(spotlightUser)} · ${getNowArtistName(spotlightUser)}`
              : 'Arena Live, Orbits e timeline em uma entrada rápida para o que está acontecendo agora.'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { label: 'Hoje', value: coreUtils.formatNumber(totalToday), icon: Zap },
          { label: 'Live', value: `${liveMembers.length}/${members.length || 0}`, icon: Radio },
          { label: 'Líder semana', value: getFirstName(weeklyLeader?.name), icon: Flame },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="min-w-0 rounded-[22px] border border-white/7 bg-black/[0.22] px-3 py-3">
              <Icon className="mb-2 h-4 w-4 text-orange-300/75" />
              <p className="truncate text-base font-black leading-none text-white/92">{item.value}</p>
              <p className="mt-1.5 text-[7px] font-black uppercase tracking-[0.14em] text-white/30">{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 overflow-hidden rounded-[24px] border border-white/6 bg-black/20 p-2">
        <div className="flex -space-x-2">
          {recentMembers.slice(0, 4).map((member) => (
            <SmartImage
              key={member.id}
              src={coreUtils.getUserAvatar(member.id, member.avatar)}
              className="h-8 w-8 rounded-full border border-[#161616]"
              fallback={member.name}
              rounded="full"
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-white/80">
            {recentMembers[0] ? getNowTrackName(recentMembers[0]) : 'Timeline pronta para atualizar'}
          </p>
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-white/32">
            {recentMembers[0] ? `${getFirstName(recentMembers[0].name)} · ${getNowArtistName(recentMembers[0])}` : 'Sem faixa recente carregada'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenOrbits}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-orange-500 px-3 py-2 text-[8px] font-black uppercase tracking-[0.14em] text-white transition-[transform,opacity] duration-200 active:scale-[0.96]"
        >
          Orbits
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.section>
  );
}

function CircleNowRail({ members }: { members: any[] }) {
  const visibleMembers = useMemo(() => [...members]
    .filter((member) => member?.nowPlaying?.track)
    .sort((a, b) => {
      const liveDelta = Number(isLiveUser(b)) - Number(isLiveUser(a));
      if (liveDelta !== 0) return liveDelta;
      return getNowTimestamp(b) - getNowTimestamp(a);
    })
    .slice(0, 8), [members]);

  if (visibleMembers.length === 0) return null;

  return (
    <section className="mx-4 flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/72">Agora no radar</p>
          <p className="mt-1 text-xs font-semibold text-white/38">Faixas recentes com entrada rápida para o histórico.</p>
        </div>
        <Clock3 className="h-4 w-4 text-orange-300/70" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleMembers.map((member) => {
          const live = isLiveUser(member);
          return (
            <article
              key={member.id}
              className="flex w-[210px] shrink-0 items-center gap-3 rounded-[24px] border border-white/7 bg-white/[0.028] p-3 text-left"
            >
              <SmartImage
                src={getNowTrackImage(member)}
                className="h-12 w-12 rounded-[18px] border border-white/8"
                fallback={getNowTrackName(member)}
                rounded="[18px]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={clsx("h-1.5 w-1.5 rounded-full", live ? "bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.85)]" : "bg-white/25")} />
                  <span className="truncate text-[9px] font-black uppercase tracking-[0.13em] text-white/35">{getFirstName(member.name)}</span>
                </span>
                <span className="mt-1 block truncate text-xs font-black text-white/86">{getNowTrackName(member)}</span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/38">{getNowArtistName(member)}</span>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

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
      <div className="overflow-hidden rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_14%_16%,rgba(249,115,22,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-300">
            <Swords className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-200/80">Duelos da Semana</p>
            <h2 className="mt-1 text-xl font-black leading-none tracking-[-0.04em] text-white">placar vivo</h2>
          </div>
          <div className="rounded-full border border-white/8 bg-white/[0.035] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/40">
            {duels.length} cards
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold leading-relaxed text-white/45">
          Confrontos compactos montados pelo ranking semanal atual, prontos para comparar sem virar uma rolagem gigante.
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
            transition={{ delay: index * 0.045, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[30px] border border-white/7 bg-white/[0.026] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)]"
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
                <div
                  className="h-full origin-left rounded-full bg-orange-500"
                  style={{ transform: `scaleX(${leaderShare / 100})` }}
                />
              </div>
              <span className="text-[9px] font-black text-orange-400">VS</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="ml-auto h-full origin-right rounded-full bg-white/35"
                  style={{ transform: `scaleX(${(100 - leaderShare) / 100})` }}
                />
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

function OrbitOverviewSection({ onOpenOrbits }: { onOpenOrbits: () => void }) {
  const groupStats = useStatsStore(state => state.groupStats);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const isLoading = useStatsStore(state => state.isLoading);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const historyOrder = useStatsStore(state => state.historyOrder);
  const historyCustomOrder = useStatsStore(state => state.historyCustomOrder);
  const members = useMemo(() => getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId), [groupStats, hiddenUsers, liveNowPlayingByUserId]);
  const arenaMembers = useMemo(() => getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId), [groupStats, liveNowPlayingByUserId]);
  const orbitUserId = featuredUserId || defaultOrbitUserId;
  const [visibleHistory, setVisibleHistory] = useState(5);
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
      <Suspense fallback={<CircleModalLoader />}>
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

      <CircleCockpitHero
        members={members}
        featuredUserId={featuredUserId}
        onOpenOrbits={onOpenOrbits}
      />

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

      <CircleNowRail members={recentTracks} />

      <OrbitSummaryPreview currentUserId={orbitUserId} onOpen={onOpenOrbits} />

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
                  showFullHistoryButton
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
              setVisibleHistory(recentTracks.length);
            }}
            className="w-full mt-2 mb-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white/80 glass rounded-[28px] border border-white/5 active:scale-[0.98] transition-[color,transform,border-color] duration-200 flex items-center justify-center gap-2.5 group"
          >
            <Users className="h-3.5 w-3.5 text-orange-500/50 group-hover:text-orange-500 transition-colors" />
            <span>Expandir todos</span>
          </button>
        )}
      </div>
    </>
  );
}

function CircleOrbitsTab() {
  const groupStats = useStatsStore(state => state.groupStats);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const members = useMemo(() => getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId), [groupStats, liveNowPlayingByUserId]);
  const currentUserId = featuredUserId || defaultOrbitUserId;

  return <OrbitsSection currentUserId={currentUserId} members={members} />;
}

const getRequestedTab = (search: string, initialTab: CircleTab) => {
  const requested = new URLSearchParams(search).get('tab') as CircleTab | null;
  return requested && validTabs.has(requested) ? requested : initialTab;
};

export default function CircleScreen({ initialTab = 'now' }: CircleScreenProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CircleTab>(() => getRequestedTab(location.search, initialTab));

  useEffect(() => {
    setActiveTab(getRequestedTab(location.search, initialTab));
  }, [initialTab, location.search]);

  const selectTab = (tab: CircleTab) => {
    setActiveTab(tab);
    navigate(`/circle?tab=${tab}`, { replace: true });
  };

  return (
    <div className="relative flex flex-col gap-5 overflow-x-clip">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-500/[0.055] blur-3xl" />
      <div className="sticky top-[max(env(safe-area-inset-top),12px)] z-40 px-4">
        <div className="grid grid-cols-5 gap-1 rounded-3xl border border-white/8 bg-black/72 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[7px] font-black uppercase tracking-[0.1em] transition-[color,transform] duration-200 active:scale-[0.96]",
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

      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-5"
        >
      {activeTab === 'now' && <OrbitOverviewSection onOpenOrbits={() => selectTab('orbits')} />}
      {activeTab === 'orbits' && <CircleOrbitsTab />}
      {activeTab === 'arena' && (
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
