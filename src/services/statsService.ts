/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';
import { UserStats, GroupStats } from '../types/stats';
import { coreUtils, GROUP_USERS } from './statsCore';

const API_BASE_URL = "https://statslc.leosaquetto.com";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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
    if (status === 429) throw error; // Sem retry para Rate Limit
    
    // Sem retry automático em requests forçadas, e apenas 1 retry normal para 503/504
    const isRetryable = !forceRefresh && (status === 504 || status === 503 || error.code === 'ECONNABORTED');
    
    if (isRetryable && retries > 0) {
      if ((import.meta as any).env?.DEV) console.warn(`Retryable error [${status || error.code}] on ${endpoint}. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchFromApi(endpoint, params, forceRefresh, retries - 1);
    }

    if ((import.meta as any).env?.DEV) console.error(`Vercel API Fetch Error [${endpoint}]:`, error.response?.data || error.message);
    throw error;
  }
};

let groupRequestInFlight: Promise<GroupStats> | null = null;

export const statsService = {
  getUsers: () => ([] as any[]),

  /**
   * Busca streams recentes de um amigo via backend Vercel
   */
  async fetchRecent(userId: string, limit = 50, offset = 0): Promise<any[]> {
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
   * Busca estatísticas de uma entidade (track, artist, album) via backend Vercel
   */
  async fetchEntityStats(userId: string, type: 'track' | 'artist' | 'album', id: string): Promise<number> {
    try {
      const userParam = userId;
      const data = await fetchFromApi<any>('/api/entity-stats', { user: userParam, type, id });
      return data?.count || 0;
    } catch (e) {
      return 0;
    }
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
            totalStreams: m.stats?.month?.streams ?? 0,
            totalDurationMs: m.stats?.month?.durationMs || m.stats?.month?.playedMs || 0,
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
      const errorMessage = e.response?.data?.message || e.message || "Unknown error";
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
      const response = await fetchFromApi<any>('/api/group');
      
      const rangeMap: Record<string, string> = {
        'today': 'today',
        'weeks': 'week',
        'months': 'month',
        'years': 'year',
        'lifetime': 'lifetime'
      };
      
      const backendRange = rangeMap[range];
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
              count = m.stats?.year?.streams || 0; 
              durationMs = m.stats?.year?.durationMs || m.stats?.year?.playedMs || 0;
              break;
            case 'lifetime': 
              count = m.stats?.lifetime?.streams || 0; 
              durationMs = m.stats?.lifetime?.durationMs || m.stats?.lifetime?.playedMs || 0;
              break;
          }
          rankingsResult[uid] = { count, durationMs };
        });
      }
      
      // Se o backend já tiver um ranking processado (usualmente por streams), podemos usá-lo para validar
      // mas o loop acima cobrindo todos os membros com durationMs é mais completo para nossa UI.
      
      console.log(`[statsService] getRankings result for range ${range}:`, rankingsResult);
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
    const res = await fetchFromApi<any>('/api/user', { user: userParam });
    console.log(`[statsService] getUserFullStats for ${userId}:`, res);
    return res;
  },

  /**
   * Busca top itens via backend Vercel
   */
  async getTopItems(userId: string, type: 'tracks' | 'artists' | 'albums', period: 'week' | 'month' | 'year' | 'lifetime' = 'month'): Promise<any[]> {
    const userParam = userId;
    const res = await fetchFromApi<any>('/api/top', { user: userParam, type, period });
    console.log(`[statsService] getTopItems for ${userId} (${type}, ${period}):`, res);
    return res?.items || [];
  },

  /**
   * Busca estatísticas avançadas por período
   */
  async fetchTimeRangeStats(userId: string, after: number): Promise<any> {
    const userParam = userId;
    const res = await fetchFromApi<any>('/api/stats', { user: userParam, after });
    console.log(`[statsService] fetchTimeRangeStats for ${userId}:`, res);
    return res;
  }
};
