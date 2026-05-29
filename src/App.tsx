/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { Layout } from './components/Layout';
import HomeScreen from './screens/HomeScreen';
import { useStatsStore } from './store/useStatsStore';
import { RefreshCcw } from 'lucide-react';

const StatsScreen = lazy(() => import('./screens/StatsScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const CircleScreen = lazy(() => import('./screens/CircleScreen'));

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

const RouteLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-[#050505] px-6 text-center">
    <div className="relative h-14 w-14 rounded-full border border-orange-500/25 bg-orange-500/10 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.22)]">
      <RefreshCcw className="h-5 w-5 text-orange-400 animate-spin" />
    </div>
    <span className="text-[10px] font-black uppercase tracking-[0.26em] text-white/55">Carregando seção</span>
  </div>
);

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

    if ((import.meta as any).env?.DEV) {
      console.error('[RouteErrorBoundary] original route render error', {
        error,
        cause: (error as any)?.cause,
        stack: error?.stack,
        componentStack: info.componentStack,
      });
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
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-2xl bg-orange-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_25px_rgba(234,88,12,0.28)] active:scale-95"
        >
          {this.state.chunkError ? 'Atualizar app' : 'Tentar novamente'}
        </button>
      </div>
    );
  }
}

function AppRoutes() {
  const location = useLocation();

  return (
    <RouteErrorBoundary routeKey={location.pathname} key={location.pathname}>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/highlights" element={<StatsScreen />} />
          <Route path="/circle" element={<CircleScreen initialTab="ranking" />} />
          <Route path="/ranking" element={<CircleScreen initialTab="ranking" />} />
          <Route path="/alike" element={<CircleScreen initialTab="affinity" />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  const fetchStats = useStatsStore(s => s.fetchGroup);
  const fetchGroupLive = useStatsStore(s => s.fetchGroupLive);
  const setOffline = useStatsStore(s => s.setOffline);
  const pushNotificationsEnabled = useStatsStore(s => s.pushNotificationsEnabled);
  const pollingFrequency = useStatsStore(s => s.pollingFrequency);

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

    fetchStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchStats, setOffline]);

  useEffect(() => {
    const safePollingFrequency = Math.max(8, pollingFrequency);
    const intervalTime = safePollingFrequency * 1000;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' || pushNotificationsEnabled) {
        fetchGroupLive();
      }
    }, intervalTime);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchGroupLive(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchGroupLive, pushNotificationsEnabled, pollingFrequency]);

  return (
    <HashRouter>
      <Layout>
        <AppRoutes />
      </Layout>
    </HashRouter>
  );
}
