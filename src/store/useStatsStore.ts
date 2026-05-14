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
  isRefreshing: boolean;
  isOffline: boolean;
  error: string | null;
  lastFetchTime: Record<string, number>;
  userTrackStats: Record<string, number>;
  
  // Actions
  fetchGroup: (force?: boolean) => Promise<void>;
  fetchUserTrackStats: (userId: string, trackId: string) => Promise<void>;
  getUserById: (id: string) => UserStats | undefined;
  setOffline: (offline: boolean) => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      groupStats: null,
      isLoading: false,
      isRefreshing: false,
      isOffline: !navigator.onLine,
      error: null,
      lastFetchTime: {},
      userTrackStats: {},

      setOffline: (offline: boolean) => set({ isOffline: offline }),

      fetchGroup: async (force = false) => {
        const isInitial = !get().groupStats;
        if (isInitial) set({ isLoading: true });
        else set({ isRefreshing: true });
        
        set({ error: null });
        try {
          const data = await statsService.getGroupData(force);
          set({ 
            groupStats: data, 
            isLoading: false, 
            isRefreshing: false,
            error: null, // Clear error on success
            lastFetchTime: { ...get().lastFetchTime, group: Date.now() } 
          });
        } catch (err: any) {
          console.error("Store Error:", err);
          set({ isLoading: false, isRefreshing: false });
          
          // Se já temos dados, não mostramos erro bloqueante, apenas logs
          if (!get().groupStats) {
            set({ error: "Erro na conexão com a API de música." });
          } else {
            console.warn("Refresh failed, but keeping stale data.");
            // Opcionalmente podemos setar um erro discreto/temporário
            // set({ error: "Erro na atualização. Exibindo dados de cache." });
          }
        }
      },

      fetchUserTrackStats: async (userId: string, trackId: string) => {
        const key = `${userId}:${trackId}`;
        try {
          const count = await statsService.fetchEntityStats(userId, 'track', trackId);
          set({ userTrackStats: { ...get().userTrackStats, [key]: count } });
        } catch (e) {
          console.error("fetchUserTrackStats error:", e);
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
