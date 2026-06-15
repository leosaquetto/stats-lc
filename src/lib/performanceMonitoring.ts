import { motionRuntime } from './motionRuntime';

type PerformanceSample = {
  name: string;
  duration: number;
  startedAt: number;
};

const MAX_SAMPLES = 30;
const snapshot = {
  homeReadyMs: null as number | null,
  routeSettles: [] as PerformanceSample[],
  longTasks: [] as PerformanceSample[],
  longAnimationFrames: [] as PerformanceSample[],
  bootLongTasks: 0,
  postReadyLongTasks: 0,
  bootLongAnimationFrames: 0,
  postReadyLongAnimationFrames: 0,
  maxLongTaskMs: 0,
  maxLongAnimationFrameMs: 0,
};

const syncSnapshot = () => {
  if (typeof document === 'undefined') return;
  const lastRouteSettle = snapshot.routeSettles.at(-1);
  document.documentElement.dataset.statsLcHomeReadyMs = String(snapshot.homeReadyMs ?? '');
  document.documentElement.dataset.statsLcLastRouteSettle = lastRouteSettle?.name || '';
  document.documentElement.dataset.statsLcLastRouteSettleMs = String(lastRouteSettle?.duration ?? '');
  document.documentElement.dataset.statsLcLongTasks = String(snapshot.bootLongTasks + snapshot.postReadyLongTasks);
  document.documentElement.dataset.statsLcLongAnimationFrames = String(
    snapshot.bootLongAnimationFrames + snapshot.postReadyLongAnimationFrames
  );
  document.documentElement.dataset.statsLcBootLongTasks = String(snapshot.bootLongTasks);
  document.documentElement.dataset.statsLcPostReadyLongTasks = String(snapshot.postReadyLongTasks);
  document.documentElement.dataset.statsLcBootLongAnimationFrames = String(snapshot.bootLongAnimationFrames);
  document.documentElement.dataset.statsLcPostReadyLongAnimationFrames = String(snapshot.postReadyLongAnimationFrames);
  document.documentElement.dataset.statsLcMaxLongTaskMs = String(snapshot.maxLongTaskMs);
  document.documentElement.dataset.statsLcMaxLongAnimationFrameMs = String(snapshot.maxLongAnimationFrameMs);
  try {
    sessionStorage.setItem('stats-lc-performance', JSON.stringify(snapshot));
  } catch {}
  if (snapshot.homeReadyMs !== null) markDocumentHomeReady();
};

const markDocumentHomeReady = () => {
  if (typeof window === 'undefined') return;
  window.__STATS_LC_HOME_READY__ = true;
  try {
    sessionStorage.setItem('stats-lc-home-boot-ready', '1');
  } catch {}
};

const pushSample = (
  target: PerformanceSample[],
  sample: PerformanceSample,
  entryType: 'longtask' | 'long-animation-frame'
) => {
  target.push(sample);
  if (target.length > MAX_SAMPLES) target.splice(0, target.length - MAX_SAMPLES);

  const duringBoot = snapshot.homeReadyMs === null;
  if (entryType === 'longtask') {
    if (duringBoot) snapshot.bootLongTasks += 1;
    else snapshot.postReadyLongTasks += 1;
    snapshot.maxLongTaskMs = Math.max(snapshot.maxLongTaskMs, sample.duration);
  } else {
    if (duringBoot) snapshot.bootLongAnimationFrames += 1;
    else snapshot.postReadyLongAnimationFrames += 1;
    snapshot.maxLongAnimationFrameMs = Math.max(snapshot.maxLongAnimationFrameMs, sample.duration);
  }
  syncSnapshot();
};

const observeEntries = (
  entryType: 'longtask' | 'long-animation-frame',
  target: PerformanceSample[]
) => {
  if (typeof PerformanceObserver === 'undefined') return;

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        pushSample(target, {
          name: entry.name || entry.entryType,
          duration: Math.round(entry.duration * 10) / 10,
          startedAt: Math.round(entry.startTime * 10) / 10,
        }, entryType);
      });
    });
    observer.observe({ type: entryType, buffered: true } as PerformanceObserverInit);
  } catch {
    // Not every browser or WKWebView version exposes these entry types.
  }
};

export const initPerformanceMonitoring = () => {
  if (typeof window === 'undefined' || window.__STATS_LC_PERFORMANCE__) return;

  window.__STATS_LC_PERFORMANCE__ = snapshot;
  syncSnapshot();
  const startedAt = performance.now();

  window.addEventListener('stats-lc-home-ready', ((event: CustomEvent<{ ready?: boolean }>) => {
    if (event.detail?.ready !== true) {
      if (snapshot.homeReadyMs !== null) markDocumentHomeReady();
      return;
    }
    markDocumentHomeReady();
    if (snapshot.homeReadyMs !== null) return;
    snapshot.homeReadyMs = Math.round((performance.now() - startedAt) * 10) / 10;
    syncSnapshot();
  }) as EventListener);

  observeEntries('longtask', snapshot.longTasks);
  observeEntries('long-animation-frame', snapshot.longAnimationFrames);
};

export const markRouteSettle = (name: string) => {
  if (typeof window === 'undefined') return;
  const routeStartedAt = performance.now();
  let settled = false;
  let cancelFallback = () => {};
  const finish = () => {
    if (settled) return;
    settled = true;
    cancelFallback();
    const sample = {
      name,
      duration: Math.round((performance.now() - routeStartedAt) * 10) / 10,
      startedAt: Math.round(routeStartedAt * 10) / 10,
    };
    snapshot.routeSettles.push(sample);
    if (snapshot.routeSettles.length > MAX_SAMPLES) {
      snapshot.routeSettles.splice(0, snapshot.routeSettles.length - MAX_SAMPLES);
    }
    syncSnapshot();
  };

  cancelFallback = motionRuntime.scheduleTask(
    finish,
    180,
    'interaction',
    'route-settle-fallback',
  );
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(finish);
  });
};
