/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';
import { UserStats, GroupStats } from '../types/stats';
import { coreUtils, GROUP_USERS } from './statsCore';

const api = axios.create({
  timeout: 15000,
});

/**
 * Utilitário para chamadas à nossa API Backend
 */
const fetchFromApi = async <T>(endpoint: string, params: Record<string, any> = {}, forceRefresh = false): Promise<T> => {
  try {
    const response = await api.get(endpoint, { 
      params: { ...params, refresh: forceRefresh ? 'true' : undefined } 
    });
    return response.data;
  } catch (error: any) {
    console.error(`API Fetch Error [${endpoint}]:`, error.message);
    throw error;
  }
};

export const statsService = {
  getUsers: () => Object.values(GROUP_USERS),

  /**
   * Busca detalhes de um álbum via proxy
   */
  async fetchAlbumDetails(albumId: string): Promise<any> {
    if (!albumId) return null;
    return fetchFromApi<any>('/api/stats/proxy', { path: `/albums/${albumId}` });
  },

  /**
   * Busca streams recentes de todos os amigos (Atividade Global)
   */
  async fetchGlobalRecents(): Promise<any[]> {
    const users = this.getUsers();
    const allRecents: any[] = [];
    
    const promises = users.map(async (u) => {
      try {
        const items = await this.fetchFriendRecents(u.id);
        const enriched = items.map(item => ({
          ...item,
          user: { id: u.id, name: u.name, avatar: coreUtils.getAvatarUrl(u.id) }
        }));
        allRecents.push(...enriched);
      } catch (e) {
        console.warn(`Erro ao buscar recentes de ${u.name}`);
      }
    });

    await Promise.all(promises);
    return allRecents.sort((a, b) => new Date(b.playedAt || b.timestamp).getTime() - new Date(a.playedAt || a.timestamp).getTime());
  },

  /**
   * Busca streams recentes de um amigo via proxy
   */
  async fetchFriendRecents(userId: string): Promise<any[]> {
    try {
      const res = await fetchFromApi<any>('/api/stats/proxy', { path: `/users/${userId}/streams/recent`, limit: 50 });
      return res?.items || [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Busca estatísticas de uma música específica para um usuário via proxy
   */
  async fetchTrackStatsForUser(userId: string, trackId: string): Promise<number> {
    try {
      const data = await fetchFromApi<any>('/api/stats/proxy', { path: `/users/${userId}/streams/tracks/${trackId}/stats` });
      return data?.items?.count ?? data?.item?.count ?? data?.count ?? 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Busca detalhes completos de uma track via proxy
   */
  async fetchTrackDetails(trackId: string): Promise<any> {
    if (!trackId) return null;
    try {
      const res = await fetchFromApi<any>('/api/stats/proxy', { path: `/tracks/${trackId}` });
      return res?.item || null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Busca estatísticas de um álbum para um usuário via proxy
   */
  async fetchAlbumStatsForUser(userId: string, albumId?: string): Promise<number> {
    if (!albumId) return 0;
    try {
      const data = await fetchFromApi<any>('/api/stats/proxy', { path: `/users/${userId}/streams/albums/${albumId}/stats` });
      return data?.items?.count ?? data?.item?.count ?? data?.count ?? 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Busca estatísticas de um artista para um usuário via proxy
   */
  async fetchArtistStatsForUser(userId: string, artistId?: string): Promise<number> {
    if (!artistId) return 0;
    try {
      const data = await fetchFromApi<any>('/api/stats/proxy', { path: `/users/${userId}/streams/artists/${artistId}/stats` });
      return data?.items?.count ?? data?.item?.count ?? data?.count ?? 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Coleta estatísticas detalhadas (Track + Album + Artist) para o grupo
   */
  async fetchGroupDetailedTrackStats(track: any): Promise<Record<string, { track: number, album: number, artist: number }>> {
    const users = this.getUsers();
    const results: Record<string, { track: number, album: number, artist: number }> = {};
    
    const albumId = track.albums?.[0]?.id || track.album?.id;
    const mainArtistId = track.artists?.[0]?.id;

    const promises = users.map(async (u) => {
      const [tCount, alCount, arCount] = await Promise.all([
        this.fetchTrackStatsForUser(u.id, track.id),
        this.fetchAlbumStatsForUser(u.id, albumId),
        this.fetchArtistStatsForUser(u.id, mainArtistId)
      ]);
      results[u.id] = { track: tCount, album: alCount, artist: arCount };
    });

    await Promise.all(promises);
    return results;
  },

  /**
   * Busca dados agregados do grupo (Dashboard principal)
   * Agora chama diretamente o nosso agregador no backend
   */
  async getGroupData(forceRefresh = false): Promise<GroupStats> {
    try {
      const data = await fetchFromApi<any>('/api/stats/group', {}, forceRefresh);
      
      // Normalização final no frontend (paddings de avatar, fallbacks de UI)
      const users: Record<string, UserStats> = {};
      Object.keys(data.users).forEach(uid => {
        const u = data.users[uid];
        users[uid] = {
          ...u,
          avatar: coreUtils.getAvatarUrl(uid, u.avatar)
        };
      });

      return {
        users,
        lastUpdated: data.lastUpdated
      };
    } catch (e) {
      console.error("Dashboard Aggregator failed:", e);
      // Fallback básico se o backend falhar completamente
      return {
        users: {},
        lastUpdated: new Date().toISOString()
      };
    }
  },

  /**
   * Busca rankings (Substitui o antigo pesado.json)
   */
  async getRankings(range: 'weeks' | 'months' | 'lifetime' | 'today' = 'months'): Promise<any> {
    return fetchFromApi<any>('/api/stats/rankings', { range });
  },

  /**
   * Busca dados completos de um usuário específico via backend
   */
  async getUserFullStats(userId: string): Promise<any> {
    return fetchFromApi<any>(`/api/stats/user/${userId}`);
  }
};
