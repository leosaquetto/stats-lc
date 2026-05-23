
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';
import { UserStats, GroupStats } from '../types/stats';
import { coreUtils, GROUP_USERS } from './statsCore';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.')) {
      return "https://statslc.leosaquetto.com";
    }
    // Em browsers, usamos o origin atual para que requisições /api/ sejam capturadas pelo server.ts/Vercel
    return window.location.origin;
  }
  return "";
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

/**
 * Utilitário para chamadas à nossa API Backend na Vercel
 */
const fetchFromApi = async <T>(endpoint: string, params: Record<string, any> = {}, forceRefresh = false, retries = 1): Promise<T> => {
  try {
    const finalParams = { ...params };
    if (forceRefresh) finalParams.force = '1';

    const response = await api.get(endpoint, { params: finalParams });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const isNetworkError = !error.response && error.request;
    
    if ((import.meta as any).env?.DEV) console.error(`Vercel API Fetch Error [${endpoint}]:`, {
      message: error.message,
      code: error.code,
      status: status,
      isNetworkError,
      data: error.response?.data
    });

    if (status === 429) throw error; // Sem retry para Rate Limit
    
    // Sem retry automático em requests forçadas, e apenas 1 retry normal para 503/504
    const isRetryable = !forceRefresh && (status === 504 || status === 503 || error.code === 'ECONNABORTED');
    
    if (isRetryable && retries > 0) {
      if ((import.meta as any).env?.DEV) console.warn(`Retryable error [${status || error.code}] on ${endpoint}. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchFromApi(endpoint, params, forceRefresh, retries - 1);
    }

    throw error;
  }
};

let groupRequestInFlight: Promise<GroupStats> | null = null;
let liveRequestInFlight: Promise<GroupStats> | null = null;

export const statsService = {
  getUsers: () => ([] as any[]),

  /**
   * Helper para mapear períodos do frontend para o backend
   * Diferentes endpoints podem esperar nomes diferentes para o mesmo período.
   */
  mapPeriod(period: string, endpoint: 'group' | 'top' | 'rankings' = 'top'): string {
    const rangeMap: Record<string, string> = {
      'today': 'today',
      'week': 'week',
      'weeks': 'week',
      '7days': '7days',
      'month': 'month',
      'months': 'month',
      'year': 'current_year',
      'years': 'current_year',
      'lifetime': 'lifetime',
      'all': 'lifetime'
    };
    return rangeMap[period] || period;
  },

  /**
   * Busca streams recentes de um amigo via backend Vercel
   */
  async fetchRecent(userId: string, limit = 20, offset = 0): Promise<any[]> {
    try {
      const userParam = userId; 
      const res = await fetchFromApi<any>('/api/recent', { user: userParam, limit, offset });
      if ((import.meta as any).env?.DEV) console.log(`[statsService] fetchRecent for ${userId}:`, res);
      return res?.items || [];
    } catch (e) {
      console.error(`Failed to fetch recents for ${userId}`);
      return [];
    }
  },

  /**
   * Busca estatísticas de uma entidade para todo o grupo de uma vez
   */
  async fetchEntityGroupStats(type: 'track' | 'artist' | 'album', id: string): Promise<Record<string, number>> {
    return fetchFromApi<Record<string, number>>('/api/entity-group-stats', { type, id });
  },

  /**
   * Busca estatísticas de uma entidade (track, artist, album) via backend Vercel
   */
  async fetchEntityStats(userId: string, type: 'track' | 'artist' | 'album', id: string, range?: string): Promise<number> {
    try {
      const userParam = userId;
      const params: any = { user: userParam, type, id };
      if (range) params.range = range;
      
      const data = await fetchFromApi<any>('/api/entity-stats', params);
      return data?.count || 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Alias para fetchEntityStats para compatibilidade
   */
  async getItemPlaysForUser(userId: string, type: 'track' | 'artist' | 'album', id: string): Promise<number> {
    return this.fetchEntityStats(userId, type, id);
  },

  /**
   * Busca dados live do grupo (apenas nowPlaying, etc)
   */
  async getGroupLiveData(forceRefresh = false): Promise<GroupStats> {
    if (liveRequestInFlight && !forceRefresh) {
      return liveRequestInFlight;
    }

    const request = (async () => {
      try {
        const data = await fetchFromApi<any>('/api/group-live', {}, forceRefresh);
        if ((import.meta as any).env?.DEV) console.log("[statsService] getGroupLiveData raw response:", data);
        
        const users: Record<string, UserStats> = {};
        const members: UserStats[] = [];
      
        if (data.members && Array.isArray(data.members)) {
          data.members.forEach((m: any) => {
            const uid = m.key || m.id;
            
            // Map NowPlaying
            let nowPlaying = undefined;
            if (m.nowPlaying) {
              const track = m.nowPlaying.track;
              const ts = m.nowPlaying.timestamp || m.nowPlaying.playedAt || new Date().toISOString();
              
              nowPlaying = {
                isNow: m.nowPlaying.isNow !== undefined ? m.nowPlaying.isNow : (Date.now() - new Date(ts).getTime() < 300000), // Fallback de 5 min se isNow vier undefined
                timestamp: ts,
                progressMs: m.nowPlaying.progressMs ?? m.nowPlaying.playedMs ?? 0,
                durationMs: m.nowPlaying.durationMs || track?.durationMs,
                playedMs: m.nowPlaying.playedMs ?? m.nowPlaying.progressMs ?? 0,
                platformCandidate: m.nowPlaying.platformCandidate,
                track: {
                  id: track?.id,
                  name: track?.name,
                  artists: track?.artists || [],
                  primaryArtist: track?.primaryArtist,
                  primaryArtistId: track?.primaryArtistId,
                  primaryArtistName: track?.primaryArtistName,
                  secondaryArtists: track?.secondaryArtists,
                  image: track?.image,
                  albumId: track?.albumId || track?.album?.id,
                  albumName: track?.albumName || track?.album?.name,
                  albumImage: track?.albumImage || track?.album?.image,
                  durationMs: track?.durationMs,
                  playedCount: track?.playedCount,
                  spotifyId: track?.spotifyId,
                  appleMusicId: track?.appleMusicId,
                  catalogAvailability: track?.catalogAvailability,
                  externalIds: track?.externalIds
                }
              };
            }

            const user: UserStats = {
              id: uid,
              name: m.profile?.displayName || uid,
              avatar: coreUtils.getUserAvatar(uid, m.profile?.image),
              platform: m.platform,
              streamsToday: m.stats?.today?.streams ?? 0,
              streamsWeek: m.stats?.week?.streams ?? 0,
              streamsMonth: m.stats?.month?.streams ?? 0,
              streamsYear: (m.stats?.year?.streams ?? m.stats?.current_year?.streams) ?? 0,
              totalStreams: m.stats?.lifetime?.streams ?? m.stats?.total?.streams ?? 0,
              totalDurationMs: m.stats?.lifetime?.durationMs || m.stats?.lifetime?.playedMs || 0,
              scrobbles: m.stats?.lifetime?.streams || 0,
              nowPlaying,
              topItems: m.tops || undefined
            };

            users[uid] = user;
            members.push(user);
          });
        }

        return {
          users,
          members,
          lastUpdated: data.generatedAt || data.lastUpdated || new Date().toISOString()
        };
      } catch (e: any) {
        if (e.message?.includes("Network Error")) {
          throw new Error("Timeout ou Falha de Conexão com o servidor. A API pode estar indisponível.");
        }
        
        const responseData = e.response?.data;
        const errorMessage = responseData?.error?.message || responseData?.message || e.message || "Unknown error";
        
        throw new Error(`Erro ao sincronizar live: ${errorMessage}`);
      } finally {
        if (liveRequestInFlight === request) liveRequestInFlight = null;
      }
    })();

    if (!forceRefresh) liveRequestInFlight = request;
    return request;
  },

  /**
   * Busca dados agregados do grupo (Dashboard principal)
   */
  async getGroupData(forceRefresh = false): Promise<GroupStats> {
    if (groupRequestInFlight && !forceRefresh) {
      return groupRequestInFlight;
    }

    const request = (async () => {
      try {
        const data = await fetchFromApi<any>('/api/group', {}, forceRefresh);
        if ((import.meta as any).env?.DEV) console.log("[statsService] getGroupData raw response:", data);
        
        const users: Record<string, UserStats> = {};
        const members: UserStats[] = [];
      
      if (data.members && Array.isArray(data.members)) {
        data.members.forEach((m: any) => {
          const uid = m.key || m.id;
          
          // Map NowPlaying
          let nowPlaying = undefined;
          if (m.nowPlaying) {
            const track = m.nowPlaying.track;
            const ts = m.nowPlaying.timestamp || m.nowPlaying.playedAt || new Date().toISOString();
            
            nowPlaying = {
              isNow: m.nowPlaying.isNow !== undefined ? m.nowPlaying.isNow : (Date.now() - new Date(ts).getTime() < 300000), // Fallback de 5 min se isNow vier undefined
              timestamp: ts,
              progressMs: m.nowPlaying.progressMs ?? m.nowPlaying.playedMs ?? 0,
              durationMs: m.nowPlaying.durationMs || track?.durationMs,
              playedMs: m.nowPlaying.playedMs ?? m.nowPlaying.progressMs ?? 0,
              platformCandidate: m.nowPlaying.platformCandidate,
              track: {
                id: track?.id,
                name: track?.name ,
                artists: track?.artists || [],
                image: track?.image,
                albumId: track?.albumId || track?.album?.id,
                albumName: track?.albumName || track?.album?.name,
                albumImage: track?.albumImage || track?.album?.image,
                durationMs: track?.durationMs,
                playedCount: track?.playedCount,
                spotifyId: track?.spotifyId,
                appleMusicId: track?.appleMusicId,
                catalogAvailability: track?.catalogAvailability,
                externalIds: track?.externalIds
              }
            };
          }

          const user: UserStats = {
            id: uid,
            name: m.profile?.displayName || uid,
            avatar: coreUtils.getUserAvatar(uid, m.profile?.image),
            platform: m.platform,
            streamsToday: m.stats?.today?.streams ?? 0,
            streamsWeek: m.stats?.week?.streams ?? 0,
            streamsMonth: m.stats?.month?.streams ?? 0,
            streamsYear: (m.stats?.year?.streams ?? m.stats?.current_year?.streams) ?? 0,
            totalStreams: m.stats?.lifetime?.streams ?? m.stats?.total?.streams ?? 0,
            totalDurationMs: m.stats?.lifetime?.durationMs || m.stats?.lifetime?.playedMs || 0,
            scrobbles: m.stats?.lifetime?.streams || 0,
            nowPlaying,
            topItems: m.tops || undefined
          };

          users[uid] = user;
          members.push(user);
        });
      }

      return {
        users,
        members, // Adicionando members array para facilitar
        lastUpdated: data.generatedAt || data.lastUpdated || new Date().toISOString()
      };
    } catch (e: any) {
      if (e.message?.includes("Network Error")) {
        throw new Error("Timeout ou Falha de Conexão com o servidor. A API pode estar indisponível.");
      }
      
      const responseData = e.response?.data;
      const errorMessage = responseData?.error?.message || responseData?.message || e.message || "Unknown error";
      
      throw new Error(`Erro ao sincronizar grupo: ${errorMessage}`);
    } finally {
      if (groupRequestInFlight === request) groupRequestInFlight = null;
    }
    })();

    if (!forceRefresh) groupRequestInFlight = request;
    return request;
  },

  /**
   * Busca rankings baseados nos dados do grupo
   */
  async getRankings(range: 'weeks' | 'months' | 'years' | 'lifetime' | 'today' = 'months'): Promise<Record<string, { count: number, durationMs: number }>> {
    try {
      // Otimização: Tentar usar dados do store primeiro se estiverem frescos (menos de 5 minutos)
      try {
        const { useStatsStore } = await import('../store/useStatsStore');
        const state = useStatsStore.getState();
        const lastFetch = state.lastFetchTime.group;
        const now = Date.now();
        const CACHE_TTL = 5 * 60 * 1000;
        
        if (state.groupStats && (now - lastFetch < CACHE_TTL || state.isOffline)) {
          const rankingsResult: Record<string, { count: number, durationMs: number }> = {};
          const members = state.groupStats.members || Object.values(state.groupStats.users);
          
          members.forEach((m) => {
            let count = 0;
            switch (range) {
              case 'today': count = m.streamsToday || 0; break;
              case 'weeks': count = m.streamsWeek || 0; break;
              case 'months': count = m.streamsMonth || 0; break;
              case 'years': count = m.streamsYear || 0; break;
              case 'lifetime': count = m.totalStreams || 0; break;
            }
            rankingsResult[m.id] = { count, durationMs: 0 }; // durationMs não é exposto individualmente no UserStats simplificado
          });
          
          if (Object.keys(rankingsResult).length > 0) {
            return rankingsResult;
          }
        }
      } catch (e) {
        // Silenciosamente falha e prossegue para a API
      }

      const backendRange = this.mapPeriod(range, 'rankings');
      const response = await fetchFromApi<any>('/api/group', { range: backendRange });
      
      const rankingsResult: Record<string, { count: number, durationMs: number }> = {};

      if (response.members) {
        response.members.forEach((m: any) => {
          const uid = m.key || m.id;
          let count = 0;
          let durationMs = 0;
          
          switch (range) {
            case 'today': 
              count = m.stats?.today?.streams || 0; 
              durationMs = m.stats?.today?.durationMs || m.stats?.today?.playedMs || 0;
              break;
            case 'weeks': 
              count = m.stats?.week?.streams || 0; 
              durationMs = m.stats?.week?.durationMs || m.stats?.week?.playedMs || 0;
              break;
            case 'months': 
              count = m.stats?.month?.streams || 0; 
              durationMs = m.stats?.month?.durationMs || m.stats?.month?.playedMs || 0;
              break;
            case 'years': 
              // Tentamos 'year' ou 'current_year' no objeto de stats retornado
              const yearStats = m.stats?.year || m.stats?.current_year;
              count = yearStats?.streams || 0; 
              durationMs = yearStats?.durationMs || yearStats?.playedMs || 0;
              break;
            case 'lifetime': 
              count = m.stats?.lifetime?.streams || 0; 
              durationMs = m.stats?.lifetime?.durationMs || m.stats?.lifetime?.playedMs || 0;
              break;
          }
          rankingsResult[uid] = { count, durationMs };
        });
      }
      
      return rankingsResult;
    } catch (e) {
      console.error("Rankings error:", e);
      return {};
    }
  },

  /**
   * Busca dados completos de um usuário específico via backend Vercel
   */
  async getUserFullStats(userId: string): Promise<any> {
    const userParam = userId;
    try {
      const { useStatsStore } = await import('../store/useStatsStore');
      const store = useStatsStore.getState();
      
      // Tenta carregar do cache robusto (valida 5 minutos de TTL se estiver online/navigator indica conectado; do contrário, serve cache)
      if (store.getUserFullStatsFromCache) {
        const cached = store.getUserFullStatsFromCache(userId);
        if (cached) {
          if ((import.meta as any).env?.DEV) console.log(`[statsService] Serving valid cached userFullStats for ${userId}`);
          return cached;
        }
      }
      
      const res = await fetchFromApi<any>('/api/user', { user: userParam });
      
      // Atualiza o cache do store
      if (store.setUserFullStatsCache) {
        store.setUserFullStatsCache(userId, res);
      }
      
      if ((import.meta as any).env?.DEV) console.log(`[statsService] getUserFullStats for ${userId}:`, res);
      return res;
    } catch (e) {
      console.error(`Failed to load full stats for ${userId}. Falling back to cache:`, e);
      try {
        const { useStatsStore } = await import('../store/useStatsStore');
        const store = useStatsStore.getState();
        // Em caso de falha de rede/API, recupera graciosamente do cache local (mesmo se expirado)
        if (store.getUserFullStatsFromCache) {
          const cached = store.getUserFullStatsFromCache(userId, true);
          if (cached) {
            if ((import.meta as any).env?.DEV) console.log(`[statsService] Serving stale fallback userFullStats graciously for ${userId}`);
            return cached;
          }
        }
        
        const cachedRaw = store.userFullStatsCache?.[userId];
        if (cachedRaw) {
          if ((import.meta as any).env?.DEV) console.log(`[statsService] Serving stale raw fallback userFullStats graciously for ${userId}`);
          return cachedRaw;
        }
      } catch {}
      throw e;
    }
  },

  /**
   * Alias para buscar streams de um período específico
   */
  async getStats(userId: string, period: 'today' | 'month' | 'year' | 'lifetime'): Promise<{ streams: number }> {
    const rangeMap: any = {
      'today': 'today',
      'month': 'months',
      'year': 'years',
      'lifetime': 'lifetime'
    };
    const rankings = await this.getRankings(rangeMap[period] || period);
    return { streams: rankings[userId]?.count || 0 };
  },

  /**
   * Busca top itens via backend Vercel
   */
  async getTopItems(userId: string, type: 'tracks' | 'artists' | 'albums', period: string = 'month'): Promise<any[]> {
    const userParam = userId;
    const cacheKey = `${userId}:${type}:${period}`;
    try {
      const { useStatsStore } = await import('../store/useStatsStore');
      const store = useStatsStore.getState();
      
      // Se estiver offline, retorna do cache imediatamente
      if (store.isOffline) {
        const cached = store.topItemsCache?.[cacheKey];
        if (cached) {
          if ((import.meta as any).env?.DEV) console.log(`[statsService] Offline: Serving cached top items for ${cacheKey}`);
          return cached;
        }
      }

      const params: any = { user: userParam, type };
      if (period === 'year' || period === 'years') {
        const now = new Date();
        const after = new Date(now.getFullYear(), 0, 1).getTime();
        params.after = after;
      } else {
        params.period = this.mapPeriod(period, 'top');
      }
      const res = await fetchFromApi<any>('/api/top', params);
      const items = res?.items || [];

      // Atualiza o cache do store
      if (store.setTopItemsCache) {
        store.setTopItemsCache(cacheKey, items);
      }

      if ((import.meta as any).env?.DEV) console.log(`[statsService] getTopItems for ${userId} (${type}, ${params.period || params.after}):`, res);
      return items;
    } catch (e) {
      if ((import.meta as any).env?.DEV) {
        console.warn(`[statsService] API target failed for top items (${cacheKey}). Reverting to cache.`, e);
      }
      try {
        const { useStatsStore } = await import('../store/useStatsStore');
        const store = useStatsStore.getState();
        const cached = store.topItemsCache?.[cacheKey];
        if (cached) {
          return cached;
        }
      } catch {}
      throw e;
    }
  },

  /**
   * Busca histórico global de uma faixa específica
   */
  async getTrackGlobalHistory(trackId: string): Promise<any[]> {
    try {
      const res = await fetchFromApi<any>('/api/track-history', { trackId });
      return res?.items || [];
    } catch (e) {
      console.error(`Failed to fetch global history for track ${trackId}`, e);
      return [];
    }
  },

  /**
   * Busca estatísticas avançadas por período
   */
  async fetchTimeRangeStats(userId: string, after: number): Promise<any> {
    const userParam = userId;
    const cacheKey = `${userId}:${after}`;
    try {
      const { useStatsStore } = await import('../store/useStatsStore');
      const store = useStatsStore.getState();
      
      // Tenta carregar do cache robusto (valida 5 minutos de TTL se estiver online; ou busca direto se offline)
      if (store.getTimeRangeStatsFromCache) {
        const cached = store.getTimeRangeStatsFromCache(cacheKey);
        if (cached) {
          if ((import.meta as any).env?.DEV) console.log(`[statsService] Serving valid cached timeRangeStats for ${cacheKey}`);
          return cached;
        }
      }

      let res: any;
      try {
        // Agora usamos a rota leve e cacheada /api/stats
        res = await fetchFromApi<any>('/api/stats', { user: userParam, after });
      } catch (e) {
        console.warn("[statsService] fetchTimeRangeStats failed, trying fallback...", e);
        res = await fetchFromApi<any>('/api/history', { user: userParam, after });
      }

      // Atualiza o cache do store
      if (store.setTimeRangeStatsCache) {
        store.setTimeRangeStatsCache(cacheKey, res);
      }

      return res;
    } catch (e) {
      console.error(`Failed to load time-range stats for ${cacheKey}. Falling back to cache:`, e);
      try {
        const { useStatsStore } = await import('../store/useStatsStore');
        const store = useStatsStore.getState();
        if (store.getTimeRangeStatsFromCache) {
          const cached = store.getTimeRangeStatsFromCache(cacheKey, true);
          if (cached) return cached;
        }
        const cachedRaw = store.timeRangeStatsCache?.[cacheKey];
        if (cachedRaw) return cachedRaw;
      } catch {}
      throw e;
    }
  },

  /**
   * Busca resumo de período com cardinalidade
   */
  async fetchTimeRangeCardinality(userId: string, after: number): Promise<any> {
    const userParam = userId;
    try {
      return await fetchFromApi<any>('/api/stats-cardinality', { user: userParam, after });
    } catch (e) {
      console.error(`Failed to load time-range cardinality for ${userId}`, e);
      return {};
    }
  },

  /**
   * Busca distribuição temporal do período (heatmap, etc)
   */
  async fetchTimeRangeDates(userId: string, after: number): Promise<any> {
    const userParam = userId;
    try {
      return await fetchFromApi<any>('/api/stats-dates', { user: userParam, after });
    } catch (e: any) {
      if (e.response?.status !== 404) {
        console.error(`Failed to load time-range dates for ${userId}`, e);
      }
      return {};
    }
  }
};
