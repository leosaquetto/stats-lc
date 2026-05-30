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
import { Crown, Music, Disc, Mic2 } from 'lucide-react';

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
    <div className="relative min-h-[700px] overflow-visible px-3 py-7">
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -z-10 rounded-full" />
      <div className="absolute left-1/2 top-[42%] h-72 w-72 -translate-x-1/2 rounded-full bg-orange-500/[0.035] blur-[110px] -z-10" />

      {/* Section Header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/85">
          Top 1 do Círculo
        </h2>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.18em] text-white/55 backdrop-blur-xl">
          {periodLabel}
        </span>
      </div>

      {/* Orbit Stage */}
      <div className="relative mx-auto mb-8 h-[540px] w-full max-w-[430px] overflow-visible">
        {/* Orbital Rings - Behind everything */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {/* Outer ring */}
          <div className="absolute top-1/2 left-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/8 shadow-[0_0_60px_rgba(249,115,22,0.06)]" />

          {/* Dotted ring */}
          <div className="absolute top-1/2 left-1/2 h-[318px] w-[318px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-orange-500/14" />

          {/* Inner orange ring */}
          <div className="absolute top-1/2 left-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-500/35 shadow-[0_0_42px_rgba(249,115,22,0.12)]" />

          {/* Light points */}
          <motion.div
            animate={shouldReduceMotion ? {} : { opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 3, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 left-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-orange-500/60 blur-[2px]" />
          </motion.div>
          <motion.div
            animate={shouldReduceMotion ? {} : { opacity: [0.4, 1, 0.4], scale: [0.9, 1.3, 0.9] }}
            transition={{ duration: 4, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute top-1/2 left-1/2 h-[318px] w-[318px] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-orange-500/50 blur-[1px]" />
          </motion.div>
          <motion.div
            animate={shouldReduceMotion ? {} : { opacity: [0.5, 0.9, 0.5], scale: [1, 1.4, 1] }}
            transition={{ duration: 3.5, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute top-1/2 left-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2"
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
              <div className="absolute inset-[-20px] rounded-full border border-orange-500/20 shadow-[0_0_54px_rgba(249,115,22,0.2)]" />
              <div className="h-36 w-36 overflow-hidden rounded-full border-3 border-orange-500 shadow-2xl shadow-orange-500/25">
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
              <span className="max-w-[190px] truncate text-center text-3xl font-black leading-none text-white">
                {activeUser.name}
              </span>
              <div className="mt-1 flex items-center gap-1.5 rounded-full border border-orange-500/60 bg-black/55 px-3 py-1.5 shadow-[0_0_22px_rgba(249,115,22,0.22)] backdrop-blur-xl">
                <Crown className="h-3 w-3 text-orange-500" />
                <span className="text-[10px] font-black uppercase leading-none tracking-[0.1em] text-orange-400">TOP 1</span>
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
              className="absolute right-[4%] top-[7%]"
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
              className="absolute bottom-[19%] left-[-1%]"
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
              className="absolute bottom-[19%] right-[-1%]"
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

      {/* Members Orbit Rail */}
      <div className="relative mx-auto h-[146px] max-w-[430px] overflow-visible">
        <div className="pointer-events-none absolute left-1/2 top-[56%] h-40 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.035] bg-gradient-to-b from-white/[0.025] to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-[56%] h-24 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-500/[0.06]" />
        <div className="pointer-events-none absolute left-1/2 top-[58%] h-24 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.025] blur-2xl" />

        <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 shadow-[0_14px_42px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <span className="text-[8px] font-black uppercase tracking-[0.24em] text-white/42">
            Seu Círculo
          </span>
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/18">
            ·
          </span>
          <span className="text-[8px] font-black uppercase tracking-[0.24em] text-orange-500/82">
            Deslize
          </span>
        </div>

        <div
          data-home-horizontal-scroll="true"
          className="absolute inset-x-0 bottom-0 z-20 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 pt-10 scrollbar-hide [perspective:900px]"
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
                    "relative shrink-0 snap-center transition-all duration-300",
                    isActive ? "z-20 scale-[1.12]" : "scale-95 opacity-50 hover:opacity-85"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="circle-top-active-avatar"
                      className="absolute inset-[-8px] rounded-full border-2 border-orange-500/80 bg-orange-500/10 shadow-[0_0_34px_rgba(249,115,22,0.32)]"
                    />
                  )}
                  <div className={cn(
                    "relative h-16 w-16 overflow-hidden rounded-full border-2 shadow-[0_16px_28px_rgba(0,0,0,0.5)] transition-all duration-300",
                    isActive ? "border-orange-500 shadow-orange-500/25" : "border-white/10"
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
