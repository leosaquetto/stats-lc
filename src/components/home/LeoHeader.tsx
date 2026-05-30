/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Headphones, ChevronLeft, Music2, TrendingUp, Star } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { formatTimeSP, isTodaySP, formatDateSP, isYesterdaySP } from '../../lib/time';
import { UserStats } from '../../types/stats';
import {
  SmartImage,
  AnimatedNumber
} from '../shared/CommonUI';
import { VinylRecord } from './VinylRecord';
import { statsService } from '../../services/statsService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getDominantColor, withAlpha, ensureVisibility } from '../../lib/colorUtils';
import { getMainArtist, getMainArtistName, getSecondaryArtists } from '../../lib/artistUtils';
import { getCanonicalMembers, getVisibleMembers } from '../../lib/memberSelectors';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ScrollingTrackTitle = React.memo(({
  title,
  onClick
}: {
  title: string;
  onClick?: () => void;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const shouldScroll = title.length > 22 && !shouldReduceMotion;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block max-w-[50vw] overflow-hidden text-left pointer-events-auto cursor-pointer hover:underline sm:max-w-[260px]",
        shouldScroll && "[mask-image:linear-gradient(90deg,black_0%,black_90%,transparent_100%)]"
      )}
      title={title}
    >
      {shouldScroll ? (
        <motion.span
          className="flex w-max whitespace-nowrap text-[22px] sm:text-[28px] font-sans font-bold text-white leading-[1.04] tracking-normal drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: Math.min(18, Math.max(8, title.length * 0.34)), repeat: Infinity, ease: 'linear' }}
        >
          <span className="pr-8">{title}</span>
          <span className="pr-8" aria-hidden="true">{title}</span>
        </motion.span>
      ) : (
        <span className="block truncate whitespace-nowrap text-[22px] sm:text-[28px] font-sans font-bold text-white leading-[1.04] tracking-normal drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]">
          {title}
        </span>
      )}
    </button>
  );
});

interface LiveTrackProgressProps {
  progressMs?: number;
  progressPercent?: number;
  progressAnimationMs?: number;
  durationMs?: number;
  timestamp: string | number;
  isNowPlaying: boolean;
  platform: "spotify" | "appleMusic" | "unknown";
  compact?: boolean;
  dominantColor?: string | null;
}

const COMPLETE_MARGIN_MS = 2500;
const DRIFT_REANCHOR_MS = 5000;
const HIDDEN_FALLBACK_DURATION_MS = 3 * 60 * 1000;

type PlaybackSnapshot = {
  playbackKey: string;
  trackId: string;
  startedAt: number | null;
  baseProgressMs: number;
  durationMs: number | null;
  receivedAt: number;
};

function readTimeMs(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readProgressMs(nowPlaying: any) {
  const value = nowPlaying?.progressMs ?? nowPlaying?.playedMs;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function getPlaybackKey(userId: string, nowPlaying: any, previousSnapshot: PlaybackSnapshot | null) {
  const trackId = nowPlaying?.track?.id == null ? null : String(nowPlaying.track.id);
  if (!trackId) return null;

  const reliablePart =
    nowPlaying?.playbackKey ??
    nowPlaying?.streamId ??
    nowPlaying?.stream?.id ??
    nowPlaying?.playedAt ??
    nowPlaying?.endTime ??
    null;

  if (reliablePart != null && String(reliablePart).trim()) {
    return `${userId}:${trackId}:${String(reliablePart)}`;
  }

  if (previousSnapshot?.trackId === trackId) {
    return previousSnapshot.playbackKey;
  }

  return `${userId}:${trackId}:${nowPlaying?.timestamp ?? ''}`;
}

function calculateSnapshotProgress(snapshot: PlaybackSnapshot | null, now = Date.now()) {
  if (!snapshot) return 0;
  return Math.max(0, snapshot.baseProgressMs + (now - snapshot.receivedAt));
}

function useLivePlaybackProgress({
  userId,
  nowPlaying,
  durationMs,
  fetchGroupLive,
}: {
  userId: string;
  nowPlaying: any;
  durationMs?: number | null;
  fetchGroupLive: (force?: boolean) => Promise<void>;
}) {
  const snapshotRef = React.useRef<PlaybackSnapshot | null>(null);
  const completedPlaybackKeyRef = React.useRef<string | null>(null);
  const checkingPlaybackKeyRef = React.useRef<string | null>(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isCheckingNext, setIsCheckingNext] = useState(false);

  const trackId = nowPlaying?.track?.id == null ? null : String(nowPlaying.track.id);
  const isNow = nowPlaying?.isNow === true && !!trackId;
  const normalizedDurationMs =
    typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0
      ? durationMs
      : null;

  useEffect(() => {
    if (!isNow || !trackId) {
      snapshotRef.current = null;
      completedPlaybackKeyRef.current = null;
      checkingPlaybackKeyRef.current = null;
      setIsFinished(false);
      setIsCheckingNext(false);
      setSnapshotVersion(version => version + 1);
      return;
    }

    const playbackKey = getPlaybackKey(userId, nowPlaying, snapshotRef.current);
    if (!playbackKey) return;

    const now = Date.now();
    const startedAt = readTimeMs(nowPlaying?.playedAt ?? nowPlaying?.endTime ?? nowPlaying?.timestamp);
    const explicitProgressMs = readProgressMs(nowPlaying);
    const fallbackProgressMs = explicitProgressMs ?? (startedAt ? Math.max(0, now - startedAt) : 0);
    const previous = snapshotRef.current;

    if (!previous || previous.playbackKey !== playbackKey || previous.trackId !== trackId) {
      snapshotRef.current = {
        playbackKey,
        trackId,
        startedAt,
        baseProgressMs: fallbackProgressMs,
        durationMs: normalizedDurationMs,
        receivedAt: now,
      };
      completedPlaybackKeyRef.current = null;
      checkingPlaybackKeyRef.current = null;
      setIsFinished(false);
      setIsCheckingNext(false);
      setSnapshotVersion(version => version + 1);
      return;
    }

    snapshotRef.current = {
      ...previous,
      durationMs: normalizedDurationMs,
      startedAt: previous.startedAt ?? startedAt,
    };

    if (explicitProgressMs != null && completedPlaybackKeyRef.current !== playbackKey) {
      const projectedProgressMs = calculateSnapshotProgress(snapshotRef.current, now);
      if (Math.abs(projectedProgressMs - explicitProgressMs) >= DRIFT_REANCHOR_MS) {
        snapshotRef.current = {
          ...snapshotRef.current,
          baseProgressMs: explicitProgressMs,
          receivedAt: now,
        };
        setSnapshotVersion(version => version + 1);
      }
    }
  }, [
    userId,
    trackId,
    isNow,
    nowPlaying?.playbackKey,
    nowPlaying?.streamId,
    nowPlaying?.stream?.id,
    nowPlaying?.playedAt,
    nowPlaying?.endTime,
    nowPlaying?.timestamp,
    nowPlaying?.progressMs,
    nowPlaying?.playedMs,
    normalizedDurationMs,
  ]);

  const rawProgressMs = calculateSnapshotProgress(snapshotRef.current);
  const cappedProgressMs = normalizedDurationMs
    ? Math.min(rawProgressMs, normalizedDurationMs)
    : rawProgressMs;
  const progressPercent = normalizedDurationMs
    ? Math.min((cappedProgressMs / normalizedDurationMs) * 100, 100)
    : 0;
  const completionDurationMs = normalizedDurationMs ?? HIDDEN_FALLBACK_DURATION_MS;

  useEffect(() => {
    const snapshot = snapshotRef.current;
    if (!isNow || !snapshot) return;
    if (completedPlaybackKeyRef.current === snapshot.playbackKey) return;

    const nowProgress = calculateSnapshotProgress(snapshot);
    const delay = Math.max(0, completionDurationMs + COMPLETE_MARGIN_MS - nowProgress);
    const timer = window.setTimeout(() => {
      if (completedPlaybackKeyRef.current === snapshot.playbackKey) return;
      completedPlaybackKeyRef.current = snapshot.playbackKey;
      checkingPlaybackKeyRef.current = snapshot.playbackKey;
      setIsCheckingNext(true);

      fetchGroupLive(true)
        .catch(() => undefined)
        .finally(() => {
          if (checkingPlaybackKeyRef.current === snapshot.playbackKey) {
            checkingPlaybackKeyRef.current = null;
            setIsCheckingNext(false);
            if (snapshotRef.current?.playbackKey === snapshot.playbackKey) {
              setIsFinished(true);
            }
          }
        });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isNow, completionDurationMs, fetchGroupLive, snapshotVersion]);

  useEffect(() => {
    if (!isNow || !snapshotRef.current) return;
    const timer = window.setInterval(() => {
      setSnapshotVersion(version => version + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isNow, trackId]);

  const progressAnimationMs = normalizedDurationMs
    ? Math.max(0, normalizedDurationMs - cappedProgressMs)
    : 0;

  return {
    progressMs: cappedProgressMs,
    progressPercent,
    progressAnimationMs,
    isFinished,
    isCheckingNext,
    shouldSpinVinyl: isNow && !isFinished,
  };
}

export const LiveTrackProgress = memo(({
  progressMs,
  progressPercent,
  progressAnimationMs,
  durationMs,
  timestamp,
  isNowPlaying,
  platform,
  compact = false,
  dominantColor
}: LiveTrackProgressProps) => {
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
      viewBox="0 0 17 21"
      className="h-[1em] w-auto object-contain fill-current -translate-y-[1px]"
      aria-labelledby="apple-music-logo-title"
      role="img"
    >
      <title id="apple-music-logo-title">Apple Logo</title>
      <path d="M11.5 3.6C10.8 4.4 9.7 5.1 8.6 5C8.4 3.8 9 2.6 9.6 1.9C10.3 1 11.5 0.4 12.5 0.4C12.6 1.5 12.2 2.7 11.5 3.6ZM12.5 5.2C13.1 5.2 14.9 5.4 16.1 7.2C16 7.3 14 8.5 14 11C14 14 16.6 15 16.6 15C16.6 15.1 16.2 16.4 15.3 17.8C14.5 19 13.6 20.2 12.3 20.2C11 20.2 10.6 19.4 9.1 19.4C7.6 19.4 7.1 20.2 5.9 20.2C4.6 20.2 3.6 18.9 2.8 17.7C1.1 15.2 -0.2 10.7 1.6 7.7C2.4 6.2 4 5.2 5.6 5.2C6.9 5.2 8.1 6.1 8.8 6.1C9.5 6.1 10.9 5.1 12.5 5.2Z" />
    </svg>

  );

  const SpotifyIcon = () => (
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg"
      className="h-[1em] w-[1em] object-contain grayscale brightness-[1.9] opacity-75"
      alt="Spotify"
      referrerPolicy="no-referrer"
    />
  );
  const PlatformLogo = platform === 'spotify' ? <SpotifyIcon /> : <AppleMusicLogo />;
  const PlatformName = platform === 'spotify' ? 'SPOTIFY' : platform === 'appleMusic' ? 'APPLE MUSIC' : 'MUSIC';

  useEffect(() => {
    setMinPlayTime(false);
  }, [timestamp, durationMs, isNowPlaying]);

  const currentProgress = isNowPlaying ? (progressPercent ?? 0) : 100;
  const progressScale = Math.min(1, Math.max(0, currentProgress / 100));
  const elapsedMs = useMemo(() => progressMs ?? ((currentProgress / 100) * (durationMs || 0)), [currentProgress, durationMs, progressMs]);

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
            initial={{ opacity: 0 }} animate={{ opacity: 0.58 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-1.5 w-full"
          >
            <div className="flex items-center justify-center gap-1.5 mb-1 min-w-0">
              <span className="text-[7px] font-black text-white/35 uppercase tracking-[0.16em] whitespace-nowrap">OUVIU NO</span>
              <div className="flex items-center justify-center gap-1 min-w-0">
                <div className="text-white/35 flex items-center overflow-visible">
                  {PlatformLogo}
                </div>
                <span className="text-[7px] font-black text-white/35 uppercase tracking-[0.16em] whitespace-nowrap">{PlatformName}</span>
              </div>
              <span className="text-[7px] font-black text-white/35 uppercase tracking-[0.16em] whitespace-nowrap">{timeLabel}</span>
            </div>
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-full bg-white/20" />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-1.5 w-full"
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 mb-1">
              <span className="text-[8px] font-black text-white/35 uppercase tracking-[0.08em] opacity-0">0:00</span>
              <div className="mx-auto flex max-w-[96px] items-center justify-center gap-0.5 min-w-0 overflow-visible">
                <span className="text-[5.8px] font-black text-white/35 uppercase tracking-[0.08em] whitespace-nowrap">OUVINDO NO</span>
                <div className="text-white/35 flex items-center overflow-visible scale-[0.88]">
                  {PlatformLogo}
                </div>
                <span className="text-[5.8px] font-black text-white/35 uppercase tracking-[0.08em] whitespace-nowrap">{PlatformName}</span>
              </div>
              <span className="text-[8px] font-black text-white/35 uppercase tracking-[0.08em] opacity-0">0:00</span>
            </div>
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden relative">
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"
              />
            </div>
          </motion.div>
        )
      ) : (
        <motion.div
          key="playing"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="flex flex-col gap-1 w-full"
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 mb-0.5">
              <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.08em] tabular-nums">
              {formatTime(elapsedMs)}
            </span>
            <div className="mx-auto flex max-w-[96px] items-center justify-center gap-0.5 min-w-0 overflow-visible">
              <span className="text-[5.8px] font-black text-white/35 uppercase tracking-[0.08em] whitespace-nowrap">OUVINDO NO</span>
              <div className="text-white/35 flex items-center overflow-visible scale-[0.88]">
                {PlatformLogo}
              </div>
              <span className="text-[5.8px] font-black text-white/35 uppercase tracking-[0.08em] whitespace-nowrap">{PlatformName}</span>
            </div>
            <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.08em] tabular-nums">
              {formatTime(durationMs)}
            </span>
          </div>
          <div className="w-full h-1 rounded-full bg-white/10 overflow-visible relative">
            <div
              className="h-full w-full rounded-full relative"
              style={{
                transform: `scaleX(${progressScale})`,
                transformOrigin: 'left center',
                transition: isNowPlaying && progressAnimationMs && progressAnimationMs > 0
                  ? 'transform 1s linear'
                  : undefined,
                background: dominantColor
                  ? (() => {
                      const visibleColor = ensureVisibility(dominantColor, 120, 0.4);
                      return `linear-gradient(90deg, ${visibleColor}, ${withAlpha(visibleColor, 0.85)})`;
                    })()
                  : 'linear-gradient(90deg, #f97316, #fb923c)',
                filter: 'brightness(1.3) saturate(1.2)',
                boxShadow: dominantColor
                  ? (() => {
                      const visibleColor = ensureVisibility(dominantColor, 120, 0.4);
                      return `0 0 12px ${withAlpha(visibleColor, 0.6)}`;
                    })()
                  : '0 0 12px rgba(249,115,22,0.6)'
              }}
            >
              {/* Thumb */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white translate-x-1/2"
                style={{
                  boxShadow: dominantColor
                    ? (() => {
                        const visibleColor = ensureVisibility(dominantColor, 120, 0.4);
                        return `0 0 10px ${withAlpha(visibleColor, 1)}, 0 0 20px ${withAlpha(visibleColor, 0.5)}`;
                      })()
                    : '0 0 10px rgba(249,115,22,1), 0 0 20px rgba(249,115,22,0.5)',
                  filter: 'brightness(1.2)'
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

LiveTrackProgress.displayName = 'LiveTrackProgress';

export const LeoHeader = memo(({ user, streamsToday, onTrackClick, onAvatarClick, isHighlighted }: { user: UserStats, streamsToday: number, onTrackClick?: (track: any) => void, onAvatarClick?: (e: React.MouseEvent<HTMLElement>) => void, isHighlighted?: boolean }) => {
  if (!user) return null;
  const shouldReduceMotion = useReducedMotion();

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
  const groupStatsForUser = useStatsStore(s => s.groupStats);
  const storeUser = useMemo(
    () => getCanonicalMembers(groupStatsForUser).find(u => u.id === user.id),
    [groupStatsForUser, user.id]
  );
  const activeUser = storeUser || user;
  const nowPlaying = activeUser.nowPlaying;
  const track = nowPlaying?.track as any;
  const albumImage = useMemo(() => {
    if (!track) return "";
    const candidates = [
      track.albumImage,
      track.album?.image,
      track.album?.images?.[0]?.url,
      track.album?.images?.[0], // In case images[0] IS the URL string
      track.image,
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
  const mainArtist = useMemo(() => track ? getMainArtist(track) : null, [track]);
  const mainArtistName = useMemo(() => track ? getMainArtistName(track) : '', [track]);
  const secondaryArtists = useMemo(() => track ? getSecondaryArtists(track) : [], [track]);
  const albumArtistName = useMemo(() => {
    if (!track) return '';
    const candidate =
      track.albumArtist ||
      track.albumArtistName ||
      track.album?.artist ||
      track.album?.artistName ||
      track.primaryArtistName ||
      mainArtistName;
    return typeof candidate === 'string' ? candidate : (candidate?.name || candidate?.artistName || '');
  }, [track, mainArtistName]);

  const fetchGroupLive = useStatsStore(state => state.fetchGroupLive);
  const prevNowPlaying = React.useRef(nowPlaying);

  useEffect(() => {
    const wasPlaying = prevNowPlaying.current?.isNow === true;
    const isCurrentlyPlaying = nowPlaying?.isNow === true;
    if (wasPlaying && !isCurrentlyPlaying) {
      fetchGroupLive();
    }
    prevNowPlaying.current = nowPlaying;
  }, [nowPlaying, fetchGroupLive]);

  const playback = coreUtils.getPlaybackStatus({ nowPlaying });
  const backendIsLive = playback.status === "live" && nowPlaying?.isNow === true;
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
  const [listenStatsOpen, setListenStatsOpen] = useState(false);
  const [listenStatsActiveIndex, setListenStatsActiveIndex] = useState(0);
  const [listenStatsLoading, setListenStatsLoading] = useState(false);
  const [listenAlbumCount, setListenAlbumCount] = useState<number | null>(null);
  const [listenAlbumLoading, setListenAlbumLoading] = useState(false);
  const [listenStats, setListenStats] = useState({ artist: 0, track: 0, album: 0 });
  const [listenArtistStats, setListenArtistStats] = useState<Record<string, number>>({});
  const listenStatsRef = React.useRef<HTMLDivElement>(null);
  const listenDeckTouchStartRef = React.useRef<{ x: number; y: number } | null>(null);

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
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);

  const trackStatsKey = `${user.id}:${track?.id}`;
  const playCount = userTrackStats[trackStatsKey];

  useEffect(() => {
    if (track?.id) {
      fetchTrackStatsForAll(track.id);
    }
  }, [track?.id, fetchTrackStatsForAll]);

  useEffect(() => {
    setListenStatsOpen(false);
    setListenStatsActiveIndex(0);
  }, [track?.id]);

  const allTrackArenaUsers = useMemo(() => {
    if (!track?.id) return [];
    return getVisibleMembers(groupStats, hiddenUsers)
      .map(u => ({
        id: u.id,
        name: u.name,
        plays: userTrackStats[`${u.id}:${track?.id}`] || 0,
        avatar: coreUtils.getUserAvatar(u.id, u.avatar)
      }))
      .filter(u => u.plays > 0)
      .sort((a, b) => b.plays - a.plays);
  }, [groupStats, userTrackStats, track?.id, hiddenUsers]);

  const trackArenaUsers = useMemo(() =>
    arenaExpanded ? allTrackArenaUsers : allTrackArenaUsers.slice(0, 5)
  , [arenaExpanded, allTrackArenaUsers]);

  const hasMoreArena = allTrackArenaUsers.length > 5;

  const isToday = nowPlaying?.timestamp ? isTodaySP(new Date(nowPlaying.timestamp)) : true;
  const isYesterday = nowPlaying?.timestamp ? isYesterdaySP(new Date(nowPlaying.timestamp)) : false;
  const formattedTime = nowPlaying?.timestamp ? formatTimeSP(new Date(nowPlaying.timestamp)) : "";
  const formattedDate = nowPlaying?.timestamp ? formatDateSP(new Date(nowPlaying.timestamp)) : "";
  const durationMs = track?.durationMs || nowPlaying?.durationMs || null;
  const livePlayback = useLivePlaybackProgress({
    userId: user.id,
    nowPlaying,
    durationMs,
    fetchGroupLive,
  });
  const isActuallyLive = backendIsLive && livePlayback.shouldSpinVinyl;
  const statusLabel = isActuallyLive
    ? "OUVINDO AGORA"
    : isToday
      ? "REPRODUZIDO ÀS " + formattedTime
      : isYesterday
        ? "ONTEM ÀS " + formattedTime
        : `VISTO EM ${formattedDate}`;

  const othersPlayed = allTrackArenaUsers.some(u => u.id !== user.id);
  const showRankingSummary = !hideRankingBadge && othersPlayed;

  const listenAlbumId = track?.albumId || track?.album?.id;
  const canShowListenStats = !!track?.id;
  const listenArtistImage =
    mainArtist?.image ||
    mainArtist?.avatar ||
    track?.artistImage ||
    track?.primaryArtistImage ||
    track?.artists?.[0]?.image ||
    '';
  const listenArtists = useMemo(() => {
    const rawArtists = Array.isArray(track?.artists) ? track.artists : [];
    const findArtistImage = (artistId?: string, artistName?: string) => {
      const normalizedName = (artistName || '').trim().toLowerCase();
      const found = rawArtists.find((artist: any) => {
        const id = artist?.id || artist?.statsfmId || artist?.spotifyId || artist?.appleMusicId || '';
        const name = artist?.name || artist?.artistName || artist?.displayName || '';
        return (artistId && id === artistId) || (!!normalizedName && name.trim().toLowerCase() === normalizedName);
      });
      return found?.image || found?.avatar || found?.artistImage || found?.picture || '';
    };

    const artistMap = new Map<string, { id: string; name: string; image: string }>();
    const addArtist = (artist: any, fallbackName = 'Artista', fallbackImage = '') => {
      const id = artist?.id || artist?.statsfmId || artist?.spotifyId || artist?.appleMusicId || '';
      const name = artist?.name || artist?.artistName || artist?.displayName || fallbackName;
      const key = id || name.trim().toLowerCase();
      if (!key || artistMap.has(key)) return;
      artistMap.set(key, {
        id,
        name,
        image: artist?.image || artist?.avatar || artist?.artistImage || fallbackImage || findArtistImage(id, name) || albumImage
      });
    };

    addArtist(mainArtist, mainArtistName || 'Artista', listenArtistImage);
    secondaryArtists.forEach((artist) => addArtist(artist, artist.name || 'Artista'));

    return Array.from(artistMap.values());
  }, [albumImage, listenArtistImage, mainArtist, mainArtistName, secondaryArtists, track?.artists]);
  const shouldShowAlbumTitle = !!track?.albumName && (
    !isActuallyLive ||
    !listenAlbumId ||
    (!listenAlbumLoading && (listenAlbumCount || 0) > 0)
  );
  const liveRingDuration = useMemo(() => 2.7 + (user.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7) * 0.18, [user.id]);

  useEffect(() => {
    if (!listenStatsOpen) return;

    const close = () => setListenStatsOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (!listenStatsRef.current?.contains(event.target as Node)) close();
    };

    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [listenStatsOpen]);

  useEffect(() => {
    if (!listenStatsOpen || !canShowListenStats) return;

    let cancelled = false;
    setListenStatsLoading(true);
    const artistsToFetch = listenArtists.filter(artist => artist.id);
    Promise.all([
      Promise.all(artistsToFetch.map(artist =>
        statsService.fetchEntityStats(user.id, 'artist', artist.id).catch(() => 0)
      )),
      statsService.fetchEntityStats(user.id, 'track', track.id).catch(() => 0),
      listenAlbumId ? statsService.fetchEntityStats(user.id, 'album', listenAlbumId).catch(() => 0) : Promise.resolve(0),
    ]).then(([artistCounts, trackCount, album]) => {
      if (!cancelled) {
        const nextArtistStats = artistsToFetch.reduce<Record<string, number>>((acc, artist, index) => {
          acc[artist.id] = artistCounts[index] || 0;
          return acc;
        }, {});
        setListenArtistStats(nextArtistStats);
        setListenStats({ artist: artistCounts[0] || 0, track: trackCount, album });
      }
    }).finally(() => {
      if (!cancelled) setListenStatsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [listenStatsOpen, canShowListenStats, user.id, listenArtists, track?.id, listenAlbumId]);

  useEffect(() => {
    if (!canShowListenStats || !listenAlbumId) {
      setListenAlbumCount(null);
      setListenAlbumLoading(false);
      return;
    }

    let cancelled = false;
    setListenAlbumCount(null);
    setListenAlbumLoading(true);
    statsService.fetchEntityStats(user.id, 'album', listenAlbumId)
      .then((count) => {
        if (!cancelled) {
          setListenAlbumCount(count || 0);
          setListenStats(current => ({ ...current, album: count || 0 }));
        }
      })
      .catch(() => {
        if (!cancelled) setListenAlbumCount(0);
      })
      .finally(() => {
        if (!cancelled) setListenAlbumLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canShowListenStats, user.id, listenAlbumId]);

  const listenOrbitItems = useMemo(() => {
    if (!track?.id) return [];

    const artistItems = listenArtists.map((artist, index) => ({
      key: `artist-${artist.id || artist.name}-${index}`,
      id: artist.id,
      type: 'artist',
      label: index === 0 ? 'artista' : 'feat.',
      count: artist.id ? (listenArtistStats[artist.id] || 0) : (index === 0 ? listenStats.artist : 0),
      name: artist.name,
      image: artist.image || albumImage,
      rounded: 'full' as const,
      presentation: 'artist' as const,
    }));

    const mediaItems = [
      {
        key: 'track',
        id: track.id,
        type: 'track',
        label: 'música',
        count: listenStats.track,
        name: track?.name || 'Música',
        image: albumImage,
        rounded: 'xl' as const,
        presentation: 'track' as const,
      },
      {
        key: 'album',
        id: listenAlbumId || '',
        type: 'album',
        label: 'álbum',
        count: listenStats.album,
        name: track?.albumName || 'Álbum',
        image: albumImage,
        rounded: 'xl' as const,
        presentation: 'album' as const,
      }
    ].filter(item => item.key !== 'album' || listenStatsLoading || item.count > 0);

    return [...artistItems, ...mediaItems];
  }, [albumImage, listenAlbumId, listenArtistStats, listenArtists, listenStats, listenStatsLoading, track?.albumName, track?.id, track?.name]);

  useEffect(() => {
    if (listenStatsActiveIndex >= listenOrbitItems.length) {
      setListenStatsActiveIndex(0);
    }
  }, [listenOrbitItems.length, listenStatsActiveIndex]);

  const handleListenStatsCardClick = React.useCallback((item: any) => {
    if (!track) return;

    if (item.type === 'track') {
      onTrackClick?.({ ...track, type: 'track' });
    } else if (item.type === 'album') {
      onTrackClick?.({
        id: track.albumId || '',
        name: track.albumName,
        type: 'album',
        albumName: track.albumName,
        albumImage,
        image: albumImage,
        albumArtist: albumArtistName,
        primaryArtistName: albumArtistName || mainArtistName,
        artists: track.artists,
        artistName: albumArtistName || mainArtistName
      });
    } else {
      onTrackClick?.({ id: item.id || '', name: item.name, type: 'artist' });
    }
  }, [albumArtistName, albumImage, mainArtistName, onTrackClick, track]);

  const handleListenStatsDragEnd = React.useCallback((_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const leftIntent = info.offset.x < -34 || info.velocity.x < -360;
    const rightIntent = info.offset.x > 34 || info.velocity.x > 360;

    if (!listenStatsOpen) {
      if (leftIntent) setListenStatsOpen(true);
      return;
    }

    if (leftIntent) {
      setListenStatsActiveIndex(current => listenOrbitItems.length > 0 ? (current + 1) % listenOrbitItems.length : 0);
      return;
    }

    if (rightIntent) {
      if (listenStatsActiveIndex <= 0) {
        setListenStatsOpen(false);
      } else {
        setListenStatsActiveIndex(current => Math.max(0, current - 1));
      }
    }
  }, [listenOrbitItems.length, listenStatsActiveIndex, listenStatsOpen]);

  const handleListenDeckTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    listenDeckTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleListenDeckTouchMove = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = listenDeckTouchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      event.stopPropagation();
    }
  }, []);

  const handleListenDeckTouchEnd = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = listenDeckTouchStartRef.current;
    const touch = event.changedTouches[0];
    listenDeckTouchStartRef.current = null;
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 34 || Math.abs(dx) < Math.abs(dy) * 1.25) return;

    if (dx < 0) {
      setListenStatsActiveIndex(current => listenOrbitItems.length > 0 ? (current + 1) % listenOrbitItems.length : 0);
      return;
    }

    if (listenStatsActiveIndex <= 0) {
      setListenStatsOpen(false);
    } else {
      setListenStatsActiveIndex(current => Math.max(0, current - 1));
    }
  }, [listenOrbitItems.length, listenStatsActiveIndex]);

  const filteredMembers = useMemo(() => {
    return getVisibleMembers(groupStats, hiddenUsers);
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
    <div className={cn(
      "relative -mt-3 px-5 sm:px-8 overflow-visible",
      isActuallyLive ? "mb-4" : "mb-2"
    )}>
      <div className={cn(
        "w-full relative overflow-visible",
        isActuallyLive ? "min-h-[334px] sm:min-h-[410px]" : "min-h-[306px] sm:min-h-[376px]"
      )}>
      <motion.div
        className="relative h-full overflow-visible"
      >
        {/* Open ambient header backdrop */}
        <div className={cn(
          "absolute -inset-x-8 -top-[calc(6rem+env(safe-area-inset-top,0px))] bottom-[-128px] overflow-hidden transition-all duration-500 pointer-events-none",
          isHighlighted
            ? "shadow-[0_0_40px_rgba(249,115,22,0.38)]"
            : "shadow-[0_24px_70px_-45px_rgba(0,0,0,0.9)]"
        )}
        style={{
          willChange: 'transform, opacity',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 76%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 76%, transparent 100%)'
        }}
        >
          <AnimatePresence>
            {isActuallyLive ? (
              <motion.div
                key="live-bg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-[inherit]"
                style={{
                  background: dominantColor
                    ? `linear-gradient(135deg, rgba(0,0,0,0.76) 0%, ${withAlpha(dominantColor, 0.24)} 52%, rgba(0,0,0,0.2) 100%)`
                    : 'linear-gradient(135deg, rgba(0,0,0,0.76) 0%, rgba(88,28,135,0.22) 52%, rgba(0,0,0,0.2) 100%)'
                }}
              >
                <motion.div
                  animate={{
                    opacity: [0.62, 0.95, 0.62]
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 pointer-events-none mix-blend-screen"
                  style={{
                    background: dominantColor
                      ? `radial-gradient(circle at 68% 38%, ${withAlpha(dominantColor, 0.48)} 0%, transparent 64%)`
                      : "radial-gradient(circle at 68% 38%, rgba(168,85,247,0.42) 0%, transparent 64%)"
                  }}
                />
                <motion.div
                  animate={{
                    opacity: [0.34, 0.62, 0.34]
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute inset-0 pointer-events-none mix-blend-screen"
                  style={{
                    background: dominantColor
                      ? `radial-gradient(circle at 18% 58%, ${withAlpha(dominantColor, 0.32)} 0%, transparent 58%)`
                      : "radial-gradient(circle at 18% 58%, rgba(234,88,12,0.28) 0%, transparent 58%)"
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/4 via-black/10 to-transparent backdrop-blur-[1px]" />
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
                 <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-transparent" />
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/25" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {track && (
          <div className="absolute right-[-142px] top-[-58px] h-[330px] w-[330px] sm:right-[-188px] sm:top-[-82px] sm:h-[470px] sm:w-[470px] shrink-0 z-20 pointer-events-auto">
            <div className="w-full h-full overflow-visible">
              <VinylRecord
                albumImage={albumImage || ""}
                dominantColor={dominantColor || ""}
                isPlaying={isActuallyLive}
                progressMs={livePlayback.progressMs}
                durationMs={durationMs || undefined}
                onClick={handleVinylClick}
              />
            </div>
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
              <div className="flex flex-row items-center gap-3 sm:gap-4 relative z-40 -mt-6">

                {/* Avatar com ring animado quando tocando */}
                <motion.div
                  onClick={(e) => {
                    if (!onAvatarClick) return;
                    e.stopPropagation();
                    onAvatarClick(e);
                  }}
                  role={onAvatarClick ? "button" : undefined}
                  tabIndex={onAvatarClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (!onAvatarClick) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      onAvatarClick(e as any);
                    }
                  }}
                  className={cn("relative shrink-0", onAvatarClick && "cursor-pointer")}
                  whileTap={onAvatarClick ? { scale: 0.95 } : undefined}
                >
                  {isActuallyLive && (
                    <motion.div
                      className="absolute inset-[-3px] rounded-full"
                      style={{
                        background: `conic-gradient(${dominantColor || '#f97316'}, transparent, ${dominantColor || '#f97316'})`,
                        filter: 'brightness(1.5) saturate(1.3)'
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: liveRingDuration, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                    <div className={cn(
                      "relative rounded-full overflow-hidden border-2 transition-all duration-500",
                      isActuallyLive
                        ? "w-[70px] h-[70px] sm:w-[86px] sm:h-[86px] border-white/80 shadow-[0_0_16px_rgba(255,255,255,0.45)]"
                        : "w-16 h-16 sm:w-[72px] sm:h-[72px] border-white/20"
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
                <div className="flex flex-col items-start min-w-0 gap-1 flex-1 pr-[92px] sm:pr-[150px]">

                  {/* Nome */}
                  <div className="relative flex w-full items-center gap-2 overflow-visible">
                    <h2 className={cn(
                      "text-[18px] sm:text-[20px] font-display font-bold tracking-normal leading-none truncate min-w-0 transition-colors duration-500",
                      isActuallyLive ? "text-white" : "text-white/70"
                    )}>
                      {user.name}
                    </h2>
                  </div>

                  {/* Streams hoje */}
                  <div className={cn(
                    "flex h-6 max-w-[min(62vw,220px)] -ml-1 items-center gap-1 rounded-full border px-2 backdrop-blur-xl transition-all duration-500",
                    isActuallyLive
                      ? "bg-black/20 border-white/20 shadow-[0_0_22px_rgba(249,115,22,0.10)]"
                      : "bg-black/15 border-white/10"
                  )}>
                    <TrendingUp className={cn(
                      "h-2.5 w-2.5 shrink-0 transition-colors duration-500",
                      isActuallyLive ? "text-orange-400" : "text-white/30"
                    )} />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn(
                        "text-[11px] sm:text-[13px] font-black tabular-nums leading-none transition-colors duration-500",
                        isActuallyLive ? "text-white" : "text-white/60"
                      )}>
                        <AnimatedNumber value={streamsToday} />
                      </span>
                      <span className="text-[6px] sm:text-[6.5px] font-black uppercase tracking-[0.16em] text-white/35 leading-none whitespace-nowrap truncate">
                        STREAMS HOJE
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
                    <div className="flex flex-col justify-start w-full shrink-0 min-w-0 pl-0 pr-1 gap-5 sm:gap-6 relative z-40">
                      <div className="flex flex-col gap-1.5">
                        <ScrollingTrackTitle
                          title={track.name}
                          onClick={() => onTrackClick?.({ ...track, type: 'track' })}
                        />
                        <div className="text-[22px] sm:text-[28px] font-medium text-white/80 line-clamp-1 flex items-center flex-wrap gap-x-1 pointer-events-auto select-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] w-[62vw] max-w-[300px] leading-[1.04]">
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
                                <React.Fragment key={`secondary-${sec.id || sec.name || 'artist'}-${idx}`}>
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
                        {shouldShowAlbumTitle && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrackClick?.({
                                id: track.albumId || '',
                                name: track.albumName,
                                type: 'album',
                                albumName: track.albumName,
                                albumImage,
                                image: albumImage,
                                albumArtist: albumArtistName,
                                primaryArtistName: albumArtistName || mainArtistName,
                                artists: track.artists,
                                artistName: albumArtistName || mainArtistName
                              });
                            }}
                            className="text-[10px] sm:text-[12px] font-black uppercase tracking-[0.02em] text-white/50 line-clamp-2 hover:underline hover:text-white/80 cursor-pointer text-left pointer-events-auto w-[62vw] max-w-[300px] leading-[1.18] [text-wrap:balance]"
                          >
                            {track.albumName.toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="w-[calc((100vw-40px)*0.5)] min-w-[154px] max-w-[220px]">
                         <LiveTrackProgress
                            progressMs={livePlayback.progressMs}
                            progressPercent={livePlayback.progressPercent}
                            progressAnimationMs={livePlayback.progressAnimationMs}
                            durationMs={durationMs || undefined}
                            timestamp={nowPlaying.timestamp}
                            isNowPlaying={isActuallyLive}
                            platform={platform.primary}
                            compact
                        dominantColor={dominantColor || undefined}
                         />
                      </div>

                      <div className="relative flex w-[calc(100vw-40px)] max-w-[350px] items-start justify-between gap-2 pr-1">
                        <div className="flex min-w-0 max-w-[calc(100%-48px)] flex-wrap items-center gap-2">
                          {playCount === 1 ? (
                            <div className="flex h-7 items-center gap-1.5 rounded-full border border-orange-400/20 bg-black/20 px-3 backdrop-blur-xl shadow-[0_0_22px_rgba(249,115,22,0.10)]">
                              <Star className="h-2.5 w-2.5 fill-orange-400 text-orange-400" />
                              <span className="text-[10px] font-black tabular-nums leading-none text-orange-300">
                                <AnimatedNumber value={1} />
                              </span>
                              <span className="text-[7px] font-black uppercase tracking-[0.18em] leading-none text-orange-300/80 whitespace-nowrap">
                                FIRST LISTEN
                              </span>
                            </div>
                          ) : showRankingSummary ? (
                            <motion.div
                              onClick={() => onTrackClick?.({ ...track, type: 'track' })}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                "flex items-center gap-0 cursor-pointer group/arena max-w-full",
                                arenaExpanded ? "max-w-full flex-wrap justify-center gap-1 py-1" : "shrink-0"
                              )}
                            >
                              <div className="flex -space-x-2.5 shrink-0 overflow-visible py-2 pr-1">
                                {trackArenaUsers.map((u, i) => (
                                  <motion.div
                                    key={`${u.id}-${i}`}
                                    initial={{ opacity: 0, scale: 0.8, y: 4 }}
                                    animate={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : {
                                      opacity: 1,
                                      scale: u.id === user.id ? 1.05 : 1,
                                      x: [0, i % 2 === 0 ? -2 : 2, 0],
                                      y: [0, i % 2 === 0 ? -4 : 3, 0],
                                      rotate: [0, i % 2 === 0 ? -2 : 2, 0],
                                    }}
                                    transition={shouldReduceMotion ? { delay: i * 0.04 } : {
                                      opacity: { delay: i * 0.04, duration: 0.18 },
                                      scale: { delay: i * 0.04, duration: 0.22 },
                                      x: { delay: i * 0.22, duration: 8.8 + i * 0.42, repeat: Infinity, ease: 'easeInOut' },
                                      y: { delay: i * 0.26, duration: 9.6 + i * 0.38, repeat: Infinity, ease: 'easeInOut' },
                                      rotate: { delay: i * 0.2, duration: 10.4 + i * 0.34, repeat: Infinity, ease: 'easeInOut' },
                                    }}
                                    className={cn(
                                      "relative group/avatar shrink-0",
                                      u.id === user.id ? "z-20" : ""
                                    )}
                                    style={{ zIndex: trackArenaUsers.length - i }}
                                  >
                                    <div className={cn(
                                      "relative h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden transition-all duration-300 ring-2 shadow-[0_16px_34px_rgba(0,0,0,0.42)]",
                                      u.id === user.id ? "ring-orange-500/85" : "ring-white/20 group-hover/avatar:ring-white/45"
                                    )}>
                                      <div className="relative h-full w-full rounded-full overflow-hidden">
                                        <SmartImage src={u.avatar} className="h-full w-full object-cover" fallback="" rounded="full" />
                                      </div>
                                    </div>

                                    <motion.div
                                      animate={shouldReduceMotion ? {} : {
                                        y: [0, i % 2 === 0 ? 2 : -2, 0],
                                        scale: [1, 1.08, 1],
                                      }}
                                      transition={shouldReduceMotion ? {} : {
                                        delay: 0.12 + i * 0.17,
                                        duration: 4.4 + i * 0.24,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                      }}
                                      className={cn(
                                      "absolute -bottom-1 -right-1 h-4 min-w-[16px] px-1 sm:h-4 sm:min-w-[16px] rounded-full border border-white/10 flex items-center justify-center text-[7px] sm:text-[8px] font-black text-white z-30 shadow-xl",
                                      u.id === user.id ? "bg-orange-600 ring-1 ring-white/40" : "bg-stone-900/90 backdrop-blur-md"
                                    )}
                                    >
                                      {coreUtils.formatNumber(u.plays)}
                                    </motion.div>
                                  </motion.div>
                                ))}
                              </div>

                              {hasMoreArena && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setArenaExpanded(!arenaExpanded); }}
                                  className="ml-1 flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/35 text-[8px] sm:text-[9px] font-bold text-white/80 shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:bg-white/10"
                                >
                                  {arenaExpanded ? <ChevronLeft className="h-3 w-3" /> : `+${allTrackArenaUsers.length - trackArenaUsers.length}`}
                                </button>
                              )}
                            </motion.div>
                          ) : (
                            <motion.div
                              onClick={(e) => { e.stopPropagation(); onTrackClick?.({ ...track, type: 'track' }); }}
                              whileTap={{ scale: 0.96 }}
                              className="flex items-center gap-2 cursor-pointer shrink-0"
                            >
                              {playCount === undefined ? (
                                <div className="h-6 w-20 rounded-full bg-white/5 animate-pulse" />
                              ) : (
                                <div className="flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 backdrop-blur-xl">
                                  <Headphones className={cn(
                                    "h-2.5 w-2.5 transition-colors duration-500",
                                    isActuallyLive ? "text-orange-400" : "text-white/40"
                                  )} />
                                  <span className={cn(
                                    "text-[10px] font-black tabular-nums leading-none transition-colors duration-500",
                                    isActuallyLive ? "text-white" : "text-white/60"
                                  )}>
                                    <AnimatedNumber value={playCount} />
                                  </span>
                                  <span className={cn(
                                    "text-[7px] font-black uppercase tracking-[0.18em] leading-none transition-colors duration-500",
                                    isActuallyLive ? "text-white/60" : "text-white/40"
                                  )}>
                                    PLAYS
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>

                        <AnimatePresence>
                          {canShowListenStats && (
                            <motion.div
                              ref={listenStatsRef}
                              initial={{ opacity: 0, scale: 0.92 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.92 }}
                              className="pointer-events-none absolute -right-4 -top-5 z-[85] h-[190px] w-[230px]"
                            >
                              <AnimatePresence>
                                {listenStatsOpen && (
                                  <motion.div
                                    data-home-horizontal-scroll="true"
                                    initial={{ opacity: 0, x: 46, scale: 0.9, filter: 'blur(8px)' }}
                                    animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, x: 36, scale: 0.94, filter: 'blur(8px)' }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 34, mass: 0.7 }}
                                    onTouchStart={handleListenDeckTouchStart}
                                    onTouchMove={handleListenDeckTouchMove}
                                    onTouchEnd={handleListenDeckTouchEnd}
                                    onTouchCancel={() => { listenDeckTouchStartRef.current = null; }}
                                    className="pointer-events-auto absolute right-0 top-0 h-[178px] w-[214px] touch-pan-y select-none"
                                  >
                                    <div className="pointer-events-none absolute inset-[-10px] rounded-[36px] bg-black/28 blur-xl" />
                                    <div className="pointer-events-none absolute inset-0 rounded-full border border-white/[0.035]" />
                                    <div className="pointer-events-none absolute right-1 top-4 h-32 w-32 rounded-full bg-black/22 blur-2xl" />

                                    {listenOrbitItems.map((item, index) => {
                                      const relative = index - listenStatsActiveIndex;
                                      if (relative < -1 || relative > 2) return null;

                                      const isActiveCard = relative === 0;
                                      const x = relative === 0 ? 0 : relative === 1 ? 52 : relative === 2 ? 78 : -40;
                                      const y = relative === 0 ? 0 : relative === 1 ? -10 : relative === 2 ? 8 : 10;
                                      const scale = relative === 0 ? 1 : relative === 1 ? 0.78 : 0.62;
                                      const opacity = relative === 0 ? 1 : relative === 1 ? 0.48 : 0.22;
                                      const blur = relative === 0 ? 'blur(0px)' : relative === 1 ? 'blur(2px)' : 'blur(5px)';

                                      return (
                                        <motion.button
                                          key={item.key}
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            if (isActiveCard) handleListenStatsCardClick(item);
                                            else setListenStatsActiveIndex(index);
                                          }}
                                          animate={{ x, y, scale, opacity, filter: blur, zIndex: isActiveCard ? 30 : 10 - Math.abs(relative), rotate: relative === 0 ? 0 : relative > 0 ? 4 : -5 }}
                                          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                                          className="absolute right-0 top-3 flex w-[142px] flex-col items-center text-center"
                                        >
                                          <div className={cn(
                                            "glass-aura relative flex h-[92px] w-[92px] items-center justify-center !border-white/10 shadow-[0_20px_48px_rgba(0,0,0,0.55)]",
                                            item.presentation === 'artist' ? "rounded-full" : "rounded-[22px]"
                                          )}>
                                            <div className="absolute inset-0 rounded-[inherit] bg-white/[0.055]" />
                                            <SmartImage
                                              src={item.image}
                                              className={cn(
                                                "relative h-full w-full object-cover shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]",
                                                item.presentation === 'track' && "[&_img]:scale-125"
                                              )}
                                              fallback={item.name}
                                              rounded={item.presentation === 'artist' ? 'full' : '2xl'}
                                            />
                                            <span className="absolute -right-3 -top-3 flex h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-orange-600 px-2 text-[14px] font-black leading-none text-white shadow-[0_14px_30px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                                              {listenStatsLoading ? '...' : coreUtils.formatNumber(item.count)}
                                            </span>
                                          </div>
                                          <div className="glass-aura mt-2 max-w-[150px] rounded-[20px] px-3 py-2 !border-white/10 shadow-[0_16px_34px_rgba(0,0,0,0.42)]">
                                            <span className="block text-[7px] font-black uppercase tracking-[0.22em] text-orange-500">
                                              {item.label}
                                            </span>
                                            <span className="mt-1 block text-[12px] font-black leading-tight text-white">
                                              {item.name}
                                            </span>
                                          </div>
                                        </motion.button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <AnimatePresence>
                                {!listenStatsOpen && (
                                  <motion.button
                                    type="button"
                                    drag="x"
                                    dragConstraints={{ left: -112, right: 0 }}
                                    dragElastic={0.1}
                                    onDragEnd={handleListenStatsDragEnd}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setListenStatsOpen(true);
                                    }}
                                    aria-label="Ver contagens desta reprodução"
                                    initial={{ opacity: 0, x: 22, scale: 0.84 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 26, scale: 0.74 }}
                                    transition={{ type: 'spring', stiffness: 560, damping: 32, mass: 0.68 }}
                                    className="glass-aura pointer-events-auto absolute right-0 top-7 flex h-[62px] w-[62px] touch-pan-y items-center justify-center overflow-visible rounded-full !border-white/10 text-white active:scale-95"
                                  >
                                    <div className="absolute inset-0 rounded-full bg-white/[0.06]" />
                                    <SmartImage
                                      src={listenArtists[0]?.image || listenArtistImage || albumImage}
                                      className="relative h-full w-full object-cover"
                                      fallback={mainArtistName || 'Artista'}
                                      rounded="full"
                                    />
                                  </motion.button>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
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
