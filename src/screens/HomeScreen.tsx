
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { RefreshCcw, AlertTriangle, WifiOff, Users, Sparkles, Loader2, Check, Info, X, Music2, Disc3, Clock3, PlayCircle, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FriendActivityReel } from '../components/home/FriendActivityReel';
import { MONTHS_SHORT, type ReplayFilterPeriod, type ReplaySelectedSubValues, type ReplayWeekMode } from '../components/home/replayUtils';
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
import { getCanonicalMembersWithLive, getVisibleMembersWithLive } from '../lib/memberSelectors';
import { getDominantColor } from '../lib/colorUtils';
import { VinylRecord } from '../components/home/VinylRecord';

const loadUserHistoryModal = () => import('../components/modals/UserHistoryModal').then(module => ({ default: module.UserHistoryModal }));
const loadTrackLeaderboardModule = () => import('../components/modals/TrackLeaderboardModal');
const loadTrackLeaderboardModal = () => loadTrackLeaderboardModule().then(module => ({ default: module.TrackLeaderboardModal }));
const loadAlbumDetailModal = () => import('../components/modals/AlbumDetailModal').then(module => ({ default: module.AlbumDetailModal }));
const loadUserAlbumHistoryModal = () => import('../components/modals/UserAlbumHistoryModal').then(module => ({ default: module.UserAlbumHistoryModal }));

export const preloadHomeDetailModals = () => Promise.allSettled([
  loadUserHistoryModal(),
  loadTrackLeaderboardModal(),
  loadAlbumDetailModal(),
  loadUserAlbumHistoryModal(),
]);

const UserHistoryModal = React.lazy(loadUserHistoryModal);
const TrackLeaderboardModal = React.lazy(loadTrackLeaderboardModal);
const AlbumDetailModal = React.lazy(loadAlbumDetailModal);
const UserAlbumHistoryModal = React.lazy(loadUserAlbumHistoryModal);

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HOME_CACHE_TTL = 15 * 60 * 1000;

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

const FloatingMiniHeader = React.memo(({
  visible,
  albumImage,
  dominantColor,
  isPlaying,
  onClick
}: {
  visible: boolean;
  albumImage: string;
  dominantColor: string;
  isPlaying: boolean;
  onClick: () => void;
}) => {
  if (!albumImage) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: isPlaying ? 1 : 0.42 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed top-0 left-0 right-0 z-[150] h-[calc(130px+env(safe-area-inset-top,0px))] overflow-visible"
        >
          <motion.div
            initial={{ y: -42, opacity: 0, scale: 0.76, rotate: -9 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={{ y: -42, opacity: 0, scale: 0.76, rotate: -9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28, mass: 0.7 }}
            className="pointer-events-auto absolute right-[-62px] top-[calc(env(safe-area-inset-top,0px)-66px)] h-[158px] w-[158px] sm:right-[calc(50%-304px)] sm:h-[176px] sm:w-[176px]"
          >
            <VinylRecord
              albumImage={albumImage}
              dominantColor={dominantColor}
              isPlaying={isPlaying}
              progressMs={0}
              durationMs={undefined}
              onClick={onClick}
              hideTonearm
            />
          </motion.div>
        </motion.header>
      )}
    </AnimatePresence>
  );
});

FloatingMiniHeader.displayName = 'FloatingMiniHeader';

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

const getHighlightOrbitSeed = (value: string) => {
  let seed = 0;
  for (let i = 0; i < value.length; i += 1) {
    seed = (Math.imul(seed, 31) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(seed);
};

const seededUnit = (seed: number, index: number) => {
  const value = Math.sin(seed + index * 91.7) * 10000;
  return value - Math.floor(value);
};

const getFirstName = (name?: string) => {
  if (!name) return '';
  return name.trim().split(/\s+/)[0] || name;
};

const HomeReplayFilter = ({
  activeTab,
  selectedSubValues,
  onActiveTabChange,
  onSelectedSubValuesChange
}: {
  activeTab: ReplayFilterPeriod;
  selectedSubValues: ReplaySelectedSubValues;
  onActiveTabChange: (tab: ReplayFilterPeriod) => void;
  onSelectedSubValuesChange: (values: ReplaySelectedSubValues) => void;
}) => {
  const currentMonth = new Date().getMonth();
  const availableMonths = MONTHS_SHORT;
  const years = [2024, 2025, 2026];
  const periodTabs: Array<{ key: ReplayFilterPeriod; label: string }> = [
    { key: 'today', label: 'hoje' },
    { key: 'week', label: 'semana' },
    { key: 'month', label: 'mês' },
    { key: 'year', label: 'ano' },
    { key: 'all', label: 'tudo' }
  ];

  return (
    <div className="space-y-2.5">
      <div data-home-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto no-scrollbar pl-1 pr-1">
        {periodTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onActiveTabChange(tab.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-black lowercase transition-colors",
              activeTab === tab.key ? "bg-white/16 text-white shadow-[0_10px_26px_rgba(0,0,0,0.28)]" : "bg-white/[0.025] text-white/42"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'week' && (
        <div data-home-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto no-scrollbar pl-1">
          {[
            { key: 'last-7' as ReplayWeekMode, label: 'últimos 7 dias' },
            { key: 'current' as ReplayWeekMode, label: 'esta semana' }
          ].map((option) => {
            const isSelected = selectedSubValues.weekMode === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelectedSubValuesChange({ ...selectedSubValues, weekMode: option.key })}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-[13px] font-black transition-colors",
                  isSelected ? "bg-white/14 text-white" : "bg-white/[0.025] text-white/42"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'month' && (
        <div data-home-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto no-scrollbar pl-1 pr-1">
          {availableMonths.map((month, index) => {
            const value = String(index).padStart(2, '0');
            const isSelected = selectedSubValues.month === value;
            const isFuture = index > currentMonth;
            return (
              <button
                key={month}
                type="button"
                disabled={isFuture}
                onClick={() => !isFuture && onSelectedSubValuesChange({ ...selectedSubValues, month: value })}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold lowercase transition-colors",
                  isSelected ? "text-white" : isFuture ? "text-white/12" : "text-white/42"
                )}
              >
                {month}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'year' && (
        <div data-home-horizontal-scroll="true" className="flex items-center gap-3 overflow-x-auto no-scrollbar pl-1">
          {years.map((year) => {
            const isSelected = selectedSubValues.year === String(year);
            return (
              <button
                key={year}
                type="button"
                onClick={() => onSelectedSubValuesChange({ ...selectedSubValues, year: String(year) })}
                className={cn(
                  "shrink-0 rounded-full px-5 py-2 text-[14px] font-black transition-colors",
                  isSelected ? "bg-white/14 text-white" : "bg-white/[0.025] text-white/42"
                )}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

type HomeHighlightKind = 'artists' | 'tracks' | 'albums';

const HomeOrbitalHighlights = ({
  totalMinutes,
  artists,
  tracks,
  albums
}: {
  totalMinutes: number;
  artists: any[];
  tracks: any[];
  albums: any[];
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const groups: Array<{ key: HomeHighlightKind; title: string; icon: any; items: any[] }> = [
    { key: 'artists' as const, title: 'Top artistas', icon: UserCircle, items: artists.slice(0, 5) },
    { key: 'tracks' as const, title: 'Top músicas', icon: Music2, items: tracks.slice(0, 5) },
    { key: 'albums' as const, title: 'Top álbuns', icon: Disc3, items: albums.slice(0, 5) }
  ].filter((group) => group.items.length > 0);

  useEffect(() => {
    if (activeIndex >= groups.length) setActiveIndex(0);
  }, [activeIndex, groups.length]);

  const stageHeight = "h-[314px] sm:h-[334px]";
  const metricLabel = (item: any, kind: HomeHighlightKind) => {
    if (kind === 'tracks') return `${coreUtils.formatNumber(getReplayItemCount(item))} plays`;
    return `${coreUtils.formatNumber(getReplayMinutes(item))} min`;
  };
  const detailLabel = (item: any, kind: HomeHighlightKind) => {
    if (kind === 'tracks' || kind === 'albums') return getReplayItemArtist(item);
    return '';
  };

  const goTo = useCallback((index: number) => {
    if (groups.length === 0) return;
    setActiveIndex((index + groups.length) % groups.length);
  }, [groups.length]);

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
    goTo(activeIndex + (dx < 0 ? 1 : -1));
  }, [activeIndex, goTo]);

  const renderHighlightOrbit = (items: any[], kind: HomeHighlightKind, isCentered = true) => {
    const primary = items[0];
    const satellites = items.slice(1, 5);
    if (!primary) return null;
    const isArtist = kind === 'artists';
    const orbitSeed = getHighlightOrbitSeed(`${kind}:${items.map((item) => item?.id || getReplayItemTitle(item)).join('|')}`);
    const baseSatellitePositions = [
      { x: -126, y: -82, width: 92, height: 108, rotate: -8, opacity: 0.9 },
      { x: 126, y: -76, width: 90, height: 106, rotate: 7, opacity: 0.84 },
      { x: -124, y: 92, width: 88, height: 104, rotate: 5, opacity: 0.8 },
      { x: 124, y: 92, width: 88, height: 104, rotate: -5, opacity: 0.76 },
    ];
    const positionOffset = orbitSeed % baseSatellitePositions.length;
    const satellitePositions = baseSatellitePositions.map((_, index) => {
      const base = baseSatellitePositions[(index + positionOffset) % baseSatellitePositions.length];
      const side = base.x < 0 ? -1 : 1;
      return {
        ...base,
        x: base.x + (seededUnit(orbitSeed, index) - 0.5) * 22 * side,
        y: base.y + (seededUnit(orbitSeed, index + 11) - 0.5) * 24,
        rotate: base.rotate + (seededUnit(orbitSeed, index + 23) - 0.5) * 10,
        width: base.width + Math.round((seededUnit(orbitSeed, index + 31) - 0.5) * 10),
        height: base.height + Math.round((seededUnit(orbitSeed, index + 43) - 0.5) * 12),
      };
    });
    const primaryImageSize = isArtist ? "h-[182px] w-[136px] sm:h-[194px] sm:w-[146px]" : "h-[156px] w-[156px] sm:h-[164px] sm:w-[164px]";
    const primaryRadius = isArtist ? "rounded-[24px]" : "rounded-[28px]";

    return (
      <div className={cn("relative mx-auto w-full max-w-[408px] overflow-visible", stageHeight)}>
        <div className="pointer-events-none absolute left-1/2 top-[48%] h-[286px] w-[286px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]" />
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[48%] h-[214px] w-[214px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-orange-500/16"
          animate={{ rotate: 360 }}
          transition={{ duration: 58, repeat: Infinity, ease: 'linear' }}
        />
        <div className="pointer-events-none absolute left-1/2 top-[48%] h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.04] blur-2xl" />

        {satellites.map((item, index) => {
          const position = satellitePositions[index] || satellitePositions[0];
          return (
            <motion.div
              key={`${kind}-sat-${item.id || item.name || index}`}
              className="absolute left-1/2 top-[47%] overflow-hidden rounded-[18px] bg-black shadow-[0_18px_38px_rgba(0,0,0,0.45)]"
              initial={{ opacity: 0, scale: 0.72, x: `calc(-50% + ${position.x}px)`, y: `calc(-50% + ${position.y + 12}px)` }}
              animate={{
                opacity: position.opacity,
                scale: 1,
                x: `calc(-50% + ${position.x}px)`,
                y: `calc(-50% + ${position.y}px)`,
                rotate: position.rotate,
              }}
              transition={{ type: 'spring', stiffness: 165, damping: 24, delay: 0.06 + index * 0.04 }}
              style={{ width: position.width, height: position.height }}
            >
              <motion.div
                className="relative h-full w-full"
                animate={isCentered && !shouldReduceMotion ? {
                  y: [0, index % 2 === 0 ? -3 : 3, 0],
                  rotate: [0, index % 2 === 0 ? 0.45 : -0.45, 0],
                } : {}}
                transition={isCentered && !shouldReduceMotion ? {
                  duration: 6.8 + index * 0.55,
                  repeat: Infinity,
                  ease: 'easeInOut',
                } : {}}
              >
                <SmartImage src={getReplayItemImage(item)} className="h-full w-full object-cover" fallback={getReplayItemTitle(item)} rounded="none" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/8 via-black/10 to-black/78" />
                <span className="absolute left-2 top-1.5 text-[22px] font-black leading-none text-white drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)]">{index + 2}</span>
                <div className="absolute bottom-2 left-2 right-2 z-20 min-w-0">
                  {detailLabel(item, kind) && (
                    <span className="mb-0.5 block truncate text-[7px] font-black uppercase tracking-[0.08em] text-white/62">
                      {detailLabel(item, kind)}
                    </span>
                  )}
                  <span className="block truncate text-[9.5px] font-black leading-tight text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.7)]">
                    {getReplayItemTitle(item)}
                  </span>
                  <span className="mt-0.5 block truncate text-[7.5px] font-black uppercase tracking-[0.08em] text-orange-200/85">
                    {metricLabel(item, kind)}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          );
        })}

        <motion.div
          key={`${kind}-primary-${primary.id || primary.name}`}
          className="absolute left-1/2 top-[44%] z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          initial={{ opacity: 0, scale: 0.88, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        >
          <motion.div
            animate={isCentered && !shouldReduceMotion ? { y: [0, -5, 3, 0], rotate: [0, 0.35, -0.25, 0] } : {}}
            transition={isCentered && !shouldReduceMotion ? { duration: 10.5, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            <div className={cn("relative overflow-hidden bg-black shadow-[0_24px_62px_rgba(0,0,0,0.58)]", primaryImageSize, primaryRadius)}>
              <SmartImage src={getReplayItemImage(primary)} className="absolute inset-0 h-full w-full object-cover" fallback={getReplayItemTitle(primary)} rounded="none" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/6 via-black/8 to-black/82" />
              <span className="absolute left-3 top-2 z-20 text-[52px] font-black leading-none text-white drop-shadow-[0_12px_26px_rgba(0,0,0,0.55)]">1</span>
              <div className="absolute bottom-3 left-3 right-3 z-20 min-w-0">
                {detailLabel(primary, kind) && (
                  <span className="mb-0.5 block truncate text-[8px] font-black uppercase tracking-[0.1em] text-white/64">
                    {detailLabel(primary, kind)}
                  </span>
                )}
                <span className="block truncate text-[15px] font-black leading-tight text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.72)]">
                  {getReplayItemTitle(primary)}
                </span>
                <span className="mt-1 block truncate text-[9px] font-black uppercase tracking-[0.08em] text-orange-200/90">
                  {metricLabel(primary, kind)}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  };

  if (groups.length === 0) return null;
  const activeGroup = groups[activeIndex] || groups[0];
  const ActiveIcon = activeGroup.icon;

  return (
    <section className="relative mb-7 overflow-visible px-4 pb-1 sm:px-6 lg:px-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/86">Seus Destaques</h2>
          <span className="text-white/18">·</span>
          <span className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-orange-300">{activeGroup.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5">
          <PlayCircle className="h-3.5 w-3.5 text-orange-300" />
          <span className="text-[10px] font-black text-white">{coreUtils.formatNumber(totalMinutes)}</span>
          <span className="text-[7px] font-black uppercase tracking-[0.12em] text-white/38">min</span>
        </div>
      </div>

      <div
        data-home-horizontal-scroll="true"
        className="relative select-none overflow-visible"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null; }}
      >
        <article className="relative mx-auto w-full max-w-[430px] overflow-visible [perspective:1200px]">
          <div className="relative z-10 mb-1 flex h-7 items-center justify-between gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] backdrop-blur-2xl">
              <ActiveIcon className="h-3.5 w-3.5 text-orange-300" />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {groups.length > 1 && (
                <div className="hidden items-center gap-1 sm:flex">
                  <button type="button" onClick={() => goTo(activeIndex - 1)} className="rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80" aria-label="Destaque anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => goTo(activeIndex + 1)} className="rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80" aria-label="Próximo destaque">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={cn("relative z-10 mx-auto w-full max-w-[430px] overflow-visible", stageHeight)}>
            {groups.map((group, index) => {
              const relative = (index - activeIndex + groups.length) % groups.length;
              const isCentered = relative === 0;
              const isRight = relative === 1;
              const isLeft = relative === groups.length - 1;
              if (!isCentered && !isRight && !isLeft) return null;
              const x = isCentered ? 0 : isRight ? 142 : -142;
              const y = isCentered ? 0 : -22;
              const scale = isCentered ? 1 : 0.7;
              const opacity = isCentered ? 1 : 0.28;
              const blur = isCentered ? 'blur(0px)' : 'blur(3px)';
              return (
                <motion.div
                  key={`highlight-orbit-${group.key}`}
                  className="absolute inset-0"
                  animate={{ x, y, scale, opacity, filter: blur, zIndex: isCentered ? 30 : 8 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                  onClick={() => !isCentered && goTo(index)}
                  aria-hidden={!isCentered}
                >
                  {renderHighlightOrbit(group.items, group.key, isCentered)}
                </motion.div>
              );
            })}
          </div>
        </article>

        {groups.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {groups.map((group, index) => (
              <button
                key={group.key}
                type="button"
                onClick={() => goTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === activeIndex ? "w-5 bg-orange-500" : "w-1.5 bg-white/18"
                )}
                aria-label={`Abrir ${group.title}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const HomePerceptions = ({ tracks, artists, recent }: { tracks: any[]; artists: any[]; recent: any[] }) => {
  const shouldReduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const topTrack = tracks[0];
  const discovery = tracks.find((track) => getReplayItemCount(track) <= 2) || tracks[tracks.length - 1];
  const topTrackArtist = topTrack ? getReplayItemArtist(topTrack) : '';
  const discoveryArtist = discovery ? getReplayItemArtist(discovery) : '';
  const recentTrack = recent[0]?.track || recent[0];
  const recentArtist = recentTrack ? getReplayItemArtist(recentTrack) : '';
  const perceptions = [
    topTrack && { title: 'ritual recente', text: `Você ouviu ${topTrack.name || topTrack.track?.name}${topTrackArtist ? `, de ${topTrackArtist}` : ''}, ${coreUtils.formatNumber(getReplayItemCount(topTrack))} vezes neste período.`, icon: Music2, image: getReplayItemImage(topTrack) },
    artists[0] && { title: 'sequência', text: `${artists[0].name} dominou seu período com ${coreUtils.formatNumber(getReplayItemCount(artists[0]))} reproduções.`, icon: UserCircle, image: getReplayItemImage(artists[0]) },
    discovery && { title: 'baixa repetição', text: `${discovery.name || discovery.track?.name}${discoveryArtist ? `, de ${discoveryArtist}` : ''}, foi uma das faixas que você menos repetiu neste recorte.`, icon: Sparkles, image: getReplayItemImage(discovery) },
    recentTrack && { title: 'última descoberta', text: `${recentTrack.name || 'uma faixa nova'}${recentArtist ? `, de ${recentArtist}` : ''}, aparece como sua reprodução mais recente.`, icon: Clock3, image: getReplayItemImage(recentTrack) }
  ].filter(Boolean) as Array<{ title: string; text: string; icon: any; image?: string }>;

  useEffect(() => {
    if (activeIndex >= perceptions.length) setActiveIndex(0);
  }, [activeIndex, perceptions.length]);

  const goTo = useCallback((index: number) => {
    if (perceptions.length === 0) return;
    setActiveIndex((index + perceptions.length) % perceptions.length);
  }, [perceptions.length]);

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
    goTo(activeIndex + (dx < 0 ? 1 : -1));
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
    <section className="mt-5 px-4 sm:px-6 lg:px-8">
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
      >
        <div className="pointer-events-none absolute left-1/2 top-[46%] h-[226px] w-[226px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.055]" />
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[46%] h-[164px] w-[164px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-orange-500/14"
          animate={{ rotate: -360 }}
          transition={{ duration: 46, repeat: Infinity, ease: 'linear' }}
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
              transition={{ type: 'spring', stiffness: 160, damping: 24, delay: 0.04 * relative }}
              style={{ width: position.size, height: position.size }}
            >
              <motion.div
                className="relative h-full w-full"
                animate={!shouldReduceMotion ? {
                  y: [0, relative % 2 === 0 ? 2 : -2, 0],
                  rotate: [0, relative % 2 === 0 ? -0.45 : 0.45, 0],
                } : {}}
                transition={!shouldReduceMotion ? {
                  duration: 6.2 + relative * 0.45,
                  repeat: Infinity,
                  ease: 'easeInOut',
                } : {}}
              >
                {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
                <div className="absolute inset-0 bg-black/20" />
              </motion.div>
            </motion.div>
          );
        })}

        <motion.article
          key={`perception-active-${activePerception.title}`}
          className="absolute left-1/2 top-[50%] z-30 grid w-[82%] -translate-x-1/2 -translate-y-1/2 grid-cols-[78px_minmax(0,1fr)] gap-4"
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 170, damping: 23 }}
        >
          <motion.div
            animate={!shouldReduceMotion ? { y: [0, -4, 2, 0], rotate: [0, 0.35, -0.25, 0] } : {}}
            transition={!shouldReduceMotion ? { duration: 9.5, repeat: Infinity, ease: 'easeInOut' } : {}}
            className="relative h-[78px] w-[78px] overflow-hidden rounded-[24px] bg-black shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
          >
            {activePerception.image ? <img src={activePerception.image} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
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

        {perceptions.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-40 flex justify-center gap-1.5">
            {perceptions.map((item, index) => (
              <button
                key={`perception-dot-${item.title}`}
                type="button"
                onClick={() => goTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
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

const HomeRecentPlays = ({ recent, onViewMore }: { recent: any[]; onViewMore?: () => void }) => {
  const list = recent.slice(0, 10);
  return (
    <section className="px-4 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-orange-500" />
          <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/86">Últimas Reproduções</h2>
        </div>
        {list.length > 0 && (
          <button
            type="button"
            onClick={onViewMore}
            className="shrink-0 rounded-full bg-white/[0.045] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white/80"
          >
            ver mais
          </button>
        )}
      </div>
      <div className="glass-aura flex flex-col gap-2 rounded-[32px] p-3">
        {list.length === 0 && (
          <div className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[24px] bg-white/[0.025] px-4 text-center">
            <Clock3 className="h-5 w-5 text-white/18" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/32">Nenhuma reprodução recente confirmada</span>
          </div>
        )}
        {list.map((item, index) => {
          const track = item.track || item;
          const artist = Array.isArray(track.artists)
            ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean).join(', ')
            : track.artist?.name || item.artistName || '';
          const playedAt = item.playedAt || item.timestamp || item.endTime || item.date;
          return (
            <div key={`${track.id || track.name}-${index}`} className="flex items-center gap-3 rounded-[24px] bg-white/[0.035] px-3 py-2.5">
              <SmartImage src={track.image || track.albumImage || track.album?.image} className="h-11 w-11 object-cover" fallback={track.name || 'play'} rounded="2xl" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-white">{track.name || 'Sem título'}</span>
                <span className="block truncate text-xs font-semibold text-white/45">{artist}</span>
              </div>
              <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.12em] text-white/34">{playedAt ? coreUtils.formatRelativeTimeSP(playedAt) : 'agora'}</span>
            </div>
          );
        })}
      </div>
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
      return { period: 'week', after: getStartOfDay(monday), limit: 30 };
    }
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { period: '7days', after: getStartOfDay(sevenDaysAgo), limit: 30 };
  }
  if (activeTab === 'month') {
    const month = Number(selected.month ?? now.getMonth());
    const year = now.getFullYear();
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
    return `${REPLAY_MONTHS_LONG[month] || 'mês'} de ${now.getFullYear()}`;
  }
  if (activeTab === 'year') return selected.year || String(now.getFullYear());
  return 'total';
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
    try {
      return window.__STATS_LC_HOME_READY__ === true || sessionStorage.getItem('stats-lc-home-boot-ready') === '1';
    } catch {
      return window.__STATS_LC_HOME_READY__ === true;
    }
  };
  const groupStats = useStatsStore(state => state.groupStats);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const isLoading = useStatsStore(state => state.isLoading);
  const isRefreshing = useStatsStore(state => state.isRefreshing);
  const isOffline = useStatsStore(state => state.isOffline);
  const error = useStatsStore(state => state.error);
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const prefetchUserTops = useStatsStore(state => state.prefetchUserTops);
  const getHistoryCache = useStatsStore(state => state.getHistoryCache);
  const setHistoryCache = useStatsStore(state => state.setHistoryCache);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const setFeaturedUserId = useStatsStore(state => state.setFeaturedUserId);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [viewingFullHistoryUser, setViewingFullHistoryUser] = useState<any>(null);
  const [viewingAlbumHistoryUser, setViewingAlbumHistoryUser] = useState<any>(null);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [avatarClickPosition, setAvatarClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectorMode, setSelectorMode] = useState<'header' | 'mini-header'>('header');
  const [toasts, setToasts] = useState<any[]>([]);
  const [processedItems, setProcessedItems] = useState(0);
  const [refreshStepText, setRefreshStepText] = useState('Status: Ciclo Sincronizado');
  const [refreshProgress, setRefreshProgress] = useState(100);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [headerHighlight, setHeaderHighlight] = useState(false);
  const [isAppReady, setIsAppReady] = useState(() => hasBootReadySession());
  const [isVisualWarmupReady, setIsVisualWarmupReady] = useState(false);
  const [showInitialModal, setShowInitialModal] = useState(false);
  const [miniHeaderResolvedColor, setMiniHeaderResolvedColor] = useState('');
  const isHeaderScrolledRef = useRef(false);
  const [replayState, setReplayState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [replayTopItems, setReplayTopItems] = useState<{ artists: any[]; tracks: any[]; albums: any[] }>({
    artists: [],
    tracks: [],
    albums: []
  });
  const [circleTopState, setCircleTopState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [circleTopPeriodTops, setCircleTopPeriodTops] = useState<Record<string, { artists: any[]; tracks: any[]; albums: any[] }>>({});
  const [alikePrepState, setAlikePrepState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [recentPrepState, setRecentPrepState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [trackModalPrepState, setTrackModalPrepState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
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
  const hasReleasedHomeRef = useRef(hasBootReadySession());
  const shouldSkipHomeEntryMotion = hasReleasedHomeRef.current || hasBootReadySession();

  useEffect(() => {
    if (!hasReleasedHomeRef.current) return;
    window.__STATS_LC_HOME_READY__ = true;
    window.dispatchEvent(new CustomEvent('stats-lc-home-ready', { detail: { ready: true } }));
    setIsAppReady(true);
    window.__STATS_LC_DISMISS_SPLASH__?.();
  }, []);

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

  // Mini header mirrors the now playing vinyl once the hero scrolls away.
  const miniHeaderTrack = primaryUser?.nowPlaying?.track as any;
  const miniHeaderAlbumImage = (
    miniHeaderTrack?.image ||
    miniHeaderTrack?.albumImage ||
    miniHeaderTrack?.album?.image ||
    miniHeaderTrack?.album?.images?.[0]?.url ||
    miniHeaderTrack?.album?.images?.[0] ||
    miniHeaderTrack?.images?.[0]?.url ||
    miniHeaderTrack?.images?.[0] ||
    miniHeaderTrack?.albumArt ||
    miniHeaderTrack?.coverArt ||
    miniHeaderTrack?.cover_art ||
    miniHeaderTrack?.album_image ||
    miniHeaderTrack?.cover ||
    ''
  );
  const hasMiniHeaderAlbumImage = typeof miniHeaderAlbumImage === 'string' && miniHeaderAlbumImage.trim().length > 5;
  const miniHeaderDominantColor = primaryUser?.nowPlaying?.dominantColor || miniHeaderResolvedColor || '';
  const miniHeaderPlayback = primaryUser ? coreUtils.getPlaybackStatus({ nowPlaying: primaryUser.nowPlaying }) : null;
  const miniHeaderIsPlaying = miniHeaderPlayback?.status === 'live' && primaryUser?.nowPlaying?.isNow === true;
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
  const homePreparationSettled =
    !primaryUser ||
    (
      (replayState === 'ready' || replayState === 'error') &&
      (circleTopState === 'ready' || circleTopState === 'error') &&
      (alikePrepState === 'ready' || alikePrepState === 'error') &&
      (recentPrepState === 'ready' || recentPrepState === 'error') &&
      (trackModalPrepState === 'ready' || trackModalPrepState === 'error')
    );

  const pipelineStreamLinesMemo = useMemo(() => [
    { left: '16.6%', duration: 2.2, delay: 0 },
    { left: '33.2%', duration: 3.1, delay: 0.35 },
    { left: '49.8%', duration: 2.6, delay: 0.7 },
    { left: '66.4%', duration: 3.4, delay: 0.2 },
    { left: '83%', duration: 2.9, delay: 0.95 },
    { left: '91.5%', duration: 3.7, delay: 0.55 },
  ], []);

  const homeWarmupImageUrls = useMemo(() => {
    const urls = [
      miniHeaderAlbumImage,
      primaryUser ? coreUtils.getUserAvatar(primaryUser.id, primaryUser.avatar) : '',
      ...allMembers.map((member) => coreUtils.getUserAvatar(member.id, member.avatar)),
      ...allMembers.map((member) => {
        const track = member?.nowPlaying?.track as any;
        return track?.image || track?.albumImage || track?.album?.image || track?.album?.images?.[0]?.url || track?.album?.images?.[0] || '';
      }),
    ];
    return Array.from(new Set(urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 5)));
  }, [allMembers, membersSignature, miniHeaderAlbumImage, primaryUser?.avatar, primaryUser?.id]);

  useEffect(() => {
    if (!primaryUser) {
      setIsVisualWarmupReady(false);
      setMiniHeaderResolvedColor('');
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

    const resolveArtworkColor = () => {
      if (!hasMiniHeaderAlbumImage || primaryUser?.nowPlaying?.dominantColor) {
        return Promise.resolve('');
      }
      return getDominantColor(miniHeaderAlbumImage).catch(() => '');
    };

    const visualPreparation = Promise.all([
      preloadSmartImages(urls),
      resolveArtworkColor(),
    ]).then(([, color]) => color);
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 1800));
    Promise.race([
      visualPreparation,
      timeout.then(() => ''),
    ]).then((color) => {
      if (cancelled) return;
      setMiniHeaderResolvedColor(color || '');
      setIsVisualWarmupReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [hasMiniHeaderAlbumImage, homeWarmupImageUrls, miniHeaderAlbumImage, primaryUser?.avatar, primaryUser?.id, primaryUser?.nowPlaying?.dominantColor]);

  useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const shouldBeScrolled = scrollY >= 340;
        const shouldBeReset = scrollY <= 240;

        let nextValue = isHeaderScrolledRef.current;
        if (!isHeaderScrolledRef.current && shouldBeScrolled) {
          nextValue = true;
        } else if (isHeaderScrolledRef.current && shouldBeReset) {
          nextValue = false;
        }

        if (nextValue !== isHeaderScrolledRef.current) {
          isHeaderScrolledRef.current = nextValue;
          setIsHeaderScrolled(nextValue);
        }

        frame = 0;
      });
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

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

  // Mark Home as ready after the primary hero and cold Home sections are prepared.
  // After the first release, period changes can update below without returning to splash.
  useEffect(() => {
    const hasCoreData = !isLoading && !!groupStats && !!primaryUser;

    if (hasReleasedHomeRef.current && hasCoreData) {
      if (window.__STATS_LC_HOME_READY__ !== true) {
        window.__STATS_LC_HOME_READY__ = true;
        window.dispatchEvent(new CustomEvent('stats-lc-home-ready', { detail: { ready: true } }));
      }
      setIsAppReady(true);
      window.__STATS_LC_DISMISS_SPLASH__?.();
      return;
    }

    const ready = hasCoreData && isVisualWarmupReady && homePreparationSettled;

    if (!ready) {
      if (!hasReleasedHomeRef.current) {
        window.__STATS_LC_HOME_READY__ = false;
        window.dispatchEvent(new CustomEvent('stats-lc-home-ready', { detail: { ready: false } }));
      }
      setIsAppReady(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          hasReleasedHomeRef.current = true;
          window.__STATS_LC_HOME_READY__ = true;
          window.dispatchEvent(new CustomEvent('stats-lc-home-ready', { detail: { ready: true } }));
          setIsAppReady(true);
          window.__STATS_LC_DISMISS_SPLASH__?.();
        });
      });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLoading, groupStats, isVisualWarmupReady, primaryUser, homePreparationSettled]);

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
        modalName: 'album_detail', 
        albumId: selectedAlbum.id,
        albumName: selectedAlbum.name,
        artistName: selectedAlbum.artistName
      });
    }
  }, [selectedAlbum]);

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
    if (!groupStats || members.length === 0) {
      setCircleTopPeriodTops({});
      setCircleTopState(groupStats ? 'ready' : 'idle');
      return;
    }

    let cancelled = false;
    const bootMembers = members;
    setCircleTopState('loading');

    Promise.allSettled(bootMembers.map(async (member) => {
      const [artists, tracks, albums] = await Promise.all([
        statsService.getTopItems(member.id, 'artists', { ...replayPeriodQuery, limit: 1 }).catch(() => member.topItems?.artists?.slice(0, 1) || []),
        statsService.getTopItems(member.id, 'tracks', { ...replayPeriodQuery, limit: 1 }).catch(() => member.topItems?.tracks?.slice(0, 1) || []),
        statsService.getTopItems(member.id, 'albums', { ...replayPeriodQuery, limit: 1 }).catch(() => member.topItems?.albums?.slice(0, 1) || [])
      ]);
      return { id: member.id, tops: { artists, tracks, albums } };
    })).then((results) => {
      if (cancelled) return;
      const next: Record<string, { artists: any[]; tracks: any[]; albums: any[] }> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') next[result.value.id] = result.value.tops;
      });
      setCircleTopPeriodTops(next);
      setCircleTopState('ready');
    }).catch(() => {
      if (!cancelled) setCircleTopState('error');
    });

    return () => {
      cancelled = true;
    };
  }, [membersSignature, replayPeriodKey]);

  useEffect(() => {
    if (!groupStats || members.length === 0) {
      setAlikePrepState(groupStats ? 'ready' : 'idle');
      return;
    }

    let cancelled = false;
    const bootMembers = members;
    setAlikePrepState('loading');

    Promise.allSettled(bootMembers.map((member) => prefetchUserTops(member.id)))
      .then(() => {
        if (!cancelled) setAlikePrepState('ready');
      })
      .catch(() => {
        if (!cancelled) setAlikePrepState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [membersSignature, prefetchUserTops]);

  useEffect(() => {
    let cancelled = false;
      const normalizeRecentItems = (items: any[]) => items
        .map(statsService.normalizeRecentStream)
        .filter((item: any) => item?.track?.name);
      const directRecent = normalizeRecentItems(primaryUser?.recent || (primaryUser as any)?.history || []).slice(0, 20);

    if (!primaryUser?.id) {
      setResolvedRecentPlays([]);
      setRecentPrepState('idle');
      return;
    }

      const cachedRecent = normalizeRecentItems(getHistoryCache(primaryUser.id) || []);
      const sessionRecent = normalizeRecentItems(readHomeSessionCache<any[]>(`stats-lc-home-recent:${primaryUser.id}`) || []);
    const preparedRecent = [cachedRecent, sessionRecent, directRecent]
      .sort((a, b) => b.length - a.length)[0] || [];

    if (preparedRecent.length > 0) {
      setResolvedRecentPlays(preparedRecent.slice(0, 10));
    }

    if (preparedRecent.length >= 20) {
      setHistoryCache(primaryUser.id, preparedRecent);
      writeHomeSessionCache(`stats-lc-home-recent:${primaryUser.id}`, preparedRecent);
      setRecentPrepState('ready');
      return;
    }

    setRecentPrepState('loading');
    statsCacheService.fetchPaginatedHistory(primaryUser.id, 0, 20)
      .then((items) => {
        if (cancelled) return;
        const nextRecent = items?.length ? items : preparedRecent;
        setResolvedRecentPlays(nextRecent.slice(0, 10));
        if (nextRecent.length > 0) {
          setHistoryCache(primaryUser.id, nextRecent);
          writeHomeSessionCache(`stats-lc-home-recent:${primaryUser.id}`, nextRecent);
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
  }, [getHistoryCache, primaryUser?.id, primaryUser?.recent, setHistoryCache]);

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
                  onTrackClick={(track) => setSelectedTrack(track)}
                  groupStats={groupStats}
                />
              )}
              {selectedTrack && (
                <TrackLeaderboardModal 
                  track={selectedTrack} 
                  onClose={() => setSelectedTrack(null)} 
                />
              )}
              {selectedAlbum && (
                 <AlbumDetailModal 
                   user={primaryUser}
                   album={selectedAlbum}
                   onClose={() => setSelectedAlbum(null)}
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
              mode={selectorMode}
            />
          </AnimatePresence>

          {/* Top Bar Navigation - Floating */}
          <FloatingMiniHeader
            visible={isHeaderScrolled && hasMiniHeaderAlbumImage}
            albumImage={miniHeaderAlbumImage}
            dominantColor={miniHeaderDominantColor}
            isPlaying={miniHeaderIsPlaying}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
        </>,
        document.body
      )}

      <div
        className="flex flex-col gap-3 pt-24 pb-[calc(11rem+env(safe-area-inset-bottom,0px))]"
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
      <AnimatePresence mode="wait">
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
                   className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.15em] shadow-[0_10px_25px_rgba(234,88,12,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait"
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
                   className="w-full px-6 py-3.5 glass hover:bg-white/10 text-white/70 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all active:scale-95"
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
                  streamsToday={primaryUser.streamsToday || 0}
                  onTrackClick={(track) => setSelectedTrack(track)}
                  isHighlighted={headerHighlight}
                />
              </div>

              <div className={cn("px-4 sm:px-6 lg:px-8", friendActivityOffset)}>
                <FriendActivityReel
                  excludeUserId={primaryUser.id}
                  onTrackClick={(track) => setSelectedTrack(track)}
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

      {isAppReady && primaryUser && (
        <motion.div
          initial={shouldSkipHomeEntryMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="px-4 sm:px-6 lg:px-8"
        >
          <HomeReplayFilter
            activeTab={replayActiveTab}
            selectedSubValues={replaySelectedSubValues}
            onActiveTabChange={setReplayActiveTab}
            onSelectedSubValuesChange={setReplaySelectedSubValues}
          />
        </motion.div>
      )}

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
        />
      )}

      {isAppReady && primaryUser && (
        <HomePerceptions
          tracks={replayTracks}
          artists={replayArtists}
          recent={resolvedRecentPlays}
        />
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
          preparedPeriodTops={circleTopPeriodTops}
        />
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
        >
          <HomeRecentPlays recent={resolvedRecentPlays} onViewMore={() => setViewingFullHistoryUser(primaryUser)} />
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
