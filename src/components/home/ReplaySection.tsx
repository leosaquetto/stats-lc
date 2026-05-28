/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Share2 } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  getReplayFilterSentence,
  MONTHS_SHORT,
  type ReplayFilterPeriod,
  type ReplaySelectedSubValues,
  type ReplayWeekMode
} from './replayUtils';

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
}

interface Track {
  id: string;
  name: string;
  artist: string;
  image?: string;
  streams: number;
}

interface Album {
  id: string;
  name: string;
  artist: string;
  image?: string;
  streams: number;
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
  isLoading?: boolean;
}

const YEARS = [2024, 2025, 2026];

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
  isLoading = false
}) => {
  const filterText = useMemo(() => getReplayFilterSentence(activeTab, selectedSubValues), [activeTab, selectedSubValues]);

  const limitedArtists = useMemo(() => topArtists.slice(0, 10), [topArtists]);
  const limitedTracks = useMemo(() => topTracks.slice(0, 12), [topTracks]);
  const limitedAlbums = useMemo(() => topAlbums.slice(0, 10), [topAlbums]);

  const hasData = totalMinutesCount > 0 || topArtists.length > 0 || topTracks.length > 0 || topAlbums.length > 0;

  const currentMonth = new Date().getMonth();
  const availableMonths = MONTHS_SHORT.slice(0, currentMonth + 1);
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

  return (
    <div className="relative w-full overflow-hidden px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,179,45,0.55)_0%,rgba(239,92,38,0.28)_36%,rgba(0,0,0,0)_72%)] blur-3xl" />
      {isLoading && (
        <div className="absolute top-2 left-4 right-4 h-px overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full w-1/2 rounded-full bg-orange-500/70"
            animate={{ x: ['-100%', '220%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      )}

      <div className="relative z-10 space-y-7">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[44px] font-black leading-none tracking-[-0.035em] text-white">Replay</h2>
          <button
            onClick={() => {
              console.log('Compartilhar Replay');
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all active:scale-95"
            title="Compartilhar Replay"
          >
            <Share2 className="h-6 w-6" />
          </button>
        </div>

        <div className="-mx-1 flex w-full items-center gap-2 overflow-x-auto px-1 hide-scrollbar">
          {periodTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => selectTab(tab.key)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-black transition-colors",
                activeTab === tab.key
                  ? "bg-white/16 text-white shadow-[0_10px_26px_rgba(0,0,0,0.28)]"
                  : "text-white/38"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'week' && (
        <div className="relative z-10 flex items-center gap-2 overflow-x-auto hide-scrollbar">
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

      {activeTab === 'month' && (
        <div className="relative z-10 -mx-1 flex items-center gap-6 overflow-x-auto px-1 hide-scrollbar">
          {availableMonths.map((month, index) => {
            const isSelected = selectedSubValues.month === String(index).padStart(2, '0');
            return (
              <button
                key={month}
                onClick={() => selectSubValue({ ...selectedSubValues, month: String(index).padStart(2, '0') })}
                className={cn(
                  "shrink-0 text-[20px] font-black tracking-[-0.02em] transition-colors",
                  isSelected ? "text-white" : "text-white/22"
                )}
              >
                {month}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'year' && (
        <div className="relative z-10 flex items-center gap-3 overflow-x-auto hide-scrollbar">
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

      {hasData && <div className={cn("max-w-[328px] transition-opacity duration-300", isLoading && "opacity-55")}>
        <p className="text-[30px] font-black leading-[1.12] tracking-[-0.035em] text-white/46">
          <span>Você ouviu </span>
          <motion.span
            key={totalMinutesCount}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-white"
          >
            {Math.round(totalMinutesCount).toLocaleString('pt-BR')}
          </motion.span>
          <span className="text-white"> minutos</span>
          <span> de música {filterText}.</span>
        </p>
      </div>}

      {/* SEÇÃO 1 — ARTISTAS MAIS OUVIDOS */}
      {limitedArtists.length > 0 && (
        <div className={cn("space-y-5 transition-opacity duration-300", isLoading && "opacity-55")}>
          <div>
            <button
              onClick={onOpenArtistsModal}
              className="group ml-4 flex max-w-[calc(100vw-48px)] items-center justify-start gap-2 text-left"
            >
              <h3 className="text-[21px] font-black leading-none tracking-[-0.025em] text-white">Seus artistas mais ouvidos</h3>
              <ChevronRight className="h-6 w-6 shrink-0 text-white/55 transition-colors group-hover:text-white" />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x pb-2 pl-4 pr-7 hide-scrollbar scroll-pl-4">
            {limitedArtists.map((artist, index) => (
              <motion.div
                key={replayItemKey('artist', artist, index)}
                className="flex-shrink-0 snap-start"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative w-[48vw] max-w-[196px]">
                  <div className="relative h-[278px] w-full overflow-hidden rounded-[20px] bg-white/5 shadow-xl">
                    <SmartImage
                      src={artist.image || ''}
                      className="w-full h-full object-cover"
                      fallback={artist.name.charAt(0)}
                      rounded="2xl"
                    />

                    {/* Número do Ranking - SEM drop-shadow */}
                    <span className="absolute left-4 top-3.5 z-10 text-[58px] font-black leading-none tracking-[-0.08em] text-white">
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
                    <div className="absolute inset-x-0 bottom-0 z-10 h-32 pointer-events-none bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                    <div className="absolute bottom-5 left-3.5 right-3.5 z-20 flex flex-col items-center text-center">
                      <p className="w-full truncate text-[19px] font-black leading-tight text-white">
                        {artist.name}
                      </p>
                      <p className="text-[16px] font-medium text-white/78">
                        {artist.streams.toLocaleString('pt-BR')} minutos
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
        <div className={cn("space-y-5 transition-opacity duration-300", isLoading && "opacity-55")}>
          <div>
            <button
              onClick={onOpenSongsModal}
              className="group ml-4 flex max-w-[calc(100vw-48px)] items-center justify-start gap-2 text-left"
            >
              <h3 className="text-[21px] font-black leading-none tracking-[-0.025em] text-white">Suas músicas mais ouvidas</h3>
              <ChevronRight className="h-6 w-6 shrink-0 text-white/55 transition-colors group-hover:text-white" />
            </button>
          </div>

          <div className="overflow-x-auto snap-x pl-4 pr-6 hide-scrollbar scroll-pl-4">
            <div className="flex gap-6">
              {Array.from({ length: Math.ceil(limitedTracks.length / 4) }).map((_, pageIndex) => (
                <div key={pageIndex} className="flex flex-col snap-start flex-shrink-0">
                  {limitedTracks.slice(pageIndex * 4, (pageIndex + 1) * 4).map((track, indexInPage) => {
                    const globalIndex = pageIndex * 4 + indexInPage;
                    return (
                      <motion.div
                        key={replayItemKey('track', track, globalIndex)}
                        className="flex h-[58px] w-[calc(100vw-72px)] max-w-[318px] items-center gap-3 border-b border-white/10"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="h-[42px] w-[42px] flex-shrink-0 overflow-hidden rounded-[9px] bg-white/5 shadow-lg">
                          <SmartImage
                            src={track.image || ''}
                            className="w-full h-full object-cover"
                            fallback="🎵"
                            rounded="lg"
                          />
                        </div>

                        <span className="w-6 flex-shrink-0 text-center text-[18px] font-black text-white">
                          {globalIndex + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="truncate text-[15px] font-semibold leading-tight text-white">{track.name}</p>
                          <p className="truncate text-[12px] leading-tight text-white/48">
                            {track.artist} · {track.streams.toLocaleString('pt-BR')} reproduções
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            // TODO: Abrir link da plataforma (priorizar Apple Music, fallback Spotify)
                            console.log('Abrir música na plataforma:', track.name);
                          }}
                          className="flex-shrink-0 text-[20px] leading-none text-white/70 transition-colors hover:text-white"
                        >
                          ⋯
                        </button>
                      </motion.div>
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
        <div className={cn("space-y-5 transition-opacity duration-300", isLoading && "opacity-55")}>
          <div>
            <button
              onClick={onOpenAlbumsModal}
              className="group ml-4 flex max-w-[calc(100vw-48px)] items-center justify-start gap-2 text-left"
            >
              <h3 className="text-[21px] font-black leading-none tracking-[-0.025em] text-white">Seus álbuns mais ouvidos</h3>
              <ChevronRight className="h-6 w-6 shrink-0 text-white/55 transition-colors group-hover:text-white" />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x pb-2 pl-4 pr-7 hide-scrollbar scroll-pl-4">
            {limitedAlbums.map((album, index) => (
              <motion.div
                key={replayItemKey('album', album, index)}
                className="flex-shrink-0 snap-start w-[39vw] max-w-[158px]"
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

                  <div className="mt-3 space-y-0.5">
                    <p className="text-[15px] font-black text-white">{index + 1}</p>
                    <p className="truncate text-[17px] font-black leading-tight text-white">{album.name}</p>
                    <p className="truncate text-[15px] leading-tight text-white/52">{album.artist}</p>
                    <p className="text-[15px] leading-tight text-white/52">{album.streams.toLocaleString('pt-BR')} minutos</p>
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
