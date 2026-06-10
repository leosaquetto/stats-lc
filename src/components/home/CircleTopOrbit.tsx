/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { UserStats, TopItem } from '../../types/stats';
import { OrbitPagerIndicator, SmartImage } from '../shared/CommonUI';
import { coreUtils } from '../../services/statsCore';
import { useStatsStore } from '../../store/useStatsStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronLeft, ChevronRight, Disc, Mic2, Music } from 'lucide-react';
import { getTopItemArtistName } from '../../lib/topItemUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const useOrbitVisibility = () => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '180px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible] as const;
};

interface CircleTopOrbitProps {
  members: UserStats[];
  periodTops: Record<string, { artists: TopItem[]; tracks: TopItem[]; albums: TopItem[] }>;
  periodLabel: string;
}

export const CircleTopOrbit = React.memo(({ members, periodTops, periodLabel }: CircleTopOrbitProps) => {
  const shouldReduceMotion = useReducedMotion();
  const [orbitRef, isOrbitVisible] = useOrbitVisibility();
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMemberMenuOpen, setIsMemberMenuOpen] = useState(false);
  const featuredUserId = useStatsStore(state => state.featuredUserId);

  const validMembers = useMemo(() => {
    return [...members]
      .filter(m => m?.id)
      .sort((a, b) => {
        if (a.id === featuredUserId) return -1;
        if (b.id === featuredUserId) return 1;
        const aTops = periodTops[a.id] || a.topItems;
        const bTops = periodTops[b.id] || b.topItems;
        const aHasData = !!(aTops?.tracks?.[0] || aTops?.artists?.[0] || aTops?.albums?.[0]);
        const bHasData = !!(bTops?.tracks?.[0] || bTops?.artists?.[0] || bTops?.albums?.[0]);
        if (aHasData !== bHasData) return aHasData ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [featuredUserId, members, periodTops]);

  useEffect(() => {
    if (activeIndex >= validMembers.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, validMembers.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [featuredUserId, validMembers.length]);

  const activeUser = useMemo(() => {
    return validMembers[activeIndex] || validMembers[0] || null;
  }, [activeIndex, validMembers]);

  const goToIndex = React.useCallback((index: number) => {
    if (validMembers.length === 0) return;
    setActiveIndex((index + validMembers.length) % validMembers.length);
    setIsMemberMenuOpen(false);
  }, [validMembers.length]);

  const handlePrev = React.useCallback(() => {
    goToIndex(activeIndex - 1);
  }, [activeIndex, goToIndex]);

  const handleNext = React.useCallback(() => {
    goToIndex(activeIndex + 1);
  }, [activeIndex, goToIndex]);

  const handleTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchMove = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      event.stopPropagation();
    }
  }, []);

  const handleTouchEnd = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) handleNext();
    else handlePrev();
  }, [handleNext, handlePrev]);

  // Empty state if no active user
  if (!activeUser) {
    return (
      <div className="glass-card p-5 sm:p-6 border-white/5 bg-white/[0.01] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -z-10 rounded-full" />
        <div className="flex items-center justify-center py-12 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Nenhum membro disponível
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[484px] overflow-visible px-3 py-5">
      <div className="absolute right-0 top-0 -z-10 h-56 w-56 rounded-full bg-orange-500/5 blur-[96px]" />
      <div className="absolute left-1/2 top-[44%] -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-orange-500/[0.035] blur-[100px]" />

      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/85">
          Top 1 do Círculo
        </h2>
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/55 shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            {periodLabel}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMemberMenuOpen(open => !open)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl active:scale-95"
              aria-label="Trocar membro no Top 1 do Círculo"
            >
              <SmartImage
                src={coreUtils.getUserAvatar(activeUser.id, activeUser.avatar)}
                cacheKey={`circle-top-picker-active:${activeUser.id}`}
                rounded="full"
                className="h-full w-full object-cover"
                fallback=""
              />
            </button>
            <AnimatePresence>
              {isMemberMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-10 z-50 grid max-h-[184px] w-[104px] grid-cols-2 gap-2 overflow-y-auto rounded-3xl border border-white/10 bg-black/72 p-2 shadow-2xl backdrop-blur-2xl"
                >
                  {validMembers.map((member, index) => {
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={`top-orbit-picker-${member.id}`}
                        type="button"
                        onClick={() => goToIndex(index)}
                        className={cn(
                          "relative h-10 w-10 overflow-hidden rounded-full border transition-all active:scale-90",
                          isActive ? "border-orange-500 ring-2 ring-orange-500/30" : "border-white/10 opacity-65 hover:opacity-100"
                        )}
                        aria-label={`Abrir Top 1 de ${member.name}`}
                      >
                        <SmartImage
                          src={coreUtils.getUserAvatar(member.id, member.avatar)}
                          cacheKey={`circle-top-picker-member:${member.id}`}
                          rounded="full"
                          className="h-full w-full object-cover"
                          fallback=""
                        />
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <button type="button" onClick={handlePrev} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5 text-white/35" />
            </button>
            <button type="button" onClick={handleNext} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
              <ChevronRight className="h-3.5 w-3.5 text-white/35" />
            </button>
          </div>
        </div>
      </div>

        <div
          ref={orbitRef}
          data-home-horizontal-scroll="true"
          className="relative mx-auto h-[392px] w-full max-w-[420px] select-none overflow-visible [perspective:1200px]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => { touchStartRef.current = null; }}
        >
          <div className="pointer-events-none absolute left-1/2 top-[48%] h-[318px] w-[318px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/7" />
          <div className="pointer-events-none absolute left-1/2 top-[48%] h-[252px] w-[252px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-orange-500/13" />
          <div className="pointer-events-none absolute left-1/2 top-[48%] h-[184px] w-[184px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-500/30 shadow-[0_0_42px_rgba(249,115,22,0.1)]" />

          {validMembers.map((member, index) => {
            const relative = (index - activeIndex + validMembers.length) % validMembers.length;
            const isCentered = relative === 0;
            const isRight = relative === 1;
            const isLeft = relative === validMembers.length - 1;
            if (!isCentered && !isRight && !isLeft) return null;

            const memberTops = periodTops[member.id] || member.topItems || { artists: [], tracks: [], albums: [] };
            const memberArtist = memberTops.artists?.[0];
            const memberTrack = memberTops.tracks?.[0];
            const memberAlbum = memberTops.albums?.[0];
            const x = isCentered ? 0 : isRight ? 114 : -114;
            const y = isCentered ? -2 : -22;
            const scale = isCentered ? 1 : 0.68;
            const opacity = isCentered ? 1 : 0.32;
            const blur = isCentered ? 'blur(0px)' : 'blur(3px)';

            return (
              <motion.div
                key={member.id}
                animate={{ x: `calc(-50% + ${x}px)`, y: `calc(-50% + ${y}px)`, scale, opacity, filter: blur, zIndex: isCentered ? 30 : 8 }}
                transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                className="absolute left-1/2 top-[48%] w-[292px]"
                onClick={() => !isCentered && goToIndex(index)}
              >
                <motion.div
                  animate={shouldReduceMotion || !isOrbitVisible || !isCentered ? {} : { x: [0, 8, -5, 0], y: [0, -5, 4, 0], rotate: [0, 0.6, -0.4, 0] }}
                  transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative flex flex-col items-center"
                >
                  {isCentered && (
                    <>
                      <OrbitalSatellite item={memberArtist} icon={<Mic2 className="h-3 w-3 text-white/20" />} label="artista" rounded="full" className="absolute -right-5 top-[-66px]" />
                      <OrbitalSatellite item={memberTrack} icon={<Music className="h-3 w-3 text-white/20" />} label="faixa" rounded="lg" className="absolute -left-5 bottom-[4px] -rotate-3" />
                      <OrbitalSatellite item={memberAlbum} icon={<Disc className="h-3 w-3 text-white/20" />} label="álbum" rounded="lg" className="absolute -right-5 bottom-[4px] rotate-3" />
                    </>
                  )}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="relative">
                      <div className="absolute inset-[-18px] rounded-full border border-orange-500/18 shadow-[0_0_44px_rgba(249,115,22,0.18)]" />
                      <div className="h-28 w-28 overflow-hidden rounded-full border-3 border-orange-500 shadow-2xl shadow-orange-500/25">
                        <SmartImage
                          src={coreUtils.getUserAvatar(member.id, member.avatar)}
                          cacheKey={`circle-top-center:${member.id}`}
                          rounded="full"
                          className="h-full w-full object-cover"
                          fallback=""
                        />
                      </div>
                    </div>
                    <span className="max-w-[230px] truncate text-center text-[26px] font-black leading-none text-white">
                      {member.name.split(/\s+/)[0] || member.name}
                    </span>
                    {isCentered && (
                      <OrbitPagerIndicator
                        count={validMembers.length}
                        activeIndex={activeIndex}
                        onSelect={goToIndex}
                        label="membro do Top 1"
                        className="mt-1"
                      />
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}

          <div className="pointer-events-none absolute inset-x-0 bottom-1 z-40 flex justify-center gap-24 sm:hidden">
            <button type="button" onClick={handlePrev} className="pointer-events-auto rounded-full bg-black/32 p-2 backdrop-blur-xl active:scale-95">
              <ChevronLeft className="h-4 w-4 text-white/48" />
            </button>
            <button type="button" onClick={handleNext} className="pointer-events-auto rounded-full bg-black/32 p-2 backdrop-blur-xl active:scale-95">
              <ChevronRight className="h-4 w-4 text-white/48" />
            </button>
          </div>
        </div>
    </div>
  );
});

const OrbitalSatellite = ({
  item,
  icon,
  label,
  rounded,
  className
}: {
  item?: TopItem;
  icon: React.ReactNode;
  label: string;
  rounded: 'full' | 'lg';
  className?: string;
}) => {
  if (!item) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={cn("flex flex-col items-center gap-2 opacity-40", className)}
      >
        <div
          className={cn(
            "h-[72px] w-[72px] bg-white/[0.02] border border-white/5 flex items-center justify-center",
            rounded === 'full' ? 'rounded-full' : 'rounded-xl'
          )}
        >
          {icon}
        </div>
        <div className="glass-card border-white/5 bg-white/[0.02] rounded-2xl px-3 py-2 max-w-[100px]">
          <span className="text-left text-[7px] font-black uppercase tracking-wider text-white/30 block">
            sem dados
          </span>
        </div>
      </motion.div>
    );
  }

  const playCount = item.playcount || item.streams || 0;
  const displayCount = coreUtils.formatNumber(playCount);
  const artistName = label === 'faixa' || label === 'álbum'
    ? getTopItemArtistName(item)
    : '';
  const countBadgeClass = "leo-soft-badge absolute z-10 flex h-5 min-w-[22px] items-center justify-center rounded-full bg-[#ff5f00]/58 px-1.5 text-[8px] font-black leading-none text-orange-50 shadow-[0_0_14px_rgba(255,95,0,0.34)] backdrop-blur-md";

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0, opacity: 0, y: 10 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex flex-col items-center gap-2", className)}
    >
      {/* Image with callout style for artist */}
      {rounded === 'full' ? (
        <div className="relative flex items-center gap-2">
          <div className="relative h-[72px] w-[72px] shrink-0">
            <SmartImage
              src={item.image}
              cacheKey={`circle-top-satellite:${item.id || item.name}`}
              className="h-full w-full object-cover shadow-[0_8px_16px_rgba(0,0,0,0.5)] border-2 border-white/10 rounded-full"
              rounded="full"
              fallback=""
            />
            {playCount > 0 && (
              <div className={cn(countBadgeClass, "-bottom-1 -right-1")}>
                <span>{displayCount}</span>
              </div>
            )}
          </div>
          <div className="glass-card border-white/8 bg-black/40 rounded-2xl px-3 py-2 max-w-[96px] backdrop-blur-md">
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
          <div className="relative h-[72px] w-[72px] shrink-0">
            <SmartImage
              src={item.image}
              cacheKey={`circle-top-satellite:${item.id || item.name}`}
              className="h-full w-full object-cover shadow-[0_8px_16px_rgba(0,0,0,0.5)] border border-white/10 rounded-xl"
              rounded="lg"
              fallback=""
            />
            {playCount > 0 && (
              <div className={cn(countBadgeClass, "-top-1.5 -right-1.5")}>
                <span>{displayCount}</span>
              </div>
            )}
          </div>
          <div className="glass-card border-white/8 bg-black/40 rounded-2xl px-3 py-2 max-w-[96px] backdrop-blur-md">
            <span className="text-[7px] font-black uppercase tracking-[0.16em] text-orange-500/80 leading-none block mb-1">
              {label}
            </span>
            <span className="block line-clamp-2 text-left text-[9px] font-bold leading-tight text-white/80">
              {item.name}
            </span>
            {artistName && (
              <span className="mt-0.5 block line-clamp-1 text-left text-[7px] font-semibold leading-tight text-white/42">
                {artistName}
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};
