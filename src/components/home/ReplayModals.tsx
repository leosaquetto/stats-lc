/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight } from 'lucide-react';
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

export const TopArtistsModal: React.FC<TopArtistsModalProps> = ({ isOpen, onClose, artists, period }) => {
  const limitedArtists = artists.slice(0, 20);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-x-4 top-20 bottom-20 z-50 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">Artistas mais ouvidos</h2>
                <p className="text-sm text-white/50 mt-1">{period}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5 text-white/70" />
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {limitedArtists.map((artist, index) => (
                <div
                  key={`${artist.id || artist.name}-${index}`}
                  className="flex items-center gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  {/* Imagem circular */}
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
                    <SmartImage
                      src={artist.image || ''}
                      className="w-full h-full object-cover"
                      fallback={artist.name.charAt(0)}
                      rounded="full"
                    />
                  </div>

                  {/* Número do ranking */}
                  <span className="w-8 text-white/50 font-bold text-center flex-shrink-0">
                    {index + 1}
                  </span>

                  {/* Coluna de texto */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{artist.name}</p>
                    <p className="text-sm text-white/50">{artist.streams.toLocaleString('pt-BR')} reproduções</p>
                  </div>

                  {/* ChevronRight */}
                  <ChevronRight className="h-5 w-5 text-white/20 flex-shrink-0" />
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const TopSongsModal: React.FC<TopSongsModalProps> = ({ isOpen, onClose, tracks, period }) => {
  const limitedTracks = tracks.slice(0, 30);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-x-4 top-20 bottom-20 z-50 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">Músicas mais ouvidas</h2>
                <p className="text-sm text-white/50 mt-1">{period}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5 text-white/70" />
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {limitedTracks.map((track, index) => (
                <div
                  key={`${track.id || track.name}-${index}`}
                  className="flex items-center gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  {/* Capa */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                    <SmartImage
                      src={track.image || ''}
                      className="w-full h-full object-cover"
                      fallback="🎵"
                      rounded="lg"
                    />
                  </div>

                  {/* Número do ranking */}
                  <span className="w-8 text-white/50 font-bold text-center flex-shrink-0">
                    {index + 1}
                  </span>

                  {/* Coluna de texto */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{track.name}</p>
                    <p className="text-sm text-white/50 truncate">
                      {track.artist} · {track.streams.toLocaleString('pt-BR')} reproduções
                    </p>
                  </div>

                  {/* 3 pontinhos */}
                  <span className="text-white/20 text-lg flex-shrink-0">⋯</span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const TopAlbumsModal: React.FC<TopAlbumsModalProps> = ({ isOpen, onClose, albums, period }) => {
  const limitedAlbums = albums.slice(0, 15);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-x-4 top-20 bottom-20 z-50 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">Álbuns mais ouvidos</h2>
                <p className="text-sm text-white/50 mt-1">{period}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5 text-white/70" />
              </button>
            </div>

            {/* Grid 2 colunas */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4">
                {limitedAlbums.map((album, index) => (
                  <div key={`${album.id || album.name}-${index}`} className="flex flex-col">
                    {/* Imagem */}
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/5">
                      <SmartImage
                        src={album.image || ''}
                        className="w-full h-full object-cover"
                        fallback="💿"
                        rounded="xl"
                      />
                    </div>

                    {/* Informações */}
                    <div className="mt-2 space-y-0.5">
                      <p className="text-white/60 text-xs font-bold">#{index + 1}</p>
                      <p className="text-white font-bold text-sm truncate">{album.name}</p>
                      <p className="text-white/50 text-xs truncate">{album.artist}</p>
                      <p className="text-white/40 text-xs">{album.streams.toLocaleString('pt-BR')} streams</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
