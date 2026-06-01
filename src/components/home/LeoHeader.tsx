/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, memo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { Repeat, Music2, TrendingUp, Star, BookOpen } from 'lucide-react';
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
import { getDominantColor, withAlpha, ensureVisibility, getSaturation, getPerceivedBrightness, normalizeColor } from '../../lib/colorUtils';
import { getMainArtist, getMainArtistName, getSecondaryArtists } from '../../lib/artistUtils';
import { attachLiveNowPlayingToMember, getCanonicalMembers, getVisibleMembersWithLive } from '../../lib/memberSelectors';

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
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const shouldScroll = scrollDistance > 0 && !shouldReduceMotion;

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const text = measureRef.current;
      if (!container || !text) return;
      const overflow = text.scrollWidth - container.clientWidth;
      setScrollDistance(overflow > 2 ? text.scrollWidth + 32 : 0);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [title]);

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={onClick}
      className={cn(
        "relative block max-w-[50vw] overflow-hidden pb-1 text-left pointer-events-auto cursor-pointer hover:underline sm:max-w-[260px]",
        shouldScroll && "[mask-image:linear-gradient(90deg,black_0%,black_86%,transparent_100%)]"
      )}
      title={title}
    >
      {shouldScroll ? (
        <motion.span
          className="flex w-max whitespace-nowrap text-[22px] sm:text-[28px] font-sans font-bold text-white leading-[1.14] tracking-normal"
          animate={{ x: [0, -scrollDistance] }}
          transition={{ duration: Math.min(18, Math.max(8, title.length * 0.34)), repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
        >
          <span className="pr-8">{title}</span>
          <span className="pr-8" aria-hidden="true">{title}</span>
        </motion.span>
      ) : (
        <span className="block whitespace-nowrap text-[22px] sm:text-[28px] font-sans font-bold text-white leading-[1.14] tracking-normal">
          {title}
        </span>
      )}
      <span
        ref={measureRef}
        className="pointer-events-none absolute -z-10 whitespace-nowrap text-[22px] sm:text-[28px] font-sans font-bold leading-[1.14] tracking-normal opacity-0"
        aria-hidden="true"
      >
        {title}
      </span>
    </button>
  );
});

interface LiveTrackProgressProps {
  progressMs?: number;
  progressPercent?: number;
  progressAnimationMs?: number;
  progressAnimationKey?: string;
  durationMs?: number;
  timestamp: string | number;
  isNowPlaying: boolean;
  platform: "spotify" | "appleMusic" | "unknown";
  compact?: boolean;
  dominantColor?: string | null;
}

function formatTrackTime(ms: number) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const LiveElapsedTime = memo(({
  baseMs,
  durationMs,
  isRunning,
  className
}: {
  baseMs: number;
  durationMs?: number;
  isRunning: boolean;
  className?: string;
}) => {
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const base = Number.isFinite(baseMs) ? Math.max(0, baseMs) : 0;
    const max = typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0
      ? durationMs
      : Infinity;
    const startedAt = performance.now();

    const renderTime = () => {
      const nextMs = isRunning ? base + (performance.now() - startedAt) : base;
      if (labelRef.current) {
        labelRef.current.textContent = formatTrackTime(Math.min(nextMs, max));
      }
    };

    renderTime();

    if (!isRunning) return;

    const timer = window.setInterval(renderTime, 1000);
    document.addEventListener('visibilitychange', renderTime);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', renderTime);
    };
  }, [baseMs, durationMs, isRunning]);

  return (
    <span ref={labelRef} className={className}>
      {formatTrackTime(baseMs)}
    </span>
  );
});

LiveElapsedTime.displayName = 'LiveElapsedTime';

const COMPLETE_MARGIN_MS = 2500;
const DRIFT_REANCHOR_MS = 5000;
const HIDDEN_FALLBACK_DURATION_MS = 3 * 60 * 1000;
const COMPLETION_RECHECK_INTERVAL_MS = 5000;
const MAX_COMPLETION_RECHECKS = 6;

function normalizePlaybackAccent(color: string | null) {
  if (!color) return null;
  const normalized = normalizeColor(color, '#ff5f00');
  const saturation = getSaturation(normalized);
  const brightness = getPerceivedBrightness(normalized);
  if (saturation < 0.16) {
    if (brightness > 168) return '#f2eee6';
    if (brightness < 58) return '#ff5f00';
  }
  return normalized;
}

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

function inferProgressMsFromTimestamp(nowPlaying: any, durationMs: number | null, now = Date.now()) {
  if (!durationMs) return null;
  const explicitProgressMs = readProgressMs(nowPlaying);
  if (explicitProgressMs != null) return explicitProgressMs;

  const startedAt = readTimeMs(
    nowPlaying?.playedAt ??
    nowPlaying?.startedAt ??
    nowPlaying?.startTime ??
    nowPlaying?.timestamp
  );
  if (startedAt) {
    return Math.max(0, Math.min(durationMs, now - startedAt));
  }

  const endedAt = readTimeMs(nowPlaying?.endTime);
  if (endedAt) {
    const inferredStart = endedAt - durationMs;
    return Math.max(0, Math.min(durationMs, now - inferredStart));
  }

  return null;
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
  const completionCheckAttemptsRef = React.useRef<Record<string, number>>({});
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
      completionCheckAttemptsRef.current = {};
      setIsFinished(false);
      setIsCheckingNext(false);
      setSnapshotVersion(version => version + 1);
      return;
    }

    const playbackKey = getPlaybackKey(userId, nowPlaying, snapshotRef.current);
    if (!playbackKey) return;

    const now = Date.now();
    const inferredProgressMs = inferProgressMsFromTimestamp(nowPlaying, normalizedDurationMs, now);
    const startedAt =
      readTimeMs(nowPlaying?.playedAt ?? nowPlaying?.startedAt ?? nowPlaying?.startTime ?? nowPlaying?.timestamp) ??
      (normalizedDurationMs && readTimeMs(nowPlaying?.endTime)
        ? readTimeMs(nowPlaying?.endTime)! - normalizedDurationMs
        : null);
    const fallbackProgressMs = inferredProgressMs ?? (startedAt ? Math.max(0, now - startedAt) : 0);
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
      completionCheckAttemptsRef.current = {};
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

    if (inferredProgressMs != null && completedPlaybackKeyRef.current !== playbackKey) {
      const projectedProgressMs = calculateSnapshotProgress(snapshotRef.current, now);
      if (Math.abs(projectedProgressMs - inferredProgressMs) >= DRIFT_REANCHOR_MS) {
        snapshotRef.current = {
          ...snapshotRef.current,
          baseProgressMs: inferredProgressMs,
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
    const attempts = completionCheckAttemptsRef.current[snapshot.playbackKey] || 0;
    const delay = attempts > 0
      ? COMPLETION_RECHECK_INTERVAL_MS
      : Math.max(0, completionDurationMs + COMPLETE_MARGIN_MS - nowProgress);
    const timer = window.setTimeout(() => {
      if (completedPlaybackKeyRef.current === snapshot.playbackKey) return;
      checkingPlaybackKeyRef.current = snapshot.playbackKey;
      setIsCheckingNext(true);

      fetchGroupLive(true)
        .catch(() => undefined)
        .finally(() => {
          if (checkingPlaybackKeyRef.current === snapshot.playbackKey) {
            checkingPlaybackKeyRef.current = null;
            setIsCheckingNext(false);
            if (snapshotRef.current?.playbackKey === snapshot.playbackKey) {
              const nextAttempts = (completionCheckAttemptsRef.current[snapshot.playbackKey] || 0) + 1;
              completionCheckAttemptsRef.current[snapshot.playbackKey] = nextAttempts;
              if (nextAttempts >= MAX_COMPLETION_RECHECKS) {
                completedPlaybackKeyRef.current = snapshot.playbackKey;
                setIsFinished(true);
              } else {
                setSnapshotVersion(version => version + 1);
              }
            }
          }
        });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isNow, completionDurationMs, fetchGroupLive, snapshotVersion]);

  useEffect(() => {
    if (!isNow || !snapshotRef.current) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setSnapshotVersion(version => version + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isNow, trackId]);

  const progressAnimationMs = normalizedDurationMs
    ? Math.max(0, normalizedDurationMs - cappedProgressMs)
    : 0;

  return {
    progressMs: cappedProgressMs,
    progressPercent,
    progressAnimationMs,
    progressAnimationKey: `${snapshotRef.current?.playbackKey || 'idle'}:${snapshotVersion}`,
    isFinished,
    isCheckingNext,
    shouldSpinVinyl: isNow && !isFinished,
  };
}

export const LiveTrackProgress = memo(({
  progressMs,
  progressPercent,
  progressAnimationMs,
  progressAnimationKey,
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
              <LiveElapsedTime
                baseMs={elapsedMs}
                durationMs={durationMs}
                isRunning={isNowPlaying}
                className="text-[8px] font-black text-white/40 uppercase tracking-[0.08em] tabular-nums"
              />
            <div className="mx-auto flex max-w-[96px] items-center justify-center gap-0.5 min-w-0 overflow-visible">
              <span className="text-[5.8px] font-black text-white/35 uppercase tracking-[0.08em] whitespace-nowrap">OUVINDO NO</span>
              <div className="text-white/35 flex items-center overflow-visible scale-[0.88]">
                {PlatformLogo}
              </div>
              <span className="text-[5.8px] font-black text-white/35 uppercase tracking-[0.08em] whitespace-nowrap">{PlatformName}</span>
            </div>
            <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.08em] tabular-nums">
              {formatTrackTime(durationMs)}
            </span>
          </div>
          <div className="w-full h-1 rounded-full bg-white/10 overflow-visible relative">
            <motion.div
              key={progressAnimationKey}
              className="h-full w-full rounded-full relative"
              initial={{ scaleX: progressScale }}
              animate={{ scaleX: isNowPlaying ? 1 : progressScale }}
              transition={{
                duration: isNowPlaying && progressAnimationMs && progressAnimationMs > 0
                  ? Math.max(0.2, progressAnimationMs / 1000)
                  : 0,
                ease: 'linear'
              }}
              style={{
                transformOrigin: 'left center',
                background: dominantColor
                  ? (() => {
                      const visibleColor = ensureVisibility(dominantColor, 120, 0.4);
                      return `linear-gradient(90deg, ${visibleColor}, ${withAlpha(visibleColor, 0.85)})`;
                    })()
                  : 'linear-gradient(90deg, #647062, #8b947e)',
                filter: 'brightness(1.3) saturate(1.2)',
                boxShadow: dominantColor
                  ? (() => {
                      const visibleColor = ensureVisibility(dominantColor, 120, 0.4);
                      return `0 0 12px ${withAlpha(visibleColor, 0.6)}`;
                    })()
                  : '0 0 12px rgba(100,112,98,0.45)'
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
                    : '0 0 10px rgba(100,112,98,0.9), 0 0 20px rgba(100,112,98,0.35)',
                  filter: 'brightness(1.2)'
                }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

LiveTrackProgress.displayName = 'LiveTrackProgress';

const ARENA_BADGE_SLOT_SIZE = 34;
const ARENA_BADGE_VISIBLE_SLOTS = 4;
const ARENA_BADGE_MORE_SLOT = ARENA_BADGE_VISIBLE_SLOTS;
const ARENA_BADGE_LEFT_PAD = 0;
const ARENA_BADGE_MORE_LEFT = ARENA_BADGE_LEFT_PAD + ARENA_BADGE_MORE_SLOT * ARENA_BADGE_SLOT_SIZE;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const ArenaRankingBubble = ({
  user,
  index,
  total,
  selectedUserId,
  shouldReduceMotion,
  dragX,
  isHiddenInitial,
}: {
  user: { id: string; name: string; plays: number; avatar: string };
  index: number;
  total: number;
  selectedUserId: string;
  shouldReduceMotion: boolean | null;
  dragX: any;
  isHiddenInitial: boolean;
}) => {
  const isSelected = user.id === selectedUserId;
  const x = useTransform(dragX, value => {
    const position = index * ARENA_BADGE_SLOT_SIZE + Number(value);
    const visiblePosition = Math.max(0, Math.min(ARENA_BADGE_MORE_SLOT * ARENA_BADGE_SLOT_SIZE, position));
    return ARENA_BADGE_LEFT_PAD + visiblePosition;
  });
  const scale = useTransform(dragX, value => {
    const position = index * ARENA_BADGE_SLOT_SIZE + Number(value);
    const baseScale = 1;

    if (position < 0) return baseScale * clamp01((position + ARENA_BADGE_SLOT_SIZE) / ARENA_BADGE_SLOT_SIZE);
    if (isHiddenInitial) return baseScale * clamp01((ARENA_BADGE_MORE_SLOT * ARENA_BADGE_SLOT_SIZE - position) / ARENA_BADGE_SLOT_SIZE);

    return baseScale;
  });
  const opacity = useTransform(dragX, value => {
    const position = index * ARENA_BADGE_SLOT_SIZE + Number(value);

    if (position <= -ARENA_BADGE_SLOT_SIZE) return 0;
    if (isHiddenInitial && position >= ARENA_BADGE_MORE_SLOT * ARENA_BADGE_SLOT_SIZE) return 0;

    return 1;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : {
        opacity: 1,
        y: 0,
      }}
      transition={shouldReduceMotion ? { delay: index * 0.03 } : {
        opacity: { delay: index * 0.025, duration: 0.18 },
        y: { type: 'spring', stiffness: 420, damping: 30, delay: index * 0.025 },
      }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.16 } }}
      className={cn(
        "pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 shrink-0 transform-gpu group/avatar",
        isSelected ? "z-20" : ""
      )}
      style={{
        zIndex: total + 2 - index,
        x: shouldReduceMotion ? ARENA_BADGE_LEFT_PAD + index * ARENA_BADGE_SLOT_SIZE : x,
        scale: shouldReduceMotion ? (isHiddenInitial ? 0 : 1) : scale,
        opacity: shouldReduceMotion ? (isHiddenInitial ? 0 : 1) : opacity,
      }}
    >
      <div className="relative h-11 w-11 overflow-visible rounded-full drop-shadow-[0_14px_20px_rgba(0,0,0,0.42)] sm:h-12 sm:w-12">
        {isSelected && (
          <div className="pointer-events-none absolute inset-[-2px] rounded-full bg-[#ff5f00]/36 blur-[6px]" />
        )}
        <div className="relative h-full w-full overflow-hidden rounded-full">
          <SmartImage src={user.avatar} className="h-full w-full object-cover" fallback="" rounded="full" />
        </div>
      </div>

      <div
        className={cn(
          "absolute -bottom-1.5 -right-1.5 z-30 flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[8px] font-black leading-none text-white drop-shadow-[0_8px_10px_rgba(0,0,0,0.42)] sm:h-5 sm:min-w-[23px] sm:text-[8.5px]",
          isSelected ? "bg-[#ff6a00] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_16px_rgba(255,106,0,0.26)]" : "glass-aura border-0"
        )}
      >
        {coreUtils.formatNumber(user.plays)}
      </div>
    </motion.div>
  );
};

export const LeoHeader = memo(({ user, streamsToday, onTrackClick, onAvatarClick, isHighlighted }: { user: UserStats, streamsToday: number, onTrackClick?: (track: any) => void, onAvatarClick?: (e: React.MouseEvent<HTMLElement>) => void, isHighlighted?: boolean }) => {
  if (!user) return null;
  const shouldReduceMotion = useReducedMotion();
  const arenaTrailX = useMotionValue(0);
  const arenaMoreOpacity = useTransform(arenaTrailX, value => {
    const slotProgress = ((Math.abs(Number(value)) % ARENA_BADGE_SLOT_SIZE) / ARENA_BADGE_SLOT_SIZE);
    return 1 - slotProgress;
  });
  const arenaMoreScale = useTransform(arenaTrailX, value => {
    const slotProgress = ((Math.abs(Number(value)) % ARENA_BADGE_SLOT_SIZE) / ARENA_BADGE_SLOT_SIZE);
    return 1 - slotProgress;
  });
  const arenaLeftMoreOpacity = useTransform(arenaTrailX, value => {
    const offset = Math.abs(Number(value));
    if (offset <= 0.5) return 0;
    const remainder = offset % ARENA_BADGE_SLOT_SIZE;
    return remainder <= 0.5 ? 1 : remainder / ARENA_BADGE_SLOT_SIZE;
  });
  const arenaLeftMoreScale = useTransform(arenaTrailX, value => {
    const offset = Math.abs(Number(value));
    const remainder = offset % ARENA_BADGE_SLOT_SIZE;
    const slotProgress = offset <= 0.5 ? 0 : remainder <= 0.5 ? 1 : remainder / ARENA_BADGE_SLOT_SIZE;
    return 0.72 + slotProgress * 0.28;
  });
  const [arenaShiftedSlots, setArenaShiftedSlots] = useState(0);
  const arenaShiftedSlotsRef = useRef(0);

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
  const liveNowPlayingByUserId = useStatsStore(s => s.liveNowPlayingByUserId);
  const storeUser = useMemo(
    () => getCanonicalMembers(groupStatsForUser).find(u => u.id === user.id),
    [groupStatsForUser, user.id]
  );
  const activeUser = attachLiveNowPlayingToMember(storeUser || user, liveNowPlayingByUserId);
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
  const [hasLyricsBadge, setHasLyricsBadge] = useState(false);
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

  useEffect(() => {
    if (!track?.name || !mainArtistName) {
      setHasLyricsBadge(false);
      return;
    }

    let cancelled = false;
    statsService.fetchLyricsMatch(track.name, mainArtistName)
      .then((match) => {
        if (!cancelled) setHasLyricsBadge(match.hasLyrics === true);
      })
      .catch(() => {
        if (!cancelled) setHasLyricsBadge(false);
      });

    return () => {
      cancelled = true;
    };
  }, [track?.name, mainArtistName]);

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

  const providedDominantColor = normalizePlaybackAccent(typeof nowPlaying?.dominantColor === 'string' ? nowPlaying.dominantColor : null);
  const [dominantColor, setDominantColor] = useState<string | null>(providedDominantColor);

  useEffect(() => {
    if (providedDominantColor) {
      setDominantColor(providedDominantColor);
      return;
    }

	    if (!albumImage) return;

    let isMounted = true;
	    getDominantColor(albumImage).then(color => {
	      if (isMounted) setDominantColor(normalizePlaybackAccent(color));
	    }).catch(() => {
	      // Keep the previous resolved color instead of flashing the generic fallback.
	    });

    return () => {
       isMounted = false;
    };
  }, [albumImage, providedDominantColor]);

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
    arenaTrailX.set(0);
  }, [track?.id, arenaTrailX]);

  const allTrackArenaUsers = useMemo(() => {
    if (!track?.id) return [];
    const users = getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId)
      .map(u => ({
        id: u.id,
        name: u.name,
        plays: userTrackStats[`${u.id}:${track?.id}`] || 0,
        avatar: coreUtils.getUserAvatar(u.id, u.avatar)
      }))
      .sort((a, b) => b.plays - a.plays);
    return users.filter(u => u.plays > 0 || u.id === user.id).sort((a, b) => {
      if (b.plays !== a.plays) return b.plays - a.plays;
      if (a.id === user.id) return 1;
      if (b.id === user.id) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [groupStats, userTrackStats, track?.id, hiddenUsers, user.id, liveNowPlayingByUserId]);

  const trackArenaUsers = allTrackArenaUsers;
  const arenaPageSize = 4;
  const visibleArenaUsers = trackArenaUsers.slice(0, arenaPageSize);
  const trailingArenaUsers = trackArenaUsers.slice(arenaPageSize);
  const hiddenArenaCount = trailingArenaUsers.length;
  const selectedArenaIndex = allTrackArenaUsers.findIndex(u => u.id === user.id);
  const arenaDragDistance = Math.max(0, hiddenArenaCount * ARENA_BADGE_SLOT_SIZE);
  const arenaRenderableUsers = trackArenaUsers.slice(0, arenaPageSize + hiddenArenaCount);
  const leftHiddenArenaCount = Math.min(arenaShiftedSlots, Math.max(0, trackArenaUsers.length - arenaPageSize));
  const rightHiddenArenaCount = Math.max(0, hiddenArenaCount - arenaShiftedSlots);
  const selectedHiddenOnLeft = selectedArenaIndex >= 0 && selectedArenaIndex < arenaShiftedSlots;
  const selectedHiddenOnRight = selectedArenaIndex >= arenaPageSize + arenaShiftedSlots;
  const arenaVisibleSlots = Math.min(arenaPageSize, trackArenaUsers.length);
  const arenaSummaryWidth = hiddenArenaCount > 0
    ? ARENA_BADGE_MORE_LEFT + 42
    : Math.max(44, (arenaVisibleSlots - 1) * ARENA_BADGE_SLOT_SIZE + 44);

  useEffect(() => {
    arenaTrailX.set(0);
    arenaShiftedSlotsRef.current = 0;
    setArenaShiftedSlots(0);
  }, [arenaTrailX, hiddenArenaCount, track?.id]);

  useEffect(() => {
    const updateShiftedSlots = (value: number) => {
      const shiftedSlots = Math.min(hiddenArenaCount, Math.floor((Math.abs(value) + 0.5) / ARENA_BADGE_SLOT_SIZE));
      if (arenaShiftedSlotsRef.current !== shiftedSlots) {
        arenaShiftedSlotsRef.current = shiftedSlots;
        setArenaShiftedSlots(shiftedSlots);
      }
    };

    updateShiftedSlots(arenaTrailX.get());
    return arenaTrailX.on("change", updateShiftedSlots);
  }, [arenaTrailX, hiddenArenaCount]);


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

  const shouldShowAlbumTitle = !!track?.albumName;
  const liveRingDuration = useMemo(() => 2.7 + (user.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7) * 0.18, [user.id]);

  const filteredMembers = useMemo(() => {
    return getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId);
  }, [groupStats, hiddenUsers, liveNowPlayingByUserId]);

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
                  <div
                    className="glass -ml-1 flex h-6 max-w-[min(62vw,220px)] items-center gap-1 rounded-full px-2 transition-all duration-500"
                    style={{ border: 0 }}
                  >
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
                      <div className="flex flex-col gap-0.5">
                        <ScrollingTrackTitle
                          title={track.name}
                          onClick={() => onTrackClick?.({ ...track, type: 'track' })}
                        />
                        <div className="text-[22px] sm:text-[28px] font-medium text-white/68 line-clamp-1 flex items-center flex-wrap gap-x-1 pb-0.5 pointer-events-auto select-none w-[62vw] max-w-[300px] leading-[1.04]">
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
                            className="hover:underline cursor-pointer text-white/72"
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
                                    className="hover:underline cursor-pointer text-white/58"
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
                            progressAnimationKey={livePlayback.progressAnimationKey}
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
	                              className="relative flex max-w-[calc(100vw-112px)] shrink cursor-pointer items-center group/arena"
	                            >
	                              <div
	                                key={`arena-trail-${track.id || track.name || 'track'}`}
	                                data-home-horizontal-scroll="true"
	                                className="relative h-[58px] overflow-visible py-2 pr-0"
                                  style={{ width: arenaSummaryWidth }}
	                              >
	                                <motion.div
	                                  className="absolute inset-0 z-[60] cursor-grab active:cursor-grabbing"
	                                  drag={hiddenArenaCount > 0 && !shouldReduceMotion ? "x" : false}
	                                  dragConstraints={{ left: -arenaDragDistance, right: 0 }}
	                                  dragElastic={0.12}
	                                  dragMomentum={false}
	                                  initial={shouldReduceMotion ? false : { x: 0 }}
	                                  style={{ x: arenaTrailX, opacity: 0 }}
	                                >
	                                  <div className="h-full w-[240px]" />
	                                </motion.div>
	                                {leftHiddenArenaCount > 0 && (
	                                  <motion.div
	                                    key={`arena-more-left-${leftHiddenArenaCount}`}
	                                    initial={{ opacity: 0, y: 4 }}
	                                    animate={shouldReduceMotion ? { opacity: 1, y: 0 } : {
	                                      opacity: 1,
	                                      y: 0,
	                                    }}
	                                    transition={{ type: 'spring', stiffness: 460, damping: 30 }}
	                                    className={cn(
	                                      "pointer-events-none absolute left-0 top-1/2 z-[1] flex h-11 min-w-11 -translate-y-1/2 transform-gpu items-center justify-center rounded-full px-2.5 text-[10px] font-black text-white drop-shadow-[0_14px_20px_rgba(0,0,0,0.38)] sm:h-12 sm:min-w-12",
	                                      selectedHiddenOnLeft
	                                        ? "bg-[#ff6a00]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_16px_rgba(255,106,0,0.24)]"
	                                        : "glass-aura border-0"
	                                    )}
	                                    style={{
	                                      opacity: shouldReduceMotion ? undefined : arenaLeftMoreOpacity,
	                                      scale: shouldReduceMotion ? undefined : arenaLeftMoreScale,
	                                    }}
	                                  >
	                                    +{leftHiddenArenaCount}
	                                  </motion.div>
	                                )}
	                                {arenaRenderableUsers.map((u, i) => (
	                                  <ArenaRankingBubble
	                                    key={`${u.id}-arena-${i}`}
	                                    user={u}
	                                    index={i}
	                                    total={trackArenaUsers.length}
	                                    selectedUserId={user.id}
	                                    shouldReduceMotion={shouldReduceMotion}
	                                    dragX={arenaTrailX}
	                                    isHiddenInitial={i >= arenaPageSize}
	                                  />
	                                ))}
                                {rightHiddenArenaCount > 0 && (
	                                  <motion.div
	                                    key={`arena-more-${rightHiddenArenaCount}`}
	                                    initial={{ opacity: 0, y: 4 }}
	                                    animate={shouldReduceMotion ? { opacity: 1, y: 0 } : {
	                                      opacity: 1,
	                                      y: 0,
	                                    }}
	                                    transition={{ type: 'spring', stiffness: 460, damping: 30 }}
	                                    className={cn(
	                                      "pointer-events-none absolute top-1/2 z-[1] flex h-11 min-w-11 -translate-y-1/2 transform-gpu items-center justify-center rounded-full px-2.5 text-[10px] font-black text-white drop-shadow-[0_14px_20px_rgba(0,0,0,0.38)] sm:h-12 sm:min-w-12",
	                                      selectedHiddenOnRight
	                                        ? "bg-[#ff6a00]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_16px_rgba(255,106,0,0.24)]"
	                                        : "glass-aura border-0"
	                                    )}
	                                    style={{
	                                      left: ARENA_BADGE_MORE_LEFT,
	                                      opacity: shouldReduceMotion ? undefined : arenaMoreOpacity,
	                                      scale: shouldReduceMotion ? undefined : arenaMoreScale,
	                                    }}
	                                  >
	                                    +{rightHiddenArenaCount}
	                                  </motion.div>
	                                )}
	                              </div>
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
                                <div
                                  className="glass flex h-7 items-center gap-1.5 rounded-full px-3"
                                  style={{ border: 0 }}
                                >
                                  <Repeat className={cn(
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
                                    REPEATS
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          )}
                          {hasLyricsBadge && (
                            <motion.button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('stats-lc-open-track-stats', {
                                  detail: { panel: 'lyrics' }
                                }));
                              }}
                              whileTap={{ scale: 0.94 }}
                              className="glass relative z-[90] flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-orange-400 transition-colors hover:text-orange-300"
                              style={{ border: 0 }}
                              aria-label="Abrir letra"
                            >
                              <BookOpen className="h-2.5 w-2.5 text-current transition-colors duration-500" strokeWidth={2.4} />
                              <span className={cn(
                                "text-[7px] font-black uppercase tracking-[0.18em] leading-none transition-colors duration-500",
                                isActuallyLive ? "text-white/60" : "text-white/40"
                              )}>
                                Letra
                              </span>
                            </motion.button>
                          )}
                        </div>
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
