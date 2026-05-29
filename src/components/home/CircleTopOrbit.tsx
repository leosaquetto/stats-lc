/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserStats, TopItem } from '../../types/stats';
import { SmartImage } from '../shared/CommonUI';
import { coreUtils } from '../../services/statsCore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Music, Disc, Mic2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CircleTopOrbitProps {
  members: UserStats[];
  periodTops: Record<string, { artists: TopItem[]; tracks: TopItem[]; albums: TopItem[] }>;
  periodLabel: string;
}

export const CircleTopOrbit = React.memo(({ members, periodTops, periodLabel }: CircleTopOrbitProps) => {
  // Find first valid member with data
  const firstValidMember = useMemo(() => {
    return members.find(m => {
      const tops = periodTops[m.id] || m.topItems;
      return tops?.tracks?.[0] || tops?.artists?.[0] || tops?.albums?.[0];
    });
  }, [members, periodTops]);

  const [activeUserId, setActiveUserId] = useState<string>(firstValidMember?.id || members[0]?.id || '');

  // Recover if activeUserId becomes invalid
  useEffect(() => {
    if (!members.length) return;
    const exists = members.some(m => m.id === activeUserId);
    if (!exists && firstValidMember?.id) {
      setActiveUserId(firstValidMember.id);
    }
  }, [activeUserId, members, firstValidMember?.id]);

  // Derive activeUser without setState
  const activeUser = useMemo(() => {
    return members.find(m => m.id === activeUserId) || firstValidMember || members[0] || null;
  }, [activeUserId, members, firstValidMember]);

  const activeTops = useMemo(() => {
    if (!activeUser) return { artists: [], tracks: [], albums: [] };
    return periodTops[activeUser.id] || activeUser.topItems || { artists: [], tracks: [], albums: [] };
  }, [activeUser, periodTops]);

  const topArtist = activeTops.artists?.[0];
  const topTrack = activeTops.tracks?.[0];
  const topAlbum = activeTops.albums?.[0];

  // Empty state if no active user
  if (!activeUser) {
    return (
      <div className="glass-card p-5 sm:p-6 border-white/5 bg-white/[0.01] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -z-10 rounded-full" />
        <div className="flex items-center justify-center py-12 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Nenhum membro com dados
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 sm:p-6 border-white/5 bg-white/[0.01] relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -z-10 rounded-full" />

      {/* Period Label */}
      <div className="flex items-center justify-between mb-5">
        <span className="rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.18em] text-white/55 backdrop-blur-xl">
          {periodLabel}
        </span>
      </div>

      {/* Orbit Container */}
      <div className="relative w-full aspect-square max-w-[340px] mx-auto mb-6">
        {/* Center User */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeUser.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-20"
          >
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-2 border-orange-500/50 overflow-hidden shadow-2xl">
                <SmartImage
                  src={coreUtils.getUserAvatar(activeUser.id, activeUser.avatar)}
                  rounded="full"
                  className="h-full w-full object-cover"
                  fallback=""
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
              </div>
              <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-orange-600 border border-black shadow-lg">
                <span className="text-[8px] font-black text-white leading-none">TOP 1</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-white/90 text-center max-w-[100px] truncate">
              {activeUser.name}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Orbital Satellites */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`orbit-${activeUser.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {/* Top Artist - Top Position */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2">
              <OrbitalSatellite
                item={topArtist}
                icon={<Mic2 className="h-3 w-3 text-white/20" />}
                label="artista"
                rounded="full"
              />
            </div>

            {/* Top Track - Bottom Left */}
            <div className="absolute bottom-0 left-[15%] -translate-x-1/2">
              <OrbitalSatellite
                item={topTrack}
                icon={<Music className="h-3 w-3 text-white/20" />}
                label="música"
                rounded="lg"
              />
            </div>

            {/* Top Album - Bottom Right */}
            <div className="absolute bottom-0 right-[15%] translate-x-1/2">
              <OrbitalSatellite
                item={topAlbum}
                icon={<Disc className="h-3 w-3 text-white/20" />}
                label="álbum"
                rounded="lg"
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Members Dock */}
      <div className="relative">
        <div
          className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
          style={{ touchAction: 'pan-x' }}
        >
          {members.map((member) => {
            const tops = periodTops[member.id] || member.topItems;
            const hasData = tops?.tracks?.[0] || tops?.artists?.[0] || tops?.albums?.[0];
            if (!hasData) return null;

            const isActive = member.id === activeUser.id;

            return (
              <button
                key={member.id}
                onClick={() => setActiveUserId(member.id)}
                className={cn(
                  "shrink-0 snap-center transition-all duration-300",
                  isActive ? "scale-110" : "scale-100 opacity-60 hover:opacity-100"
                )}
              >
                <div className={cn(
                  "h-12 w-12 rounded-full border-2 overflow-hidden shadow-lg transition-all duration-300",
                  isActive ? "border-orange-500 ring-2 ring-orange-500/30" : "border-white/10"
                )}>
                  <SmartImage
                    src={coreUtils.getUserAvatar(member.id, member.avatar)}
                    rounded="full"
                    className="h-full w-full object-cover"
                    fallback=""
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

const OrbitalSatellite = ({
  item,
  icon,
  label,
  rounded
}: {
  item?: TopItem;
  icon: React.ReactNode;
  label: string;
  rounded: 'full' | 'lg';
}) => {
  if (!item) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col items-center gap-1.5 opacity-40"
      >
        <div
          className={cn(
            "h-16 w-16 bg-white/[0.02] border border-white/5 flex items-center justify-center",
            rounded === 'full' ? 'rounded-full' : 'rounded-xl'
          )}
        >
          {icon}
        </div>
        <span className="text-[7px] font-black uppercase tracking-wider text-white/30">
          sem dados
        </span>
      </motion.div>
    );
  }

  const playCount = item.playcount || item.streams || 0;
  const displayCount = playCount >= 1000
    ? Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(playCount).toLowerCase()
    : playCount;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0, opacity: 0, y: 10 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-1.5"
    >
      <div className="relative h-16 w-16 shrink-0">
        <SmartImage
          src={item.image}
          className={cn(
            "h-full w-full object-cover shadow-[0_8px_16px_rgba(0,0,0,0.5)] border border-white/10",
            rounded === 'full' ? 'rounded-full' : 'rounded-xl'
          )}
          rounded={rounded}
          fallback=""
        />
        {playCount > 0 && (
          <div className="absolute -top-1.5 -right-1.5 h-[20px] min-w-[20px] px-1.5 rounded-full bg-orange-600 border border-black flex items-center justify-center shadow-lg z-10">
            <span className="text-[8px] font-black text-white leading-none">{displayCount}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5 max-w-[80px]">
        <span className="text-[6.5px] font-black uppercase tracking-[0.16em] text-white/28 leading-none">
          {label}
        </span>
        <span className="text-[8.5px] font-bold text-white/72 leading-tight line-clamp-2 text-center">
          {item.name}
        </span>
      </div>
    </motion.div>
  );
};
