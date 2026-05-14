/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GroupStats, UserStats } from '../types/stats';
import { statsService } from '../services/statsService';

interface StatsState {
  groupStats: GroupStats | null;
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
  lastFetchTime: Record<string, number>;
  
  // Actions
  fetchGroupStats: (force?: boolean) => Promise<void>;
  getUserById: (id: string) => UserStats | undefined;
  setOffline: (offline: boolean) => void;
}

// Parametric TTLs (in milliseconds)
const TTL = {
  NOW_PLAYING: 10 * 60 * 1000, // 10 mins
  HISTORY: 24 * 60 * 60 * 1000, // 24 hours
};

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      groupStats: null,
      isLoading: false,
      isOffline: !navigator.onLine,
      error: null,
      lastFetchTime: {},

      setOffline: (offline: boolean) => set({ isOffline: offline }),

      fetchGroupStats: async (force = false) => {
        const now = Date.now();
        const lastFetch = get().lastFetchTime['group'] || 0;
        
        // Se estiver offline, não tenta buscar se já tivermos dados e não for forçado
        if (!navigator.onLine && get().groupStats) return;

        // Cache logic: only fetch if forced or TTL expired
        if (!force && (now - lastFetch < TTL.NOW_PLAYING) && get().groupStats) return;

        set({ isLoading: true, error: null });
        try {
          const data = await statsService.getGroupData(force);
          set({ 
            groupStats: data, 
            isLoading: false, 
            lastFetchTime: { ...get().lastFetchTime, group: now } 
          });
        } catch (err: any) {
          console.error("Store Error:", err);
          
          // Se falhar e já tivermos dados no cache (offline), apenas avisamos mas mantemos os dados
          if (get().groupStats) {
            set({ isLoading: false, error: "Modo Offline: Exibindo últimos dados conhecidos." });
          } else {
            set({ error: "Erro na conexão com a API de música.", isLoading: false });
          }
        }
      },

      getUserById: (id: string) => {
        return get().groupStats?.users[id];
      }
    }),
    {
      name: 'stats-lc-storage', // Nome da chave no localStorage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        groupStats: state.groupStats,
        lastFetchTime: state.lastFetchTime
      }),
    }
  )
);
