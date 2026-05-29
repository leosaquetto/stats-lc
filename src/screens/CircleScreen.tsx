/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, HeartHandshake, Loader2, Swords, Trophy } from 'lucide-react';
import { clsx } from 'clsx';
import RankingScreen from './RankingScreen';
import AlikeScreen from './AlikeScreen';
import { SmartImage } from '../components/shared/CommonUI';
import { coreUtils } from '../services/statsCore';
import { statsService } from '../services/statsService';
import { useStatsStore } from '../store/useStatsStore';
import { getVisibleMembers } from '../lib/memberSelectors';

type CircleTab = 'ranking' | 'duels' | 'affinity';

interface CircleScreenProps {
  initialTab?: CircleTab;
}

const tabs: Array<{ id: CircleTab; label: string; icon: typeof Trophy }> = [
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'duels', label: 'Duelos', icon: Swords },
  { id: 'affinity', label: 'Afinidade', icon: HeartHandshake },
];

function DuelsSection() {
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const members = useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);
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

export default function CircleScreen({ initialTab = 'ranking' }: CircleScreenProps) {
  const [activeTab, setActiveTab] = useState<CircleTab>(initialTab);

  return (
    <div className="flex flex-col gap-5">
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

      {activeTab === 'ranking' && <RankingScreen />}
      {activeTab === 'affinity' && <AlikeScreen />}
      {activeTab === 'duels' && <DuelsSection />}
    </div>
  );
}
