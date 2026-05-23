/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GroupStats, UserStats } from '../types/stats';
import { statsService } from '../services/statsService';
import { notificationService } from '../services/notificationService';
import { coreUtils } from '../services/statsCore';

// Mock MMKV for web environment to prevent crashes with native modules
class MockMMKV {
  id: string;
  constructor(options: { id: string }) {
    this.id = options.id;
  }
  getString(key: string) {
    return localStorage.getItem(`${this.id}_${key}`);
  }
  set(key: string, value: string) {
    localStorage.setItem(`${this.id}_${key}`, value);
  }
  getNumber(key: string) {
    const val = localStorage.getItem(`${this.id}_${key}`);
    return val ? Number(val) : undefined;
  }
  delete(key: string) {
    localStorage.removeItem(`${this.id}_${key}`);
  }
}

const mmkv = typeof window !== 'undefined' ? new MockMMKV({ id: 'stats-cache' }) : { getString: () => null, set: () => {}, getNumber: () => 0, delete: () => {} } as any;

const loadFromMMKV = <T>(key: string, fallback: T): T => {
  try {
    const value = mmkv.getString(key);
    if (value) {
      return JSON.parse(value) as T;
    }
  } catch (e) {
    console.warn(`[MMKV] failed to load key ${key}:`, e);
  }
  return fallback;
};

const saveToMMKV = (key: string, value: any) => {
  try {
    mmkv.set(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[MMKV] failed to save key ${key}:`, e);
  }
};

interface StatsState {
  groupStats: GroupStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isLiveFetching: boolean;
  isOffline: boolean;
  error: string | null;
  lastFetchTime: Record<string, number>;
  userTrackStats: Record<string, number>;
  featuredUserId: string;
  hiddenUsers: string[];
  hideRankingBadge: boolean;
  
  // Novo: cache de stats pré-calculado
  statsCache: Record<string, {
    streamsToday: number;
    totalStreamsThisMonth: number;
    totalStreamsThisYear: number;
    lifetime: number;
    lastUpdated: number;
  }>;
  preloadedUsers: Set<string>;
  historyCache: Record<string, {
    items: any[];
    lastUpdated: number;
  }>;
  
  // Cache offline detalhado
  userFullStatsCache: Record<string, any>;
  userFullStatsCacheMeta: Record<string, number>;
  timeRangeStatsCache: Record<string, any>;
  timeRangeStatsCacheMeta: Record<string, number>;
  topItemsCache: Record<string, any>;
  topItemsCacheMeta: Record<string, number>;
  
  // Actions
  setCacheStats: (userId: string, stats: any) => void;
  getCacheStats: (userId: string) => any;
  setHistoryCache: (userId: string, items: any[]) => void;
  getHistoryCache: (userId: string) => any[] | null;
  getUserFullStatsFromCache: (userId: string, allowStale?: boolean) => any;
  getTimeRangeStatsFromCache: (key: string, allowStale?: boolean) => any;
  getTopItemsFromCache: (key: string, allowStale?: boolean) => any;
  setUserPreloaded: (userId: string) => void;
  isUserPreloaded: (userId: string) => boolean;
  clearUserCache: (userId: string) => void;
  fetchGroup: (force?: boolean) => Promise<void>;
  fetchGroupLive: () => Promise<void>;
  fetchUserTrackStats: (userId: string, trackId: string) => Promise<void>;
  fetchTrackStatsForAll: (trackId: string) => Promise<void>;
  getUserById: (id: string) => UserStats | undefined;
  setOffline: (offline: boolean) => void;
  setFeaturedUserId: (userId: string) => void;
  setHiddenUsers: (users: string[]) => void;
  setHideRankingBadge: (hide: boolean) => void;
  setUserFullStatsCache: (userId: string, data: any) => void;
  setTimeRangeStatsCache: (key: string, data: any) => void;
  setTopItemsCache: (key: string, data: any) => void;

  // Push Notification settings
  pushNotificationsEnabled: boolean;
  notifyOnNewStreams: boolean;
  notifyOnGroupHighlights: boolean;
  notifyOnArenaBattle: boolean;
  arenaName: string;
  pollingFrequency: number;

  // Ordering settings
  historyOrder: 'lastPlayed' | 'alphabetical' | 'custom';
  historyCustomOrder: string[];

  // Animation settings
  animationDuration: number;
  animationDelay: number;
  shimmerDuration: number;

  // Actions
  setPushNotificationsEnabled: (enabled: boolean) => void;
  setNotifyOnNewStreams: (enabled: boolean) => void;
  setNotifyOnGroupHighlights: (enabled: boolean) => void;
  setNotifyOnArenaBattle: (enabled: boolean) => void;
  setArenaName: (name: string) => void;
  setPollingFrequency: (frequency: number) => void;
  setHistoryOrder: (order: 'lastPlayed' | 'alphabetical' | 'custom') => void;
  setHistoryCustomOrder: (order: string[]) => void;
  setAnimationDuration: (duration: number) => void;
  setAnimationDelay: (delay: number) => void;
  setShimmerDuration: (duration: number) => void;
}

/**
 * Migrate old state that used aliases/keys to canonical IDs
 */
const migrateStateToCanonicalIds = (state: StatsState, groupStats: GroupStats | null): Partial<StatsState> => {
  if (!groupStats) return {};

  const updates: Partial<StatsState> = {};
  const idMap = new Map<string, string>();

  // Build alias -> id mapping
  Object.values(groupStats.users).forEach(user => {
    if (user.key && user.key !== user.id) {
      idMap.set(user.key, user.id);
    }
  });

  // Migrate featuredUserId
  if (state.featuredUserId && idMap.has(state.featuredUserId)) {
    updates.featuredUserId = idMap.get(state.featuredUserId)!;
  }

  // Migrate hiddenUsers
  if (state.hiddenUsers.length > 0) {
    updates.hiddenUsers = state.hiddenUsers.map(id => idMap.get(id) || id);
  }

  // Migrate historyCustomOrder
  if (state.historyCustomOrder.length > 0) {
    updates.historyCustomOrder = state.historyCustomOrder.map(id => idMap.get(id) || id);
  }

  return updates;
};

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      groupStats: loadFromMMKV<GroupStats | null>('groupStats', null),
      isLoading: false,
      isRefreshing: false,
      isLiveFetching: false,
      isOffline: !coreUtils.isBrowserOnline(),
      error: null,
      lastFetchTime: {},
      userTrackStats: {},
      featuredUserId: "",
      hiddenUsers: [],
      hideRankingBadge: false,
      statsCache: {},
      historyCache: {},
      preloadedUsers: new Set<string>(),
      userFullStatsCache: loadFromMMKV<Record<string, any>>('userFullStatsCache', {}),
      userFullStatsCacheMeta: loadFromMMKV<Record<string, number>>('userFullStatsCacheMeta', {}),
      timeRangeStatsCache: loadFromMMKV<Record<string, any>>('timeRangeStatsCache', {}),
      timeRangeStatsCacheMeta: loadFromMMKV<Record<string, number>>('timeRangeStatsCacheMeta', {}),
      topItemsCache: loadFromMMKV<Record<string, any>>('topItemsCache', {}),
      topItemsCacheMeta: loadFromMMKV<Record<string, number>>('topItemsCacheMeta', {}),

      setOffline: (offline: boolean) => set({ isOffline: offline }),
      setFeaturedUserId: (userId: string) => set({ featuredUserId: userId }),
      setHiddenUsers: (users: string[]) => set({ hiddenUsers: users }),
      setHideRankingBadge: (hide: boolean) => set({ hideRankingBadge: hide }),
      
      setUserFullStatsCache: (userId: string, data: any) => {
        const nextCache = {
          ...get().userFullStatsCache,
          [userId]: data
        };
        const nextMeta = {
          ...get().userFullStatsCacheMeta,
          [userId]: Date.now()
        };
        saveToMMKV('userFullStatsCache', nextCache);
        saveToMMKV('userFullStatsCacheMeta', nextMeta);
        set({ userFullStatsCache: nextCache, userFullStatsCacheMeta: nextMeta });
      },

      setTimeRangeStatsCache: (key: string, data: any) => {
        const nextCache = {
          ...get().timeRangeStatsCache,
          [key]: data
        };
        const nextMeta = {
          ...get().timeRangeStatsCacheMeta,
          [key]: Date.now()
        };
        saveToMMKV('timeRangeStatsCache', nextCache);
        saveToMMKV('timeRangeStatsCacheMeta', nextMeta);
        set({ timeRangeStatsCache: nextCache, timeRangeStatsCacheMeta: nextMeta });
      },

      setTopItemsCache: (key: string, data: any) => {
        const nextCache = {
          ...get().topItemsCache,
          [key]: data
        };
        const nextMeta = {
          ...get().topItemsCacheMeta,
          [key]: Date.now()
        };
        saveToMMKV('topItemsCache', nextCache);
        saveToMMKV('topItemsCacheMeta', nextMeta);
        set({ topItemsCache: nextCache, topItemsCacheMeta: nextMeta });
      },

      pushNotificationsEnabled: false,
      notifyOnNewStreams: true,
      notifyOnGroupHighlights: true,
      notifyOnArenaBattle: false,
      arenaName: 'Arena do Grupo',
      pollingFrequency: 60,

      historyOrder: 'lastPlayed',
      historyCustomOrder: [],

      // Animation settings default values
      animationDuration: 0.4,
      animationDelay: 0.04,
      shimmerDuration: 2.8,

      setPushNotificationsEnabled: (enabled: boolean) => set({ pushNotificationsEnabled: enabled }),
      setNotifyOnNewStreams: (enabled: boolean) => set({ notifyOnNewStreams: enabled }),
      setNotifyOnGroupHighlights: (enabled: boolean) => set({ notifyOnGroupHighlights: enabled }),
      setNotifyOnArenaBattle: (enabled: boolean) => set({ notifyOnArenaBattle: enabled }),
      setArenaName: (name: string) => set({ arenaName: name }),
      setPollingFrequency: (frequency: number) => set({ pollingFrequency: frequency }),
      setHistoryOrder: (order: 'lastPlayed' | 'alphabetical' | 'custom') => set({ historyOrder: order }),
      setHistoryCustomOrder: (order: string[]) => set({ historyCustomOrder: order }),
      setAnimationDuration: (duration: number) => set({ animationDuration: duration }),
      setAnimationDelay: (delay: number) => set({ animationDelay: delay }),
      setShimmerDuration: (duration: number) => set({ shimmerDuration: duration }),

      // Setter para cache de stats
      setCacheStats: (userId: string, stats: any) => {
        set(state => ({
          statsCache: {
            ...state.statsCache,
            [userId]: {
              ...stats,
              lastUpdated: Date.now()
            }
          }
        }))
      },

      // Getter com validação de TTL (5 minutos) - ignorada se offline
      getCacheStats: (userId: string) => {
        const cache = get().statsCache[userId];
        if (!cache) return null;
        
        const now = Date.now();
        const age = now - cache.lastUpdated;
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
        
        if (age > CACHE_TTL && !get().isOffline) {
          return null; // Cache expirado (apenas se online)
        }
        return cache;
      },

      // Setter para cache de histórico
      setHistoryCache: (userId: string, items: any[]) => {
        set(state => ({
          historyCache: {
            ...state.historyCache,
            [userId]: {
              items,
              lastUpdated: Date.now()
            }
          }
        }))
      },

      // Getter para cache de histórico (TTL 5 minutos) - ignorada se offline
      getHistoryCache: (userId: string) => {
        const cache = get().historyCache[userId];
        if (!cache) return null;
        
        const now = Date.now();
        const age = now - cache.lastUpdated;
        const HISTORY_TTL = 5 * 60 * 1000; // 5 minutos
        
        if (age > HISTORY_TTL && !get().isOffline) {
          return null; // Cache expirado (apenas se online)
        }
        return cache.items;
      },

      getUserFullStatsFromCache: (userId: string, allowStale = false) => {
        let cache = get().userFullStatsCache?.[userId];
        let lastUpdated = get().userFullStatsCacheMeta?.[userId] || 0;
        
        if (!cache) {
          const mmkvCache = loadFromMMKV<Record<string, any>>('userFullStatsCache', {});
          const mmkvCacheMeta = loadFromMMKV<Record<string, number>>('userFullStatsCacheMeta', {});
          cache = mmkvCache?.[userId];
          lastUpdated = mmkvCacheMeta?.[userId] || 0;
        }

        if (!cache) return null;

        const now = Date.now();
        const age = now - lastUpdated;
        const TTL = 10 * 60 * 1000; // 10 minutos para detalhes
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : !get().isOffline;

        if (age > TTL && isOnline && !allowStale) {
          // Invalidação em background: limpa o cache específico para forçar o próximo fetch
          setTimeout(() => {
            set(state => {
              const newCache = { ...state.userFullStatsCache };
              const newMeta = { ...state.userFullStatsCacheMeta };
              delete newCache[userId];
              delete newMeta[userId];
              saveToMMKV('userFullStatsCache', newCache);
              saveToMMKV('userFullStatsCacheMeta', newMeta);
              return { userFullStatsCache: newCache, userFullStatsCacheMeta: newMeta };
            });
          }, 100);
          return null; 
        }
        return cache;
      },

      getTimeRangeStatsFromCache: (key: string, allowStale = false) => {
        let cache = get().timeRangeStatsCache?.[key];
        let lastUpdated = get().timeRangeStatsCacheMeta?.[key] || 0;
        
        if (!cache) {
          const mmkvCache = loadFromMMKV<Record<string, any>>('timeRangeStatsCache', {});
          const mmkvCacheMeta = loadFromMMKV<Record<string, number>>('timeRangeStatsCacheMeta', {});
          cache = mmkvCache?.[key];
          lastUpdated = mmkvCacheMeta?.[key] || 0;
        }

        if (!cache) return null;

        const now = Date.now();
        const age = now - lastUpdated;
        const TTL = 5 * 60 * 1000; // 5 minutos
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : !get().isOffline;

        if (age > TTL && isOnline && !allowStale) {
          setTimeout(() => {
            set(state => {
              const newCache = { ...state.timeRangeStatsCache };
              const newMeta = { ...state.timeRangeStatsCacheMeta };
              delete newCache[key];
              delete newMeta[key];
              saveToMMKV('timeRangeStatsCache', newCache);
              saveToMMKV('timeRangeStatsCacheMeta', newMeta);
              return { timeRangeStatsCache: newCache, timeRangeStatsCacheMeta: newMeta };
            });
          }, 100);
          return null;
        }
        return cache;
      },

      getTopItemsFromCache: (key: string, allowStale = false) => {
        let cache = get().topItemsCache?.[key];
        let lastUpdated = get().topItemsCacheMeta?.[key] || 0;

        if (!cache) {
          const mmkvCache = loadFromMMKV<Record<string, any>>('topItemsCache', {});
          const mmkvCacheMeta = loadFromMMKV<Record<string, number>>('topItemsCacheMeta', {});
          cache = mmkvCache?.[key];
          lastUpdated = mmkvCacheMeta?.[key] || 0;
        }

        if (!cache) return null;

        const now = Date.now();
        const age = now - lastUpdated;
        const TTL = 15 * 60 * 1000; // 15 minutos para rankings
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : !get().isOffline;

        if (age > TTL && isOnline && !allowStale) {
          setTimeout(() => {
            set(state => {
              const newCache = { ...state.topItemsCache };
              const newMeta = { ...state.topItemsCacheMeta };
              delete newCache[key];
              delete newMeta[key];
              saveToMMKV('topItemsCache', newCache);
              saveToMMKV('topItemsCacheMeta', newMeta);
              return { topItemsCache: newCache, topItemsCacheMeta: newMeta };
            });
          }, 100);
          return null;
        }
        return cache;
      },

      // Marcar usuário como pré-carregado
      setUserPreloaded: (userId: string) => {
        set(state => ({
          preloadedUsers: new Set([...state.preloadedUsers, userId])
        }))
      },

      // Verificar se usuário foi pré-carregado
      isUserPreloaded: (userId: string) => {
        return get().preloadedUsers.has(userId);
      },

      // Limpar cache de um usuário específico
      clearUserCache: (userId: string) => {
        set(state => {
          const newCache = { ...state.statsCache };
          delete newCache[userId];
          return { statsCache: newCache };
        })
      },

      fetchGroup: async (force = false) => {
        const cacheTimestamp = mmkv.getNumber('groupStats_timestamp') || 0;
        const now = Date.now();
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
        const isCacheValid = (now - cacheTimestamp) < CACHE_TTL;

        // Se o cachê for válido e não formos forçar atualização, usa os dados em cache
        if (!force && isCacheValid) {
          const cachedGroup = loadFromMMKV<GroupStats | null>('groupStats', null);
          const cachedUserFullStats = loadFromMMKV<Record<string, any>>('userFullStatsCache', {});
          if (cachedGroup) {
            set({
              groupStats: cachedGroup,
              userFullStatsCache: cachedUserFullStats,
              isLoading: false,
              isRefreshing: false,
              error: null,
            });
            if ((import.meta as any).env?.DEV) console.log("[fetchGroup] Serving valid MMKV cache, skipping fetch.");
            return;
          }
        }

        const isInitial = !get().groupStats;
        if (isInitial) set({ isLoading: true });
        else set({ isRefreshing: true });
        
        set({ error: null });
        try {
          // Se estiver offline ou navigator indicar estar desconectado, servir cache imediatamente sem tentar requisição
          const isActuallyOffline = get().isOffline || !navigator.onLine;
          if (isActuallyOffline) {
            const cachedGroup = loadFromMMKV<GroupStats | null>('groupStats', null);
            const cachedUserFullStats = loadFromMMKV<Record<string, any>>('userFullStatsCache', {});
            if (cachedGroup) {
              set({
                groupStats: cachedGroup,
                userFullStatsCache: cachedUserFullStats,
                isLoading: false,
                isRefreshing: false,
                isOffline: true,
                error: null,
              });
              if ((import.meta as any).env?.DEV) console.log("[fetchGroup] Network is offline, served stencil/stale MMKV data without error.");
              return;
            }
          }

          const data = await statsService.getGroupData(force);
          
          // Salva os novos dados obtidos em cache via MMKV
          saveToMMKV('groupStats', data);
          mmkv.set('groupStats_timestamp', Date.now());

          // Migrate old state to canonical IDs
          const currentState = get();
          const migrations = migrateStateToCanonicalIds(currentState, data);

          set({
            groupStats: data,
            isLoading: false,
            isRefreshing: false,
            isOffline: false, // Sucesso indica que estamos online
            error: null, // Limpa erros de conexões anteriores
            lastFetchTime: { ...get().lastFetchTime, group: Date.now() },
            ...migrations // Apply migrations
          });

          // Disparar push notifications
          if (data && data.members) {
            notificationService.checkAndNotify(data.members, {
              pushNotificationsEnabled: get().pushNotificationsEnabled,
              notifyOnNewStreams: get().notifyOnNewStreams,
              notifyOnGroupHighlights: get().notifyOnGroupHighlights,
              notifyOnArenaBattle: get().notifyOnArenaBattle,
              arenaName: get().arenaName,
              pollingFrequency: get().pollingFrequency,
            });
          }
        } catch (err: any) {
          const isNetworkError = !coreUtils.isBrowserOnline() ||
            err.message?.includes('Network Error') ||
            err.message?.includes('timeout') ||
            err.message?.includes('Timeout') ||
            err.message?.includes('Falha de Conexão') ||
            err.code === 'ECONNABORTED' ||
            err.message?.includes('network');
            
          if (isNetworkError) {
            console.warn("Rede indisponível ou timeout na API, revertendo para cache local da Arena.");
            set({ isOffline: true, isLoading: false, isRefreshing: false });
          } else {
            if ((import.meta as any).env?.DEV) console.warn("Store Error na requisição, falha temporária. Revertendo para cache local:", err.message);
            set({ isLoading: false, isRefreshing: false });
          }
          
          // Servir cache mesmo se obsoleto sem falhar se o app estiver offline ou rede indisponível
          const cachedGroup = loadFromMMKV<GroupStats | null>('groupStats', null);
          const cachedUserFullStats = loadFromMMKV<Record<string, any>>('userFullStatsCache', {});
          if (cachedGroup) {
            set({
              groupStats: cachedGroup,
              userFullStatsCache: cachedUserFullStats,
              error: null, // Sem falhar: limpa erro para exibir o cache de forma suave
            });
            if ((import.meta as any).env?.DEV) console.warn("[fetchGroup] Serving cached MMKV data graciously despite obsolete or fetch failure.");
          } else {
            set({ error: "Erro na conexão com a API de música." });
          }
        }
      },

      fetchGroupLive: async () => {
        if (get().isLiveFetching) return;
        set({ isLiveFetching: true });

        try {
          const liveData = await statsService.getGroupLiveData(false);
          const currentGroupStats = get().groupStats;

          if (currentGroupStats) {
            const newGroupStats = { ...currentGroupStats };
            const newUsers = { ...newGroupStats.users };
            const newMembers = [...newGroupStats.members];

            liveData.members?.forEach((liveUser) => {
              const existingUser = newUsers[liveUser.id];

              if (existingUser) {
                // Merge live data while preserving rich data from /api/group
                const prevTrackId = existingUser.nowPlaying?.track?.id;
                const newTrackId = liveUser.nowPlaying?.track?.id;

                const mergedUser = {
                  ...existingUser,              // Keep all existing data
                  nowPlaying: liveUser.nowPlaying,
                  platform: liveUser.platform || existingUser.platform,
                  avatar: liveUser.avatar || existingUser.avatar,
                  name: liveUser.name || existingUser.name,
                  // Preserve: topItems, recent, catalogSummary, errors, stats
                };

                newUsers[liveUser.id] = mergedUser;

                const memberIndex = newMembers.findIndex(m => m.id === liveUser.id);
                if (memberIndex !== -1) {
                  newMembers[memberIndex] = mergedUser;
                }

                if (newTrackId && prevTrackId !== newTrackId) {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('nowPlayingChanged', { detail: { userId: liveUser.id } }));
                  }
                }
              } else {
                // New member from live endpoint - add to both structures
                const normalizedLive = statsService.normalizeMember?.(liveUser);
                if (normalizedLive) {
                  newUsers[normalizedLive.id] = normalizedLive;
                  newMembers.push(normalizedLive);
                }
              }
            });

            newGroupStats.users = newUsers;
            newGroupStats.members = newMembers;
            newGroupStats.lastUpdated = liveData.lastUpdated;

            saveToMMKV('groupStats', newGroupStats);
            mmkv.set('groupStats_timestamp', Date.now());
            set({ groupStats: newGroupStats });
          }
        } catch (e) {
          console.warn('Silent live fetch failed:', e);
        } finally {
          set({ isLiveFetching: false });
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

      fetchTrackStatsForAll: async (trackId: string) => {
        const users = get().groupStats?.members || [];
        try {
          const newStats = { ...get().userTrackStats };
          const groupStats = await statsService.fetchEntityGroupStats('track', trackId);

          users.forEach((u) => {
            newStats[`${u.id}:${trackId}`] = groupStats[u.id] || 0;
          });

          set({ userTrackStats: newStats });
        } catch (e) {
          try {
            const results = await Promise.all(users.map(async (u) => {
              const count = await statsService.fetchEntityStats(u.id, 'track', trackId);
              return { userId: u.id, count };
            }));

            const newStats = { ...get().userTrackStats };
            results.forEach(({ userId, count }) => {
              newStats[`${userId}:${trackId}`] = count;
            });

            set({ userTrackStats: newStats });
          } catch (fallbackError) {
            console.error("fetchTrackStatsForAll error:", fallbackError);
          }
        }
      },

      getUserById: (id: string) => {
        const state = get();
        const lastFetch = state.lastFetchTime.group;
        const now = Date.now();
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
        
        if (!state.isOffline && (!lastFetch || now - lastFetch > CACHE_TTL)) {
          setTimeout(() => {
            // Re-verificar após o timeout para evitar chamadas de corrida duplicadas
            const currentState = get();
            const currentLastFetch = currentState.lastFetchTime.group;
            if (currentState.isOffline || (currentLastFetch && Date.now() - currentLastFetch < CACHE_TTL)) {
              return;
            }

            // throttling imediato marcando o fetch em andamento
            set(prev => ({
              lastFetchTime: {
                ...prev.lastFetchTime,
                group: Date.now()
              }
            }));

            // Dispara a consulta silenciosa em background
            statsService.getGroupData(false)
              .then(data => {
                if (data) {
                  set({
                    groupStats: data,
                    isOffline: false,
                    error: null,
                    lastFetchTime: { ...get().lastFetchTime, group: Date.now() }
                  });
                  
                  // Trigger push notifications check
                  if (data.members) {
                    notificationService.checkAndNotify(data.members, {
                      pushNotificationsEnabled: get().pushNotificationsEnabled,
                      notifyOnNewStreams: get().notifyOnNewStreams,
                      notifyOnGroupHighlights: get().notifyOnGroupHighlights,
                      notifyOnArenaBattle: get().notifyOnArenaBattle,
                      arenaName: get().arenaName,
                      pollingFrequency: get().pollingFrequency,
                    });
                  }
                }
              })
              .catch(err => {
                if ((import.meta as any).env?.DEV) console.warn("[getUserById background sync failed]", err);
                const isNetworkError = !navigator.onLine || 
                  err.message?.includes('Network Error') || 
                  err.message?.includes('timeout') || 
                  err.code === 'ECONNABORTED' ||
                  err.message?.includes('network');
                  
                if (isNetworkError) {
                  set({ isOffline: true });
                }
              });
          }, 0);
        }

        return state.groupStats?.users[id];
      }
    }),
    {
      name: 'stats-lc-storage', // Nome da chave no localStorage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        groupStats: state.groupStats,
        lastFetchTime: state.lastFetchTime,
        featuredUserId: state.featuredUserId,
        hiddenUsers: state.hiddenUsers,
        hideRankingBadge: state.hideRankingBadge,
        statsCache: state.statsCache,
        historyCache: state.historyCache,
        userFullStatsCache: state.userFullStatsCache,
        userFullStatsCacheMeta: state.userFullStatsCacheMeta,
        timeRangeStatsCache: state.timeRangeStatsCache,
        timeRangeStatsCacheMeta: state.timeRangeStatsCacheMeta,
        topItemsCache: state.topItemsCache,
        topItemsCacheMeta: state.topItemsCacheMeta,
        pushNotificationsEnabled: state.pushNotificationsEnabled,
        notifyOnNewStreams: state.notifyOnNewStreams,
        notifyOnGroupHighlights: state.notifyOnGroupHighlights,
        notifyOnArenaBattle: state.notifyOnArenaBattle,
        arenaName: state.arenaName,
        pollingFrequency: state.pollingFrequency,
        historyOrder: state.historyOrder,
        historyCustomOrder: state.historyCustomOrder,
        animationDuration: state.animationDuration,
        animationDelay: state.animationDelay,
        shimmerDuration: state.shimmerDuration,
      }),
    }
  )
);
