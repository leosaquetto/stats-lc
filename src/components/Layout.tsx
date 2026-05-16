/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart3, Trophy, Settings, WifiOff, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { isOffline, groupStats } = useStatsStore();
  
  const navItems = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Estatísticas', icon: BarChart3, path: '/stats' },
    { label: 'Ranking', icon: Trophy, path: '/ranking' },
    { label: 'Ajustes', icon: Settings, path: '/settings' },
  ];

  const lastUpdate = groupStats?.lastUpdated;
  const isStatsOrRanking = location.pathname === '/stats' || location.pathname === '/ranking';

  return (
    <div className="relative flex h-screen w-full flex-col bg-[#050505] overflow-hidden max-w-md mx-auto border-x border-white/5 font-sans">
      {/* Scroll Fade Gradients removed to prevent overlaying headers */}

      {/* Offline Status */}
      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="z-[100] bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 flex items-center justify-center gap-2"
          >
            <WifiOff className="h-3 w-3 text-red-500" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Modo Offline</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-6 pt-10 pb-32 scrolling-touch no-scrollbar">
        {children}
      </main>

      {/* Tab Bar (Floating Bottom Nav) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none gap-2">
        {/* Sync Info Footer */}
        {lastUpdate && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-md mb-1"
          >
            <Clock className="h-2.5 w-2.5 text-white/20" />
            <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Sincronizado</span>
            <span className="text-[7px] font-bold text-white/40 uppercase">
              • {coreUtils.getTimeAgoSmart(new Date(lastUpdate))}
            </span>
          </motion.div>
        )}

        <nav className="w-full max-w-md px-6 pb-8 pointer-events-auto">
          <div className="glass flex h-[72px] items-center justify-around rounded-[32px] px-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/10 relative overflow-hidden">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  className={clsx(
                    "relative flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-300 py-2",
                    isActive ? "text-orange-500" : "text-white/30 hover:text-white/50"
                  )}
                >
                  <div className="relative flex flex-col items-center">
                    <Icon 
                      className={clsx(
                        "h-5 w-5 transition-all duration-300",
                        isActive ? "scale-110" : "scale-100"
                      )} 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className={clsx(
                      "text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-300 mt-1.5",
                      isActive ? "text-orange-500 opacity-100" : "text-white/40 opacity-70"
                    )}>
                      {item.label}
                    </span>
                    
                    {isActive && (
                      <motion.div
                        layoutId="nav-glow"
                        className="absolute -bottom-4 h-1 w-8 rounded-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      
      {/* Background Atmosphere */}
      <div className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[60%] rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute bottom-[10%] right-[-10%] h-[30%] w-[50%] rounded-full bg-purple-500/10 blur-[100px]" />
      </div>
    </div>
  );
};
