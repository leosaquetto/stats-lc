
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, AlertTriangle, WifiOff, Users, Sparkles, Loader2, Check, Info, X, Music2, Disc3, Clock3, PlayCircle, UserCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FriendActivityReel } from '../components/home/FriendActivityReel';
import { MONTHS_SHORT, type ReplayFilterPeriod, type ReplaySelectedSubValues, type ReplayWeekMode } from '../components/home/replayUtils';
import { UserSelectorModal } from '../components/home/UserSelectorModal';
import { UserSelectorExplosion } from '../components/home/UserSelectorExplosion';
import { TopAlbumsModal, TopArtistsModal, TopSongsModal } from '../components/home/ReplayModals';
import { coreUtils } from '../services/statsCore';
import { statsService, type ReplayPeriodQuery } from '../services/statsService';
import { trackEvent, identifyUser } from '../services/analyticsService';

import { LeoHeader } from '../components/home/LeoHeader';
import { FriendsMonthlyHighlights } from '../components/home/FriendsMonthlyHighlights';
import { StatsAlike } from '../components/home/StatsAlike';
import { ShimmerOverlay, SmartImage } from '../components/shared/CommonUI';
import { HomeInsights } from '../components/home/HomeInsights';
import { getCanonicalMembers, getVisibleMembers } from '../lib/memberSelectors';
import { getDominantColor } from '../lib/colorUtils';
import { VinylRecord } from '../components/home/VinylRecord';

const UserHistoryModal = React.lazy(() => import('../components/modals/UserHistoryModal').then(module => ({ default: module.UserHistoryModal })));
const TrackLeaderboardModal = React.lazy(() => import('../components/modals/TrackLeaderboardModal').then(module => ({ default: module.TrackLeaderboardModal })));
const AlbumDetailModal = React.lazy(() => import('../components/modals/AlbumDetailModal').then(module => ({ default: module.AlbumDetailModal })));
const UserAlbumHistoryModal = React.lazy(() => import('../components/modals/UserAlbumHistoryModal').then(module => ({ default: module.UserAlbumHistoryModal })));

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const highlightsContentHeight = "h-[560px]";
  const groups = [
    { key: 'artists', title: 'Top artistas', icon: UserCircle, items: artists.slice(0, 8) },
    { key: 'tracks', title: 'Top músicas', icon: Music2, items: tracks.slice(0, 14) },
    { key: 'albums', title: 'Top álbuns', icon: Disc3, items: albums.slice(0, 6) }
  ].filter((group) => group.items.length > 0);

  useEffect(() => {
    if (activeIndex >= groups.length) setActiveIndex(0);
  }, [activeIndex, groups.length]);

  const rankNumberClass = "absolute left-3 top-2 z-20 text-[50px] font-black leading-none text-white drop-shadow-[0_12px_26px_rgba(0,0,0,0.42)]";
  const countBadgeClass = "absolute right-2 top-2 z-20 flex h-8 min-w-8 items-center justify-center rounded-full bg-orange-600 px-2 text-[10px] font-black leading-none text-white shadow-[0_14px_30px_rgba(0,0,0,0.34)] backdrop-blur-xl";

  const goTo = useCallback((index: number) => {
    if (groups.length === 0) return;
    setActiveIndex((index + groups.length) % groups.length);
  }, [groups.length]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
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

  const renderArtists = (items: any[]) => {
    const featured = items.slice(0, 6);
    return (
      <div className={cn("relative overflow-visible", highlightsContentHeight)}>
        <div className="grid h-full grid-cols-3 grid-rows-2 gap-x-4 gap-y-4">
          {featured.map((item, index) => {
            return (
              <motion.div
                key={`${item.id || item.name}-${index}`}
                className="relative overflow-visible rounded-[24px] bg-black/20 shadow-[0_18px_42px_rgba(0,0,0,0.42)]"
                animate={{ y: [0, index % 2 ? 2 : -2, 0] }}
                transition={{ duration: 11 + index * 0.7, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="absolute inset-0 overflow-hidden rounded-[24px]">
                  <SmartImage
                    src={getReplayItemImage(item)}
                    className="absolute inset-0 h-full w-full object-cover"
                    fallback={item.name}
                    rounded="none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/8 via-transparent to-black/78" />
                </div>
                <span className={rankNumberClass}>
                  {index + 1}
                </span>
                <span className={countBadgeClass}>
                  {coreUtils.formatNumber(getReplayItemCount(item))}
                </span>
                <div className="absolute inset-x-3 bottom-3 z-10">
                  <span className="block truncate text-[14px] font-black leading-tight text-white">
                    {item.name || 'sem nome'}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-black text-white/72">
                    {coreUtils.formatNumber(getReplayMinutes(item))} min
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTracks = (items: any[]) => (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
      {items.map((item, index) => (
        <motion.div
          key={`${item.id || item.name}-${index}`}
          className="min-w-0"
          animate={{ y: [0, index % 2 ? -3 : 3, 0] }}
          transition={{ duration: 9 + index * 0.18, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="relative aspect-square overflow-hidden rounded-[24px] bg-black/18 shadow-[0_18px_42px_rgba(0,0,0,0.42)]">
            <SmartImage src={getReplayItemImage(item)} className="h-full w-full object-cover" fallback={item.name} rounded="none" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/4 via-transparent to-black/62" />
            <span className={countBadgeClass}>{coreUtils.formatNumber(getReplayItemCount(item))}</span>
          </div>
          <div className="mt-2 flex items-start gap-2">
            <span className="shrink-0 text-[24px] font-black leading-none text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.48)]">{index + 1}</span>
            <div className="min-w-0">
              <span className="line-clamp-2 text-[12px] font-black leading-[1.05] text-white">{item.name || item.track?.name || 'sem nome'}</span>
              <span className="mt-1 block truncate text-[10px] font-semibold text-white/48">{getReplayItemArtist(item)}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );

  const renderAlbums = (items: any[]) => (
    <div className={cn("grid grid-cols-2 gap-3 overflow-visible", highlightsContentHeight)}>
      {items.map((item, index) => (
        <div key={`${item.id || item.name}-${index}`} className="min-w-0">
          <div className="relative aspect-square overflow-visible rounded-[20px]">
            <SmartImage src={getReplayItemImage(item)} className="h-full w-full object-cover" fallback={item.name} rounded="2xl" />
            <span className="absolute left-3 top-2 z-20 text-[42px] font-black leading-none text-white drop-shadow-[0_12px_26px_rgba(0,0,0,0.42)]">{index + 1}</span>
            <span className={countBadgeClass}>{coreUtils.formatNumber(getReplayItemCount(item))}</span>
          </div>
          <span className="mt-2 line-clamp-2 text-left text-[12px] font-black leading-tight text-white">{item.name || 'sem nome'}</span>
          <span className="mt-0.5 block truncate text-left text-[10px] font-semibold text-white/45">{getReplayItemArtist(item)} - {coreUtils.formatNumber(getReplayMinutes(item))} min</span>
        </div>
      ))}
    </div>
  );

  if (groups.length === 0) return null;
  const activeGroup = groups[activeIndex] || groups[0];
  const ActiveIcon = activeGroup.icon;

  return (
    <section className="relative overflow-visible px-4 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/86">Seus Destaques</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5">
          <PlayCircle className="h-3.5 w-3.5 text-orange-300" />
          <span className="text-[10px] font-black text-white">{coreUtils.formatNumber(totalMinutes)}</span>
          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-white/38">min</span>
        </div>
      </div>

      <div
        data-home-horizontal-scroll="true"
        className="relative select-none overflow-visible"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null; }}
      >
        <motion.article
          key={activeGroup.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-[398px] overflow-hidden rounded-[34px] bg-white/[0.026] px-5 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur-[34px]"
        >
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.055]"
            animate={{ rotate: 360 }}
            transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.045]"
            animate={{ rotate: -360 }}
            transition={{ duration: 58, repeat: Infinity, ease: 'linear' }}
          />
          <div className="relative z-10 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] shadow-[0_14px_32px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                <ActiveIcon className="h-4 w-4 text-orange-300" />
              </div>
              <div>
                <span className="block text-[11px] font-black uppercase tracking-[0.24em] text-orange-300">{activeGroup.title}</span>
                <span className="text-[9px] font-bold text-white/38">arraste para ver o próximo</span>
              </div>
            </div>
            <span className="rounded-full bg-white/[0.055] px-2.5 py-1 text-[9px] font-black text-white/45">{activeIndex + 1}/{groups.length}</span>
          </div>

          <div className="relative z-10">
            {activeGroup.key === 'artists' && renderArtists(activeGroup.items)}
            {activeGroup.key === 'tracks' && renderTracks(activeGroup.items)}
            {activeGroup.key === 'albums' && renderAlbums(activeGroup.items)}
          </div>
        </motion.article>

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
  return (
    <section className="mt-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-orange-500" />
        <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/86">Perceptions</h2>
      </div>
      <div
        data-home-horizontal-scroll="true"
        className="relative h-[214px] overflow-visible [perspective:1000px]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null; }}
      >
        {perceptions.map((item, index) => {
          const Icon = item.icon;
          const relative = (index - activeIndex + perceptions.length) % perceptions.length;
          const isPrimary = relative === 0;
          const isSecondary = relative === 1;
          const isPrev = relative === perceptions.length - 1;
          if (!isPrimary && !isSecondary && !isPrev) return null;
          const x = isPrimary ? -78 : isSecondary ? 78 : 0;
          const y = isPrev ? 16 : 0;
          const scale = isPrimary || isSecondary ? 1 : 0.78;
          const opacity = isPrimary || isSecondary ? 1 : 0.2;
          const blur = isPrimary || isSecondary ? 'blur(0px)' : 'blur(8px)';
          return (
            <motion.div
              key={`${item.title}-${index}`}
              onClick={() => !isPrimary && !isSecondary ? goTo(index) : undefined}
              animate={{ x: `calc(-50% + ${x}px)`, y: [y, y - 5, y], scale, opacity, filter: blur, zIndex: isPrimary || isSecondary ? 20 : 5 }}
              transition={{ y: { duration: 8 + index * 0.6, repeat: Infinity, ease: 'easeInOut' }, default: { type: 'spring', stiffness: 155, damping: 24 } }}
              className="absolute left-1/2 top-0 h-[198px] w-[calc(50%-10px)] overflow-hidden rounded-[24px] bg-white/[0.026] px-3.5 py-3.5 shadow-[0_18px_45px_rgba(0,0,0,0.32)] backdrop-blur-[34px]"
            >
              {item.image ? (
                <img src={item.image} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.16]" loading="lazy" decoding="async" />
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/20 via-black/35 to-orange-950/20" />
              <div className="relative z-10 mb-3 flex h-8 w-8 items-center justify-center rounded-xl glass-aura-orange">
                <Icon className="h-4 w-4 text-white" />
              </div>
              <span className="relative z-10 text-[8px] font-black uppercase tracking-[0.22em] text-orange-300">{item.title}</span>
              <p className="relative z-10 mt-1.5 text-[11px] font-black leading-snug text-white">{item.text}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

const HomeRecentPlays = ({ recent }: { recent: any[] }) => {
  const list = recent.slice(0, 10);
  if (list.length === 0) return null;
  return (
    <section className="px-4 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center gap-3">
        <Clock3 className="h-5 w-5 text-orange-500" />
        <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/86">Últimas Reproduções</h2>
      </div>
      <div className="glass-aura flex flex-col gap-2 rounded-[32px] p-3">
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
  const groupStats = useStatsStore(state => state.groupStats);
  const isLoading = useStatsStore(state => state.isLoading);
  const isRefreshing = useStatsStore(state => state.isRefreshing);
  const isOffline = useStatsStore(state => state.isOffline);
  const error = useStatsStore(state => state.error);
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const prefetchUserTops = useStatsStore(state => state.prefetchUserTops);
  const prefetchNextFriend = useStatsStore(state => state.prefetchNextFriend);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const setFeaturedUserId = useStatsStore(state => state.setFeaturedUserId);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const navigate = useNavigate();
  
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
  const [isAppReady, setIsAppReady] = useState(false);
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
  const [replayTotalMinutesCount, setReplayTotalMinutesCount] = useState(0);
  const [openReplayModal, setOpenReplayModal] = useState<'artists' | 'songs' | 'albums' | null>(null);
  const [replayActiveTab, setReplayActiveTab] = useState<ReplayFilterPeriod>('month');
  const [replaySelectedSubValues, setReplaySelectedSubValues] = useState<ReplaySelectedSubValues>({
    weekMode: 'last-7',
    month: String(new Date().getMonth()).padStart(2, '0'),
    year: String(new Date().getFullYear())
  });
  const toastIdRef = useRef(0);
  const hasReleasedHomeRef = useRef(false);

  const allMembers = useMemo(() => getCanonicalMembers(groupStats) || [], [groupStats]);
  const members = useMemo(() => getVisibleMembers(groupStats, hiddenUsers) || [], [groupStats, hiddenUsers]);
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

  const pipelineStreamLinesMemo = useMemo(() => [
    { left: '16.6%', duration: 2.2, delay: 0 },
    { left: '33.2%', duration: 3.1, delay: 0.35 },
    { left: '49.8%', duration: 2.6, delay: 0.7 },
    { left: '66.4%', duration: 3.4, delay: 0.2 },
    { left: '83%', duration: 2.9, delay: 0.95 },
    { left: '91.5%', duration: 3.7, delay: 0.55 },
  ], []);

  useEffect(() => {
    if (!primaryUser) {
      setIsVisualWarmupReady(false);
      return;
    }

    const urls = [miniHeaderAlbumImage, coreUtils.getUserAvatar(primaryUser.id, primaryUser.avatar)]
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 5);

    if (urls.length === 0) {
      setIsVisualWarmupReady(true);
      return;
    }

    let cancelled = false;
    setIsVisualWarmupReady(false);

    const warmImage = (url: string) => new Promise<void>((resolve) => {
      const image = new Image();
      const done = () => resolve();
      const timer = window.setTimeout(done, 1500);
      image.onload = () => {
        window.clearTimeout(timer);
        if (image.decode) {
          image.decode().then(done).catch(done);
        } else {
          done();
        }
      };
      image.onerror = done;
      image.decoding = 'async';
      image.src = url;
    });

    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 1800));
    Promise.race([
      Promise.all(urls.map(warmImage)).then(() => undefined),
      timeout,
    ]).finally(() => {
      if (!cancelled) setIsVisualWarmupReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [miniHeaderAlbumImage, primaryUser?.avatar, primaryUser?.id]);

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
    let cancelled = false;

    if (!hasMiniHeaderAlbumImage || primaryUser?.nowPlaying?.dominantColor) {
      setMiniHeaderResolvedColor('');
      return;
    }

    getDominantColor(miniHeaderAlbumImage)
      .then((color) => {
        if (!cancelled) setMiniHeaderResolvedColor(color || '');
      })
      .catch(() => {
        if (!cancelled) setMiniHeaderResolvedColor('');
      });

    return () => {
      cancelled = true;
    };
  }, [hasMiniHeaderAlbumImage, miniHeaderAlbumImage, primaryUser?.nowPlaying?.dominantColor]);

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
      prefetchUserTops(primaryUser.id);
      prefetchNextFriend(primaryUser.id);
    } else if (allMembers.length > 0) {
      setFeaturedUserId(allMembers[0].id);
      setShowInitialModal(false);
    }
  }, [allMembers, featuredUserId, primaryUser, members, groupStats, isLoading, prefetchUserTops, prefetchNextFriend, setFeaturedUserId]);

  // Mark Home as ready after the primary hero/vinyl assets are stable.
  // Replay/"Seus Destaques" keeps loading below and never blocks the first usable frame.
  useEffect(() => {
    const hasCoreData = !isLoading && !!groupStats && !!primaryUser;

    if (hasReleasedHomeRef.current && hasCoreData) {
      setIsAppReady(true);
      return;
    }

    const ready = hasCoreData && isVisualWarmupReady;

    if (!ready) {
      setIsAppReady(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          hasReleasedHomeRef.current = true;
          setIsAppReady(true);
          window.__STATS_LC_DISMISS_SPLASH__?.();
        });
      });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLoading, groupStats, isVisualWarmupReady, primaryUser]);

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

    setReplayState('loading');
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
        setReplayTotalMinutesCount(
          Number.isFinite(totalDurationMs) && totalDurationMs && totalDurationMs > 0
            ? Math.max(1, Math.round(totalDurationMs / 60000))
            : fallbackTotal
        );
        setReplayState('ready');
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [primaryUser?.id, replayPeriodQuery, replayActiveTab]);

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
          initial={{ opacity: 0, y: 18 }}
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
          recent={(primaryUser.recent || (primaryUser as any).history || []).slice(0, 10)}
        />
      )}

      {isAppReady && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
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
        initial={{ opacity: 0, y: 20 }}
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
        initial={{ opacity: 0, y: 20 }}
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <HomeRecentPlays recent={(primaryUser.recent || (primaryUser as any).history || []).slice(0, 10)} />
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
