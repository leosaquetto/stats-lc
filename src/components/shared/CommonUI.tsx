/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Headphones, TrendingUp, Play, Disc } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { coreUtils } from '../../services/statsCore';
import { LOGO_ORANGE, LOGO_BLACK_ORANGE } from '../../constants';
import { useStatsStore } from '../../store/useStatsStore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const OrbitPagerIndicator = memo(({
  count,
  activeIndex,
  onSelect,
  label = 'item',
  className = '',
}: {
  count: number;
  activeIndex: number;
  onSelect?: (index: number) => void;
  label?: string;
  className?: string;
}) => {
  if (count <= 1) return null;

  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)} aria-label={`Navegação de ${label}`}>
      {Array.from({ length: count }, (_, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={`${label}-${index}`}
            type="button"
            onClick={() => onSelect?.(index)}
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color,opacity,transform] duration-200 active:scale-90",
              isActive ? "w-5 bg-orange-500 opacity-100" : "w-1.5 bg-white/18 opacity-70",
              !onSelect && "pointer-events-none"
            )}
            aria-label={`Ir para ${label} ${index + 1}`}
            aria-current={isActive ? 'true' : undefined}
          />
        );
      })}
    </div>
  );
});

OrbitPagerIndicator.displayName = 'OrbitPagerIndicator';

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return prefersReducedMotion;
};

const useElementVisibility = <T extends HTMLElement>(rootMargin = '160px') => {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, isVisible] as const;
};

export const StatsLCLogo = ({ size = 32, className = "", variant = "orange" }: { size?: number, className?: string, variant?: 'orange' | 'black' }) => {
  const [logoRef, isVisible] = useElementVisibility<HTMLDivElement>('120px');
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = isVisible && !prefersReducedMotion;

  return (
    <motion.div 
      ref={logoRef}
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div 
        className="absolute inset-0 rounded-full bg-orange-500/20 blur-md"
        animate={shouldAnimate ? { 
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2]
        } : { scale: 1, opacity: 0.22 }}
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

const loadedImageSrcs = new Set<string>();
const preloadingImageSrcs = new Map<string, Promise<void>>();
const stableImageSrcByKey = new Map<string, string>();

export const preloadSmartImages = (sources: Array<string | undefined | null>) => {
  if (typeof window === 'undefined') return Promise.resolve();

  const uniqueSources = Array.from(new Set(
    sources
      .map((source) => typeof source === 'string' ? source : '')
      .filter((source) => source.trim().length > 5 && !source.includes('private.webp'))
  ));

  return Promise.allSettled(uniqueSources.map((source) => {
    if (loadedImageSrcs.has(source)) return Promise.resolve();

    const existing = preloadingImageSrcs.get(source);
    if (existing) return existing;

    const promise = new Promise<void>((resolve) => {
      const image = new Image();
      const done = () => {
        loadedImageSrcs.add(source);
        preloadingImageSrcs.delete(source);
        resolve();
      };
      const timeout = window.setTimeout(done, 1800);

      image.onload = () => {
        window.clearTimeout(timeout);
        if (image.decode) {
          image.decode().then(done).catch(done);
        } else {
          done();
        }
      };
      image.onerror = done;
      image.decoding = 'async';
      image.src = source;
    });

    preloadingImageSrcs.set(source, promise);
    return promise;
  })).then(() => undefined);
};

export const SmartImage = ({ src, fallbackSrc, cacheKey, className, fallback = "👤", rounded = "2xl" }: { src?: string, fallbackSrc?: string, cacheKey?: string, className?: string, fallback?: string, rounded?: string }) => {
  const inputSrc = (typeof src === 'string' ? src : ((src as any)?.url || "")).trim();
  const cachedStableSrc = cacheKey ? stableImageSrcByKey.get(cacheKey) || '' : '';
  const lastGoodSrcRef = useRef(cacheKey ? stableImageSrcByKey.get(cacheKey) || '' : '');
  const [overrideSrc, setOverrideSrc] = useState('');

  const resolvedSrc = overrideSrc || inputSrc;
  const displaySrc = resolvedSrc || lastGoodSrcRef.current || cachedStableSrc;
  const previousDisplaySrc = lastGoodSrcRef.current || cachedStableSrc;

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(() => {
    if (!displaySrc) return false;
    return !loadedImageSrcs.has(displaySrc);
  });
  const [showFallback, setShowFallback] = useState(false);
  const shimmerDuration = useStatsStore(state => state.shimmerDuration) || 2.8;
  const [imageFrameRef, isVisible] = useElementVisibility<HTMLDivElement>('220px');
  const prefersReducedMotion = usePrefersReducedMotion();
  const imageRef = useRef<HTMLImageElement>(null);

  const imageSrc = error && previousDisplaySrc ? previousDisplaySrc : displaySrc;
  const hasDisplayableSrc = !!imageSrc && !imageSrc.includes("private.webp");

  useEffect(() => {
    setOverrideSrc('');
  }, [inputSrc]);

  useEffect(() => {
    if (!cacheKey) return;
    const cached = stableImageSrcByKey.get(cacheKey);
    if (cached && !lastGoodSrcRef.current) {
      lastGoodSrcRef.current = cached;
    }
  }, [cacheKey]);

  useEffect(() => {
    setError(false);
    setShowFallback(false);
    setLoading(!!displaySrc && !loadedImageSrcs.has(displaySrc));

    if (!displaySrc || displaySrc.includes("private.webp")) {
      const timer = setTimeout(() => setShowFallback(true), 400);
      return () => clearTimeout(timer);
    }
  }, [displaySrc]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || !imageSrc || error) return;

    if (image.complete && image.naturalWidth > 0) {
      lastGoodSrcRef.current = imageSrc;
      if (cacheKey) stableImageSrcByKey.set(cacheKey, imageSrc);
      loadedImageSrcs.add(imageSrc);
      setLoading(false);
      setShowFallback(false);
    }
  }, [cacheKey, error, imageSrc]);

  // Get initials from fallback name (max 2 chars)
  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const shouldShowFallback = !hasDisplayableSrc && showFallback && !previousDisplaySrc;
  const shouldKeepPreviousImage = !!previousDisplaySrc && (loading || error || previousDisplaySrc !== imageSrc);

  return (
    <div ref={imageFrameRef} className={cn("relative overflow-hidden bg-white/5", className, `rounded-${rounded}`)}>
      {shouldKeepPreviousImage && (
        <img
          src={previousDisplaySrc}
          className={cn("absolute inset-0 h-full w-full object-cover", `rounded-${rounded}`)}
          referrerPolicy="no-referrer"
          loading="eager"
          alt=""
          aria-hidden="true"
        />
      )}
      {loading && (
        <div className="absolute inset-0 bg-white/[0.02] overflow-hidden">
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%)',
              width: '200%',
              height: '100%',
            }}
            initial={{ x: '-100%' }}
            animate={isVisible && !prefersReducedMotion ? { x: '100%' } : { x: '-100%' }}
            transition={{
              repeat: Infinity,
              duration: shimmerDuration,
              ease: "linear",
            }}
          />
        </div>
      )}
      {shouldShowFallback ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.08] to-white/[0.03]">
          <span className="text-xl font-bold text-white/40 select-none">
            {getInitials(fallback)}
          </span>
        </div>
      ) : hasDisplayableSrc ? (
        <img
          src={imageSrc}
          className={cn("h-full w-full object-cover transition-opacity duration-300", loading ? "opacity-0" : "opacity-100", `rounded-${rounded}`)}
          referrerPolicy="no-referrer"
          loading="eager"
          ref={imageRef}
          onLoad={() => {
            lastGoodSrcRef.current = imageSrc;
            if (cacheKey) stableImageSrcByKey.set(cacheKey, imageSrc);
            loadedImageSrcs.add(imageSrc);
            setLoading(false);
            setError(false);
            setShowFallback(false);
          }}
          onError={() => {
            if (fallbackSrc && imageSrc !== fallbackSrc) {
              setOverrideSrc(fallbackSrc);
              setError(false);
              setLoading(true);
              setShowFallback(false);
              return;
            }
            if (lastGoodSrcRef.current && imageSrc !== lastGoodSrcRef.current) {
              setOverrideSrc(lastGoodSrcRef.current);
              setError(false);
              setLoading(false);
              setShowFallback(false);
              return;
            }
            setError(!lastGoodSrcRef.current);
            setLoading(false);
            setShowFallback(!lastGoodSrcRef.current);
          }}
          alt=""
        />
      ) : null}
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
  <div className="flex items-center justify-between mb-4 mt-6 px-1">
    <div className="flex items-center gap-2.5">
      {Icon && (
        <div className="opacity-70 group-hover:opacity-100 transition-opacity">
          {typeof Icon === 'function' ? <Icon className="h-3 w-3 text-white" /> : Icon}
        </div>
      )}
      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80 drop-shadow-sm">{title}</h2>
    </div>
    <div className="relative z-10 transition-transform active:scale-95">
      {action}
    </div>
  </div>
);

export const ShimmerOverlay = ({ duration = 2.5, className = "" }: { duration?: number, className?: string }) => (
  <VisibleShimmerOverlay duration={duration} className={className} />
);

const VisibleShimmerOverlay = ({ duration = 2.5, className = "" }: { duration?: number, className?: string }) => {
  const [shimmerRef, isVisible] = useElementVisibility<HTMLDivElement>('180px');
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div ref={shimmerRef} className={cn("absolute inset-0 overflow-hidden pointer-events-none z-0", className)}>
      <motion.div
        className="absolute inset-0"
        initial={{ x: '-100%' }}
        animate={isVisible && !prefersReducedMotion ? { x: '100%' } : { x: '-100%' }}
        transition={{
          repeat: Infinity,
          duration,
          ease: "linear",
        }}
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.02) 20%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.02) 80%, transparent 100%)',
          willChange: isVisible && !prefersReducedMotion ? 'transform' : 'auto'
        }}
      />
    </div>
  );
};

export const Skeleton = ({ className, shimmer = true, rounded = "2xl" }: { className?: string, shimmer?: boolean, rounded?: string }) => (
  <div className={cn(
    "relative overflow-hidden bg-white/[0.03] border border-white/[0.05]", 
    `rounded-${rounded}`,
    !shimmer && "animate-pulse",
    className
  )}>
    {shimmer && <ShimmerOverlay />}
  </div>
);

export const AnimatedNumber = ({
  value,
  startFrom,
  adaptive = false,
}: {
  value: number;
  startFrom?: number;
  adaptive?: boolean;
}) => {
  const [numberRef, isVisible] = useElementVisibility<HTMLSpanElement>('120px');
  const prefersReducedMotion = usePrefersReducedMotion();
  const initialValue = startFrom == null ? value : startFrom;
  const initialValueRef = useRef(initialValue);
  const displayValueRef = useRef(initialValue);
  const prevValueRef = useRef(initialValue);
  const requestRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (prevValueRef.current === value) return;

    if (!isVisible || prefersReducedMotion) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      startTimeRef.current = undefined;
      prevValueRef.current = value;
      displayValueRef.current = value;
      if (numberRef.current) numberRef.current.textContent = coreUtils.formatNumber(value);
      return;
    }
    
    const startValue = prevValueRef.current;
    const endValue = value;
    const delta = Math.abs(endValue - startValue);
    const duration = adaptive
      ? Math.min(900, Math.max(360, 360 + Math.log10(delta + 1) * 180))
      : 620;

    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Quartic out easing for smoother finish
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(startValue + (endValue - startValue) * easeProgress);
      displayValueRef.current = current;
      if (numberRef.current) numberRef.current.textContent = coreUtils.formatNumber(current);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = endValue;
        startTimeRef.current = undefined;
      }
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      startTimeRef.current = undefined;
    };
  }, [adaptive, value, isVisible, prefersReducedMotion, numberRef]);

  return <span ref={numberRef}>{coreUtils.formatNumber(initialValueRef.current)}</span>;
};

export const MusicPlatformBadge = memo(({ userId, platform, track, className, showLabel = false, variant = "default" }: { userId?: string, platform?: any, track?: any, className?: string, showLabel?: boolean, variant?: "default" | "minimal" }) => {
  const platformData = platform || (userId ? coreUtils.getUserPlaybackPlatform(userId) : null);
  
  if (platformData && platformData.primary && platformData.primary !== "unknown") {
    const isApple = platformData.primary === "appleMusic";
    const isSpotify = platformData.primary === "spotify";
    const label = isApple ? "Apple Music" : "Spotify";

    if (variant === "minimal") {
      return (
        <img 
          src={isSpotify 
            ? "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg"
            : "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
          } 
          className={cn("h-3.5 w-3.5 max-h-[14px] max-w-[14px] object-contain opacity-70 shrink-0", isApple && "invert", className)} 
          alt={label} 
        />
      );
    }

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
          className={cn("h-3.5 w-3.5 max-h-[14px] max-w-[14px] object-contain opacity-70", isApple && "invert")} 
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
            className={cn("h-3.5 w-3.5 max-h-[14px] max-w-[14px] object-contain opacity-70", isApple && "invert")} 
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
});

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
            <span className="text-[10px] font-black text-white/60 w-4 pl-1">#{index + 1}</span>
            <SmartImage 
              src={item.image} 
              className="h-8 w-8 shadow-md border border-white/10" 
              rounded="xl"
              fallback=""
            />
            <div className="flex flex-col min-w-0 pr-2">
               <span className="text-[12px] font-black text-white tracking-tight truncate max-w-[150px]">{item.name}</span>
               <span className="text-[8px] font-bold text-white/70 uppercase tracking-widest truncate max-w-[150px]">
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
