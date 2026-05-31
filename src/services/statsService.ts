
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';
import { UserStats, GroupStats, LyricsMatch, LyricsFullResponse } from '../types/stats';
import { coreUtils, GROUP_USERS } from './statsCore';
import { getCanonicalMembers } from '../lib/memberSelectors';
import { getStoreAdapter } from './storeAdapter';

const getBaseUrl = () => {
  const envBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_STATS_API_BASE_URL;
  if (envBaseUrl) return String(envBaseUrl).replace(/\/$/, "");

  // Em desenvolvimento, usa proxy local
  if ((import.meta as any).env?.DEV) {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return "";
  }

  // Em produção, usa API real
  return "https://statslc.leosaquetto.com";
};

const API_BASE_URL = getBaseUrl();
const GENIUS_EMBED_TIMEOUT_MS = 7000;

if ((import.meta as any).env?.DEV) {
  console.log('[statsService] API_BASE_URL:', API_BASE_URL);
}

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

const getArtistName = (artist: any) => {
  if (!artist) return undefined;
  if (typeof artist === 'string') return artist;
  return artist.name || artist.artistName || artist.displayName;
};

const decodeHtml = (value: string) => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const htmlToText = (value: string) => {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|h[1-6])>/gi, '\n')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const extractGeniusEmbedLyrics = (script: string) => {
  const encodedMatch = script.match(/document\.write\(JSON\.parse\('((?:\\.|[^'])*)'\)\)/);
  if (!encodedMatch) return null;

  try {
    const htmlJson = JSON.parse(`"${encodedMatch[1].replace(/\\'/g, "'")}"`);
    const html = JSON.parse(htmlJson);
    const bodyMatch = html.match(/<div\b[^>]*class=["'][^"']*\brg_embed_body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    return bodyMatch ? htmlToText(bodyMatch[1]) : null;
  } catch {
    return null;
  }
};

const fetchGeniusEmbedLyrics = async (songId: string | number) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), GENIUS_EMBED_TIMEOUT_MS);

  try {
    const response = await fetch(`https://genius.com/songs/${encodeURIComponent(String(songId))}/embed.js`, {
      headers: {
        Accept: 'text/javascript,application/javascript;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return extractGeniusEmbedLyrics(await response.text());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
};

const normalizeTrack = (track: any) => {
  if (!track) return undefined;

  const albumArtist =
    track.albumArtist ||
    track.albumArtistName ||
    track.album?.artist ||
    track.album?.artistName ||
    track.album?.primaryArtist ||
    track.album?.primaryArtistName;
  const albumArtistName = getArtistName(albumArtist);

  return {
    id: track.id,
    name: track.name,
    artists: track.artists || [],
    primaryArtist: albumArtist && typeof albumArtist !== 'string' ? albumArtist : track.primaryArtist,
    primaryArtistId: (albumArtist && typeof albumArtist !== 'string' ? albumArtist.id : undefined) || track.primaryArtistId,
    primaryArtistName: albumArtistName || track.primaryArtistName || getPrimaryArtistName(track.artists),
    secondaryArtists: track.secondaryArtists,
    image: track.image,
    album: track.album,
    albums: track.albums,
    albumId: track.albumId || track.album?.id,
    albumName: track.albumName || track.album?.name,
    albumArtist,
    albumArtistId: track.albumArtistId || track.album?.artistId || track.album?.primaryArtistId || track.album?.artist?.id || track.album?.primaryArtist?.id,
    albumArtistName: track.albumArtistName || albumArtistName || track.album?.artistName || track.album?.primaryArtistName || track.album?.artist?.name || track.album?.primaryArtist?.name,
    albumImage: track.albumImage || track.album?.image,
    durationMs: track.durationMs,
    playedCount: track.playedCount,
    spotifyId: track.spotifyId,
    appleMusicId: track.appleMusicId,
    catalogAvailability: track.catalogAvailability,
    externalIds: track.externalIds
  };
};

const normalizeRecentStream = (stream: any) => {
  if (!stream) return stream;

  const rawTrack = stream.track || {};
  const track = normalizeTrack({
    ...rawTrack,
    id: rawTrack.id ?? stream.trackId,
    name: rawTrack.name || stream.trackName,
    durationMs: rawTrack.durationMs ?? stream.durationMs ?? stream.playedMs,
    image: rawTrack.image || stream.trackImage || stream.albumImage || stream.album?.image,
    artists: rawTrack.artists?.length ? rawTrack.artists : stream.artists || stream.album?.artists || [],
    primaryArtist: rawTrack.primaryArtist || stream.primaryArtist || stream.albumArtist,
    primaryArtistId: rawTrack.primaryArtistId || stream.primaryArtistId || stream.albumArtistId,
    primaryArtistName: rawTrack.primaryArtistName || stream.primaryArtistName || stream.albumArtistName,
    album: rawTrack.album || stream.album,
    albums: rawTrack.albums || stream.albums,
    albumId: rawTrack.albumId || stream.albumId,
    albumName: rawTrack.albumName || stream.albumName,
    albumImage: rawTrack.albumImage || stream.albumImage,
    albumArtist: rawTrack.albumArtist || stream.albumArtist,
    albumArtistId: rawTrack.albumArtistId || stream.albumArtistId,
    albumArtistName: rawTrack.albumArtistName || stream.albumArtistName,
  });

  return {
    ...stream,
    track,
    durationMs: stream.durationMs ?? track?.durationMs,
  };
};

const normalizeNowPlaying = (nowPlaying: any) => {
  if (!nowPlaying) return undefined;

  const track = normalizeTrack(nowPlaying.track);
  if (!track) return undefined;
  const ts = nowPlaying.timestamp || nowPlaying.playedAt || nowPlaying.endTime || new Date().toISOString();
  const platformCandidate = nowPlaying.platformCandidate || nowPlaying.serviceCandidate;
  const progressMs = nowPlaying.progressMs ?? nowPlaying.playedMs;
  const playedMs = nowPlaying.playedMs ?? nowPlaying.progressMs;

  return {
    isNow: nowPlaying.isNow !== undefined ? nowPlaying.isNow : (Date.now() - new Date(ts).getTime() < 300000),
    timestamp: ts,
    playedAt: nowPlaying.playedAt,
    endTime: nowPlaying.endTime,
    playbackKey: nowPlaying.playbackKey,
    streamId: nowPlaying.streamId,
    stream: nowPlaying.stream,
    progressMs,
    durationMs: nowPlaying.durationMs || track?.durationMs,
    playedMs,
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
  const seenMemberIds = new Set<string>();

  if (data?.members && Array.isArray(data.members)) {
    data.members.forEach((member: any) => {
      const user = normalizeMember(member);
      if (!user) return; // Skip members without id
      users[user.id] = user;
      if (seenMemberIds.has(user.id)) return;
      seenMemberIds.add(user.id);
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
const API_RESPONSE_CACHE_TTL = 5 * 60 * 1000;
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

type ApiRequestOptions = {
  signal?: AbortSignal;
};

const fetchFromApi = async <T>(
  endpoint: string,
  params: Record<string, any> = {},
  forceRefresh = false,
  retries = 1,
  useDedupe = true,
  requestOptions: ApiRequestOptions = {}
): Promise<T> => {
  const finalParams = { ...params };
  const sendsForceParam = forceRefresh && endpoint !== '/api/group' && endpoint !== '/api/group-live';
  if (sendsForceParam) finalParams.force = '1';

  const cacheKey = getApiCacheKey(endpoint, finalParams, sendsForceParam);
  const now = Date.now();
  const shouldUseResponseCache = endpoint !== '/api/group-live';

  if (!forceRefresh && useDedupe && shouldUseResponseCache) {
    const cached = apiResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }
  }

  if (!forceRefresh && useDedupe) {
    const running = apiRequestInFlight.get(cacheKey);
    if (running) {
      return running as Promise<T>;
    }
  }

  const request = (async (): Promise<T> => {
    try {
      const response = await api.get(endpoint, { params: finalParams, signal: requestOptions.signal });
      if (!forceRefresh && shouldUseResponseCache) {
        apiResponseCache.set(cacheKey, {
          data: response.data,
          expiresAt: Date.now() + API_RESPONSE_CACHE_TTL,
        });
      }
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const isNetworkError = !error.response && error.request;

      const isOptionalDatesEndpoint = endpoint === '/api/stats-dates';
      const isExpectedEmptyTopRange =
        endpoint === '/api/top' &&
        status === 400 &&
        error.response?.data?.error === 'upstream_error';
      if ((import.meta as any).env?.DEV && !isOptionalDatesEndpoint && !isExpectedEmptyTopRange) {
        console.error(`Vercel API Fetch Error [${endpoint}]:`, {
          message: error.message,
          code: error.code,
          status: status,
          isNetworkError,
          data: error.response?.data
        });
      }

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
        return fetchFromApi(endpoint, params, forceRefresh, retries - 1, false, requestOptions);
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

export type ReplayPeriodQuery = {
  period: 'today' | 'week' | 'month' | 'year' | 'lifetime' | 'all' | '7days';
  after?: number;
  before?: number;
  limit?: number;
  force?: boolean;
  signal?: AbortSignal;
};

export type ComparePeriodQuery = {
  users: string[];
  period?: '4w' | '6m' | 'all' | 'month' | 'week';
  limit?: number;
  commonMode?: 'any' | 'all';
  minSharedBy?: number;
  force?: boolean;
  signal?: AbortSignal;
};

let groupRequestInFlight: Promise<GroupStats> | null = null;
let liveRequestInFlight: Promise<GroupStats> | null = null;

export const statsService = {
  normalizeMember,
  normalizeRecentStream,
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
      const res = await fetchFromApi<any>('/api/user-streams', {
        user: userParam,
        limit,
        offset,
        resolveAlbums: 1,
      });
      if ((import.meta as any).env?.DEV) console.log(`[statsService] fetchRecent for ${userId}:`, res);
      return (res?.items || []).map(normalizeRecentStream);
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

  async fetchEntityStreams(userId: string, type: 'track' | 'artist' | 'album', id: string, limit = 200): Promise<any[]> {
    if (!id) return [];
    try {
      const userParam = coreUtils.getUserApiParam(userId);
      const res = await fetchFromApi<any>('/api/entity-streams', {
        user: userParam,
        type,
        id,
        limit,
        resolveAlbums: 1,
      });
      return res?.items || [];
    } catch (e) {
      if ((import.meta as any).env?.DEV) {
        console.warn(`[statsService] Entity streams unavailable for ${type}:${id}`, e);
      }
      return [];
    }
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
        const data = await fetchFromApi<any>('/api/group-live', { resolveAlbums: 1, profile: 0 }, forceRefresh, 1, !forceRefresh);
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
      let cachedMembers: UserStats[] = [];

      // Otimização: Tentar usar dados do store primeiro se estiverem frescos (menos de 5 minutos)
      try {
        const adapter = getStoreAdapter();
        const state = adapter.getState();
        const lastFetch = state.lastFetchTime.group;
        const now = Date.now();
        const CACHE_TTL = 5 * 60 * 1000;
        
        cachedMembers = getCanonicalMembers(state.groupStats);

        if (state.groupStats && (now - lastFetch < CACHE_TTL || state.isOffline)) {
          const rankingsResult: Record<string, { count: number, durationMs: number }> = {};
          
          cachedMembers.forEach((m) => {
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

      if (!cachedMembers.length) return {};

      if (range === 'lifetime') {
        return cachedMembers.reduce<Record<string, { count: number, durationMs: number }>>((acc, member) => {
          acc[member.id] = {
            count: member.totalStreams || member.scrobbles || 0,
            durationMs: member.totalDurationMs || 0,
          };
          return acc;
        }, {});
      }

      const now = new Date();
      const afterByRange = {
        today: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
        weeks: Date.now() - 7 * 24 * 60 * 60 * 1000,
        months: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        years: new Date(now.getFullYear(), 0, 1).getTime(),
        lifetime: 0,
      } as const;
      const after = afterByRange[range];
      const results = await Promise.allSettled(
        cachedMembers.map(async (member) => {
          const userParam = coreUtils.getUserApiParam(member.id);
          const stats = await fetchFromApi<any>('/api/stats', { user: userParam, after });
          return {
            id: member.id,
            count: stats?.streams || 0,
            durationMs: stats?.durationMs || 0,
          };
        })
      );
      const rankingsResult: Record<string, { count: number, durationMs: number }> = {};

      results.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        rankingsResult[result.value.id] = {
          count: result.value.count,
          durationMs: result.value.durationMs,
        };
      });

      return rankingsResult;
    } catch (e) {
      console.error("Rankings error:", e);
      return {};
    }
  },

  /**
   * Busca dados completos de um usuário específico via backend Vercel
   */
  async getUserFullStats(userId: string, options: ApiRequestOptions = {}): Promise<any> {
    const userParam = coreUtils.getUserApiParam(userId);
    try {
      const adapter = getStoreAdapter();
        const store = adapter.getState();
      
      // Tenta carregar do cache robusto (valida 5 minutos de TTL se estiver online/navigator indica conectado; do contrário, serve cache)
      if (store.getUserFullStatsFromCache) {
        const cached = store.getUserFullStatsFromCache(userId);
        if (cached) {
          if ((import.meta as any).env?.DEV) console.log(`[statsService] Serving valid cached userFullStats for ${userId}`);
          return cached;
        }
      }
      
      const res = await fetchFromApi<any>('/api/user', { user: userParam }, false, 1, true, options);
      
      // Atualiza o cache do store
      if (store.setUserFullStatsCache) {
        store.setUserFullStatsCache(userId, res);
      }
      
      if ((import.meta as any).env?.DEV) console.log(`[statsService] getUserFullStats for ${userId}:`, res);
      return res;
    } catch (e) {
      console.error(`Failed to load full stats for ${userId}. Falling back to cache:`, e);
      try {
        const adapter = getStoreAdapter();
        const store = adapter.getState();
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

  async getReplayData(userId: string, query: ReplayPeriodQuery): Promise<{ totalSongs?: number; totalDurationMs?: number; topArtists: any[]; topTracks: any[]; topAlbums: any[] }> {
    const userParam = coreUtils.getUserApiParam(userId);
    const params: any = {
      user: userParam,
      period: query.period === 'lifetime' ? 'all' : query.period,
      limit: query.limit || 12
    };
    if (query.after) params.after = query.after;
    if (query.before) params.before = query.before;

    const res = await fetchFromApi<any>('/api/replay', params, !!query.force, 1, true, { signal: query.signal });
    const totalMinutes = res?.totalMinutes ?? res?.playedMinutes ?? res?.minutes ?? res?.stats?.totalMinutes ?? res?.stats?.minutes;
    return {
      totalSongs: res?.totalSongs ?? res?.totalStreams ?? res?.count ?? res?.stats?.streams,
      totalDurationMs: res?.totalDurationMs ?? res?.durationMs ?? res?.stats?.durationMs ?? (Number.isFinite(totalMinutes) ? totalMinutes * 60000 : undefined),
      topArtists: res?.topArtists || res?.artists || res?.tops?.artists || [],
      topTracks: res?.topTracks || res?.tracks || res?.tops?.tracks || [],
      topAlbums: res?.topAlbums || res?.albums || res?.tops?.albums || []
    };
  },

  /**
   * Busca top itens via backend Vercel
   */
  async getTopItems(userId: string, type: 'tracks' | 'artists' | 'albums', period: string | ReplayPeriodQuery = 'month'): Promise<any[]> {
    const userParam = coreUtils.getUserApiParam(userId);
    const periodValue = typeof period === 'string' ? period : period.period;
    const periodKey = typeof period === 'string' ? period : stableStringify(period);
    const cacheKey = `${coreUtils.getUserCacheKey(userId)}:${type}:${periodKey}`;
    try {
      const adapter = getStoreAdapter();
        const store = adapter.getState();
      const shouldForce = typeof period !== 'string' && !!period.force && period.after !== 0 && period.period !== 'all' && period.period !== 'lifetime';
      const cachedTopItems = shouldForce ? null : store.getTopItemsFromCache?.(cacheKey);
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
      if (typeof period !== 'string') {
        if (period.after) params.after = period.after;
        if (period.before) params.before = period.before;
        if (period.limit) params.limit = period.limit;
      }
      if (periodValue === 'year' || periodValue === 'years') {
        const now = new Date();
        const after = new Date(now.getFullYear(), 0, 1).getTime();
        params.after = params.after || after;
      } else {
        params.period = this.mapPeriod(periodValue, 'top');
      }
      const res = await fetchFromApi<any>('/api/top', params, shouldForce);
      const items = res?.items || [];

      // Atualiza o cache do store
      if (store.setTopItemsCache) {
        store.setTopItemsCache(cacheKey, items);
      }

      if ((import.meta as any).env?.DEV) console.log(`[statsService] getTopItems for ${userId} (${type}, ${params.period || params.after}):`, res);
      return items;
    } catch (e: any) {
      if (e?.response?.status === 400 && e?.response?.data?.error === 'upstream_error') {
        return [];
      }
      if ((import.meta as any).env?.DEV) {
        console.warn(`[statsService] API target failed for top items (${cacheKey}). Reverting to cache.`, e);
      }
      try {
        const adapter = getStoreAdapter();
        const store = adapter.getState();
        const cached = store.topItemsCache?.[cacheKey];
        if (cached) {
          return cached;
        }
      } catch {}
      throw e;
    }
  },

  async getCompareData(query: ComparePeriodQuery): Promise<any> {
    const users = query.users.map((userId) => coreUtils.getUserApiParam(userId)).filter(Boolean);
    if (users.length < 2) {
      return { ok: false, common: { artists: [], tracks: [], albums: [] } };
    }

    return fetchFromApi<any>('/api/compare', {
      users: users.join(','),
      period: query.period || 'month',
      limit: query.limit || 50,
      ...(query.commonMode ? { commonMode: query.commonMode } : {}),
      ...(query.minSharedBy ? { minSharedBy: query.minSharedBy } : {}),
    }, !!query.force, 1, true, { signal: query.signal });
  },

  /**
   * Busca histórico global de uma faixa específica
   */
  async getTrackGlobalHistory(trackId: string): Promise<any[]> {
    try {
       const adapter = getStoreAdapter();
      const user = getCanonicalMembers(adapter.getState().groupStats)[0];
      if (!user?.id) return [];

      const userParam = coreUtils.getUserApiParam(user.id);
      const res = await fetchFromApi<any>('/api/entity-streams', {
        user: userParam,
        type: 'track',
        id: trackId,
        limit: 50,
        resolveAlbums: 1,
      });
      return res?.items || [];
    } catch (e) {
      console.error(`Failed to fetch global history for track ${trackId}`, e);
      return [];
    }
  },

  async fetchLyricsMatch(title: string, artist?: string): Promise<LyricsMatch> {
    if (!title?.trim()) {
      return { ok: true, hasLyrics: false, reason: 'missing_title' };
    }

    try {
      return await fetchFromApi<LyricsMatch>('/api/lyrics', {
        title: title.trim(),
        ...(artist?.trim() ? { artist: artist.trim() } : {}),
      }, false, 0, true);
    } catch (e) {
      if ((import.meta as any).env?.DEV) {
        console.warn('[statsService] Lyrics match unavailable:', e);
      }
      return { ok: true, hasLyrics: false, reason: 'request_failed' };
    }
  },

  async fetchLyricsFull(title: string, artist?: string): Promise<LyricsFullResponse> {
    if (!title?.trim()) {
      return { ok: true, hasLyrics: false, lyrics: null, reason: 'missing_title' };
    }

    try {
      const match = await this.fetchLyricsMatch(title, artist);
      if (match.hasLyrics && match.match?.id != null) {
        const lyrics = await fetchGeniusEmbedLyrics(match.match.id);
        if (lyrics) return { ...match, lyrics };
      }

      return await fetchFromApi<LyricsFullResponse>('/api/lyrics', {
        title: title.trim(),
        ...(artist?.trim() ? { artist: artist.trim() } : {}),
        includeLyrics: '1',
      }, false, 0, true);
    } catch (e) {
      if ((import.meta as any).env?.DEV) {
        console.warn('[statsService] Full lyrics unavailable:', e);
      }
      return { ok: true, hasLyrics: false, lyrics: null, reason: 'request_failed' };
    }
  },

  /**
   * Busca estatísticas avançadas por período
   */
  async fetchTimeRangeStats(userId: string, after: number): Promise<any> {
    const userParam = coreUtils.getUserApiParam(userId);
    const cacheKey = `${coreUtils.getUserCacheKey(userId)}:${after}`;
    try {
      const adapter = getStoreAdapter();
        const store = adapter.getState();
      
      // Tenta carregar do cache robusto (valida 5 minutos de TTL se estiver online; ou busca direto se offline)
      if (store.getTimeRangeStatsFromCache) {
        const cached = store.getTimeRangeStatsFromCache(cacheKey);
        if (cached) {
          if ((import.meta as any).env?.DEV) console.log(`[statsService] Serving valid cached timeRangeStats for ${cacheKey}`);
          return cached;
        }
      }

      const res = await fetchFromApi<any>('/api/stats', { user: userParam, after });

      // Atualiza o cache do store
      if (store.setTimeRangeStatsCache) {
        store.setTimeRangeStatsCache(cacheKey, res);
      }

      return res;
    } catch (e) {
      console.error(`Failed to load time-range stats for ${cacheKey}. Falling back to cache:`, e);
      try {
        const adapter = getStoreAdapter();
        const store = adapter.getState();
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
      const adapter = getStoreAdapter();
        const store = adapter.getState();
      const cached = store.getTimeRangeStatsFromCache?.(cacheKey);
      if (cached) return cached;

      const res = await fetchFromApi<any>('/api/stats-cardinality', { user: userParam, after });
      store.setTimeRangeStatsCache?.(cacheKey, res);
      return res;
    } catch (e) {
      console.error(`Failed to load time-range cardinality for ${userId}`, e);
      try {
        const adapter = getStoreAdapter();
        const store = adapter.getState();
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
      const adapter = getStoreAdapter();
        const store = adapter.getState();
      const cached = store.getTimeRangeStatsFromCache?.(cacheKey);
      if (cached) return cached;

      const res = await fetchFromApi<any>('/api/stats-dates', { user: userParam, after });
      store.setTimeRangeStatsCache?.(cacheKey, res);
      return res;
    } catch (_e: any) {
      try {
        const adapter = getStoreAdapter();
        const store = adapter.getState();
        const cached = store.getTimeRangeStatsFromCache?.(cacheKey, true) ?? store.timeRangeStatsCache?.[cacheKey];
        if (cached) return cached;
      } catch {}
      return {};
    }
  }
};
