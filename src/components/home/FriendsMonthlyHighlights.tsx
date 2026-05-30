/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { statsService, type ReplayPeriodQuery } from '../../services/statsService';
import { getReplayFilterLabel, type ReplayFilterPeriod, type ReplaySelectedSubValues } from './replayUtils';
import { TopItem } from '../../types/stats';
import { SectionHeader, ShimmerOverlay, Skeleton } from '../shared/CommonUI';
import { getVisibleMembers } from '../../lib/memberSelectors';
import { CircleTopOrbit } from './CircleTopOrbit';

export const FriendsMonthlyHighlights = React.memo(({
  periodQuery,
  activeTab = 'month',
  selectedSubValues = {}
}: {
  periodQuery?: ReplayPeriodQuery;
  activeTab?: ReplayFilterPeriod;
  selectedSubValues?: ReplaySelectedSubValues;
}) => {
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const [periodTops, setPeriodTops] = useState<Record<string, { artists: TopItem[]; tracks: TopItem[]; albums: TopItem[] }>>({});

  const isWaitingForGroup = !groupStats;
  const visibleMembers = React.useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);

  // Stabilize periodQuery to prevent loops
  const stablePeriodQuery = React.useMemo(() => periodQuery, [
    periodQuery?.period,
    periodQuery?.after,
    periodQuery?.before,
    periodQuery?.limit,
    periodQuery?.force
  ]);

  useEffect(() => {
    if (!stablePeriodQuery || visibleMembers.length === 0) return;
    let cancelled = false;
    Promise.allSettled(visibleMembers.map(async (member) => {
      const [artists, tracks, albums] = await Promise.all([
        statsService.getTopItems(member.id, 'artists', { ...stablePeriodQuery, limit: 1 }).catch(() => []),
        statsService.getTopItems(member.id, 'tracks', { ...stablePeriodQuery, limit: 1 }).catch(() => []),
        statsService.getTopItems(member.id, 'albums', { ...stablePeriodQuery, limit: 1 }).catch(() => [])
      ]);
      return { id: member.id, tops: { artists, tracks, albums } };
    })).then((results) => {
      if (cancelled) return;
      const next: Record<string, { artists: TopItem[]; tracks: TopItem[]; albums: TopItem[] }> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') next[result.value.id] = result.value.tops;
      });
      setPeriodTops(next);
    });
    return () => {
      cancelled = true;
    };
  }, [stablePeriodQuery, visibleMembers]);

  const sortedFriends = React.useMemo(() => [...visibleMembers].sort((a, b) => {
    const aTops = periodTops[a.id] || a.topItems;
    const bTops = periodTops[b.id] || b.topItems;
    const hasA = aTops?.tracks?.[0] || aTops?.artists?.[0] || aTops?.albums?.[0] ? 1 : 0;
    const hasB = bTops?.tracks?.[0] || bTops?.artists?.[0] || bTops?.albums?.[0] ? 1 : 0;
    return hasB - hasA;
  }).filter(f => {
    const tops = periodTops[f.id] || f.topItems;
    return tops?.tracks?.[0] || tops?.artists?.[0] || tops?.albums?.[0];
  }), [visibleMembers, periodTops]);

  const periodLabel = React.useMemo(() => {
    if (activeTab !== 'month') return getReplayFilterLabel(activeTab, selectedSubValues);

    const monthIndex = Number(selectedSubValues.month ?? new Date().getMonth());
    if (!Number.isFinite(monthIndex)) return getReplayFilterLabel(activeTab, selectedSubValues);

    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, monthIndex, 1));
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  }, [activeTab, selectedSubValues]);

  if (isWaitingForGroup) {
    return (
      <div className="flex flex-col gap-3 mb-3 mt-1">
        <SectionHeader title="TOP 1 DO CÍRCULO" />
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-4 sm:p-5 border-white/5 bg-white/[0.01] relative overflow-hidden"
        >
          <ShimmerOverlay duration={2.8} />
          <div className="flex flex-col divide-y divide-white/5 relative z-10">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <Skeleton className="h-3 w-28 rounded-full" />
                    <Skeleton className="h-2.5 w-20 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (sortedFriends.length === 0) return null;

  return (
    <div className="mb-3 mt-1">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
      >
        <CircleTopOrbit
          members={sortedFriends}
          periodTops={periodTops}
          periodLabel={periodLabel}
        />
      </motion.div>
    </div>
  );
});
