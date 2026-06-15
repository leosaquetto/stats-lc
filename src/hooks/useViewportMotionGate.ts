import { useEffect, useMemo, useRef, useState } from 'react';
import { useMotionRuntime } from './useMotionRuntime';
import { useModalMotionOpen } from './useModalMotionScope';

type ViewportMotionGateOptions = {
  initialVisible?: boolean;
  respectPageVisibility?: boolean;
  rootMargin?: string;
};

type ViewportObserverCallback = (isIntersecting: boolean) => void;
type ViewportObserverPool = {
  callbacks: Map<Element, Set<ViewportObserverCallback>>;
  observer: IntersectionObserver;
};

const viewportObserverPools = new Map<string, ViewportObserverPool>();

const observeViewport = (
  node: Element,
  rootMargin: string,
  callback: ViewportObserverCallback,
) => {
  let pool = viewportObserverPools.get(rootMargin);
  if (!pool) {
    const callbacks = new Map<Element, Set<ViewportObserverCallback>>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        callbacks.get(entry.target)?.forEach((listener) => listener(entry.isIntersecting));
      });
    }, { rootMargin });
    pool = { callbacks, observer };
    viewportObserverPools.set(rootMargin, pool);
  }

  const callbacks = pool.callbacks.get(node) ?? new Set<ViewportObserverCallback>();
  const shouldObserve = callbacks.size === 0;
  callbacks.add(callback);
  pool.callbacks.set(node, callbacks);
  if (shouldObserve) pool.observer.observe(node);

  return () => {
    const activePool = viewportObserverPools.get(rootMargin);
    const activeCallbacks = activePool?.callbacks.get(node);
    if (!activePool || !activeCallbacks) return;
    activeCallbacks.delete(callback);
    if (activeCallbacks.size) return;
    activePool.callbacks.delete(node);
    activePool.observer.unobserve(node);
    if (activePool.callbacks.size) return;
    activePool.observer.disconnect();
    viewportObserverPools.delete(rootMargin);
  };
};

export const usePrefersReducedMotion = () => useMotionRuntime().prefersReducedMotion;

export const usePageVisibility = () => useMotionRuntime().isPageVisible;

export const useViewportMotionGate = <T extends HTMLElement>({
  initialVisible = true,
  respectPageVisibility = true,
  rootMargin = '160px',
}: ViewportMotionGateOptions = {}) => {
  const ref = useRef<T | null>(null);
  const [isInViewport, setIsInViewport] = useState(initialVisible);
  const [isInsideModalSurface, setIsInsideModalSurface] = useState(false);
  const motionRuntime = useMotionRuntime();
  const isModalOpen = useModalMotionOpen();
  const prefersReducedMotion = motionRuntime.prefersReducedMotion;
  const isPageVisible = motionRuntime.isPageVisible;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    return observeViewport(node, rootMargin, setIsInViewport);
  }, [rootMargin]);

  useEffect(() => {
    setIsInsideModalSurface(Boolean(
      isModalOpen && ref.current?.closest('[data-stats-lc-modal-surface="true"]')
    ));
  }, [isModalOpen]);

  const canAnimate = useMemo(
    () => (
      isInViewport &&
      motionRuntime.canRunMotion &&
      !prefersReducedMotion &&
      (!isModalOpen || isInsideModalSurface) &&
      (!respectPageVisibility || isPageVisible)
    ),
    [
      isInViewport,
      isInsideModalSurface,
      isModalOpen,
      isPageVisible,
      motionRuntime.canRunMotion,
      prefersReducedMotion,
      respectPageVisibility,
    ]
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
