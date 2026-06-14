import { useEffect, useMemo, useRef, useState } from 'react';
import { useMotionRuntime } from './useMotionRuntime';

type ViewportMotionGateOptions = {
  initialVisible?: boolean;
  respectPageVisibility?: boolean;
  rootMargin?: string;
};

export const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);

    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return prefersReducedMotion;
};

export const usePageVisibility = () => {
  const [isPageVisible, setIsPageVisible] = useState(
    typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleVisibility = () => setIsPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return isPageVisible;
};

export const useViewportMotionGate = <T extends HTMLElement>({
  initialVisible = true,
  respectPageVisibility = true,
  rootMargin = '160px',
}: ViewportMotionGateOptions = {}) => {
  const ref = useRef<T | null>(null);
  const [isInViewport, setIsInViewport] = useState(initialVisible);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isPageVisible = usePageVisibility();
  const motionRuntime = useMotionRuntime();

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInViewport(entry.isIntersecting),
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  const canAnimate = useMemo(
    () => (
      isInViewport &&
      motionRuntime.canRunMotion &&
      !prefersReducedMotion &&
      (!respectPageVisibility || isPageVisible)
    ),
    [isInViewport, isPageVisible, motionRuntime.canRunMotion, prefersReducedMotion, respectPageVisibility]
  );
  const shouldRunAmbientMotion = useMemo(
    () => canAnimate && motionRuntime.tier !== 'conserve',
    [canAnimate, motionRuntime.tier]
  );

  return {
    canAnimate,
    isInViewport,
    isPageVisible,
    motionFps: motionRuntime.fps,
    motionTier: motionRuntime.tier,
    prefersReducedMotion,
    ref,
    shouldRunAmbientMotion,
  };
};
