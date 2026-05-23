/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Headphones, ChevronLeft, Music2, TrendingUp, PlayCircle } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { formatTimeSP, isTodaySP, formatDateSP, isYesterdaySP } from '../../lib/time';
import { UserStats } from '../../types/stats';
import {
  SmartImage,
  MusicPlatformBadge,
  ScrollingText,
  AnimatedNumber
} from '../shared/CommonUI';
import { VinylRecord } from './VinylRecord';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getDominantColor, withAlpha } from '../../lib/colorUtils';
import { getMainArtist, getMainArtistName, getSecondaryArtists } from '../../lib/artistUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LiveTrackProgressProps {
  progressMs?: number;
  playedMs?: number;
  durationMs?: number;
  timestamp: string | number;
  isNowPlaying: boolean;
  platform: "spotify" | "appleMusic" | "unknown";
  onComplete?: () => void;
  compact?: boolean;
}

export const LiveTrackProgress = memo(({
  progressMs,
  playedMs,
  durationMs,
  timestamp,
  isNowPlaying,
  platform,
  onComplete,
  compact = false
}: LiveTrackProgressProps) => {
  const heartbeat = useStatsStore(state => state.heartbeat);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [minPlayTime, setMinPlayTime] = useState(false);

  // SVG Platform Logos (inline)
  const SpotifyLogo = () => (
    <svg
      viewBox="0 0 2500 751"
      className="h-[0.7em] w-auto object-contain fill-current"
      aria-labelledby="spotify-logo-title"
      role="img"
    >
      <title id="spotify-logo-title">Spotify Logo</title>
      <path d="M374.9.6C167.9.6,0,168.5,0,375.5s167.9,374.9,374.9,374.9,374.9-167.8,374.9-374.9S582,.6,374.9.6h0s0,0,0,0ZM546.8,541.3c-6.7,11-21.1,14.5-32.1,7.8,0,0,0,0,0,0-88-53.8-198.8-65.9-329.3-36.1-12.6,2.9-25.1-5-28-17.6-2.9-12.6,5-25.1,17.5-28,0,0,0,0,0,0,142.8-32.6,265.3-18.6,364.1,41.8,11,6.8,14.5,21.1,7.7,32.1ZM592.7,439.2c-8.5,13.8-26.5,18.1-40.2,9.6-100.8-61.9-254.4-79.9-373.6-43.7-15.5,4.7-31.8-4-36.5-19.5-4.7-15.4,4.1-31.8,19.5-36.5,136.2-41.3,305.4-21.3,421.1,49.8,13.7,8.5,18.1,26.5,9.6,40.2h0ZM596.7,332.9c-120.8-71.8-320.2-78.4-435.5-43.4-18.5,5.6-38.1-4.8-43.7-23.4-5.6-18.5,4.8-38.1,23.4-43.7,132.4-40.2,352.6-32.4,491.7,50.1,16.6,9.8,22.2,31.3,12.3,48,0,0,0,0,0,0-9.8,16.7-31.4,22.2-48,12.3h0ZM1020,346.7c-64.7-15.4-76.2-26.3-76.2-49s20.2-36,50.4-36,58.1,11,88.5,33.6c.9.7,2.1,1,3.2.8,1.1-.2,2.2-.8,2.8-1.7l31.6-44.6c1.3-1.8.9-4.4-.8-5.8-36.1-29-76.8-43.1-124.3-43.1-69.9,0-118.7,41.9-118.7,102s42.1,87.1,114.9,104.7c61.9,14.3,72.4,26.2,72.4,47.6s-21.1,38.4-55.2,38.4-68.6-12.8-103.1-42.6c-.9-.7-2-1.1-3.1-1-1.2,0-2.2.6-2.9,1.5l-35.5,42.2c-1.5,1.8-1.3,4.4.4,5.9,40.1,35.8,89.4,54.7,142.7,54.7s124-41.1,124-104.8c.1-53.8-32.1-83.5-110.9-102.7h-.1ZM1301.4,282.8c-32.6,0-59.4,12.9-81.5,39.2v-29.7c0-2.3-1.9-4.2-4.2-4.2h-58c-2.3,0-4.2,1.9-4.2,4.2v329.5c0,2.3,1.9,4.3,4.2,4.3h58c2.3,0,4.2-1.9,4.2-4.3v-104c22.1,24.8,48.9,36.9,81.5,36.9,60.7,0,122.1-46.7,122.1-136,0-89.3-61.3-136-122-136h0ZM1356.1,418.8c0,45.4-28,77.2-68.1,77.2s-69.5-33.2-69.5-77.2,29.9-77.2,69.5-77.2c39.4,0,68.1,32.4,68.1,77.2h0ZM1580.9,282.8c-78.1,0-139.3,60.2-139.3,137s60.8,135.5,138.4,135.5,139.8-59.9,139.8-136.5-61-136-138.8-136h0ZM1580.9,496.5c-41.5,0-72.9-33.4-72.9-77.6s30.3-76.7,71.9-76.7,73.3,33.4,73.3,77.7-30.4,76.7-72.4,76.7h0ZM1886.5,288.1h-63.8v-65.2c0-2.3-1.9-4.2-4.2-4.2h-58c-2.3,0-4.3,1.9-4.3,4.2v65.2h-27.8c-2.3,0-4.2,1.9-4.2,4.2v49.8c0,2.3,1.9,4.2,4.2,4.2h27.8v128.9c0,52.1,25.9,78.5,77.1,78.5s38-4.3,54.3-13.5c1.3-.7,2.1-2.1,2.1-3.7v-47.5c0-1.4-.8-2.8-2-3.6-1.2-.8-2.8-.9-4.1-.2-11.1,5.6-21.9,8.2-34,8.2-18.6,0-26.9-8.5-26.9-27.4v-119.8h63.8c2.3,0,4.2-1.9,4.2-4.2v-49.8c0-2.3-1.7-4.2-4-4.2,0,0-.1,0-.2,0h0ZM2108.7,288.4v-8c0-23.6,9-34.1,29.3-34.1s21.8,2.4,32.7,6c1.3.4,2.7.2,3.8-.6,1.1-.8,1.8-2.1,1.7-3.4v-48.8c0-1.9-1.2-3.5-3-4.1-11.5-3.4-26.1-6.9-48.2-6.9-53.5,0-81.8,30.1-81.8,87.2v12.3h-27.8c-2.3,0-4.3,1.9-4.3,4.2v50.1c0,2.3,1.9,4.2,4.3,4.2h27.8v198.8c0,2.4,1.9,4.3,4.3,4.3h57.9c2.4,0,4.3-1.9,4.3-4.3v-198.8h54.1l82.9,198.8c-9.4,20.9-18.7,25-31.3,25s-21-3-32-9.1c-1-.5-2.2-.6-3.4-.3-1.1.4-2.1,1.2-2.5,2.3l-19.7,43.1c-.9,2.1-.1,4.4,1.8,5.5,20.5,11.1,39,15.8,61.9,15.8,42.8,0,66.5-20,87.3-73.6l100.6-259.8c.5-1.3.4-2.8-.4-3.9-.8-1.2-2.1-1.8-3.4-1.8h-60.3c-1.8,0-3.4,1.2-4,2.8l-61.8,176.5-67.7-176.7c-.6-1.6-2.2-2.7-3.9-2.7h-99ZM1979.9,288.1h-58c-2.3,0-4.3,1.9-4.3,4.2v252.9c0,2.4,1.9,4.3,4.3,4.3h58c2.3,0,4.3-1.9,4.3-4.3v-252.8c0-2.3-1.9-4.2-4.2-4.2,0,0,0,0,0,0h0ZM1951.2,173c-23,0-41.6,18.6-41.6,41.5s18.6,41.6,41.6,41.6,41.5-18.6,41.5-41.6-18.6-41.5-41.5-41.5ZM2459,369.5c-22.9,0-40.8-18.4-40.8-40.8s18.1-41,41-41,40.8,18.4,40.8,40.8-18.1,41-41,41h0ZM2459.2,291.7c-20.9,0-36.7,16.6-36.7,36.9s15.7,36.7,36.5,36.7,36.7-16.6,36.7-36.9-15.7-36.7-36.5-36.7h0ZM2468.3,332.6l11.6,16.2h-9.8l-10.4-14.8h-8.9v14.8h-8.1v-42.8h19.1c10,0,16.5,5.1,16.5,13.7,0,7-4,11.3-9.9,13h0ZM2461.4,313.3h-10.6v13.5h10.6c5.3,0,8.5-2.6,8.5-6.8s-3.2-6.8-8.5-6.8Z" />
    </svg>

  );

  const AppleMusicLogo = () => (
    <svg
      viewBox="0 0 84.3 20.7"
      className="h-[0.62em] w-auto object-contain fill-current -translate-y-[2.2px]"
      aria-labelledby="apple-music-logo-title"
      role="img"
    >
      <title id="apple-music-logo-title">Apple Music Logo</title>
      <path d="M35.4,20.1V6.6h-0.1l-5.4,13.5h-2.1L22.4,6.6h-0.1v13.5h-2.5V1.8H23l5.8,14.6h0.1l5.8-14.6H38v18.3L35.4,20.1L35.4,20.1z M52.1,20.1h-2.6v-2.3h-0.1c-0.7,1.6-2.1,2.5-4.1,2.5c-2.9,0-4.6-1.9-4.6-5V6.7h2.7v8.1c0,2,1,3.1,2.8,3.1c2,0,3.1-1.4,3.1-3.5V6.7h2.7L52.1,20.1L52.1,20.1z M59.5,6.5c3.1,0,5,1.7,5.1,4.2h-2.5c-0.2-1.3-1.1-2.1-2.6-2.1C58,8.6,57,9.3,57,10.4c0,0.8,0.6,1.4,2,1.7l2.1,0.5c2.7,0.6,3.7,1.7,3.7,3.6c0,2.4-2.2,4.1-5.3,4.1c-3.3,0-5.3-1.6-5.5-4.2h2.7c0.2,1.4,1.2,2.1,2.8,2.1c1.6,0,2.6-0.7,2.6-1.8c0-0.9-0.5-1.4-1.9-1.7l-2.1-0.5c-2.5-0.6-3.7-1.8-3.7-3.8C54.4,8.1,56.4,6.5,59.5,6.5z M66.8,3.2c0-0.9,0.7-1.6,1.6-1.6c0.9,0,1.6,0.7,1.6,1.6c0,0.9-0.7,1.6-1.6,1.6C67.5,4.8,66.8,4.1,66.8,3.2L66.8,3.2z M67,6.7h2.7v13.4H67V6.7z M81.1,11.3c-0.3-1.4-1.3-2.6-3.1-2.6c-2.1,0-3.5,1.8-3.5,4.6c0,2.9,1.4,4.6,3.5,4.6c1.7,0,2.7-0.9,3.1-2.5h2.6c-0.3,2.8-2.5,4.8-5.7,4.8c-3.8,0-6.2-2.6-6.2-6.9c0-4.2,2.4-6.9,6.2-6.9c3.4,0,5.4,2.2,5.7,4.8L81.1,11.3L81.1,11.3z M11.5,3.6C10.8,4.4,9.7,5.1,8.6,5C8.4,3.8,9,2.6,9.6,1.9c0.7-0.9,1.9-1.5,2.9-1.5C12.6,1.5,12.2,2.7,11.5,3.6L11.5,3.6z M12.5,5.2c0.6,0,2.4,0.2,3.6,2c-0.1,0.1-2.1,1.3-2.1,3.8c0,3,2.6,4,2.6,4c0,0.1-0.4,1.4-1.3,2.8c-0.8,1.2-1.7,2.4-3,2.4c-1.3,0-1.7-0.8-3.2-0.8c-1.5,0-2,0.8-3.2,0.8c-1.3,0-2.3-1.3-3.1-2.5c-1.7-2.5-3-7-1.2-10c0.8-1.5,2.4-2.5,4-2.5c1.3,0,2.5,0.9,3.2,0.9C9.5,6.1,10.9,5.1,12.5,5.2L12.5,5.2z"/>
    </svg>

  );

  const PlatformLogo = platform === 'spotify' ? <SpotifyLogo /> : <AppleMusicLogo />;

  useEffect(() => {
    if (!isNowPlaying) {
      setCurrentProgress(100);
      return;
    }

    const calculateProgress = () => {
      const baseProgress = playedMs ?? progressMs ?? 0;

      if (!durationMs) {
        // Sem duração: animação de loading simples
        setCurrentProgress(prev => (prev + 0.5) % 100);
        return;
      }

      const startTime = new Date(timestamp).getTime();
      const now = Date.now();
      const elapsedSinceLog = Math.max(0, now - startTime);
      const totalProgressMs = baseProgress + elapsedSinceLog;
      const percent = (totalProgressMs / durationMs) * 100;

      if (percent >= 100) {
        if (currentProgress < 100) {
          onComplete?.();
        }
        setCurrentProgress(100);
        setMinPlayTime(true);
      } else {
        setCurrentProgress(Math.min(percent, 100));
      }
    };

    calculateProgress();
  }, [heartbeat, isNowPlaying, platform, durationMs, progressMs, playedMs, timestamp, onComplete]);

  const elapsedMs = useMemo(() => (currentProgress / 100) * (durationMs || 0), [currentProgress, durationMs]);

  const dateObj = new Date(timestamp);
  const timeStr = formatTimeSP(dateObj, 'dots');
  const timeLabel = isTodaySP(dateObj)
    ? `ÀS ${timeStr}`
    : isYesterdaySP(dateObj)
      ? `ONTEM ÀS ${timeStr}`
      : `${formatDateSP(dateObj)} ÀS ${timeStr}`;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence mode="wait">
      {(!isNowPlaying || (isNowPlaying && !durationMs && !minPlayTime)) ? (
        !isNowPlaying ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-1 w-full"
          >
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40 font-mono">{timeLabel}</span>
              <motion.div
                className="flex items-center gap-1 text-white/40"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="text-[10px] text-white/30">OUVIU NO</span>
                <div className="flex items-center overflow-visible">
                  {PlatformLogo}
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden relative"
          >
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="h-full w-1/2 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"
            />
          </motion.div>
        )
      ) : (
        <motion.div
          key="playing"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="flex flex-col gap-1 w-full"
        >
          <div className="w-full h-1 rounded-full bg-white/10 overflow-visible relative">
            <div
              className="h-full rounded-full transition-all duration-1000 relative"
              style={{
                width: `${currentProgress}%`,
                background: 'linear-gradient(90deg, #f97316, #fb923c)'
              }}
            >
              {/* Thumb */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(249,115,22,0.8)] translate-x-1/2" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 font-mono">{formatTime(elapsedMs)}</span>
            <div className="flex items-center gap-1">
              <motion.span
                className="text-[10px] text-orange-400"
                animate={{ opacity: [0.65, 1, 0.65] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                OUVINDO NO
              </motion.span>
              <div className="flex items-center overflow-visible">
                {PlatformLogo}
              </div>
              <span className="text-[10px] text-white/30 font-mono">{formatTime(durationMs)}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

LiveTrackProgress.displayName = 'LiveTrackProgress';

export const LeoHeader = memo(({ user, streamsToday, onTrackClick, onAvatarClick, isHighlighted }: { user: UserStats, streamsToday: number, onTrackClick?: (track: any) => void, onAvatarClick?: () => void, isHighlighted?: boolean }) => {
  if (!user) return null;
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const rawY       = useTransform(scrollY, [0, 300], [0, -90]);
  const rawScale   = useTransform(scrollY, [0, 300], [1, 0.52]);
  const rawOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const yOffset    = shouldReduceMotion ? 0 : rawY;
  const sScale     = shouldReduceMotion ? 1 : rawScale;
  const sOpacity   = shouldReduceMotion ? 1 : rawOpacity;

  const handleVinylClick = () => {
    const scrolled = window.scrollY > 200;
    if (scrolled) {
      // Se estiver scrollado, volta para o topo
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Se estiver no topo, abre o modal da track
      onTrackClick?.({ ...track, type: 'track' });
    }
  };

  const profileAvatar = coreUtils.getUserAvatar(user.id, user.avatar);
  const storeUser = useStatsStore(s => s.groupStats?.members?.find(u => u.id === user.id));
  const activeUser = storeUser || user;
  const nowPlaying = activeUser.nowPlaying;
  const track = nowPlaying?.track as any;
  const albumImage = useMemo(() => {
    if (!track) return "";
    const candidates = [
      track.image,
      track.albumImage,
      track.album?.image,
      track.album?.images?.[0]?.url,
      track.album?.images?.[0], // In case images[0] IS the URL string
      track.images?.[0]?.url,
      track.images?.[0],
      track.albumArt,
      track.coverArt,
      track.cover_art,
      track.album_image,
      track.cover
    ];

    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 5) return c;
      if (c && typeof c === 'object' && c.url && typeof c.url === 'string') return c.url;
    }
    return "";
  }, [track]);
  const mainArtist = track ? getMainArtist(track) : null;
  const mainArtistName = track ? getMainArtistName(track) : '';
  const secondaryArtists = track ? getSecondaryArtists(track) : [];

  const fetchGroupLive = useStatsStore(state => state.fetchGroupLive);

  const [isForceFinished, setIsForceFinished] = useState(false);
  const prevNowPlaying = React.useRef(nowPlaying);

  // Reseta estado forceFinished quando a música muda, e trata transição tocando -> ocioso
  useEffect(() => {
    setIsForceFinished(false);
  }, [track?.id, nowPlaying?.timestamp]);

  useEffect(() => {
    const wasPlaying = prevNowPlaying.current?.isNow === true;
    const isCurrentlyPlaying = nowPlaying?.isNow === true;
    if (wasPlaying && !isCurrentlyPlaying) {
      fetchGroupLive();
    }
    prevNowPlaying.current = nowPlaying;
  }, [nowPlaying, fetchGroupLive]);

  const playback = coreUtils.getPlaybackStatus({ nowPlaying });
  // Usa o isNow do backend + forceFinished local
  const isActuallyLive = playback.status === "live" && nowPlaying?.isNow === true && !isForceFinished;
  const platform = useMemo(() => {
    // Prioriza plataforma detectada na faixa atual se a do usuário for desconhecida
    if (user.platform?.primary && user.platform.primary !== "unknown") {
      return user.platform;
    }

    if (track) {
      const detected = coreUtils.detectCatalogAvailability(track);
      if (detected.primary !== "unknown") {
        return detected;
      }
    }

    return user.platform || coreUtils.getUserPlaybackPlatform(user.id);
  }, [user.id, user.platform, track]);

  const [arenaExpanded, setArenaExpanded] = useState(false);
  const [dominantColor, setDominantColor] = useState<string | null>(null);

  useEffect(() => {
    if (!albumImage) {
       setDominantColor(null);
       return;
    }

    let isMounted = true;
    getDominantColor(albumImage).then(color => {
      if (isMounted) setDominantColor(color);
    }).catch(() => {
      if (isMounted) setDominantColor(null);
    });

    return () => {
       isMounted = false;
    };
  }, [albumImage]);

  const fetchTrackStatsForAll = useStatsStore(state => state.fetchTrackStatsForAll);
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const userTrackStats = useStatsStore(state => state.userTrackStats);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const hideRankingBadge = useStatsStore(state => state.hideRankingBadge);
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers) || [];
  const membersData = groupStats?.users || {};

  const trackStatsKey = `${user.id}:${track?.id}`;
  const playCount = userTrackStats[trackStatsKey];

  useEffect(() => {
    if (track?.id) {
      fetchTrackStatsForAll(track.id);
    }
  }, [track?.id, fetchTrackStatsForAll]);

  const allTrackArenaUsers = useMemo(() => {
    if (!track?.id) return [];
    return Object.values(membersData)
      .filter(u => !hiddenUsers.includes(u.id))
      .map(u => ({
        id: u.id,
        name: u.name,
        plays: userTrackStats[`${u.id}:${track?.id}`] || 0,
        avatar: coreUtils.getUserAvatar(u.id, u.avatar)
      }))
      .filter(u => u.plays > 0)
      .sort((a, b) => b.plays - a.plays);
  }, [membersData, userTrackStats, track?.id, hiddenUsers]);

  const trackArenaUsers = useMemo(() =>
    arenaExpanded ? allTrackArenaUsers : allTrackArenaUsers.slice(0, 5)
  , [arenaExpanded, allTrackArenaUsers]);

  const hasMoreArena = allTrackArenaUsers.length > 5;

  const isToday = nowPlaying?.timestamp ? isTodaySP(new Date(nowPlaying.timestamp)) : true;
  const isYesterday = nowPlaying?.timestamp ? isYesterdaySP(new Date(nowPlaying.timestamp)) : false;
  const formattedTime = nowPlaying?.timestamp ? formatTimeSP(new Date(nowPlaying.timestamp)) : "";
  const formattedDate = nowPlaying?.timestamp ? formatDateSP(new Date(nowPlaying.timestamp)) : "";
    const statusLabel = isActuallyLive
    ? "OUVINDO AGORA"
    : isToday
      ? "REPRODUZIDO ÀS " + formattedTime
      : isYesterday
        ? "ONTEM ÀS " + formattedTime
        : `VISTO EM ${formattedDate}`;

  const othersPlayed = allTrackArenaUsers.some(u => u.id !== user.id);
  const showRankingSummary = !hideRankingBadge && othersPlayed;

  const durationMs = track?.durationMs || nowPlaying?.durationMs || null;

  const filteredMembers = useMemo(() => {
    const list = groupStats?.members || Object.values(groupStats?.users || {}).map(u => ({ id: u.id }));
    return list.filter(m => !hiddenUsers.includes(m.id));
  }, [groupStats, hiddenUsers]);

  const containerVariants = {
    initial: { opacity: 0, scale: 1.02, filter: 'blur(4px)' },
    animate: {
      opacity: 1, scale: 1, filter: 'blur(0px)',
      transition: { staggerChildren: 0.1, delayChildren: 0.05 }
    },
    exit: {
      opacity: 0, scale: 0.96, filter: 'blur(4px)',
      transition: { duration: 0.3, staggerChildren: 0.08, staggerDirection: -1 }
    }
  };

  const itemVariants = {
    initial: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15, scale: 0.95 },
    animate: shouldReduceMotion ? { opacity: 1 } : {
      opacity: 1, y: 0, scale: 1,
      transition: { type: "spring" as const, stiffness: 400, damping: 25 }
    },
    exit: shouldReduceMotion ? { opacity: 0 } : {
      opacity: 0, y: -10, scale: 0.95,
      transition: { duration: 0.2 }
    }
  };

  return (
    <div className="relative -mt-3 mb-7 px-5 sm:px-8 overflow-visible">
      <div className="w-full relative min-h-[372px] sm:min-h-[440px] overflow-visible">
      <motion.div
        className="relative h-full overflow-visible"
      >
        {/* Open ambient header backdrop */}
        <div className={cn(
          "absolute -inset-x-8 -top-12 bottom-[-18px] overflow-hidden transition-all duration-500 pointer-events-none",
          isHighlighted
            ? "shadow-[0_0_40px_rgba(249,115,22,0.38)]"
            : "shadow-[0_24px_70px_-45px_rgba(0,0,0,0.9)]"
        )}
        style={{ willChange: 'transform, opacity' }}
        >
          <AnimatePresence>
            {isActuallyLive ? (
              <motion.div
                key="live-bg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-[inherit]"
              >
                <motion.div
                  animate={{
                    opacity: [0.3, 0.6, 0.3]
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 pointer-events-none mix-blend-screen"
                  style={{
                    background: dominantColor
                      ? `radial-gradient(circle at 20% 20%, ${withAlpha(dominantColor, 0.2)} 0%, transparent 60%)`
                      : "radial-gradient(circle at 20% 20%, rgba(234,88,12,0.2) 0%, transparent 60%)"
                  }}
                />
                <motion.div
                  animate={{
                    opacity: [0.2, 0.5, 0.2]
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute inset-0 pointer-events-none mix-blend-screen"
                  style={{
                    background: dominantColor
                      ? `radial-gradient(circle at 80% 80%, ${withAlpha(dominantColor, 0.15)} 0%, transparent 60%)`
                      : "radial-gradient(circle at 80% 80%, rgba(234,179,8,0.15) 0%, transparent 60%)"
                  }}
                />
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
              </motion.div>
            ) : (
              <motion.div
                 key="idle-bg"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="absolute inset-0 overflow-hidden"
              >
                 {/* Névoa lenta com cor do álbum anterior */}
                 <motion.div
                   animate={{
                     x:       ['-8%', '8%', '-8%'],
                     y:       ['-4%', '12%', '-4%'],
                     opacity: [0.15, 0.4, 0.15],
                   }}
                   transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                   className="absolute -inset-[40%] pointer-events-none"
                   style={{
                     background: dominantColor
                       ? `radial-gradient(circle at 40% 40%, ${withAlpha(dominantColor, 0.12)} 0%, transparent 55%)`
                       : 'radial-gradient(circle at 40% 40%, rgba(180,180,180,0.10) 0%, transparent 55%)',
                     filter: 'blur(30px)',
                   }}
                 />
                 {/* Segunda névoa deslocada — profundidade */}
                 <motion.div
                   animate={{
                     x:       ['10%', '-6%', '10%'],
                     y:       ['8%', '-6%', '8%'],
                     opacity: [0.08, 0.22, 0.08],
                   }}
                   transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
                   className="absolute -inset-[40%] pointer-events-none"
                   style={{
                     background: dominantColor
                       ? `radial-gradient(circle at 65% 60%, ${withAlpha(dominantColor, 0.08)} 0%, transparent 50%)`
                       : 'radial-gradient(circle at 65% 60%, rgba(160,160,160,0.07) 0%, transparent 50%)',
                     filter: 'blur(40px)',
                   }}
                 />
                 {/* Vinheta escura nas bordas */}
                 <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/40" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {track && (
          <div className="absolute right-[-146px] top-[-70px] h-[330px] w-[330px] sm:right-[-188px] sm:top-[-92px] sm:h-[470px] sm:w-[470px] shrink-0 z-20 pointer-events-auto">
            <motion.div style={{ y: yOffset, scale: sScale, opacity: sOpacity }} className="w-full h-full overflow-visible">
              <VinylRecord
                albumImage={albumImage || ""}
                dominantColor={dominantColor || ""}
                isPlaying={isActuallyLive}
                progressMs={nowPlaying?.progressMs || nowPlaying?.playedMs || 0}
                durationMs={durationMs || undefined}
                onClick={handleVinylClick}
              />
            </motion.div>
          </div>
        )}
        <div className="relative z-30 px-0 sm:px-2 pt-0 pb-3 sm:pb-4 overflow-visible">

          <AnimatePresence mode="wait">
            <motion.div
              key={`${user.id}-${track?.id || 'idle'}`}
              variants={containerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col gap-7 sm:gap-9 pt-0"
              transition={{ duration: 0.4 }}
            >
              {/* TOP HEADER: User Layout Flex-row */}
              <div className="flex flex-row items-center gap-3 sm:gap-4 relative z-40 pt-1">

                {/* Avatar com ring animado quando tocando */}
                <motion.div
                  onClick={onAvatarClick}
                  className="relative shrink-0 cursor-pointer"
                  whileTap={{ scale: 0.95 }}
                >
                  {isActuallyLive && (
                    <motion.div
                      className="absolute inset-[-3px] rounded-full"
                      style={{
                        background: `conic-gradient(${dominantColor || '#f97316'}, transparent, ${dominantColor || '#f97316'})`,
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                  <div className={cn(
                    "relative rounded-full overflow-hidden border-2 transition-all duration-500",
                    isActuallyLive
                      ? "w-14 h-14 sm:w-16 sm:h-16 border-black/80"
                      : "w-12 h-12 sm:w-14 sm:h-14 border-white/20"
                  )}>
                    <SmartImage
                      src={profileAvatar}
                      className="h-full w-full"
                      fallback=""
                      rounded="full"
                    />
                  </div>
                </motion.div>

                {/* Nome + Streams */}
                <div className="flex flex-col items-start min-w-0 gap-1">

                  {/* Nome */}
                  <h2 className={cn(
                    "text-[15px] sm:text-[17px] font-display font-bold tracking-[0.06em] leading-none truncate w-full transition-colors duration-500",
                    isActuallyLive ? "text-white" : "text-white/70"
                  )}>
                    {user.name}
                  </h2>

                  {/* Streams hoje — número animado */}
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className={cn(
                      "h-2.5 w-2.5 transition-colors duration-500",
                      isActuallyLive ? "text-orange-400" : "text-white/30"
                    )} />
                    <div className="flex items-baseline gap-1">
                      <span className={cn(
                        "text-[13px] sm:text-[15px] font-black tabular-nums leading-none transition-colors duration-500",
                        isActuallyLive ? "text-white" : "text-white/60"
                      )}>
                        <AnimatedNumber value={streamsToday} />
                      </span>
                      <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.22em] text-white/30 leading-none pb-[1px]">
                        streams hoje
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {track ? (
                <div className="flex flex-col gap-6 sm:gap-7 mt-0">
                  {/* Track Info Section */}
                  <motion.div variants={itemVariants} className="flex relative items-start min-h-[168px] sm:min-h-[210px] w-full">

                    {/* Conteúdo Esquerdo: textos e ranking compactos, com o vinil vazando por trás */}
                    <div className="flex flex-col justify-start w-[58%] sm:w-[56%] shrink-0 min-w-0 pl-0 pr-1 gap-6 sm:gap-7 relative z-40">
                      <div className="flex flex-col gap-1.5">
                        <div
                          onClick={() => onTrackClick?.({ ...track, type: 'track' })}
                          className="cursor-pointer hover:underline text-left pointer-events-auto"
                        >
                          <ScrollingText
                            text={track.name}
                            className="text-[30px] sm:text-[38px] font-sans font-bold text-white leading-[0.98] tracking-normal drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]"
                          />
                        </div>
                        <div className="text-[17px] sm:text-[22px] font-medium text-white/80 line-clamp-1 flex items-center flex-wrap gap-x-1 pointer-events-auto select-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (mainArtist) {
                                onTrackClick?.({
                                  id: mainArtist.id || '',
                                  name: mainArtistName,
                                  type: 'artist'
                                });
                              }
                            }}
                            className="hover:underline cursor-pointer text-white/90"
                          >
                            {mainArtistName}
                          </span>
                          {secondaryArtists.length > 0 && (
                            <>
                              <span className="text-white/40">·</span>
                              {secondaryArtists.map((sec, idx) => (
                                <React.Fragment key={sec.id || idx}>
                                  {idx > 0 && <span className="text-white/40">·</span>}
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onTrackClick?.({
                                        id: sec.id || '',
                                        name: sec.name,
                                        type: 'artist'
                                      });
                                    }}
                                    className="hover:underline cursor-pointer text-white/70"
                                  >
                                    {sec.name}
                                  </span>
                                </React.Fragment>
                              ))}
                            </>
                          )}
                        </div>
                        {track.albumName && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrackClick?.({
                                id: track.albumId || '',
                                name: track.albumName,
                                type: 'album'
                              });
                            }}
                            className="text-[10px] sm:text-[12px] font-semibold text-white/50 line-clamp-2 hover:underline hover:text-white/80 cursor-pointer text-left pointer-events-auto"
                          >
                            {track.albumName}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-[clamp(250px,78vw,360px)] max-w-[92vw]">
                        {showRankingSummary ? (
                          <div className="flex flex-wrap items-center justify-start gap-2 w-full">
                            <motion.div
                              onClick={() => onTrackClick?.({ ...track, type: 'track' })}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                "flex items-center gap-2 sm:gap-3 pl-2.5 sm:pl-3 pr-4 sm:pr-5 py-2 sm:py-2 rounded-full bg-gradient-to-b from-white/[0.12] to-white/[0.05] border border-white/12 backdrop-blur-xl shadow-[0_14px_35px_rgba(0,0,0,0.35)] hover:bg-white/[0.14] hover:border-white/22 transition-all cursor-pointer group/arena max-w-full",
                                arenaExpanded ? "max-w-full flex-wrap justify-center py-2" : "shrink-0"
                              )}
                            >
                              <div className="flex -space-x-2 mr-1 shrink-0">
                                {trackArenaUsers.map((u, i) => (
                                  <motion.div
                                    key={u.id}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={cn(
                                      "relative group/avatar shrink-0",
                                      u.id === user.id ? "z-20 scale-105" : ""
                                    )}
                                    style={{ zIndex: trackArenaUsers.length - i }}
                                  >
                                    <div className={cn(
                                      "relative h-7 w-7 sm:h-8 sm:w-8 rounded-full overflow-hidden transition-all duration-300 ring-2 ring-black/80",
                                      u.id === user.id ? "ring-orange-500/80" : "group-hover/avatar:ring-white/40"
                                    )}>
                                      <div className="relative h-full w-full rounded-full overflow-hidden">
                                        <SmartImage src={u.avatar} className="h-full w-full object-cover" fallback="" rounded="full" />
                                      </div>
                                    </div>

                                    <div className={cn(
                                      "absolute -bottom-0.5 -right-0.5 h-3 min-w-[12px] px-0.5 sm:h-3.5 sm:min-w-[14px] rounded-full border border-white/10 flex items-center justify-center text-[5.5px] sm:text-[7px] font-black text-white z-30 shadow-xl",
                                      u.id === user.id ? "bg-orange-600 ring-1 ring-white/40" : "bg-stone-900/90 backdrop-blur-md"
                                    )}>
                                      {u.plays}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>

                              {!arenaExpanded && (
                                <div className="flex flex-col justify-center shrink-0 pr-1">
                                  <span className="text-[5.5px] sm:text-[6px] font-black text-white/50 uppercase tracking-[0.2em] leading-none mb-0.5 whitespace-nowrap">ARENA</span>
                                  <span className="text-[7.5px] sm:text-[9px] font-bold text-white uppercase tracking-tight leading-none whitespace-nowrap">RANKING</span>
                                </div>
                              )}

                              {hasMoreArena && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setArenaExpanded(!arenaExpanded); }}
                                  className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:bg-white/20 transition-all text-[8px] sm:text-[9px] font-bold ml-1"
                                >
                                  {arenaExpanded ? <ChevronLeft className="h-3 w-3" /> : `+${allTrackArenaUsers.length - trackArenaUsers.length}`}
                                </button>
                              )}
                            </motion.div>

                          </div>
                        ) : (
                          <motion.div
                            onClick={(e) => { e.stopPropagation(); onTrackClick?.({ ...track, type: 'track' }); }}
                            whileTap={{ scale: 0.96 }}
                            className="flex items-center gap-2 cursor-pointer shrink-0"
                          >
                            {playCount === undefined ? (
                              <div className="h-6 w-20 rounded-full bg-white/5 animate-pulse" />
                            ) : playCount === 1 ? (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                                style={{ background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.20)' }}
                              >
                                <motion.div
                                  className="w-1.5 h-1.5 rounded-full bg-orange-400"
                                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                  transition={{ duration: 1.8, repeat: Infinity }}
                                />
                                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-300">
                                  First Listen
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                              >
                                <Headphones className="h-3 w-3 text-white/40" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                                  {coreUtils.formatPlayCount(playCount)}
                                </span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Progress Layer */}
                  <motion.div variants={itemVariants} className="mt-0 w-[50%] min-w-[185px] max-w-[270px] relative z-40">
                     <LiveTrackProgress
                        progressMs={nowPlaying.progressMs}
                        playedMs={nowPlaying.playedMs}
                        durationMs={durationMs || undefined}
                        timestamp={nowPlaying.timestamp}
                        isNowPlaying={isActuallyLive}
                        platform={platform.primary}
                        compact
                        onComplete={() => {
                           setIsForceFinished(true);
                           fetchGroupLive();
                        }}
                     />
                  </motion.div>
                </div>
              ) : (
                <motion.div
                  variants={itemVariants}
                  className="py-16 sm:py-20 rounded-[32px] sm:rounded-[48px] flex flex-col items-center justify-center border-2 border-dashed border-white/10 bg-black/10 backdrop-blur-xl group transition-all relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_70%)] animate-pulse" />
                  <motion.div
                    animate={shouldReduceMotion ? {} : { y: [0, -8, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    className="relative"
                  >
                    <Music2 className="h-10 sm:h-14 w-10 sm:w-14 mb-4 sm:mb-6 text-white/10 group-hover:text-orange-500/40 transition-colors duration-700" />
                    <div className="absolute inset-0 bg-orange-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                  <span className="text-[11px] sm:text-[13px] font-black uppercase tracking-[0.4em] sm:tracking-[0.5em] text-white/40 drop-shadow-lg">Sinal de Fã</span>
                  <span className="text-[8px] sm:text-[10px] font-medium text-white/15 mt-2 sm:mt-3 uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1 w-1 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: '200ms' }} />
                    Sintonizando...
                    <span className="h-1 w-1 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: '400ms' }} />
                  </span>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
      </div>
    </div>
  );
});
