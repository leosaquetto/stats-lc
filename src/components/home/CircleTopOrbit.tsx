/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
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
  const shouldReduceMotion = useReducedMotion();

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
    <div className="relative min-h-[620px] overflow-visible py-6 px-4">
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -z-10 rounded-full" />

      {/* Period Label */}
      <div className="flex items-center justify-between mb-6">
        <span className="rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.18em] text-white/55 backdrop-blur-xl">
          {periodLabel}
        </span>
      </div>

      {/* Orbit Stage */}
      <div className="relative mx-auto h-[520px] w-full max-w-[390px] overflow-visible mb-8">
        {/* Orbital Rings - Behind everything */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {/* Outer ring */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full border border-white/5" />

          {/* Dotted ring */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full border-2 border-dashed border-orange-500/15" />

          {/* Inner orange ring */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[190px] h-[190px] rounded-full border border-orange-500/30" />

          {/* Light points */}
          <motion.div
            animate={shouldReduceMotion ? {} : { opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 3, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px]"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-orange-500/60 blur-[2px]" />
          </motion.div>
          <motion.div
            animate={shouldReduceMotion ? {} : { opacity: [0.4, 1, 0.4], scale: [0.9, 1.3, 0.9] }}
            transition={{ duration: 4, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px]"
          >
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-orange-500/50 blur-[1px]" />
          </motion.div>
          <motion.div
            animate={shouldReduceMotion ? {} : { opacity: [0.5, 0.9, 0.5], scale: [1, 1.4, 1] }}
            transition={{ duration: 3.5, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[190px] h-[190px]"
          >
            <div className="absolute top-1/4 right-0 w-1.5 h-1.5 rounded-full bg-orange-500/70 blur-[1px]" />
          </motion.div>
        </div>

        {/* Center User */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeUser.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-20"
          >
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -4, 0] }}
              transition={{ duration: 5, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <div className="h-32 w-32 rounded-full border-3 border-orange-500 overflow-hidden shadow-2xl shadow-orange-500/20">
                <SmartImage
                  src={coreUtils.getUserAvatar(activeUser.id, activeUser.avatar)}
                  rounded="full"
                  className="h-full w-full object-cover"
                  fallback=""
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
              </div>
              <div className="absolute inset-0 rounded-full shadow-[0_0_40px_rgba(249,115,22,0.3)]" />
            </motion.div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-white text-center max-w-[140px] truncate">
                {activeUser.name}
              </span>
              <div className="px-2.5 py-1 rounded-full bg-orange-600 border border-black shadow-lg">
                <span className="text-[9px] font-black text-white leading-none">TOP 1</span>
              </div>
            </div>
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
            {/* Top Artist - Top Right */}
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -3, 0] }}
              transition={{ duration: 6, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="absolute top-[8%] right-[8%]"
            >
              <OrbitalSatellite
                item={topArtist}
                icon={<Mic2 className="h-3 w-3 text-white/20" />}
                label="artista"
                rounded="full"
              />
            </motion.div>

            {/* Top Track - Bottom Left */}
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -4, 0] }}
              transition={{ duration: 7, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute left-[2%] bottom-[20%]"
              style={{ transform: 'rotate(-3deg)' }}
            >
              <OrbitalSatellite
                item={topTrack}
                icon={<Music className="h-3 w-3 text-white/20" />}
                label="faixa"
                rounded="lg"
              />
            </motion.div>

            {/* Top Album - Bottom Right */}
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -3, 0] }}
              transition={{ duration: 6.5, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 1.5 }}
              className="absolute right-[2%] bottom-[20%]"
              style={{ transform: 'rotate(3deg)' }}
            >
              <OrbitalSatellite
                item={topAlbum}
                icon={<Disc className="h-3 w-3 text-white/20" />}
                label="álbum"
                rounded="lg"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Members Dock - Separated */}
      <div className="relative mx-auto max-w-[390px]">
        <div className="glass-card border-white/8 bg-white/[0.02] rounded-[28px] p-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">
              Seu Círculo
            </span>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">
              ·
            </span>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-500/60">
              Deslize para Explorar
            </span>
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
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
                    "h-14 w-14 rounded-full border-2 overflow-hidden shadow-lg transition-all duration-300",
                    isActive ? "border-orange-500 ring-4 ring-orange-500/20 shadow-orange-500/30" : "border-white/10"
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
        className="flex flex-col items-center gap-2 opacity-40"
      >
        <div
          className={cn(
            "h-20 w-20 bg-white/[0.02] border border-white/5 flex items-center justify-center",
            rounded === 'full' ? 'rounded-full' : 'rounded-xl'
          )}
        >
          {icon}
        </div>
        <div className="glass-card border-white/5 bg-white/[0.02] rounded-2xl px-3 py-2 max-w-[100px]">
          <span className="text-[7px] font-black uppercase tracking-wider text-white/30 block text-center">
            sem dados
          </span>
        </div>
      </motion.div>
    );
  }

  const playCount = item.playcount || item.streams || 0;
  const displayCount = coreUtils.formatNumber(playCount);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0, opacity: 0, y: 10 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-2"
    >
      {/* Image with callout style for artist */}
      {rounded === 'full' ? (
        <div className="relative flex items-center gap-2">
          <div className="relative h-20 w-20 shrink-0">
            <SmartImage
              src={item.image}
              className="h-full w-full object-cover shadow-[0_8px_16px_rgba(0,0,0,0.5)] border-2 border-white/10 rounded-full"
              rounded="full"
              fallback=""
            />
            {playCount > 0 && (
              <div className="absolute -bottom-1 -right-1 h-[22px] min-w-[22px] px-1.5 rounded-full bg-orange-600 border-2 border-black flex items-center justify-center shadow-lg z-10">
                <span className="text-[8px] font-black text-white leading-none">{displayCount}</span>
              </div>
            )}
          </div>
          <div className="glass-card border-white/8 bg-black/40 rounded-2xl px-3 py-2 max-w-[100px] backdrop-blur-md">
            <span className="text-[7px] font-black uppercase tracking-[0.16em] text-orange-500/80 leading-none block mb-1">
              {label}
            </span>
            <span className="text-[9px] font-bold text-white/80 leading-tight line-clamp-2 block">
              {item.name}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-1.5">
          <div className="relative h-20 w-20 shrink-0">
            <SmartImage
              src={item.image}
              className="h-full w-full object-cover shadow-[0_8px_16px_rgba(0,0,0,0.5)] border border-white/10 rounded-xl"
              rounded="lg"
              fallback=""
            />
            {playCount > 0 && (
              <div className="absolute -top-1.5 -right-1.5 h-[22px] min-w-[22px] px-1.5 rounded-full bg-orange-600 border-2 border-black flex items-center justify-center shadow-lg z-10">
                <span className="text-[8px] font-black text-white leading-none">{displayCount}</span>
              </div>
            )}
          </div>
          <div className="glass-card border-white/8 bg-black/40 rounded-2xl px-3 py-2 max-w-[100px] backdrop-blur-md">
            <span className="text-[7px] font-black uppercase tracking-[0.16em] text-orange-500/80 leading-none block mb-1">
              {label}
            </span>
            <span className="text-[9px] font-bold text-white/80 leading-tight line-clamp-2 block text-center">
              {item.name}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
