type MotionRuntimeTier = 'full' | 'balanced' | 'conserve';

export type MotionRuntimeSnapshot = {
  canRunMotion: boolean;
  fps: 15 | 30 | 60;
  isPageVisible: boolean;
  prefersReducedMotion: boolean;
  saveData: boolean;
  tier: MotionRuntimeTier;
};

type MotionRuntimeListener = () => void;
type MotionFrameListener = (frame: { deltaMs: number; fps: MotionRuntimeSnapshot['fps']; now: number; tier: MotionRuntimeTier }) => void;
type NavigatorConnection = {
  addEventListener?: (type: 'change', listener: () => void) => void;
  effectiveType?: string;
  saveData?: boolean;
};

const listeners = new Set<MotionRuntimeListener>();
const frameListeners = new Set<MotionFrameListener>();
const longTaskWindow: number[] = [];
const loafWindow: number[] = [];
const PRESSURE_WINDOW_MS = 6_000;

let mediaQuery: MediaQueryList | null = null;
let snapshot: MotionRuntimeSnapshot = {
  canRunMotion: true,
  fps: 60,
  isPageVisible: true,
  prefersReducedMotion: false,
  saveData: false,
  tier: 'full',
};
let initialized = false;
let rafId: number | null = null;
let lastFrameAt = 0;
let lastEmitAt = 0;
let pressureDecayTimer: number | null = null;

const getConnection = () => (
  typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { connection?: NavigatorConnection }).connection
);

const prunePressure = (now: number) => {
  while (longTaskWindow.length && now - longTaskWindow[0] > PRESSURE_WINDOW_MS) longTaskWindow.shift();
  while (loafWindow.length && now - loafWindow[0] > PRESSURE_WINDOW_MS) loafWindow.shift();
};

const computeSnapshot = (): MotionRuntimeSnapshot => {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  prunePressure(now);

  const isPageVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const prefersReducedMotion = mediaQuery?.matches ?? false;
  const connection = getConnection();
  const saveData = Boolean(connection?.saveData);
  const weakConnection = connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';
  const pressureScore = longTaskWindow.length + loafWindow.length * 0.6;
  const tier: MotionRuntimeTier = prefersReducedMotion || saveData || weakConnection || pressureScore >= 18
    ? 'conserve'
    : pressureScore >= 7
      ? 'balanced'
      : 'full';
  const canRunMotion = isPageVisible && !prefersReducedMotion;
  const fps = tier === 'full' ? 60 : tier === 'balanced' ? 30 : 15;

  return {
    canRunMotion,
    fps,
    isPageVisible,
    prefersReducedMotion,
    saveData,
    tier,
  };
};

const snapshotsEqual = (a: MotionRuntimeSnapshot, b: MotionRuntimeSnapshot) => (
  a.canRunMotion === b.canRunMotion &&
  a.fps === b.fps &&
  a.isPageVisible === b.isPageVisible &&
  a.prefersReducedMotion === b.prefersReducedMotion &&
  a.saveData === b.saveData &&
  a.tier === b.tier
);

const syncDataset = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const nextEnabled = snapshot.canRunMotion ? 'true' : 'false';
  const nextFps = String(snapshot.fps);
  if (root.dataset.statsLcMotionTier !== snapshot.tier) root.dataset.statsLcMotionTier = snapshot.tier;
  if (root.dataset.statsLcMotionFps !== nextFps) root.dataset.statsLcMotionFps = nextFps;
  if (root.dataset.statsLcMotionEnabled !== nextEnabled) root.dataset.statsLcMotionEnabled = nextEnabled;
};

const emit = () => {
  const nextSnapshot = computeSnapshot();
  if (snapshotsEqual(snapshot, nextSnapshot)) return;
  snapshot = nextSnapshot;
  syncDataset();
  listeners.forEach((listener) => listener());
};

const schedulePressureDecay = () => {
  if (typeof window === 'undefined') return;
  if (pressureDecayTimer !== null) window.clearTimeout(pressureDecayTimer);

  pressureDecayTimer = window.setTimeout(() => {
    pressureDecayTimer = null;
    emit();
    if (longTaskWindow.length || loafWindow.length) schedulePressureDecay();
    if (snapshot.canRunMotion) ensureFrameLoop();
  }, PRESSURE_WINDOW_MS + 80);
};

const recordPressure = (entryType: 'long-animation-frame' | 'longtask') => {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (entryType === 'longtask') longTaskWindow.push(now);
  else loafWindow.push(now);
  emit();
  schedulePressureDecay();
};

const setupObservers = () => {
  if (typeof PerformanceObserver === 'undefined') return;

  try {
    new PerformanceObserver((list) => {
      list.getEntries().forEach(() => recordPressure('longtask'));
    }).observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
  } catch {}

  try {
    new PerformanceObserver((list) => {
      list.getEntries().forEach(() => recordPressure('long-animation-frame'));
    }).observe({ type: 'long-animation-frame', buffered: true } as PerformanceObserverInit);
  } catch {}
};

const frameLoop = (now: number) => {
  rafId = null;
  if (!frameListeners.size || !snapshot.canRunMotion) return;

  const minDelta = 1000 / snapshot.fps;
  if (!lastFrameAt) lastFrameAt = now;
  if (now - lastEmitAt >= minDelta) {
    const deltaMs = now - lastFrameAt;
    lastFrameAt = now;
    lastEmitAt = now;
    const frame = { deltaMs, fps: snapshot.fps, now, tier: snapshot.tier };
    frameListeners.forEach((listener) => listener(frame));
  }

  rafId = window.requestAnimationFrame(frameLoop);
};

const ensureFrameLoop = () => {
  if (typeof window === 'undefined' || rafId !== null || !frameListeners.size || !snapshot.canRunMotion) return;
  rafId = window.requestAnimationFrame(frameLoop);
};

export const initMotionRuntime = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  snapshot = computeSnapshot();
  syncDataset();

  document.addEventListener('visibilitychange', () => {
    emit();
    if (snapshot.canRunMotion) ensureFrameLoop();
  });
  mediaQuery?.addEventListener?.('change', emit);
  getConnection()?.addEventListener?.('change', emit);
  setupObservers();
};

export const motionRuntime = {
  getSnapshot: () => snapshot,
  subscribe: (listener: MotionRuntimeListener) => {
    initMotionRuntime();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  subscribeFrame: (listener: MotionFrameListener) => {
    initMotionRuntime();
    frameListeners.add(listener);
    ensureFrameLoop();
    return () => {
      frameListeners.delete(listener);
      if (!frameListeners.size && rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
        lastFrameAt = 0;
        lastEmitAt = 0;
      }
    };
  },
  shouldRunAmbient: (priority: 'ambient' | 'focus' = 'ambient') => (
    snapshot.canRunMotion && (priority === 'focus' || snapshot.tier !== 'conserve')
  ),
};
