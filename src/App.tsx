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
import SettingsScreen from './screens/SettingsScreen';
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
    
    // Polling: Every 60s for live updates
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStats(false); // Force false para não estourar o backend em polling
      }
    }, 60000); 
    
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
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

