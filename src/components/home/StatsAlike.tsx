/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { UserStats, TopItem } from '../../types/stats';
import { EngineBreathe, EngineDrift, SmartImage, SectionHeader, ShimmerOverlay, Skeleton } from '../shared/CommonUI';
import { HeartHandshake, ChevronLeft, ChevronRight, Sparkles, Flame } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getVisibleMembers } from '../../lib/memberSelectors';
import {
  buildTopItemsCacheKey,
  getTopItemArtistName,
  normalizeTopItemForType,
} from '../../lib/topItemUtils';
import { useViewportMotionGate } from '../../hooks/useViewportMotionGate';
import { setRuntimeCacheEntry } from '../../lib/memoryRuntime';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Internal type for processed connections
interface AlikeConnection {
  id: string;
  type: 'artist' | 'track' | 'album';
  item: TopItem;
  alikeUser: UserStats;
  matchingItem: TopItem;
  userPlaycount: number;
  userPosition: number;
  friendPosition: number;
  isEmpty?: boolean;
  isApiFallback?: boolean;
}

let cachedAlikeIndex = 0;
let cachedHydratedTopsByUser: Record<string, {
  tracks: any[];
  artists: any[];
  albums: any[];
  fetchedAt: number;
}> = {};
const cachedApiTrackFallbackByKey = new Map<string, AlikeConnection | null>();

const normalizeIdentity = (value: unknown) => coreUtils.normalizeText(String(value || ''));

const getCompareEntryItem = (entry: any) => entry?.item || entry?.track || entry;

const getCompareEntryCount = (entry: any) => Number(
  entry?.playcount ||
  entry?.streams ||
  entry?.count ||
  entry?.playedCount ||
  entry?.item?.playcount ||
  entry?.item?.streams ||
  0
) || 0;

const getCompareEntryRank = (entry: any) => Number(
  entry?.rank ||
  entry?.position ||
  entry?.item?.rank ||
  entry?.item?.position ||
  0
) || 0;

const entryMatchesMember = (entryKey: string, entryValue: any, member: any) => {
  const memberTokens = [
    member?.id,
    member?.customId,
    member?.profile?.customId,
    member?.name,
    member?.displayName,
    member?.id ? coreUtils.getUserApiParam(member.id) : '',
  ].map(normalizeIdentity).filter(Boolean);
  const entryTokens = [
    entryKey,
    entryValue?.userId,
    entryValue?.user?.id,
    entryValue?.user?.customId,
    entryValue?.user?.name,
  ].map(normalizeIdentity).filter(Boolean);

  return entryTokens.some((entryToken) => (
    memberTokens.some((memberToken) => entryToken === memberToken || entryToken.includes(memberToken) || memberToken.includes(entryToken))
  ));
};

const buildApiTrackFallback = (
  rows: any[],
  featuredUser: UserStats,
  friends: UserStats[]
): AlikeConnection | null => {
  for (const row of rows || []) {
    const byUserEntries = Object.entries(row?.byUser || {});
    if (byUserEntries.length < 2) continue;

    const featuredEntry = byUserEntries.find(([key, value]) => entryMatchesMember(key, value, featuredUser)) || byUserEntries[0];
    if (!featuredEntry) continue;

    const friendEntry = byUserEntries.find(([key, value]) => (
      key !== featuredEntry[0] && !entryMatchesMember(key, value, featuredUser)
    )) || byUserEntries.find(([key]) => key !== featuredEntry[0]);
    if (!friendEntry) continue;

    const friend = friends.find((member) => entryMatchesMember(friendEntry[0], friendEntry[1], member)) || friends[0];
    if (!friend) continue;

    const userItem = normalizeTopItemForType(getCompareEntryItem(featuredEntry[1]) || row.item, 'track') || normalizeTopItemForType(row.item, 'track');
    const friendItem = normalizeTopItemForType(getCompareEntryItem(friendEntry[1]) || row.item, 'track') || userItem;
    if (!userItem?.name || !friendItem?.name) continue;

    return {
      id: `api-track-${userItem.id || userItem.name}`,
      type: 'track',
      item: userItem,
      alikeUser: friend,
      matchingItem: friendItem,
      userPlaycount: getCompareEntryCount(featuredEntry[1]) || userItem.playcount || userItem.streams || 0,
      userPosition: getCompareEntryRank(featuredEntry[1]),
      friendPosition: getCompareEntryRank(friendEntry[1]),
      isApiFallback: true,
    };
  }

  return null;
};

export const StatsAlike = React.memo(() => {
  const groupStats = useStatsStore(state => state.groupStats);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const prefetchUserTops = useStatsStore(state => state.prefetchUserTops);
  const topItemsCache = useStatsStore(state => state.topItemsCache);
  const shouldReduceMotion = useReducedMotion();
  const {
    ref: orbitRef,
    isInViewport: isOrbitVisible,
    shouldRunAmbientMotion,
  } = useViewportMotionGate<HTMLDivElement>({ rootMargin: '180px' });
  const [activeIndex, setActiveIndex] = useState(cachedAlikeIndex);
  const touchStartRef = React.useRef<{ x: number; y: number; intent: 'pending' | 'horizontal' | 'vertical' } | null>(null);

  // Local hydrated topItems cache
  const [hydratedTopsByUser, setHydratedTopsByUser] = useState(cachedHydratedTopsByUser);
  const [apiTrackFallback, setApiTrackFallback] = useState<AlikeConnection | null>(null);

  const members = useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);
  const featuredUser = useMemo(
    () => members.find(m => m.id === featuredUserId) || members[0],
    [members, featuredUserId]
  );
  const effectiveFeaturedUserId = featuredUser?.id || featuredUserId || '';

  // Helper to get member topItems from multiple sources
  const getMemberTopItems = useCallback((member: any) => {
    // 1. Try member.topItems if exists (from API)
    if (member.topItems?.tracks?.length || member.topItems?.artists?.length || member.topItems?.albums?.length) {
      return member.topItems;
    }

    // 2. Try local hydrated cache
    if (hydratedTopsByUser[member.id]) {
      return hydratedTopsByUser[member.id];
    }

    // 3. Try topItemsCache from store
    const memberCacheKey = coreUtils.getUserCacheKey(member.id);
    const cacheKey = buildTopItemsCacheKey(memberCacheKey, 'tracks', 'month');
    if (topItemsCache?.[cacheKey]) {
      return {
        tracks: topItemsCache[cacheKey] || [],
        artists: topItemsCache[buildTopItemsCacheKey(memberCacheKey, 'artists', 'month')] || [],
        albums: topItemsCache[buildTopItemsCacheKey(memberCacheKey, 'albums', 'month')] || [],
      };
    }

    // 4. Fallback
    return { tracks: [], artists: [], albums: [] };
  }, [hydratedTopsByUser, topItemsCache]);

  const topItemsSignature = useMemo(() => {
    return members.map((member) => {
      const tops = getMemberTopItems(member);
      const ids = [
        ...(tops?.tracks || []).slice(0, 12).map((item: any) => item?.id || item?.track?.id || item?.name),
        ...(tops?.artists || []).slice(0, 12).map((item: any) => item?.id || item?.artist?.id || item?.name),
        ...(tops?.albums || []).slice(0, 12).map((item: any) => item?.id || item?.album?.id || item?.name),
      ];
      return `${member.id}:${ids.join(',')}`;
    }).join('|');
  }, [members, getMemberTopItems]);

  // Stable signature for prefetch needs. It must not include Date.now(), otherwise
  // every small render can turn into another prefetch pass.
  const missingTopMemberIds = useMemo(() => {
    return members
      .filter((member) => {
        const hydrated = hydratedTopsByUser[member.id];
        const tops = getMemberTopItems(member);
        const hasAnyTopItems =
          !!tops?.tracks?.length ||
          !!tops?.artists?.length ||
          !!tops?.albums?.length;

        return !hasAnyTopItems && !hydrated?.fetchedAt;
      })
      .map((member) => member.id);
  }, [members, hydratedTopsByUser, getMemberTopItems]);

  const missingTopMemberIdsKey = useMemo(
    () => missingTopMemberIds.join('|'),
    [missingTopMemberIds]
  );

  // Prefetch topItems for all members to enable Stats Alike matching
  useEffect(() => {
    if (!isOrbitVisible || !missingTopMemberIds.length) return;

    let cancelled = false;

    const loadTopItemsForMembers = async () => {
      const results = await Promise.allSettled(
        missingTopMemberIds.map(async (memberId) => ({
          memberId,
          result: await prefetchUserTops(memberId),
        }))
      );
      if (cancelled) return;

      const nextEntries = results.reduce<Record<string, any>>((acc, settled) => {
        if (settled.status === 'fulfilled' && settled.value.result?.fetchedAt) {
          acc[settled.value.memberId] = settled.value.result;
        } else if ((import.meta as any).env?.DEV && settled.status === 'rejected') {
          console.warn('[StatsAlike] Failed to prefetch tops:', settled.reason);
        }
        return acc;
      }, {});

      if (Object.keys(nextEntries).length === 0) return;

      setHydratedTopsByUser(prev => {
        const next = {
          ...prev,
          ...nextEntries
        };
        cachedHydratedTopsByUser = next;
        return next;
      });
    };

    loadTopItemsForMembers();

    return () => {
      cancelled = true;
    };
  }, [isOrbitVisible, missingTopMemberIdsKey, prefetchUserTops]);

  const alikeConnections = useMemo(() => {
    if (!featuredUser || !members.length) return [];

    const friends = members.filter(m => m.id !== effectiveFeaturedUserId);

    const featuredUserTops = getMemberTopItems(featuredUser);
    const knownTrackItems = members.flatMap((member) => getMemberTopItems(member)?.tracks || []);

    // Helper to find match for a specific type
    const findMatches = (type: 'artist' | 'track' | 'album', limit: number = 3) => {
      const normalizeItem = (item: any) => normalizeTopItemForType(item, type);
      const attachAlbumArtist = (album: TopItem, tops: any) => {
        if (type !== 'album' || getTopItemArtistName(album)) return album;
        const albumId = String(album.id || album.album?.id || '');
        const albumName = coreUtils.normalizeText(album.name || album.album?.name || '');
        const albumImage = album.image || album.album?.image;
        const matchingTrack = [...(tops?.tracks || []), ...knownTrackItems]
          .map((track: any) => normalizeTopItemForType(track, 'track'))
          .filter((track: TopItem | null): track is TopItem => Boolean(track))
          .find((track: TopItem) => {
            const trackAlbum = track.album || (track.track as any)?.album;
            const trackAlbumId = String(trackAlbum?.id || (track as any).albumId || '');
            const trackAlbumName = coreUtils.normalizeText(trackAlbum?.name || (track as any).albumName || '');
            const trackAlbumImage = trackAlbum?.image || (track as any).albumImage;
            return (
              (albumId && trackAlbumId && albumId === trackAlbumId) ||
              (albumName && trackAlbumName && albumName === trackAlbumName) ||
              (albumImage && trackAlbumImage && albumImage === trackAlbumImage)
            );
          });
        const artistName = getTopItemArtistName(matchingTrack);
        return artistName
          ? { ...album, artistName, primaryArtistName: album.primaryArtistName || artistName }
          : album;
      };
      const userItems = (featuredUserTops?.[`${type}s` as keyof typeof featuredUserTops] as TopItem[] || [])
        .map(normalizeItem)
        .filter((item): item is TopItem => Boolean(item));
      const enrichedUserItems = userItems.map((item) => attachAlbumArtist(item, featuredUserTops));
      
      const found: AlikeConnection[] = [];
      const searchDepth = 36;

      for (let i = 0; i < searchDepth && i < enrichedUserItems.length; i++) {
        const topItem = enrichedUserItems[i];
        if (!topItem.name) continue;
        
        const userPosition = i + 1;

        let bestFriend: UserStats | null = null;
        let highestFriendCount = -1;
        let matchingItem: TopItem | null = null;
        let friendPosition = -1;

        friends.forEach(friend => {
          const friendTops = getMemberTopItems(friend);
          const friendItems = (friendTops?.[`${type}s` as keyof typeof friendTops] as TopItem[] || [])
            .map(normalizeItem)
            .filter((item): item is TopItem => Boolean(item))
            .map((item) => attachAlbumArtist(item, friendTops))
            .slice(0, searchDepth);

          const matchIndex = friendItems.findIndex(i => {
            if (!i.name) return false;

            // Priority 1: ID Match
            if (i.id && topItem.id && i.id === topItem.id) return true;
            
            // Priority 2: Name Match (Normalized)
            const normA = coreUtils.normalizeText(topItem.name);
            const normB = coreUtils.normalizeText(i.name);
            
            // Support partial matches for tracks (e.g. "Song Name" matches "Song Name - Remastered")
            const isFullMatch = normA === normB;
            const isPartialMatch = (normA.includes(normB) && normB.length > 5) || (normB.includes(normA) && normA.length > 5);
            
            const nameMatch = isFullMatch || isPartialMatch;
            
            if (!nameMatch) return false;
            
            // Priority 3: For tracks/albums, check artist match for precision
            if (type === 'track' || type === 'album') {
               const getArtistName = (item: any) => {
                 const art = item.artists?.[0];
                 if (art) {
                   if (typeof art === 'string') return art;
                   if (art.name) return art.name;
                 }
                 if (item.artistName) return item.artistName;
                 if (item.artist?.name) return item.artist.name;
                 if (typeof item.artist === 'string') return item.artist;
                 return null;
               };

               const artistA = getArtistName(topItem);
               const artistB = getArtistName(i);
               
               if (artistA && artistB) {
                 const nA = coreUtils.normalizeText(artistA);
                 const nB = coreUtils.normalizeText(artistB);
                 return nA === nB || nA.includes(nB) || nB.includes(nA);
               }
               // If one side is missing artist info but names match strongly, we accept it
            }
            return true;
          });
          
          if (matchIndex !== -1) {
            const match = friendItems[matchIndex];
            const count = match.playcount || match.streams || 0;
            if (count > highestFriendCount) {
              highestFriendCount = count;
              bestFriend = friend;
              matchingItem = match;
              friendPosition = matchIndex + 1;
            }
          }
        });

        if (bestFriend && matchingItem) {
          found.push({
            id: `${type}-${topItem.id || topItem.name}`,
            type,
            item: topItem,
            alikeUser: bestFriend,
            matchingItem,
            userPlaycount: topItem.playcount || topItem.streams || 0,
            userPosition,
            friendPosition
          });
          if (found.length >= limit) break;
        }
      }
      return found;
    };

    // Build the final selection strictly prioritizing diversity then tracks
    const tMatches = findMatches('track', 5);
    const aMatches = findMatches('artist', 5);
    const bMatches = findMatches('album', 5);

    const selection: AlikeConnection[] = [];
    const seenValues = new Set<string>();

    const tryAddToSelection = (conn: AlikeConnection) => {
      if (selection.length >= 3) return false;
      
      const typeCount = selection.filter(s => s.type === conn.type).length;
      
      // The user requested never to repeat artist or album or track (max 1 of each)
      if (typeCount >= 1) return false;
      
      const key = `${conn.type}-${coreUtils.normalizeText(conn.item.name)}`;
      if (seenValues.has(key)) return false;

      selection.push(conn);
      seenValues.add(key);
      return true;
    };

    // 1. MUST-HAVE: Track if exists
    if (tMatches[0]) {
      tryAddToSelection(tMatches[0]);
    } else {
      selection.push({ id: 'empty-track', type: 'track', isEmpty: true, item: {} as TopItem, alikeUser: {} as UserStats, matchingItem: {} as TopItem, userPlaycount: 0, userPosition: 0, friendPosition: 0 });
    }

    // 2. DIVERSITY PASS: Fill with one of each other type
    if (aMatches[0]) {
      tryAddToSelection(aMatches[0]);
    } else {
      selection.push({ id: 'empty-artist', type: 'artist', isEmpty: true, item: {} as TopItem, alikeUser: {} as UserStats, matchingItem: {} as TopItem, userPlaycount: 0, userPosition: 0, friendPosition: 0 });
    }

    if (bMatches[0]) {
      tryAddToSelection(bMatches[0]);
    } else {
      selection.push({ id: 'empty-album', type: 'album', isEmpty: true, item: {} as TopItem, alikeUser: {} as UserStats, matchingItem: {} as TopItem, userPlaycount: 0, userPosition: 0, friendPosition: 0 });
    }

    return selection;
  }, [effectiveFeaturedUserId, topItemsSignature, getMemberTopItems]);

  const hasLocalTrackMatch = useMemo(
    () => alikeConnections.some((connection) => connection.type === 'track' && !connection.isEmpty),
    [alikeConnections]
  );
  const apiFallbackKey = useMemo(
    () => `pair-month-v1:${effectiveFeaturedUserId}:${members.map((member) => member.id).filter(Boolean).join('|')}`,
    [effectiveFeaturedUserId, members]
  );

  useEffect(() => {
    if (!isOrbitVisible || !featuredUser || hasLocalTrackMatch || members.length < 2) {
      setApiTrackFallback(null);
      return;
    }

    if (cachedApiTrackFallbackByKey.has(apiFallbackKey)) {
      setApiTrackFallback(cachedApiTrackFallbackByKey.get(apiFallbackKey) || null);
      return;
    }

    const friends = members.filter((member) => member.id !== effectiveFeaturedUserId);
    if (friends.length === 0) return;

    const controller = new AbortController();
    const loadPairFallback = async () => {
      let fallback: AlikeConnection | null = null;

      for (const friend of friends) {
        if (controller.signal.aborted) return;

        try {
          const data = await statsService.getCompareData({
            users: [effectiveFeaturedUserId, friend.id],
            period: 'month',
            limit: 80,
            commonMode: 'any',
            minSharedBy: 2,
            signal: controller.signal,
          });
          fallback = buildApiTrackFallback(data?.common?.tracks || [], featuredUser, [friend]);
          if (fallback) break;
        } catch (error: any) {
          if (controller.signal.aborted || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
        }
      }

      if (controller.signal.aborted) return;
      setRuntimeCacheEntry(cachedApiTrackFallbackByKey, apiFallbackKey, fallback, 'small');
      setApiTrackFallback(fallback);
    };

    loadPairFallback();

    return () => controller.abort();
  }, [apiFallbackKey, effectiveFeaturedUserId, featuredUser, hasLocalTrackMatch, isOrbitVisible, members]);

  const displayConnections = useMemo(() => {
    if (!apiTrackFallback || hasLocalTrackMatch) return alikeConnections;
    return alikeConnections.map((connection) => (
      connection.type === 'track' ? apiTrackFallback : connection
    ));
  }, [alikeConnections, apiTrackFallback, hasLocalTrackMatch]);

  // Protect activeIndex if alikeConnections length changes
  useEffect(() => {
    if (displayConnections.length > 0 && activeIndex >= displayConnections.length) {
      cachedAlikeIndex = 0;
      setActiveIndex(0);
    }
  }, [displayConnections.length, activeIndex]);

  if (!groupStats || !featuredUser) {
    return (
      <div className="flex flex-col gap-3 mb-4 mt-1">
        <SectionHeader
          title="Stats Alike"
          icon={<HeartHandshake className="h-4 w-4 text-orange-500" />}
          action={<Skeleton className="h-6 w-24 rounded-full" />}
        />
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative h-[286px] w-full flex items-center justify-center overflow-visible"
        >
          <div className="absolute h-56 w-56 rounded-full border border-white/[0.04]" />
          <div className="relative glass-card p-6 rounded-[32px] shadow-2xl overflow-hidden">
            <ShimmerOverlay duration={2.8} />
            <div className="flex items-center gap-3 relative z-10">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-[72px] w-[72px] rounded-2xl" />
              <Skeleton className="h-11 w-11 rounded-full" />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (displayConnections.length === 0) return null;

  const handleNext = () => {
    setActiveIndex(prev => {
      const next = (prev + 1) % displayConnections.length;
      cachedAlikeIndex = next;
      return next;
    });
  };

  const handlePrev = () => {
    setActiveIndex(prev => {
      const next = (prev - 1 + displayConnections.length) % displayConnections.length;
      cachedAlikeIndex = next;
      return next;
    });
  };

  const goToAlikeIndex = (index: number) => {
    if (displayConnections.length === 0) return;
    const next = (index + displayConnections.length) % displayConnections.length;
    cachedAlikeIndex = next;
    setActiveIndex(next);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, intent: 'pending' };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start) return;

    const touch = event.touches[0];
    const diffX = Math.abs(touch.clientX - start.x);
    const diffY = Math.abs(touch.clientY - start.y);
    if (start.intent === 'pending' && Math.max(diffX, diffY) > 8) {
      start.intent = diffX > diffY * 1.25 ? 'horizontal' : 'vertical';
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const diffX = touch.clientX - start.x;
    const diffY = touch.clientY - start.y;
    if (start.intent === 'vertical' || Math.abs(diffX) < 42 || Math.abs(diffX) < Math.abs(diffY) * 1.25) {
      return;
    }

    if (diffX < 0) handleNext();
    else handlePrev();
  };

  return (
    <div className="flex flex-col gap-3 mb-4 mt-1">
      <SectionHeader 
        title="Stats Alike" 
        icon={<HeartHandshake className="h-4 w-4 text-orange-500" />}
        action={
          <div className="flex items-center gap-1">
               <button onClick={handlePrev} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                 <ChevronLeft className="h-3 w-3 text-white/30 hover:text-white" />
               </button>
               <button onClick={handleNext} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                 <ChevronRight className="h-3 w-3 text-white/30 hover:text-white" />
               </button>
          </div>
        }
      />

      <div
        ref={orbitRef}
        data-home-horizontal-scroll="true"
        className="relative h-[286px] w-full select-none flex items-center justify-center overflow-visible [perspective:1200px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          touchStartRef.current = null;
        }}
      >
        {/* Orbital Background - Glass Stage */}
        <div className="pointer-events-none absolute left-1/2 top-[46%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.14)_0%,rgba(249,115,22,0.045)_45%,rgba(0,0,0,0)_72%)] blur-sm" />
        <div className="pointer-events-none absolute left-1/2 top-[46%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.035] bg-gradient-to-b from-white/[0.02] to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-[46%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.018]" />
        <div className="pointer-events-none absolute left-[17%] top-[24%] h-1.5 w-1.5 rounded-full bg-orange-400/60 shadow-[0_0_18px_rgba(249,115,22,0.75)]" />
        <div className="pointer-events-none absolute right-[18%] top-[31%] h-1 w-1 rounded-full bg-white/35 shadow-[0_0_14px_rgba(255,255,255,0.4)]" />
        <div className="pointer-events-none absolute bottom-[18%] left-[28%] h-1 w-1 rounded-full bg-orange-400/40 shadow-[0_0_14px_rgba(249,115,22,0.55)]" />

        <div className="relative h-full w-full max-w-lg">
          {displayConnections.map((conn, idx) => {
            const position = (idx - activeIndex + displayConnections.length) % displayConnections.length;
            
            // Map position to 3D orbit
            let zIndex = 0;
            let scale = 0.6;
            let x = 0;
            let y = 0;
            let opacity = 0.42;
            let rotateY = 0;

            if (position === 0) { // Front
              zIndex = 30;
              scale = 1;
              x = 0;
              y = 0;
              opacity = 1;
              rotateY = 0;
            } else if (position === 1) { // Right Back
              zIndex = 10;
              scale = 0.78;
              x = 132;
              y = -22;
              opacity = 0.46;
              rotateY = -15;
            } else { // Left Back
              zIndex = 10;
              scale = 0.78;
              x = -132;
              y = -22;
              opacity = 0.46;
              rotateY = 15;
            }

            return (
              <motion.div
                key={`${conn.id}-${idx}`}
                animate={{ 
                  x: `calc(-50% + ${x}px)`, 
                  y: `calc(-50% + ${y}px)`,
                  zIndex, 
                  scale, 
                  opacity,
                  rotateY,
                }}
                transition={{ type: "spring", stiffness: 150, damping: 24 }}
                className="absolute top-1/2 left-1/2 w-[332px]"
                onClick={() => position !== 0 && goToAlikeIndex(idx)}
                style={{ willChange: isOrbitVisible ? 'transform, opacity' : 'auto' }}
              >
                <EngineDrift
                  active={!shouldReduceMotion && shouldRunAmbientMotion}
                  delay={idx * 0.8}
                  duration={15 + idx * 3}
                  rotateA={idx % 2 === 0 ? 0.8 : -0.9}
                  rotateB={idx % 3 === 0 ? -0.4 : 0.5}
                  xA={idx % 2 === 0 ? 10 : -8}
                  xB={idx % 3 === 0 ? -5 : 4}
                  yA={idx % 2 === 0 ? -7 : 8}
                  yB={idx % 3 === 0 ? 5 : -4}
                >
                  <AlikeOrbitalItem
                    connection={conn}
                    isCentered={position === 0}
                    isOrbitVisible={isOrbitVisible}
                    shouldRunAmbientMotion={shouldRunAmbientMotion}
                    featuredUserAvatar={featuredUser?.avatar}
                    featuredUserId={effectiveFeaturedUserId}
                  />
                </EngineDrift>
              </motion.div>
            );
          })}
        </div>
      </div>
      <StatsAlikePagerIndicator
        count={displayConnections.length}
        activeIndex={activeIndex}
        onSelect={goToAlikeIndex}
      />
    </div>
  );
});

const StatsAlikePagerIndicator = ({
  count,
  activeIndex,
  onSelect,
}: {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) => {
  if (count <= 1) return null;

  return (
    <div
      className="relative z-50 mt-1 mb-3 flex items-center justify-center gap-2"
      aria-label="Navegação de Stats Alike"
    >
      {Array.from({ length: count }, (_, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={`stats-alike-page-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "h-2 rounded-full transition-[width,background-color,opacity,transform] duration-200 active:scale-90",
              isActive ? "w-7 bg-orange-500 opacity-100" : "w-2 bg-white/16 opacity-70"
            )}
            aria-label={`Ir para Stats Alike ${index + 1}`}
            aria-current={isActive ? 'true' : undefined}
          />
        );
      })}
    </div>
  );
};

const AlikeOrbitalItem = ({ 
  connection, 
  isCentered,
  isOrbitVisible,
  shouldRunAmbientMotion,
  featuredUserAvatar,
  featuredUserId
}: { 
  connection: AlikeConnection, 
  isCentered: boolean,
  isOrbitVisible: boolean,
  shouldRunAmbientMotion: boolean,
  featuredUserAvatar?: string,
  featuredUserId: string
}) => {
  const { type, item, alikeUser, matchingItem, userPlaycount, isEmpty, userPosition, friendPosition } = connection;

  const typeLabels = {
    artist: 'Artista em Comum',
    track: 'Música em Comum',
    album: 'Álbum em Comum'
  };
  const labelBadgeClass = "relative z-20 flex h-8 min-w-[190px] items-center justify-center rounded-full border border-white/10 bg-white/[0.055] px-5 shadow-[0_14px_32px_rgba(0,0,0,0.28)]";
  const labelTextClass = "block text-center text-[9px] font-black uppercase leading-none tracking-[0.16em] text-white/56";

  if (isEmpty) {
    return (
      <div className={cn(
        "flex flex-col items-center gap-2 transition-[opacity,transform] duration-500",
        isCentered ? "cursor-default" : "cursor-pointer pointer-events-auto"
      )}>
        <motion.div 
          animate={{ opacity: isCentered ? 1 : 0.3 }}
          className={labelBadgeClass}
        >
          <span className={labelTextClass}>
             {typeLabels[type]}
          </span>
        </motion.div>

        <div className="glass-aura relative flex min-h-[150px] flex-col items-center justify-center rounded-[30px] px-8 py-6 text-center opacity-45 shadow-2xl">
           <HeartHandshake className="h-6 w-6 text-white/10 mb-2" />
           <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Sem Match Top 50</span>
           <span className="text-[9px] text-white/20 mt-1 max-w-[120px]">Nenhum match no Top 50 para {typeLabels[type].toLowerCase().replace(' em comum', '')}.</span>
        </div>
      </div>
    );
  }

  const friendPlaycount = matchingItem.playcount || matchingItem.streams || 0;
  const artistName = type === 'track' || type === 'album'
    ? getTopItemArtistName(item)
    : '';

  return (
    <div className={cn(
        "flex flex-col items-center gap-2 transition-[opacity,transform] duration-500",
      isCentered ? "cursor-default" : "cursor-pointer pointer-events-auto"
    )}>
      {/* Label Badge */}
      <motion.div 
        animate={{ opacity: isCentered ? 1 : 0.3 }}
        className={labelBadgeClass}
      >
        <span className={labelTextClass}>
           {typeLabels[type]}
        </span>
      </motion.div>
      <motion.span
        animate={{ opacity: isCentered ? 1 : 0.3 }}
        className="-mt-3 relative z-30 rounded-full border border-orange-400/18 bg-orange-500/16 px-3 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-orange-100 shadow-[0_10px_24px_rgba(0,0,0,0.26)] backdrop-blur-xl"
      >
        Match com {alikeUser.name}
      </motion.span>

      {/* Main Bridge UI */}
      <div className={cn(
        "relative rounded-[28px] p-4 shadow-2xl transition-[background-color,box-shadow,transform,opacity] duration-700 backdrop-blur-xl",
        Math.abs(userPosition - friendPosition) >= 15 ? "bg-red-500/[0.03] shadow-[0_0_30px_rgba(239,68,68,0.05)]" : "bg-white/[0.01]"
      )}>
        <div className="flex items-center gap-2">
          {/* User (You) */}
          <div className="relative h-14 w-14 shrink-0">
            <SmartImage 
              src={coreUtils.getUserAvatar(featuredUserId, featuredUserAvatar)} 
              cacheKey={`stats-alike-featured:${featuredUserId}`}
              rounded="full" 
              className="h-full w-full object-cover rounded-full shadow-lg"
              fallback=""
            />
            <div className="absolute -bottom-2 -right-3 bg-orange-500 rounded-full px-2 h-6 min-w-7 flex items-center justify-center shadow-[0_8px_18px_rgba(249,115,22,0.32)] z-20">
               <span className="text-[10px] font-black leading-none text-white">{coreUtils.formatNumber(userPlaycount)}</span>
            </div>
            {userPosition > 0 && (
              <div className="absolute -top-2 -left-3 bg-black/65 rounded-full w-7 h-7 flex items-center justify-center border border-white/10 shadow-lg z-20">
                 <span className="text-[10px] font-black text-white/90">#{userPosition}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-orange-500/10 rounded-full blur-md opacity-50" />
          </div>

          <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Central Item Image */}
          <div className="relative h-28 w-28 flex-shrink-0 group">
            <SmartImage 
              src={item.image} 
              cacheKey={`stats-alike-item:${type}:${item.id || item.name}`}
              className={cn(
                "h-full w-full object-cover shadow-[0_12px_32px_rgba(0,0,0,0.6)] transition-[border-color,transform,opacity] duration-700",
                type === 'artist' ? 'rounded-full' : 'rounded-2xl',
                isCentered && "group-hover:scale-110",
                isCentered && (Math.abs(userPosition - friendPosition) >= 15 ? "group-hover:border-red-500/50" : "group-hover:border-orange-500/50")
              )} 
              rounded={type === 'artist' ? 'full' : '2xl'}
              fallback=""
            />
            {isCentered && isOrbitVisible && shouldRunAmbientMotion && (
              <EngineBreathe
                active
                duration={4}
                fromOpacity={0.3}
                fromScale={1}
                toOpacity={0}
                toScale={1.2}
                className={cn(
                  "absolute inset-[-4px] border-2 -z-10",
                  type === 'artist' ? 'rounded-full' : 'rounded-[28px]',
                  Math.abs(userPosition - friendPosition) >= 15 ? "border-red-500/50" : "border-orange-500/30"
                )}
              />
            )}
          </div>

          <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Alike Friend */}
          <div className="relative h-14 w-14 shrink-0">
            <SmartImage 
              src={coreUtils.getUserAvatar(alikeUser.id, alikeUser.avatar)} 
              cacheKey={`stats-alike-friend:${alikeUser.id}`}
              rounded="full" 
              className="h-full w-full object-cover rounded-full shadow-lg"
              fallback=""
            />
            <div className="absolute -bottom-2 -left-3 bg-blue-500 rounded-full px-2 h-6 min-w-7 flex items-center justify-center shadow-[0_8px_18px_rgba(59,130,246,0.28)] z-20">
               <span className="text-[10px] font-black leading-none text-white">{coreUtils.formatNumber(friendPlaycount)}</span>
            </div>
            {friendPosition > 0 && (
              <div className="absolute -top-2 -right-3 bg-black/65 rounded-full w-7 h-7 flex items-center justify-center border border-white/10 shadow-lg z-20">
                 <span className="text-[10px] font-black text-white/90">#{friendPosition}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-md opacity-50" />
          </div>
        </div>
      </div>

      {/* Detail info */}
      <AnimatePresence mode="wait">
        {isCentered && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex max-w-[270px] flex-col items-center text-center"
          >
            <span className="line-clamp-2 px-2 text-[17px] font-black leading-tight tracking-tight text-white">
              {item.name}
            </span>
            {artistName && (
              <span className="mt-0.5 line-clamp-1 px-2 text-[10px] font-semibold text-white/48">
                {artistName}
              </span>
            )}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
              {Math.abs(userPosition - friendPosition) >= 15 && (
                <span className="text-[9px] font-bold text-red-400 bg-red-400/10 border border-red-400/20 shadow-md uppercase tracking-widest px-2 py-0.5 rounded-md whitespace-nowrap flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5" />
                  Conflito
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
