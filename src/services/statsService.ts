
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';
import { UserStats, GroupStats } from '../types/stats';
import { coreUtils, GROUP_USERS } from './statsCore';

const getBaseUrl = () => {
  const envBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_STATS_API_BASE_URL;
  if (envBaseUrl) return String(envBaseUrl).replace(/\/$/, "");

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return "";
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Accept': 'application/json'
  }
});

const getPrimaryArtistName = (artists: any[] | undefined) => {
  if (!Array.isArray(artists) || artists.length === 0) return undefined;
  const first = artists[0];
  return typeof first === 'string' ? first : first?.name;
};

const normalizeTrack = (track: any) => {
  if (!track) return undefined;

  return {
    id: track.id,
    name: track.name,
    artists: track.artists || [],
    primaryArtist: track.primaryArtist,
    primaryArtistId: track.primaryArtistId,
    primaryArtistName: track.primaryArtistName || getPrimaryArtistName(track.artists),
    secondaryArtists: track.secondaryArtists,
    image: track.image,
    albumId: track.albumId || track.album?.id,
    albumName: track.albumName || track.album?.name,
    albumImage: track.albumImage || track.album?.image,
    durationMs: track.durationMs,
    playedCount: track.playedCount,
    spotifyId: track.spotifyId,
    appleMusicId: track.appleMusicId,
    catalogAvailability: track.catalogAvailability,
    externalIds: track.externalIds
  };
};

const normalizeNowPlaying = (nowPlaying: any) => {
  if (!nowPlaying) return undefined;

  const track = normalizeTrack(nowPlaying.track);
  if (!track) return undefined;
  const ts = nowPlaying.timestamp || nowPlaying.playedAt || nowPlaying.endTime || new Date().toISOString();
  const platformCandidate = nowPlaying.platformCandidate || nowPlaying.serviceCandidate;

  return {
    isNow: nowPlaying.isNow !== undefined ? nowPlaying.isNow : (Date.now() - new Date(ts).getTime() < 300000),
    timestamp: ts,
    progressMs: nowPlaying.progressMs ?? nowPlaying.playedMs ?? 0,
    durationMs: nowPlaying.durationMs || track?.durationMs,
    playedMs: nowPlaying.playedMs ?? nowPlaying.progressMs ?? 0,
    platformCandidate: platformCandidate?.primary
      ? platformCandidate
      : platformCandidate?.platform
        ? { ...platformCandidate, primary: platformCandidate.platform }
        : platformCandidate,
    track
  };
};

const normalizeMember = (member: any): UserStats | null => {
  const uid = member.id;
  if (!uid) {
    if ((import.meta as any).env?.DEV) {
      console.warn('[normalizeMember] Skipping member without id:', member);
    }
    return null;
  }

  const yearStats = member.stats?.year || member.stats?.current_year;

  return {
    id: uid,
    key: member.key,
    name: member.profile?.displayName || member.name || uid,
    avatar: coreUtils.getUserAvatar(uid, member.profile?.image || member.avatar),
    platform: member.platform,
    streamsToday: member.stats?.today?.streams ?? member.streamsToday ?? 0,
    streamsWeek: member.stats?.week?.streams ?? member.streamsWeek ?? 0,
    streamsMonth: member.stats?.month?.streams ?? member.streamsMonth ?? 0,
    streamsYear: yearStats?.streams ?? member.streamsYear ?? 0,
    totalStreams: member.stats?.lifetime?.streams ?? member.stats?.total?.streams ?? member.totalStreams ?? 0,
    totalDurationMs: member.stats?.lifetime?.durationMs || member.stats?.lifetime?.playedMs || member.totalDurationMs || 0,
    scrobbles: member.stats?.lifetime?.streams || member.scrobbles || 0,
    nowPlaying: normalizeNowPlaying(member.nowPlaying),
    topItems: member.tops || member.topItems || undefined,
    catalogSummary: member.catalogSummary,
    errors: member.errors,
    recent: member.recent
  };
};

const normalizeGroupStats = (data: any): GroupStats => {
  const users: Record<string, UserStats> = {};
  const members: UserStats[] = [];

  if (data?.members && Array.isArray(data.members)) {
    data.members.forEach((member: any) => {
      const user = normalizeMember(member);
      if (!user) return; // Skip members without id
      users[user.id] = user;
      members.push(user);
    });
  }

  return {
    users,
    members,
    lastUpdated: data?.generatedAt || data?.lastUpdated || new Date().toISOString()
  };
};

/**
 * Utilitário para chamadas à nossa API Backend na Vercel
 */
const API_RESPONSE_CACHE_TTL = 30 * 1000;
const apiResponseCache = new Map<string, { expiresAt: number; data: any }>();
const apiRequestInFlight = new Map<string, Promise<any>>();

const stableStringify = (value: any): string => {
  if (typeof value === 'undefined') return '"__undefined__"';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const getApiCacheKey = (endpoint: string, params: Record<string, any>, forceRefresh: boolean) => {
  return `${endpoint}|force=${forceRefresh ? '1' : '0'}|${stableStringify(params)}`;
};

const fetchFromApi = async <T>(endpoint: string, params: Record<string, any> = {}, forceRefresh = false, retries = 1, useDedupe = true): Promise<T> => {
  const finalParams = { ...params };
  if (forceRefresh) finalParams.force = '1';

  const cacheKey = getApiCacheKey(endpoint, finalParams, forceRefresh);
  const now = Date.now();

  if (!forceRefresh && useDedupe) {
    const cached = apiResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }

    const running = apiRequestInFlight.get(cacheKey);
    if (running) {
      return running as Promise<T>;
    }
  }

  const request = (async (): Promise<T> => {
    try {
      const response = await api.get(endpoint, { params: finalParams });
      if (!forceRefresh) {
        apiResponseCache.set(cacheKey, {
          data: response.data,
          expiresAt: Date.now() + API_RESPONSE_CACHE_TTL,
        });
      }
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

      // Sem retry automático em requests forçadas; retry normal só para falhas temporárias.
      const isRetryable = !forceRefresh && (
        [500, 502, 503, 504].includes(status) ||
        error.code === 'ECONNABORTED' ||
        isNetworkError
      );

      if (isRetryable && retries > 0) {
        if ((import.meta as any).env?.DEV) console.warn(`Retryable error [${status || error.code}] on ${endpoint}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchFromApi(endpoint, params, forceRefresh, retries - 1, false);
      }

      throw error;
    } finally {
      if (!forceRefresh && useDedupe) {
        apiRequestInFlight.delete(cacheKey);
      }
    }
  })();

  if (!forceRefresh && useDedupe) {
    apiRequestInFlight.set(cacheKey, request);
  }

  return request;
};

let groupRequestInFlight: Promise<GroupStats> | null = null;
let liveRequestInFlight: Promise<GroupStats> | null = null;

export const statsService = {
  normalizeMember,
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
      const userParam = coreUtils.getUserApiParam(userId);
      const res = await fetchFromApi<any>('/api/user-streams', { user: userParam, limit, offset });
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
    const res = await fetchFromApi<any>('/api/entity-group-stats', { type, id });
    if (!Array.isArray(res?.members)) return res || {};

    return res.members.reduce((acc: Record<string, number>, member: any) => {
      const count = member.count ?? member.streams ?? 0;
      // Use id as primary key, key as fallback for backward compatibility
      if (member.id) {
        acc[member.id] = count;
      }
      if (member.key && member.key !== member.id) {
        acc[member.key] = count; // Alias mapping
      }
      return acc;
    }, {});
  },

  /**
   * Busca estatísticas de uma entidade (track, artist, album) via backend Vercel
   */
  async fetchEntityStats(userId: string, type: 'track' | 'artist' | 'album', id: string, range?: string): Promise<number> {
    try {
      const userParam = coreUtils.getUserApiParam(userId);
      const params: any = { user: userParam, type, id, limit: 1 };
      if (range) params.range = range;
      
      let data: any;
      try {
        data = await fetchFromApi<any>('/api/entity-stats', params);
      } catch {
        data = await fetchFromApi<any>('/api/entity-streams', params);
      }
      return data?.count || data?.streams || data?.total || data?.items?.length || 0;
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

        return normalizeGroupStats(data);
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

      return normalizeGroupStats(data);
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

      // Prioritize pre-calculated rankings from API
      if (response.rankings) {
        // If rankings is already in the expected format
        if (typeof response.rankings === 'object' && !Array.isArray(response.rankings)) {
          // Check if it's already Record<userId, { count, durationMs }>
          const firstKey = Object.keys(response.rankings)[0];
          if (firstKey && typeof response.rankings[firstKey] === 'object' && 'count' in response.rankings[firstKey]) {
            return response.rankings;
          }
        }

        // If rankings come as arrays by period (today, week, month, etc.)
        if (typeof response.rankings === 'object') {
          const periodKey = backendRange || range;
          const periodRankings = response.rankings[periodKey] || response.rankings[range];

          if (Array.isArray(periodRankings)) {
            const rankingsResult: Record<string, { count: number, durationMs: number }> = {};
            periodRankings.forEach((item: any) => {
              const userId = item.id || item.userId || item.user;
              if (userId) {
                rankingsResult[userId] = {
                  count: item.count || item.streams || 0,
                  durationMs: item.durationMs || item.playedMs || 0
                };
              }
            });
            if (Object.keys(rankingsResult).length > 0) {
              return rankingsResult;
            }
          }
        }
      }

      // Fallback: calculate from members
      const rankingsResult: Record<string, { count: number, durationMs: number }> = {};

      if (response.members) {
        response.members.forEach((m: any) => {
          const uid = m.id;
          if (!uid) return;

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
    const userParam = coreUtils.getUserApiParam(userId);
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
    const userParam = coreUtils.getUserApiParam(userId);
    const cacheKey = `${coreUtils.getUserCacheKey(userId)}:${type}:${period}`;
    try {
      const { useStatsStore } = await import('../store/useStatsStore');
      const store = useStatsStore.getState();
      const cachedTopItems = store.getTopItemsFromCache?.(cacheKey);
      if (cachedTopItems) {
        if ((import.meta as any).env?.DEV) console.log(`[statsService] Serving valid cached top items for ${cacheKey}`);
        return cachedTopItems;
      }
      
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
    const userParam = coreUtils.getUserApiParam(userId);
    const cacheKey = `${coreUtils.getUserCacheKey(userId)}:${after}`;
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
    const userParam = coreUtils.getUserApiParam(userId);
    const cacheKey = `cardinality:${coreUtils.getUserCacheKey(userId)}:${after}`;
    try {
      const { useStatsStore } = await import('../store/useStatsStore');
      const store = useStatsStore.getState();
      const cached = store.getTimeRangeStatsFromCache?.(cacheKey);
      if (cached) return cached;

      const res = await fetchFromApi<any>('/api/stats-cardinality', { user: userParam, after });
      store.setTimeRangeStatsCache?.(cacheKey, res);
      return res;
    } catch (e) {
      console.error(`Failed to load time-range cardinality for ${userId}`, e);
      try {
        const { useStatsStore } = await import('../store/useStatsStore');
        const store = useStatsStore.getState();
        const cached = store.getTimeRangeStatsFromCache?.(cacheKey, true) ?? store.timeRangeStatsCache?.[cacheKey];
        if (cached) return cached;
      } catch {}
      return {};
    }
  },

  /**
   * Busca distribuição temporal do período (heatmap, etc)
   */
  async fetchTimeRangeDates(userId: string, after: number): Promise<any> {
    const userParam = coreUtils.getUserApiParam(userId);
    const cacheKey = `dates:${coreUtils.getUserCacheKey(userId)}:${after}`;
    try {
      const { useStatsStore } = await import('../store/useStatsStore');
      const store = useStatsStore.getState();
      const cached = store.getTimeRangeStatsFromCache?.(cacheKey);
      if (cached) return cached;

      const res = await fetchFromApi<any>('/api/stats-dates', { user: userParam, after });
      store.setTimeRangeStatsCache?.(cacheKey, res);
      return res;
    } catch (e: any) {
      if (e.response?.status !== 404) {
        console.error(`Failed to load time-range dates for ${userId}`, e);
      }
      try {
        const { useStatsStore } = await import('../store/useStatsStore');
        const store = useStatsStore.getState();
        const cached = store.getTimeRangeStatsFromCache?.(cacheKey, true) ?? store.timeRangeStatsCache?.[cacheKey];
        if (cached) return cached;
      } catch {}
      return {};
    }
  }
};
