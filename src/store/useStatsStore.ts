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
  fetchGroup: (force?: boolean) => Promise<void>;
  getUserById: (id: string) => UserStats | undefined;
  setOffline: (offline: boolean) => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      groupStats: null,
      isLoading: false,
      isOffline: !navigator.onLine,
      error: null,
      lastFetchTime: {},

      setOffline: (offline: boolean) => set({ isOffline: offline }),

      fetchGroup: async (force = false) => {
        set({ isLoading: true, error: null });
        try {
          const data = await statsService.getGroupData(force);
          set({ 
            groupStats: data, 
            isLoading: false, 
            lastFetchTime: { ...get().lastFetchTime, group: Date.now() } 
          });
        } catch (err: any) {
          console.error("Store Error:", err);
          
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
