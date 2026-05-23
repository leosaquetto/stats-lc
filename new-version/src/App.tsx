/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import HomeScreen from './screens/HomeScreen';
import StatsScreen from './screens/StatsScreen';
import RankingScreen from './screens/RankingScreen';
import SettingsScreen from './screens/SettingsScreen';
import AlikeScreen from './screens/AlikeScreen';
import { useStatsStore } from './store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { SmartImage } from './components/shared/CommonUI';
import { coreUtils } from './services/statsCore';
import { clsx } from 'clsx';
import { Users } from 'lucide-react';

export default function App() {
  const fetchStats = useStatsStore(s => s.fetchGroup);
  const fetchGroupLive = useStatsStore(s => s.fetchGroupLive);
  const setOffline = useStatsStore(s => s.setOffline);
  const pushNotificationsEnabled = useStatsStore(s => s.pushNotificationsEnabled);
  const pollingFrequency = useStatsStore(s => s.pollingFrequency);
  const featuredUserId = useStatsStore(s => s.featuredUserId);
  const setFeaturedUserId = useStatsStore(s => s.setFeaturedUserId);
  const groupStats = useStatsStore(s => s.groupStats);

  const allUsers = Object.values(groupStats?.users || {});

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync across tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'stats-storage') {
        fetchStats();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Initial fetch
    fetchStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchStats, setOffline]);

  // Separate polling to prevent interval accumulation - always respects configured pollingFrequency in seconds
  useEffect(() => {
    // Safety guard: minimum of 20 seconds to prevent rate-limiting or heavy CPU usage
    const safePollingFrequency = Math.max(20, pollingFrequency);
    const intervalTime = safePollingFrequency * 1000;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' || pushNotificationsEnabled) {
        fetchGroupLive();
      }
    }, intervalTime);

    // Call live fetch when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchGroupLive();
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

      <AnimatePresence>
        {(!featuredUserId || !allUsers.some(user => user.id === featuredUserId)) && allUsers.length > 0 && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass border-white/10 rounded-[32px] p-6 max-w-sm w-full mx-auto shadow-2xl flex flex-col gap-6"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-500 ring-1 ring-orange-500/50">
                  <Users className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Quem está escutando?</h2>
                <p className="text-sm font-medium text-white/50 leading-relaxed">
                  Selecione o seu perfil para personalizar a sua experiência no Stats Loop.
                </p>
              </div>

              <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto no-scrollbar pb-2">
                {allUsers.map((user) => (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={user.id}
                    onClick={() => setFeaturedUserId(user.id)}
                    className="flex items-center text-left bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/20 p-3 rounded-2xl transition-all gap-4 group cursor-pointer"
                  >
                    <SmartImage 
                      src={coreUtils.getUserAvatar(user.id, user.avatar)} 
                      fallback={user.name} 
                      className="h-12 w-12 flex-shrink-0"
                      rounded="full" 
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-base font-bold text-white/90 group-hover:text-orange-500 transition-colors truncate">
                        {user.name}
                      </span>
                      <span className="text-xs font-semibold text-white/40 uppercase tracking-widest mt-0.5">
                        Selecionar
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </HashRouter>
  );
}
