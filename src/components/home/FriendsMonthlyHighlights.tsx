/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { statsService, type ReplayPeriodQuery } from '../../services/statsService';
import { UserStats, TopItem } from '../../types/stats';
import { SmartImage, SectionHeader, ShimmerOverlay, Skeleton } from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Music, Disc, Mic2, ChevronRight } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FriendsMonthlyHighlights = React.memo(({ periodQuery }: { periodQuery?: ReplayPeriodQuery }) => {
  const { groupStats, hiddenUsers } = useStatsStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [periodTops, setPeriodTops] = useState<Record<string, { artists: TopItem[]; tracks: TopItem[]; albums: TopItem[] }>>({});

  const members = groupStats?.members || [];
  const isWaitingForGroup = !groupStats;
  const visibleMembers = React.useMemo(() => members.filter(m => !hiddenUsers.includes(m.id)), [members, hiddenUsers]);

  useEffect(() => {
    if (!periodQuery || visibleMembers.length === 0) return;
    let cancelled = false;
    Promise.allSettled(visibleMembers.map(async (member) => {
      const [artists, tracks, albums] = await Promise.all([
        statsService.getTopItems(member.id, 'artists', { ...periodQuery, limit: 1 }).catch(() => []),
        statsService.getTopItems(member.id, 'tracks', { ...periodQuery, limit: 1 }).catch(() => []),
        statsService.getTopItems(member.id, 'albums', { ...periodQuery, limit: 1 }).catch(() => [])
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
  }, [periodQuery, visibleMembers]);

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
    <div className="flex flex-col gap-3 mb-3 mt-1">
      <SectionHeader
        title="TOP 1 DO CÍRCULO"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="glass-card p-4 sm:p-5 border-white/5 bg-white/[0.01] relative overflow-hidden"
      >
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -z-10 rounded-full" />

        <div className="flex flex-col divide-y divide-white/5 relative z-10">
          {sortedFriends.map((friend, idx) => (
            <FriendHighlightRow
              key={`${friend.id}-${idx}`}
              friend={friend}
              tops={periodTops[friend.id] || friend.topItems}
              isExpanded={expandedId === friend.id}
              onToggle={() => setExpandedId(expandedId === friend.id ? null : friend.id)}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
});

const FriendHighlightRow = React.memo(({
  friend,
  tops,
  isExpanded,
  onToggle
}: {
  friend: UserStats;
  tops?: { artists?: TopItem[]; tracks?: TopItem[]; albums?: TopItem[] };
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const topArtist = tops?.artists?.[0];
  const topTrack = tops?.tracks?.[0];
  const topAlbum = tops?.albums?.[0];

  return (
    <div className="flex flex-col py-4 first:pt-0 last:pb-0">
      <div
        onClick={onToggle}
        className={cn(
          "grid grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_18px] items-start gap-2.5 group cursor-pointer transition-colors p-2 rounded-xl",
          isExpanded ? "bg-white/[0.03]" : "hover:bg-white/[0.01]"
        )}
      >
        <div className="flex justify-center pt-0.5">
          <div className={cn(
            "h-10 w-10 rounded-full border-2 overflow-hidden shadow-2xl relative transition-all duration-300",
            isExpanded ? "border-orange-500/50 scale-105" : "border-white/8"
          )}>
            <SmartImage
              src={coreUtils.getUserAvatar(friend.id, friend.avatar)}
              rounded="full"
              className="h-full w-full object-cover"
              fallback=""
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
          </div>
        </div>

        <CompactCover item={topArtist} rounded="full" icon={<Mic2 className="h-3 w-3 text-white/20" />} label="artista" showName={isExpanded} />
        <CompactCover item={topTrack} rounded="lg" icon={<Music className="h-3 w-3 text-white/20" />} label="música" showName={isExpanded} />
        <CompactCover item={topAlbum} rounded="lg" icon={<Disc className="h-3 w-3 text-white/20" />} label="álbum" showName={isExpanded} />

        <div className="flex justify-center pt-3 text-white/22 group-hover:text-white/50 transition-colors">
          <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90 text-orange-400/80")} />
        </div>
      </div>
    </div>
  );
});

const CompactCover = ({
  item,
  rounded,
  icon,
  label,
  showName
}: {
  item?: TopItem;
  rounded: 'full' | 'lg';
  icon: React.ReactNode;
  label: string;
  showName: boolean;
}) => {
  if (!item) {
    return (
      <div className="flex flex-col items-center gap-1 min-w-0 opacity-45">
        <div
          className={cn(
            "h-10 w-10 bg-white/[0.02] border border-white/5 flex items-center justify-center shrink-0",
            rounded === 'full' ? 'rounded-full' : 'rounded-lg'
          )}
        >
          {icon}
        </div>
        {showName && <span className="text-[7px] font-black uppercase tracking-wider text-white/30 truncate">{label}</span>}
      </div>
    );
  }

  const playCount = item.playcount || item.streams || 0;
  const displayCount = playCount >= 1000 ? coreUtils.formatPlayCount(playCount) : playCount;

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="relative h-10 w-10 shrink-0 group-hover:scale-105 duration-300 transition-transform">
        <SmartImage
          src={item.image}
          className={cn(
            "h-full w-full object-cover shadow-[0_8px_16px_rgba(0,0,0,0.5)] border transition-all duration-300",
            rounded === 'full' ? 'rounded-full border-white/10' : 'rounded-lg border-white/10'
          )}
          rounded={rounded}
          fallback=""
        />
        {playCount > 0 && (
          <div className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-orange-600 border border-black flex items-center justify-center shadow-lg z-10">
            <span className="text-[6.5px] font-black text-white leading-none">{displayCount}</span>
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {showName && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex w-full min-w-0 flex-col text-center"
          >
            <span className="text-[6.5px] font-black uppercase tracking-[0.16em] text-white/28 leading-none">{label}</span>
            <span className="text-[8.5px] font-bold text-white/72 truncate leading-tight">{item.name}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
