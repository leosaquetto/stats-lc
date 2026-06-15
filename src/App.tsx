/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, useLocation } from 'react-router-dom';
import { Activity, Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStatsStore } from './store/useStatsStore';
import { RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { EngineSpinner } from './components/shared/CommonUI';
import {
  loadCircleScreen,
  loadHomeScreen,
  loadSettingsScreen,
  loadStatsScreen,
} from './lib/routePreloads';
import { useMotionRuntime } from './hooks/useMotionRuntime';
import { motionRuntime as motionRuntimeScheduler } from './lib/motionRuntime';
import { markRouteSettle } from './lib/performanceMonitoring';

const HomeScreen = lazy(loadHomeScreen);
const StatsScreen = lazy(loadStatsScreen);
const SettingsScreen = lazy(loadSettingsScreen);
const CircleScreen = lazy(loadCircleScreen);

const waitForInteractionTask = (delayMs: number) => new Promise<void>((resolve) => {
  motionRuntimeScheduler.scheduleTask(resolve, delayMs, 'interaction', 'secondary-route-preload-gap');
});

const preloadSecondaryRoutes = async (isCancelled: () => boolean) => {
  const loaders = [loadStatsScreen, loadCircleScreen, loadSettingsScreen];
  for (const load of loaders) {
    if (isCancelled() || document.visibilityState !== 'visible') return;
    await load().catch(() => undefined);
    await waitForInteractionTask(140);
  }
};

const CHUNK_RELOAD_KEY = 'stats-lc-chunk-reload-attempted';

const isChunkLoadError = (error: unknown) => {
  const message = [
    error instanceof Error ? error.message : String(error || ''),
    error instanceof Error ? error.stack : '',
  ].join(' ');

  return [
    'Failed to fetch dynamically imported module',
    'Importing a module script failed',
    'Loading chunk failed',
  ].some((needle) => message.includes(needle));
};

const ROUTE_LOADER_REVEAL_MS = 320;

const RouteLoader = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const cancelReveal = motionRuntimeScheduler.scheduleTask(
      () => setIsVisible(true),
      ROUTE_LOADER_REVEAL_MS,
      'interaction',
      'route-loader-reveal',
    );
    return () => cancelReveal();
  }, []);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      data-stats-lc-route-loader="true"
      className="pointer-events-none fixed inset-0 z-[44] flex h-[100svh] min-h-[100svh] w-screen min-w-0 flex-col items-center justify-center gap-4 overflow-hidden bg-black px-6 pb-[calc(env(safe-area-inset-bottom,0px)+108px)] pt-[max(env(safe-area-inset-top),40px)] text-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, delay: 0.03, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-center gap-4"
      >
        <div className="ranking-badge relative flex h-14 min-w-14 items-center justify-center rounded-[22px] border border-orange-500/35 bg-orange-500/[0.16] px-4 shadow-[0_0_32px_rgba(249,115,22,0.24),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <EngineSpinner className="h-5 w-5 text-orange-300">
            <RefreshCcw className="h-full w-full" />
          </EngineSpinner>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.26em] text-orange-200/70">Carregando seção</span>
      </motion.div>
    </motion.div>
  );
};

class RouteErrorBoundary extends Component<
  { children: ReactNode; routeKey: string },
  { hasError: boolean; chunkError: boolean }
> {
  state = { hasError: false, chunkError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { routeKey: string }) {
    if (prevProps.routeKey !== this.props.routeKey && this.state.hasError) {
      this.setState({ hasError: false, chunkError: false });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const chunkError = isChunkLoadError(error);

    // Log crítico em produção para diagnóstico de PWA
    console.error('[RouteErrorBoundary] Route render error', {
      message: error?.message,
      name: error?.name,
      pathname: window.location.pathname,
      hash: window.location.hash,
      timestamp: new Date().toISOString(),
      chunkError,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'), // Primeiras 3 linhas
      componentStack: info.componentStack?.split('\n').slice(0, 5).join('\n'), // Primeiras 5 linhas do component stack
    });

    if ((import.meta as any).env?.DEV) {
      console.error('[RouteErrorBoundary] Full error details', {
        error,
        cause: (error as any)?.cause,
        stack: error?.stack,
        componentStack: info.componentStack,
      });
    }

    // Salvar erro para diagnóstico
    try {
      const diagnosticData = {
        message: error?.message,
        name: error?.name,
        pathname: window.location.pathname,
        hash: window.location.hash,
        timestamp: new Date().toISOString(),
        chunkError,
        stackPreview: error?.stack?.split('\n').slice(0, 3).join('\n'),
        componentStackPreview: info.componentStack?.split('\n').slice(0, 5).join('\n'),
      };
      sessionStorage.setItem('stats-lc-last-error', JSON.stringify(diagnosticData, null, 2));
    } catch (e) {
      // Ignorar se sessionStorage falhar
    }

    if (chunkError) {
      const hasTriedReload = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
      if (!hasTriedReload) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return;
      }
    }

    this.setState({ chunkError });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const copyDiagnostics = () => {
      try {
        const lastError = sessionStorage.getItem('stats-lc-last-error');
        const diagnostics = lastError || JSON.stringify({
          message: 'Erro desconhecido',
          pathname: window.location.pathname,
          timestamp: new Date().toISOString(),
        });
        navigator.clipboard.writeText(diagnostics);
        alert('Diagnóstico copiado!');
      } catch (e) {
        alert('Não foi possível copiar');
      }
    };

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 bg-[#050505] px-6 text-center">
        <div className="relative h-14 w-14 rounded-full border border-orange-500/25 bg-orange-500/10 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.22)]">
          <RefreshCcw className="h-5 w-5 text-orange-400" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white/85">
            {this.state.chunkError ? 'Atualize para abrir a seção' : 'Não foi possível abrir a seção'}
          </h1>
          <p className="max-w-xs text-xs font-medium leading-relaxed text-white/45">
            {this.state.chunkError
              ? 'A versão do app mudou enquanto esta seção carregava.'
              : 'Recarregue o app para tentar montar a tela novamente.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-orange-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_25px_rgba(234,88,12,0.28)] active:scale-95"
          >
            {this.state.chunkError ? 'Atualizar app' : 'Tentar novamente'}
          </button>
          <button
            type="button"
            onClick={copyDiagnostics}
            className="rounded-2xl bg-white/5 px-5 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/60 active:scale-95"
          >
            Copiar diagnóstico
          </button>
        </div>
      </div>
    );
  }
}

const PersistentRouteScene = ({
  id,
  active,
  shouldAnimate,
  children,
}: {
  id: string;
  active: boolean;
  shouldAnimate: boolean;
  children: ReactNode;
}) => (
  <div
    data-stats-lc-route-shell={id}
    data-stats-lc-route-active={active ? 'true' : 'false'}
    aria-hidden={active ? undefined : true}
    className="contents"
  >
    <Suspense fallback={active ? <RouteLoader /> : null}>
      <Activity mode={active ? 'visible' : 'hidden'}>
        <motion.div
          data-stats-lc-route-scene={id}
          className="w-full min-w-0"
          initial={false}
          animate={{ opacity: active ? 1 : 0, x: active ? 0 : id === 'home' ? -6 : 8 }}
          transition={{ duration: shouldAnimate ? 0.22 : 0.01, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </Activity>
    </Suspense>
  </div>
);

function AppRoutes() {
  const location = useLocation();
  const motionRuntime = useMotionRuntime();
  const shouldAnimateRoute = motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve';
  const routeKey = `${location.pathname}${location.search}`;
  const isStatsRoute = location.pathname === '/stats' || location.pathname === '/highlights';
  const isCircleRoute = location.pathname === '/circle' || location.pathname === '/ranking' || location.pathname === '/alike';
  const isSettingsRoute = location.pathname === '/settings';
  const isHomeRoute = !isStatsRoute && !isCircleRoute && !isSettingsRoute;
  const circleInitialTab = location.pathname === '/ranking'
    ? 'arena'
    : location.pathname === '/alike'
      ? 'affinity'
      : 'now';

  useEffect(() => {
    markRouteSettle(window.location.hash || '#/');
  }, [routeKey]);

  return (
    <RouteErrorBoundary routeKey={routeKey}>
      <PersistentRouteScene id="home" active={isHomeRoute} shouldAnimate={shouldAnimateRoute}>
        <HomeScreen />
      </PersistentRouteScene>
      <PersistentRouteScene id="stats" active={isStatsRoute} shouldAnimate={shouldAnimateRoute}>
        <StatsScreen />
      </PersistentRouteScene>
      <PersistentRouteScene id="circle" active={isCircleRoute} shouldAnimate={shouldAnimateRoute}>
        <CircleScreen initialTab={circleInitialTab} />
      </PersistentRouteScene>
      <PersistentRouteScene id="settings" active={isSettingsRoute} shouldAnimate={shouldAnimateRoute}>
        <SettingsScreen />
      </PersistentRouteScene>
    </RouteErrorBoundary>
  );
}

function LiveProbePoller() {
  const location = useLocation();
  const featuredUserId = useStatsStore(s => s.featuredUserId);
  const fetchLiveProbe = useStatsStore(s => s.fetchLiveProbe);
  const fetchGroupLive = useStatsStore(s => s.fetchGroupLive);

  useEffect(() => {
    if (location.pathname !== '/' || !featuredUserId) return;

    let cancelled = false;
    let timer = 0;
    let consecutiveErrors = 0;
    let inFlight = false;
    const delays = [8000, 15000, 30000];

    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      if (!cancelled) timer = window.setTimeout(run, delay);
    };

    const run = async () => {
      if (cancelled || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const changed = await fetchLiveProbe(featuredUserId);
        consecutiveErrors = 0;
        if (changed) {
          fetchGroupLive(false, { bypassThrottle: true }).catch(() => undefined);
        }
        schedule(delays[0]);
      } catch {
        consecutiveErrors += 1;
        schedule(delays[Math.min(consecutiveErrors - 1, delays.length - 1)]);
      } finally {
        inFlight = false;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void run();
      else window.clearTimeout(timer);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    void run();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [featuredUserId, fetchGroupLive, fetchLiveProbe, location.pathname]);

  return null;
}

export default function App() {
  const fetchStats = useStatsStore(s => s.fetchGroup);
  const fetchGroupLive = useStatsStore(s => s.fetchGroupLive);
  const setOffline = useStatsStore(s => s.setOffline);
  const pollingFrequency = useStatsStore(s => s.pollingFrequency);
  const [initialBootSettled, setInitialBootSettled] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'stats-lc-storage') {
        fetchStats();
      }
    };
    window.addEventListener('storage', handleStorage);

    let cancelled = false;
    let cancelSettleSplash = () => {};
    const minVisibleUntil = Date.now() + 650;
    const settleSplash = () => {
      const delay = Math.max(0, minVisibleUntil - Date.now());
      cancelSettleSplash();
      cancelSettleSplash = motionRuntimeScheduler.scheduleTask(() => {
        if (!cancelled) setInitialBootSettled(true);
      }, delay, 'interaction');
    };

    fetchStats().then(settleSplash).catch(settleSplash);

    return () => {
      cancelled = true;
      cancelSettleSplash();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchStats, setOffline]);

  useEffect(() => {
    if (!initialBootSettled) return;

    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || connection?.effectiveType === '2g') return;

    let cancelled = false;
    let cancelPreloadSchedule = () => {};
    let idleId: number | null = null;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const run = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      preloadSecondaryRoutes(() => cancelled).catch(() => undefined);
    };
    const schedule = () => {
      if (cancelled || idleId !== null) return;
      cancelPreloadSchedule();
      cancelPreloadSchedule = motionRuntimeScheduler.scheduleTask(() => {
        cancelPreloadSchedule = () => {};
        if (idleWindow.requestIdleCallback) {
          idleId = idleWindow.requestIdleCallback(run, { timeout: 5000 });
        } else {
          run();
        }
      }, 700, 'ambient', 'secondary-route-preload');
    };
    const handleHomeReady = (event: Event) => {
      if ((event as CustomEvent<{ ready?: boolean }>).detail?.ready === true) schedule();
    };

    if (window.__STATS_LC_HOME_READY__ === true) schedule();
    else window.addEventListener('stats-lc-home-ready', handleHomeReady);

    return () => {
      cancelled = true;
      window.removeEventListener('stats-lc-home-ready', handleHomeReady);
      cancelPreloadSchedule();
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
    };
  }, [initialBootSettled]);

  useEffect(() => {
    if (!initialBootSettled) return;
    const hash = window.location.hash || '#/';
    if (hash === '#/' || hash === '' || hash === '#') return;
    let dismissed = false;
    const dismissSplash = () => {
      if (dismissed) return;
      dismissed = true;
      window.__STATS_LC_DISMISS_SPLASH__?.();
    };
    if (document.visibilityState === 'hidden') {
      dismissSplash();
      return;
    }

    const cancelHiddenTabFallback = motionRuntimeScheduler.scheduleTask(dismissSplash, 280, 'interaction');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        cancelHiddenTabFallback();
        dismissSplash();
      });
    });
    return () => cancelHiddenTabFallback();
  }, [initialBootSettled]);

  useEffect(() => {
    const safePollingFrequency = Math.max(25, pollingFrequency);
    const intervalTime = safePollingFrequency * 1000;
    let cancelled = false;
    let running = false;
    let timer = 0;

    const scheduleNext = () => {
      window.clearTimeout(timer);
      if (cancelled || document.visibilityState !== 'visible') return;
      timer = window.setTimeout(() => {
        void runPoll();
      }, intervalTime);
    };

    const runPoll = async (refreshImmediately = true) => {
      if (cancelled || running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        await fetchGroupLive(refreshImmediately);
      } finally {
        running = false;
        scheduleNext();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runPoll(false);
      } else {
        window.clearTimeout(timer);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleNext();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchGroupLive, pollingFrequency]);

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;

    import('./lib/nativeLifecycle')
      .then(({ setupNativeLifecycle }) => setupNativeLifecycle(() => {
        fetchGroupLive(false, { bypassThrottle: true });
      }))
      .then((removeListeners) => {
        if (cancelled) removeListeners();
        else cleanup = removeListeners;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [fetchGroupLive]);

  return (
    <ErrorBoundary>
      <HashRouter>
        <LiveProbePoller />
        <Layout>
          <AppRoutes />
        </Layout>
      </HashRouter>
    </ErrorBoundary>
  );
}
