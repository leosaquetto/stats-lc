/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Play, Share2, Shuffle, Star } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';

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

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: string;
}

interface TopArtistsModalProps extends BaseModalProps {
  artists: Artist[];
}

interface TopSongsModalProps extends BaseModalProps {
  tracks: Track[];
}

interface TopAlbumsModalProps extends BaseModalProps {
  albums: Album[];
}

const ReplayModalShell = ({
  isOpen,
  onClose,
  title,
  period,
  showMore = false,
  children
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  period: string;
  showMore?: boolean;
  children: React.ReactNode;
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-[220] overflow-y-auto bg-black text-white"
      >
        <div className="min-h-full px-5 pb-[170px] pt-[calc(2rem+env(safe-area-inset-top,0px))]">
          <div className="mb-12 flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/10 shadow-[0_10px_34px_rgba(0,0,0,0.45)] backdrop-blur-xl transition active:scale-95"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <div className="flex items-center gap-3">
              {showMore && (
                <button className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-[0_10px_34px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <MoreHorizontal className="h-7 w-7" />
                </button>
              )}
              <button className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-[0_10px_34px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <Share2 className="h-7 w-7" />
              </button>
            </div>
          </div>

          <header className="mb-10">
            <h2 className="text-[48px] font-black leading-none tracking-[-0.055em] text-white">{title}</h2>
            <p className="mt-1 text-[18px] font-semibold leading-none text-white/48">{period}</p>
          </header>

          {children}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const TopArtistsModal: React.FC<TopArtistsModalProps> = ({ isOpen, onClose, artists, period }) => {
  const limitedArtists = artists.slice(0, 20);

  return (
    <ReplayModalShell isOpen={isOpen} onClose={onClose} title="Artistas mais ouvidos" period={period}>
      <div className="space-y-1">
        {limitedArtists.map((artist, index) => (
          <div
            key={`${artist.id || artist.name}-${index}`}
            className="grid min-h-[84px] grid-cols-[24px_80px_34px_1fr_22px] items-center gap-3"
          >
            <Star className="h-5 w-5 fill-[#ff4056] text-[#ff4056]" />
            <SmartImage
              src={artist.image || ''}
              className="h-[68px] w-[68px] rounded-full"
              fallback={artist.name.charAt(0)}
              rounded="full"
            />
            <span className="text-center text-[22px] font-black text-white">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-[21px] font-medium leading-tight text-white">{artist.name}</p>
              <p className="truncate text-[19px] leading-tight text-white/48">
                {artist.streams.toLocaleString('pt-BR')} minutos
              </p>
            </div>
            <ChevronRight className="h-6 w-6 text-white/45" />
          </div>
        ))}
      </div>
    </ReplayModalShell>
  );
};

export const TopSongsModal: React.FC<TopSongsModalProps> = ({ isOpen, onClose, tracks, period }) => {
  const limitedTracks = tracks.slice(0, 30);

  return (
    <ReplayModalShell isOpen={isOpen} onClose={onClose} title="Músicas mais ouvidas" period={period} showMore>
      <div className="mb-9 grid grid-cols-2 gap-3">
        <button className="flex h-[58px] items-center justify-center gap-3 rounded-[12px] bg-white/10 text-[22px] font-medium text-[#ff4056]">
          <Play className="h-6 w-6 fill-[#ff4056]" />
          Reproduzir
        </button>
        <button className="flex h-[58px] items-center justify-center gap-3 rounded-[12px] bg-white/10 text-[22px] font-medium text-[#ff4056]">
          <Shuffle className="h-6 w-6" />
          Aleatório
        </button>
      </div>

      <div>
        {limitedTracks.map((track, index) => (
          <div
            key={`${track.id || track.name}-${index}`}
            className="grid min-h-[76px] grid-cols-[24px_60px_34px_1fr_34px] items-center gap-3 border-b border-white/10"
          >
            <Star className="h-5 w-5 fill-[#ff4056] text-[#ff4056]" />
            <SmartImage
              src={track.image || ''}
              className="h-[54px] w-[54px] rounded-[9px]"
              fallback="musica"
              rounded="lg"
            />
            <span className="text-center text-[22px] font-black text-white">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-[20px] font-medium leading-tight text-white">{track.name}</p>
              <p className="truncate text-[18px] leading-tight text-white/48">
                {track.artist} · {track.streams.toLocaleString('pt-BR')} reproduções
              </p>
            </div>
            <MoreHorizontal className="h-6 w-6 text-white/85" />
          </div>
        ))}
      </div>
    </ReplayModalShell>
  );
};

export const TopAlbumsModal: React.FC<TopAlbumsModalProps> = ({ isOpen, onClose, albums, period }) => {
  const limitedAlbums = albums.slice(0, 15);

  return (
    <ReplayModalShell isOpen={isOpen} onClose={onClose} title="Álbuns mais ouvidos" period={period}>
      <div className="grid grid-cols-2 gap-x-7 gap-y-9">
        {limitedAlbums.map((album, index) => (
          <div key={`${album.id || album.name}-${index}`} className="min-w-0">
            <SmartImage
              src={album.image || ''}
              className="aspect-square w-full rounded-[13px] shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
              fallback="album"
              rounded="xl"
            />
            <div className="mt-3 min-w-0">
              <p className="text-[18px] font-black leading-none text-white">{index + 1}</p>
              <p className="mt-1 truncate text-[19px] font-black leading-tight text-white">{album.name}</p>
              <p className="truncate text-[18px] leading-tight text-white/48">{album.artist}</p>
              <p className="text-[18px] leading-tight text-white/48">
                {album.streams.toLocaleString('pt-BR')} minutos
              </p>
            </div>
          </div>
        ))}
      </div>
    </ReplayModalShell>
  );
};
