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
  timeout: 20000,
});

/**
 * Utilitário para chamadas à nossa API Backend na Vercel
 */
const fetchFromApi = async <T>(endpoint: string, params: Record<string, any> = {}, forceRefresh = false): Promise<T> => {
  try {
    const finalParams = { ...params };
    if (forceRefresh) finalParams.force = '1';

    const response = await api.get(endpoint, { params: finalParams });
    return response.data;
  } catch (error: any) {
    console.error(`Vercel API Fetch Error [${endpoint}]:`, error.response?.data || error.message);
    throw error;
  }
};

export const statsService = {
  getUsers: () => Object.values(GROUP_USERS),

  /**
   * Busca streams recentes de um amigo via backend Vercel
   */
  async fetchFriendRecents(userId: string, limit = 50): Promise<any[]> {
    try {
      // Mapeamento de ID para o "slug" esperado no backend se necessário
      const userParam = GROUP_USERS.LEO.id === userId ? 'leo' : userId; 
      const res = await fetchFromApi<any>('/api/recent', { user: userParam, limit });
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
      const userParam = GROUP_USERS.LEO.id === userId ? 'leo' : userId;
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
            nowPlaying = {
              isNow: m.nowPlaying.isNow || false,
              timestamp: m.nowPlaying.timestamp || new Date().toISOString(),
              progressMs: m.nowPlaying.progressMs,
              track: {
                id: track?.id,
                name: track?.name || "Desconhecido",
                artists: track?.artists || [],
                image: track?.image,
                albumName: track?.album?.name,
                durationMs: track?.durationMs,
                playedCount: track?.playedCount,
                spotifyId: track?.spotifyId,
                appleMusicId: track?.appleMusicId
              }
            };
          }

          const user: UserStats = {
            id: uid,
            name: m.profile?.displayName || uid,
            avatar: m.profile?.image,
            streamsToday: m.stats?.today?.streams || 0,
            totalStreams: m.stats?.lifetime?.streams || m.stats?.month?.streams || 0,
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
        lastUpdated: data.lastUpdated || new Date().toISOString()
      };
    } catch (e: any) {
      const errorMessage = e.response?.data?.message || e.message || "Unknown error";
      throw new Error(`Erro ao sincronizar grupo: ${errorMessage}`);
    }
  },

  /**
   * Busca rankings baseados nos dados do grupo
   */
  async getRankings(range: 'weeks' | 'months' | 'lifetime' | 'today' = 'months'): Promise<any> {
    const data = await this.getGroupData();
    const rankings: Record<string, any> = {};
    
    Object.keys(data.users).forEach(uid => {
      const u = data.users[uid];
      let count = 0;
      
      switch (range) {
        case 'today':
          count = u.streamsToday || 0;
          break;
        case 'weeks':
          // O backend Vercel /api/group pode não ter 'week' separado, 
          // então usamos scrobbles ou totalStreams como aproximação se necessário, 
          // ou simplesmente streamsToday se for o único dado live.
          count = (u as any).streamsWeek || u.streamsToday || 0;
          break;
        case 'months':
          count = (u as any).totalStreams || u.streamsToday || 0;
          break;
        case 'lifetime':
          count = u.scrobbles || (u as any).totalStreams || 0;
          break;
      }
      
      rankings[uid] = { count };
    });
    
    return rankings;
  },

  /**
   * Busca dados completos de um usuário específico via backend Vercel
   */
  async getUserFullStats(userId: string): Promise<any> {
    const userParam = GROUP_USERS.LEO.id === userId ? 'leo' : userId;
    return fetchFromApi<any>('/api/user', { user: userParam });
  },

  /**
   * Busca top itens via backend Vercel
   */
  async getTopItems(userId: string, type: 'tracks' | 'artists' | 'albums', period: 'week' | 'month' | 'year' | 'lifetime' = 'month'): Promise<any[]> {
    const userParam = GROUP_USERS.LEO.id === userId ? 'leo' : userId;
    const res = await fetchFromApi<any>('/api/top', { user: userParam, type, period });
    return res?.items || [];
  },

  /**
   * Busca estatísticas avançadas por período
   */
  async fetchTimeRangeStats(userId: string, after: number): Promise<any> {
    const userParam = GROUP_USERS.LEO.id === userId ? 'leo' : userId;
    return fetchFromApi<any>('/api/stats', { user: userParam, after });
  }
};
