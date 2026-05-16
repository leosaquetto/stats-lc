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
const fetchFromApi = async <T>(endpoint: string, params: Record<string, any> = {}, forceRefresh = false, retries = 2): Promise<T> => {
  try {
    const finalParams = { ...params };
    if (forceRefresh) finalParams.force = '1';

    const response = await api.get(endpoint, { params: finalParams });
    return response.data;
  } catch (error: any) {
    const isRetryable = error.response?.status === 504 || error.response?.status === 503 || error.code === 'ECONNABORTED';
    
    if (isRetryable && retries > 0) {
      console.warn(`Retryable error [${error.response?.status || error.code}] on ${endpoint}. Retrying... (${retries} left)`);
      // Pequeno delay antes de tentar de novo
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchFromApi(endpoint, params, forceRefresh, retries - 1);
    }

    console.error(`Vercel API Fetch Error [${endpoint}]:`, error.response?.data || error.message);
    throw error;
  }
};

export const statsService = {
  getUsers: () => ([] as any[]),

  /**
   * Busca streams recentes de um amigo via backend Vercel
   */
  async fetchRecent(userId: string, limit = 50, offset = 0): Promise<any[]> {
    try {
      const userParam = userId; 
      const res = await fetchFromApi<any>('/api/recent', { user: userParam, limit, offset });
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
    try {
      const data = await fetchFromApi<any>('/api/group', {}, forceRefresh);
      console.log("GROUP RESPONSE", data);
      
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
                albumName: track?.album?.name,
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
            totalDurationMs: m.stats?.month?.durationMs ?? 0,
            scrobbles: m.stats?.lifetime?.streams || 0,
            nowPlaying
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
    }
  },

  /**
   * Busca rankings baseados nos dados do grupo
   */
  async getRankings(range: 'weeks' | 'months' | 'years' | 'lifetime' | 'today' = 'months'): Promise<any> {
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
      const rankingsResult: Record<string, any> = {};

      if (response.rankings?.[backendRange] && Array.isArray(response.rankings[backendRange])) {
        // Backend returns an array of { key: string, streams: number }
        response.rankings[backendRange].forEach((item: any) => {
          rankingsResult[item.key || item.id] = { count: item.streams || 0 };
        });
        return rankingsResult;
      }

      if (response.members) {
        response.members.forEach((m: any) => {
          const uid = m.key || m.id;
          let count = 0;
          switch (range) {
            case 'today': count = m.stats?.today?.streams || 0; break;
            case 'weeks': count = m.stats?.week?.streams || 0; break;
            case 'months': count = m.stats?.month?.streams || 0; break;
            case 'years': count = m.stats?.year?.streams || 0; break;
            case 'lifetime': count = m.stats?.lifetime?.streams || 0; break;
          }
          rankingsResult[uid] = { count };
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
    return fetchFromApi<any>('/api/user', { user: userParam });
  },

  /**
   * Busca top itens via backend Vercel
   */
  async getTopItems(userId: string, type: 'tracks' | 'artists' | 'albums', period: 'week' | 'month' | 'year' | 'lifetime' = 'month'): Promise<any[]> {
    const userParam = userId;
    const res = await fetchFromApi<any>('/api/top', { user: userParam, type, period });
    return res?.items || [];
  },

  /**
   * Busca estatísticas avançadas por período
   */
  async fetchTimeRangeStats(userId: string, after: number): Promise<any> {
    const userParam = userId;
    return fetchFromApi<any>('/api/stats', { user: userParam, after });
  }
};
