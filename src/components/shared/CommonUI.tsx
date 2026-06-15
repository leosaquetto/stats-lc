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
import { animationTokens, easeOutQuart } from '../../lib/animationTokens';
import { useViewportMotionGate } from '../../hooks/useViewportMotionGate';
import { useCompositorLoopTelemetry } from '../../hooks/useCompositorLoopTelemetry';
import { motionRuntime } from '../../lib/motionRuntime';
import { hasImageAssetLoaded, markImageAssetLoaded, preloadImageAssets } from '../../lib/assetRuntime';
import { peekRuntimeCacheEntry, setRuntimeCacheEntry } from '../../lib/memoryRuntime';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type EngineLoopPriority = 'ambient' | 'focus';

const useEngineLoopState = <T extends HTMLElement>(
  active: boolean,
  kind: string,
  priority: EngineLoopPriority = 'ambient',
) => {
  const {
    canAnimate,
    ref,
    shouldRunAmbientMotion,
  } = useViewportMotionGate<T>({
    initialVisible: priority === 'focus',
    rootMargin: priority === 'focus' ? '80px' : '56px',
  });
  const shouldRun = active && (priority === 'focus' ? canAnimate : shouldRunAmbientMotion);
  useCompositorLoopTelemetry(shouldRun, kind);

  return { ref, shouldRun };
};

export const EngineEqualizer = memo(({
  active,
  barWidth = '1.5px',
  className = '',
  barClassName = 'bg-orange-500',
  priority = 'ambient',
}: {
  active: boolean;
  barWidth?: string;
  className?: string;
  barClassName?: string;
  priority?: EngineLoopPriority;
}) => {
  const { ref, shouldRun } = useEngineLoopState<HTMLDivElement>(active, 'equalizer', priority);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('stats-lc-engine-loop stats-lc-engine-equalizer flex items-end', className)}
      data-active={shouldRun ? 'true' : 'false'}
      style={{ '--stats-lc-engine-bar-width': barWidth } as React.CSSProperties}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn('h-full origin-bottom rounded-full', barClassName)}
        />
      ))}
    </div>
  );
});

EngineEqualizer.displayName = 'EngineEqualizer';

export const EnginePulse = memo(({
  active,
  className = '',
  delay = 0,
  duration = 2,
  priority = 'ambient',
  style,
}: {
  active: boolean;
  className?: string;
  delay?: number;
  duration?: number;
  priority?: EngineLoopPriority;
  style?: React.CSSProperties;
}) => {
  const { ref, shouldRun } = useEngineLoopState<HTMLSpanElement>(active, 'pulse', priority);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn('stats-lc-engine-loop stats-lc-engine-pulse', className)}
      data-active={shouldRun ? 'true' : 'false'}
      style={{
        ...style,
        '--stats-lc-engine-delay': `${delay}s`,
        '--stats-lc-engine-duration': `${duration}s`,
      } as React.CSSProperties}
    />
  );
});

EnginePulse.displayName = 'EnginePulse';

export const EngineBreathe = memo(({
  active,
  children,
  className = '',
  duration = 2.4,
  fromOpacity = 0.72,
  fromScale = 0.97,
  priority = 'ambient',
  style,
  toOpacity = 1,
  toScale = 1.03,
}: {
  active: boolean;
  children?: React.ReactNode;
  className?: string;
  duration?: number;
  fromOpacity?: number;
  fromScale?: number;
  priority?: EngineLoopPriority;
  style?: React.CSSProperties;
  toOpacity?: number;
  toScale?: number;
}) => {
  const { ref, shouldRun } = useEngineLoopState<HTMLDivElement>(active, 'breathe', priority);
  return (
    <div
      ref={ref}
      aria-hidden={children ? undefined : 'true'}
      className={cn('stats-lc-engine-loop stats-lc-engine-breathe', className)}
      data-active={shouldRun ? 'true' : 'false'}
      style={{
        ...style,
        '--stats-lc-engine-duration': `${duration}s`,
        '--stats-lc-engine-from-opacity': fromOpacity,
        '--stats-lc-engine-from-scale': fromScale,
        '--stats-lc-engine-to-opacity': toOpacity,
        '--stats-lc-engine-to-scale': toScale,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
});

EngineBreathe.displayName = 'EngineBreathe';

export const EngineSpin = memo(({
  active,
  children,
  className = '',
  duration = 20,
  priority = 'ambient',
  reverse = false,
  style,
}: {
  active: boolean;
  children?: React.ReactNode;
  className?: string;
  duration?: number;
  priority?: EngineLoopPriority;
  reverse?: boolean;
  style?: React.CSSProperties;
}) => {
  const { ref, shouldRun } = useEngineLoopState<HTMLDivElement>(active, 'spin', priority);
  return (
    <div
      ref={ref}
      className={cn('stats-lc-engine-loop stats-lc-engine-spin', className)}
      data-active={shouldRun ? 'true' : 'false'}
      data-reverse={reverse ? 'true' : 'false'}
      style={{
        ...style,
        '--stats-lc-engine-duration': `${duration}s`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
});

EngineSpin.displayName = 'EngineSpin';

export const EngineSpinner = memo(({
  active = true,
  children,
  className = '',
  duration = 1.05,
  reverse = false,
}: {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  duration?: number;
  reverse?: boolean;
}) => (
  <EngineSpin
    active={active}
    className={cn('inline-flex shrink-0 items-center justify-center align-middle leading-none', className)}
    duration={duration}
    priority="focus"
    reverse={reverse}
  >
    {children}
  </EngineSpin>
));

EngineSpinner.displayName = 'EngineSpinner';

export const EngineDrift = memo(({
  active,
  children,
  className = '',
  delay = 0,
  duration = 12,
  priority = 'ambient',
  rotateA = 0.6,
  rotateB = -0.4,
  style,
  xA = 8,
  xB = -5,
  yA = -5,
  yB = 4,
}: {
  active: boolean;
  children?: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  priority?: EngineLoopPriority;
  rotateA?: number;
  rotateB?: number;
  style?: React.CSSProperties;
  xA?: number;
  xB?: number;
  yA?: number;
  yB?: number;
}) => {
  const { ref, shouldRun } = useEngineLoopState<HTMLDivElement>(active, 'drift', priority);
  return (
    <div
      ref={ref}
      className={cn('stats-lc-engine-loop stats-lc-engine-drift', className)}
      data-active={shouldRun ? 'true' : 'false'}
      style={{
        ...style,
        '--stats-lc-engine-delay': `${delay}s`,
        '--stats-lc-engine-duration': `${duration}s`,
        '--stats-lc-engine-rotate-a': `${rotateA}deg`,
        '--stats-lc-engine-rotate-b': `${rotateB}deg`,
        '--stats-lc-engine-x-a': `${xA}px`,
        '--stats-lc-engine-x-b': `${xB}px`,
        '--stats-lc-engine-y-a': `${yA}px`,
        '--stats-lc-engine-y-b': `${yB}px`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
});

EngineDrift.displayName = 'EngineDrift';

export const EngineShimmer = ({
  active,
  className = '',
  duration,
  priority = 'ambient',
  style,
  strong = false,
}: {
  active: boolean;
  className?: string;
  duration: number;
  priority?: EngineLoopPriority;
  style?: React.CSSProperties;
  strong?: boolean;
}) => {
  const { ref, shouldRun } = useEngineLoopState<HTMLDivElement>(active, 'shimmer', priority);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'stats-lc-engine-loop stats-lc-engine-shimmer absolute inset-y-0 left-0 w-[200%]',
        strong ? 'stats-lc-engine-shimmer-strong' : 'stats-lc-engine-shimmer-soft',
        className,
      )}
      data-active={shouldRun ? 'true' : 'false'}
      style={{
        ...style,
        '--stats-lc-engine-duration': `${duration}s`,
      } as React.CSSProperties}
    />
  );
};

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

export const StatsLCLogo = ({ size = 32, className = "", variant = "orange" }: { size?: number, className?: string, variant?: 'orange' | 'black' }) => {
  const { ref: logoRef, shouldRunAmbientMotion } = useViewportMotionGate<HTMLDivElement>({ rootMargin: '120px' });

  return (
    <motion.div 
      ref={logoRef}
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <EngineBreathe
        active={shouldRunAmbientMotion}
        className="absolute inset-0 rounded-full bg-orange-500/20 blur-md"
        duration={4}
        fromOpacity={0.2}
        fromScale={1}
        toOpacity={0.4}
        toScale={1.3}
      />
      
      {variant === 'orange' ? (
        <LOGO_ORANGE className="w-full h-full relative z-10 drop-shadow-lg" />
      ) : (
        <LOGO_BLACK_ORANGE className="w-full h-full relative z-10 drop-shadow-lg rounded-[20%] overflow-hidden" />
      )}
    </motion.div>
  );
};

const stableImageSrcByKey = new Map<string, string>();

export const preloadSmartImages = preloadImageAssets;

export const SmartImage = ({ src, fallbackSrc, cacheKey, className, fallback = "👤", rounded = "2xl" }: { src?: string, fallbackSrc?: string, cacheKey?: string, className?: string, fallback?: string, rounded?: string }) => {
  const inputSrc = (typeof src === 'string' ? src : ((src as any)?.url || "")).trim();
  const cachedStableSrc = cacheKey ? peekRuntimeCacheEntry(stableImageSrcByKey, cacheKey) || '' : '';
  const lastGoodSrcRef = useRef(cacheKey ? peekRuntimeCacheEntry(stableImageSrcByKey, cacheKey) || '' : '');
  const lastCacheKeyRef = useRef(cacheKey || '');
  const [overrideSrc, setOverrideSrc] = useState('');

  const resolvedSrc = overrideSrc || inputSrc;
  const displaySrc = resolvedSrc || lastGoodSrcRef.current || cachedStableSrc;
  const previousDisplaySrc = lastGoodSrcRef.current || cachedStableSrc;

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(() => inputSrc ? !hasImageAssetLoaded(inputSrc) : true);
  const [showFallback, setShowFallback] = useState(false);
  const shimmerDuration = useStatsStore(state => state.shimmerDuration) || 2.8;
  const {
    ref: imageFrameRef,
    isInViewport,
    shouldRunAmbientMotion,
  } = useViewportMotionGate<HTMLDivElement>({ initialVisible: false, rootMargin: '220px' });
  const imageRef = useRef<HTMLImageElement>(null);

  const imageSrc = error && previousDisplaySrc ? previousDisplaySrc : displaySrc;
  const hasDisplayableSrc = !!imageSrc && !error && !imageSrc.includes("private.webp");
  const previousBelongsToCurrentKey = !cacheKey || peekRuntimeCacheEntry(stableImageSrcByKey, cacheKey) === previousDisplaySrc;

  useEffect(() => {
    setOverrideSrc('');
  }, [inputSrc]);

  useEffect(() => {
    const nextCacheKey = cacheKey || '';
    if (lastCacheKeyRef.current !== nextCacheKey) {
      lastCacheKeyRef.current = nextCacheKey;
      lastGoodSrcRef.current = nextCacheKey ? peekRuntimeCacheEntry(stableImageSrcByKey, nextCacheKey) || '' : '';
      setOverrideSrc('');
      setError(false);
      setShowFallback(false);
      setLoading(!!inputSrc && !hasImageAssetLoaded(inputSrc));
    }

    if (!cacheKey) return;
    const cached = peekRuntimeCacheEntry(stableImageSrcByKey, cacheKey);
    if (cached && !lastGoodSrcRef.current) {
      lastGoodSrcRef.current = cached;
    }
  }, [cacheKey, inputSrc]);

  useEffect(() => {
    setError(false);
    setShowFallback(false);
    setLoading(!!displaySrc && !hasImageAssetLoaded(displaySrc));

    if (!displaySrc || displaySrc.includes("private.webp")) {
      const cancelTask = motionRuntime.scheduleTask(() => setShowFallback(true), 400, 'interaction');
      return () => cancelTask();
    }
  }, [displaySrc]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || !imageSrc || error) return;

    if (image.complete && image.naturalWidth > 0) {
      lastGoodSrcRef.current = imageSrc;
      if (cacheKey) setRuntimeCacheEntry(stableImageSrcByKey, cacheKey, imageSrc, 'large');
      markImageAssetLoaded(imageSrc);
      setLoading(false);
      setShowFallback(false);
    }
  }, [cacheKey, error, imageSrc]);

  // Get initials from fallback name (max 2 chars)
  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const shouldShowFallback = !hasDisplayableSrc && showFallback && !previousDisplaySrc;
  const shouldKeepPreviousImage = previousBelongsToCurrentKey && !!previousDisplaySrc && (loading || error || previousDisplaySrc !== imageSrc);
  const shouldLoadEagerly = isInViewport || hasImageAssetLoaded(imageSrc);
  const imageLoadingMode = shouldLoadEagerly ? 'eager' : 'lazy';
  const imageFetchPriority = shouldLoadEagerly ? 'high' : 'low';

  return (
    <div ref={imageFrameRef} className={cn("relative overflow-hidden bg-white/5", className, `rounded-${rounded}`)}>
      {shouldKeepPreviousImage && (
        <img
          src={previousDisplaySrc}
          className={cn("absolute inset-0 h-full w-full object-cover", `rounded-${rounded}`)}
          referrerPolicy="no-referrer"
          loading={imageLoadingMode}
          fetchPriority={imageFetchPriority}
          decoding="async"
          alt=""
          aria-hidden="true"
        />
      )}
      {loading && (
        <div className="absolute inset-0 bg-white/[0.02] overflow-hidden">
          <EngineShimmer active={shouldRunAmbientMotion} duration={shimmerDuration} strong />
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
          loading={imageLoadingMode}
          fetchPriority={imageFetchPriority}
          decoding="async"
          ref={imageRef}
          onLoad={() => {
            lastGoodSrcRef.current = imageSrc;
            if (cacheKey) setRuntimeCacheEntry(stableImageSrcByKey, cacheKey, imageSrc, 'large');
            markImageAssetLoaded(imageSrc);
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
  const {
    ref: marqueeMotionRef,
    shouldRunAmbientMotion,
  } = useViewportMotionGate<HTMLDivElement>({ rootMargin: '160px' });
  const shouldRunMarquee = shouldAnimate && shouldRunAmbientMotion;
  useCompositorLoopTelemetry(shouldRunMarquee, 'marquee');

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
    const cancelCheck = motionRuntime.scheduleTask(check, 200, 'interaction');
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      cancelCheck();
    };
  }, [text]);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden w-full min-w-0", className)}>
      <span ref={measureRef} className="invisible absolute top-0 left-0 whitespace-nowrap pointer-events-none opacity-0">
        {text}
      </span>
      
      {shouldAnimate ? (
        <div
          ref={marqueeMotionRef}
          className="stats-lc-engine-loop stats-lc-engine-marquee flex w-max whitespace-nowrap"
          data-active={shouldRunMarquee ? 'true' : 'false'}
          style={{
            '--stats-lc-engine-distance': `${scrollWidth + 32}px`,
            '--stats-lc-engine-duration': `${Math.max(scrollWidth / speed, 8) + 3}s`,
          } as React.CSSProperties}
        >
          <span className="shrink-0 pr-8">{text}</span>
          <span className="shrink-0 pr-8">{text}</span>
        </div>
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

export const ShimmerOverlay = ({
  active = true,
  duration = 2.5,
  className = "",
}: {
  active?: boolean;
  duration?: number;
  className?: string;
}) => (
  active
    ? (
      <div className={cn("absolute inset-0 overflow-hidden pointer-events-none z-0", className)}>
        <EngineShimmer active duration={duration} />
      </div>
    )
    : null
);

export const SkeletonSurface = ({
  active = true,
  as: Tag = 'div',
  children,
  className,
  duration = 2.5,
}: {
  active?: boolean;
  as?: 'div' | 'span';
  children?: React.ReactNode;
  className?: string;
  duration?: number;
}) => (
  <Tag className={cn("relative overflow-hidden", className)}>
    {children}
    {active && <ShimmerOverlay duration={duration} />}
  </Tag>
);

export const Skeleton = ({ className, shimmer = true, rounded = "2xl" }: { className?: string, shimmer?: boolean, rounded?: string }) => (
  <SkeletonSurface
    active={shimmer}
    className={cn(
      "bg-white/[0.03] border border-white/[0.05]",
      `rounded-${rounded}`,
      className
    )}
  />
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
  const {
    ref: numberRef,
    canAnimate,
  } = useViewportMotionGate<HTMLSpanElement>({ rootMargin: '120px' });
  const initialValue = startFrom == null ? value : startFrom;
  const initialValueRef = useRef(initialValue);
  const displayValueRef = useRef(initialValue);
  const prevValueRef = useRef(initialValue);
  const animationStateRef = useRef<{
    duration: number;
    endValue: number;
    startTime?: number;
    startValue: number;
  } | null>(null);

  useEffect(() => {
    if (prevValueRef.current === value) return;

    if (!canAnimate) {
      animationStateRef.current = null;
      prevValueRef.current = value;
      displayValueRef.current = value;
      if (numberRef.current) numberRef.current.textContent = coreUtils.formatNumber(value);
      return;
    }
    
    const startValue = prevValueRef.current;
    const endValue = value;
    const delta = Math.abs(endValue - startValue);
    const duration = adaptive
      ? Math.min(
          animationTokens.durationMs.numberAdaptiveMax,
          Math.max(
            animationTokens.durationMs.numberAdaptiveMin,
            animationTokens.durationMs.numberAdaptiveMin + Math.log10(delta + 1) * 180
          )
        )
      : animationTokens.durationMs.number;

    animationStateRef.current = { duration, endValue, startValue };

    let unsubscribe = () => {};
    unsubscribe = motionRuntime.subscribeFrame(({ now }) => {
      const state = animationStateRef.current;
      if (!state) {
        unsubscribe();
        return;
      }

      if (state.startTime === undefined) state.startTime = now;
      const elapsed = now - state.startTime;
      const progress = Math.min(elapsed / state.duration, 1);
      const easeProgress = easeOutQuart(progress);
      const current = Math.floor(state.startValue + (state.endValue - state.startValue) * easeProgress);
      displayValueRef.current = current;
      if (numberRef.current) numberRef.current.textContent = coreUtils.formatNumber(current);

      if (progress >= 1) {
        prevValueRef.current = state.endValue;
        animationStateRef.current = null;
        unsubscribe();
      }
    }, { maxFps: 60, priority: 'interaction' });

    return () => {
      animationStateRef.current = null;
      unsubscribe();
    };
  }, [adaptive, canAnimate, value, numberRef]);

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
        className="glass flex items-center justify-between px-3 py-2 rounded-[20px] border-white/5 group hover:bg-white/[0.08] transition-[background-color,border-color,box-shadow,opacity,transform] h-full"
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
