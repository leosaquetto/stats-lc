/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Share2 } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'all';
type WeekMode = 'last-7' | 'current';

interface SelectedSubValues {
  weekMode?: WeekMode;
  month?: string;
  year?: string;
}

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
  totalSongsCount: number;
  onOpenArtistsModal: () => void;
  onOpenSongsModal: () => void;
  onOpenAlbumsModal: () => void;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const YEARS = [2024, 2025, 2026];

export const ReplaySection: React.FC<ReplaySectionProps> = ({
  topArtists,
  topTracks,
  topAlbums,
  totalSongsCount,
  onOpenArtistsModal,
  onOpenSongsModal,
  onOpenAlbumsModal
}) => {
  const [activeTab, setActiveTab] = useState<FilterPeriod>('today');
  const [selectedSubValues, setSelectedSubValues] = useState<SelectedSubValues>({
    weekMode: 'last-7',
    month: String(new Date().getMonth()).padStart(2, '0'),
    year: String(new Date().getFullYear())
  });

  const filterText = useMemo(() => {
    switch (activeTab) {
      case 'today':
        return 'hoje';
      case 'week':
        return selectedSubValues.weekMode === 'last-7'
          ? 'nos últimos 7 dias'
          : 'essa semana';
      case 'month':
        const monthIndex = parseInt(selectedSubValues.month || '0');
        return `em ${MONTHS[monthIndex].toLowerCase()}`;
      case 'year':
        return `em ${selectedSubValues.year}`;
      case 'all':
        return 'no total';
      default:
        return 'hoje';
    }
  }, [activeTab, selectedSubValues]);

  const limitedArtists = useMemo(() => topArtists.slice(0, 10), [topArtists]);
  const limitedTracks = useMemo(() => topTracks.slice(0, 12), [topTracks]);
  const limitedAlbums = useMemo(() => topAlbums.slice(0, 10), [topAlbums]);

  const hasData = totalSongsCount > 0 && (topArtists.length > 0 || topTracks.length > 0 || topAlbums.length > 0);

  const currentMonth = new Date().getMonth();
  const availableMonths = MONTHS_SHORT.slice(0, currentMonth + 1);

  if (!hasData) {
    return (
      <div className="py-8">
        <div className="glass-card rounded-3xl p-8 text-center flex flex-col items-center gap-4">
          <div className="text-6xl">🎵</div>
          <h2 className="text-2xl font-black text-white">Sem dados para este período</h2>
          <p className="text-white/50 text-sm">
            Continue ouvindo para ver seu Replay!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden py-8 space-y-8">
      {/* HEADER */}
      <div className="pl-4 pr-4">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-black text-white">Replay</h2>
          <button
            onClick={() => {
              console.log('Compartilhar Replay');
            }}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95"
            title="Compartilhar Replay"
          >
            <Share2 className="h-5 w-5 text-white/70 hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      {/* FILTROS (pills horizontais) - ANTES da frase */}
      <div className="px-4">
        <div className="flex w-full justify-between items-center relative">
          <button
            onClick={() => setActiveTab('today')}
            className={cn(
              "text-sm font-medium transition-colors px-3 py-1.5",
              activeTab === 'today'
                ? "text-white"
                : "text-white/40"
            )}
          >
            hoje
          </button>

          {/* Pill Semana com dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveTab('week')}
              className={cn(
                "text-sm font-medium transition-colors px-3 py-1.5",
                activeTab === 'week'
                  ? "text-white"
                  : "text-white/40"
              )}
            >
              semana
            </button>

            {/* Dropdown Semana */}
            {activeTab === 'week' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-white/10 rounded-xl backdrop-blur-lg shadow-2xl overflow-hidden min-w-[160px]"
              >
                <button
                  onClick={() => setSelectedSubValues(prev => ({ ...prev, weekMode: 'last-7' }))}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-xs transition-colors",
                    selectedSubValues.weekMode === 'last-7'
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/40 hover:bg-white/5 hover:text-white"
                  )}
                >
                  Últimos 7 dias
                </button>
                <button
                  onClick={() => setSelectedSubValues(prev => ({ ...prev, weekMode: 'current' }))}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-xs transition-colors",
                    selectedSubValues.weekMode === 'current'
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/40 hover:bg-white/5 hover:text-white"
                  )}
                >
                  Esta semana
                </button>
              </motion.div>
            )}
          </div>

          {/* Pill Mês com dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveTab('month')}
              className={cn(
                "text-sm font-medium transition-colors px-3 py-1.5",
                activeTab === 'month'
                  ? "text-white"
                  : "text-white/40"
              )}
            >
              mês
            </button>

            {/* Dropdown Mês */}
            {activeTab === 'month' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-white/10 rounded-xl backdrop-blur-lg shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto"
              >
                {availableMonths.map((month, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedSubValues(prev => ({ ...prev, month: String(index).padStart(2, '0') }))}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-xs transition-colors whitespace-nowrap",
                      selectedSubValues.month === String(index).padStart(2, '0')
                        ? "bg-white/10 text-white font-bold"
                        : "text-white/40 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {month}
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Pill Ano com dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveTab('year')}
              className={cn(
                "text-sm font-medium transition-colors px-3 py-1.5",
                activeTab === 'year'
                  ? "text-white"
                  : "text-white/40"
              )}
            >
              ano
            </button>

            {/* Dropdown Ano */}
            {activeTab === 'year' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-white/10 rounded-xl backdrop-blur-lg shadow-2xl overflow-hidden min-w-[120px]"
              >
                {YEARS.map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedSubValues(prev => ({ ...prev, year: String(year) }))}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-xs transition-colors",
                      selectedSubValues.year === String(year)
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/40 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {year}
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "text-sm font-medium transition-colors px-3 py-1.5",
              activeTab === 'all'
                ? "text-white"
                : "text-white/40"
            )}
          >
            tudo
          </button>
        </div>
      </div>

      {/* BLOCO DE CONTAGEM - 3 linhas */}
      <div className="pl-4 pr-4 space-y-1">
        <p className="text-lg">
          <span className="text-white/50">Você ouviu </span>
          <motion.span
            key={totalSongsCount}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-white"
          >
            {totalSongsCount.toLocaleString('pt-BR')}
          </motion.span>
        </p>
        <p className="text-lg">
          <span className="text-white">minutos</span>
          <span className="text-white/50"> de música {filterText}.</span>
        </p>
      </div>

      {/* SEÇÃO 1 — ARTISTAS MAIS OUVIDOS */}
      {limitedArtists.length > 0 && (
        <div className="space-y-4">
          <div className="pl-4 pr-4">
            <button
              onClick={onOpenArtistsModal}
              className="flex items-center gap-2 group"
            >
              <h3 className="text-[18px] font-black text-white truncate flex-1">Seus artistas mais ouvidos</h3>
              <ChevronRight className="h-5 w-5 text-white/40 group-hover:text-orange-500 transition-colors flex-shrink-0" />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x pb-2 px-4 hide-scrollbar">
            {limitedArtists.map((artist, index) => (
              <motion.div
                key={`${artist.id || artist.name}-${index}`}
                className="flex-shrink-0 snap-start"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-44 relative">
                  {/* Imagem do Artista - aumentado verticalmente */}
                  <div className="w-44 h-[40vh] rounded-2xl relative overflow-hidden bg-white/5 shadow-xl">
                    <SmartImage
                      src={artist.image || ''}
                      className="w-full h-full object-cover"
                      fallback={artist.name.charAt(0)}
                      rounded="2xl"
                    />

                    {/* Número do Ranking - SEM drop-shadow */}
                    <span className="absolute top-3 left-3 text-white font-black text-5xl z-10">
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
                    <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-10"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }} />

                    {/* Nome e Streams - meio inferior, SEM drop-shadow */}
                    <div className="absolute bottom-3 left-3 right-3 flex flex-col items-center text-center z-20">
                      <p className="text-white font-bold text-sm truncate w-full">
                        {artist.name}
                      </p>
                      <p className="text-white/70 text-xs">
                        {artist.streams.toLocaleString('pt-BR')} reproduções
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
        <div className="space-y-4">
          <div className="pl-4 pr-4">
            <button
              onClick={onOpenSongsModal}
              className="flex items-center gap-2 group"
            >
              <h3 className="text-[18px] font-black text-white truncate flex-1">Suas músicas mais ouvidas</h3>
              <ChevronRight className="h-5 w-5 text-white/40 group-hover:text-orange-500 transition-colors flex-shrink-0" />
            </button>
          </div>

          {/* Scroll horizontal com 4 linhas verticais - mostra 12 músicas (3 colunas de 4) */}
          <div className="overflow-x-auto snap-x hide-scrollbar px-4">
            <div className="flex gap-6">
              {/* Cada "página" mostra 4 músicas em coluna */}
              {Array.from({ length: Math.ceil(limitedTracks.length / 4) }).map((_, pageIndex) => (
                <div key={pageIndex} className="flex flex-col gap-3 snap-start flex-shrink-0">
                  {limitedTracks.slice(pageIndex * 4, (pageIndex + 1) * 4).map((track, indexInPage) => {
                    const globalIndex = pageIndex * 4 + indexInPage;
                    return (
                      <motion.div
                        key={`${track.id || track.name}-${globalIndex}`}
                        className="flex items-center gap-3 w-[82vw]"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        {/* Capa */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 shadow-lg">
                          <SmartImage
                            src={track.image || ''}
                            className="w-full h-full object-cover"
                            fallback="🎵"
                            rounded="lg"
                          />
                        </div>

                        {/* Número do ranking - BRANCO */}
                        <span className="text-white font-bold text-sm w-6 text-center flex-shrink-0">
                          {globalIndex + 1}
                        </span>

                        {/* Coluna de texto */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{track.name}</p>
                          <p className="text-xs text-white/50 truncate">
                            {track.artist} · {track.streams.toLocaleString('pt-BR')} reproduções
                          </p>
                        </div>

                        {/* 3 pontinhos - link para plataforma */}
                        <button
                          onClick={() => {
                            // TODO: Abrir link da plataforma (priorizar Apple Music, fallback Spotify)
                            console.log('Abrir música na plataforma:', track.name);
                          }}
                          className="text-white/30 hover:text-white/60 text-lg flex-shrink-0 transition-colors"
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
        <div className="space-y-4">
          <div className="pl-4 pr-4">
            <button
              onClick={onOpenAlbumsModal}
              className="flex items-center gap-2 group"
            >
              <h3 className="text-[18px] font-black text-white truncate flex-1">Seus álbuns mais ouvidos</h3>
              <ChevronRight className="h-5 w-5 text-white/40 group-hover:text-orange-500 transition-colors flex-shrink-0" />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x pb-2 px-4 hide-scrollbar">
            {limitedAlbums.map((album, index) => (
              <motion.div
                key={`${album.id || album.name}-${index}`}
                className="flex-shrink-0 snap-start w-36"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-full">
                  {/* Capa do Álbum - quadrada */}
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/5 shadow-xl">
                    <SmartImage
                      src={album.image || ''}
                      className="w-full h-full object-cover"
                      fallback="💿"
                      rounded="xl"
                    />
                  </div>

                  {/* Informações - 4 linhas */}
                  <div className="mt-2 space-y-0.5">
                    <p className="text-white/60 text-xs font-bold">#{index + 1}</p>
                    <p className="text-white font-semibold text-sm truncate">{album.name}</p>
                    <p className="text-white/50 text-xs truncate">{album.artist}</p>
                    <p className="text-white/40 text-xs">{album.streams.toLocaleString('pt-BR')} minutos</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
