/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import HomeScreen from './screens/HomeScreen';
import StatsScreen from './screens/StatsScreen';
import RankingScreen from './screens/RankingScreen';
import SettingsScreen from './screens/SettingsScreen';
import AlikeScreen from './screens/AlikeScreen';
import { useStatsStore } from './store/useStatsStore';

export default function App() {
  const fetchStats = useStatsStore(s => s.fetchGroup);
  const fetchGroupLive = useStatsStore(s => s.fetchGroupLive);
  const startHeartbeat = useStatsStore(s => s.startHeartbeat);
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
    startHeartbeat();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchStats, setOffline, startHeartbeat]);

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
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/highlights" element={<StatsScreen />} />
          <Route path="/ranking" element={<RankingScreen />} />
          <Route path="/alike" element={<AlikeScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
