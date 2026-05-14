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
  const fetchStats = useStatsStore(s => s.fetchGroupStats);
  const setOffline = useStatsStore(s => s.setOffline);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    fetchStats(true);
    const id = setInterval(() => fetchStats(true), 60000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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

