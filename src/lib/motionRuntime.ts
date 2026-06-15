export type MotionRuntimeTier = 'full' | 'balanced' | 'conserve';
export type MotionRuntimeFps = 30 | 60 | 120;
export type MotionFramePriority = 'critical' | 'interaction' | 'ambient';

export type MotionRuntimeSnapshot = {
  canRunMotion: boolean;
  displayFps: 60 | 120;
  fps: MotionRuntimeFps;
  isPageVisible: boolean;
  prefersReducedMotion: boolean;
  saveData: boolean;
  tier: MotionRuntimeTier;
};

type MotionRuntimeListener = () => void;
type MotionFrameListener = (frame: { deltaMs: number; fps: MotionRuntimeSnapshot['fps']; now: number; tier: MotionRuntimeTier }) => void;
type MotionFrameSubscriptionOptions = {
  maxFps?: MotionRuntimeFps;
  priority?: MotionFramePriority;
};
type MotionFrameSubscription = Required<MotionFrameSubscriptionOptions> & {
  lastRunAt: number;
  listener: MotionFrameListener;
};
type ScheduledMotionTask = {
  callback: () => void;
  id: number;
  kind: string;
  priority: MotionFramePriority;
  runAt: number;
};
type NavigatorConnection = {
  addEventListener?: (type: 'change', listener: () => void) => void;
  effectiveType?: string;
  saveData?: boolean;
};

const listeners = new Set<MotionRuntimeListener>();
const frameSubscriptions = new Map<MotionFrameListener, MotionFrameSubscription>();
const scheduledTasks = new Map<number, ScheduledMotionTask>();
const compositorLoops = new Map<number, string>();
const longTaskWindow: number[] = [];
const loafWindow: number[] = [];
const PRESSURE_WINDOW_MS = 6_000;
const FRAME_PRIORITY_WEIGHT: Record<MotionFramePriority, number> = {
  critical: 0,
  interaction: 1,
  ambient: 2,
};

let mediaQuery: MediaQueryList | null = null;
let snapshot: MotionRuntimeSnapshot = {
  canRunMotion: true,
  displayFps: 60,
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
let measuredDisplayFps: MotionRuntimeSnapshot['displayFps'] = 60;
let lastSchedulerCostMs = 0;
let maxSchedulerCostMs = 0;
let lastSchedulerDatasetSyncAt = 0;
let lastPressureScore = 0;
let displayRateMeasured = false;
let scheduledTaskId = 0;
let scheduledTaskTimer: number | null = null;
let compositorLoopId = 0;

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
  const pressureScore = longTaskWindow.length * 0.7 + loafWindow.length * 0.45;
  lastPressureScore = Math.round(pressureScore * 10) / 10;
  const tier: MotionRuntimeTier = prefersReducedMotion || saveData || weakConnection || pressureScore >= 14
    ? 'conserve'
    : pressureScore >= 5
      ? 'balanced'
      : 'full';
  const canRunMotion = isPageVisible && !prefersReducedMotion;
  const fps: MotionRuntimeFps = tier === 'full'
    ? measuredDisplayFps
    : tier === 'balanced'
      ? 60
      : 30;

  return {
    canRunMotion,
    displayFps: measuredDisplayFps,
    fps,
    isPageVisible,
    prefersReducedMotion,
    saveData,
    tier,
  };
};

const snapshotsEqual = (a: MotionRuntimeSnapshot, b: MotionRuntimeSnapshot) => (
  a.canRunMotion === b.canRunMotion &&
  a.displayFps === b.displayFps &&
  a.fps === b.fps &&
  a.isPageVisible === b.isPageVisible &&
  a.prefersReducedMotion === b.prefersReducedMotion &&
  a.saveData === b.saveData &&
  a.tier === b.tier
);

const getScheduledTaskKinds = () => (
  [...scheduledTasks.values()].reduce<Record<string, number>>((counts, task) => {
    counts[task.kind] = (counts[task.kind] || 0) + 1;
    return counts;
  }, {})
);

const getCompositorLoopKinds = () => (
  [...compositorLoops.values()].reduce<Record<string, number>>((counts, kind) => {
    counts[kind] = (counts[kind] || 0) + 1;
    return counts;
  }, {})
);

const syncDataset = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const nextEnabled = snapshot.canRunMotion ? 'true' : 'false';
  const nextFps = String(snapshot.fps);
  if (root.dataset.statsLcMotionTier !== snapshot.tier) root.dataset.statsLcMotionTier = snapshot.tier;
  if (root.dataset.statsLcMotionFps !== nextFps) root.dataset.statsLcMotionFps = nextFps;
  if (root.dataset.statsLcDisplayFps !== String(snapshot.displayFps)) root.dataset.statsLcDisplayFps = String(snapshot.displayFps);
  if (root.dataset.statsLcMotionEnabled !== nextEnabled) root.dataset.statsLcMotionEnabled = nextEnabled;
  root.dataset.statsLcMotionListeners = String(frameSubscriptions.size);
  root.dataset.statsLcMotionTasks = String(scheduledTasks.size);
  root.dataset.statsLcMotionTaskKinds = Object.entries(getScheduledTaskKinds())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => `${kind}:${count}`)
    .join(',');
  root.dataset.statsLcCompositorLoops = String(compositorLoops.size);
  root.dataset.statsLcCompositorLoopKinds = Object.entries(getCompositorLoopKinds())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => `${kind}:${count}`)
    .join(',');
  root.dataset.statsLcMotionPressure = String(lastPressureScore);
  root.dataset.statsLcRecentLoaf = String(loafWindow.length);
  root.dataset.statsLcRecentLongTasks = String(longTaskWindow.length);
  root.dataset.statsLcMotionFrameCostMs = String(Math.round(lastSchedulerCostMs * 100) / 100);
  root.dataset.statsLcMotionMaxFrameCostMs = String(Math.round(maxSchedulerCostMs * 100) / 100);
};

const scheduleNextTask = () => {
  if (typeof window === 'undefined') return;
  if (scheduledTaskTimer !== null) window.clearTimeout(scheduledTaskTimer);
  scheduledTaskTimer = null;
  if (!scheduledTasks.size) return;

  const nextRunAt = Math.min(...[...scheduledTasks.values()].map((task) => task.runAt));
  scheduledTaskTimer = window.setTimeout(runScheduledTasks, Math.max(0, nextRunAt - performance.now()));
};

const runScheduledTasks = () => {
  scheduledTaskTimer = null;
  const now = performance.now();
  const dueTasks = [...scheduledTasks.values()]
    .filter((task) => task.runAt <= now + 1)
    .sort((a, b) => FRAME_PRIORITY_WEIGHT[a.priority] - FRAME_PRIORITY_WEIGHT[b.priority]);

  dueTasks.forEach((task) => {
    scheduledTasks.delete(task.id);
    if (task.priority === 'ambient' && (!snapshot.canRunMotion || snapshot.tier === 'conserve')) return;
    task.callback();
  });

  syncDataset();
  scheduleNextTask();
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
  if (!frameSubscriptions.size || !snapshot.canRunMotion) return;

  const minDelta = 1000 / snapshot.fps;
  if (!lastFrameAt) lastFrameAt = now;
  if (now - lastEmitAt >= minDelta) {
    const schedulerStartedAt = performance.now();
    const runtimeDeltaMs = now - lastFrameAt;
    lastFrameAt = now;
    lastEmitAt = now;
    const frameBudgetMs = minDelta * 0.62;
    const subscriptions = [...frameSubscriptions.values()].sort(
      (a, b) => FRAME_PRIORITY_WEIGHT[a.priority] - FRAME_PRIORITY_WEIGHT[b.priority]
    );

    subscriptions.forEach((subscription) => {
      if (snapshot.tier === 'conserve' && subscription.priority === 'ambient') return;
      if (performance.now() - schedulerStartedAt >= frameBudgetMs && subscription.priority !== 'critical') return;

      const targetFps = Math.min(snapshot.fps, subscription.maxFps) as MotionRuntimeFps;
      const listenerMinDelta = 1000 / targetFps;
      if (subscription.lastRunAt && now - subscription.lastRunAt < listenerMinDelta - 0.5) return;

      const deltaMs = subscription.lastRunAt ? now - subscription.lastRunAt : runtimeDeltaMs;
      subscription.lastRunAt = now;
      subscription.listener({ deltaMs, fps: targetFps, now, tier: snapshot.tier });
    });

    lastSchedulerCostMs = performance.now() - schedulerStartedAt;
    maxSchedulerCostMs = Math.max(maxSchedulerCostMs, lastSchedulerCostMs);
    if (now - lastSchedulerDatasetSyncAt >= 500) {
      lastSchedulerDatasetSyncAt = now;
      syncDataset();
    }
  }

  rafId = window.requestAnimationFrame(frameLoop);
};

const ensureFrameLoop = () => {
  if (typeof window === 'undefined' || rafId !== null || !frameSubscriptions.size || !snapshot.canRunMotion) return;
  rafId = window.requestAnimationFrame(frameLoop);
};

const measureDisplayRefreshRate = () => {
  if (typeof window === 'undefined' || document.visibilityState === 'hidden' || displayRateMeasured) return;

  const samples: number[] = [];
  let previousAt = 0;
  const sample = (now: number) => {
    if (document.visibilityState === 'hidden') return;
    if (previousAt) {
      const delta = now - previousAt;
      if (delta > 4 && delta < 30) samples.push(delta);
    }
    previousAt = now;

    if (samples.length < 24) {
      window.requestAnimationFrame(sample);
      return;
    }

    samples.sort((a, b) => a - b);
    const medianDelta = samples[Math.floor(samples.length / 2)] || 16.67;
    measuredDisplayFps = medianDelta <= 10.5 ? 120 : 60;
    displayRateMeasured = true;
    emit();
    ensureFrameLoop();
  };

  window.requestAnimationFrame(sample);
};

export const initMotionRuntime = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  snapshot = computeSnapshot();
  syncDataset();

  document.addEventListener('visibilitychange', () => {
    emit();
    if (snapshot.canRunMotion) {
      measureDisplayRefreshRate();
      ensureFrameLoop();
    }
  });
  mediaQuery?.addEventListener?.('change', emit);
  getConnection()?.addEventListener?.('change', emit);
  setupObservers();
  measureDisplayRefreshRate();
};

export const motionRuntime = {
  getSnapshot: () => snapshot,
  subscribe: (listener: MotionRuntimeListener) => {
    initMotionRuntime();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  subscribeFrame: (listener: MotionFrameListener, options: MotionFrameSubscriptionOptions = {}) => {
    initMotionRuntime();
    frameSubscriptions.set(listener, {
      lastRunAt: 0,
      listener,
      maxFps: options.maxFps ?? 120,
      priority: options.priority ?? 'interaction',
    });
    syncDataset();
    ensureFrameLoop();
    return () => {
      frameSubscriptions.delete(listener);
      syncDataset();
      if (!frameSubscriptions.size && rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
        lastFrameAt = 0;
        lastEmitAt = 0;
      }
    };
  },
  scheduleTask: (
    callback: () => void,
    delayMs: number,
    priority: MotionFramePriority = 'interaction',
    kind = 'task',
  ) => {
    initMotionRuntime();
    const id = ++scheduledTaskId;
    scheduledTasks.set(id, {
      callback,
      id,
      kind,
      priority,
      runAt: performance.now() + Math.max(0, delayMs),
    });
    syncDataset();
    scheduleNextTask();
    return () => {
      if (!scheduledTasks.delete(id)) return;
      syncDataset();
      scheduleNextTask();
    };
  },
  registerCompositorLoop: (kind: string) => {
    initMotionRuntime();
    const id = ++compositorLoopId;
    compositorLoops.set(id, kind);
    syncDataset();
    return () => {
      if (!compositorLoops.delete(id)) return;
      syncDataset();
    };
  },
  getSchedulerStats: () => ({
    compositorLoopKinds: getCompositorLoopKinds(),
    compositorLoops: compositorLoops.size,
    displayFps: snapshot.displayFps,
    listeners: frameSubscriptions.size,
    maxSchedulerCostMs,
    schedulerCostMs: lastSchedulerCostMs,
    taskKinds: getScheduledTaskKinds(),
    tasks: scheduledTasks.size,
    targetFps: snapshot.fps,
  }),
  shouldRunAmbient: (priority: 'ambient' | 'focus' = 'ambient') => (
    snapshot.canRunMotion && (priority === 'focus' || snapshot.tier !== 'conserve')
  ),
};
