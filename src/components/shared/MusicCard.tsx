/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Disc } from 'lucide-react';
import { coreUtils } from '../../services/statsCore';
import { useStatsStore } from '../../store/useStatsStore';
import { SmartImage, MarqueeText, MusicPlatformBadge } from './CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface MusicCardProps {
  userId: string;
  userName: string;
  songName: string;
  artistName: string;
  track?: any;
  imageUrl?: string;
  isNowPlaying?: boolean;
  isFirstPlay?: boolean;
  playCount?: number;
  className?: string;
  footer?: string | React.ReactNode;
  onClick?: () => void;
  progressMs?: number;
  durationMs?: number;
}

export const MusicCard = React.memo(({ 
  userId,
  userName, 
  songName, 
  artistName, 
  track,
  imageUrl, 
  isNowPlaying, 
  isFirstPlay,
  playCount,
  className,
  footer,
  onClick,
  progressMs,
  durationMs
}: MusicCardProps) => {
  const animationDuration = useStatsStore(state => state.animationDuration) || 0.4;
  const animationDelay = useStatsStore(state => state.animationDelay) || 0.04;
  const isLeo = userId === "leo";
  const accentColor = isLeo ? "#FF9F0A" : "#FFFFFF";
  const trackImage = coreUtils.getAvatarUrl(userId, imageUrl);
  const userAvatar = coreUtils.getUserAvatar(userId);

  const availability = track ? coreUtils.detectCatalogAvailability(track) : { hasSpotify: false, hasAppleMusic: false, primary: "unknown" };
  const spotifyLink = track?.spotifyId ? `https://open.spotify.com/track/${track.spotifyId}` : null;
  const appleLink = track?.appleMusicId ? `https://music.apple.com/song/${track.appleMusicId}` : null;
  const playUrl = spotifyLink || appleLink || (availability.hasSpotify ? `https://open.spotify.com/track/${track?.id}` : (availability.hasAppleMusic ? `https://music.apple.com/song/${track?.id}` : null));

  const [selectedAlbumForModal, setSelectedAlbumForModal] = useState<any | null>(null);
  const [AlbumDetailModalComp, setAlbumDetailModalComp] = useState<any | null>(null);

  const handleAlbumClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Lazy load to avoid circular dependency and improve performance
      const { AlbumDetailModal } = await import('../modals/AlbumDetailModal');
      setAlbumDetailModalComp(() => AlbumDetailModal);
      setSelectedAlbumForModal(track?.album || { 
        name: track?.albumName || 'Álbum', 
        id: track?.albumId,
        image: track?.image || imageUrl,
        artistName: artistName
      });
    } catch (err) {
      console.error("Failed to lazy load AlbumDetailModal", err);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.94 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "20px" }}
        transition={{ duration: animationDuration, ease: [0.16, 1, 0.3, 1], delay: animationDelay }}
        whileHover={onClick ? { 
          scale: 1.02, 
          y: -4, 
          backgroundColor: "rgba(255, 255, 255, 0.08)",
          boxShadow: isNowPlaying ? `0 25px 50px -12px rgba(0,0,0,0.6), 0 0 25px ${accentColor}20` : "0 25px 50px -12px rgba(0,0,0,0.6)"
        } : {}}
        whileTap={onClick ? { scale: 0.96, y: 0 } : {}}
        onClick={onClick}
        className={cn(
          "glass group relative flex items-center gap-4 rounded-[24px] p-4 transition-all duration-500",
          onClick && "cursor-pointer",
          isFirstPlay && "border-orange-500/20 bg-orange-500/[0.03] shadow-[0_0_15px_rgba(249,115,22,0.08)]",
          className
        )}
        style={{ 
          boxShadow: isNowPlaying ? `0 0 20px ${accentColor}10` : undefined,
          borderColor: isNowPlaying ? `${accentColor}30` : undefined
        }}
      >
        {/* Decorative Gradient for first listens */}
        {isFirstPlay && (
          <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
            <div className={cn(
              "absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-20",
              "bg-gradient-to-br from-orange-500/10 via-transparent to-transparent"
            )} />
          </div>
        )}

        <div className="relative h-14 w-14 shrink-0">
          <div className="h-full w-full rounded-[14px] bg-white/5 overflow-hidden relative">
            <SmartImage 
              src={trackImage} 
              className="h-full w-full" 
              fallback=""
              rounded="[14px]"
            />
            {isNowPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                 <div className="flex items-end gap-[1.5px] h-2.5">
                    {[0,1,2].map(i => (
                      <motion.div key={i} animate={{ height: ["20%", "100%", "40%"] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} className="w-[1.5px] bg-white rounded-full" />
                    ))}
                 </div>
              </div>
            )}
          </div>
          
          {/* User Badge Overlay */}
          <div className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-[#111] bg-black overflow-hidden shadow-lg shadow-black/80 z-20">
            <SmartImage
              src={userAvatar}
              className="h-full w-full object-cover"
              rounded="full"
              fallback={userName || userId || ""}
            />
          </div>
          
          {/* Play Count Badge Overlay */}
          {playCount !== undefined && playCount > 1 && !isNowPlaying && (
            <div className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-600 border border-[#111] flex items-center justify-center shadow-lg z-20">
              <span className="text-[8px] font-black text-white leading-none">{coreUtils.formatNumber(playCount)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">{userName}</span>
              {isFirstPlay && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/30 to-orange-600/30 px-2.5 py-0.5 rounded-full border border-orange-500/40">
                  <span className="text-[7.5px] font-black text-white uppercase tracking-widest">Inédito</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {userId && <MusicPlatformBadge userId={userId} className="p-0 border-none bg-transparent h-2.5 w-2.5 opacity-50 shrink-0" />}
              {footer && <span className="text-[8px] font-bold text-white/60 uppercase tracking-tighter whitespace-nowrap">{footer}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full justify-between min-w-0">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <MarqueeText 
                  text={songName || ""} 
                  className="font-display text-sm font-semibold text-white group-hover:text-orange-500 transition-colors"
                />
              </div>
              {availability.hasAppleMusic && (
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" 
                  className="h-3 w-3 invert opacity-60 shrink-0 mb-0.5" 
                  alt="Apple Music" 
                />
              )}
            </div>
          </div>

          <MarqueeText 
            text={artistName || ""} 
            className="text-[10px] font-medium text-white/70"
          />

          {(track?.album?.name || track?.albumName) && (
            <div 
              onClick={handleAlbumClick}
              className="text-[9px] font-bold text-orange-400 hover:text-orange-300 hover:underline cursor-pointer truncate max-w-[180px] mt-0.5 flex flex-row items-center gap-1 w-fit relative z-30"
              title="Ver detalhes do álbum"
            >
              <Disc className="h-2.5 w-2.5 text-orange-500 shrink-0" />
              <span className="truncate">{track?.album?.name || track?.albumName}</span>
            </div>
          )}
          
          {isNowPlaying && progressMs !== undefined && durationMs !== undefined && durationMs > 0 && (
            <div className="mt-2 flex flex-col gap-1 w-full max-w-[200px]">
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                 <motion.div 
                   className="h-full bg-orange-500 rounded-full"
                   initial={false}
                   animate={{ width: `${Math.min(100, (progressMs / durationMs) * 100)}%` }}
                   transition={{ type: "spring", stiffness: 300, damping: 30 }}
                 />
              </div>
              <div className="flex justify-between items-center text-[7px] font-mono text-white/30 tabular-nums">
                 <span>{coreUtils.formatDurationSmart(progressMs)}</span>
                 <span>{coreUtils.formatDurationSmart(durationMs)}</span>
              </div>
            </div>
          )}
        </div>

        {playUrl && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              window.open(playUrl, '_blank', 'noopener,noreferrer');
            }}
            whileHover={{ scale: 1.12, backgroundColor: "#ea580c" }}
            whileTap={{ scale: 0.9 }}
            className="h-9 w-9 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer shrink-0 ml-1 z-30 border border-white/10 hover:border-white/20 self-center"
            title="Ouvir no serviço de streaming"
          >
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          </motion.button>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedAlbumForModal && AlbumDetailModalComp && (
          <AlbumDetailModalComp
            user={{ id: userId, name: userName }}
            album={selectedAlbumForModal}
            onClose={() => setSelectedAlbumForModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}, (prev, next) => (
  prev.userId === next.userId &&
  prev.songName === next.songName &&
  prev.isNowPlaying === next.isNowPlaying &&
  prev.isFirstPlay === next.isFirstPlay &&
  prev.footer === next.footer &&
  prev.imageUrl === next.imageUrl &&
  prev.progressMs === next.progressMs &&
  prev.durationMs === next.durationMs &&
  prev.playCount === next.playCount
));

MusicCard.displayName = 'MusicCard';
