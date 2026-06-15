/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GroupStats, LiveNowPlayingByUserId, LiveStreamsTodayByUserId, UserStats } from '../types/stats';
import { statsService } from '../services/statsService';
import { notificationService } from '../services/notificationService';
import { coreUtils } from '../services/statsCore';
import { attachLiveNowPlayingToMember, dedupeIds, getCanonicalMembers, getCanonicalMembersWithLive } from '../lib/memberSelectors';
import { getDominantColor } from '../lib/colorUtils';
import { buildTopItemsCacheKey } from '../lib/topItemUtils';
import { preloadImageAssets } from '../lib/assetRuntime';

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

const deferCacheInvalidation = (callback: () => void) => {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback);
    return;
  }
  Promise.resolve().then(callback);
};

const stripHeavyGroupStats = (groupStats: GroupStats | null): GroupStats | null => {
  if (!groupStats) return null;

  try {
    const stripped: GroupStats = {
      ...groupStats,
      users: {},
      members: []
    };

    // Strip heavy data from users
    Object.keys(groupStats.users || {}).forEach(userId => {
      const user = groupStats.users[userId];
      if (!user) return;

      stripped.users[userId] = {
        id: user.id,
        key: user.key,
        name: user.name,
        avatar: user.avatar,
        nowPlaying: user.nowPlaying,
        platform: user.platform,
        streamsToday: user.streamsToday,
        streamsWeek: user.streamsWeek,
        streamsMonth: user.streamsMonth,
        streamsYear: user.streamsYear,
        totalStreams: user.totalStreams,
        totalDurationMs: user.totalDurationMs,
        scrobbles: user.scrobbles,
        // Explicitly exclude: topItems, recent, catalogSummary, errors
      };
    });

    // Strip heavy data from members
    (groupStats.members || []).forEach(member => {
      if (!member) return;

      stripped.members!.push({
        id: member.id,
        key: member.key,
        name: member.name,
        avatar: member.avatar,
        nowPlaying: member.nowPlaying,
        platform: member.platform,
        streamsToday: member.streamsToday,
        streamsWeek: member.streamsWeek,
        streamsMonth: member.streamsMonth,
        streamsYear: member.streamsYear,
        totalStreams: member.totalStreams,
        totalDurationMs: member.totalDurationMs,
        scrobbles: member.scrobbles,
        // Explicitly exclude: topItems, recent, catalogSummary, errors
      });
    });

    return stripped;
  } catch (e) {
    console.warn('[stripHeavyGroupStats] Failed to strip:', e);
    return null;
  }
};

const extractLiveNowPlayingByUserId = (groupStats: GroupStats | null): LiveNowPlayingByUserId => {
  const live: LiveNowPlayingByUserId = {};
  getCanonicalMembers(groupStats).forEach((member) => {
    if (member?.id && member.nowPlaying) live[member.id] = member.nowPlaying;
  });
  return live;
};

const stripNowPlayingFromGroupStats = (groupStats: GroupStats | null): GroupStats | null => {
  if (!groupStats) return null;
  const stripMember = (member: UserStats): UserStats => {
    const { nowPlaying, ...rest } = member as UserStats;
    return rest as UserStats;
  };

  return {
    ...groupStats,
    users: Object.fromEntries(
      Object.entries(groupStats.users || {}).map(([id, user]) => [id, stripMember(user)])
    ),
    members: Array.isArray(groupStats.members)
      ? groupStats.members.map(stripMember)
      : groupStats.members,
  };
};

const saveGroupStatsToMMKV = (groupStats: GroupStats | null) => {
  try {
    const stripped = stripHeavyGroupStats(groupStats);
    if (stripped) {
      mmkv.set('groupStats', JSON.stringify(stripped));
      if ((import.meta as any).env?.DEV) {
        console.debug('[persist] Saved stripped groupStats to MMKV');
      }
    }
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
      console.warn('[persist] QuotaExceededError, clearing old groupStats');
      try {
        mmkv.delete('groupStats');
        mmkv.delete('groupStats_timestamp');
      } catch {}
    } else {
      console.warn('[persist] Failed to save groupStats:', e);
    }
  }
};

const isValidGroupStats = (value: any): value is GroupStats => {
  return !!value && typeof value === 'object' && Array.isArray(value.members) && value.users && typeof value.users === 'object';
};

const hasTrackStatsForUsers = (
  userTrackStats: Record<string, number>,
  users: UserStats[],
  trackId: string
) => users.every((user) => Object.prototype.hasOwnProperty.call(userTrackStats, `${user.id}:${trackId}`));

const hasAliasOnlyNames = (groupStats: GroupStats | null) => {
  if (!groupStats) return false;
  return getCanonicalMembers(groupStats).some((member: any) => {
    const name = String(member?.name || '').trim();
    const key = String(member?.key || '').trim();
    const profileDisplayName = String(member?.profile?.displayName || '').trim();
    return !!name && !!key && name === key && !profileDisplayName;
  });
};

const clearPersistedGroupCache = () => {
  try {
    mmkv.delete('groupStats');
    mmkv.delete('groupStats_timestamp');
  } catch {}
};

const HISTORY_CACHE_VERSION = 'album-v2';
const MAX_HISTORY_CACHE_ITEMS = 200;
const MAX_DETAIL_CACHE_ENTRIES = 40;
const MAX_TOP_CACHE_ENTRIES = 80;

const getHistoryCacheKey = (userId: string) => `${userId}:${HISTORY_CACHE_VERSION}`;

const trimCacheByMeta = <T>(
  cache: Record<string, T>,
  meta: Record<string, number>,
  maxEntries: number
) => {
  const keys = Object.keys(cache);
  if (keys.length <= maxEntries) return { cache, meta };

  const keep = new Set(
    keys
      .sort((a, b) => (meta[b] || 0) - (meta[a] || 0))
      .slice(0, maxEntries)
  );
  const nextCache: Record<string, T> = {};
  const nextMeta: Record<string, number> = {};

  keys.forEach((key) => {
    if (!keep.has(key)) return;
    nextCache[key] = cache[key];
    nextMeta[key] = meta[key] || 0;
  });

  return { cache: nextCache, meta: nextMeta };
};

const FRIEND_PREFETCH_DELAY_MS = 1500;
const LIVE_CACHE_PERSIST_INTERVAL_MS = 30 * 1000;
const LIVE_FETCH_MIN_INTERVAL_MS = 6000;
const LIVE_RECENT_RECOVERY_INTERVAL_MS = 12 * 1000;
const LIVE_RECENT_RECOVERY_GRACE_MS = 10 * 1000;
const TRACK_STATS_CACHE_TTL_MS = 12 * 1000;
let friendPrefetchTimer: ReturnType<typeof setTimeout> | null = null;
let friendPrefetchController: AbortController | null = null;
let lastLiveCachePersistAt = 0;
const lastLiveRecentRecoveryAtByUserId = new Map<string, number>();
const trackStatsRequestInFlight = new Map<string, Promise<void>>();
const trackStatsFetchedAt = new Map<string, number>();
const liveProbeRequestInFlight = new Map<string, Promise<boolean>>();
const lastLiveProbeSignatureByUserId = new Map<string, string>();
const LIVE_PROBE_COMPLETION_GRACE_MS = 45 * 1000;

const isExpiredInitialLiveProbeItem = (item: any, generatedAt?: string) => {
  const timestamp = item?.playedAt || item?.endTime || item?.timestamp;
  const timestampMs = timestamp ? new Date(timestamp).getTime() : Number.NaN;
  const durationMs = Number(item?.durationMs || item?.track?.durationMs || 0);
  const referenceMs = generatedAt ? new Date(generatedAt).getTime() : Date.now();

  if (!Number.isFinite(timestampMs) || !Number.isFinite(durationMs) || durationMs <= 0) {
    return false;
  }

  return timestampMs + durationMs + LIVE_PROBE_COMPLETION_GRACE_MS < referenceMs;
};

// In-flight guard for prefetchUserTops to prevent duplicate simultaneous calls
const prefetchUserTopsInFlight = new Set<string>();

type LiveFetchOptions = {
  bypassThrottle?: boolean;
};

const isLivePayloadOlder = (existing?: any, incoming?: any) => {
  if (!existing?.timestamp || !incoming?.timestamp) return false;
  const existingTime = new Date(existing.timestamp).getTime();
  const incomingTime = new Date(incoming.timestamp).getTime();
  if (!Number.isFinite(existingTime) || !Number.isFinite(incomingTime)) return false;
  return incomingTime + 1500 < existingTime;
};

const shouldUseIncomingLivePayload = (existing?: any, incoming?: any) => {
  if (!incoming) return false;
  if (!existing) return true;
  if (isLivePayloadOlder(existing, incoming)) return false;

  const existingTrackId = existing?.track?.id;
  const incomingTrackId = incoming?.track?.id;
  const existingTime = existing?.timestamp ? new Date(existing.timestamp).getTime() : 0;
  const incomingTime = incoming?.timestamp ? new Date(incoming.timestamp).getTime() : 0;
  const hasNewerTimestamp = Number.isFinite(incomingTime) && Number.isFinite(existingTime)
    ? incomingTime + 1500 >= existingTime
    : true;

  if (existing?.isNow === true && incoming?.isNow !== true && hasNewerTimestamp) return true;
  if (incomingTrackId && existingTrackId && incomingTrackId !== existingTrackId && hasNewerTimestamp) return true;
  return hasNewerTimestamp;
};

const getPlaybackTimestamp = (playback?: any) => {
  const timestamp = playback?.timestamp || playback?.playedAt || playback?.endTime;
  const parsed = timestamp ? Date.parse(timestamp) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const getPlaybackDurationMs = (playback?: any) =>
  Number(playback?.durationMs || playback?.track?.durationMs || 0);

const isPlaybackPastDuration = (playback?: any, now = Date.now()) => {
  const timestamp = getPlaybackTimestamp(playback);
  const durationMs = getPlaybackDurationMs(playback);
  return timestamp > 0 && durationMs > 0 && now > timestamp + durationMs + LIVE_RECENT_RECOVERY_GRACE_MS;
};

const buildRecoveredNowPlaying = (existing: any, recent: any, now = Date.now()) => {
  const recentTimestamp = getPlaybackTimestamp(recent);
  const existingTimestamp = getPlaybackTimestamp(existing);
  const durationMs = getPlaybackDurationMs(recent);
  if (!recentTimestamp || recentTimestamp <= existingTimestamp + 1500) return null;
  if (durationMs > 0 && now > recentTimestamp + durationMs + LIVE_RECENT_RECOVERY_GRACE_MS) return null;

  const timestamp = recent.timestamp || recent.playedAt || recent.endTime;
  return {
    ...recent,
    isNow: true,
    timestamp,
    playbackKey: recent.playbackKey || timestamp,
    platformCandidate: recent.platformCandidate || recent.serviceCandidate,
  };
};

const shouldUseIncomingDisplayName = (existingUser: any, incomingUser: any) => {
  const incomingName = String(incomingUser?.name || "").trim();
  const existingName = String(existingUser?.name || "").trim();
  if (!incomingName) return false;
  if (!existingName) return true;

  const incomingProfileName = String(incomingUser?.profile?.displayName || "").trim();
  if (incomingProfileName && incomingProfileName === incomingName) return true;

  const incomingKey = String(incomingUser?.key || "").trim();
  const incomingId = String(incomingUser?.id || "").trim();
  const looksLikeAlias = incomingName === incomingKey || incomingName === incomingId;
  if (looksLikeAlias) return false;

  const existingHasDisplayCasing = /[A-ZÀ-Ý]/.test(existingName) || existingName.includes(" ");
  const incomingLooksLowerAlias = incomingName === incomingName.toLowerCase() && !incomingName.includes(" ");
  if (existingHasDisplayCasing && incomingLooksLowerAlias) return false;

  return true;
};

const getLiveRenderSignature = (user: any) => {
  const nowPlaying = user?.nowPlaying || {};
  const track = nowPlaying?.track || {};
  const playbackKey =
    nowPlaying?.playbackKey ||
    nowPlaying?.streamId ||
    nowPlaying?.stream?.id ||
    nowPlaying?.playedAt ||
    nowPlaying?.endTime ||
    nowPlaying?.timestamp ||
    '';
  return [
    user?.id || '',
    user?.name || '',
    user?.avatar || '',
    user?.platform?.primary || '',
    nowPlaying?.isNow === true ? 'live' : 'idle',
    track?.id || track?.name || '',
    playbackKey,
  ].join('|');
};

const getColdIdentitySignature = (user: any) => [
  user?.id || '',
  user?.key || '',
  user?.name || '',
  user?.avatar || '',
  user?.platform?.primary || '',
  user?.platform?.confidence || '',
  user?.platform?.source || '',
].join('|');

const didLivePlaybackChange = (previous: any, next: any) => {
  const previousNowPlaying = previous?.nowPlaying || {};
  const nextNowPlaying = next?.nowPlaying || {};
  return (
    previousNowPlaying?.isNow !== nextNowPlaying?.isNow ||
    String(previousNowPlaying?.track?.id || previousNowPlaying?.track?.name || '') !==
      String(nextNowPlaying?.track?.id || nextNowPlaying?.track?.name || '') ||
    String(previousNowPlaying?.playbackKey || previousNowPlaying?.streamId || previousNowPlaying?.stream?.id || previousNowPlaying?.playedAt || previousNowPlaying?.endTime || previousNowPlaying?.timestamp || '') !==
      String(nextNowPlaying?.playbackKey || nextNowPlaying?.streamId || nextNowPlaying?.stream?.id || nextNowPlaying?.playedAt || nextNowPlaying?.endTime || nextNowPlaying?.timestamp || '')
  );
};

const getLiveAssetUrls = (users: any[]) => {
  const urls = new Set<string>();
  users.forEach((user) => {
    const avatar = user?.avatar || user?.profile?.image;
    const track = user?.nowPlaying?.track || {};
    [
      avatar,
      track?.albumImage,
      track?.album?.image,
      track?.album?.images?.[0]?.url,
      track?.album?.images?.[0],
      track?.image,
      track?.images?.[0]?.url,
      track?.images?.[0],
      track?.albumArt,
      track?.coverArt,
      track?.cover_art,
      track?.album_image,
      track?.cover,
    ].forEach((url) => {
      if (typeof url === 'string' && url.trim().length > 5) urls.add(url);
    });
  });
  return [...urls];
};

const getLiveArtworkUrl = (user: any) => {
  const track = user?.nowPlaying?.track || {};
  return [
    track?.albumImage,
    track?.album?.image,
    track?.album?.images?.[0]?.url,
    track?.album?.images?.[0],
    track?.image,
    track?.images?.[0]?.url,
    track?.images?.[0],
    track?.albumArt,
    track?.coverArt,
    track?.cover_art,
    track?.album_image,
    track?.cover,
  ].find((url) => typeof url === 'string' && url.trim().length > 5) || '';
};

const preloadLiveAssets = async (users: any[]) => {
  if (typeof window === 'undefined') return;
  const urls = getLiveAssetUrls(users).slice(0, 12);
  if (urls.length === 0) return;

  await Promise.race([
    preloadImageAssets(urls, {
      limit: 8,
      priority: 'visible',
      timeoutMs: 1200,
    }),
    new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
  ]);
};

const prepareLiveVisuals = async (users: any[]) => {
  await preloadLiveAssets(users);
  if (typeof window === 'undefined') return;

  await Promise.race([
    Promise.allSettled(users.slice(0, 8).map(async (user) => {
      if (user?.nowPlaying?.dominantColor) return;
      const artworkUrl = getLiveArtworkUrl(user);
      if (!artworkUrl) return;

      const color = await Promise.race([
        getDominantColor(artworkUrl),
        new Promise<string>((resolve) => window.setTimeout(() => resolve(''), 1200)),
      ]);

      if (color && user?.nowPlaying) {
        user.nowPlaying = {
          ...user.nowPlaying,
          dominantColor: color,
        };
      }
    })).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
  ]);
};

const canonicalizeGroupStats = (groupStats: GroupStats | null) => {
  if (!groupStats || !isValidGroupStats(groupStats)) return groupStats;

  const members = getCanonicalMembers(groupStats);
  const users = members.reduce<Record<string, UserStats>>((acc, member) => {
    acc[member.id] = member;
    return acc;
  }, {});

  return {
    ...groupStats,
    users,
    members,
  };
};

const clampNumber = (value: any, fallback: number, min: number, max: number) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, next));
};

const sanitizePreferences = (
  state: Partial<StatsState>,
  groupStats: GroupStats | null
): Partial<StatsState> => {
  const updates: Partial<StatsState> = {};
  const members = getCanonicalMembers(groupStats);
  const validIds = new Set(members.map(member => member.id));

  if (typeof state.featuredUserId === 'string') {
    const featuredUserId = state.featuredUserId.trim();
    updates.featuredUserId = !featuredUserId || validIds.size === 0 || validIds.has(featuredUserId)
      ? featuredUserId
      : members[0]?.id || '';
  }

  if (Array.isArray(state.hiddenUsers)) {
    const hiddenUsers = dedupeIds(state.hiddenUsers);
    updates.hiddenUsers = validIds.size > 0
      ? hiddenUsers.filter(id => validIds.has(id))
      : hiddenUsers;
  }

  if (Array.isArray(state.historyCustomOrder)) {
    const historyCustomOrder = dedupeIds(state.historyCustomOrder);
    updates.historyCustomOrder = validIds.size > 0
      ? historyCustomOrder.filter(id => validIds.has(id))
      : historyCustomOrder;
  }

  if (!['lastPlayed', 'alphabetical', 'custom'].includes(state.historyOrder || '')) {
    updates.historyOrder = 'lastPlayed';
  }

  if (typeof state.arenaName === 'string') {
    updates.arenaName = state.arenaName.trim().replace(/\s+/g, ' ').slice(0, 50) || 'Arena do Grupo';
  }

  if (state.pollingFrequency !== undefined) {
    updates.pollingFrequency = clampNumber(state.pollingFrequency, 20, 5, 900);
  }
  if (state.animationDuration !== undefined) {
    updates.animationDuration = clampNumber(state.animationDuration, 0.4, 0.05, 3);
  }
  if (state.animationDelay !== undefined) {
    updates.animationDelay = clampNumber(state.animationDelay, 0.04, 0, 0.5);
  }
  if (state.shimmerDuration !== undefined) {
    updates.shimmerDuration = clampNumber(state.shimmerDuration, 2.8, 0.5, 5);
  }
  updates.vinylTextureMode = '1';

  return updates;
};

interface StatsState {
  groupStats: GroupStats | null;
  liveNowPlayingByUserId: LiveNowPlayingByUserId;
  liveStreamsTodayByUserId: LiveStreamsTodayByUserId;
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
  fetchGroupLive: (force?: boolean, options?: LiveFetchOptions) => Promise<void>;
  fetchLiveProbe: (userId: string) => Promise<boolean>;
  fetchUserTrackStats: (userId: string, trackId: string) => Promise<void>;
  fetchTrackStatsForAll: (trackId: string) => Promise<void>;
  getUserById: (id: string) => UserStats | undefined;
  getLiveUserById: (id: string) => UserStats | undefined;
  getLiveMembers: () => UserStats[];
  setOffline: (offline: boolean) => void;
  setFeaturedUserId: (userId: string) => void;
  setHiddenUsers: (users: string[]) => void;
  setHideRankingBadge: (hide: boolean) => void;
  setUserFullStatsCache: (userId: string, data: any) => void;
  setTimeRangeStatsCache: (key: string, data: any) => void;
  setTopItemsCache: (key: string, data: any) => void;
  prefetchUserTops: (userId: string, period?: string) => Promise<{
    tracks: any[];
    artists: any[];
    albums: any[];
    fetchedAt: number;
  }>;
  prefetchNextFriend: (currentUserId: string) => void;
  lastLiveFetchTime: number;

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
  vinylTextureMode: '1';

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
  setVinylTextureMode: (mode: '1') => void;
}

/**
 * Migrate old state that used aliases/keys to canonical IDs
 */
const migrateStateToCanonicalIds = (state: StatsState, groupStats: GroupStats | null): Partial<StatsState> => {
  if (!groupStats) return {};

  const updates: Partial<StatsState> = {};
  const idMap = new Map<string, string>();
  const canonicalMembers = getCanonicalMembers(groupStats);
  const validIds = new Set(canonicalMembers.map(user => user.id));

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
  const nextFeaturedUserId = updates.featuredUserId ?? state.featuredUserId;
  if (nextFeaturedUserId && !validIds.has(nextFeaturedUserId)) {
    updates.featuredUserId = canonicalMembers[0]?.id || "";
  }

  // Migrate hiddenUsers
  if (state.hiddenUsers.length > 0) {
    updates.hiddenUsers = dedupeIds(state.hiddenUsers.map(id => idMap.get(id) || id));
  }

  // Migrate historyCustomOrder
  if (state.historyCustomOrder.length > 0) {
    updates.historyCustomOrder = dedupeIds(state.historyCustomOrder.map(id => idMap.get(id) || id));
  }

  return updates;
};

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      groupStats: (() => {
        const cached = loadFromMMKV<GroupStats | null>('groupStats', null);
        if (cached && (!isValidGroupStats(cached) || hasAliasOnlyNames(cached))) {
          clearPersistedGroupCache();
          return null;
        }
        return stripNowPlayingFromGroupStats(canonicalizeGroupStats(cached));
      })(),
      liveNowPlayingByUserId: extractLiveNowPlayingByUserId(loadFromMMKV<GroupStats | null>('groupStats', null)),
      liveStreamsTodayByUserId: {},
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
      setFeaturedUserId: (userId: string) => {
        const members = getCanonicalMembers(get().groupStats);
        const validIds = new Set(members.map(member => member.id));
        const nextUserId = userId && (validIds.size === 0 || validIds.has(userId))
          ? userId
          : members[0]?.id || '';
        if (typeof localStorage !== 'undefined' && nextUserId) {
          localStorage.setItem('stats-lc-has-selected-user', '1');
        }
        set({ featuredUserId: nextUserId });
      },
      setHiddenUsers: (users: string[]) => {
        const validIds = new Set(getCanonicalMembers(get().groupStats).map(member => member.id));
        const nextUsers = dedupeIds(users).filter(id => validIds.size === 0 || validIds.has(id));
        set({ hiddenUsers: nextUsers });
      },
      setHideRankingBadge: (hide: boolean) => set({ hideRankingBadge: hide }),
      
      setUserFullStatsCache: (userId: string, data: any) => {
        const rawCache = {
          ...get().userFullStatsCache,
          [userId]: data
        };
        const rawMeta = {
          ...get().userFullStatsCacheMeta,
          [userId]: Date.now()
        };
        const { cache: nextCache, meta: nextMeta } = trimCacheByMeta(rawCache, rawMeta, MAX_DETAIL_CACHE_ENTRIES);
        saveToMMKV('userFullStatsCache', nextCache);
        saveToMMKV('userFullStatsCacheMeta', nextMeta);
        set({ userFullStatsCache: nextCache, userFullStatsCacheMeta: nextMeta });
      },

      setTimeRangeStatsCache: (key: string, data: any) => {
        const rawCache = {
          ...get().timeRangeStatsCache,
          [key]: data
        };
        const rawMeta = {
          ...get().timeRangeStatsCacheMeta,
          [key]: Date.now()
        };
        const { cache: nextCache, meta: nextMeta } = trimCacheByMeta(rawCache, rawMeta, MAX_DETAIL_CACHE_ENTRIES);
        saveToMMKV('timeRangeStatsCache', nextCache);
        saveToMMKV('timeRangeStatsCacheMeta', nextMeta);
        set({ timeRangeStatsCache: nextCache, timeRangeStatsCacheMeta: nextMeta });
      },

      setTopItemsCache: (key: string, data: any) => {
        const rawCache = {
          ...get().topItemsCache,
          [key]: data
        };
        const rawMeta = {
          ...get().topItemsCacheMeta,
          [key]: Date.now()
        };
        const { cache: nextCache, meta: nextMeta } = trimCacheByMeta(rawCache, rawMeta, MAX_TOP_CACHE_ENTRIES);
        saveToMMKV('topItemsCache', nextCache);
        saveToMMKV('topItemsCacheMeta', nextMeta);
        set({ topItemsCache: nextCache, topItemsCacheMeta: nextMeta });
      },

      prefetchUserTops: async (userId: string, period: string = 'month') => {
        const cacheKey = `${userId}:${period}`;
        const userCacheKey = coreUtils.getUserCacheKey(userId);
        const cacheAgeLimit = 15 * 60 * 1000;
        const existingTracksKey = buildTopItemsCacheKey(userCacheKey, 'tracks', period);
        const existingArtistsKey = buildTopItemsCacheKey(userCacheKey, 'artists', period);
        const existingAlbumsKey = buildTopItemsCacheKey(userCacheKey, 'albums', period);
        const existingTracks = get().getTopItemsFromCache(existingTracksKey);
        const existingArtists = get().getTopItemsFromCache(existingArtistsKey);
        const existingAlbums = get().getTopItemsFromCache(existingAlbumsKey);

        if (existingTracks && existingArtists && existingAlbums) {
          const fetchedAt = Math.min(
            get().topItemsCacheMeta[existingTracksKey] || Date.now(),
            get().topItemsCacheMeta[existingArtistsKey] || Date.now(),
            get().topItemsCacheMeta[existingAlbumsKey] || Date.now()
          );
          if (Date.now() - fetchedAt < cacheAgeLimit || get().isOffline) {
            return {
              tracks: existingTracks,
              artists: existingArtists,
              albums: existingAlbums,
              fetchedAt
            };
          }
        }

        // In-flight guard: prevent duplicate simultaneous calls
        if (prefetchUserTopsInFlight.has(cacheKey)) {
          if ((import.meta as any).env?.DEV) {
            console.debug(`[prefetchUserTops] Already in-flight for ${cacheKey}, skipping`);
          }
          return {
            tracks: existingTracks || [],
            artists: existingArtists || [],
            albums: existingAlbums || [],
            fetchedAt: 0
          };
        }

        prefetchUserTopsInFlight.add(cacheKey);

        try {
          const types: ('tracks' | 'artists' | 'albums')[] = ['tracks', 'artists', 'albums'];
          const topItems: any = {};

          for (const type of types) {
            const items = await statsService.getTopItems(userId, type, period).catch(() => []);
            topItems[`${type}`] = items;
          }

          const fetchedAt = Date.now();
          get().setTopItemsCache(existingTracksKey, topItems.tracks || []);
          get().setTopItemsCache(existingArtistsKey, topItems.artists || []);
          get().setTopItemsCache(existingAlbumsKey, topItems.albums || []);

          if ((import.meta as any).env?.DEV) {
            console.debug(`[prefetchUserTops] Fetched topItems for ${userId}:`, {
              tracks: topItems.tracks?.length || 0,
              artists: topItems.artists?.length || 0,
              albums: topItems.albums?.length || 0
            });
          }

          // Return the fetched data without persisting in groupStats
          return {
            tracks: topItems.tracks || [],
            artists: topItems.artists || [],
            albums: topItems.albums || [],
            fetchedAt
          };
        } finally {
          // Always remove from in-flight set
          prefetchUserTopsInFlight.delete(cacheKey);
        }
      },

      prefetchNextFriend: (currentUserId: string) => {
        const members = getCanonicalMembers(get().groupStats);
        if (members.length <= 1) return;

        const currentIndex = members.findIndex(m => m.id === currentUserId);
        if (currentIndex === -1) return;

        const nextIndex = (currentIndex + 1) % members.length;
        const nextFriend = members[nextIndex];

        if (friendPrefetchTimer) clearTimeout(friendPrefetchTimer);
        friendPrefetchController?.abort();

        if (get().isLoading || get().isRefreshing) return;

        friendPrefetchController = new AbortController();
        const signal = friendPrefetchController.signal;

        friendPrefetchTimer = setTimeout(async () => {
          try {
            await get().prefetchUserTops(nextFriend.id);
            if (!signal.aborted) {
              await statsService.getUserFullStats(nextFriend.id, { signal });
            }
          } catch (error: any) {
            if (error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED') {
              return;
            }
          }
        }, FRIEND_PREFETCH_DELAY_MS);
      },

      lastLiveFetchTime: 0,

      pushNotificationsEnabled: false,
      notifyOnNewStreams: true,
      notifyOnGroupHighlights: true,
      notifyOnArenaBattle: false,
      arenaName: 'Arena do Grupo',
      pollingFrequency: 20,

      historyOrder: 'lastPlayed',
      historyCustomOrder: [],

      // Animation settings default values
      animationDuration: 0.4,
      animationDelay: 0.04,
      shimmerDuration: 2.8,
      vinylTextureMode: '1',

      setPushNotificationsEnabled: (enabled: boolean) => set({ pushNotificationsEnabled: enabled }),
      setNotifyOnNewStreams: (enabled: boolean) => set({ notifyOnNewStreams: enabled }),
      setNotifyOnGroupHighlights: (enabled: boolean) => set({ notifyOnGroupHighlights: enabled }),
      setNotifyOnArenaBattle: (enabled: boolean) => set({ notifyOnArenaBattle: enabled }),
      setArenaName: (name: string) => set({ arenaName: name.trim().replace(/\s+/g, ' ').slice(0, 50) || 'Arena do Grupo' }),
      setPollingFrequency: (frequency: number) => set({ pollingFrequency: clampNumber(frequency, 20, 5, 900) }),
      setHistoryOrder: (order: 'lastPlayed' | 'alphabetical' | 'custom') => set({ historyOrder: order }),
      setHistoryCustomOrder: (order: string[]) => {
        const validIds = new Set(getCanonicalMembers(get().groupStats).map(member => member.id));
        const nextOrder = dedupeIds(order).filter(id => validIds.size === 0 || validIds.has(id));
        set({ historyCustomOrder: nextOrder });
      },
      setAnimationDuration: (duration: number) => set({ animationDuration: clampNumber(duration, 0.4, 0.05, 3) }),
      setAnimationDelay: (delay: number) => set({ animationDelay: clampNumber(delay, 0.04, 0, 0.5) }),
      setShimmerDuration: (duration: number) => set({ shimmerDuration: clampNumber(duration, 2.8, 0.5, 5) }),
      setVinylTextureMode: () => {
        set({ vinylTextureMode: '1' });
      },

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
        const cacheKey = getHistoryCacheKey(userId);
        const boundedItems = items.slice(0, MAX_HISTORY_CACHE_ITEMS);
        set(state => ({
          historyCache: {
            ...state.historyCache,
            [cacheKey]: {
              items: boundedItems,
              lastUpdated: Date.now()
            }
          }
        }))
      },

      // Getter para cache de histórico (TTL 5 minutos) - ignorada se offline
      getHistoryCache: (userId: string) => {
        const cache = get().historyCache[getHistoryCacheKey(userId)];
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
          deferCacheInvalidation(() => {
            set(state => {
              const newCache = { ...state.userFullStatsCache };
              const newMeta = { ...state.userFullStatsCacheMeta };
              delete newCache[userId];
              delete newMeta[userId];
              saveToMMKV('userFullStatsCache', newCache);
              saveToMMKV('userFullStatsCacheMeta', newMeta);
              return { userFullStatsCache: newCache, userFullStatsCacheMeta: newMeta };
            });
          });
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
          deferCacheInvalidation(() => {
            set(state => {
              const newCache = { ...state.timeRangeStatsCache };
              const newMeta = { ...state.timeRangeStatsCacheMeta };
              delete newCache[key];
              delete newMeta[key];
              saveToMMKV('timeRangeStatsCache', newCache);
              saveToMMKV('timeRangeStatsCacheMeta', newMeta);
              return { timeRangeStatsCache: newCache, timeRangeStatsCacheMeta: newMeta };
            });
          });
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
          deferCacheInvalidation(() => {
            set(state => {
              const newCache = { ...state.topItemsCache };
              const newMeta = { ...state.topItemsCacheMeta };
              delete newCache[key];
              delete newMeta[key];
              saveToMMKV('topItemsCache', newCache);
              saveToMMKV('topItemsCacheMeta', newMeta);
              return { topItemsCache: newCache, topItemsCacheMeta: newMeta };
            });
          });
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
            if (!isValidGroupStats(cachedGroup) || hasAliasOnlyNames(cachedGroup)) {
              clearPersistedGroupCache();
            } else {
              const canonicalCachedGroup = canonicalizeGroupStats(cachedGroup);
              set({
                groupStats: stripNowPlayingFromGroupStats(canonicalCachedGroup),
                liveNowPlayingByUserId: {
                  ...get().liveNowPlayingByUserId,
                  ...extractLiveNowPlayingByUserId(canonicalCachedGroup),
                },
                userFullStatsCache: cachedUserFullStats,
                isLoading: false,
                isRefreshing: false,
                error: null,
              });
              if ((import.meta as any).env?.DEV) console.debug("[fetchGroup] Serving valid MMKV cache, skipping fetch.");
              return;
            }
          }
        }

        const isInitial = !get().groupStats;
        if (isInitial) set({ isLoading: true });
        else set({ isRefreshing: true });
        
        // Safety timeout: 45s (higher than axios 30s timeout)
        const safetyTimer = setTimeout(() => {
          set({ isLoading: false, isRefreshing: false });
        }, 45000);

        set({ error: null });
        try {
          // Se estiver offline ou navigator indicar estar desconectado, servir cache imediatamente sem tentar requisição
          const isActuallyOffline = get().isOffline || !navigator.onLine;
          if (isActuallyOffline) {
            const cachedGroup = loadFromMMKV<GroupStats | null>('groupStats', null);
            const cachedUserFullStats = loadFromMMKV<Record<string, any>>('userFullStatsCache', {});
            if (cachedGroup) {
              if (!isValidGroupStats(cachedGroup) || hasAliasOnlyNames(cachedGroup)) {
                clearPersistedGroupCache();
              } else {
                const canonicalCachedGroup = canonicalizeGroupStats(cachedGroup);
                set({
                  groupStats: stripNowPlayingFromGroupStats(canonicalCachedGroup),
                  liveNowPlayingByUserId: {
                    ...get().liveNowPlayingByUserId,
                    ...extractLiveNowPlayingByUserId(canonicalCachedGroup),
                  },
                  userFullStatsCache: cachedUserFullStats,
                  isLoading: false,
                  isRefreshing: false,
                  isOffline: true,
                  error: null,
                });
                clearTimeout(safetyTimer);
                if ((import.meta as any).env?.DEV) console.debug("[fetchGroup] Network is offline, served stencil/stale MMKV data without error.");
                return;
              }
            }
          }

          const rawData = await statsService.getGroupData(force);
          const data = canonicalizeGroupStats(rawData) || rawData;
          const liveNowPlayingByUserId = extractLiveNowPlayingByUserId(data);
          const coldData = stripNowPlayingFromGroupStats(data);

          // Salva os novos dados obtidos em cache via MMKV (stripped)
          saveGroupStatsToMMKV(data);
          mmkv.set('groupStats_timestamp', Date.now());

          // Migrate old state to canonical IDs
          const currentState = get();
          const migrations = migrateStateToCanonicalIds(currentState, data);

          set({
            groupStats: coldData,
            liveNowPlayingByUserId: {
              ...get().liveNowPlayingByUserId,
              ...liveNowPlayingByUserId,
            },
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
            if (!isValidGroupStats(cachedGroup) || hasAliasOnlyNames(cachedGroup)) {
              clearPersistedGroupCache();
              set({ error: "Cache local inválido. Reinicie a sincronização.", isLoading: false, isRefreshing: false });
            } else {
              const canonicalCachedGroup = canonicalizeGroupStats(cachedGroup);
              set({
                groupStats: stripNowPlayingFromGroupStats(canonicalCachedGroup),
                liveNowPlayingByUserId: {
                  ...get().liveNowPlayingByUserId,
                  ...extractLiveNowPlayingByUserId(canonicalCachedGroup),
                },
                userFullStatsCache: cachedUserFullStats,
                error: null, // Sem falhar: limpa erro para exibir o cache de forma suave
                isLoading: false, // Ensure loading is false
                isRefreshing: false, // Ensure refreshing is false
              });
              if ((import.meta as any).env?.DEV) console.warn("[fetchGroup] Serving cached MMKV data graciously despite obsolete or fetch failure.");
            }
          } else {
            set({ error: "Erro na conexão com a API de música." });
          }
        } finally {
          clearTimeout(safetyTimer);
        }
      },

      fetchGroupLive: async (force = false, options = {}) => {
        if (!force && (get().isLoading || !get().groupStats)) {
          return;
        }

        const bypassThrottle = options.bypassThrottle === true;
        const now = Date.now();
        const timeSinceLastFetch = now - get().lastLiveFetchTime;

        // Throttling: não permite chamadas muito frequentes
        if (!force && !bypassThrottle && timeSinceLastFetch < LIVE_FETCH_MIN_INTERVAL_MS) {
          return;
        }

        if (get().isLiveFetching) return;

        set({ isLiveFetching: true, lastLiveFetchTime: now });

        // The live endpoint has its own short deadline; this only releases a stuck client request.
        const safetyTimer = setTimeout(() => {
          set({ isLiveFetching: false });
        }, 8000);

        try {
          const requestedFeaturedUserId = get().featuredUserId;
          const liveData = await statsService.getGroupLiveData(force, requestedFeaturedUserId || undefined);
          const currentGroupStats = get().groupStats;

          if (requestedFeaturedUserId) {
            const liveFeaturedUser = liveData.members?.find(member => member.id === requestedFeaturedUserId);
            const recoveryNow = Date.now();
            const lastRecoveryAt = lastLiveRecentRecoveryAtByUserId.get(requestedFeaturedUserId) || 0;
            if (
              liveFeaturedUser?.nowPlaying &&
              isPlaybackPastDuration(liveFeaturedUser.nowPlaying, recoveryNow) &&
              recoveryNow - lastRecoveryAt >= LIVE_RECENT_RECOVERY_INTERVAL_MS
            ) {
              lastLiveRecentRecoveryAtByUserId.set(requestedFeaturedUserId, recoveryNow);
              const latestRecent = await statsService.fetchLatestRecentFresh(requestedFeaturedUserId);
              const recoveredNowPlaying = buildRecoveredNowPlaying(liveFeaturedUser.nowPlaying, latestRecent, recoveryNow);
              if (recoveredNowPlaying) {
                liveFeaturedUser.nowPlaying = recoveredNowPlaying;
              }
            }
          }

          if (requestedFeaturedUserId && liveData.featuredStats) {
            const incomingStats = liveData.featuredStats;
            const existingStats = get().liveStreamsTodayByUserId[requestedFeaturedUserId];
            const incomingTime = Date.parse(incomingStats.generatedAt);
            const existingTime = existingStats ? Date.parse(existingStats.generatedAt) : 0;
            const shouldApply =
              !existingStats ||
              incomingStats.day > existingStats.day ||
              (incomingStats.day === existingStats.day &&
                (!Number.isFinite(existingTime) || !Number.isFinite(incomingTime) || incomingTime >= existingTime));

            if (shouldApply) {
              set((state) => ({
                liveStreamsTodayByUserId: {
                  ...state.liveStreamsTodayByUserId,
                  [requestedFeaturedUserId]: incomingStats,
                },
              }));
            }
          }

          if (currentGroupStats) {
            const newGroupStats = { ...currentGroupStats };
            const newUsers = { ...newGroupStats.users };
            const newMembers = [...newGroupStats.members];
            const nextLiveNowPlayingByUserId = { ...get().liveNowPlayingByUserId };
            let hasLiveRenderChanges = false;
            let hasColdGroupChanges = false;
            const changedLiveUsers: any[] = [];

            liveData.members?.forEach((liveUser) => {
              const existingUser = newUsers[liveUser.id];

              if (existingUser) {
                const existingUserWithLive = attachLiveNowPlayingToMember(existingUser, nextLiveNowPlayingByUserId);
                // Merge live data while preserving rich data from /api/group
                const incomingNowPlaying = shouldUseIncomingLivePayload(existingUserWithLive.nowPlaying, liveUser.nowPlaying)
                  ? liveUser.nowPlaying
                  : existingUserWithLive.nowPlaying;

                const mergedUser = {
                  ...existingUser,              // Keep all existing data
                  platform: liveUser.platform || existingUser.platform,
                  avatar: liveUser.avatar || existingUser.avatar,
                  name: shouldUseIncomingDisplayName(existingUser, liveUser)
                    ? liveUser.name
                    : existingUser.name,
                  // Preserve: topItems, recent, catalogSummary, errors, stats
                };
                const mergedUserWithLive = {
                  ...mergedUser,
                  nowPlaying: incomingNowPlaying,
                };

                const changedForRender =
                  getLiveRenderSignature(existingUserWithLive) !== getLiveRenderSignature(mergedUserWithLive);
                const coldIdentityChanged =
                  getColdIdentitySignature(existingUser) !== getColdIdentitySignature(mergedUser);

                if (!changedForRender) return;

                hasLiveRenderChanges = true;
                changedLiveUsers.push(mergedUserWithLive);
                if (incomingNowPlaying) nextLiveNowPlayingByUserId[liveUser.id] = incomingNowPlaying;
                else delete nextLiveNowPlayingByUserId[liveUser.id];
                if (coldIdentityChanged) {
                  hasColdGroupChanges = true;
                  newUsers[liveUser.id] = mergedUser;

                  const memberIndex = newMembers.findIndex(m => m.id === liveUser.id);
                  if (memberIndex !== -1) {
                    newMembers[memberIndex] = mergedUser;
                  }
                }

                if (didLivePlaybackChange(existingUserWithLive, mergedUserWithLive)) {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('nowPlayingChanged', { detail: { userId: liveUser.id } }));
                  }
                }
              } else {
                // New member from live endpoint - add to both structures
                const normalizedLive = statsService.normalizeMember?.(liveUser);
                if (normalizedLive) {
                  hasLiveRenderChanges = true;
                  hasColdGroupChanges = true;
                  changedLiveUsers.push(normalizedLive);
                  if (normalizedLive.nowPlaying) nextLiveNowPlayingByUserId[normalizedLive.id] = normalizedLive.nowPlaying;
                  const coldLive = stripNowPlayingFromGroupStats({
                    users: { [normalizedLive.id]: normalizedLive },
                    members: [normalizedLive],
                    lastUpdated: liveData.lastUpdated,
                  })?.users?.[normalizedLive.id] || normalizedLive;
                  newUsers[normalizedLive.id] = coldLive;
                  newMembers.push(coldLive);
                }
              }
            });

            if (!hasLiveRenderChanges) {
              return;
            }

            const persistNow = Date.now();
            let canonicalGroupStats = currentGroupStats;
            if (hasColdGroupChanges) {
              newGroupStats.users = newUsers;
              newGroupStats.members = newMembers;
              canonicalGroupStats =
                stripNowPlayingFromGroupStats(canonicalizeGroupStats(newGroupStats) || newGroupStats) || newGroupStats;
            }

            set(hasColdGroupChanges
              ? {
                  groupStats: canonicalGroupStats,
                  liveNowPlayingByUserId: nextLiveNowPlayingByUserId,
                }
              : {
                  liveNowPlayingByUserId: nextLiveNowPlayingByUserId,
                });

            prepareLiveVisuals(changedLiveUsers).then(() => {
              const enrichedLiveNowPlaying = changedLiveUsers.reduce<LiveNowPlayingByUserId>((acc, changedUser) => {
                if (changedUser?.id && changedUser?.nowPlaying?.dominantColor) {
                  acc[changedUser.id] = changedUser.nowPlaying;
                }
                return acc;
              }, {});
              if (Object.keys(enrichedLiveNowPlaying).length === 0) return;
              set((state) => ({
                liveNowPlayingByUserId: {
                  ...state.liveNowPlayingByUserId,
                  ...enrichedLiveNowPlaying,
                },
              }));
            }).catch(() => undefined);

            if (persistNow - lastLiveCachePersistAt >= LIVE_CACHE_PERSIST_INTERVAL_MS) {
              lastLiveCachePersistAt = persistNow;
              const liveMembersForCache = getCanonicalMembersWithLive(canonicalGroupStats, nextLiveNowPlayingByUserId);
              saveGroupStatsToMMKV({
                ...canonicalGroupStats,
                users: Object.fromEntries(liveMembersForCache.map((member) => [member.id, member])),
                members: liveMembersForCache,
              });
            }
          }
        } catch (e) {
          void e;
          // Live polling failures are intentionally silent; keep the existing UI snapshot.
        } finally {
          set({ isLiveFetching: false });
          clearTimeout(safetyTimer);
        }
      },

      fetchLiveProbe: async (userId: string) => {
        if (!userId) return false;
        const running = liveProbeRequestInFlight.get(userId);
        if (running) return running;

        const request = (async () => {
          const response = await statsService.getLiveProbe(userId);
          if (!response?.signature || !response.item?.track) return false;

          const current = get().liveNowPlayingByUserId[userId];
          const incoming: any = {
            ...response.item,
            isNow: true,
            timestamp: response.item.playedAt || response.item.endTime || response.generatedAt,
            playedAt: response.item.playedAt || response.item.endTime,
            endTime: response.item.endTime || response.item.playedAt,
            playbackKey: response.signature,
            streamId: response.item.id || response.signature,
            durationMs: response.item.durationMs || response.item.track?.durationMs,
            playedMs: response.item.playedMs ?? 0,
            source: 'probe',
            track: response.item.track,
          };

          if (isLivePayloadOlder(current, incoming)) return false;
          const currentSignature =
            current?.playbackKey ||
            current?.streamId ||
            current?.playedAt ||
            current?.endTime ||
            current?.timestamp ||
            '';
          if (
            !current &&
            !lastLiveProbeSignatureByUserId.has(userId) &&
            isExpiredInitialLiveProbeItem(response.item, response.generatedAt)
          ) {
            lastLiveProbeSignatureByUserId.set(userId, response.signature);
            return false;
          }
          if (
            lastLiveProbeSignatureByUserId.get(userId) === response.signature ||
            currentSignature === response.signature
          ) {
            lastLiveProbeSignatureByUserId.set(userId, response.signature);
            return false;
          }

          lastLiveProbeSignatureByUserId.set(userId, response.signature);
          set((state) => ({
            liveNowPlayingByUserId: {
              ...state.liveNowPlayingByUserId,
              [userId]: incoming,
            },
          }));

          const member = get().getUserById(userId);
          if (member) {
            const prepared = { ...member, nowPlaying: incoming };
            prepareLiveVisuals([prepared]).then(() => {
              if (!prepared.nowPlaying?.dominantColor) return;
              if (get().liveNowPlayingByUserId[userId]?.playbackKey !== response.signature) return;
              set((state) => ({
                liveNowPlayingByUserId: {
                  ...state.liveNowPlayingByUserId,
                  [userId]: prepared.nowPlaying,
                },
              }));
            }).catch(() => undefined);
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nowPlayingChanged', {
              detail: { userId, signature: response.signature, source: 'probe' },
            }));
          }
          return true;
        })().finally(() => {
          liveProbeRequestInFlight.delete(userId);
        });

        liveProbeRequestInFlight.set(userId, request);
        return request;
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
        const users = getCanonicalMembers(get().groupStats);
        if (!trackId || users.length === 0) return;

        const now = Date.now();
        const cachedAt = trackStatsFetchedAt.get(trackId) || 0;
        if (
          now - cachedAt < TRACK_STATS_CACHE_TTL_MS &&
          hasTrackStatsForUsers(get().userTrackStats, users, trackId)
        ) {
          return;
        }

        const running = trackStatsRequestInFlight.get(trackId);
        if (running) {
          return running;
        }

        const request = (async () => {
          try {
            const newStats = { ...get().userTrackStats };
            const groupStats = await statsService.fetchEntityGroupStats('track', trackId);

            users.forEach((u) => {
              newStats[`${u.id}:${trackId}`] = groupStats[u.id] || 0;
            });

            set({ userTrackStats: newStats });
            trackStatsFetchedAt.set(trackId, Date.now());
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
              trackStatsFetchedAt.set(trackId, Date.now());
            } catch (fallbackError) {
              console.error("fetchTrackStatsForAll error:", fallbackError);
            }
          }
        })().finally(() => {
          trackStatsRequestInFlight.delete(trackId);
        });

        trackStatsRequestInFlight.set(trackId, request);
        return request;
      },

      getUserById: (id: string) => {
        return get().groupStats?.users[id];
      },

      getLiveUserById: (id: string) => {
        const state = get();
        const user = state.groupStats?.users[id];
        return user ? attachLiveNowPlayingToMember(user, state.liveNowPlayingByUserId) : undefined;
      },

      getLiveMembers: () => {
        const state = get();
        return getCanonicalMembersWithLive(state.groupStats, state.liveNowPlayingByUserId);
      }
    }),
    {
      name: 'stats-lc-storage', // Nome da chave no localStorage
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState: any, currentState) => {
        const nextState = { ...currentState, ...(persistedState || {}) };
        if (nextState.groupStats && !isValidGroupStats(nextState.groupStats)) {
          clearPersistedGroupCache();
          try {
            localStorage.removeItem('stats-lc-storage');
          } catch {}
          nextState.groupStats = null;
          nextState.error = "Cache local inválido. Sincronize novamente.";
        } else if (nextState.groupStats) {
          const canonicalGroupStats = canonicalizeGroupStats(nextState.groupStats);
          nextState.liveNowPlayingByUserId = {
            ...(nextState.liveNowPlayingByUserId || {}),
            ...extractLiveNowPlayingByUserId(canonicalGroupStats),
          };
          nextState.groupStats = stripNowPlayingFromGroupStats(canonicalGroupStats);
        }
        Object.assign(nextState, sanitizePreferences(nextState, nextState.groupStats));
        return nextState;
      },
      partialize: (state) => ({
        // Only persist lightweight preferences, NOT heavy caches
        featuredUserId: state.featuredUserId,
        hiddenUsers: state.hiddenUsers,
        hideRankingBadge: state.hideRankingBadge,
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
        vinylTextureMode: state.vinylTextureMode,
        // Explicitly exclude heavy caches to prevent QuotaExceededError:
        // - groupStats (has its own MMKV)
        // - topItemsCache, topItemsCacheMeta
        // - userFullStatsCache, userFullStatsCacheMeta
        // - timeRangeStatsCache, timeRangeStatsCacheMeta
        // - historyCache
        // - statsCache
        // - userTrackStats
        // - preloadedUsers
        // - lastFetchTime
        // - lastLiveFetchTime
      }),
    }
  )
);

// Initialize store adapter for statsService to avoid circular dependency
import { setStoreAdapter } from '../services/storeAdapter';
setStoreAdapter({
  getState: () => useStatsStore.getState(),
  getCanonicalMembers: (groupStats: any) => {
    const { getCanonicalMembers } = require('../lib/memberSelectors');
    return getCanonicalMembers(groupStats);
  }
});
