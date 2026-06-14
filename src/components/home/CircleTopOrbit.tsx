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
import { Disc, Mic2, Music } from 'lucide-react';
import { getTopItemArtistName } from '../../lib/topItemUtils';
import { useViewportMotionGate } from '../../hooks/useViewportMotionGate';
import { animationTokens } from '../../lib/animationTokens';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getFirstName = (name?: string | null) => {
  const [firstName] = String(name || '').trim().split(/\s+/);
  return firstName || 'Amigo';
};

interface CircleTopOrbitProps {
  members: UserStats[];
  periodTops: Record<string, { artists: TopItem[]; tracks: TopItem[]; albums: TopItem[] }>;
  periodLabel: string;
}

export const CircleTopOrbit = React.memo(({ members, periodTops, periodLabel }: CircleTopOrbitProps) => {
  const shouldReduceMotion = useReducedMotion();
  const { ref: orbitRef, isInViewport: isOrbitVisible } = useViewportMotionGate<HTMLDivElement>({ rootMargin: '180px' });
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [isMemberMenuOpen, setIsMemberMenuOpen] = useState(false);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const previousFeaturedUserIdRef = React.useRef(featuredUserId);

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
    if (previousFeaturedUserIdRef.current === featuredUserId) return;
    previousFeaturedUserIdRef.current = featuredUserId;
    setActiveMemberId(featuredUserId || null);
    setIsMemberMenuOpen(false);
  }, [featuredUserId]);

  useEffect(() => {
    if (isOrbitVisible) setHasEnteredViewport(true);
  }, [isOrbitVisible]);

  useEffect(() => {
    const fallbackMemberId = validMembers[0]?.id || null;
    setActiveMemberId(current => {
      if (!fallbackMemberId) return current === null ? current : null;
      if (current && validMembers.some(member => member.id === current)) return current;
      return fallbackMemberId;
    });
  }, [validMembers]);

  const activeIndex = useMemo(() => {
    if (!activeMemberId) return 0;
    const index = validMembers.findIndex(member => member.id === activeMemberId);
    return index >= 0 ? index : 0;
  }, [activeMemberId, validMembers]);

  const activeUser = useMemo(() => {
    return validMembers[activeIndex] || validMembers[0] || null;
  }, [activeIndex, validMembers]);
  const activeUserFirstName = useMemo(() => getFirstName(activeUser?.name), [activeUser?.name]);

  const goToIndex = React.useCallback((index: number) => {
    if (validMembers.length === 0) return;
    const nextIndex = (index + validMembers.length) % validMembers.length;
    setActiveMemberId(validMembers[nextIndex]?.id || null);
    setIsMemberMenuOpen(false);
  }, [validMembers]);

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
    <div className="relative min-h-[276px] overflow-visible px-3 py-3">
      <div className="absolute right-0 top-0 -z-10 h-56 w-56 rounded-full bg-orange-500/5 blur-[96px]" />
      <div className="absolute left-1/2 top-[42%] -z-10 h-48 w-48 -translate-x-1/2 rounded-full bg-orange-500/[0.035] blur-[100px]" />

      <div className="mb-2 flex items-center justify-between gap-2">
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
              className="flex h-8 items-center gap-1.5 overflow-hidden rounded-full border border-white/10 bg-white/[0.055] py-0.5 pl-0.5 pr-2 shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl active:scale-95"
              aria-label="Trocar membro no Top 1 do Círculo"
            >
              <span className="h-7 w-7 overflow-hidden rounded-full">
                <SmartImage
                  src={coreUtils.getUserAvatar(activeUser.id, activeUser.avatar)}
                  cacheKey={`circle-top-picker-active:${activeUser.id}`}
                  rounded="full"
                  className="h-full w-full object-cover"
                  fallback=""
                />
              </span>
              <span className="max-w-[64px] truncate text-[7px] font-black uppercase tracking-[0.14em] text-white/56">{activeUserFirstName}</span>
            </button>
            <AnimatePresence>
              {isMemberMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="stats-lc-glass-popover absolute right-0 top-10 z-50 grid max-h-[196px] w-[172px] grid-cols-4 gap-2 overflow-y-auto rounded-[24px] p-2.5 shadow-2xl"
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
        </div>
      </div>

        <div
          ref={orbitRef}
          data-home-horizontal-scroll="true"
          className="relative mx-auto h-[218px] w-full max-w-[420px] select-none overflow-visible [perspective:1200px]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => { touchStartRef.current = null; }}
        >
          <div className="pointer-events-none absolute left-1/2 top-[50%] h-[238px] w-[238px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/7" />
          <div className="pointer-events-none absolute left-1/2 top-[50%] h-[188px] w-[188px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-orange-500/13" />
          <div className="pointer-events-none absolute left-1/2 top-[50%] h-[136px] w-[136px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-500/24 shadow-[0_0_32px_rgba(249,115,22,0.08)]" />

          <AnimatePresence mode="wait" initial={false}>
            {validMembers.map((member, index) => {
              const isCentered = index === activeIndex;
              if (!isCentered) return null;

              const memberTops = periodTops[member.id] || member.topItems || { artists: [], tracks: [], albums: [] };
              const memberArtist = memberTops.artists?.[0];
              const memberTrack = memberTops.tracks?.[0];
              const memberAlbum = memberTops.albums?.[0];
              const canRevealStage = shouldReduceMotion || hasEnteredViewport;

              return (
                <motion.div
                  key={member.id}
                  initial={shouldReduceMotion ? false : { x: 'calc(-50% + 0px)', y: 'calc(-50% + 4px)', scale: 0.96, opacity: 0, filter: 'blur(7px)', zIndex: 30 }}
                  animate={{
                    x: 'calc(-50% + 0px)',
                    y: canRevealStage ? 'calc(-50% + -10px)' : 'calc(-50% + 4px)',
                    scale: canRevealStage ? 1 : 0.96,
                    opacity: canRevealStage ? 1 : 0,
                    filter: canRevealStage ? 'blur(0px)' : 'blur(7px)',
                    zIndex: 30
                  }}
                  exit={shouldReduceMotion ? undefined : { y: 'calc(-50% + -20px)', scale: 0.98, opacity: 0, filter: 'blur(5px)' }}
                  transition={{ duration: 0.44, ease: animationTokens.ease.smooth }}
                  className="absolute left-1/2 top-[50%] w-[318px]"
                >
                  <motion.div
                    animate={shouldReduceMotion || !isOrbitVisible ? {} : { x: [0, 8, -5, 0], y: [0, -5, 4, 0], rotate: [0, 0.6, -0.4, 0] }}
                    transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative flex flex-col items-center"
                  >
                    <div className="relative z-10 grid w-full grid-cols-3 gap-1.5">
                      <CircleTopInlineItem item={memberArtist} icon={<Mic2 className="h-3 w-3 text-white/20" />} label="artista" rounded="full" index={0} shouldReduceMotion={shouldReduceMotion} />
                      <CircleTopInlineItem item={memberTrack} icon={<Music className="h-3 w-3 text-white/20" />} label="faixa" rounded="lg" index={1} shouldReduceMotion={shouldReduceMotion} />
                      <CircleTopInlineItem item={memberAlbum} icon={<Disc className="h-3 w-3 text-white/20" />} label="álbum" rounded="lg" index={2} shouldReduceMotion={shouldReduceMotion} />
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-center justify-center">
            <OrbitPagerIndicator
              count={validMembers.length}
              activeIndex={activeIndex}
              onSelect={goToIndex}
              label="membro do Top 1"
            />
          </div>
        </div>
    </div>
  );
});

const CircleTopInlineItem = ({
  item,
  icon,
  label,
  rounded,
  index,
  shouldReduceMotion,
}: {
  item?: TopItem;
  icon: React.ReactNode;
  label: string;
  rounded: 'full' | 'lg';
  index: number;
  shouldReduceMotion: boolean | null;
}) => {
  const delay = shouldReduceMotion ? 0 : index * 0.07;

  if (!item) {
    return (
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, delay, ease: animationTokens.ease.smooth }}
        className="flex min-w-0 flex-col items-center gap-1.5 px-1"
      >
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, delay, ease: animationTokens.ease.smooth }}
          className={cn(
            "flex h-[62px] w-[62px] items-center justify-center bg-white/[0.025]",
            rounded === 'full' ? 'rounded-full' : 'rounded-xl'
          )}
        >
          {icon}
        </motion.div>
        <motion.span
          initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: delay + 0.08, ease: animationTokens.ease.smooth }}
          className="rounded-full bg-black/36 px-2 py-1 text-[7px] font-black uppercase tracking-[0.14em] text-white/28 backdrop-blur-xl"
        >
          sem dados
        </motion.span>
      </motion.div>
    );
  }

  const playCount = item.playcount || item.streams || 0;
  const artistName = label === 'faixa' || label === 'álbum'
    ? getTopItemArtistName(item)
    : '';

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.34, delay, ease: animationTokens.ease.smooth }}
      className="flex min-w-0 flex-col items-center gap-1.5 px-1"
    >
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.9, rotate: index === 0 ? -2 : index === 2 ? 2 : 0 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
        transition={{ duration: 0.34, delay, ease: animationTokens.ease.smooth }}
        className="relative h-[66px] w-[66px] shrink-0"
      >
        <SmartImage
          src={item.image}
          cacheKey={`circle-top-inline:${label}:${item.id || item.name}`}
          className={cn(
            "h-full w-full object-cover shadow-[0_10px_22px_rgba(0,0,0,0.44)]",
            rounded === 'full' ? 'rounded-full' : 'rounded-xl'
          )}
          rounded={rounded === 'full' ? 'full' : 'lg'}
          fallback=""
        />
        {playCount > 0 && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.65, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.22, delay: delay + 0.11, ease: animationTokens.ease.smooth }}
            className="leo-soft-badge absolute -bottom-1 -right-1 flex h-6 min-w-[28px] items-center justify-center rounded-full bg-[#ff5f00]/62 px-2 text-[9px] font-black leading-none text-orange-50 shadow-[0_0_14px_rgba(255,95,0,0.34)] backdrop-blur-md"
          >
            {coreUtils.formatNumber(playCount)}
          </motion.div>
        )}
      </motion.div>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: delay + 0.06, ease: animationTokens.ease.smooth }}
        className="min-w-0 rounded-[13px] bg-black/42 px-2 py-1.5 text-center shadow-[0_12px_22px_rgba(0,0,0,0.24)] backdrop-blur-xl"
      >
        <span className="mb-1 block text-[7px] font-black uppercase leading-none tracking-[0.14em] text-orange-400/78">
          {label}
        </span>
        <span className="block line-clamp-2 text-[9px] font-black leading-tight text-white/86">
          {item.name}
        </span>
        {artistName && (
          <span className="mt-0.5 block line-clamp-1 text-[7px] font-semibold leading-tight text-white/42">
            {artistName}
          </span>
        )}
      </motion.div>
    </motion.div>
  );
};
