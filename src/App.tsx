/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import HomeScreen from './screens/HomeScreen';
import StatsScreen from './screens/StatsScreen';
import RankingScreen from './screens/RankingScreen';
import { useStatsStore } from './store/useStatsStore';

export default function App() {
  const fetchStats = useStatsStore(s => s.fetchGroup);
  const setOffline = useStatsStore(s => s.setOffline);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync across tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'stats-lc-storage' && e.newValue) {
        // Zustand handles hydration automatically
      }
    };
    window.addEventListener('storage', handleStorage);

    // Initial fetch: Always force on mount to get current status
    fetchStats(true);
    
    // Polling: Every 30s for live updates
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStats(true); // Force true to bypass server cache for live info
      }
    }, 30000); 
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
      clearInterval(id);
    };
  }, [fetchStats, setOffline]);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/stats" element={<StatsScreen />} />
          <Route path="/ranking" element={<RankingScreen />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

