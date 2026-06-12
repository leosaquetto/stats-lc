
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence, useMotionTemplate, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { RefreshCcw, AlertTriangle, WifiOff, Users, Sparkles, Loader2, Check, Info, X, Music2, Disc3, Clock3, PlayCircle, UserCircle, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FriendActivityReel } from '../components/home/FriendActivityReel';
import { MONTHS_SHORT, getReplayFilterLabel, type ReplayFilterPeriod, type ReplaySelectedSubValues, type ReplayWeekMode } from '../components/home/replayUtils';
import { UserSelectorModal } from '../components/home/UserSelectorModal';
import { UserSelectorExplosion } from '../components/home/UserSelectorExplosion';
import { TopAlbumsModal, TopArtistsModal, TopSongsModal } from '../components/home/ReplayModals';
import { coreUtils } from '../services/statsCore';
import { statsService, type ReplayPeriodQuery } from '../services/statsService';
import { statsCacheService } from '../services/statsCacheService';
import { trackEvent, identifyUser } from '../services/analyticsService';

import { LeoHeader } from '../components/home/LeoHeader';
import { FriendsMonthlyHighlights } from '../components/home/FriendsMonthlyHighlights';
import { StatsAlike } from '../components/home/StatsAlike';
import { ShimmerOverlay, SmartImage, preloadSmartImages } from '../components/shared/CommonUI';
import { HomeInsights } from '../components/home/HomeInsights';
import { FriendHistoryCard } from '../components/history/FriendHistoryCard';
import { getCanonicalMembersWithLive, getVisibleMembersWithLive } from '../lib/memberSelectors';
import { useAutoOrbitRotation } from '../hooks/useAutoOrbitRotation';
import { useViewportMotionGate } from '../hooks/useViewportMotionGate';

const loadUserHistoryModal = () => import('../components/modals/UserHistoryModal').then(module => ({ default: module.UserHistoryModal }));
const loadTrackLeaderboardModule = () => import('../components/modals/TrackLeaderboardModal');
const loadTrackLeaderboardModal = () => loadTrackLeaderboardModule().then(module => ({ default: module.TrackLeaderboardModal }));
const loadUserAlbumStatsModal = () => import('../components/modals/EntityStatsModal').then(module => ({ default: module.UserAlbumStatsModal }));
const loadUserArtistStatsModal = () => import('../components/modals/EntityStatsModal').then(module => ({ default: module.UserArtistStatsModal }));
const loadUserAlbumHistoryModal = () => import('../components/modals/UserAlbumHistoryModal').then(module => ({ default: module.UserAlbumHistoryModal }));

export const preloadHomeDetailModals = () => Promise.allSettled([
  loadUserHistoryModal(),
  loadTrackLeaderboardModal(),
  loadUserAlbumStatsModal(),
  loadUserArtistStatsModal(),
  loadUserAlbumHistoryModal(),
]);

const UserHistoryModal = React.lazy(loadUserHistoryModal);
const TrackLeaderboardModal = React.lazy(loadTrackLeaderboardModal);
const UserAlbumStatsModal = React.lazy(loadUserAlbumStatsModal);
const UserArtistStatsModal = React.lazy(loadUserArtistStatsModal);
const UserAlbumHistoryModal = React.lazy(loadUserAlbumHistoryModal);

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HOME_CACHE_TTL = 15 * 60 * 1000;
const HOME_CRITICAL_WARMUP_TIMEOUT_MS = 1800;
const HOME_RECENT_CACHE_VERSION = 'v2-album-resolved';
const getHomeRecentCacheKey = (userId: string) => `stats-lc-home-recent:${HOME_RECENT_CACHE_VERSION}:${userId}`;

const readHomeSessionCache = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > HOME_CACHE_TTL) return null;
    return parsed.value as T;
  } catch {
    return null;
  }
};

const writeHomeSessionCache = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {}
};

const normalizeHomeRecentItems = (items: any[]) => items
  .map(statsService.normalizeRecentStream)
  .filter((item: any) => item?.track?.name);

const getHomeRecentItemKey = (item: any) => {
  const track = item?.track || item;
  return `${track?.id || track?.name || 'track'}:${item?.playedAt || item?.timestamp || item?.endTime || item?.date || ''}:${item?.isLive ? 'live' : 'history'}`;
};

const mergeHomeRecentItems = (freshItems: any[], existingItems: any[]) => {
  const merged: any[] = [];
  const seen = new Set<string>();

  const pushUnique = (item: any) => {
    if (!item) return;
    const key = getHomeRecentItemKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  freshItems.forEach(pushUnique);
  existingItems.forEach(pushUnique);

  return merged;
};

const getRecentArtworkUrl = (item: any) => {
  const track = item?.track || item;
  return (
    track?.albumImage ||
    track?.album?.image ||
    track?.album?.images?.[0]?.url ||
    track?.album?.images?.[0] ||
    track?.image ||
    ''
  );
};

const normalizeProfileSlug = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const PROFILE_HASH_ALIASES: Record<string, string[]> = {
  leo: ['leo_saquetto', 'leosaquetto'],
  gab: ['gabriel'],
  savio: ['savio_lombardi', 'savio'],
  benny: ['marcelo_benante', 'marcelo', 'benny'],
  peter: ['peter_castro', 'peter'],
  fabiomian: ['fabio_rafael_mian', 'fabio_mian', 'fabio', 'fabiomian'],
  guilhermou: ['guilherme_lima', 'guilherme', 'guilhermou'],
};

const getProfileSlugCandidates = (user: any) => {
  const userKey = normalizeProfileSlug(user?.key);
  return new Set([
    normalizeProfileSlug(user?.name),
    normalizeProfileSlug(user?.displayName),
    normalizeProfileSlug(user?.profile?.displayName),
    userKey,
    normalizeProfileSlug(user?.customId),
    normalizeProfileSlug(user?.profile?.customId),
    normalizeProfileSlug(user?.id),
    ...(PROFILE_HASH_ALIASES[userKey] || []),
  ].filter(Boolean));
};

const HomeSectionLoader = ({ label = 'Carregando dados do círculo' }: { label?: string }) => (
  <div className="mx-4 sm:mx-6 lg:mx-8 flex flex-col items-center justify-center gap-3 rounded-[28px] border border-white/10 bg-white/[0.035] px-5 py-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
    <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">{label}</span>
  </div>
);

const getReplayItemCount = (item: any) => Number(item?.playedCount || item?.playcount || item?.streams || item?.count || 0) || 0;
const getReplayItemArtist = (item: any) => {
  const direct = item?.artistName || item?.artist?.name || item?.album?.artist?.name || item?.track?.artist?.name || item?.albumArtist || item?.artist;
  if (typeof direct === 'string' && direct.trim()) return direct;
  if (Array.isArray(item?.artists) && item.artists.length > 0) {
    return item.artists.map((artist: any) => typeof artist === 'string' ? artist : artist?.name).filter(Boolean).join(', ');
  }
  if (Array.isArray(item?.track?.artists) && item.track.artists.length > 0) {
    return item.track.artists.map((artist: any) => typeof artist === 'string' ? artist : artist?.name).filter(Boolean).join(', ');
  }
  return '';
};

const getReplayItemImage = (item: any) => item?.image || item?.albumImage || item?.album?.image || item?.artist?.image || item?.track?.image || item?.track?.albumImage || '';
const getReplayItemTitle = (item: any) => item?.name || item?.track?.name || item?.album?.name || item?.artist?.name || 'sem nome';

const getFirstName = (name?: string) => {
  if (!name) return '';
  return name.trim().split(/\s+/)[0] || name;
};

const HomeHighlightPeriodControls = ({
  activeTab,
  selectedSubValues,
  onActiveTabChange,
  onSelectedSubValuesChange,
  onPeriodLoading,
}: {
  activeTab: ReplayFilterPeriod;
  selectedSubValues: ReplaySelectedSubValues;
  onActiveTabChange: (tab: ReplayFilterPeriod) => void;
  onSelectedSubValuesChange: (values: ReplaySelectedSubValues) => void;
  onPeriodLoading?: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 16, top: 120, width: 272 });
  const shouldReduceMotion = useReducedMotion();
  const currentMonth = new Date().getMonth();
  const availableMonths = MONTHS_SHORT;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: Math.max(1, currentYear - 2024 + 1) }, (_, index) => 2024 + index);
  const selectedYear = Number(selectedSubValues.year || currentYear);
  const periodTabs: Array<{ key: ReplayFilterPeriod; label: string }> = [
    { key: 'today', label: 'Hoje' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mês' },
    { key: 'year', label: 'Ano' },
    { key: 'all', label: 'Total' }
  ];
  const activeLabel = getReplayFilterLabel(activeTab, selectedSubValues);

  useEffect(() => {
    if (!isOpen) return;
    const updateMenuPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportWidth = window.innerWidth || 390;
      const viewportHeight = window.innerHeight || 750;
      const width = Math.min(272, Math.max(240, viewportWidth - 32));
      const left = Math.min(Math.max(16, rect.right - width), Math.max(16, viewportWidth - width - 16));
      const estimatedHeight = activeTab === 'month'
        ? 254
        : activeTab === 'week'
          ? 166
          : activeTab === 'year'
            ? 166
            : 138;
      const belowTop = rect.bottom + 8;
      const shouldOpenAbove = belowTop + estimatedHeight > viewportHeight - 16 && rect.top > estimatedHeight + 24;
      setMenuPosition({
        left,
        top: Math.max(12, shouldOpenAbove ? rect.top - estimatedHeight - 8 : belowTop),
        width,
      });
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    updateMenuPosition();
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [activeTab, isOpen]);

  const handlePeriodSelect = (tab: ReplayFilterPeriod) => {
    if (tab !== activeTab) {
      setIsPulsing(true);
      onPeriodLoading?.();
      setTimeout(() => setIsPulsing(false), 400);
    }
    onActiveTabChange(tab);
    if (tab === 'today' || tab === 'all') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={menuRef} className="relative z-40 shrink-0">
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex h-9 items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/30 px-3 text-orange-100 shadow-[0_12px_24px_rgba(0,0,0,0.24)] transition-[background-color,border-color] hover:bg-black/40 hover:border-white/[0.1]"
        aria-label={`Filtro de período: ${activeLabel}`}
        aria-expanded={isOpen}
        whileTap={{ scale: 0.96 }}
        animate={isPulsing && !shouldReduceMotion ? {
          scale: [1, 1.04, 1],
        } : {}}
        transition={{ duration: 0.4, ease: [0.68, -0.55, 0.265, 1.55] }}
      >
        <Clock3 className="h-4 w-4 shrink-0" />
        <motion.span
          key={activeLabel}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[76px] truncate text-[9px] font-black uppercase tracking-[0.1em] text-white/76"
        >
          {activeLabel}
        </motion.span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <ChevronDown className="h-3 w-3 shrink-0 text-white/56" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
              mass: 0.6,
            }}
            className="fixed z-50 max-h-[min(420px,calc(100vh-150px))] overflow-y-auto rounded-[22px] border border-white/[0.08] bg-[#090909]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl no-scrollbar"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              width: menuPosition.width,
            }}
          >
            <div className="grid grid-cols-2 gap-1">
              {periodTabs.map((tab, index) => (
                <motion.button
                  key={tab.key}
                  type="button"
                  onClick={() => handlePeriodSelect(tab.key)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.18,
                    ease: [0.16, 1, 0.3, 1],
                    delay: index * 0.025,
                  }}
                  whileHover={activeTab !== tab.key ? {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    scale: 1.02,
                    transition: { duration: 0.15 }
                  } : {}}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-2 rounded-[16px] px-2.5 py-2 text-left text-[10px] font-black uppercase tracking-[0.1em] transition-colors relative overflow-hidden",
                    activeTab === tab.key
                      ? "bg-orange-500/16 text-orange-100"
                      : "text-white/46"
                  )}
                >
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="periodActiveIndicator"
                      className="absolute inset-0 bg-orange-500/16 rounded-[16px]"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <Clock3 className="h-3.5 w-3.5 shrink-0 relative z-10" />
                  <span className="relative z-10">{tab.label}</span>
                </motion.button>
              ))}
            </div>

            {activeTab === 'week' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="mt-2 border-t border-white/[0.06] pt-2"
              >
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { key: 'last-7' as ReplayWeekMode, label: '7 dias' },
                    { key: 'current' as ReplayWeekMode, label: 'Semana atual' }
                  ].map((option, index) => {
                    const isSelected = selectedSubValues.weekMode === option.key;
                    return (
                      <motion.button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          onSelectedSubValuesChange({ ...selectedSubValues, weekMode: option.key });
                          setIsOpen(false);
                        }}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16, delay: index * 0.04 }}
                        whileHover={!isSelected ? {
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          scale: 1.02,
                        } : {}}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "rounded-[14px] px-2.5 py-2 text-left text-[9px] font-black uppercase tracking-[0.08em] transition-colors relative overflow-hidden",
                          isSelected ? "bg-white/12 text-white" : "text-white/42"
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="weekModeIndicator"
                            className="absolute inset-0 bg-white/12 rounded-[14px]"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">{option.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeTab === 'month' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="mt-2 border-t border-white/[0.06] pt-2"
              >
                <div className="mb-2 flex gap-1 overflow-x-auto no-scrollbar" data-home-horizontal-scroll="true">
                  {years.map((year, index) => {
                    const isSelected = selectedSubValues.year === String(year);
                    return (
                      <motion.button
                        key={`month-year-${year}`}
                        type="button"
                        onClick={() => onSelectedSubValuesChange({ ...selectedSubValues, year: String(year) })}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.16, delay: index * 0.03 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1.5 text-[9px] font-black transition-colors relative",
                          isSelected ? "bg-orange-500/16 text-orange-100" : "bg-white/[0.04] text-white/44 hover:text-white/72"
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="yearIndicator"
                            className="absolute inset-0 bg-orange-500/16 rounded-full"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">{year}</span>
                      </motion.button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {availableMonths.map((month, index) => {
                    const value = String(index).padStart(2, '0');
                    const isSelected = selectedSubValues.month === value;
                    const isFuture = selectedYear > currentYear || (selectedYear === currentYear && index > currentMonth);
                    return (
                      <motion.button
                        key={month}
                        type="button"
                        disabled={isFuture}
                        onClick={() => {
                          if (isFuture) return;
                          onSelectedSubValuesChange({ ...selectedSubValues, month: value });
                          setIsOpen(false);
                        }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.14, delay: index * 0.015 }}
                        whileHover={!isFuture && !isSelected ? {
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          scale: 1.05,
                        } : {}}
                        whileTap={!isFuture ? { scale: 0.95 } : {}}
                        className={cn(
                          "rounded-[13px] px-2 py-1.5 text-[9px] font-black lowercase transition-colors disabled:cursor-not-allowed relative overflow-hidden",
                          isSelected ? "bg-white/13 text-white" : isFuture ? "text-white/13" : "text-white/44"
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="monthIndicator"
                            className="absolute inset-0 bg-white/13 rounded-[13px]"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">{month}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeTab === 'year' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="mt-2 border-t border-white/[0.06] pt-2"
              >
                <div className="grid grid-cols-3 gap-1">
                  {years.map((year, index) => {
                    const isSelected = selectedSubValues.year === String(year);
                    return (
                      <motion.button
                        key={year}
                        type="button"
                        onClick={() => {
                          onSelectedSubValuesChange({ ...selectedSubValues, year: String(year) });
                          setIsOpen(false);
                        }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.16, delay: index * 0.04 }}
                        whileHover={!isSelected ? {
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          scale: 1.05,
                        } : {}}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "rounded-[13px] px-2 py-1.5 text-[10px] font-black transition-colors relative overflow-hidden",
                          isSelected ? "bg-white/13 text-white" : "text-white/44"
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="yearFilterIndicator"
                            className="absolute inset-0 bg-white/13 rounded-[13px]"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">{year}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

type HomeHighlightKind = 'artists' | 'tracks' | 'albums';

const HomeHighlightCategoryControl = ({
  groups,
  activeGroup,
  onChange,
}: {
  groups: Array<{ key: HomeHighlightKind; tabLabel: string; icon: any }>;
  activeGroup: { key: HomeHighlightKind; tabLabel: string; icon: any };
  onChange: (kind: HomeHighlightKind) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const ActiveIcon = activeGroup.icon;

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const handleCategoryChange = (key: HomeHighlightKind) => {
    if (key === activeGroup.key) {
      setIsOpen(false);
      return;
    }

    setIsPulsing(true);
    onChange(key);
    setIsOpen(false);

    setTimeout(() => setIsPulsing(false), 400);
  };

  return (
    <div ref={menuRef} className="relative z-40 shrink-0">
      <motion.button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex h-9 items-center gap-1.5 rounded-full border border-orange-500/18 bg-orange-500/12 px-3 text-orange-100 shadow-[0_12px_24px_rgba(249,115,22,0.08)] transition-[background-color,border-color] hover:bg-orange-500/16 hover:border-orange-500/25"
        aria-label={`Categoria de destaque: ${activeGroup.tabLabel}`}
        aria-expanded={isOpen}
        whileTap={{ scale: 0.96 }}
        animate={isPulsing && !shouldReduceMotion ? {
          scale: [1, 1.05, 1],
          boxShadow: [
            '0 12px 24px rgba(249,115,22,0.08)',
            '0 16px 32px rgba(249,115,22,0.18)',
            '0 12px 24px rgba(249,115,22,0.08)',
          ],
        } : {}}
        transition={{ duration: 0.4, ease: [0.68, -0.55, 0.265, 1.55] }}
      >
        <motion.div
          animate={isPulsing && !shouldReduceMotion ? {
            rotate: [0, -8, 8, 0],
          } : {}}
          transition={{ duration: 0.35 }}
        >
          <ActiveIcon className="h-4 w-4 shrink-0" />
        </motion.div>
        <span className="max-w-[82px] truncate text-[9px] font-black uppercase tracking-[0.1em] text-white/78">
          {activeGroup.tabLabel}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <ChevronDown className="h-3 w-3 shrink-0 text-white/56" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
              mass: 0.6,
            }}
            className="absolute left-0 top-11 z-50 w-[182px] max-w-[calc(100vw-40px)] overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#090909]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            {groups.map((group, index) => {
              const Icon = group.icon;
              const isActive = group.key === activeGroup.key;
              return (
                <motion.button
                  key={group.key}
                  type="button"
                  onClick={() => handleCategoryChange(group.key)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.18,
                    ease: [0.16, 1, 0.3, 1],
                    delay: index * 0.03,
                  }}
                  whileHover={!isActive ? {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    scale: 1.02,
                    transition: { duration: 0.15 }
                  } : {}}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[16px] px-2.5 py-2 text-left text-[10px] font-black uppercase tracking-[0.1em] transition-colors relative overflow-hidden",
                    isActive
                      ? "bg-orange-500/16 text-orange-100"
                      : "text-white/46"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="categoryActiveIndicator"
                      className="absolute inset-0 bg-orange-500/16 rounded-[16px]"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <Icon className="h-3.5 w-3.5 shrink-0 relative z-10" />
                  <span className="relative z-10">{group.tabLabel}</span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HIGHLIGHT_VISUAL_CONFIG = {
  artists: {
    primary: { width: 136, height: 182 },
    secondary: { width: 94, height: 126 },
    primaryRadius: "rounded-[25px]",
    secondaryRadius: "rounded-[22px]",
    ringScale: "h-[230px] w-[230px]",
    dashScale: "h-[172px] w-[172px]",
  },
  tracks: {
    primary: { width: 158, height: 158 },
    secondary: { width: 112, height: 112 },
    primaryRadius: "rounded-[32px]",
    secondaryRadius: "rounded-[26px]",
    ringScale: "h-[220px] w-[220px]",
    dashScale: "h-[164px] w-[164px]",
  },
  albums: {
    primary: { width: 170, height: 170 },
    secondary: { width: 118, height: 118 },
    primaryRadius: "rounded-[24px]",
    secondaryRadius: "rounded-[20px]",
    ringScale: "h-[236px] w-[236px]",
    dashScale: "h-[178px] w-[178px]",
  },
} as const;

type HighlightVisualConfig = (typeof HIGHLIGHT_VISUAL_CONFIG)[HomeHighlightKind];

const HIGHLIGHT_CARD_GAP_PX = 8;
const HIGHLIGHT_SCROLL_OFFSET_PX = 8;
const HIGHLIGHT_NEAR_RANGE_MULTIPLIER = 1.15;
const HIGHLIGHT_FAR_RANGE_MULTIPLIER = 2.35;

const getHighlightStep = (config: HighlightVisualConfig) => config.secondary.width + HIGHLIGHT_CARD_GAP_PX;

const getHighlightLayoutLeft = (index: number, config: HighlightVisualConfig) => (
  index === 0
    ? 0
    : config.primary.width + HIGHLIGHT_CARD_GAP_PX + (index - 1) * getHighlightStep(config)
);

const getHighlightFocusX = (index: number, config: HighlightVisualConfig) => (
  Math.max(0, getHighlightLayoutLeft(index, config) - HIGHLIGHT_SCROLL_OFFSET_PX)
);

const buildHighlightCardMotionConfig = ({
  index,
  kind,
  config,
  shouldReduceMotion,
}: {
  index: number;
  kind: HomeHighlightKind;
  config: HighlightVisualConfig;
  shouldReduceMotion: boolean;
}) => {
  const step = getHighlightStep(config);
  const focusX = getHighlightFocusX(index, config);
  const baseWidth = index === 0 ? config.primary.width : config.secondary.width;
  const focusWidth = config.primary.width;
  const nearWidth = config.secondary.width * 0.94;
  const farWidth = config.secondary.width * 0.82;
  const rotationLimit = shouldReduceMotion
    ? 0
    : kind === 'albums'
      ? 12
      : kind === 'tracks'
        ? 10
        : 9;
  const translateXAmount = shouldReduceMotion ? 0 : Math.min(24, Math.round(step * 0.18));
  const inputRange = [
    focusX - step * HIGHLIGHT_FAR_RANGE_MULTIPLIER,
    focusX - step * HIGHLIGHT_NEAR_RANGE_MULTIPLIER,
    focusX,
    focusX + step * HIGHLIGHT_NEAR_RANGE_MULTIPLIER,
    focusX + step * HIGHLIGHT_FAR_RANGE_MULTIPLIER,
  ];

  return {
    inputRange,
    scaleOutput: shouldReduceMotion
      ? [1, 1, 1, 1, 1]
      : [
          farWidth / baseWidth,
          nearWidth / baseWidth,
          focusWidth / baseWidth,
          nearWidth / baseWidth,
          farWidth / baseWidth,
        ],
    rotateYOutput: shouldReduceMotion
      ? [0, 0, 0, 0, 0]
      : [
          -rotationLimit,
          rotationLimit * -0.45,
          0,
          rotationLimit * 0.45,
          rotationLimit,
        ],
    translateXOutput: shouldReduceMotion
      ? [0, 0, 0, 0, 0]
      : [
          translateXAmount,
          Math.round(translateXAmount * 0.45),
          0,
          Math.round(translateXAmount * -0.45),
          -translateXAmount,
        ],
    opacityOutput: [0.34, 0.72, 1, 0.72, 0.34],
    blurOutput: shouldReduceMotion ? [0, 0, 0, 0, 0] : [2.4, 0.9, 0, 0.9, 2.4],
    zIndexOutput: [20, 64, 120, 64, 20],
  };
};

const getHighlightMetricLabel = (item: any, kind: HomeHighlightKind) => {
  if (kind === 'tracks') return `${coreUtils.formatNumber(getReplayItemCount(item))} plays`;
  return `${coreUtils.formatNumber(getReplayMinutes(item))} min`;
};

const getHighlightDetailLabel = (item: any, kind: HomeHighlightKind) => {
  if (kind === 'tracks' || kind === 'albums') return getReplayItemArtist(item);
  return '';
};

const buildHighlightDetailItem = (item: any, kind: HomeHighlightKind) => ({
  ...item,
  type: kind === 'artists' ? 'artist' : kind === 'albums' ? 'album' : 'track',
  image: getReplayItemImage(item),
  artistName: getReplayItemArtist(item),
});

const HomeHighlightOrbitCard = ({
  item,
  index,
  kind,
  scrollX,
  visualConfig,
  isCentered,
  isSectionVisible,
  shouldReduceMotion,
  onItemClick,
}: {
  item: any;
  index: number;
  kind: HomeHighlightKind;
  scrollX: MotionValue<number>;
  visualConfig: HighlightVisualConfig;
  isCentered: boolean;
  isSectionVisible: boolean;
  shouldReduceMotion: boolean;
  onItemClick?: (item: any) => void;
}) => {
  const cardSize = index === 0 ? visualConfig.primary : visualConfig.secondary;
  const motionConfig = useMemo(
    () => buildHighlightCardMotionConfig({
      index,
      kind,
      config: visualConfig,
      shouldReduceMotion,
    }),
    [index, kind, shouldReduceMotion, visualConfig]
  );
  const translateX = useTransform(scrollX, motionConfig.inputRange, motionConfig.translateXOutput);
  const scale = useTransform(scrollX, motionConfig.inputRange, motionConfig.scaleOutput);
  const rotateY = useTransform(scrollX, motionConfig.inputRange, motionConfig.rotateYOutput);
  const opacity = useTransform(scrollX, motionConfig.inputRange, motionConfig.opacityOutput);
  const blurAmount = useTransform(scrollX, motionConfig.inputRange, motionConfig.blurOutput);
  const zIndex = useTransform(scrollX, motionConfig.inputRange, motionConfig.zIndexOutput);
  const pointerEvents = useTransform(opacity, [0, 0.32, 0.33, 1], ['none', 'none', 'auto', 'auto']);
  const transform = useMotionTemplate`translate3d(${translateX}px, 0px, 0px) scale(${scale}) rotateY(${rotateY}deg)`;
  const filter = useMotionTemplate`blur(${blurAmount}px)`;
  const isInteractive = Boolean(isCentered && onItemClick);
  const title = getReplayItemTitle(item);
  const detail = getHighlightDetailLabel(item, kind);
  const metric = getHighlightMetricLabel(item, kind);
  const handleActivate = useCallback(() => {
    if (!isInteractive) return;
    onItemClick?.(buildHighlightDetailItem(item, kind));
  }, [isInteractive, item, kind, onItemClick]);
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  }, [handleActivate, isInteractive]);

  return (
    <motion.div
      data-highlight-card="true"
      data-highlight-index={index}
      data-entity-stats-trigger={kind}
      data-entity-stats-active={isCentered ? 'true' : undefined}
      data-entity-stats-primary={index === 0 ? 'true' : undefined}
      data-entity-stats-satellite={index > 0 ? index + 1 : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `Abrir ${title}` : undefined}
      onClick={isInteractive ? handleActivate : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={cn(
        "relative shrink-0 snap-start",
        isInteractive && "cursor-pointer"
      )}
      style={{
        width: cardSize.width,
        height: cardSize.height,
        opacity,
        filter,
        zIndex,
        pointerEvents,
        transform,
        transformStyle: 'preserve-3d',
        willChange: 'transform, opacity, filter',
        backfaceVisibility: 'hidden',
      }}
    >
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0, rotateX: 0 } : { opacity: 0, scale: 0.7, y: 20, rotateX: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        transition={{
          type: 'spring',
          stiffness: 280,
          damping: 28,
          mass: 0.6,
          delay: index * 0.045,
        }}
        whileHover={isInteractive ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
        whileTap={isInteractive ? { scale: 0.98 } : undefined}
        className={cn(
          "relative h-full w-full overflow-hidden bg-black text-left",
          index === 0 ? visualConfig.primaryRadius : visualConfig.secondaryRadius,
          kind === 'albums'
            ? "ring-1 ring-white/12 shadow-[0_-2px_12px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.25)]"
            : "shadow-[0_-2px_12px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.25)]"
        )}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <motion.div
          className="relative h-full w-full"
          animate={isCentered && isSectionVisible && !shouldReduceMotion ? { y: [0, index === 0 ? -3 : -1.5, 0] } : {}}
          transition={isCentered && isSectionVisible && !shouldReduceMotion ? {
            duration: index === 0 ? 8.5 : 7 + index * 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
          } : {}}
        >
          <SmartImage src={getReplayItemImage(item)} className="h-full w-full object-cover" fallback={title} rounded="none" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/4 via-black/12 to-black/84" />
          <span
            className="absolute left-2 top-1.5 z-20 font-black leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            style={{ fontSize: index === 0 ? '24px' : '20px' }}
          >
            {index + 1}
          </span>
          <div className="absolute bottom-2 left-2 right-2 z-20 min-w-0">
            {detail && (
              <span
                className="mb-0.5 block truncate font-black uppercase tracking-[0.08em] text-white/62"
                style={{ fontSize: index === 0 ? '6.5px' : '5.5px' }}
              >
                {detail}
              </span>
            )}
            <span
              className="block truncate font-black leading-tight text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.7)]"
              style={{ fontSize: index === 0 ? '9.5px' : '8px' }}
            >
              {title}
            </span>
            <span
              className="mt-0.5 block truncate font-black uppercase tracking-[0.08em] text-orange-200/88"
              style={{ fontSize: index === 0 ? '7.5px' : '6.5px' }}
            >
              {metric}
            </span>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

const HomeHighlightOrbitStage = ({
  items,
  kind,
  stageHeight,
  isCentered,
  isSectionVisible,
  shouldReduceMotion,
  onItemClick,
}: {
  items: any[];
  kind: HomeHighlightKind;
  stageHeight: string;
  isCentered: boolean;
  isSectionVisible: boolean;
  shouldReduceMotion: boolean;
  onItemClick?: (item: any) => void;
}) => {
  const visualConfig = HIGHLIGHT_VISUAL_CONFIG[kind];
  const highlightsScrollRef = useRef<HTMLDivElement | null>(null);
  const { scrollX } = useScroll({ container: highlightsScrollRef });
  const maxScrollX = useMemo(
    () => Math.max(1, getHighlightFocusX(items.length - 1, visualConfig)),
    [items.length, visualConfig]
  );
  const ringOffsetX = useTransform(
    scrollX,
    [0, maxScrollX],
    [0, shouldReduceMotion ? 0 : Math.round(maxScrollX * -0.03)]
  );
  const dashOffsetX = useTransform(
    scrollX,
    [0, maxScrollX],
    [0, shouldReduceMotion ? 0 : Math.round(maxScrollX * -0.05)]
  );
  const glowOffsetX = useTransform(
    scrollX,
    [0, maxScrollX],
    [0, shouldReduceMotion ? 0 : Math.round(maxScrollX * -0.02)]
  );

  if (items.length === 0) return null;

  return (
    <div className={cn("relative mx-auto w-full max-w-[408px] overflow-visible", stageHeight)}>
      <div className="pointer-events-none absolute left-24 top-[54%] -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className={cn("rounded-full border border-white/[0.06]", visualConfig.ringScale)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 0.5, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ x: ringOffsetX, willChange: 'transform' }}
        />
      </div>
      <div className="pointer-events-none absolute left-24 top-[54%] -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className={cn("rounded-full border border-dashed border-orange-500/16", visualConfig.dashScale)}
          initial={{ opacity: 0, scale: 0.85, rotate: -45 }}
          animate={{
            opacity: [0, 0.3, 0.5],
            scale: 1,
            rotate: !shouldReduceMotion && isSectionVisible && isCentered ? 360 : 0,
          }}
          transition={{
            opacity: { duration: 0.6, ease: 'easeOut' },
            scale: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
            rotate: !shouldReduceMotion && isSectionVisible && isCentered
              ? { duration: 58, repeat: Infinity, ease: 'linear' }
              : { duration: 0.5 }
          }}
          style={{ x: dashOffsetX, willChange: 'transform' }}
        />
      </div>
      <div className="pointer-events-none absolute left-24 top-[54%] -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="h-[104px] w-[104px] rounded-full bg-orange-500/[0.05] blur-2xl"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ x: glowOffsetX, willChange: 'transform' }}
        />
      </div>

      <div
        ref={highlightsScrollRef}
        data-home-horizontal-scroll="true"
        className="absolute inset-x-0 bottom-2 z-20 flex items-end gap-2 overflow-x-auto no-scrollbar px-1 pb-1 pt-5 snap-x snap-mandatory"
      >
        {items.map((item, index) => (
          <HomeHighlightOrbitCard
            key={`${kind}-rank-${item.id || item.name || index}`}
            item={item}
            index={index}
            kind={kind}
            scrollX={scrollX}
            visualConfig={visualConfig}
            isCentered={isCentered}
            isSectionVisible={isSectionVisible}
            shouldReduceMotion={shouldReduceMotion}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
};

const HomeOrbitalHighlights = ({
  totalMinutes,
  artists,
  tracks,
  albums,
  activeTab,
  selectedSubValues,
  onActiveTabChange,
  onSelectedSubValuesChange,
  onItemClick
}: {
  totalMinutes: number;
  artists: any[];
  tracks: any[];
  albums: any[];
  activeTab: ReplayFilterPeriod;
  selectedSubValues: ReplaySelectedSubValues;
  onActiveTabChange: (tab: ReplayFilterPeriod) => void;
  onSelectedSubValuesChange: (values: ReplaySelectedSubValues) => void;
  onItemClick?: (item: any) => void;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { ref: sectionRef, isInViewport: isSectionVisible } = useViewportMotionGate<HTMLElement>({ rootMargin: '180px' });
  const [activeKind, setActiveKind] = useState<HomeHighlightKind>('artists');
  const [categoryDirection, setCategoryDirection] = useState(1);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);
  const [indicatorTouchStartX, setIndicatorTouchStartX] = useState<number | null>(null);
  const groups = useMemo<Array<{ key: HomeHighlightKind; title: string; tabLabel: string; icon: any; items: any[] }>>(() => [
    { key: 'artists' as const, title: 'Top artistas', tabLabel: 'Artistas', icon: UserCircle, items: artists.slice(0, 10) },
    { key: 'tracks' as const, title: 'Top músicas', tabLabel: 'Músicas', icon: Music2, items: tracks.slice(0, 12) },
    { key: 'albums' as const, title: 'Top álbuns', tabLabel: 'Álbuns', icon: Disc3, items: albums.slice(0, 10) }
  ].filter((group) => group.items.length > 0), [albums, artists, tracks]);

  // Controlar loading state quando os dados mudam
  useEffect(() => {
    if (isLoadingPeriod) {
      const timer = setTimeout(() => setIsLoadingPeriod(false), 800);
      return () => clearTimeout(timer);
    }
  }, [artists, tracks, albums, isLoadingPeriod]);

  useEffect(() => {
    if (groups.length === 0) return;
    if (!groups.some((group) => group.key === activeKind)) {
      setActiveKind(groups[0].key);
    }
  }, [activeKind, groups]);

  const stageHeight = "h-[238px] sm:h-[258px]";
  const activeGroup = groups.find((group) => group.key === activeKind) || groups[0];
  const periodLabel = getReplayFilterLabel(activeTab, selectedSubValues);

  const handleCategoryChange = useCallback((newKind: HomeHighlightKind) => {
    if (newKind === activeKind) return;

    // Haptic feedback no mobile
    if ('vibrate' in navigator && !shouldReduceMotion) {
      navigator.vibrate(10);
    }

    const currentIndex = groups.findIndex(g => g.key === activeKind);
    const newIndex = groups.findIndex(g => g.key === newKind);
    const direction = newIndex > currentIndex ? 1 : -1;

    setCategoryDirection(direction);
    setActiveKind(newKind);
  }, [activeKind, groups, shouldReduceMotion]);

  const handleIndicatorTouchStart = useCallback((e: React.TouchEvent) => {
    setIndicatorTouchStartX(e.touches[0].clientX);
  }, []);

  const handleIndicatorTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!indicatorTouchStartX) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = indicatorTouchStartX - touchEndX;

    if (Math.abs(diff) > 30) {
      // Haptic feedback no swipe
      if ('vibrate' in navigator && !shouldReduceMotion) {
        navigator.vibrate(15);
      }

      const currentIndex = groups.findIndex(g => g.key === activeKind);
      if (diff > 0 && currentIndex < groups.length - 1) {
        handleCategoryChange(groups[currentIndex + 1].key);
      } else if (diff < 0 && currentIndex > 0) {
        handleCategoryChange(groups[currentIndex - 1].key);
      }
    }
    setIndicatorTouchStartX(null);
  }, [activeKind, groups, indicatorTouchStartX, handleCategoryChange, shouldReduceMotion]);

  if (groups.length === 0) return null;

  return (
    <section ref={sectionRef} className="relative mb-7 overflow-visible px-4 pb-1 sm:px-6 lg:px-8">
      <div className="relative overflow-visible rounded-[34px] px-0 pb-1 pt-1">
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={isSectionVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -15 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-2.5 flex items-center justify-between gap-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={isSectionVisible ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -180 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.68, -0.55, 0.265, 1.55] }}
            >
              <Sparkles className="h-5 w-5 shrink-0 text-orange-500" />
            </motion.div>
            <h2 className="shrink-0 text-[12px] font-black uppercase tracking-[0.28em] text-white/86">Seus Destaques</h2>
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isSectionVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="shrink-0 rounded-full bg-orange-500/12 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] text-orange-200"
            >
              {periodLabel}
            </motion.span>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isSectionVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/28 px-2.5 py-1.5"
          >
            <PlayCircle className="h-3.5 w-3.5 text-orange-300" />
            <span className="text-[10px] font-black text-white">{coreUtils.formatNumber(totalMinutes)}</span>
            <span className="text-[7px] font-black uppercase tracking-[0.12em] text-white/38">min</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={isSectionVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mb-1.5 flex items-center gap-2"
        >
          {groups.length > 1 && (
            <HomeHighlightCategoryControl
              groups={groups}
              activeGroup={activeGroup}
              onChange={handleCategoryChange}
            />
          )}
          <HomeHighlightPeriodControls
            activeTab={activeTab}
            selectedSubValues={selectedSubValues}
            onActiveTabChange={onActiveTabChange}
            onSelectedSubValuesChange={onSelectedSubValuesChange}
            onPeriodLoading={() => setIsLoadingPeriod(true)}
          />
        </motion.div>

        <div
          data-home-horizontal-scroll="true"
          className="relative mt-1 select-none overflow-visible"
        >
          {/* Loading shimmer overlay */}
          <AnimatePresence>
            {isLoadingPeriod && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-50 flex items-center justify-center rounded-[34px] bg-black/40 backdrop-blur-sm"
              >
                <div className="relative">
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="h-8 w-8 rounded-full border-2 border-orange-500/30 border-t-orange-500"
                  />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="absolute inset-0 h-8 w-8 rounded-full border-2 border-transparent border-t-orange-500"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <article className="relative mx-auto w-full max-w-[430px] overflow-visible [perspective:1200px]">
            <div className={cn("relative z-10 mx-auto w-full max-w-[430px] overflow-visible", stageHeight)}>
              <AnimatePresence mode="wait" initial={false} custom={categoryDirection}>
                <motion.div
                  key={`highlight-orbit-${activeGroup.key}`}
                  className="absolute inset-0"
                  custom={categoryDirection}
                  initial={{
                    opacity: 0,
                    x: categoryDirection * 30,
                    scale: 0.95,
                    rotateY: categoryDirection * 5,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: 1,
                    rotateY: 0,
                  }}
                  exit={{
                    opacity: 0,
                    x: categoryDirection * -30,
                    scale: 0.92,
                    rotateY: categoryDirection * -5,
                }}
                  transition={{
                    duration: 0.45,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <HomeHighlightOrbitStage
                    items={activeGroup.items}
                    kind={activeGroup.key}
                    stageHeight={stageHeight}
                    isCentered
                    isSectionVisible={isSectionVisible}
                    shouldReduceMotion={shouldReduceMotion}
                    onItemClick={onItemClick}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <div
              className="flex justify-center gap-1.5 mt-4"
              onTouchStart={handleIndicatorTouchStart}
              onTouchEnd={handleIndicatorTouchEnd}
            >
              {groups.map((group, index) => {
                const isActive = group.key === activeGroup.key;
                return (
                  <motion.button
                    key={`highlight-category-${group.key}`}
                    type="button"
                    onClick={() => handleCategoryChange(group.key)}
                    className={cn(
                      "h-1.5 rounded-full transition-colors relative overflow-hidden",
                      isActive ? "w-5" : "w-1.5"
                    )}
                    whileHover={!isActive ? { scale: 1.2, backgroundColor: 'rgba(255, 255, 255, 0.3)' } : {}}
                    whileTap={{ scale: 0.9 }}
                    animate={{
                      width: isActive ? 20 : 6,
                      backgroundColor: isActive ? 'rgb(249, 115, 22)' : 'rgba(255, 255, 255, 0.18)',
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                    aria-label={`Ver ${group.tabLabel.toLowerCase()}`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeCategoryIndicator"
                        className="absolute inset-0 bg-orange-500 rounded-full"
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 35,
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

const latestDiscoveryCache = new Map<string, any>();

const HomePerceptions = ({
  tracks,
  artists,
  userId,
  activeTab,
  selectedSubValues,
}: {
  tracks: any[];
  artists: any[];
  userId: string;
  activeTab: ReplayFilterPeriod;
  selectedSubValues: ReplaySelectedSubValues;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { ref: sectionRef, isInViewport: isSectionVisible } = useViewportMotionGate<HTMLElement>({ rootMargin: '180px' });
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [latestDiscovery, setLatestDiscovery] = useState<any>(
    () => latestDiscoveryCache.get(userId) || null
  );
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const topTrack = tracks[0];
  const lowRepeatTrack = tracks.find((track) => getReplayItemCount(track) <= 2) || tracks[tracks.length - 1];
  const topTrackArtist = topTrack ? getReplayItemArtist(topTrack) : '';
  const lowRepeatArtist = lowRepeatTrack ? getReplayItemArtist(lowRepeatTrack) : '';
  const discoveryTrack = latestDiscovery?.coverage?.complete
    ? latestDiscovery.item?.track || latestDiscovery.item
    : null;
  const discoveryArtist = discoveryTrack ? getReplayItemArtist(discoveryTrack) : '';
  const discoveryDate = latestDiscovery?.firstPlayedAt
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(latestDiscovery.firstPlayedAt))
    : '';
  const periodSentence = getPerceptionPeriodSentence(activeTab, selectedSubValues);
  const perceptions = [
    topTrack && {
      title: 'Ritual recente',
      text: `Você ouviu ${topTrack.name || topTrack.track?.name}${topTrackArtist ? `, de ${topTrackArtist}` : ''}, ${coreUtils.formatNumber(getReplayItemCount(topTrack))} vezes ${periodSentence}.`,
      icon: Music2,
      image: getReplayItemImage(topTrack),
    },
    artists[0] && {
      title: 'Sequência',
      text: `${artists[0].name} dominou seus charts ${periodSentence} com ${coreUtils.formatNumber(getReplayItemCount(artists[0]))} reproduções.`,
      icon: UserCircle,
      image: getReplayItemImage(artists[0]),
    },
    lowRepeatTrack && {
      title: 'Baixa repetição',
      text: `${lowRepeatTrack.name || lowRepeatTrack.track?.name}${lowRepeatArtist ? `, de ${lowRepeatArtist}` : ''}, foi uma das faixas que você menos repetiu ${periodSentence}.`,
      icon: Sparkles,
      image: getReplayItemImage(lowRepeatTrack),
    },
    discoveryTrack && discoveryDate && {
      title: 'Última descoberta',
      text: `${discoveryTrack.name || 'Uma faixa nova'}${discoveryArtist ? `, de ${discoveryArtist}` : ''}, foi a última faixa nova que você reproduziu, em ${discoveryDate}.`,
      icon: Clock3,
      image: getReplayItemImage(discoveryTrack),
    },
  ].filter(Boolean) as Array<{ title: string; text: string; icon: any; image?: string }>;

  useEffect(() => {
    setLatestDiscovery(latestDiscoveryCache.get(userId) || null);
  }, [userId]);

  useEffect(() => {
    if (!isSectionVisible || !userId || latestDiscoveryCache.has(userId)) return;
    const controller = new AbortController();
    statsService.getLatestDiscovery(userId, controller.signal)
      .then((response) => {
        latestDiscoveryCache.set(userId, response);
        setLatestDiscovery(response);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [isSectionVisible, userId]);

  useEffect(() => {
    if (activeIndex >= perceptions.length) setActiveIndex(0);
  }, [activeIndex, perceptions.length]);

  const advance = useCallback(() => {
    if (perceptions.length < 2) return;
    setDirection(1);
    setActiveIndex((index) => (index + 1) % perceptions.length);
  }, [perceptions.length]);

  const { restart: restartRotation, interactionProps } = useAutoOrbitRotation({
    enabled: isSectionVisible && !shouldReduceMotion && perceptions.length > 1,
    intervalMs: 5500,
    onAdvance: advance,
  });

  const goTo = useCallback((index: number, nextDirection?: number) => {
    if (perceptions.length === 0) return;
    setDirection(nextDirection || (index >= activeIndex ? 1 : -1));
    setActiveIndex((index + perceptions.length) % perceptions.length);
    restartRotation();
  }, [activeIndex, perceptions.length, restartRotation]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      event.stopPropagation();
    }
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 38 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    goTo(activeIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  }, [activeIndex, goTo]);

  if (perceptions.length === 0) return null;
  const activePerception = perceptions[activeIndex] || perceptions[0];
  const ActivePerceptionIcon = activePerception.icon;
  const satellitePositions = [
    { x: -132, y: -62, size: 54, opacity: 0.58 },
    { x: 132, y: -48, size: 50, opacity: 0.52 },
    { x: 116, y: 76, size: 46, opacity: 0.42 },
  ];

  return (
    <section ref={sectionRef} className="mt-5 px-4 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-orange-500" />
        <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/86">Perceptions</h2>
      </div>
      <div
        data-home-horizontal-scroll="true"
        className="relative mx-auto h-[244px] max-w-[430px] select-none overflow-visible [perspective:1000px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null; }}
        {...interactionProps}
      >
        <div className="pointer-events-none absolute left-1/2 top-[46%] h-[226px] w-[226px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.055]" />
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[46%] h-[164px] w-[164px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-orange-500/14"
          animate={!shouldReduceMotion && isSectionVisible ? { rotate: -360 } : {}}
          transition={!shouldReduceMotion && isSectionVisible ? { duration: 46, repeat: Infinity, ease: 'linear' } : {}}
        />
        <div className="pointer-events-none absolute left-1/2 top-[48%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.035] blur-2xl" />

        {perceptions.map((item, index) => {
          const relative = (index - activeIndex + perceptions.length) % perceptions.length;
          if (relative === 0 || relative > 3) return null;
          const position = satellitePositions[relative - 1] || satellitePositions[0];
          return (
            <motion.div
              key={`perception-sat-${item.title}-${index}`}
              onClick={() => goTo(index)}
              className="absolute left-1/2 top-[45%] overflow-hidden rounded-[18px] bg-black shadow-[0_16px_34px_rgba(0,0,0,0.42)]"
              initial={{ opacity: 0, scale: 0.72, x: `calc(-50% + ${position.x}px)`, y: `calc(-50% + ${position.y + 10}px)` }}
              animate={{
                opacity: position.opacity,
                scale: 1,
                x: `calc(-50% + ${position.x}px)`,
                y: `calc(-50% + ${position.y}px)`,
              }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: 0.025 * relative }}
              style={{ width: position.size, height: position.size }}
            >
              <motion.div
                className="relative h-full w-full"
                animate={!shouldReduceMotion && isSectionVisible ? {
                  y: [0, relative % 2 === 0 ? 2 : -2, 0],
                  rotate: [0, relative % 2 === 0 ? -0.45 : 0.45, 0],
                } : {}}
                transition={!shouldReduceMotion && isSectionVisible ? {
                  duration: 6.2 + relative * 0.45,
                  repeat: Infinity,
                  ease: 'easeInOut',
                } : {}}
              >
                {item.image ? <SmartImage src={item.image} className="h-full w-full object-cover" rounded="none" fallback={item.title} /> : null}
                <div className="absolute inset-0 bg-black/20" />
              </motion.div>
            </motion.div>
          );
        })}

        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.article
            key={`perception-active-${activePerception.title}`}
            custom={direction}
            className="absolute left-1/2 top-[50%] z-30 grid w-[82%] -translate-x-1/2 -translate-y-1/2 grid-cols-[78px_minmax(0,1fr)] gap-4"
            initial={{ opacity: 0, scale: 0.94, x: direction * 28 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.94, x: direction * -28 }}
            transition={{ type: 'spring', stiffness: 250, damping: 25, mass: 0.7 }}
          >
            <motion.div
              animate={!shouldReduceMotion && isSectionVisible ? { y: [0, -4, 2, 0], rotate: [0, 0.35, -0.25, 0] } : {}}
              transition={!shouldReduceMotion && isSectionVisible ? { duration: 9.5, repeat: Infinity, ease: 'easeInOut' } : {}}
              className="relative h-[78px] w-[78px] overflow-hidden rounded-[24px] bg-black shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
            >
              {activePerception.image ? <SmartImage src={activePerception.image} className="h-full w-full object-cover" rounded="none" fallback={activePerception.title} /> : null}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
              <div className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-xl bg-orange-600/90 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                <ActivePerceptionIcon className="h-3.5 w-3.5 text-white" />
              </div>
            </motion.div>
            <div className="min-w-0 self-center">
              <span className="block text-[8px] font-black uppercase tracking-[0.22em] text-orange-300">{activePerception.title}</span>
              <p className="mt-1.5 line-clamp-4 text-[12px] font-black leading-snug text-white/92">{activePerception.text}</p>
            </div>
          </motion.article>
        </AnimatePresence>

        {perceptions.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-40 flex justify-center gap-1.5">
            {perceptions.map((item, index) => (
              <button
                key={`perception-dot-${item.title}`}
                type="button"
                onClick={() => goTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color]",
                  index === activeIndex ? "w-5 bg-orange-500" : "w-1.5 bg-white/18"
                )}
                aria-label={`Abrir ${item.title}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const HomeRecentPlays = ({
  user,
  recent,
  onFullHistoryClick,
  onTrackClick,
}: {
  user: any;
  recent: any[];
  onFullHistoryClick?: () => void;
  onTrackClick?: (track: any, item?: any) => void;
}) => {
  return (
    <section className="px-4 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-orange-500" />
          <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/86">Últimas Reproduções</h2>
        </div>
      </div>
      <FriendHistoryCard
        key={`home-recent-${user.id}`}
        user={user}
        index={0}
        defaultExpanded
        recentOverride={recent}
        maxInlineItems={10}
        onHistoryItemClick={(item) => onTrackClick?.(item.track, item)}
        onFullHistoryClick={onFullHistoryClick}
        showFullHistoryButton
        showInlineHistory
        showInlineOrbitButton={false}
      />
    </section>
  );
};

const HomeEmptyState = ({ onRetry }: { onRetry: () => void }) => (
  <motion.div
    key="empty-group"
    initial={{ opacity: 0, scale: 0.96, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    className="glass-card mx-4 sm:mx-6 lg:mx-8 flex flex-col items-center justify-center gap-5 rounded-[36px] border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent px-7 py-10 text-center shadow-2xl"
  >
    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-orange-500/20 bg-orange-500/10">
      <Users className="h-6 w-6 text-orange-400" />
    </div>
    <div className="flex max-w-sm flex-col gap-2">
      <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/90">Carregando círculo</h2>
      <p className="text-xs font-medium leading-relaxed text-white/50">
        Ainda não encontramos membros válidos para montar a Home. Tente sincronizar novamente.
      </p>
    </div>
    <button
      type="button"
      onClick={onRetry}
      className="flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_25px_rgba(234,88,12,0.28)] active:scale-95"
    >
      <RefreshCcw className="h-4 w-4" />
      Tentar novamente
    </button>
  </motion.div>
);

const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const SAO_PAULO_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const getSaoPauloDayKey = (date: Date) => {
  const parts = Object.fromEntries(
    SAO_PAULO_DAY_FORMATTER.formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const REPLAY_MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

const getReplayQuery = (activeTab: ReplayFilterPeriod, selected: ReplaySelectedSubValues): ReplayPeriodQuery => {
  const now = new Date();
  if (activeTab === 'today') {
    return { period: 'today', after: getStartOfDay(now), limit: 30 };
  }
  if (activeTab === 'week') {
    if (selected.weekMode === 'current') {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      return { period: 'week', after: getStartOfDay(monday), before: now.getTime(), limit: 30 };
    }
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { period: 'week', after: getStartOfDay(sevenDaysAgo), before: now.getTime(), limit: 30 };
  }
  if (activeTab === 'month') {
    const month = Number(selected.month ?? now.getMonth());
    const year = Number(selected.year || now.getFullYear());
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    return { period: 'month', after: start.getTime(), before: end.getTime(), limit: 30 };
  }
  if (activeTab === 'year') {
    const year = Number(selected.year || now.getFullYear());
    return { period: 'year', after: new Date(year, 0, 1).getTime(), before: new Date(year + 1, 0, 1).getTime(), limit: 30 };
  }
  return { period: 'all', limit: 30 };
};

const getReplayModalPeriod = (activeTab: ReplayFilterPeriod, selected: ReplaySelectedSubValues) => {
  const now = new Date();
  if (activeTab === 'today') return 'hoje';
  if (activeTab === 'week') return selected.weekMode === 'current' ? 'esta semana' : 'últimos 7 dias';
  if (activeTab === 'month') {
    const month = Number(selected.month ?? now.getMonth());
    return `${REPLAY_MONTHS_LONG[month] || 'mês'} de ${selected.year || now.getFullYear()}`;
  }
  if (activeTab === 'year') return selected.year || String(now.getFullYear());
  return 'total';
};

const getPerceptionPeriodSentence = (
  activeTab: ReplayFilterPeriod,
  selected: ReplaySelectedSubValues
) => {
  const now = new Date();
  if (activeTab === 'today') return 'hoje';
  if (activeTab === 'week') {
    return selected.weekMode === 'current' ? 'nesta semana' : 'nos últimos 7 dias';
  }
  if (activeTab === 'month') {
    const month = Number(selected.month ?? now.getMonth());
    return `em ${REPLAY_MONTHS_LONG[month] || 'mês'} de ${selected.year || now.getFullYear()}`;
  }
  if (activeTab === 'year') return `em ${selected.year || now.getFullYear()}`;
  return 'em todo o histórico';
};

const getReplayMinutes = (item: any) => {
  const durationMs = item?.durationMs ?? item?.totalDurationMs ?? item?.playedDurationMs ?? item?.playDurationMs;
  if (Number.isFinite(durationMs) && durationMs > 0) return Math.max(1, Math.round(durationMs / 60000));
  return Math.round(item?.minutes ?? item?.playedMinutes ?? item?.streams ?? item?.playcount ?? item?.playedCount ?? item?.count ?? 0);
};

const getReplayDurationMs = (item: any) => {
  const durationMs = item?.durationMs ?? item?.totalDurationMs ?? item?.playedDurationMs ?? item?.playDurationMs;
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
};

const getReplayFallbackTotalMinutes = (tracks: any[], totalSongs?: number) => {
  const summedTrackDuration = tracks.reduce((total, track) => total + getReplayDurationMs(track), 0);
  if (summedTrackDuration > 0) return Math.max(1, Math.round(summedTrackDuration / 60000));
  if (Number.isFinite(totalSongs) && totalSongs && totalSongs > 0) {
    return totalSongs;
  }
  return tracks.reduce((total, track) => total + getReplayMinutes(track), 0);
};

const getReplayArtistName = (item: any) => {
  const candidates = [
    item?.albumArtist,
    item?.albumArtistName,
    item?.album?.artist,
    item?.album?.artistName,
    item?.album?.primaryArtist,
    item?.album?.primaryArtistName,
    item?.primaryArtist,
    item?.primaryArtistName,
    item?.artistName,
    item?.artist,
    Array.isArray(item?.artists) ? item.artists[0] : undefined,
    item?.track?.primaryArtist,
    item?.track?.primaryArtistName,
    item?.track?.artistName,
    Array.isArray(item?.track?.artists) ? item.track.artists[0] : undefined
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (candidate && typeof candidate === 'object') {
      const name = candidate.name || candidate.artistName || candidate.displayName;
      if (typeof name === 'string' && name.trim()) return name;
    }
  }
  return 'Artista Desconhecido';
};

const getReplayAlbumArtistName = (album: any, tracks: any[]) => {
  const directArtist = getReplayArtistName(album);
  if (directArtist !== 'Artista Desconhecido') return directArtist;

  // Defesa: tracks pode ser undefined ao restaurar do cache
  if (!Array.isArray(tracks) || tracks.length === 0) return directArtist;

  const albumName = coreUtils.normalizeText(album?.name);
  const albumImage = album?.image || album?.albumImage;
  const albumId = album?.id || album?.albumId || album?.album?.id;
  const matchingTrack = tracks.find((track) => {
    const trackAlbumId = track?.albumId || track?.album?.id;
    const trackAlbumName = coreUtils.normalizeText(track?.albumName || track?.album?.name);
    const trackAlbumImage = track?.albumImage || track?.album?.image || track?.image;
    return (
      (albumId && trackAlbumId && String(albumId) === String(trackAlbumId)) ||
      (albumName && trackAlbumName && albumName === trackAlbumName) ||
      (albumImage && trackAlbumImage && albumImage === trackAlbumImage)
    );
  });

  return matchingTrack ? getReplayArtistName(matchingTrack) : directArtist;
};

const firstExternalId = (value: any) => {
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item.trim());
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const getReplayTrackUrl = (track: any) => {
  const directUrl = track?.url || track?.externalUrl || track?.spotifyUrl || track?.appleMusicUrl;
  if (typeof directUrl === 'string' && directUrl.trim()) return directUrl;

  const spotifyId = track?.spotifyId || firstExternalId(track?.externalIds?.spotify) || firstExternalId(track?.track?.externalIds?.spotify);
  if (spotifyId) return `https://open.spotify.com/track/${spotifyId}`;

  const appleMusicId = track?.appleMusicId || firstExternalId(track?.externalIds?.appleMusic) || firstExternalId(track?.track?.externalIds?.appleMusic);
  if (appleMusicId) return `https://music.apple.com/search?term=${encodeURIComponent(`${track?.name || ''} ${getReplayArtistName(track)}`.trim())}`;

  if (track?.name) return `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${getReplayArtistName(track)}`)}`;
  return '';
};

export default function HomeScreen() {
  const hasBootReadySession = () => {
    return window.__STATS_LC_HOME_READY__ === true || window.sessionStorage?.getItem('stats-lc-home-boot-ready') === '1';
  };
  const groupStats = useStatsStore(state => state.groupStats);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const liveStreamsTodayByUserId = useStatsStore(state => state.liveStreamsTodayByUserId);
  const isLoading = useStatsStore(state => state.isLoading);
  const isRefreshing = useStatsStore(state => state.isRefreshing);
  const isOffline = useStatsStore(state => state.isOffline);
  const error = useStatsStore(state => state.error);
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const getHistoryCache = useStatsStore(state => state.getHistoryCache);
  const setHistoryCache = useStatsStore(state => state.setHistoryCache);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const setFeaturedUserId = useStatsStore(state => state.setFeaturedUserId);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [viewingFullHistoryUser, setViewingFullHistoryUser] = useState<any>(null);
  const [viewingAlbumHistoryUser, setViewingAlbumHistoryUser] = useState<any>(null);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [avatarClickPosition, setAvatarClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const [processedItems, setProcessedItems] = useState(0);
  const [refreshStepText, setRefreshStepText] = useState('Status: Ciclo Sincronizado');
  const [refreshProgress, setRefreshProgress] = useState(100);
  const [headerHighlight, setHeaderHighlight] = useState(false);
  const [isAppReady, setIsAppReady] = useState(() => hasBootReadySession());
  const [isVisualWarmupReady, setIsVisualWarmupReady] = useState(false);
  const [showInitialModal, setShowInitialModal] = useState(false);
  const [replayState, setReplayState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [replayTopItems, setReplayTopItems] = useState<{ artists: any[]; tracks: any[]; albums: any[] }>({
    artists: [],
    tracks: [],
    albums: []
  });
  const [recentPrepState, setRecentPrepState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [, setTrackModalPrepState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [resolvedRecentPlays, setResolvedRecentPlays] = useState<any[]>([]);
  const [replayTotalMinutesCount, setReplayTotalMinutesCount] = useState(0);
  const [openReplayModal, setOpenReplayModal] = useState<'artists' | 'songs' | 'albums' | null>(null);
  const [replayActiveTab, setReplayActiveTab] = useState<ReplayFilterPeriod>('month');
  const [replaySelectedSubValues, setReplaySelectedSubValues] = useState<ReplaySelectedSubValues>({
    weekMode: 'last-7',
    month: String(new Date().getMonth()).padStart(2, '0'),
    year: String(new Date().getFullYear())
  });
  const toastIdRef = useRef(0);
  const wasHomeReadyAtMountRef = useRef(hasBootReadySession());
  const hasReleasedHomeRef = useRef(wasHomeReadyAtMountRef.current);
  const shouldSkipHomeEntryMotion = wasHomeReadyAtMountRef.current;

  useEffect(() => {
    if (!hasReleasedHomeRef.current) return;
    window.__STATS_LC_HOME_READY__ = true;
    window.dispatchEvent(new CustomEvent('stats-lc-home-ready', { detail: { ready: true } }));
    setIsAppReady(true);
    window.__STATS_LC_DISMISS_SPLASH__?.();
  }, []);

  useEffect(() => {
    if (!isAppReady) return;
    window.__STATS_LC_HOME_READY__ = true;
    window.sessionStorage?.setItem('stats-lc-home-boot-ready', '1');
  }, [isAppReady]);

  const allMembers = useMemo(() => getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId) || [], [groupStats, liveNowPlayingByUserId]);
  const members = useMemo(() => getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId) || [], [groupStats, hiddenUsers, liveNowPlayingByUserId]);

  useEffect(() => {
    if (!allMembers.length) return;
    const requestedSlug = normalizeProfileSlug(location.pathname.replace(/^\/+/, ''));
    if (!requestedSlug) return;

    const requestedMember = allMembers.find((member: any) => getProfileSlugCandidates(member).has(requestedSlug));
    if (!requestedMember?.id || requestedMember.id === featuredUserId) return;

    setFeaturedUserId(requestedMember.id);
    localStorage.setItem('stats-lc-has-selected-user', '1');
    setShowInitialModal(false);
  }, [allMembers, featuredUserId, location.pathname, setFeaturedUserId]);

  const primaryUser = useMemo(() => {
    if (!groupStats) return null;
    // Prioriza allMembers para permitir usuário oculto como featuredUserId
    return (
      allMembers.find(m => m.id === featuredUserId) ||
      members.find(m => m.id === featuredUserId) ||
      members[0] ||
      allMembers[0] ||
      null
    );
  }, [allMembers, featuredUserId, groupStats, members]);
  const FEATURED_ID = primaryUser?.id || '';
  const liveTodayStats = primaryUser?.id ? liveStreamsTodayByUserId[primaryUser.id] : undefined;
  const currentSaoPauloDay = getSaoPauloDayKey(new Date());
  const displayedHeaderStreamsToday = liveTodayStats
    ? liveTodayStats.day === currentSaoPauloDay ? liveTodayStats.streams : 0
    : primaryUser?.streamsToday ?? 0;

  const primaryTrack = primaryUser?.nowPlaying?.track as any;
  const primaryAlbumImage = (
    primaryTrack?.albumImage ||
    primaryTrack?.album?.image ||
    primaryTrack?.album?.images?.[0]?.url ||
    primaryTrack?.album?.images?.[0] ||
    primaryTrack?.image ||
    primaryTrack?.images?.[0]?.url ||
    primaryTrack?.images?.[0] ||
    primaryTrack?.albumArt ||
    primaryTrack?.coverArt ||
    primaryTrack?.cover_art ||
    primaryTrack?.album_image ||
    primaryTrack?.cover ||
    ''
  );
  const friendActivityOffset = "-mt-16";
  const replayPeriodQuery = useMemo(
    () => getReplayQuery(replayActiveTab, replaySelectedSubValues),
    [replayActiveTab, replaySelectedSubValues]
  );
  const replayPeriodKey = useMemo(
    () => JSON.stringify({
      period: replayPeriodQuery.period,
      after: replayPeriodQuery.after,
      before: replayPeriodQuery.before,
      limit: replayPeriodQuery.limit,
      force: replayPeriodQuery.force
    }),
    [replayPeriodQuery]
  );
  const membersSignature = useMemo(
    () => members.map((member) => member.id).filter(Boolean).join('|'),
    [members]
  );
  const bootRecentPlays = useMemo(() => {
    if (!primaryUser?.id) return [];
    const directRecent = normalizeHomeRecentItems(primaryUser?.recent || (primaryUser as any)?.history || []);
    const cachedRecent = normalizeHomeRecentItems(getHistoryCache(primaryUser.id) || []);
    const sessionRecent = normalizeHomeRecentItems(readHomeSessionCache<any[]>(getHomeRecentCacheKey(primaryUser.id)) || []);
    return ([cachedRecent, sessionRecent, directRecent].sort((a, b) => b.length - a.length)[0] || []).slice(0, 10);
  }, [getHistoryCache, primaryUser?.id, primaryUser?.recent, (primaryUser as any)?.history]);

  const criticalRecentPlays = resolvedRecentPlays.length > 0 ? resolvedRecentPlays : bootRecentPlays;

  const pipelineStreamLinesMemo = useMemo(() => [
    { left: '16.6%', duration: 2.2, delay: 0 },
    { left: '33.2%', duration: 3.1, delay: 0.35 },
    { left: '49.8%', duration: 2.6, delay: 0.7 },
    { left: '66.4%', duration: 3.4, delay: 0.2 },
    { left: '83%', duration: 2.9, delay: 0.95 },
    { left: '91.5%', duration: 3.7, delay: 0.55 },
  ], []);

  const homeWarmupImageUrls = useMemo(() => {
    const activeFriends = members
      .filter((member) => member.id !== primaryUser?.id)
      .slice(0, 3);
    const urls = [
      primaryAlbumImage,
      primaryUser ? coreUtils.getUserAvatar(primaryUser.id, primaryUser.avatar) : '',
      ...activeFriends.map((member) => coreUtils.getUserAvatar(member.id, member.avatar)),
      ...activeFriends.map((member) => {
        const track = member?.nowPlaying?.track as any;
        return track?.albumImage || track?.album?.image || track?.album?.images?.[0]?.url || track?.album?.images?.[0] || track?.image || '';
      }),
      ...criticalRecentPlays.slice(0, 3).map(getRecentArtworkUrl),
    ];
    return Array.from(new Set(urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 5)));
  }, [criticalRecentPlays, members, primaryAlbumImage, primaryUser?.avatar, primaryUser?.id]);

  useEffect(() => {
    if (!primaryUser) {
      setIsVisualWarmupReady(false);
      return;
    }

    const urls = homeWarmupImageUrls;

    if (urls.length === 0) {
      setIsVisualWarmupReady(true);
      return;
    }

    let cancelled = false;
    if (!hasReleasedHomeRef.current) {
      setIsVisualWarmupReady(false);
    }

    const visualPreparation = preloadSmartImages(urls);
    if (document.visibilityState === 'hidden') {
      setIsVisualWarmupReady(true);
      return () => {
        cancelled = true;
      };
    }

    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, HOME_CRITICAL_WARMUP_TIMEOUT_MS));
    Promise.race([
      visualPreparation,
      timeout,
    ]).then(() => {
      if (cancelled) return;
      setIsVisualWarmupReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [homeWarmupImageUrls, primaryUser?.id]);

  useEffect(() => {
    const handleNowPlaying = (event: any) => {
      const { userId } = event.detail || {};
      if (userId === featuredUserId) {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReduced) {
          setHeaderHighlight(true);
          const timer = setTimeout(() => {
            setHeaderHighlight(false);
          }, 3000);
          return () => clearTimeout(timer);
        }
      }
    };
    window.addEventListener('nowPlayingChanged', handleNowPlaying);
    return () => window.removeEventListener('nowPlayingChanged', handleNowPlaying);
  }, [featuredUserId]);

  const showToast = useCallback((title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${toastIdRef.current++}`;
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setToasts(prev => [...prev, { id, title, message, type, timestamp }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  useEffect(() => {
    if (!isRefreshing) {
      setRefreshStepText('Status: Ciclo Sincronizado');
      setRefreshProgress(100);
      setProcessedItems(0);
      return;
    }

    const steps = [
      { text: 'Validando cache local', progress: 18, items: 2 },
      { text: 'Consultando grupo', progress: 42, items: 8 },
      { text: 'Atualizando destaques', progress: 68, items: 18 },
      { text: 'Persistindo snapshot', progress: 88, items: 26 },
      { text: 'Sincronia concluindo', progress: 96, items: 32 },
    ];
    let index = 0;

    setRefreshStepText(steps[0].text);
    setRefreshProgress(steps[0].progress);
    setProcessedItems(steps[0].items);

    const timer = window.setInterval(() => {
      index = Math.min(index + 1, steps.length - 1);
      setRefreshStepText(steps[index].text);
      setRefreshProgress(steps[index].progress);
      setProcessedItems(steps[index].items);
    }, 700);

    return () => window.clearInterval(timer);
  }, [isRefreshing]);
  
  useEffect(() => {
    // Busca inicial se não houver dados no store
    if (!groupStats && !isLoading) {
      fetchGroup();
    }
  }, [groupStats, isLoading, fetchGroup]);

  useEffect(() => {
    if (!groupStats || isLoading) return;

    const hasPreviouslySelectedUser =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('stats-lc-has-selected-user') === '1';

    if (!featuredUserId && members.length > 0 && !hasPreviouslySelectedUser) {
      setFeaturedUserId(members[0].id);
      setShowInitialModal(false);
      return;
    }

    // Só recupera featuredUserId se ele estiver vazio ou não existir em allMembers
    const featuredUserExists = allMembers.some(m => m.id === featuredUserId);

    if (!featuredUserId || !featuredUserExists) {
      if (primaryUser?.id) {
        if ((import.meta as any).env?.DEV) {
          console.warn('[HomeScreen] Invalid featuredUserId recovered', {
            featuredUserId,
            fallbackUserId: primaryUser.id,
          });
        }
        setFeaturedUserId(primaryUser.id);
        setShowInitialModal(false);
        return;
      }
    }

    if (primaryUser?.id) {
      setShowInitialModal(false);
    } else if (allMembers.length > 0) {
      setFeaturedUserId(allMembers[0].id);
      setShowInitialModal(false);
    }
  }, [allMembers, featuredUserId, primaryUser, members, groupStats, isLoading, setFeaturedUserId]);

  // Mark Home as ready after the primary hero data and critical artwork are prepared.
  // After the first release, period changes can update below without returning to splash.
  useEffect(() => {
    const hasCoreData = !!groupStats && !!primaryUser;
    const hasRecentBaseline = !primaryUser || recentPrepState === 'ready' || recentPrepState === 'error';

    if (hasReleasedHomeRef.current) {
      if (window.__STATS_LC_HOME_READY__ !== true) {
        window.__STATS_LC_HOME_READY__ = true;
        window.dispatchEvent(new CustomEvent('stats-lc-home-ready', { detail: { ready: true } }));
      }
      setIsAppReady(true);
      window.__STATS_LC_DISMISS_SPLASH__?.();
      return;
    }

    const ready = hasCoreData && isVisualWarmupReady && hasRecentBaseline;

    if (!ready) {
      if (!hasReleasedHomeRef.current) {
        window.__STATS_LC_HOME_READY__ = false;
        window.dispatchEvent(new CustomEvent('stats-lc-home-ready', { detail: { ready: false } }));
      }
      setIsAppReady(false);
      return;
    }

    let cancelled = false;
    let released = false;
    const releaseHome = () => {
      if (cancelled || released) return;
      released = true;
      hasReleasedHomeRef.current = true;
      window.__STATS_LC_HOME_READY__ = true;
      window.dispatchEvent(new CustomEvent('stats-lc-home-ready', { detail: { ready: true } }));
      setIsAppReady(true);
      window.__STATS_LC_DISMISS_SPLASH__?.();
    };
    if (document.visibilityState === 'hidden') {
      releaseHome();
      return () => {
        cancelled = true;
      };
    }

    let hiddenTabFallback = 0;
    const timer = window.setTimeout(() => {
      hiddenTabFallback = window.setTimeout(releaseHome, 280);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.clearTimeout(hiddenTabFallback);
          releaseHome();
        });
      });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(hiddenTabFallback);
    };
  }, [groupStats, isVisualWarmupReady, primaryUser, recentPrepState]);

  useEffect(() => {
    // Escuta evento customizado para abrir histórico completo
    const handleOpenHistory = (e: any) => {
      setViewingFullHistoryUser(e.detail);
    };
    window.addEventListener('openHistory', handleOpenHistory);
    return () => window.removeEventListener('openHistory', handleOpenHistory);
  }, []);

  // Track featured user changes
  useEffect(() => {
    if (primaryUser) {
      identifyUser(primaryUser.id, {
        name: primaryUser.name,
        platform: primaryUser.platform,
        streamsToday: primaryUser.streamsToday
      });
      trackEvent('featured_user_changed', {
        userId: primaryUser.id,
        userName: primaryUser.name,
        platform: primaryUser.platform
      });
    }
  }, [primaryUser?.id]);

  // Track modal opening states
  useEffect(() => {
    if (selectedTrack) {
      trackEvent('modal_opened', { 
        modalName: 'track_detail', 
        trackId: selectedTrack.id,
        trackName: selectedTrack.name || selectedTrack.track?.name,
        artistName: selectedTrack.artistName || selectedTrack.artist?.name
      });
    }
  }, [selectedTrack]);

  useEffect(() => {
    if (selectedAlbum) {
      trackEvent('modal_opened', { 
        modalName: 'user_album_stats',
        albumId: selectedAlbum.id,
        albumName: selectedAlbum.name,
        artistName: selectedAlbum.artistName
      });
    }
  }, [selectedAlbum]);

  useEffect(() => {
    if (selectedArtist) {
      trackEvent('modal_opened', {
        modalName: 'user_artist_stats',
        artistId: selectedArtist.id,
        artistName: selectedArtist.name || selectedArtist.artistName
      });
    }
  }, [selectedArtist]);

  useEffect(() => {
    if (viewingFullHistoryUser) {
      trackEvent('modal_opened', { 
        modalName: 'user_full_history', 
        userId: viewingFullHistoryUser.id, 
        userName: viewingFullHistoryUser.name 
      });
    }
  }, [viewingFullHistoryUser]);

  useEffect(() => {
    if (viewingAlbumHistoryUser) {
      trackEvent('modal_opened', { 
        modalName: 'user_album_history', 
        userId: viewingAlbumHistoryUser.id, 
        userName: viewingAlbumHistoryUser.name 
      });
    }
  }, [viewingAlbumHistoryUser]);

  useEffect(() => {
    if (showUserSelector) {
      trackEvent('user_selector_opened');
    }
  }, [showUserSelector]);

  useEffect(() => {
    setShowUserSelector(false);
    setAvatarClickPosition(null);
  }, [featuredUserId]);

  const friendsSelection = useMemo(() => {
    if (!Array.isArray(members)) return [];
    return members.filter(u => u && u.id && u.id !== FEATURED_ID);
  }, [members, FEATURED_ID]);

  const sortedFriends = useMemo(() => {
    return [...friendsSelection].sort((a, b) => a.name.localeCompare(b.name));
  }, [friendsSelection]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    if (!primaryUser?.id) {
      setReplayState('idle');
      setReplayTopItems({ artists: [], tracks: [], albums: [] });
      setReplayTotalMinutesCount(0);
      return;
    }

    const cacheKey = `stats-lc-home-replay:${primaryUser.id}:${replayPeriodKey}`;
    const cachedReplay = readHomeSessionCache<{
      artists: any[];
      tracks: any[];
      albums: any[];
      totalMinutes: number;
    }>(cacheKey);

    if (cachedReplay) {
      setReplayTopItems({
        artists: cachedReplay.artists || [],
        tracks: cachedReplay.tracks || [],
        albums: cachedReplay.albums || [],
      });
      setReplayTotalMinutesCount(cachedReplay.totalMinutes || 0);
      setReplayState('ready');
    } else {
      setReplayState('loading');
    }

    statsService.getReplayData(primaryUser.id, { ...replayPeriodQuery, signal: controller.signal })
      .then((replay) => ({
        artists: replay.topArtists,
        tracks: replay.topTracks,
        albums: replay.topAlbums,
        totalSongs: replay.totalSongs,
        totalDurationMs: replay.totalDurationMs,
        failed: false
      }))
      .catch((error: any) => {
        if (controller.signal.aborted || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
          return null;
        }
        return { artists: [], tracks: [], albums: [], totalSongs: undefined, totalDurationMs: undefined, failed: true };
      })
      .then((payload) => {
      if (!payload || cancelled) return;
      const { artists, tracks, albums, totalSongs, totalDurationMs, failed } = payload;
      if (failed) {
        setReplayTopItems({ artists, tracks, albums });
        setReplayTotalMinutesCount(0);
        setReplayState('error');
        return;
      }
      if (!cancelled) {
        setReplayTopItems({ artists, tracks, albums });
        const fallbackTotal = getReplayFallbackTotalMinutes(tracks, totalSongs) || tracks.length;
        const totalMinutes =
          Number.isFinite(totalDurationMs) && totalDurationMs && totalDurationMs > 0
            ? Math.max(1, Math.round(totalDurationMs / 60000))
            : fallbackTotal;
        setReplayTotalMinutesCount(totalMinutes);
        setReplayState('ready');
        writeHomeSessionCache(cacheKey, { artists, tracks, albums, totalMinutes });
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [primaryUser?.id, replayPeriodKey]);

  useEffect(() => {
    let cancelled = false;

    if (!primaryUser?.id) {
      setResolvedRecentPlays([]);
      setRecentPrepState('idle');
      return;
    }

    const directRecent = normalizeHomeRecentItems(primaryUser?.recent || (primaryUser as any)?.history || []).slice(0, 20);
    const cachedRecent = normalizeHomeRecentItems(getHistoryCache(primaryUser.id) || []);
    const sessionRecent = normalizeHomeRecentItems(readHomeSessionCache<any[]>(getHomeRecentCacheKey(primaryUser.id)) || []);
    const preparedRecent = [cachedRecent, sessionRecent, directRecent]
      .sort((a, b) => b.length - a.length)[0] || [];

    if (preparedRecent.length > 0) {
      setResolvedRecentPlays(preparedRecent.slice(0, 10));
    }

    if (preparedRecent.length >= 10) {
      setHistoryCache(primaryUser.id, preparedRecent);
      writeHomeSessionCache(getHomeRecentCacheKey(primaryUser.id), preparedRecent);
      setRecentPrepState('ready');
      void statsService.fetchRecent(primaryUser.id, 20, 0)
        .then((freshItems) => {
          if (cancelled) return;

          const normalizedFresh = normalizeHomeRecentItems(freshItems || []);
          if (normalizedFresh.length === 0) return;

          const merged = mergeHomeRecentItems(normalizedFresh, preparedRecent);
          if (merged.length > 0) {
            setHistoryCache(primaryUser.id, merged);
            writeHomeSessionCache(getHomeRecentCacheKey(primaryUser.id), merged);
            setResolvedRecentPlays(merged.slice(0, 10));
          }
        })
        .catch(() => {});
      return;
    }

    // /api/group already supplies a compact recent baseline. Render it now and
    // expand to the full Home history in the background instead of holding splash.
    setRecentPrepState(preparedRecent.length > 0 ? 'ready' : 'loading');
    statsCacheService.fetchPaginatedHistory(primaryUser.id, 0, 20)
      .then((items) => {
        if (cancelled) return;
        const nextRecent = items?.length ? items : preparedRecent;
        setResolvedRecentPlays(nextRecent.slice(0, 10));
        if (nextRecent.length > 0) {
          setHistoryCache(primaryUser.id, nextRecent);
          writeHomeSessionCache(getHomeRecentCacheKey(primaryUser.id), nextRecent);
        }
        setRecentPrepState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedRecentPlays(preparedRecent.slice(0, 10));
        setRecentPrepState(preparedRecent.length > 0 ? 'ready' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [getHistoryCache, primaryUser?.id, primaryUser?.recent, (primaryUser as any)?.history, setHistoryCache]);

  useEffect(() => {
    const track = primaryUser?.nowPlaying?.track;
    if (!track?.id || members.length === 0) {
      setTrackModalPrepState(primaryUser ? 'ready' : 'idle');
      return;
    }

    let cancelled = false;
    setTrackModalPrepState('loading');

    loadTrackLeaderboardModule()
      .then((module) => module.preloadTrackLeaderboardStats(track, members))
      .then(() => {
        if (!cancelled) setTrackModalPrepState('ready');
      })
      .catch(() => {
        if (!cancelled) setTrackModalPrepState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [primaryUser?.id, primaryUser?.nowPlaying?.track?.id, membersSignature]);

  const replayArtists = replayTopItems.artists || [];
  const replayTracks = replayTopItems.tracks || [];
  const replayAlbums = replayTopItems.albums || [];
  const replayModalPeriod = getReplayModalPeriod(replayActiveTab, replaySelectedSubValues);

  const handleShareReplay = useCallback(async () => {
    if (!primaryUser) return;
    const topArtist = replayArtists[0]?.name ? ` Artista #1: ${replayArtists[0].name}.` : '';
    const text = `${primaryUser.name} ouviu ${coreUtils.formatNumber(replayTotalMinutesCount)} minutos de musica ${replayModalPeriod}.${topArtist}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'stats.lc Replay',
          text,
          url: window.location.href
        });
        showToast('Replay compartilhado', 'Seu resumo foi enviado para o compartilhamento do sistema.', 'success');
        return;
      }

      await navigator.clipboard?.writeText(`${text} ${window.location.href}`);
      showToast('Replay copiado', 'O resumo do Replay foi copiado para a area de transferencia.', 'success');
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        showToast('Compartilhamento indisponivel', 'Nao foi possivel abrir o compartilhamento agora.', 'error');
      }
    }
  }, [primaryUser, replayArtists, replayModalPeriod, replayTotalMinutesCount, showToast]);

  const handleOpenReplayTrack = useCallback((track: any) => {
    const url = getReplayTrackUrl(track);
    if (!url) {
      showToast('Link indisponivel', 'Esta musica ainda nao trouxe link de catalogo pela API.', 'info');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [showToast]);

  const handleOpenMusicDetail = useCallback((item: any) => {
    if (!item) return;
    if (item.type === 'album') {
      setSelectedAlbum(item);
      return;
    }
    if (item.type === 'artist') {
      setSelectedArtist(item);
      return;
    }
    setSelectedTrack({ ...item, type: item.type || 'track' });
  }, []);

  const handleOpenTrackStatsBubble = useCallback((track: any, playback?: any) => {
    if (!track?.name) return;
    window.dispatchEvent(new CustomEvent('stats-lc-open-track-stats', {
      detail: {
        panel: 'stats',
        userId: primaryUser?.id,
        track,
        playback,
      },
    }));
  }, [primaryUser?.id]);

  const hasReplayData = replayArtists.length > 0 || replayTracks.length > 0 || replayAlbums.length > 0;
  const isReplayInitialLoading = isAppReady && !!primaryUser && replayState !== 'ready' && !hasReplayData;
  const isReplayUpdating = isAppReady && !!primaryUser && replayState !== 'ready' && hasReplayData;
  const showPipelineSync = false;
  return (
    <>
      {createPortal(
        <>
          {/* Modal inicial - primeira vez */}
          <UserSelectorModal
            isOpen={showInitialModal}
            members={members}
            featuredUserId={featuredUserId || ''}
            onSelectUser={(userId) => {
              setFeaturedUserId(userId);
              localStorage.setItem('stats-lc-has-selected-user', '1');
              setShowInitialModal(false);
            }}
            onClose={() => {
              if (!primaryUser && members.length > 0) {
                setFeaturedUserId(members[0].id);
                localStorage.setItem('stats-lc-has-selected-user', '1');
              }
              setShowInitialModal(false);
            }}
          />

          <AnimatePresence>
            <React.Suspense key="home-detail-modals" fallback={<HomeSectionLoader label="Abrindo detalhe" />}>
              {viewingFullHistoryUser && (
                <UserHistoryModal 
                  user={viewingFullHistoryUser} 
                  onClose={() => setViewingFullHistoryUser(null)}
                  onTrackClick={(track, playback) => {
                    window.dispatchEvent(new CustomEvent('stats-lc-open-track-stats', {
                      detail: {
                        panel: 'stats',
                        userId: viewingFullHistoryUser?.id,
                        track,
                        playback,
                      },
                    }));
                  }}
                  groupStats={groupStats}
                  openRowsInBottomBubble
                />
              )}
              {selectedTrack && (
                <TrackLeaderboardModal 
                  track={selectedTrack} 
                  onClose={() => setSelectedTrack(null)}
                  onArtistClick={(artist) => setSelectedArtist({ ...artist, type: 'artist' })}
                />
              )}
              {selectedAlbum && (
                 <UserAlbumStatsModal
                   user={primaryUser}
                   entity={selectedAlbum}
                   onClose={() => setSelectedAlbum(null)}
                   onTrackClick={(track) => setSelectedTrack({ ...track, type: 'track' })}
                 />
              )}
              {selectedArtist && (
                 <UserArtistStatsModal
                   user={primaryUser}
                   entity={selectedArtist}
                   onClose={() => setSelectedArtist(null)}
                   onTrackClick={(track) => setSelectedTrack({ ...track, type: 'track' })}
                 />
              )}
              {viewingAlbumHistoryUser && (
                <UserAlbumHistoryModal 
                  user={viewingAlbumHistoryUser}
                  onClose={() => setViewingAlbumHistoryUser(null)}
                />
              )}
            </React.Suspense>
            <TopArtistsModal
              key="home-top-artists-modal"
              isOpen={openReplayModal === 'artists'}
              onClose={() => setOpenReplayModal(null)}
              artists={replayArtists.slice(0, 20).map((a: any) => ({
                id: a.id,
                name: a.name,
                image: a.image,
                streams: getReplayMinutes(a)
              }))}
              period={replayModalPeriod}
              onArtistClick={(artist) => {
                setOpenReplayModal(null);
                setSelectedArtist({ ...artist, type: 'artist' });
              }}
            />
            <TopSongsModal
              key="home-top-songs-modal"
              isOpen={openReplayModal === 'songs'}
              onClose={() => setOpenReplayModal(null)}
              tracks={replayTracks.slice(0, 30).map((t: any) => ({
                id: t.id,
                name: t.name,
                artist: getReplayArtistName(t),
                image: t.image || t.albumImage,
                streams: t.playedCount || t.streams || t.playcount || t.count || 0
              }))}
              period={replayModalPeriod}
              onTrackClick={(track) => {
                setOpenReplayModal(null);
                setSelectedTrack({ ...track, type: 'track' });
              }}
            />
            <TopAlbumsModal
              key="home-top-albums-modal"
              isOpen={openReplayModal === 'albums'}
              onClose={() => setOpenReplayModal(null)}
              albums={replayAlbums.slice(0, 15).map((a: any) => ({
                id: a.id,
                name: a.name,
                artist: getReplayAlbumArtistName(a, replayTracks),
                image: a.image,
                streams: getReplayMinutes(a)
              }))}
              period={replayModalPeriod}
              onAlbumClick={(album) => {
                setOpenReplayModal(null);
                setSelectedAlbum({ ...album, type: 'album', artistName: album.artist });
              }}
            />

            {/* Explosão contextual de usuários */}
            <UserSelectorExplosion
              key="home-user-selector-explosion"
              isOpen={showUserSelector}
              members={members}
              featuredUserId={featuredUserId || ''}
              onSelectUser={(userId) => {
                setFeaturedUserId(userId);
                localStorage.setItem('stats-lc-has-selected-user', '1');
                setShowUserSelector(false);
                setAvatarClickPosition(null);
              }}
              onClose={() => {
                setShowUserSelector(false);
                setAvatarClickPosition(null);
              }}
              triggerPosition={avatarClickPosition || undefined}
              mode="header"
            />
          </AnimatePresence>
        </>,
        document.body
      )}

      <div
        className="flex flex-col gap-3 pt-24 pb-6"
      >

      {/* Custom Background Sync Bar */}
      <AnimatePresence>
        {showPipelineSync && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="mx-4 sm:mx-6 lg:mx-8 mb-6 relative overflow-hidden"
          >
            <div className="glass-card premium-gradient border-orange-500/20 px-5 py-3.5 flex flex-col gap-3.5 rounded-[32px] shadow-2xl relative z-10">
              {/* Internal Gloss Effect */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20 z-20" />
              
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center relative overflow-hidden">
                       <ShimmerOverlay duration={2} />
                       <RefreshCcw className="h-4 w-4 text-orange-500 animate-spin" />
                    </div>
                    <motion.div 
                      className="absolute -inset-1 rounded-full border border-orange-500/30"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 leading-none">Data Pipeline Sync</span>
                     <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500 relative overflow-hidden">
                          <ShimmerOverlay duration={1.5} />
                        </div>
                        <span className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Transmissão Ativa</span>
                     </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <motion.span 
                    key={refreshStepText}
                    initial={{ opacity: 0, x: 5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[9px] font-black text-orange-400 uppercase tracking-widest truncate max-w-[120px]"
                  >
                    {refreshStepText}
                  </motion.span>
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-mono text-white/20 uppercase tracking-widest">
                      {processedItems} OBJECTS
                    </span>
                    <div className="h-2 w-[1px] bg-white/10" />
                    <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">
                      {refreshProgress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced Progress Indicator */}
              <div className="relative w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="absolute inset-y-0 left-0 w-full origin-left bg-gradient-to-r from-orange-600 via-white/80 to-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.8)] z-10"
                  animate={{ scaleX: refreshProgress / 100 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                {/* Secondary Pulse Animation */}
                <motion.div 
                  className="absolute inset-0 bg-orange-500/20"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              </div>
            </div>
            
            {/* Background Glow */}
            <div className="absolute -inset-10 bg-orange-500/10 blur-[60px] -z-10 rounded-full animate-pulse-slow" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Highlight: Dynamic User */}
      <AnimatePresence mode="sync">
        {!isAppReady && !error ? (
          <div key="home-boot-placeholder" className="min-h-[72vh]" aria-busy="true" />
        ) : error ? (
            <motion.div 
             key="error"
             initial={{ opacity: 0, scale: 0.95, y: 10 }} 
             animate={{ opacity: 1, scale: 1, y: 0 }}
             className="glass-card mx-4 sm:mx-6 lg:mx-8 flex flex-col items-center justify-center gap-6 py-12 px-8 border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent rounded-[42px] text-center relative overflow-hidden group shadow-2xl"
            >
               {/* Background Decorative Rings */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
               <div className="absolute -bottom-10 left-0 w-32 h-32 bg-orange-500/5 blur-[60px] rounded-full pointer-events-none" />
               
               <div className="relative flex items-center justify-center h-16 w-16 rounded-[22px] glass border border-white/10 shadow-inner group-hover:scale-105 transition-transform duration-500">
                 <div className="absolute inset-0 bg-orange-500/10 rounded-[22px] blur-xl opacity-50" />
                 {error.toLowerCase().includes('conexão') || isOffline ? (
                   <WifiOff className="h-7 w-7 text-orange-400 relative z-10" />
                 ) : (
                   <AlertTriangle className="h-7 w-7 text-orange-500 relative z-10" />
                 )}
                 <motion.span 
                   animate={{ opacity: [0.3, 1, 0.3] }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="absolute -top-1 -right-1 flex h-4 w-4"
                 >
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-20"></span>
                   <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500/20 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 bg-orange-500 rounded-full" />
                   </span>
                 </motion.span>
               </div>

               <div className="max-w-md relative z-10 flex flex-col gap-3">
                 <h2 className="text-xl font-mundial font-black uppercase tracking-[0.2em] text-white/95">
                   {isOffline || error.toLowerCase().includes('conexão') 
                     ? 'Sincronização Interrompida' 
                     : 'Anomalia no Pipeline'}
                 </h2>
                 <p className="text-sm font-medium text-white/60 leading-relaxed px-4">
                   {isOffline || error.toLowerCase().includes('conexão')
                     ? 'Seu dispositivo oscilou ou a rede está instável. Mas não se preocupe: você ainda pode ver os últimos dados salvos do grupo enquanto recuperamos o sinal.'
                     : 'Encontramos uma instabilidade nos metadados do Last.fm. Nossos algoritmos de scrobbling estão tentando restabelecer o fluxo de dados.'}
                 </p>
                 
                 {typeof error === "string" && !error.toLowerCase().includes('conexão') && (
                   <div className="flex flex-col items-center gap-1.5 mt-2">
                     <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-mono font-bold text-orange-500/50 uppercase tracking-widest">
                       Diagnostics: {error}
                     </span>
                     <span className="text-[10px] font-medium text-white/20 italic">
                       Timestamp local: {new Date().toLocaleTimeString()}
                     </span>
                   </div>
                 )}
               </div>

               <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs relative z-10">
                 <button 
                   onClick={() => fetchGroup(false)}
                   disabled={isLoading || isRefreshing}
                   className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.15em] shadow-[0_10px_25px_rgba(234,88,12,0.3)] active:scale-95 transition-[background-color,opacity,transform] disabled:opacity-50 disabled:cursor-wait"
                 >
                   {isLoading || isRefreshing ? (
                     <Loader2 className="h-4 w-4 animate-spin" />
                   ) : (
                     <RefreshCcw className="h-4 w-4" />
                   )}
                   <span className="truncate">{isLoading || isRefreshing ? "Recalibrando..." : "Forçar Sincronia"}</span>
                 </button>
                 
                 <button 
                   onClick={() => window.location.reload()}
                   className="w-full px-6 py-3.5 glass hover:bg-white/10 text-white/70 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-[background-color,border-color,color,transform] active:scale-95"
                 >
                   <span className="truncate">Reiniciar App</span>
                 </button>
               </div>

               <div className="flex items-center gap-2 mt-2 opacity-30 hover:opacity-100 transition-opacity cursor-help group-hover:translate-y-[-2px] duration-500">
                  <Sparkles className="h-3 w-3 text-white/50" />
                  <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em]">
                    Algoritmo de Auto-Recuperação Ativo
                  </span>
               </div>
            </motion.div>
        ) : primaryUser ? (
          <div 
            className="flex flex-col gap-3"
          >
            <motion.div
              key={primaryUser.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-3 overflow-visible"
            >
              <div 
                className="relative -mt-[4px] touch-pan-y overflow-visible"
              >
                <LeoHeader
                  user={primaryUser}
                  streamsToday={displayedHeaderStreamsToday}
                  recentPlays={resolvedRecentPlays}
                  onTrackClick={handleOpenMusicDetail}
                  isHighlighted={headerHighlight}
                />
              </div>

              <div className={cn("px-4 sm:px-6 lg:px-8", friendActivityOffset)}>
                <FriendActivityReel
                  excludeUserId={primaryUser.id}
                  onTrackClick={handleOpenMusicDetail}
                  onFriendClick={(friend) => setViewingFullHistoryUser(friend)}
                  onViewAll={() => navigate('/circle')}
                />
              </div>
            </motion.div>
          </div>
        ) : groupStats && !isLoading ? (
          <HomeEmptyState onRetry={() => fetchGroup(false)} />
        ) : (
          <HomeSectionLoader />
        )}
      </AnimatePresence>

      {isReplayInitialLoading && <HomeSectionLoader label="Carregando seus destaques" />}

      {isAppReady && primaryUser && replayState === 'error' && (
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="glass-aura rounded-[28px] px-5 py-5 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-orange-400" />
            <h2 className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-white/85">Destaques indisponíveis</h2>
            <p className="mx-auto mt-2 max-w-xs text-xs font-medium leading-relaxed text-white/45">Não conseguimos carregar esse período agora.</p>
          </div>
        </div>
      )}

      {isAppReady && primaryUser && (replayState === 'ready' || isReplayUpdating) && (
        <HomeOrbitalHighlights
          totalMinutes={replayTotalMinutesCount}
          artists={replayArtists}
          tracks={replayTracks}
          albums={replayAlbums}
          activeTab={replayActiveTab}
          selectedSubValues={replaySelectedSubValues}
          onActiveTabChange={setReplayActiveTab}
          onSelectedSubValuesChange={setReplaySelectedSubValues}
          onItemClick={handleOpenMusicDetail}
        />
      )}

      {isAppReady && primaryUser && (
        <div className="content-auto-safe">
          <HomePerceptions
            tracks={replayTracks}
            artists={replayArtists}
            userId={primaryUser.id}
            activeTab={replayActiveTab}
            selectedSubValues={replaySelectedSubValues}
          />
        </div>
      )}

      {isAppReady && (
      <motion.div
        initial={shouldSkipHomeEntryMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8"
      >
        <FriendsMonthlyHighlights
          periodQuery={replayPeriodQuery}
          activeTab={replayActiveTab}
          selectedSubValues={replaySelectedSubValues}
        />
      </motion.div>
      )}

      {isAppReady && (
      <motion.div
        initial={shouldSkipHomeEntryMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="content-auto-safe px-4 sm:px-6 lg:px-8"
      >
        <HomeInsights onFriendClick={(friend) => setViewingFullHistoryUser(friend)} />
      </motion.div>
      )}

      {isAppReady && (
      <motion.div
        initial={shouldSkipHomeEntryMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 sm:px-6 lg:px-8"
      >
        <StatsAlike />
      </motion.div>
      )}

      {isAppReady && primaryUser && (
        <motion.div
          initial={shouldSkipHomeEntryMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="content-auto-safe"
        >
          <HomeRecentPlays
            user={primaryUser}
            recent={resolvedRecentPlays}
            onFullHistoryClick={() => setViewingFullHistoryUser(primaryUser)}
            onTrackClick={handleOpenTrackStatsBubble}
          />
        </motion.div>
      )}

      {/* Toast Notification Container */}
      <div className="fixed bottom-[calc(10rem+env(safe-area-inset-bottom,0px))] right-4 z-[200] flex flex-col gap-3 pointer-events-none w-[calc(100%-32px)] sm:w-80">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto glass-card border-white/10 p-4 rounded-3xl shadow-2xl relative overflow-hidden group"
            >
              <div className={clsx(
                "absolute inset-y-0 left-0 w-1",
                toast.type === 'success' ? "bg-green-500" : toast.type === 'error' ? "bg-red-500" : "bg-orange-500"
              )} />
              <div className="flex gap-3">
                <div className={clsx(
                  "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                  toast.type === 'success' ? "bg-green-500/10 text-green-500" : 
                  toast.type === 'error' ? "bg-red-500/10 text-red-500" : 
                  "bg-orange-500/10 text-orange-500"
                )}>
                  {toast.type === 'success' ? <Check className="h-4 w-4" /> : 
                   toast.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : 
                   <Info className="h-4 w-4" />}
                </div>
                <div className="flex flex-col min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white leading-none">
                      {toast.title}
                    </span>
                    <span className="text-[8px] font-mono text-white/30 ml-auto whitespace-nowrap">
                      {toast.timestamp}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-white/60 mt-1.5 leading-relaxed">
                    {toast.message}
                  </p>
                </div>
                <button 
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="absolute top-2 right-2 p-1 text-white/20 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      </div>
    </>
  );
}
