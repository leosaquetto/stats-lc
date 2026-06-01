
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Medal, Music2, Headphones, History } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { statsCacheService } from '../../services/statsCacheService';
import { statsService } from '../../services/statsService';
import { coreUtils } from '../../services/statsCore';
import { SmartImage, MusicPlatformBadge, Skeleton } from '../shared/CommonUI';
import { getMainArtist, getMainArtistName, getSecondaryArtists } from '../../lib/artistUtils';
import { getVisibleMembers } from '../../lib/memberSelectors';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

type TrackLeaderboardStats = Record<string, { track: number, album: number, artist: number }>;

const TRACK_LEADERBOARD_CACHE_TTL = 15 * 60 * 1000;
const trackLeaderboardStatsCache = new Map<string, { expiresAt: number; data: TrackLeaderboardStats }>();
const trackLeaderboardStatsInFlight = new Map<string, Promise<TrackLeaderboardStats>>();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getTrackLeaderboardIds = (track: any, selectedArtist?: any) => {
  const chosenArtist = selectedArtist || getMainArtist(track);
  const artistId = chosenArtist?.id || track?.artistId || track?.artist?.id || (Array.isArray(track?.artists) && track.artists[0]?.id) || (track?.type === 'artist' ? track?.id : null);
  const albumId = track?.albumId || track?.album?.id || (Array.isArray(track?.albums) && track.albums[0]?.id) || (track?.type === 'album' ? track?.id : null);
  const trackId = track?.type === 'track' ? track?.id : (track?.type === 'artist' || track?.type === 'album' ? null : (track?.artists || track?.name ? track?.id : null));

  return {
    trackId: trackId ? String(trackId) : '',
    albumId: albumId ? String(albumId) : '',
    artistId: artistId ? String(artistId) : '',
  };
};

const getTrackLeaderboardCacheKey = (track: any, selectedArtist: any, members: any[]) => {
  const ids = getTrackLeaderboardIds(track, selectedArtist);
  const membersKey = members.map((member) => member?.id).filter(Boolean).sort().join('|');
  return `${ids.trackId}:${ids.albumId}:${ids.artistId}:${membersKey}`;
};

const readTrackLeaderboardCache = (cacheKey: string) => {
  const cached = trackLeaderboardStatsCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.data;
};

const loadTrackLeaderboardStats = async (track: any, members: any[], selectedArtist?: any): Promise<TrackLeaderboardStats> => {
  if (!track?.id || members.length === 0) return {};

  const cacheKey = getTrackLeaderboardCacheKey(track, selectedArtist, members);
  const cached = readTrackLeaderboardCache(cacheKey);
  if (cached) return cached;

  const running = trackLeaderboardStatsInFlight.get(cacheKey);
  if (running) return running;

  const promise = (async () => {
    const { trackId, albumId, artistId } = getTrackLeaderboardIds(track, selectedArtist);
    if ((import.meta as any).env?.DEV) console.log("[TrackLeaderboardModal] IDs identificados:", { trackId, artistId, albumId });

    const [trackStats, albumStats, artistStats] = await Promise.all([
      trackId ? statsService.fetchEntityGroupStats('track', trackId).catch(async () => {
        const fallback: Record<string, number> = {};
        await Promise.all(members.map(async u => {
          fallback[u.id] = await statsCacheService.fetchEntityStats(u.id, 'track', trackId).catch(() => 0);
        }));
        return fallback;
      }) : Promise.resolve({} as Record<string, number>),

      albumId ? statsService.fetchEntityGroupStats('album', albumId).catch(async () => {
        const fallback: Record<string, number> = {};
        await Promise.all(members.map(async u => {
          fallback[u.id] = await statsCacheService.fetchEntityStats(u.id, 'album', albumId).catch(() => 0);
        }));
        return fallback;
      }) : Promise.resolve({} as Record<string, number>),

      artistId ? statsService.fetchEntityGroupStats('artist', artistId).catch(async () => {
        const fallback: Record<string, number> = {};
        await Promise.all(members.map(async u => {
          fallback[u.id] = await statsCacheService.fetchEntityStats(u.id, 'artist', artistId).catch(() => 0);
        }));
        return fallback;
      }) : Promise.resolve({} as Record<string, number>)
    ]);

    const results: TrackLeaderboardStats = {};
    members.forEach((u) => {
      results[u.id] = {
        track: trackStats[u.id] || 0,
        album: albumStats[u.id] || 0,
        artist: artistStats[u.id] || 0
      };
    });

    trackLeaderboardStatsCache.set(cacheKey, {
      data: results,
      expiresAt: Date.now() + TRACK_LEADERBOARD_CACHE_TTL,
    });
    return results;
  })().finally(() => {
    trackLeaderboardStatsInFlight.delete(cacheKey);
  });

  trackLeaderboardStatsInFlight.set(cacheKey, promise);
  return promise;
};

export const preloadTrackLeaderboardStats = (track: any, members: any[]) => {
  return loadTrackLeaderboardStats(track, members).catch(() => ({}));
};

export const TrackLeaderboardModal = ({ 
  track, 
  onClose,
  onArtistClick
}: { 
  track: any, 
  onClose: () => void,
  onArtistClick?: (artist: any) => void
}) => {
  const [stats, setStats] = useState<TrackLeaderboardStats>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'track' | 'album' | 'artist'>('track');
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const members = React.useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);
  const membersSignature = React.useMemo(() => members.map((member) => member.id).filter(Boolean).sort().join('|'), [members]);

  useEffect(() => {
    async function loadStats() {
      if (!track?.id) return;

      // Honour explicit type first (vinil/arena badge always pass type:'track',
      // StatsScreen passes 'artist'/'album' when appropriate)
      if (track.type === 'artist' || track.type === 'album' || track.type === 'track') {
        setView(track.type);
      } else {
        const isArtist = !!track.artist || (track.id && !track.name && !track.albumId);
        const isAlbum  = !!track.album  || (track.albumId && !track.name);
        if (isArtist) setView('artist');
        else if (isAlbum) setView('album');
        else setView('track');
      }


      const cacheKey = getTrackLeaderboardCacheKey(track, selectedArtist, members);
      const cached = readTrackLeaderboardCache(cacheKey);
      if (cached) {
        setStats(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      const results = await loadTrackLeaderboardStats(track, members, selectedArtist);

      setStats(results);
      setLoading(false);
    }
    loadStats();
  }, [track?.id, track?.albumId, track?.artistId, track?.type, selectedArtist?.id, selectedArtist?.name, membersSignature]);

  const sortedUsers = members
    .map(u => {
      return { 
        ...u, 
        data: stats[u.id] || { track: 0, album: 0, artist: 0 } 
      };
    })
    .filter(u => u.data[view] > 0)
    .sort((a, b) => b.data[view] - a.data[view]);

  const mainArtist = getMainArtist(track);
  // When the track IS an artist entity, use track.name as the artist name
  const mainArtistName = (track.type === 'artist' && track.name)
    ? track.name
    : getMainArtistName(track);
  const secondaryArtists = getSecondaryArtists(track);
  const artistOptions = [
    mainArtist ? {
      ...mainArtist,
      name: mainArtistName,
      image: mainArtist?.image || track.artist?.image || track.image
    } : null,
    ...secondaryArtists
  ].filter(Boolean);
  const activeArtist = selectedArtist || artistOptions[0] || mainArtist;
  const activeArtistName = activeArtist?.name || activeArtist?.artistName || mainArtistName;
  const activeArtistImage = activeArtist?.image || activeArtist?.avatar || track.artist?.image || track.artists?.find?.((artist: any) => artist?.id && artist.id === activeArtist?.id)?.image || track.image;
  const albumArtistName = (() => {
    const candidate =
      track.albumArtist ||
      track.albumArtistName ||
      track.artistName ||
      track.primaryArtistName ||
      track.album?.artist ||
      track.album?.artistName ||
      mainArtistName;
    return typeof candidate === 'string' ? candidate : (candidate?.name || candidate?.artistName || mainArtistName);
  })();
  // When the track IS an album entity, use track.name as the album name
  const albumName = (track.type === 'album' && track.name)
    ? track.name
    : (track.albumName || track.album?.name || (Array.isArray(track.albums) ? track.albums[0]?.name : null));

  // Auto-detect view type (only used as fallback when track.type is not set):
  const isArtist = track.type === 'artist' ||
                   (!track.type && !track.name && !track.albumId && track.id && track.artist?.id === track.id);
  const isAlbum  = track.type === 'album'  ||
                   (!track.type && track.albumId && !track.artistId) ||
                   (!track.type && !track.name && track.album?.id === track.id);

  useEffect(() => {
    if (track.type === 'artist' || track.type === 'album' || track.type === 'track') {
      setView(track.type);
      if (track.type !== 'artist') setSelectedArtist(null);
    } else if (isArtist) {
      setView('artist');
    } else if (isAlbum) {
      setView('album');
    } else {
      setView('track');
    }
  }, [track?.id, track?.type, isArtist, isAlbum]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center liquid-glass-overlay p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="glass premium-gradient w-full max-w-sm max-h-[85vh] rounded-[38px] border-white/15 bg-black/45 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.9)] backdrop-blur-3xl flex flex-col overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
        <div 
          className="absolute top-0 left-0 w-full h-40 opacity-25 blur-[78px] pointer-events-none"
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
                      view === 'artist' ? activeArtistImage :
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
                   {view === 'artist' ? activeArtistName : (view === 'album' ? albumName : track.name)}
                 </h2>

                 {view === 'track' && (
                   <div className="flex flex-col items-center gap-3 mt-4 px-4">
                     <div className="flex items-center gap-1.5 flex-wrap justify-center">
                       <button 
                         onClick={() => {
                           setSelectedArtist(artistOptions[0]);
                           setView('artist');
                           onArtistClick?.(artistOptions[0] || mainArtist);
                         }}
                         className="text-[10px] font-bold text-orange-400 hover:text-orange-300 cursor-pointer transition-colors"
                       >
                         {mainArtistName}
                       </button>
                       
                       {secondaryArtists.length > 0 && (
                         <>
                           <span className="text-white/20 text-[8px] mx-1">feat.</span>
                           {secondaryArtists.map((artist: any, idx: number) => (
                             <React.Fragment key={artist.id || idx}>
                               <button 
                                 onClick={() => {
                                   setSelectedArtist(artist);
                                   setView('artist');
                                   onArtistClick?.(artist);
                                 }}
                                 className="text-[9px] font-medium text-white/50 hover:text-white/70 cursor-pointer transition-colors"
                               >
                                 {typeof artist === 'string' ? artist : artist.name}
                               </button>
                               {idx < secondaryArtists.length - 1 && (
                                 <span className="text-white/10">,</span>
                               )}
                             </React.Fragment>
                           ))}
                         </>
                       )}
                     </div>
                     
                     {albumName && (
                       <span className="text-[9px] font-semibold text-white/30">
                         {albumName}
                       </span>
                     )}
                   </div>
                 )}

                 {view === 'album' && (
                   <div className="flex flex-col items-center gap-1 mt-2 px-4">
                     <span className="text-[10px] font-medium text-white/60">
                       {albumArtistName || getMainArtistName(track)}
                     </span>
                     {track.releaseDate && (
                       <span className="text-[8px] text-white/40">
                         {new Date(track.releaseDate).getFullYear()}
                       </span>
                     )}
                   </div>
                 )}
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
            {view === 'artist' && artistOptions.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {artistOptions.map((artist: any, idx: number) => {
                  const selected = (activeArtist?.id && artist?.id && activeArtist.id === artist.id) || activeArtistName === artist?.name;
                  return (
                    <button
                      key={artist?.id || artist?.name || idx}
                      onClick={() => {
                        setSelectedArtist(artist);
                        setView('artist');
                      }}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] transition-all",
                        selected
                          ? "border-orange-500/50 bg-orange-500/15 text-orange-300"
                          : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70"
                      )}
                    >
                      {artist?.name || artist?.artistName || 'Artista'}
                    </button>
                  );
                })}
              </div>
            )}
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
                [1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" rounded="2xl" />)
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
                      <motion.div 
                        key={user.id} 
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
                                   initialSearch: view === 'track' ? track.name : view === 'artist' ? activeArtistName : albumName
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
                      </motion.div>
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

        <div className="p-6 pt-2 pb-8 bg-gradient-to-t from-black/75 via-black/55 to-transparent shrink-0">
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
