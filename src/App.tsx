/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Layout } from './components/Layout';
import HomeScreen from './screens/HomeScreen';
import { useStatsStore } from './store/useStatsStore';
import { RefreshCcw } from 'lucide-react';

const StatsScreen = lazy(() => import('./screens/StatsScreen'));
const RankingScreen = lazy(() => import('./screens/RankingScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const AlikeScreen = lazy(() => import('./screens/AlikeScreen'));

const RouteLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-[#050505] px-6 text-center">
    <div className="relative h-14 w-14 rounded-full border border-orange-500/25 bg-orange-500/10 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.22)]">
      <RefreshCcw className="h-5 w-5 text-orange-400 animate-spin" />
    </div>
    <span className="text-[10px] font-black uppercase tracking-[0.26em] text-white/55">Carregando seção</span>
  </div>
);

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
        fetchGroupLive(true);
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
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/highlights" element={<StatsScreen />} />
            <Route path="/ranking" element={<RankingScreen />} />
            <Route path="/alike" element={<AlikeScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<HomeScreen />} />
          </Routes>
        </Suspense>
      </Layout>
    </HashRouter>
  );
}
