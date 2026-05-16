import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Headphones, TrendingUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { coreUtils } from '../../services/statsCore';
import { LOGO_ORANGE, LOGO_BLACK_ORANGE } from '../../constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const StatsLCLogo = ({ size = 32, className = "", variant = "orange" }: { size?: number, className?: string, variant?: 'orange' | 'black' }) => {
  return (
    <motion.div 
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div 
        className="absolute inset-0 rounded-full bg-orange-500/20 blur-md"
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
      />
      
      {variant === 'orange' ? (
        <LOGO_ORANGE className="w-full h-full relative z-10 drop-shadow-lg" />
      ) : (
        <LOGO_BLACK_ORANGE className="w-full h-full relative z-10 drop-shadow-lg rounded-[20%] overflow-hidden" />
      )}
    </motion.div>
  );
};

export const SmartImage = ({ src, className, fallback = "👤", rounded = "2xl" }: { src?: string, className?: string, fallback?: string, rounded?: string }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const finalSrc = error || !src || src.includes("private.webp")
    ? `https://ui-avatars.com/api/?background=222&color=fff&name=${encodeURIComponent(fallback)}`
    : src;

  return (
    <div className={cn("relative overflow-hidden bg-white/5", className, `rounded-${rounded}`)}>
      {loading && <div className="absolute inset-0 animate-pulse bg-white/5" />}
      <img
        src={finalSrc}
        className={cn("h-full w-full object-cover transition-opacity duration-300", loading ? "opacity-0" : "opacity-100")}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        alt=""
      />
    </div>
  );
};

export const MarqueeText = ({ text, className }: { text: string; className?: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const diff = textRef.current.scrollWidth - containerRef.current.clientWidth;
      setOverflow(diff > 0 ? diff : 0);
    }
  }, [text]);

  return (
    <div 
      ref={containerRef}
      className={cn("overflow-hidden whitespace-nowrap w-full relative", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        animate={isHovered && overflow > 0 ? { x: -overflow - 12 } : { x: 0 }}
        transition={{ duration: overflow > 0 ? Math.max(overflow / 30, 0.4) : 0.3, ease: "linear" }}
        className="inline-block"
      >
        <span ref={textRef} title={text}>{text}</span>
      </motion.div>
    </div>
  );
}

export const ScrollingText = ({ text, className, speed = 30 }: { text: string; className?: string; speed?: number }) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const check = () => {
      if (containerRef.current && measureRef.current) {
        const cWidth = containerRef.current.offsetWidth;
        const mWidth = measureRef.current.scrollWidth;
        setScrollWidth(mWidth);
        setShouldAnimate(mWidth > cWidth + 1);
      }
    };
    check();
    const t = setTimeout(check, 200);
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      clearTimeout(t);
    };
  }, [text]);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden w-full min-w-0", className)}>
      <span ref={measureRef} className="invisible absolute top-0 left-0 whitespace-nowrap pointer-events-none opacity-0">
        {text}
      </span>
      
      {shouldAnimate ? (
        <motion.div
          animate={{ x: [0, -(scrollWidth + 32)] }}
          transition={{
            duration: Math.max(scrollWidth / speed, 8),
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 3
          }}
          className="flex w-max whitespace-nowrap"
        >
          <span className="shrink-0 pr-8">{text}</span>
          <span className="shrink-0 pr-8">{text}</span>
        </motion.div>
      ) : (
        <div className="truncate w-full block whitespace-nowrap">
          {text}
        </div>
      )}
    </div>
  );
};

export const SectionHeader = ({ title, icon: Icon, action }: { title: string, icon?: any, action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-4 mt-8 px-2">
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-3 w-3 text-white/40" />}
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">{title}</h2>
    </div>
    {action}
  </div>
);

export const Skeleton = ({ className }: { className?: string, key?: string | number }) => (
  <div className={cn("animate-pulse rounded-2xl bg-white/5", className)} />
);

export const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  
  useEffect(() => {
    if (prevValueRef.current === value) return;
    
    let start = prevValueRef.current;
    const end = value;
    const duration = 800;
    const increment = (end - start) / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if ((increment > 0 && start >= end) || (increment < 0 && start <= end)) {
        setDisplayValue(end);
        prevValueRef.current = end;
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue}</span>;
};

export const MusicPlatformBadge = ({ userId, platform, track, className, showLabel = false }: { userId?: string, platform?: any, track?: any, className?: string, showLabel?: boolean }) => {
  const platformData = platform || (userId ? coreUtils.getUserPlaybackPlatform(userId) : null);
  
  if (platformData && platformData.primary && platformData.primary !== "unknown") {
    const isApple = platformData.primary === "appleMusic";
    const isSpotify = platformData.primary === "spotify";
    const label = isApple ? "Apple Music" : "Spotify";

    return (
      <div className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-lg glass border border-white/10 shadow-lg",
        className
      )}>
        <img 
          src={isSpotify 
            ? "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg"
            : "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
          } 
          className={cn("h-3 w-3", isApple && "invert")} 
          alt={label} 
        />
        {showLabel && (
          <span className="text-[8px] font-black uppercase tracking-widest text-white/70 pr-0.5">
            {label}
          </span>
        )}
      </div>
    );
  }

  if (track) {
    const availability = coreUtils.detectCatalogAvailability(track);
    if (availability.primary !== "unknown") {
      const isApple = availability.primary === "appleMusic";
      const isSpotify = availability.primary === "spotify";

      return (
        <div className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded-lg glass border border-white/10 shadow-lg",
          className
        )}>
          <img 
            src={isSpotify 
              ? "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg"
              : "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
            } 
            className={cn("h-3 w-3", isApple && "invert")} 
            alt="" 
          />
          {showLabel && (
            <span className="text-[8px] font-black uppercase tracking-widest text-white/70 pr-0.5">
              {isSpotify ? "Spotify" : "Apple Music"}
            </span>
          )}
        </div>
      );
    }
  }

  return null;
};

export const TruncatedTooltipText = ({ text, className, lineClamp = 2 }: { text: string; className?: string; lineClamp?: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      if (containerRef.current) {
        const { scrollHeight, clientHeight } = containerRef.current;
        setIsTruncated(scrollHeight > clientHeight);
      }
    };

    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [text, lineClamp]);

  return (
    <div className="relative w-full group/tooltip">
      <div 
        ref={containerRef}
        className={cn(className, lineClamp === 1 ? "truncate" : `line-clamp-${lineClamp}`)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {text}
      </div>

      <AnimatePresence>
        {isHovered && isTruncated && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-xl glass border border-white/10 shadow-2xl pointer-events-none w-max max-w-[160px] text-center"
          >
            <p className="text-[10px] font-bold text-white whitespace-normal leading-tight">{text}</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export interface MusicCardProps {
  key?: string | number;
  userId: string;
  userName: string;
  songName: string;
  artistName: string;
  track?: any;
  imageUrl?: string;
  isNowPlaying?: boolean;
  className?: string;
  footer?: string | React.ReactNode;
  onClick?: () => void;
}

export const MusicCard = React.memo(({ 
  userId,
  userName, 
  songName, 
  artistName, 
  track,
  imageUrl, 
  isNowPlaying, 
  className,
  footer,
  onClick
}: MusicCardProps) => {
  const isLeo = userId === "leo";
  const accentColor = isLeo ? ({id: "leo", name: "Leo", color: "#FF9F0A"}).color : "#FFFFFF";
  const trackImage = coreUtils.getAvatarUrl(userId, imageUrl);
  const userAvatar = coreUtils.getUserAvatar(userId);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={onClick ? { y: -4, backgroundColor: "rgba(255, 255, 255, 0.08)" } : {}}
      onClick={onClick}
      className={cn(
        "glass-card group relative flex items-center gap-4 border-white/5 p-4 bg-white/[0.03]",
        onClick && "cursor-pointer active:scale-[0.98] transition-all",
        className
      )}
      style={{ 
        boxShadow: isNowPlaying ? `0 0 20px ${accentColor}10` : undefined,
        borderColor: isNowPlaying ? `${accentColor}30` : undefined
      }}
    >
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
          <img src={userAvatar} className="h-full w-full object-cover" referrerPolicy="no-referrer" alt="" />
        </div>
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{userName}</span>
          <div className="flex items-center gap-1.5">
            {userId && <MusicPlatformBadge userId={userId} className="p-0 border-none bg-transparent h-2.5 w-2.5 opacity-50 shrink-0" />}
            {footer && <span className="text-[8px] font-bold text-white/30 uppercase tracking-tighter whitespace-nowrap">{footer}</span>}
          </div>
        </div>
        <MarqueeText 
          text={songName || ""} 
          className="font-display text-sm font-semibold text-white group-hover:text-orange-500 transition-colors"
        />
        <MarqueeText 
          text={artistName || ""} 
          className="text-[10px] font-medium text-white/50"
        />
      </div>
    </motion.div>
  );
}, (prev, next) => (
  prev.userId === next.userId &&
  prev.songName === next.songName &&
  prev.isNowPlaying === next.isNowPlaying &&
  prev.footer === next.footer &&
  prev.imageUrl === next.imageUrl
));

export const TopRankRow = React.memo(({ 
  index, 
  style,
  topItems
}: { 
  index: number; 
  style: React.CSSProperties;
  topItems: any[];
}) => {
  const item = topItems[index];
  if (!item) return null;
  
  return (
    <div style={style} className="px-1 py-1">
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="glass flex items-center justify-between px-3 py-2 rounded-[20px] border-white/5 group hover:bg-white/[0.08] transition-all h-full"
      >
         <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-black text-white/30 w-4 pl-1">#{index + 1}</span>
            <SmartImage 
              src={item.image} 
              className="h-8 w-8 shadow-md border border-white/10" 
              rounded="xl"
              fallback=""
            />
            <div className="flex flex-col min-w-0 pr-2">
               <span className="text-[12px] font-black text-white tracking-tight truncate max-w-[150px]">{item.name}</span>
               <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest truncate max-w-[150px]">
                  {item.artists ? item.artists.map((a: any) => a.name).join(', ') : 'Mais ouvidos'}
               </span>
            </div>
         </div>
         <div className="text-right shrink-0">
            <div className="bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded-full flex items-center justify-center">
               <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">
                  {coreUtils.formatNumber(item.streams || 0)}
               </span>
            </div>
         </div>
      </motion.div>
    </div>
  );
});
