import { statsService } from './statsService';
import { useStatsStore } from '../store/useStatsStore';
import { getCanonicalMembers } from '../lib/memberSelectors';

const ENTITY_STATS_TTL_MS = 5 * 60 * 1000;
const TRACK_HISTORY_TTL_MS = 5 * 60 * 1000;

export const statsCacheService = {
  // Cache for entity stats (track/artist/album)
  _entityStatsCache: new Map<string, { value: number; expiresAt: number }>(),
  _entityStatsInFlight: new Map<string, Promise<number>>(),

  // Busca estatísticas de uma entidade (track, artist, album) com cache centralizado
  async fetchEntityStats(userId: string, type: 'track' | 'artist' | 'album', id: string, range?: string): Promise<number> {
    const cacheKey = `${userId}:${type}:${id}${range ? ':'+range : ''}`;
    
    const cachedEntityStats = this._entityStatsCache.get(cacheKey);
    if (cachedEntityStats && cachedEntityStats.expiresAt > Date.now()) {
      return cachedEntityStats.value;
    }
    if (this._entityStatsInFlight.has(cacheKey)) {
      return this._entityStatsInFlight.get(cacheKey)!;
    }

    const promise = statsService.fetchEntityStats(userId, type, id, range).then(count => {
       this._entityStatsCache.set(cacheKey, { value: count, expiresAt: Date.now() + ENTITY_STATS_TTL_MS });
       return count;
    }).catch(() => 0).finally(() => {
       this._entityStatsInFlight.delete(cacheKey);
    });

    this._entityStatsInFlight.set(cacheKey, promise);
    return promise;
  },

  // Cache e lógica para Track Global History
  _trackHistoryCache: new Map<string, { items: any[]; expiresAt: number }>(),
  _trackHistoryInFlight: new Map<string, Promise<any[]>>(),

  async getTrackGlobalHistory(trackId: string): Promise<any[]> {
    const cachedTrackHistory = this._trackHistoryCache.get(trackId);
    if (cachedTrackHistory && cachedTrackHistory.expiresAt > Date.now()) {
      return cachedTrackHistory.items;
    }
    if (this._trackHistoryInFlight.has(trackId)) {
      return this._trackHistoryInFlight.get(trackId)!;
    }

    const promise = statsService.getTrackGlobalHistory(trackId).then(items => {
       this._trackHistoryCache.set(trackId, { items, expiresAt: Date.now() + TRACK_HISTORY_TTL_MS });
       return items;
    }).finally(() => {
       this._trackHistoryInFlight.delete(trackId);
    });

    this._trackHistoryInFlight.set(trackId, promise);
    return promise;
  },

  // Calcula todas as stats de um usuário UMA VEZ e salva em cache
  async cacheUserStats(userId: string) {
    const store = useStatsStore.getState();
    
    // Tenta extrair dos dados do grupo (groupStats) PRIMEIRO, pois ele é a fonte original da verdade
    const userFromGroup = store.groupStats?.users?.[userId] || getCanonicalMembers(store.groupStats).find((m: any) => m.id === userId);
    const groupYearStreams = Number(userFromGroup?.streamsYear || 0);
    if (userFromGroup && groupYearStreams > 0) {
      const stats = {
        streamsToday: userFromGroup.streamsToday || 0,
        totalStreamsThisMonth: userFromGroup.streamsMonth || 0,
        totalStreamsThisYear: groupYearStreams,
        lifetime: userFromGroup.totalStreams || 0
      };
      store.setCacheStats(userId, stats);
      return stats;
    }

    const cached = store.getCacheStats(userId);
    if (cached && (cached.totalStreamsThisYear > 0)) {
      return cached;
    }
    
    if (store.isOffline) {
      const rawCache = store.statsCache?.[userId];
      if (rawCache) return rawCache;
      return null;
    }
    
    try {
      // 3. Fallback final: busca stats de todos os períodos apenas se realmente necessário
      // Note que statsService.getStats agora também será otimizado, mas aqui é o ponto central.
      const [today, month, year, lifetime] = await Promise.all([
        statsService.getStats(userId, 'today').catch(() => ({ streams: 0 })),
        statsService.getStats(userId, 'month').catch(() => ({ streams: 0 })),
        statsService.getStats(userId, 'year').catch(() => ({ streams: 0 })),
        statsService.getStats(userId, 'lifetime').catch(() => ({ streams: 0 }))
      ]);
      
      const stats = {
        streamsToday: today.streams || 0,
        totalStreamsThisMonth: month.streams || 0,
        totalStreamsThisYear: year.streams || 0,
        lifetime: lifetime.streams || 0
      };
      
      // Salva no store
      store.setCacheStats(userId, stats);
      store.setUserPreloaded(userId);
      
      return stats;
    } catch (error) {
      console.error(`Failed to cache stats for user ${userId}:`, error);
      return null;
    }
  },

  // Busca histórico paginado e unificado (centralizado cache e fetch)
  async fetchPaginatedHistory(userId: string, offset: number = 0, limit: number = 20) {
    const store = useStatsStore.getState();
    const isOffline = store.isOffline;
    
    // Se offset 0, tenta devolver o cache imediatamente se válido e tiver a quantidade requerida
    if (offset === 0) {
      const cached = store.getHistoryCache(userId);
      if (cached && cached.length >= limit) {
        const normalizedCached = cached.map(statsService.normalizeRecentStream);
        store.setHistoryCache(userId, normalizedCached);
        return normalizedCached.slice(0, limit);
      }
      if (isOffline) {
        return cached ? cached.map(statsService.normalizeRecentStream).slice(0, limit) : [];
      }
    }

    try {
      const recentsData = await statsService.fetchRecent(userId, limit, offset);
      const enrichedData = recentsData.map((item: any) => ({
        ...item,
        playCount: item.playCount ?? item.playcount ?? item.streams ?? item.count ?? 0,
      }));

      // Se offset for 0, substituímos o cache para ser a base fresca do histórico 
      if (offset === 0) {
        store.setHistoryCache(userId, enrichedData);
      } else {
        // Se houver cache válido, appenda o novo lote paginado
        const currentCache = store.getHistoryCache(userId);
        if (currentCache) {
          const combined = [...currentCache, ...enrichedData];
          store.setHistoryCache(userId, combined);
        }
      }

      return enrichedData;
    } catch (error) {
      console.error(`Failed to fetch paginated history for user ${userId}:`, error);
      return [];
    }
  },

  // Busca e cacheia histórico de músicas recentes
  async cacheUserHistory(userId: string) {
    // Fazemos fetch de 20 para deixar a lista pronta para a Modal. O Card usará apenas os primeiros da lista.
    return this.fetchPaginatedHistory(userId, 0, 20);
  },
  
  // Pré-carrega stats de múltiplos usuários
  async cacheMultipleUsers(userIds: string[]) {
    return Promise.allSettled(
      userIds.map(id => this.cacheUserStats(id))
    );
  },
  
  // Get com fallback seguro
  getStats(userId: string) {
    const store = useStatsStore.getState();
    const cached = store.getCacheStats(userId);
    if (cached) return cached;
    
    // Fallback para groupStats se o cache específico não estiver pronto
    const userFromGroup = store.groupStats?.users?.[userId] || getCanonicalMembers(store.groupStats).find(m => m.id === userId);
    if (userFromGroup) {
      return {
        streamsToday: userFromGroup.streamsToday || 0,
        totalStreamsThisMonth: userFromGroup.streamsMonth || 0,
        totalStreamsThisYear: userFromGroup.streamsYear || 0,
        lifetime: userFromGroup.totalStreams || 0
      };
    }

    return {
      streamsToday: 0,
      totalStreamsThisMonth: 0,
      totalStreamsThisYear: 0,
      lifetime: 0
    };
  }
};
