import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { statsCacheService } from '../../services/statsCacheService';
import { statsService } from '../../services/statsService';
import { SmartImage } from '../shared/CommonUI';
import { getArtistListString } from '../../lib/artistUtils';
import { coreUtils } from '../../services/statsCore';
import { TrendingUp } from 'lucide-react';

interface AlbumDetailModalProps {
  user: any;
  album: any;
  onClose: () => void;
  onTrackClick?: (track: any) => void;
}

export const AlbumDetailModal = memo(({
  user,
  album,
  onClose,
  onTrackClick
}: AlbumDetailModalProps) => {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArenaView, setShowArenaView] = useState(false);
  const [arenaStats, setArenaStats] = useState<Record<string, any>>({});
  const [globalStats, setGlobalStats] = useState<Record<string, { totalPlays: number; listenersCount: number; topListeners: any[] }>>({});

  useEffect(() => {
    let mounted = true;

    const loadTracks = async () => {
      setLoading(true);
      try {
        const full = await statsService.getUserFullStats(user.id);
        
        const allTracks = (full.tops?.tracks || []).map((t: any) => {
          const trackObj = t.track || t;
          return {
            id: trackObj.id || t.id,
            name: trackObj.name || t.name,
            image: trackObj.image || t.image || trackObj.album?.image,
            playCount: t.playcount || t.streams || 0,
            artists: trackObj.artists || t.artists || [],
            albumId: trackObj.album?.id || trackObj.albumId || t.albumId || t.album?.id,
            albumName: trackObj.albumName || trackObj.album?.name || t.albumName
          };
        });

        const albumId = album.id || album.album?.id;
        const albumName = album.name || album.album?.name;
        
        const albumTracks = allTracks.filter((t: any) => 
          (albumId && t.albumId === albumId) || 
          (albumName && t.albumName === albumName) ||
          (t.albumName && albumName && t.albumName.toLowerCase().includes(albumName.toLowerCase())) ||
          (t.name && albumName && t.name.toLowerCase().includes(albumName.toLowerCase()))
        ).sort((a: any, b: any) => b.playCount - a.playCount);

        if (mounted) setTracks(albumTracks);

        // Fetch global stats via getTrackGlobalHistory for each track
        const stats: Record<string, any> = {};
        await Promise.all(
          albumTracks.map(async (track: any) => {
            const trackId = track.id;
            if (trackId) {
              try {
                const history = await statsCacheService.getTrackGlobalHistory(trackId);
                const totalPlays = history.length;
                const usersMap: Record<string, { count: number; name: string; avatar: string; id: string }> = {};
                history.forEach((h: any) => {
                  const uid = h.userId || h.user?.id;
                  const uname = h.user?.name || 'Membro';
                  const uavatar = h.user?.avatar || '';
                  if (uid) {
                    if (!usersMap[uid]) {
                      usersMap[uid] = { count: 0, name: uname, avatar: uavatar, id: uid };
                    }
                    usersMap[uid].count += 1;
                  }
                });
                const topListeners = Object.values(usersMap)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3);
                stats[track.id] = { totalPlays, listenersCount: Object.keys(usersMap).length, topListeners };
              } catch (err) {
                console.error("Error loading track history for " + trackId, err);
              }
            }
          })
        );
        if (mounted) setGlobalStats(stats);

        if (showArenaView && albumTracks.length > 0) {
          const statsArena: Record<string, any> = {};
          const results = await Promise.allSettled(
            albumTracks.map(track =>
              statsCacheService.fetchEntityStats(user.id, 'track', track.id)
            )
          );
          
          results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
              statsArena[albumTracks[idx].id] = result.value;
            }
          });
          
          if (mounted) setArenaStats(statsArena);
        }
      } catch (e) {
        console.error("Failed to load album tracks", e);
        if (mounted) setTracks([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadTracks();
    return () => { mounted = false; };
  }, [user.id, album.id, showArenaView]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white/[0.06] rounded-2xl border border-white/10 p-6 backdrop-blur-md"
    >
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
        <div>
          <h2 className="text-[14px] font-display font-black text-white">
            {album.name}
          </h2>
          <p className="text-[9px] text-white/40 mt-1">
            {tracks.length} faixas
          </p>
        </div>
        
        {tracks.length > 0 && (
          <button
            onClick={() => setShowArenaView(!showArenaView)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all",
              showArenaView
                ? "bg-orange-500 text-white"
                : "bg-white/10 text-white/50 hover:bg-white/15"
            )}
          >
            {showArenaView ? "🏆 Arena" : "Listar"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8">
            <span className="text-[10px] font-medium text-white/40">Carregando faixas...</span>
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-[10px] font-medium text-white/40">
              Nenhuma faixa reproduzida deste álbum
            </span>
          </div>
        ) : (
          tracks.map((track, idx) => (
            <motion.div
              key={`${track.id}-${idx}`}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(idx * 0.05, 0.3) }}
              onClick={() => onTrackClick?.(track)}
              className="flex flex-col gap-2 p-3.5 rounded-2xl hover:bg-white/[0.04] bg-white/[0.02] border border-white/5 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-white/30 w-6">
                  #{idx + 1}
                </span>

                <SmartImage
                  src={track.image}
                  className="h-10 w-10 rounded-lg shrink-0"
                  fallback=""
                  rounded="lg"
                />

                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-white/90 truncate group-hover:text-orange-400">
                    {track.name}
                  </span>
                  <span className="text-[8px] font-medium text-white/50 truncate">
                    {getArtistListString({ artists: track.artists })}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] font-bold text-white/60">
                    {track.playCount}x
                  </span>
                  
                  {showArenaView && arenaStats[track.id] && (
                    <div className="flex items-center gap-1">
                      {/* TODO: Arena ranking inline */}
                    </div>
                  )}
                </div>
              </div>

              {/* Global stream leaderboard loaded via getTrackGlobalHistory */}
              {globalStats[track.id] && (
                <div className="mt-1 border-t border-white/5 pt-2 pl-9 flex flex-col gap-1.5 text-left">
                  <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-[#FF9F0A]/90">
                    <span>🏆 TOP GLOBAL DE STREAMS:</span>
                    <span className="text-white/40">{globalStats[track.id].totalPlays} streams globais • {globalStats[track.id].listenersCount} ouvintes</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {globalStats[track.id].topListeners.map((listener: any, lIdx: number) => (
                      <div key={`${listener.id}-${lIdx}`} className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full shadow-inner">
                        <span className="text-[8px] font-black text-orange-400">#{lIdx + 1}</span>
                        <img 
                          src={coreUtils.getUserAvatar(listener.id, listener.avatar)} 
                          className="h-4 w-4 rounded-full object-cover border border-white/10" 
                          referrerPolicy="no-referrer"
                          alt="" 
                        />
                        <span className="text-[9px] font-bold text-white/85 truncate max-w-[70px]">{listener.name}</span>
                        <span className="text-[9px] font-mono font-black text-orange-500">{listener.count}x</span>
                      </div>
                    ))}
                    {globalStats[track.id].topListeners.length === 0 && (
                      <span className="text-[8.5px] text-white/35 italic">Sem reproduções globais gravadas</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      <button
        onClick={onClose}
        className="mt-4 w-full text-center text-[9px] font-medium text-white/40 hover:text-white/60 transition-colors py-2 border-t border-white/5"
      >
        Fechar
      </button>
    </motion.div>
  );
});

AlbumDetailModal.displayName = 'AlbumDetailModal';
