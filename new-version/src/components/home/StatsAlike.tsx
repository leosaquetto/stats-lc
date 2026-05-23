/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { UserStats, TopItem } from '../../types/stats';
import { SmartImage, SectionHeader } from '../shared/CommonUI';
import { HeartHandshake, ChevronLeft, ChevronRight, Sparkles, Flame } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
}

export const StatsAlike = React.memo(() => {
  const groupStats = useStatsStore(state => state.groupStats);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  const members = groupStats?.members || [];
  const featuredUser = members.find(m => m.id === featuredUserId);

  const alikeConnections = useMemo(() => {
    if (!featuredUser || !members.length) return [];

    const pool: AlikeConnection[] = [];
    const friends = members.filter(m => m.id !== featuredUserId);

    // Helper to find match for a specific type
    const findMatches = (type: 'artist' | 'track' | 'album', limit: number = 3) => {
      const normalizeItem = (item: any) => {
        const nested = item.track || item.artist || item.album;
        return {
          ...item,
          id: nested?.id || item.id,
          name: nested?.name || item.name || item.artistName || item.albumName || '',
          image: nested?.image || item.image || nested?.album?.image || item.album?.image,
          artists: nested?.artists || item.artists || [],
          playcount: item.playcount || item.streams || nested?.playcount || 0
        };
      };

      const userItems = (featuredUser.topItems?.[`${type}s` as keyof typeof featuredUser.topItems] as TopItem[] || []).map(normalizeItem);
      
      const found: AlikeConnection[] = [];
      
      const searchDepth = 50;

      for (let i = 0; i < searchDepth && i < userItems.length; i++) {
        const topItem = userItems[i];
        if (!topItem.name) continue;
        
        const userPosition = i + 1;

        let bestFriend: UserStats | null = null;
        let highestFriendCount = -1;
        let matchingItem: TopItem | null = null;
        let friendPosition = -1;

        friends.forEach(friend => {
          const friendItems = (friend.topItems?.[`${type}s` as keyof typeof friend.topItems] as TopItem[] || []).map(normalizeItem).slice(0, searchDepth);

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
  }, [featuredUser, members, featuredUserId]);

  useEffect(() => {
    if (!isAutoRotating || alikeConnections.length < 2) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % alikeConnections.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoRotating, alikeConnections.length]);

  if (alikeConnections.length === 0) return null;

  const handleNext = () => {
    setIsAutoRotating(false);
    setActiveIndex(prev => (prev + 1) % alikeConnections.length);
  };

  const handlePrev = () => {
    setIsAutoRotating(false);
    setActiveIndex(prev => (prev - 1 + alikeConnections.length) % alikeConnections.length);
  };

  return (
    <div className="flex flex-col gap-3 mb-4 mt-1">
      <SectionHeader 
        title="Stats Alike" 
        icon={<HeartHandshake className="h-4 w-4 text-orange-500" />}
        action={
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-1.5 glass px-2 py-0.5 rounded-full border border-white/5 opacity-50 group-hover:opacity-100 transition-opacity">
               <Sparkles className="h-2.5 w-2.5 text-orange-500" />
               <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/60">Orbit Mode</span>
             </div>
             <div className="flex items-center gap-1">
               <button onClick={handlePrev} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                 <ChevronLeft className="h-3 w-3 text-white/30 hover:text-white" />
               </button>
               <button onClick={handleNext} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                 <ChevronRight className="h-3 w-3 text-white/30 hover:text-white" />
               </button>
             </div>
          </div>
        }
      />

      <div 
        className="relative h-[240px] sm:h-[300px] w-full flex items-center justify-center overflow-visible [perspective:1200px]"
        onMouseEnter={() => setIsAutoRotating(false)}
        onMouseLeave={() => setIsAutoRotating(true)}
      >
        {/* Orbital Background - Glass Stage */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 rounded-full border border-white/[0.03] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 rounded-full border border-white/[0.01] pointer-events-none mb-4" />

        <div className="relative w-full h-full max-w-lg mb-8">
          {alikeConnections.map((conn, idx) => {
            const position = (idx - activeIndex + alikeConnections.length) % alikeConnections.length;
            
            // Map position to 3D orbit
            let zIndex = 0;
            let scale = 0.6;
            let x = 0;
            let y = 0;
            let opacity = 0.4;
            let blur = "blur(4px)";
            let rotateY = 0;

            if (position === 0) { // Front
              zIndex = 30;
              scale = 1;
              x = 0;
              y = 0;
              opacity = 1;
              blur = "blur(0px)";
              rotateY = 0;
            } else if (position === 1) { // Right Back
              zIndex = 10;
              scale = 0.75;
              x = 100;
              y = -20;
              opacity = 0.4;
              blur = "blur(2px)";
              rotateY = -15;
            } else { // Left Back
              zIndex = 10;
              scale = 0.75;
              x = -100;
              y = -20;
              opacity = 0.4;
              blur = "blur(2px)";
              rotateY = 15;
            }

            return (
              <motion.div
                key={conn.id}
                animate={{ 
                  x: `calc(-50% + ${x}px)`, 
                  y: `calc(-50% + ${y}px)`,
                  zIndex, 
                  scale, 
                  opacity,
                  filter: blur,
                  rotateY,
                }}
                transition={{ type: "spring", stiffness: 180, damping: 22 }}
                className="absolute top-1/2 left-1/2 w-[220px]"
                onClick={() => position !== 0 && setActiveIndex(idx)}
              >
                <AlikeOrbitalItem 
                  connection={conn} 
                  isCentered={position === 0}
                  featuredUserAvatar={featuredUser?.avatar}
                  featuredUserId={featuredUserId || ''}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

const AlikeOrbitalItem = ({ 
  connection, 
  isCentered,
  featuredUserAvatar,
  featuredUserId
}: { 
  connection: AlikeConnection, 
  isCentered: boolean,
  featuredUserAvatar?: string,
  featuredUserId: string
}) => {
  const { type, item, alikeUser, matchingItem, userPlaycount, isEmpty, userPosition, friendPosition } = connection;

  const typeLabels = {
    artist: 'Artista em Comum',
    track: 'Música em Comum',
    album: 'Álbum em Comum'
  };

  if (isEmpty) {
    return (
      <div className={cn(
        "flex flex-col items-center gap-4 transition-all duration-500",
        isCentered ? "cursor-default" : "cursor-pointer pointer-events-auto"
      )}>
        <motion.div 
          animate={{ opacity: isCentered ? 1 : 0.3 }}
          className="bg-white/[0.05] px-3 py-1 rounded-full border border-white/10 shadow-sm whitespace-nowrap"
        >
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">
             {typeLabels[type]}
          </span>
        </motion.div>

        <div className="relative glass-card p-4 rounded-[32px] border border-white/5 shadow-2xl flex flex-col items-center justify-center min-h-[140px] px-6 text-center">
           <HeartHandshake className="h-6 w-6 text-white/10 mb-2" />
           <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Sem Match</span>
           <span className="text-[9px] text-white/20 mt-1 max-w-[120px]">Nenhum match no Top 50 para {typeLabels[type].toLowerCase().replace(' em comum', '')}.</span>
        </div>
      </div>
    );
  }

  const friendPlaycount = matchingItem.playcount || matchingItem.streams || 0;

  return (
    <div className={cn(
      "flex flex-col items-center gap-4 transition-all duration-500",
      isCentered ? "cursor-default" : "cursor-pointer pointer-events-auto"
    )}>
      {/* Label Badge */}
      <motion.div 
        animate={{ opacity: isCentered ? 1 : 0.3 }}
        className="bg-white/[0.05] px-3 py-1 rounded-full border border-white/10 shadow-sm whitespace-nowrap"
      >
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">
           {typeLabels[type]}
        </span>
      </motion.div>

      {/* Main Bridge UI */}
      <div className={cn(
        "relative glass-card p-6 rounded-[32px] border-white/10 shadow-2xl transition-all duration-700",
        Math.abs(userPosition - friendPosition) >= 15 ? "bg-red-500/[0.03] border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.05)]" : "bg-white/[0.01]"
      )}>
        <div className="flex items-center gap-3">
          {/* User (You) */}
          <div className="relative h-11 w-11 shrink-0">
            <SmartImage 
              src={coreUtils.getUserAvatar(featuredUserId, featuredUserAvatar)} 
              rounded="full" 
              className="h-full w-full object-cover rounded-full border-2 border-white/10 shadow-lg"
              fallback=""
            />
            <div className="absolute -bottom-1 -right-1 bg-orange-500 rounded-full px-1.5 h-4 flex items-center justify-center border border-white/20 shadow-lg z-20">
               <span className="text-[7px] font-black text-white">{userPlaycount}</span>
            </div>
            <div className="absolute -top-1.5 -left-1.5 bg-black/60 rounded-full w-5 h-5 flex items-center justify-center border border-white/10 shadow-lg z-20">
               <span className="text-[8px] font-black text-white/90">#{userPosition}</span>
            </div>
            <div className="absolute inset-0 bg-orange-500/10 rounded-full blur-md opacity-50" />
          </div>

          <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Central Item Image */}
          <div className="relative h-18 w-18 flex-shrink-0 group">
            <SmartImage 
              src={item.image} 
              className={cn(
                "h-full w-full object-cover shadow-[0_12px_32px_rgba(0,0,0,0.6)] border border-white/20 transition-all duration-700",
                type === 'artist' ? 'rounded-full' : 'rounded-2xl',
                isCentered && "group-hover:scale-110",
                isCentered && (Math.abs(userPosition - friendPosition) >= 15 ? "group-hover:border-red-500/50" : "group-hover:border-orange-500/50")
              )} 
              rounded={type === 'artist' ? 'full' : '2xl'}
              fallback=""
            />
            {isCentered && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 4, repeat: Infinity }}
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
          <div className="relative h-11 w-11 shrink-0">
            <SmartImage 
              src={coreUtils.getUserAvatar(alikeUser.id, alikeUser.avatar)} 
              rounded="full" 
              className="h-full w-full object-cover rounded-full border-2 border-white/10 shadow-lg"
              fallback=""
            />
            <div className="absolute -bottom-1 -left-1 bg-blue-500 rounded-full px-1.5 h-4 flex items-center justify-center border border-white/20 shadow-lg z-20">
               <span className="text-[7px] font-black text-white">{friendPlaycount}</span>
            </div>
            <div className="absolute -top-1.5 -right-1.5 bg-black/60 rounded-full w-5 h-5 flex items-center justify-center border border-white/10 shadow-lg z-20">
               <span className="text-[8px] font-black text-white/90">#{friendPosition}</span>
            </div>
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
            className="flex flex-col items-center text-center max-w-[200px]"
          >
            <span className="text-sm font-black text-white px-2 tracking-tight line-clamp-1">
              {item.name}
            </span>
            <div className="flex flex-wrap justify-center items-center gap-1.5 mt-1">
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md whitespace-nowrap">
                Match com {alikeUser.name}
              </span>
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

