/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { UserStats, TopItem } from '../../types/stats';
import { SmartImage, SectionHeader, ShimmerOverlay, Skeleton } from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Music, Disc, Mic2, ChevronDown, ChevronUp } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FriendsMonthlyHighlights = React.memo(() => {
  const { groupStats, featuredUserId, hiddenUsers } = useStatsStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const members = groupStats?.members || [];
  const isWaitingForGroup = !groupStats;
  const friends = React.useMemo(() => members.filter(m => m.id !== featuredUserId && !hiddenUsers.includes(m.id)), [members, featuredUserId, hiddenUsers]);

  const sortedFriends = React.useMemo(() => [...friends].sort((a, b) => {
    const hasA = a.topItems?.tracks?.[0] || a.topItems?.artists?.[0] || a.topItems?.albums?.[0] ? 1 : 0;
    const hasB = b.topItems?.tracks?.[0] || b.topItems?.artists?.[0] || b.topItems?.albums?.[0] ? 1 : 0;
    return hasB - hasA;
  }).filter(f => f.topItems?.tracks?.[0] || f.topItems?.artists?.[0] || f.topItems?.albums?.[0]), [friends]);

  if (isWaitingForGroup) {
    return (
      <div className="flex flex-col gap-3 mb-3 mt-1">
        <SectionHeader title="Destaques do Mês" />
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
        title="Destaques do Mês" 
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
          {sortedFriends.map((friend) => (
            <FriendHighlightRow 
              key={friend.id} 
              friend={friend} 
              isExpanded={expandedId === friend.id}
              onToggle={() => setExpandedId(expandedId === friend.id ? null : friend.id)}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

const FriendHighlightRow = React.memo(({ 
  friend, 
  isExpanded, 
  onToggle 
}: { 
  friend: UserStats; 
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const topArtist = friend.topItems?.artists?.[0];
  const topTrack = friend.topItems?.tracks?.[0];
  const topAlbum = friend.topItems?.albums?.[0];

  const totalStreams = friend.streamsMonth || friend.totalStreams || 0;

  return (
    <div className="flex flex-col py-4 first:pt-0 last:pb-0">
      <div 
        onClick={onToggle}
        className={cn(
          "flex flex-row items-center justify-between gap-4 group cursor-pointer transition-colors p-2 rounded-xl",
          isExpanded ? "bg-white/[0.03]" : "hover:bg-white/[0.01]"
        )}
      >
        {/* Friend Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="shrink-0 relative">
            <div className={cn(
              "h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 overflow-hidden shadow-2xl relative transition-all duration-300",
              isExpanded ? "border-orange-500/50 scale-105" : "border-white/5"
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
          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-sm font-bold text-white truncate leading-tight">
              {friend.name}
            </span>
            <span className="text-[9px] font-medium text-white/40 uppercase tracking-widest mt-0.5">
              {totalStreams > 0 ? `${totalStreams} streams` : "Destaques"} • Este Mês
            </span>
          </div>
        </div>

        {/* Cores alinhadas à direita */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <CompactCover item={topArtist} rounded="full" icon={<Mic2 className="h-3 w-3 text-white/20" />} />
          <CompactCover item={topTrack} rounded="lg" icon={<Music className="h-3 w-3 text-white/20" />} />
          <CompactCover item={topAlbum} rounded="lg" icon={<Disc className="h-3 w-3 text-white/20" />} />
          <div className="text-white/20 group-hover:text-white/40 transition-colors pl-1">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Expanded details slide down (from the beginning) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pl-14 sm:pl-16 pr-4 pt-3 pb-1 flex flex-col gap-2 border-l border-white/5 ml-7 sm:ml-8 mt-1">
              <DetailRow item={topArtist} label="Artista Favorito do Mês" icon="🎤" />
              <DetailRow item={topTrack} label="Faixa Mais Ouvida do Mês" icon="🎵" />
              <DetailRow item={topAlbum} label="Álbum Top no Período" icon="💿" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CompactCover = ({ 
  item, 
  rounded,
  icon
}: { 
  item?: TopItem; 
  rounded: 'full' | 'lg';
  icon: React.ReactNode;
}) => {
  if (!item) {
    return (
      <div 
        className={cn(
          "h-9 w-9 sm:h-11 sm:w-11 bg-white/[0.02] border border-white/5 flex items-center justify-center shrink-0",
          rounded === 'full' ? 'rounded-full' : 'rounded-lg'
        )}
      >
        {icon}
      </div>
    );
  }

  const playCount = item.playcount || item.streams || 0;
  const displayCount = playCount >= 1000 ? coreUtils.formatPlayCount(playCount) : playCount;

  return (
    <div className="relative h-9 w-9 sm:h-11 sm:w-11 shrink-0 group-hover:scale-105 duration-300 transition-transform">
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
  );
};

const DetailRow = ({ 
  item, 
  label, 
  icon 
}: { 
  item?: TopItem; 
  label: string; 
  icon: string; 
}) => {
  if (!item) {
    return (
      <div className="flex items-center gap-2.5 py-1 opacity-20 text-left">
        <span className="text-xs shrink-0 select-none">{icon}</span>
        <div className="flex flex-col">
          <span className="text-[7.5px] font-black uppercase tracking-wider text-white/50 leading-none mb-0.5">
            {label}
          </span>
          <span className="text-[10px] font-medium text-white/50 italic">
            Sem dados disponíveis
          </span>
        </div>
      </div>
    );
  }

  const playCount = item.playcount || item.streams || 0;

  return (
    <div className="flex items-center gap-2.5 py-1 text-left min-w-0">
      <span className="text-xs shrink-0 select-none">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-[7.5px] font-black uppercase tracking-wider text-orange-500/80 leading-none mb-0.5">
          {label}
        </span>
        <span className="text-[11px] font-bold text-white truncate leading-tight">
          {item.name}
        </span>
        {playCount > 0 && (
          <span className="text-[9px] font-medium text-white/30 truncate mt-0.5">
            {playCount} reproduções observadas
          </span>
        )}
      </div>
    </div>
  );
};
