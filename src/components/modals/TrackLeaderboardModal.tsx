import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Medal, Music2, Headphones, History } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { statsService } from '../../services/statsService';
import { coreUtils } from '../../services/statsCore';
import { SmartImage, MusicPlatformBadge } from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const entityCache: Record<string, { data: number, timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000;

async function fetchWithCache(userId: string, type: 'track' | 'artist' | 'album', id: string) {
  if (!id) return 0;
  const key = `${userId}-${type}-${id}`;
  const cached = entityCache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const result = await statsService.fetchEntityStats(userId, type, id);
  entityCache[key] = { data: result, timestamp: Date.now() };
  return result;
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const TrackLeaderboardModal = ({ 
  track, 
  onClose 
}: { 
  track: any, 
  onClose: () => void 
}) => {
  const [stats, setStats] = useState<Record<string, { track: number, album: number, artist: number }>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'track' | 'album' | 'artist'>('track');

  useEffect(() => {
    async function loadStats() {
      if (!track?.id) return;
      setLoading(true);
      
      const isArtist = !!track.artist || track.type === 'artist' || (track.id && !track.name && !track.albumId);
      const isAlbum = !!track.album || track.type === 'album' || (track.albumId && !track.name);
      
      if (isArtist) setView('artist');
      else if (isAlbum) setView('album');
      else setView('track');


      // Identificação ultra-robusta dos IDs
      const artistId = track.artistId || track.artist?.id || (Array.isArray(track.artists) && track.artists[0]?.id) || (track.type === 'artist' ? track.id : null);
      const albumId = track.albumId || track.album?.id || (Array.isArray(track.albums) && track.albums[0]?.id) || (track.type === 'album' ? track.id : null);
      const trackId = track.type === 'track' ? track.id : (track.artists || track.name ? track.id : null);
      
      if ((import.meta as any).env?.DEV) console.log("[TrackLeaderboardModal] IDs identificados:", { trackId, artistId, albumId });

      const users = Object.values(useStatsStore.getState().groupStats?.users || {});
      const results: Record<string, { track: number, album: number, artist: number }> = {};
      
      // Processa sequencialmente ou com menos concorrência para evitar rate limit
      for (const u of users) {
        try {
          const [tCount, alCount, arCount] = await Promise.all([
            trackId ? fetchWithCache(u.id, 'track', trackId) : Promise.resolve(0),
            albumId ? fetchWithCache(u.id, 'album', albumId) : Promise.resolve(0),
            artistId ? fetchWithCache(u.id, 'artist', artistId) : Promise.resolve(0)
          ]);
          results[u.id] = { track: tCount, album: alCount, artist: arCount };
        } catch (e) {
          results[u.id] = { track: 0, album: 0, artist: 0 };
        }
      }

      setStats(results);
      setLoading(false);
    }
    loadStats();
  }, [track?.id, track?.albumId, track?.artistId]);

  const { groupStats, featuredUserId } = useStatsStore();
  const membersData = groupStats?.users || {};

  const sortedUsers = Object.values(membersData)
    .map(u => {
      return { 
        ...u, 
        data: stats[u.id] || { track: 0, album: 0, artist: 0 } 
      };
    })
    .filter(u => u.data[view] > 0)
    .sort((a, b) => b.data[view] - a.data[view]);

  const artist = Array.isArray(track.artists) ? track.artists[0] : track.artist;
  const artistName = typeof artist === 'string' ? artist : artist?.name || track.artistName;
  const albumName = track.albumName || track.album?.name || (Array.isArray(track.albums) ? track.albums[0]?.name : null);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-[#0c0c0c] w-full max-w-sm max-h-[85vh] rounded-[48px] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        <div 
          className="absolute top-0 left-0 w-full h-40 opacity-20 blur-[80px] pointer-events-none"
          style={{ backgroundColor: "#FF9F0A" }}
        />

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-50 h-10 w-10 glass rounded-2xl flex items-center justify-center text-white/40 hover:text-white/90 active:scale-90 transition-all border border-white/5"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pt-8 px-6 pb-4 flex flex-col items-center text-center shrink-0 border-b border-white/5 relative z-10">
           <div className="relative group">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <SmartImage 
                    src={
                      view === 'artist' ? (track.artists?.[0]?.image || track.artist?.image || track.image) :
                      view === 'album' ? (track.albumImage || track.album?.image || track.albums?.[0]?.image || track.image) :
                      track.image
                    } 
                    className="h-24 w-24 shadow-[0_12px_32px_rgba(0,0,0,0.6)] border border-white/10" 
                    rounded="2xl"
                    fallback=""
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute -bottom-2 -right-2 z-20">
                <MusicPlatformBadge platform={coreUtils.detectCatalogAvailability(track).hasSpotify ? 'spotify' : 'apple'} />
              </div>
           </div>
           
           <div className="mt-4 w-full px-2 min-h-[60px] flex flex-col items-center justify-center">
             <AnimatePresence mode="wait">
               <motion.div
                 key={view}
                 initial={{ opacity: 0, y: 5 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -5 }}
                 transition={{ duration: 0.2 }}
                 className="w-full"
               >
                 <h2 className="text-lg font-display font-black text-white leading-tight truncate px-4">
                   {view === 'artist' ? artistName : (view === 'album' ? albumName : (track.name || track.artist?.name || track.album?.name))}
                 </h2>
                 <div className="flex items-center justify-center gap-2 mt-1 px-4">
                   {view === 'track' && (
                     <>
                       {artistName && (
                         <span className="text-[10px] font-bold text-white/40 truncate max-w-[120px]">{artistName}</span>
                       )}
                       {albumName && (
                         <span className="text-[10px] font-bold text-white/20 truncate max-w-[120px]">
                           <span className="mx-1 text-white/10">|</span>
                           {albumName}
                         </span>
                       )}
                     </>
                   )}
                 </div>
               </motion.div>
             </AnimatePresence>
           </div>
           
           <div className="flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full bg-white/5 border border-white/5">
             <Trophy className="h-2.5 w-2.5 text-orange-500" />
             <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em]">Arena Rankings</span>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex bg-white/[0.03] p-1 rounded-2xl border border-white/5 shrink-0">
               {[
                 { id: 'track', label: 'Faixa' },
                 { id: 'artist', label: 'Artista' },
                 { id: 'album', label: 'Álbum' }
               ].map((tab) => (
                 <button
                   key={tab.id}
                   onClick={() => setView(tab.id as any)}
                   className={cn(
                     "flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                     view === tab.id ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-white/30 hover:text-white/50"
                   )}
                 >
                   {tab.label}
                 </button>
               ))}
            </div>

            <div className="flex flex-col gap-2">
              {loading ? (
                [1,2,3,4].map(i => <div key={i} className="h-14 w-full bg-white/5 rounded-2xl animate-pulse" />)
              ) : (
                <>
                  {sortedUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                      <Music2 className="h-8 w-8 mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-center">Nenhum competidor nesta categoria</p>
                    </div>
                  ) : sortedUsers.map((user, i) => {
                    const isLeo = user.id === "leo";
                    const isFeatured = user.id === featuredUserId;
                    const isWinner = i === 0;
                    
                    return (
                      <div 
                        key={user.id} 
                        className={cn(
                          "flex items-center justify-between p-3.5 rounded-[22px] border transition-all",
                          isWinner ? "bg-orange-500/10 border-orange-500/20 shadow-[0_8px_16px_rgba(255,159,10,0.05)]" : "bg-white/[0.02] border-white/5",
                          isLeo && !isWinner && "border-white/20 bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                           <div className="h-5 w-5 flex items-center justify-center shrink-0">
                             {i === 0 ? <Medal className="h-4 w-4 text-yellow-500" /> : 
                              i === 1 ? <Medal className="h-4 w-4 text-slate-400" /> :
                              i === 2 ? <Medal className="h-4 w-4 text-orange-700" /> :
                              <span className="text-[10px] font-black text-white/20 italic">#{i + 1}</span>}
                           </div>
                           <div className="relative">
                             <SmartImage 
                               src={coreUtils.getUserAvatar(user.id, (user as any).avatar)} 
                               className={cn("h-8 w-8 rounded-full border", isWinner ? "border-orange-500/40" : "border-white/10")} 
                               rounded="full"
                             />
                             {isFeatured && (
                               <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-blue-500 flex items-center justify-center border-2 border-[#0c0c0c] shadow-lg">
                                  <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                               </div>
                             )}
                           </div>
                           <div className="flex flex-col">
                             <div className="flex items-center gap-1.5">
                               <span className={cn("text-[12px] font-bold", isLeo ? "text-white" : "text-white/80")}>
                                 {user.name}
                               </span>
                             </div>
                             {isWinner && <span className="text-[8px] font-black text-orange-500/80 uppercase tracking-widest">Líder Arena</span>}
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               const event = new CustomEvent('openHistory', { 
                                 detail: { 
                                   id: user.id, 
                                   name: user.name, 
                                   avatar: user.avatar,
                                   initialSearch: view === 'track' ? track.name : view === 'artist' ? artistName : albumName 
                                 } 
                               });
                               window.dispatchEvent(event);
                             }}
                             className="text-white/20 hover:text-white/80 transition-colors active:scale-95"
                           >
                             <History className="h-3.5 w-3.5" />
                           </button>
                           <span className={cn(
                             "text-[15px] font-display font-black", 
                             isWinner ? "text-orange-500" : isLeo ? "text-white" : "text-white/60"
                           )}>
                              {coreUtils.formatNumber(user.data[view])}
                           </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div className="mt-2">
               <div className="flex items-center justify-between px-1 mb-3">
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Ouvir na Íntegra</span>
                  <Headphones className="h-3 w-3 text-white/10" />
               </div>
               <div className="flex items-center gap-2">
                 {(track.spotifyId || coreUtils.detectCatalogAvailability(track).hasSpotify) && (
                   <a 
                    href={`https://open.spotify.com/track/${track.spotifyId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-[#1DB954]/10 border border-white/5 hover:border-[#1DB954]/20 flex items-center justify-center gap-2 active:scale-95 transition-all no-underline shrink-0 group"
                   >
                     <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" alt="" />
                     <span className="text-[9px] font-black text-white/30 group-hover:text-[#1DB954] uppercase tracking-widest transition-colors">Spotify</span>
                   </a>
                 )}
                 {(track.appleMusicId || coreUtils.detectCatalogAvailability(track).hasAppleMusic) && (
                   <a 
                    href={`https://music.apple.com/song/${track.appleMusicId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-pink-500/10 border border-white/5 hover:border-pink-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all no-underline shrink-0 group"
                   >
                     <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" className="h-3.5 w-3.5 invert opacity-30 group-hover:opacity-100 transition-opacity" alt="" />
                     <span className="text-[9px] font-black text-white/30 group-hover:text-pink-500 uppercase tracking-widest transition-colors">Apple</span>
                   </a>
                 )}
               </div>
            </div>
        </div>

        <div className="p-6 pt-2 pb-8 bg-gradient-to-t from-[#0c0c0c] via-[#0c0c0c] to-transparent shrink-0">
          <button 
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 active:scale-95 transition-all hover:bg-white/10"
          >
            Sair da Arena
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
