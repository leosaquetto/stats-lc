/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronRight, Share2 } from 'lucide-react';
import { AnimatedNumber, EngineShimmer, SmartImage } from '../shared/CommonUI';
import { coreUtils } from '../../services/statsCore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  getReplayFilterLabel,
  getReplayFilterSentence,
  MONTHS_SHORT,
  type ReplayFilterPeriod,
  type ReplaySelectedSubValues,
  type ReplayWeekMode
} from './replayUtils';
import { getSelectableReplayYears } from '../../lib/replayYears';
import { motionRuntime } from '../../lib/motionRuntime';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const replayItemKey = (type: string, item: any, index: number) => {
  const stableId = item?.id || item?.name || item?.artist || 'unknown';
  return `${type}-${stableId}-${index}`;
};

interface Artist {
  id: string;
  name: string;
  image?: string;
  streams: number;
  minutes?: number;
}

interface Track {
  id: string;
  name: string;
  artist: string;
  image?: string;
  streams: number;
  minutes?: number;
  url?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  spotifyId?: string;
  appleMusicId?: string;
  externalIds?: {
    spotify?: string[] | string;
    appleMusic?: string[] | string;
  };
}

interface Album {
  id: string;
  name: string;
  artist: string;
  image?: string;
  streams: number;
  minutes?: number;
}

interface ReplaySectionProps {
  topArtists: Artist[];
  topTracks: Track[];
  topAlbums: Album[];
  totalMinutesCount: number;
  activeTab: ReplayFilterPeriod;
  selectedSubValues: ReplaySelectedSubValues;
  onActiveTabChange: (tab: ReplayFilterPeriod) => void;
  onSelectedSubValuesChange: (values: ReplaySelectedSubValues) => void;
  onOpenArtistsModal: () => void;
  onOpenSongsModal: () => void;
  onOpenAlbumsModal: () => void;
  onShareReplay?: () => void;
  onOpenTrack?: (track: Track) => void;
  isLoading?: boolean;
  ownerFirstName?: string;
}

const YEARS = getSelectableReplayYears();
const INITIAL_TRACK_ROWS = 4;

const ReplayTrackImage = ({ src, fallback }: { src?: string; fallback: string }) => {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/[0.06] text-[13px] font-black text-white/35">
        {fallback.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return <SmartImage src={src} className="h-full w-full object-cover" rounded="none" fallback={fallback} />;
};

export const ReplaySection: React.FC<ReplaySectionProps> = ({
  topArtists,
  topTracks,
  topAlbums,
  totalMinutesCount,
  activeTab,
  selectedSubValues,
  onActiveTabChange,
  onSelectedSubValuesChange,
  onOpenArtistsModal,
  onOpenSongsModal,
  onOpenAlbumsModal,
  onShareReplay,
  onOpenTrack,
  isLoading = false,
  ownerFirstName = 'Você'
}) => {
  const filterText = useMemo(() => getReplayFilterSentence(activeTab, selectedSubValues), [activeTab, selectedSubValues]);
  const filterLabel = useMemo(() => getReplayFilterLabel(activeTab, selectedSubValues), [activeTab, selectedSubValues]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [renderFullTrackList, setRenderFullTrackList] = useState(false);
  const [metricMode, setMetricMode] = useState<'plays' | 'minutes'>('plays');

  const sortForMetric = <T extends { streams: number; minutes?: number }>(items: T[]) => {
    if (metricMode !== 'minutes' || !items.some((item) => Number(item.minutes) > 0)) return items;
    return [...items].sort((a, b) => Number(b.minutes || 0) - Number(a.minutes || 0));
  };
  const limitedArtists = useMemo(() => sortForMetric(topArtists).slice(0, 10), [metricMode, topArtists]);
  const limitedTracks = useMemo(() => sortForMetric(topTracks).slice(0, 12), [metricMode, topTracks]);
  const visibleTracks = useMemo(
    () => (renderFullTrackList ? limitedTracks : limitedTracks.slice(0, INITIAL_TRACK_ROWS)),
    [limitedTracks, renderFullTrackList]
  );
  const limitedAlbums = useMemo(() => sortForMetric(topAlbums).slice(0, 10), [metricMode, topAlbums]);

  const hasData = totalMinutesCount > 0 || topArtists.length > 0 || topTracks.length > 0 || topAlbums.length > 0;

  const currentMonth = new Date().getMonth();
  const availableMonths = MONTHS_SHORT.slice(0, currentMonth + 1);

  useEffect(() => {
    setRenderFullTrackList(false);

    if (limitedTracks.length <= INITIAL_TRACK_ROWS) return undefined;

    if (window.requestIdleCallback && window.cancelIdleCallback) {
      const idleId = window.requestIdleCallback(() => setRenderFullTrackList(true), { timeout: 900 });
      return () => window.cancelIdleCallback(idleId);
    }

    return motionRuntime.scheduleTask(() => setRenderFullTrackList(true), 450, 'ambient');
  }, [activeTab, metricMode, selectedSubValues, limitedTracks.length]);

  const selectTab = (tab: ReplayFilterPeriod) => {
    onActiveTabChange(tab);
  };
  const selectSubValue = (values: ReplaySelectedSubValues) => {
    onSelectedSubValuesChange(values);
  };
  const periodTabs: Array<{ key: ReplayFilterPeriod; label: string }> = [
    { key: 'today', label: 'hoje' },
    { key: 'week', label: 'semana' },
    { key: 'month', label: 'mês' },
    { key: 'year', label: 'ano' },
    { key: 'all', label: 'tudo' }
  ];
  const replayMetricText = (item: { streams: number; minutes?: number }) => {
    if (metricMode === 'minutes') {
      const minutes = Math.round(Number(item.minutes || 0));
      return minutes > 0 ? `${coreUtils.formatNumber(minutes)} min` : 'tempo indisponível';
    }
    return `${coreUtils.formatNumber(item.streams)} reproduções`;
  };

  return (
    <div
      className="relative isolate w-full overflow-visible py-4"
      style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
    >
      <div className="pointer-events-none absolute -right-28 top-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(255,179,45,0.22)_0%,rgba(239,92,38,0.12)_42%,rgba(0,0,0,0)_72%)]" />
      {isLoading && (
        <div className="absolute left-0 right-0 top-2 h-px overflow-hidden rounded-full bg-white/5">
          <EngineShimmer
            active
            duration={1.2}
            className="h-full rounded-full"
            style={{ background: 'rgba(249,115,22,0.7)' }}
          />
        </div>
      )}

      <div className="relative z-10 space-y-5">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setFiltersOpen(open => !open)}
            className="group flex min-w-0 items-center gap-2 text-left active:scale-[0.98]"
            aria-expanded={filtersOpen}
          >
            <h2 className="text-[34px] font-black leading-none tracking-[-0.035em] text-white">Replay</h2>
            <span className="glass-aura inline-flex min-w-0 max-w-[150px] shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase text-white/62">
              <span className="stats-lc-compact-label">{filterLabel}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} />
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-full border border-white/10 bg-white/[0.045] p-1">
              {[
                { key: 'plays' as const, label: 'plays' },
                { key: 'minutes' as const, label: 'min' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setMetricMode(option.key)}
                  className={cn(
                    "stats-lc-compact-label rounded-full px-2.5 py-1.5 text-[8px] font-black uppercase transition-[background-color,color,transform]",
                    metricMode === option.key ? "bg-orange-500 text-black" : "text-white/42"
                  )}
                  aria-pressed={metricMode === option.key}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onShareReplay}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-200 active:scale-95"
              title="Compartilhar Replay"
              aria-label="Compartilhar Replay"
            >
              <Share2 className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            data-home-horizontal-scroll="true"
            className="glass-aura flex w-full items-center gap-2 overflow-x-auto rounded-[28px] p-1.5 no-scrollbar"
          >
            {periodTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => selectTab(tab.key)}
                className={cn(
                  "stats-lc-compact-label shrink-0 rounded-full px-3 py-2 text-[11px] font-black uppercase transition-colors",
                  activeTab === tab.key
                    ? "bg-white/[0.06] text-orange-400 shadow-[0_10px_26px_rgba(0,0,0,0.28)]"
                    : "text-white/38"
                )}
              >
                {tab.label}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {filtersOpen && activeTab === 'week' && (
        <div data-home-horizontal-scroll="true" className="relative z-10 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: 'last-7' as ReplayWeekMode, label: 'últimos 7 dias' },
            { key: 'current' as ReplayWeekMode, label: 'esta semana' }
          ].map((option) => {
            const isSelected = selectedSubValues.weekMode === option.key;
            return (
              <button
                key={option.key}
                onClick={() => selectSubValue({ ...selectedSubValues, weekMode: option.key })}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-[13px] font-black transition-colors",
                  isSelected
                    ? "border-white/18 bg-white/14 text-white"
                    : "border-white/8 bg-white/[0.03] text-white/42"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {filtersOpen && activeTab === 'month' && (
        <div data-home-horizontal-scroll="true" className="relative z-10 flex items-center gap-5 overflow-x-auto no-scrollbar">
          {availableMonths.map((month, index) => {
            const isSelected = selectedSubValues.month === String(index).padStart(2, '0');
            return (
              <button
                key={month}
                onClick={() => selectSubValue({ ...selectedSubValues, month: String(index).padStart(2, '0') })}
                className={cn(
                  "shrink-0 text-[18px] font-black tracking-[-0.02em] transition-colors",
                  isSelected ? "text-white" : "text-white/22"
                )}
              >
                {month}
              </button>
            );
          })}
        </div>
      )}

      {filtersOpen && activeTab === 'year' && (
        <div data-home-horizontal-scroll="true" className="relative z-10 flex items-center gap-3 overflow-x-auto no-scrollbar">
          {YEARS.map((year) => {
            const isSelected = selectedSubValues.year === String(year);
            return (
              <button
                key={year}
                onClick={() => selectSubValue({ ...selectedSubValues, year: String(year) })}
                className={cn(
                  "shrink-0 rounded-full border px-5 py-2 text-[14px] font-black transition-colors",
                  isSelected
                    ? "border-white/18 bg-white/14 text-white"
                    : "border-white/8 bg-white/[0.03] text-white/42"
                )}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}

      {!hasData && (
        <div className="glass-card rounded-3xl p-8 text-center flex flex-col items-center gap-4">
          <div className="text-6xl">🎵</div>
          <h2 className="text-2xl font-black text-white">Sem dados para este período</h2>
          <p className="text-white/50 text-sm">
            Continue ouvindo para ver seu Replay!
          </p>
        </div>
      )}

      {hasData && <div className={cn("max-w-[284px] transition-opacity duration-300", isLoading && "opacity-55")}>
        <p className="text-[23px] font-black leading-[1.1] tracking-[-0.03em] text-white/46">
          <span>{ownerFirstName === 'Você' ? 'Você ouviu ' : `${ownerFirstName} ouviu `}</span>
          <span
            key={totalMinutesCount}
            className="text-white inline-block relative"
          >
            <AnimatedNumber value={totalMinutesCount} startFrom={totalMinutesCount > 0 ? 1 : 0} />
          </span>
          {' '}
          <motion.span
            key={`minutos-${totalMinutesCount}`}
            initial={{ opacity: 0, scale: 0.8, rotateX: -90 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.3,
              ease: [0.16, 1, 0.3, 1]
            }}
            className="ml-1 inline-block text-white"
            style={{ transformOrigin: "center bottom" }}
          >minutos</motion.span>
          <span> de música {filterText}.</span>
        </p>
      </div>}

      {/* SEÇÃO 1 — ARTISTAS MAIS OUVIDOS */}
      {limitedArtists.length > 0 && (
        <div className={cn("space-y-4 transition-opacity duration-300", isLoading && "opacity-55")}>
          <div>
            <button
              onClick={onOpenArtistsModal}
              className="group flex max-w-[calc(100vw-48px)] items-center justify-start gap-2 text-left"
            >
              <h3 className="text-[18px] font-black leading-none tracking-[-0.025em] text-white">Seus artistas mais ouvidos</h3>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/55 transition-colors group-hover:text-white" />
            </button>
          </div>

          <div data-home-horizontal-scroll="true" className="flex gap-3 overflow-x-auto snap-x pb-2 no-scrollbar">
            {limitedArtists.map((artist, index) => (
              <motion.div
                key={replayItemKey('artist', artist, index)}
                className="flex-shrink-0 snap-start"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative w-[41vw] max-w-[164px]">
                  <div className="relative h-[230px] w-full overflow-hidden rounded-[18px] bg-white/5 shadow-xl">
                    <SmartImage
                      src={artist.image || ''}
                      className="w-full h-full object-cover"
                      fallback={artist.name.charAt(0)}
                      rounded="2xl"
                    />

                    {/* Número do Ranking - SEM drop-shadow */}
                    <span className="absolute left-3.5 top-3 z-10 text-[46px] font-black leading-none tracking-[-0.08em] text-white">
                      {index + 1}
                    </span>

                    {/* Efeito grain/granulado - começa em 4/5 do card */}
                    <div
                      className="absolute left-0 right-0 pointer-events-none z-5"
                      style={{
                        bottom: 0,
                        top: '80%',
                        backgroundImage: `
                          url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")
                        `,
                        opacity: 0.15,
                        mixBlendMode: 'overlay'
                      }}
                    />

                    {/* Gradiente escuro inferior */}
                    <div className="absolute inset-x-0 bottom-0 z-10 h-24 pointer-events-none bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                    <div className="absolute bottom-4 left-3 right-3 z-20 flex flex-col items-center text-center">
                      <p className="w-full truncate text-[17px] font-black leading-tight text-white">
                        {artist.name}
                      </p>
                      <p className="text-[14px] font-medium text-white/78">
                        {replayMetricText(artist)}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* SEÇÃO 2 — MÚSICAS MAIS OUVIDAS */}
      {limitedTracks.length > 0 && (
        <div className={cn("space-y-4 transition-opacity duration-300", isLoading && "opacity-55")}>
          <div>
            <button
              onClick={onOpenSongsModal}
              className="group flex max-w-[calc(100vw-48px)] items-center justify-start gap-2 text-left"
            >
              <h3 className="text-[18px] font-black leading-none tracking-[-0.025em] text-white">Suas músicas mais ouvidas</h3>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/55 transition-colors group-hover:text-white" />
            </button>
          </div>

          <div data-home-horizontal-scroll="true" className="overflow-x-auto snap-x no-scrollbar">
            <div className="flex gap-4">
              {Array.from({ length: Math.ceil(visibleTracks.length / 4) }).map((_, pageIndex) => (
                <div key={pageIndex} className="flex flex-col snap-start flex-shrink-0">
                  {visibleTracks.slice(pageIndex * 4, (pageIndex + 1) * 4).map((track, indexInPage) => {
                    const globalIndex = pageIndex * 4 + indexInPage;
                    return (
                      <div
                        key={replayItemKey('track', track, globalIndex)}
                        className="flex h-[50px] w-[calc(100vw-76px)] max-w-[296px] items-center gap-2.5 border-b border-white/10"
                      >
                        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-[8px] bg-white/5 shadow-lg">
                          <ReplayTrackImage
                            src={track.image || ''}
                            fallback={track.name || 'Música'}
                          />
                        </div>

                        <span className="w-6 flex-shrink-0 text-center text-[17px] font-black text-white">
                          {globalIndex + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="truncate text-[13px] font-semibold leading-tight text-white">{track.name}</p>
                          <p className="truncate text-[12px] leading-tight text-white/48">
                            {track.artist} · {replayMetricText(track)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenTrack?.(track)}
                          className="flex-shrink-0 text-[20px] leading-none text-white/70 transition-colors hover:text-white"
                          title={`Abrir ${track.name}`}
                          aria-label={`Abrir ${track.name}`}
                        >
                          ⋯
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 3 — ÁLBUNS MAIS OUVIDOS */}
      {limitedAlbums.length > 0 && (
        <div className={cn("space-y-4 transition-opacity duration-300", isLoading && "opacity-55")}>
          <div>
            <button
              onClick={onOpenAlbumsModal}
              className="group flex max-w-[calc(100vw-48px)] items-center justify-start gap-2 text-left"
            >
              <h3 className="text-[18px] font-black leading-none tracking-[-0.025em] text-white">Seus álbuns mais ouvidos</h3>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/55 transition-colors group-hover:text-white" />
            </button>
          </div>

          <div data-home-horizontal-scroll="true" className="flex gap-3 overflow-x-auto snap-x pb-2 no-scrollbar">
            {limitedAlbums.map((album, index) => (
              <motion.div
                key={replayItemKey('album', album, index)}
                className="flex-shrink-0 snap-start w-[33vw] max-w-[132px]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-full">
                  <div className="w-full aspect-square overflow-hidden rounded-[14px] bg-white/5 shadow-xl">
                    <SmartImage
                      src={album.image || ''}
                      className="w-full h-full object-cover"
                      fallback="💿"
                      rounded="xl"
                    />
                  </div>

                  <div className="mt-2.5 space-y-0.5">
                    <p className="text-[14px] font-black text-white">{index + 1}</p>
                    <p className="truncate text-[15px] font-black leading-tight text-white">{album.name}</p>
                    <p className="truncate text-[13px] leading-tight text-white/52">{album.artist}</p>
                    <p className="text-[13px] leading-tight text-white/52">{replayMetricText(album)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
