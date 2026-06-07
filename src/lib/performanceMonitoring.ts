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
};

const syncSnapshot = () => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.statsLcHomeReadyMs = String(snapshot.homeReadyMs ?? '');
  document.documentElement.dataset.statsLcLongTasks = String(snapshot.longTasks.length);
  document.documentElement.dataset.statsLcLongAnimationFrames = String(snapshot.longAnimationFrames.length);
  try {
    sessionStorage.setItem('stats-lc-performance', JSON.stringify(snapshot));
  } catch {}
};

const pushSample = (target: PerformanceSample[], sample: PerformanceSample) => {
  target.push(sample);
  if (target.length > MAX_SAMPLES) target.splice(0, target.length - MAX_SAMPLES);
  syncSnapshot();
};

const observeEntries = (entryType: string, target: PerformanceSample[]) => {
  if (typeof PerformanceObserver === 'undefined') return;

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        pushSample(target, {
          name: entry.name || entry.entryType,
          duration: Math.round(entry.duration * 10) / 10,
          startedAt: Math.round(entry.startTime * 10) / 10,
        });
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
    if (event.detail?.ready !== true || snapshot.homeReadyMs !== null) return;
    snapshot.homeReadyMs = Math.round((performance.now() - startedAt) * 10) / 10;
    syncSnapshot();
  }) as EventListener);

  window.addEventListener('hashchange', () => {
    const routeStartedAt = performance.now();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        pushSample(snapshot.routeSettles, {
          name: window.location.hash || '#/',
          duration: Math.round((performance.now() - routeStartedAt) * 10) / 10,
          startedAt: Math.round(routeStartedAt * 10) / 10,
        });
      });
    });
  });

  observeEntries('longtask', snapshot.longTasks);
  observeEntries('long-animation-frame', snapshot.longAnimationFrames);
};
