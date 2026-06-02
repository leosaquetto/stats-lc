/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Share2, Star } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';
import { coreUtils } from '../../services/statsCore';

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
  onArtistClick?: (artist: Artist) => void;
}

interface TopSongsModalProps extends BaseModalProps {
  tracks: Track[];
  onTrackClick?: (track: Track) => void;
}

interface TopAlbumsModalProps extends BaseModalProps {
  albums: Album[];
  onAlbumClick?: (album: Album) => void;
}

const replayModalItemKey = (type: string, item: any, index: number) => {
  const stableId = item?.id || item?.name || item?.artist || 'unknown';
  return `${type}-${stableId}-${index}`;
};

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
        <div className="min-h-full px-5 pb-[150px] pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
          <div className="mb-9 flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 shadow-[0_10px_34px_rgba(0,0,0,0.45)] backdrop-blur-xl transition active:scale-95"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <div className="flex items-center gap-3">
              {showMore && (
                <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-[0_10px_34px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <MoreHorizontal className="h-6 w-6" />
                </button>
              )}
              <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-[0_10px_34px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <Share2 className="h-6 w-6" />
              </button>
            </div>
          </div>

          <header className="mb-8">
            <h2 className="text-[38px] font-black leading-none tracking-[-0.045em] text-white">{title}</h2>
            <p className="mt-1 text-[15px] font-semibold leading-none text-white/48">{period}</p>
          </header>

          {children}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const TopArtistsModal: React.FC<TopArtistsModalProps> = ({ isOpen, onClose, artists, period, onArtistClick }) => {
  const limitedArtists = artists.slice(0, 20);

  return (
    <ReplayModalShell isOpen={isOpen} onClose={onClose} title="Artistas mais ouvidos" period={period}>
      <div className="space-y-1">
        {limitedArtists.map((artist, index) => (
          <button
            key={replayModalItemKey('artist', artist, index)}
            onClick={() => onArtistClick?.({ ...artist, type: 'artist' } as Artist)}
            className="grid min-h-[72px] w-full grid-cols-[20px_64px_30px_1fr_20px] items-center gap-3 text-left"
          >
            <Star className="h-5 w-5 fill-[#ff4056] text-[#ff4056]" />
            <SmartImage
              src={artist.image || ''}
              className="h-[56px] w-[56px] rounded-full"
              fallback={artist.name.charAt(0)}
              rounded="full"
            />
            <span className="text-center text-[20px] font-black text-white">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-[18px] font-medium leading-tight text-white">{artist.name}</p>
              <p className="truncate text-[16px] leading-tight text-white/48">
                {coreUtils.formatNumber(artist.streams)} minutos
              </p>
            </div>
            <ChevronRight className="h-6 w-6 text-white/45" />
          </button>
        ))}
      </div>
    </ReplayModalShell>
  );
};

export const TopSongsModal: React.FC<TopSongsModalProps> = ({ isOpen, onClose, tracks, period, onTrackClick }) => {
  const limitedTracks = tracks.slice(0, 30);

  return (
    <ReplayModalShell isOpen={isOpen} onClose={onClose} title="Músicas mais ouvidas" period={period} showMore>
      <div>
        {limitedTracks.map((track, index) => (
          <button
            key={replayModalItemKey('track', track, index)}
            onClick={() => onTrackClick?.({ ...track, type: 'track' } as Track)}
            className="grid min-h-[64px] w-full grid-cols-[20px_52px_30px_1fr_28px] items-center gap-3 border-b border-white/10 text-left"
          >
            <Star className="h-5 w-5 fill-[#ff4056] text-[#ff4056]" />
            <SmartImage
              src={track.image || ''}
              className="h-[46px] w-[46px] rounded-[9px]"
              fallback="musica"
              rounded="lg"
            />
            <span className="text-center text-[19px] font-black text-white">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-medium leading-tight text-white">{track.name}</p>
              <p className="truncate text-[15px] leading-tight text-white/48">
                {track.artist} · {coreUtils.formatNumber(track.streams)} reproduções
              </p>
            </div>
            <MoreHorizontal className="h-6 w-6 text-white/85" />
          </button>
        ))}
      </div>
    </ReplayModalShell>
  );
};

export const TopAlbumsModal: React.FC<TopAlbumsModalProps> = ({ isOpen, onClose, albums, period, onAlbumClick }) => {
  const limitedAlbums = albums.slice(0, 15);

  return (
    <ReplayModalShell isOpen={isOpen} onClose={onClose} title="Álbuns mais ouvidos" period={period}>
      <div className="grid grid-cols-2 gap-x-5 gap-y-7">
        {limitedAlbums.map((album, index) => (
          <button
            key={replayModalItemKey('album', album, index)}
            onClick={() => onAlbumClick?.({ ...album, type: 'album', artistName: album.artist } as Album)}
            className="min-w-0 text-left"
          >
            <SmartImage
              src={album.image || ''}
              className="aspect-square w-full rounded-[12px] shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
              fallback="album"
              rounded="xl"
            />
            <div className="mt-2.5 min-w-0">
              <p className="text-[16px] font-black leading-none text-white">{index + 1}</p>
              <p className="mt-1 truncate text-[16px] font-black leading-tight text-white">{album.name}</p>
              <p className="truncate text-[15px] leading-tight text-white/48">{album.artist}</p>
              <p className="text-[15px] leading-tight text-white/48">
                {coreUtils.formatNumber(album.streams)} minutos
              </p>
            </div>
          </button>
        ))}
      </div>
    </ReplayModalShell>
  );
};
