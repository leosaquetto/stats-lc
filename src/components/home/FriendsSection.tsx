/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { coreUtils } from '../../services/statsCore';
import { 
  SmartImage, 
  MusicPlatformBadge, 
  TruncatedTooltipText,
  ShimmerOverlay 
} from '../shared/CommonUI';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useMotionRuntime } from '../../hooks/useMotionRuntime';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FriendsCardSkeleton = () => (
  <div className="flex flex-col items-center gap-3 w-full min-w-0">
    <div className="h-2 w-12 bg-white/10 rounded-full mb-1 opacity-20" />
    <div className="h-16 w-16 rounded-[22px] glass border-white/5 relative overflow-hidden bg-white/[0.02]">
       <ShimmerOverlay duration={3} />
       <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white/5 border-2 border-[#050505] shadow-inner" />
    </div>
    <div className="flex flex-col items-center w-full gap-1.5 mt-1 px-1 relative">
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="h-1.5 w-full max-w-[40px] bg-white/10 rounded-full opacity-30" />
      </div>
      <div className="flex flex-col items-center gap-1 w-full mt-1">
        <div className="h-2 w-full max-w-[50px] bg-white/20 rounded-full opacity-20" />
      </div>
    </div>
  </div>
);

export const FriendsHorizontalCard = React.memo(({ 
  userId,
  userName, 
  userAvatar: providedAvatar,
  songName, 
  artistName,
  imageUrl, 
  isNowPlaying: rawIsNowPlaying,
  timestamp,
  onClick,
  playCount
}: any) => {
  const playback = coreUtils.getPlaybackStatus({ nowPlaying: { isNow: rawIsNowPlaying, timestamp, track: { name: songName } } });
  const isActuallyLive = playback.status === "live";
  const motionRuntime = useMotionRuntime();
  const shouldRunAmbientMotion = motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve';
  
  const trackImage = coreUtils.getAvatarUrl(userId, imageUrl);
  const userAvatar = coreUtils.getUserAvatar(userId, providedAvatar);
  const firstName = (userName || "").split(' ')[0].toUpperCase();
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 group w-full min-w-0 transition-opacity duration-500",
        !isActuallyLive && "opacity-60",
        onClick && "cursor-pointer active:scale-95 text-center"
      )}
    >
      <span className={cn(
        "text-[9px] font-mundial font-black tracking-widest uppercase truncate w-full text-center px-1",
        isActuallyLive ? "text-orange-500" : "text-white/60"
      )}>
        {firstName}
      </span>

      <div className="relative">
        <div className={cn(
          "h-14 w-14 rounded-[20px] p-[1.5px] transition-all duration-500 shadow-xl",
          isActuallyLive ? "bg-gradient-to-tr from-orange-400 via-orange-500 to-yellow-500" : "bg-white/10"
        )}>
          <div className="h-full w-full rounded-[18px] bg-[#050505] overflow-hidden relative">
            <SmartImage 
              src={trackImage} 
              className={cn("h-full w-full grayscale transition-all duration-700", isActuallyLive && "grayscale-0 scale-110")} 
              fallback=""
            />
          </div>
        </div>
        
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-[#050505] bg-black overflow-hidden shadow-2xl z-10 transition-transform group-hover:scale-110">
          <SmartImage src={userAvatar} className="h-full w-full" fallback="" rounded="full" />
        </div>
      </div>

      <div className="flex flex-col items-center min-w-0 w-full gap-0.5">
        <MusicPlatformBadge userId={userId} className="p-0 border-none bg-transparent h-2 opacity-30 shadow-none mb-0.5" />
        
        <TruncatedTooltipText 
          text={artistName || "-"}
          className="text-[7px] font-black text-white/60 uppercase tracking-[0.05em] leading-[1.1] min-h-[16px] text-center px-0.5"
          lineClamp={2}
        />

        <TruncatedTooltipText 
          text={songName}
          className="text-[10px] font-black text-white leading-tight min-h-[24px] text-center px-0.5"
          lineClamp={2}
        />

        {playCount !== undefined && playCount > 0 && (
           <div className="mt-0.5 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/5 flex items-center">
              <span className="text-[6.5px] font-black text-white/70 uppercase tracking-widest leading-none">
                {coreUtils.formatPlayCount(playCount)}
              </span>
           </div>
        )}

        {isActuallyLive ? (
          <motion.div 
            animate={shouldRunAmbientMotion ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.82 }}
            transition={shouldRunAmbientMotion ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.16 }}
            className="mt-1 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20"
          >
            <span className="text-[7px] font-black text-orange-500 uppercase tracking-widest whitespace-nowrap">Ouvindo</span>
          </motion.div>
        ) : (
          <div className="mt-1">
            <span className="text-[7px] font-black text-white/50 uppercase tracking-widest text-center px-1">
              {timestamp ? coreUtils.formatRelativeTimeSP(timestamp) : "off"}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prev, next) => (
  prev.userId === next.userId &&
  prev.songName === next.songName &&
  prev.rawIsNowPlaying === next.rawIsNowPlaying &&
  prev.timestamp === next.timestamp &&
  prev.imageUrl === next.imageUrl
));
