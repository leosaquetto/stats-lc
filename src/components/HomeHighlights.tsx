import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { SectionHeader } from './MusicUI';
import { statsService } from '../services/statsService';

export function HomeHighlights({ userId, onItemClick }: { userId: string, onItemClick?: (item: any) => void }) {
  const [tops, setTops] = useState<{ tracks: any[], artists: any[], albums: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [tracks, artists, albums] = await Promise.all([
          statsService.getTopItems(userId, 'tracks', 'month'),
          statsService.getTopItems(userId, 'artists', 'month'),
          statsService.getTopItems(userId, 'albums', 'month')
        ]);
        setTops({ 
          tracks: tracks.slice(0, 20), 
          artists: artists.slice(0, 20), 
          albums: albums.slice(0, 20) 
        });
      } catch (e) {
        console.error("Failed to load highlights", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  if (loading) return <div className="h-40 bg-white/[0.02] rounded-3xl animate-pulse" />;
  if (!tops || (!tops.tracks.length && !tops.artists.length && !tops.albums.length)) return null;

  return (
    <div className="flex flex-col gap-6 pt-2 pb-2">
      <SectionHeader title="Destaques do Mês" action={<span className="text-[10px] text-white/40 font-bold uppercase">Top 20</span>} />
      
      <div className="flex flex-col gap-4">
        {/* Artistas */}
        {tops.artists.length > 0 && (
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">Artistas</span>
                <div className="h-[1px] flex-1 bg-white/5" />
             </div>
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 scroll-fade-h">
               {tops.artists.map((artist, idx) => (
                 <motion.div 
                   key={artist.id || idx} 
                   initial={{ opacity: 0, scale: 0.9 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true }}
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   className="flex flex-col items-center gap-2 shrink-0 w-[64px] cursor-pointer"
                   onClick={() => onItemClick?.(artist)}
                  >
                   <div className="relative h-[64px] w-[64px]">
                     <img src={artist.image || artist.artist?.image} alt={artist.name || artist.artist?.name} className="h-full w-full rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                     <div className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-md px-1 py-0.5 text-[7px] font-black border border-white/10">{idx + 1}</div>
                     <div className="absolute bottom-1 right-1 bg-orange-500/90 backdrop-blur-sm px-1 py-0.5 rounded text-[7px] font-black text-white">
                       {artist.playcount || artist.streams || 0}
                     </div>
                   </div>
                   <div className="text-center w-full">
                     <span className="text-[9px] font-bold text-white/80 line-clamp-1 leading-tight">{artist.name || artist.artist?.name}</span>
                   </div>
                 </motion.div>
               ))}
             </div>
          </div>
        )}

        {/* Faixas */}
        {tops.tracks.length > 0 && (
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">Faixas</span>
                <div className="h-[1px] flex-1 bg-white/5" />
             </div>
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 scroll-fade-h">
               {tops.tracks.map((track, idx) => (
                 <motion.div 
                   key={track.id || idx} 
                   initial={{ opacity: 0, scale: 0.9 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true }}
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   className="flex flex-col gap-1.5 shrink-0 w-[64px] cursor-pointer"
                   onClick={() => onItemClick?.(track)}
                  >
                   <div className="relative h-[64px] w-[64px]">
                     <img src={track.image || track.album?.image} alt={track.name} className="h-full w-full rounded-xl object-cover border border-white/10 shadow-lg shadow-black/40" referrerPolicy="no-referrer" />
                     <div className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-md px-1 py-0.5 text-[7px] font-black border border-white/10">{idx + 1}</div>
                     <div className="absolute bottom-1 right-1 bg-orange-500/90 backdrop-blur-sm px-1 py-0.5 rounded text-[7px] font-black text-white">
                        {track.playcount || track.streams || 0}
                     </div>
                   </div>
                   <div className="flex flex-col w-full">
                     <span className="text-[9px] font-bold text-white/90 truncate">{track.name}</span>
                   </div>
                 </motion.div>
               ))}
             </div>
          </div>
        )}

        {/* Álbuns */}
        {tops.albums.length > 0 && (
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">Álbuns</span>
                <div className="h-[1px] flex-1 bg-white/5" />
             </div>
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 scroll-fade-h">
               {tops.albums.map((album, idx) => (
                 <motion.div 
                   key={album.id || idx} 
                   initial={{ opacity: 0, scale: 0.9 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true }}
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   className="flex flex-col gap-1.5 shrink-0 w-[64px] cursor-pointer"
                   onClick={() => onItemClick?.(album)}
                  >
                   <div className="relative h-[64px] w-[64px]">
                     <img src={album.image || album.album?.image} alt={album.name || album.album?.name} className="h-full w-full rounded-xl object-cover border border-white/10 shadow-lg shadow-black/40" referrerPolicy="no-referrer" />
                     <div className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-md px-1 py-0.5 text-[7px] font-black border border-white/10">{idx + 1}</div>
                     <div className="absolute bottom-1 right-1 bg-orange-500/90 backdrop-blur-sm px-1 py-0.5 rounded text-[7px] font-black text-white">
                        {album.playcount || album.streams || 0}
                     </div>
                   </div>
                   <div className="flex flex-col w-full">
                     <span className="text-[9px] font-bold text-white/90 line-clamp-1 leading-tight">{album.name || album.album?.name}</span>
                   </div>
                 </motion.div>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
