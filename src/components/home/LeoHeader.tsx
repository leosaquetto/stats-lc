/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useMemo, memo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Repeat, TrendingUp, Star, BookOpen } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { formatTimeSP, isTodaySP, formatDateSP, isYesterdaySP } from '../../lib/time';
import { UserStats } from '../../types/stats';
import {
  SmartImage,
  AnimatedNumber,
  EngineBreathe,
  EngineDrift,
  EngineShimmer,
  EngineSpin,
  StatsLCLogo
} from '../shared/CommonUI';
import { VinylRecord } from './VinylRecord';
import { statsService } from '../../services/statsService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getArtworkPalette, withAlpha, getPerceivedBrightness, normalizeColor, adjustBrightness, getSaturation, type ArtworkPalette } from '../../lib/colorUtils';
import { getMainArtist, getMainArtistName, getSecondaryArtists } from '../../lib/artistUtils';
import { attachLiveNowPlayingToMember, getCanonicalMembers, getVisibleMembersWithLive } from '../../lib/memberSelectors';
import { parseTrackTitleBadges } from '../../lib/trackTitleBadges';
import { useMotionRuntime } from '../../hooks/useMotionRuntime';
import { useViewportMotionGate } from '../../hooks/useViewportMotionGate';
import { useCompositorLoopTelemetry } from '../../hooks/useCompositorLoopTelemetry';
import { motionRuntime } from '../../lib/motionRuntime';
import { readRuntimeCacheEntry, setRuntimeCacheEntry } from '../../lib/memoryRuntime';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ScrollingTrackTitle = React.memo(({
  title,
  isPlaying,
  onClick
}: {
  title: string;
  isPlaying: boolean;
  onClick?: () => void;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [hasMeasured, setHasMeasured] = useState(false);
  const shouldScroll = hasMeasured && scrollDistance > 0 && !shouldReduceMotion;
  const {
    ref: marqueeMotionRef,
    shouldRunAmbientMotion,
  } = useViewportMotionGate<HTMLSpanElement>({ rootMargin: '120px' });
  const shouldRunMarquee = shouldScroll && shouldRunAmbientMotion;
  useCompositorLoopTelemetry(shouldRunMarquee, 'marquee');

  useLayoutEffect(() => {
    setHasMeasured(false);
    const measure = () => {
      const container = containerRef.current;
      const text = measureRef.current;
      if (!container || !text) return;
      const overflow = text.scrollWidth - container.clientWidth;
      setScrollDistance(overflow > 2 ? text.scrollWidth + 32 : 0);
      setHasMeasured(true);
    };

    const frame = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [isPlaying, title]);

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={onClick}
      className={cn(
        "relative z-[70] block w-[min(58vw,220px)] max-w-full overflow-hidden pb-px text-left pointer-events-auto cursor-pointer hover:underline sm:w-[320px]",
        shouldScroll && "[mask-image:linear-gradient(90deg,black_0%,black_86%,transparent_100%)]"
      )}
      title={title}
    >
      {shouldScroll ? (
        <span
          ref={marqueeMotionRef}
          className="stats-lc-engine-loop stats-lc-track-marquee flex w-max whitespace-nowrap text-[20.66px] font-sans font-semibold text-white leading-[1.14] tracking-[-0.01em]"
          data-active={shouldRunMarquee ? 'true' : 'false'}
          style={{
            '--track-title-distance': `${scrollDistance}px`,
            '--track-title-duration': `${Math.min(18, Math.max(8, title.length * 0.34))}s`,
          } as React.CSSProperties}
        >
          <span className="pr-8">{title}</span>
          <span className="pr-8" aria-hidden="true">{title}</span>
        </span>
      ) : (
        <span className="block whitespace-nowrap text-[20.66px] font-sans font-semibold text-white leading-[1.14] tracking-[-0.01em]">
          {title}
        </span>
      )}
      <span
        ref={measureRef}
        className="pointer-events-none absolute -z-10 whitespace-nowrap text-[20.66px] font-sans font-semibold leading-[1.14] tracking-[-0.01em] opacity-0"
        aria-hidden="true"
      >
        {title}
      </span>
    </button>
  );
});

const TrackTitleBadges = React.memo(({ badges }: { badges: string[] }) => {
  if (badges.length === 0) return null;
  const hasMultipleBadges = badges.length > 1;

  return (
    <div
      className={cn(
        "relative z-[75] flex max-w-[148px] shrink-0 flex-col items-start justify-start self-start sm:max-w-[170px]",
        hasMultipleBadges ? "-mt-0.5 gap-px" : "mt-[1px] gap-[2px]"
      )}
    >
      {badges.map((badge) => (
        <span
          key={badge}
          className={cn(
            "max-w-full truncate rounded-full text-left font-black uppercase leading-none text-white/74 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-md",
            hasMultipleBadges
              ? "px-2 py-[1.5px] text-[5.9px] tracking-[0.1em] sm:px-2.5 sm:text-[6.4px]"
              : "px-2.5 py-[3px] text-[7px] tracking-[0.11em] sm:px-3 sm:text-[7.6px]"
          )}
          style={{ backgroundColor: 'rgba(255,255,255,0.062)' }}
        >
          {badge}
        </span>
      ))}
    </div>
  );
});

interface LiveTrackProgressProps {
  progressMs?: number;
  progressPercent?: number;
  progressTargetPercent?: number;
  progressAnimationMs?: number;
  progressAnimationKey?: string;
  durationMs?: number;
  timestamp: string | number;
  isNowPlaying: boolean;
  platform: "spotify" | "appleMusic" | "unknown";
  compact?: boolean;
  progressColor?: string | null;
  isSynchronizing?: boolean;
}

function formatTrackTime(ms: number) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const readCurrentScaleX = (element: HTMLElement, fallback: number) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const transform = window.getComputedStyle(element).transform;
    if (!transform || transform === 'none') return fallback;
    const matrix = new DOMMatrixReadOnly(transform);
    if (Number.isFinite(matrix.a)) return Math.min(1, Math.max(0, matrix.a));
  } catch {}
  return fallback;
};

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
    let cancelTask: (() => void) | null = null;
    let cancelled = false;

    const renderTime = () => {
      const nextMs = isRunning ? base + (performance.now() - startedAt) : base;
      if (labelRef.current) {
        labelRef.current.textContent = formatTrackTime(Math.min(nextMs, max));
      }
    };

    const scheduleNext = () => {
      cancelTask?.();
      if (cancelled || !isRunning) return;
      cancelTask = motionRuntime.scheduleTask(() => {
        renderTime();
        scheduleNext();
      }, 1000, 'interaction', 'leo-header-elapsed-clock');
    };

    renderTime();

    if (!isRunning) return;

    scheduleNext();

    const handleVisibilityChange = () => {
      renderTime();
      if (document.visibilityState === 'visible') scheduleNext();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      cancelTask?.();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [baseMs, durationMs, isRunning]);

  return (
    <span ref={labelRef} className={className}>
      {formatTrackTime(baseMs)}
    </span>
  );
});

LiveElapsedTime.displayName = 'LiveElapsedTime';

const COMPLETE_MARGIN_MS = 35_000;
const DRIFT_REANCHOR_MS = 5000;
const HIDDEN_FALLBACK_DURATION_MS = 3 * 60 * 1000;
const COMPLETION_RECHECK_INTERVAL_MS = 9000;
const MAX_COMPLETION_RECHECKS = 10;
const PROGRESS_CATCHUP_MIN_MS = 1400;
const PROGRESS_CATCHUP_MAX_MS = 5200;

function normalizePlaybackAccent(color: string | null) {
  if (!color) return null;
  return normalizeColor(color, '#647062');
}

function getTonalProgressAccent(color: string | null) {
  if (!color) return null;
  const normalized = normalizeColor(color, '#8b947e');
  const brightness = getPerceivedBrightness(normalized);

  if (brightness < 84) return adjustBrightness(normalized, 0.24);
  if (brightness < 132) return adjustBrightness(normalized, 0.12);
  if (brightness > 226) return adjustBrightness(normalized, -0.14);
  return normalized;
}

function createFallbackArtworkPalette(color: string | null): ArtworkPalette | null {
  const vinylColor = normalizePlaybackAccent(color);
  const progressColor = getTonalProgressAccent(vinylColor);
  if (!vinylColor || !progressColor) return null;

  return {
    vinylColor,
    progressColor,
    candidates: []
  };
}

function getVisibleProgressAccent(color: string | null | undefined) {
  if (!color) return null;
  const normalized = normalizeColor(color, '#8b947e');
  const brightness = getPerceivedBrightness(normalized);

  if (brightness < 86) {
    return adjustBrightness(normalized, Math.min(0.26, ((96 - brightness) / 255) * 1.05));
  }

  if (brightness > 228) {
    return adjustBrightness(normalized, -0.12);
  }

  return normalized;
}

function mixHexColors(baseColor: string, overlayColor: string, overlayWeight: number) {
  const safeWeight = Math.max(0, Math.min(1, overlayWeight));
  const parse = (value: string) => {
    const hex = normalizeColor(value).replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  };
  const base = parse(baseColor);
  const overlay = parse(overlayColor);
  const channel = (from: number, to: number) => Math.round(from * (1 - safeWeight) + to * safeWeight);

  return normalizeColor([channel(base.r, overlay.r), channel(base.g, overlay.g), channel(base.b, overlay.b)]);
}

function getAssertiveProgressAccent(color: string | null) {
  if (!color) return null;
  const normalized = normalizeColor(color, '#ff5f00');
  const saturation = getSaturation(normalized);
  const brightness = getPerceivedBrightness(normalized);

  if (saturation < 0.16) {
    return brightness < 128
      ? adjustBrightness(normalized, 0.28)
      : adjustBrightness(normalized, -0.08);
  }

  if (saturation < 0.22) {
    return brightness < 150
      ? adjustBrightness(normalized, 0.18)
      : normalized;
  }

  if (brightness > 196) {
    return adjustBrightness(normalized, -0.12);
  }

  return normalized;
}

function getColorDistance(left: string, right: string) {
  const parse = (value: string) => {
    const hex = normalizeColor(value).replace('#', '');
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16)
    ];
  };
  const [lr, lg, lb] = parse(left);
  const [rr, rg, rb] = parse(right);
  return Math.sqrt((lr - rr) ** 2 + (lg - rg) ** 2 + (lb - rb) ** 2);
}

function getDistinctAmbientColors(palette: ArtworkPalette | null, fallbackColor: string | null) {
  const base = normalizeColor(palette?.vinylColor || fallbackColor, '#ff5f00');
  const candidates = (palette?.candidates || [])
    .filter(candidate => candidate.saturation >= 0.16 && candidate.brightness >= 38 && candidate.brightness <= 224)
    .map(candidate => normalizeColor(candidate.hex));
  const selected = [base];

  for (const minimumDistance of [96, 72, 48]) {
    for (const candidate of candidates) {
      if (selected.length >= 3) break;
      if (selected.every(color => getColorDistance(color, candidate) >= minimumDistance)) {
        selected.push(candidate);
      }
    }
  }

  const fallbackCandidates = [
    palette?.progressColor,
    adjustBrightness(base, 0.34),
    mixHexColors(base, '#ff5f00', 0.42),
    adjustBrightness(base, -0.32)
  ].filter((color): color is string => Boolean(color));

  for (const candidate of fallbackCandidates) {
    if (selected.length >= 3) break;
    const normalized = normalizeColor(candidate);
    if (selected.every(color => getColorDistance(color, normalized) >= 34)) {
      selected.push(normalized);
    }
  }

  while (selected.length < 3) {
    selected.push(adjustBrightness(base, selected.length === 1 ? 0.28 : -0.28));
  }

  return selected as [string, string, string];
}

type PlaybackSnapshot = {
  playbackKey: string;
  trackId: string;
  startedAt: number | null;
  baseProgressMs: number;
  durationMs: number | null;
  receivedAt: number;
  catchup?: {
    startedAt: number;
    fromMs: number;
    toMs: number;
    durationMs: number;
  };
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

const getTrackExternalIds = (track: any) => {
  const spotify = [
    track?.spotifyId,
    ...(Array.isArray(track?.externalIds?.spotify) ? track.externalIds.spotify : []),
  ].filter(Boolean).map(String);
  const appleMusic = [
    track?.appleMusicId,
    ...(Array.isArray(track?.externalIds?.appleMusic) ? track.externalIds.appleMusic : []),
  ].filter(Boolean).map(String);

  return { spotify, appleMusic };
};

const normalizeTrackTitleKey = (value: string | undefined) => (
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase() || ''
);

const getTrackVisualIdentity = (userId: string, track: any, artistName: string) => {
  const trackId = track?.id == null ? '' : String(track.id).trim();
  if (trackId) return `${userId}:track:${trackId}`;

  const externalIds = getTrackExternalIds(track);
  const catalogId = externalIds.spotify[0] || externalIds.appleMusic[0] || '';
  if (catalogId) return `${userId}:catalog:${catalogId}`;

  const title = normalizeTrackTitleKey(track?.name);
  const artist = normalizeTrackTitleKey(artistName);
  return `${userId}:semantic:${title}:${artist}`;
};

const isSameResolvedTrack = (liveTrack: any, recentTrack: any) => {
  if (!liveTrack || !recentTrack) return false;
  if (liveTrack.id != null && recentTrack.id != null && String(liveTrack.id) === String(recentTrack.id)) return true;

  const liveIds = getTrackExternalIds(liveTrack);
  const recentIds = getTrackExternalIds(recentTrack);
  if (liveIds.spotify.some((id) => recentIds.spotify.includes(id))) return true;
  if (liveIds.appleMusic.some((id) => recentIds.appleMusic.includes(id))) return true;

  const liveName = normalizeTrackTitleKey(liveTrack.name);
  const recentName = normalizeTrackTitleKey(recentTrack.name);
  const liveDuration = Number(liveTrack.durationMs || 0);
  const recentDuration = Number(recentTrack.durationMs || 0);

  return !!liveName && liveName === recentName && (!liveDuration || !recentDuration || Math.abs(liveDuration - recentDuration) <= 2500);
};

const mergeResolvedTrackMetadata = (liveTrack: any, resolvedTrack: any) => {
  if (!liveTrack || !resolvedTrack) return liveTrack;
  return {
    ...liveTrack,
    ...resolvedTrack,
    id: liveTrack.id ?? resolvedTrack.id,
    name: liveTrack.name || resolvedTrack.name,
    durationMs: liveTrack.durationMs || resolvedTrack.durationMs,
    playedCount: liveTrack.playedCount ?? resolvedTrack.playedCount,
  };
};

function calculateSnapshotProgress(snapshot: PlaybackSnapshot | null, now = Date.now()) {
  if (!snapshot) return 0;
  const catchup = snapshot.catchup;
  if (catchup) {
    const elapsed = Math.max(0, now - catchup.startedAt);
    const catchupDuration = Math.max(1, catchup.durationMs);
    const driftMs = catchup.toMs - catchup.fromMs;
    const speed = 1 + (driftMs / catchupDuration);
    if (elapsed < catchupDuration) {
      return Math.max(0, catchup.fromMs + elapsed * speed);
    }
    return Math.max(0, catchup.toMs + elapsed);
  }
  return Math.max(0, snapshot.baseProgressMs + (now - snapshot.receivedAt));
}

function getSnapshotProgressTarget(snapshot: PlaybackSnapshot | null, now = Date.now()) {
  if (!snapshot?.catchup) return null;
  const { catchup } = snapshot;
  const elapsed = Math.max(0, now - catchup.startedAt);
  if (elapsed >= catchup.durationMs) return null;
  const remainingMs = Math.max(0, catchup.durationMs - elapsed);
  return {
    targetMs: catchup.toMs + catchup.durationMs,
    remainingMs,
    key: `${catchup.startedAt}:${catchup.toMs}`,
  };
}

function useLivePlaybackProgress({
  userId,
  nowPlaying,
  durationMs,
  fetchLiveProbe,
}: {
  userId: string;
  nowPlaying: any;
  durationMs?: number | null;
  fetchLiveProbe: (userId: string) => Promise<boolean>;
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
      const driftMs = inferredProgressMs - projectedProgressMs;
      if (Math.abs(driftMs) >= DRIFT_REANCHOR_MS) {
        const catchupDurationMs = Math.min(
          PROGRESS_CATCHUP_MAX_MS,
          Math.max(PROGRESS_CATCHUP_MIN_MS, Math.abs(driftMs) * 0.36),
        );
        snapshotRef.current = {
          ...snapshotRef.current,
          baseProgressMs: projectedProgressMs,
          receivedAt: now,
          catchup: {
            startedAt: now,
            fromMs: projectedProgressMs,
            toMs: inferredProgressMs,
            durationMs: catchupDurationMs,
          },
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
  const progressTarget = getSnapshotProgressTarget(snapshotRef.current);
  const cappedProgressTargetMs = normalizedDurationMs && progressTarget
    ? Math.min(progressTarget.targetMs, normalizedDurationMs)
    : null;
  const progressTargetPercent = normalizedDurationMs && cappedProgressTargetMs != null
    ? Math.min((cappedProgressTargetMs / normalizedDurationMs) * 100, 100)
    : undefined;
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
    const cancelCompletionCheck = motionRuntime.scheduleTask(() => {
      if (completedPlaybackKeyRef.current === snapshot.playbackKey) return;
      checkingPlaybackKeyRef.current = snapshot.playbackKey;
      setIsCheckingNext(true);

      fetchLiveProbe(userId)
        .catch(() => undefined)
        .finally(() => {
          if (checkingPlaybackKeyRef.current === snapshot.playbackKey) {
            checkingPlaybackKeyRef.current = null;
            if (snapshotRef.current?.playbackKey === snapshot.playbackKey) {
              const nextAttempts = (completionCheckAttemptsRef.current[snapshot.playbackKey] || 0) + 1;
              completionCheckAttemptsRef.current[snapshot.playbackKey] = nextAttempts;
              if (nextAttempts >= MAX_COMPLETION_RECHECKS) {
                completedPlaybackKeyRef.current = snapshot.playbackKey;
                setIsCheckingNext(false);
                setIsFinished(true);
              } else {
                setSnapshotVersion(version => version + 1);
              }
            }
          }
        });
    }, delay, 'interaction', 'leo-header-completion-check');

    return () => cancelCompletionCheck();
  }, [isNow, completionDurationMs, fetchLiveProbe, snapshotVersion, userId]);

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

  const catchupKey = progressTarget?.key || '';
  useEffect(() => {
    if (!progressTarget || !catchupKey) return;
    return motionRuntime.scheduleTask(
      () => setSnapshotVersion(version => version + 1),
      progressTarget.remainingMs,
      'interaction',
      'leo-header-progress-catchup-end',
    );
  }, [catchupKey, progressTarget?.remainingMs]);

  const progressAnimationMs = normalizedDurationMs
    ? progressTarget
      ? progressTarget.remainingMs
      : Math.max(0, normalizedDurationMs - cappedProgressMs)
    : 0;

  return {
    progressMs: cappedProgressMs,
    progressPercent,
    progressTargetPercent,
    progressAnimationMs,
    progressAnimationKey: `${snapshotRef.current?.playbackKey || 'idle'}:${snapshotVersion}:${catchupKey || 'steady'}`,
    isFinished,
    isCheckingNext,
    shouldSpinVinyl: isNow && !isFinished,
  };
}

export const LiveTrackProgress = memo(({
  progressMs,
  progressPercent,
  progressTargetPercent,
  progressAnimationMs,
  progressAnimationKey,
  durationMs,
  timestamp,
  isNowPlaying,
  platform,
  compact = false,
  progressColor,
  isSynchronizing = false
}: LiveTrackProgressProps) => {
  const [minPlayTime, setMinPlayTime] = useState(false);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const progressFillAnimationRef = useRef<Animation | null>(null);
  const motionRuntime = useMotionRuntime();
  const shouldRunAmbientMotion = motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve';
  const shouldRunSyncCompositorLoop = isSynchronizing && shouldRunAmbientMotion;
  useCompositorLoopTelemetry(shouldRunSyncCompositorLoop, 'leo-progress-sync');
  const visibleProgressColor = useMemo(() => getVisibleProgressAccent(progressColor), [progressColor]);
  const assertiveProgressColor = useMemo(() => getAssertiveProgressAccent(visibleProgressColor), [visibleProgressColor]);
  const progressFillGradient = useMemo(() => {
    if (!assertiveProgressColor) return 'linear-gradient(90deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.78) 100%)';
    const brightness = getPerceivedBrightness(assertiveProgressColor);
    const headColor = brightness < 150
      ? adjustBrightness(assertiveProgressColor, 0.16)
      : assertiveProgressColor;
    const tailColor = brightness < 150
      ? adjustBrightness(assertiveProgressColor, 0.3)
      : adjustBrightness(assertiveProgressColor, 0.08);
    return `linear-gradient(90deg, ${headColor} 0%, ${tailColor} 100%)`;
  }, [assertiveProgressColor]);

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

  const AppleMusicLogo = ({ className = '' }: { className?: string }) => (
    <svg
      viewBox="0 0 17 21"
      className={cn("h-[2.52em] min-w-[1.66em] w-auto object-contain fill-current -translate-y-[0.5px]", className)}
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
      className="h-[0.68em] w-[0.68em] object-contain grayscale brightness-[1.9] opacity-75"
      alt="Spotify"
      referrerPolicy="no-referrer"
    />
  );
  const PlatformLogo = platform === 'spotify' ? <SpotifyIcon /> : <AppleMusicLogo />;
  const IdlePlatformLogo = platform === 'spotify'
    ? <SpotifyIcon />
    : <AppleMusicLogo className="h-[12px] min-w-[9px] -translate-y-[0.25px]" />;
  const PlatformName = platform === 'spotify' ? 'SPOTIFY' : platform === 'appleMusic' ? 'APPLE MUSIC' : 'MUSIC';

  useEffect(() => {
    setMinPlayTime(false);
  }, [timestamp, durationMs, isNowPlaying]);

  const currentProgress = isNowPlaying ? (progressPercent ?? 0) : 100;
  const progressScale = Math.min(1, Math.max(0, currentProgress / 100));
  const progressTargetScale = Math.min(1, Math.max(0, (progressTargetPercent ?? (isNowPlaying ? 100 : currentProgress)) / 100));
  const elapsedMs = useMemo(() => progressMs ?? ((currentProgress / 100) * (durationMs || 0)), [currentProgress, durationMs, progressMs]);
  const syncAccent = assertiveProgressColor || visibleProgressColor || 'rgba(255,255,255,0.72)';
  const syncShimmerGradient = useMemo(() => {
    const accent = assertiveProgressColor || visibleProgressColor;
    return accent
      ? `linear-gradient(90deg, transparent, ${withAlpha(accent, 0.42)}, ${withAlpha(adjustBrightness(accent, 0.18), 0.62)}, transparent)`
      : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.24), rgba(255,255,255,0.46), transparent)';
  }, [assertiveProgressColor, visibleProgressColor]);

  const dateObj = new Date(timestamp);
  const timeStr = formatTimeSP(dateObj, 'dots');
  const timeLabel = isTodaySP(dateObj)
    ? `ÀS ${timeStr}`
    : isYesterdaySP(dateObj)
      ? `ONTEM ÀS ${timeStr}`
      : `${formatDateSP(dateObj)} ÀS ${timeStr}`;

  useLayoutEffect(() => {
    const fill = progressFillRef.current;
    if (!fill) return;

    const visualStartScale = readCurrentScaleX(fill, progressScale);
    progressFillAnimationRef.current?.cancel();
    progressFillAnimationRef.current = null;

    const startScale = isSynchronizing ? progressScale : visualStartScale;
    const targetScale = isSynchronizing
      ? 1
      : isNowPlaying
        ? progressTargetScale
        : progressScale;

    fill.style.opacity = '1';
    fill.style.transform = `scaleX(${startScale})`;

    if (isSynchronizing) {
      const intro = fill.animate(
        [
          { transform: `scaleX(${startScale}) scaleY(1)`, opacity: 1 },
          { transform: 'scaleX(1) scaleY(1)', opacity: 0.92 },
        ],
        {
          duration: 360,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards',
        },
      );
      progressFillAnimationRef.current = intro;
      intro.onfinish = () => {
        if (progressFillAnimationRef.current !== intro) return;
        fill.style.transform = 'scaleX(1) scaleY(1)';
        fill.style.opacity = '0.92';
        intro.cancel();
        if (!shouldRunAmbientMotion) {
          progressFillAnimationRef.current = null;
          return;
        }
        const pulse = fill.animate(
          [
            { transform: 'scaleX(1) scaleY(0.88)', opacity: 0.72 },
            { transform: 'scaleX(1) scaleY(1.08)', opacity: 1 },
            { transform: 'scaleX(1) scaleY(0.9)', opacity: 0.78 },
          ],
          {
            duration: 1450,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            iterations: Infinity,
          },
        );
        progressFillAnimationRef.current = pulse;
      };
      return () => {
        progressFillAnimationRef.current?.cancel();
        progressFillAnimationRef.current = null;
      };
    }

    const duration = isNowPlaying && !isSynchronizing && progressAnimationMs && progressAnimationMs > 0
      ? Math.max(200, progressAnimationMs)
      : 0;
    if (duration <= 0 || Math.abs(targetScale - startScale) <= 0.0001) {
      fill.style.transform = `scaleX(${targetScale})`;
      return;
    }

    const animation = fill.animate(
      [
        { transform: `scaleX(${startScale})` },
        { transform: `scaleX(${targetScale})` },
      ],
      {
        duration,
        easing: 'linear',
        fill: 'forwards',
      },
    );
    progressFillAnimationRef.current = animation;
    animation.onfinish = () => {
      if (progressFillAnimationRef.current !== animation) return;
      fill.style.transform = `scaleX(${targetScale})`;
      animation.cancel();
      progressFillAnimationRef.current = null;
    };

    return () => {
      if (progressFillAnimationRef.current === animation) {
        animation.cancel();
        progressFillAnimationRef.current = null;
      }
    };
  }, [
    isNowPlaying,
    isSynchronizing,
    progressAnimationKey,
    progressAnimationMs,
    progressScale,
    progressTargetScale,
    shouldRunAmbientMotion,
  ]);

  return (
    <AnimatePresence mode="sync">
      {(!isNowPlaying || (isNowPlaying && !durationMs && !minPlayTime)) ? (
        !isNowPlaying ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }} animate={{ opacity: 0.58 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-1.5 w-full"
          >
            <div className="mb-1 flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
              <span className="stats-lc-dense-label shrink-0 text-[7px] font-black text-white/35 uppercase">OUVIU NO</span>
              <div className="flex shrink-0 items-center justify-center gap-1 overflow-visible">
                <div className="text-white/35 flex items-center overflow-visible">
                  {IdlePlatformLogo}
                </div>
                <span className="stats-lc-dense-label shrink-0 text-[7px] font-black text-white/35 uppercase">{PlatformName}</span>
              </div>
              <span className="text-[7px] font-black text-white/18" aria-hidden="true">•</span>
              <span className="stats-lc-dense-label max-w-[140px] text-[7px] font-black text-white/35 uppercase">{timeLabel}</span>
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
              <div className="mx-auto flex min-w-0 max-w-[min(138px,42vw)] items-center justify-center gap-0.5 overflow-visible">
                <span className="stats-lc-dense-label shrink-0 text-[5.8px] font-black text-white/35 uppercase">OUVINDO NO</span>
                <div className="text-white/35 flex items-center overflow-visible scale-[0.88]">
                  {PlatformLogo}
                </div>
                <span className="stats-lc-dense-label shrink-0 text-[5.8px] font-black text-white/35 uppercase">{PlatformName}</span>
              </div>
              <span className="text-[8px] font-black text-white/35 uppercase tracking-[0.08em] opacity-0">0:00</span>
            </div>
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden relative">
              <EngineShimmer
                active={shouldRunAmbientMotion}
                duration={4}
                className="h-full"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.3), transparent)' }}
              />
            </div>
          </motion.div>
        )
      ) : (
        <motion.div
          key="playing"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          data-stats-lc-leo-progress-mode={isSynchronizing ? 'sync' : 'playing'}
          data-stats-lc-leo-progress-color={assertiveProgressColor || visibleProgressColor || ''}
          data-stats-lc-leo-progress-scale={progressScale.toFixed(4)}
          data-stats-lc-leo-progress-target={progressTargetScale.toFixed(4)}
          className="flex w-full origin-left scale-[1.05] flex-col gap-1.5"
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-2 mb-0.5">
            <motion.span
              className="inline-flex items-baseline leading-none"
              animate={{ opacity: isSynchronizing ? 0 : 1, y: isSynchronizing ? -1 : 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <LiveElapsedTime
                baseMs={elapsedMs}
                durationMs={durationMs}
                isRunning={isNowPlaying && !isSynchronizing}
                className="text-[8px] font-black leading-none text-white/40 uppercase tracking-[0.08em] tabular-nums"
              />
            </motion.span>
            <div className="mx-auto flex min-w-0 max-w-[min(152px,44vw)] items-baseline justify-center overflow-hidden leading-none">
              <motion.div
                layout
                animate={shouldRunSyncCompositorLoop
                  ? { opacity: [0.72, 1, 0.78], y: [1, 0, 1], scale: [0.99, 1.015, 0.99] }
                  : { opacity: 1, y: 0, scale: 1 }}
                transition={shouldRunSyncCompositorLoop
                  ? { duration: 1.45, ease: [0.16, 1, 0.3, 1], repeat: Infinity }
                  : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "stats-lc-dense-label flex min-w-0 items-center justify-center overflow-hidden font-black uppercase",
                  isSynchronizing ? "text-[6.4px] tracking-[0.18em]" : "gap-0.5 text-[5.8px]"
                )}
                style={{ color: isSynchronizing ? syncAccent : undefined }}
              >
                {isSynchronizing ? (
                  'SINCRONIZANDO'
                ) : (
                  <>
                    <span className="stats-lc-dense-label shrink-0 text-[5.8px] font-black leading-none text-white/40 uppercase">OUVINDO NO</span>
                    <div className="text-white/40 flex items-center overflow-visible scale-[0.88]">
                      {PlatformLogo}
                    </div>
                    <span className="stats-lc-dense-label shrink-0 text-[5.8px] font-black leading-none text-white/40 uppercase">{PlatformName}</span>
                  </>
                )}
              </motion.div>
            </div>
            <motion.span
              className="inline-flex items-baseline text-[8px] font-black leading-none text-white/40 uppercase tracking-[0.08em] tabular-nums"
              animate={{ opacity: isSynchronizing ? 0 : 1, y: isSynchronizing ? -1 : 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {formatTrackTime(durationMs)}
            </motion.span>
          </div>
          <div className="w-full h-[5px] rounded-full bg-white/[0.16] overflow-visible relative">
            <div
              ref={progressFillRef}
              className="h-full w-full rounded-full relative overflow-hidden"
              data-stats-lc-leo-progress-key={progressAnimationKey}
              style={{
                transformOrigin: 'left center',
                background: progressFillGradient,
                filter: 'brightness(1.16) saturate(1.24) contrast(1.04)',
                boxShadow: assertiveProgressColor
                  ? `0 0 9px ${withAlpha(assertiveProgressColor, 0.66)}, 0 0 20px ${withAlpha(assertiveProgressColor, 0.3)}`
                  : '0 0 9px rgba(255,255,255,0.26), 0 0 18px rgba(255,255,255,0.14)'
              }}
            >
              {isSynchronizing && (
                <EngineShimmer
                  active={shouldRunAmbientMotion}
                  duration={2.4}
                  className="h-full"
                  style={{ background: syncShimmerGradient }}
                />
              )}
              <motion.div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white translate-x-1/2"
                animate={shouldRunSyncCompositorLoop
                  ? { opacity: [0.48, 1, 0.56], scale: [0.82, 1.18, 0.86] }
                  : { opacity: 1, scale: 1 }}
                transition={shouldRunSyncCompositorLoop
                  ? { duration: 1.45, ease: [0.16, 1, 0.3, 1], repeat: Infinity }
                  : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  boxShadow: assertiveProgressColor
                    ? `0 0 10px ${withAlpha(assertiveProgressColor, 0.86)}, 0 0 20px ${withAlpha(assertiveProgressColor, 0.48)}`
                    : '0 0 10px rgba(255,255,255,0.5), 0 0 18px rgba(255,255,255,0.22)',
                  filter: 'brightness(1.14)'
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

const stableHeaderAvatarByUserId = new Map<string, string>();

// Ranking badge choreography. Keep these offsets intentional:
// - slot step is 36px; visible avatar slots are 0, 36, 72, 108.
// - left +N lives behind avatars. +1 and +2 grow from just right of -36,
//   and the old +1 exits left while shrinking.
// - right +N lives behind avatars. The front +N sits at 144 and collapses
//   slightly to 153; the next +1 starts one slot farther right at 180.
// - hidden avatars grow in the fourth avatar slot at x=108 from the right edge.
// - on release, snap only to whole slots: 0, -36, -72 for the current +2 case.
const ARENA_BADGE_SLOT_SIZE = 36;
const ARENA_BADGE_VISIBLE_SLOTS = 4;
const ARENA_BADGE_LEFT_PAD = 0;
const ARENA_BADGE_LEFT_MORE_VISUAL_NUDGE = 4;
const ARENA_BADGE_LEFT_MORE_LEFT = ARENA_BADGE_LEFT_PAD - ARENA_BADGE_SLOT_SIZE + ARENA_BADGE_LEFT_MORE_VISUAL_NUDGE;
const ARENA_BADGE_LEFT_MORE_FIRST_START_LEFT = ARENA_BADGE_LEFT_PAD - ARENA_BADGE_SLOT_SIZE + ARENA_BADGE_LEFT_MORE_VISUAL_NUDGE;
const ARENA_BADGE_LEFT_MORE_START_LEFT = ARENA_BADGE_LEFT_PAD - ARENA_BADGE_SLOT_SIZE + ARENA_BADGE_LEFT_MORE_VISUAL_NUDGE;
const ARENA_BADGE_LEFT_MORE_COLLAPSE_LEFT = ARENA_BADGE_LEFT_MORE_LEFT - ARENA_BADGE_SLOT_SIZE;
const ARENA_BADGE_RIGHT_MORE_LEFT = ARENA_BADGE_LEFT_PAD + (ARENA_BADGE_VISIBLE_SLOTS * ARENA_BADGE_SLOT_SIZE);
const ARENA_BADGE_RIGHT_MORE_COLLAPSE_LEFT = ARENA_BADGE_RIGHT_MORE_LEFT + (ARENA_BADGE_SLOT_SIZE / 4);
const ARENA_BADGE_RIGHT_NEXT_LEFT = ARENA_BADGE_RIGHT_MORE_LEFT + ARENA_BADGE_SLOT_SIZE;
const ARENA_MORE_SELECTED_BACKGROUND = 'linear-gradient(135deg, rgba(255,95,0,0.24), rgba(255,255,255,0.04)), rgba(255,95,0,0.16)';
const ARENA_MORE_SELECTED_BOX_SHADOW = '0 14px 20px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(255,95,0,0.18)';
const ARENA_MORE_SELECTED_COLOR = 'rgb(255, 237, 213)';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

type ArenaDomCache = {
  trail: HTMLDivElement;
  leftMoreBack: HTMLElement | null;
  leftMore: HTMLElement | null;
  rightMoreNext: HTMLElement | null;
  rightMore: HTMLElement | null;
  bubbles: HTMLElement[];
};

const setArenaText = (element: HTMLElement, value: string) => {
  const visualElement = element.firstElementChild?.getAttribute('data-arena-more-visual') === 'true'
    ? element.firstElementChild as HTMLElement
    : element;
  if (visualElement.textContent !== value) visualElement.textContent = value;
};

const setArenaStyle = (
  element: HTMLElement,
  {
    background,
    boxShadow,
    color,
    opacity,
    transform,
    transformOrigin,
  }: {
    background?: string | null;
    boxShadow?: string | null;
    color?: string | null;
    opacity: string;
    transform: string;
    transformOrigin?: string;
  }
) => {
  const visualElement = element.firstElementChild?.getAttribute('data-arena-more-visual') === 'true'
    ? element.firstElementChild as HTMLElement
    : element;
  if (background !== undefined && visualElement.style.background !== (background ?? '')) {
    visualElement.style.background = background ?? '';
  }
  if (boxShadow !== undefined && visualElement.style.boxShadow !== (boxShadow ?? '')) {
    visualElement.style.boxShadow = boxShadow ?? '';
  }
  if (color !== undefined && visualElement.style.color !== (color ?? '')) {
    visualElement.style.color = color ?? '';
  }
  if (element.style.opacity !== opacity) element.style.opacity = opacity;
  if (element.style.transform !== transform) element.style.transform = transform;
  if (transformOrigin !== undefined && element.style.transformOrigin !== transformOrigin) {
    element.style.transformOrigin = transformOrigin;
  }
};

const getStaticAvatarCandidate = (avatarUrl: string) => {
  if (!/\.gif(?:[?#]|$)/i.test(avatarUrl)) return avatarUrl;
  return avatarUrl.replace(/\.gif(?=([?#]|$))/i, '.webp');
};

const ArenaRankingBubble = ({
  user,
  index,
  total,
  selectedUserId,
  shouldReduceMotion,
  isHiddenInitial,
  isLive,
}: {
  user: { id: string; name: string; plays: number; avatar: string };
  index: number;
  total: number;
  selectedUserId: string;
  shouldReduceMotion: boolean | null;
  isHiddenInitial: boolean;
  isLive: boolean;
}) => {
  const isSelected = user.id === selectedUserId;
  const showFirstListenStar = isSelected && user.plays === 1;
  const baseScale = isSelected && isLive ? 1.05 : 1;
  const initialX = ARENA_BADGE_LEFT_PAD + (isHiddenInitial ? (ARENA_BADGE_VISIBLE_SLOTS - 1) * ARENA_BADGE_SLOT_SIZE : index * ARENA_BADGE_SLOT_SIZE);
  const initialScale = isHiddenInitial ? 0 : baseScale;

  return (
    <div
      data-arena-bubble="true"
      data-arena-index={index}
      data-arena-base-scale={baseScale}
      data-arena-hidden-initial={isHiddenInitial ? "true" : "false"}
      className={cn(
        "pointer-events-none absolute left-0 top-1/2 isolate shrink-0 transform-gpu group/avatar",
        isSelected ? "z-20" : ""
      )}
      style={{
        zIndex: total + 2 - index,
        opacity: isHiddenInitial ? 0 : 1,
        transform: `translate3d(${initialX}px, -50%, 0) scale(${initialScale})`,
        transformOrigin: isHiddenInitial ? 'right center' : 'center center',
        willChange: shouldReduceMotion ? undefined : 'transform, opacity',
      }}
    >
      <motion.div
        className="relative"
        initial={shouldReduceMotion || isHiddenInitial
          ? false
          : { opacity: 0, x: -initialX, y: 10, scale: 0.16, rotate: -9 }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
        exit={shouldReduceMotion || isHiddenInitial
          ? { opacity: 0 }
          : {
              opacity: 0,
              x: -initialX,
              y: -8,
              scale: 0.14,
              rotate: 8,
              transition: {
                duration: 0.28,
                delay: Math.max(0, total - index - 1) * 0.18,
                ease: [0.32, 0, 0.2, 1],
              },
            }}
        transition={{
          duration: shouldReduceMotion ? 0.01 : 0.52,
          delay: shouldReduceMotion || isHiddenInitial ? 0 : index * 0.18,
          ease: [0.34, 1.56, 0.64, 1],
          opacity: {
            duration: shouldReduceMotion ? 0.01 : 0.18,
            delay: shouldReduceMotion || isHiddenInitial ? 0 : index * 0.18,
          },
        }}
      >
        <div className="relative z-10 h-11 w-11 overflow-visible rounded-full shadow-[0_14px_20px_rgba(0,0,0,0.42)] sm:h-12 sm:w-12">
          {isSelected && (
            <div className="pointer-events-none absolute inset-[-3px] z-0 rounded-full bg-[#ff5f00]/34 blur-[2px] shadow-[0_0_16px_rgba(255,95,0,0.44)]" />
          )}
          <div className="relative z-10 h-full w-full overflow-hidden rounded-full">
            <SmartImage src={user.avatar} cacheKey={`leoheader-arena-avatar:${user.id}`} className="h-full w-full object-cover" fallback={user.name} rounded="full" />
          </div>
        </div>

        <div
          className={cn(
            "absolute -bottom-1.5 -right-1.5 z-40 flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[8px] font-black leading-none shadow-[0_6px_14px_rgba(0,0,0,0.34)] backdrop-blur-md sm:h-5 sm:min-w-[23px] sm:text-[8.5px]",
            isSelected
              ? "bg-[#ff5f00]/58 text-orange-50 shadow-[0_0_14px_rgba(255,95,0,0.34),0_6px_14px_rgba(0,0,0,0.34)]"
              : "leo-soft-badge text-white/86"
          )}
        >
          {showFirstListenStar ? (
            <Star className="h-2.5 w-2.5 fill-white text-white" strokeWidth={2.4} />
          ) : (
            coreUtils.formatNumber(user.plays)
          )}
        </div>
      </motion.div>
    </div>
  );
};

export const LeoHeader = memo(({ user, streamsToday, recentPlays = [], preparedLyrics, onTrackClick, onAvatarClick, isHighlighted }: { user: UserStats, streamsToday: number, recentPlays?: any[], preparedLyrics?: { key: string; hasLyrics: boolean } | null, onTrackClick?: (track: any) => void, onAvatarClick?: (e: React.MouseEvent<HTMLElement>) => void, isHighlighted?: boolean }) => {
  if (!user) return null;
  const shouldReduceMotion = useReducedMotion();
  const {
    ref: headerMotionRef,
    motionTier,
    shouldRunAmbientMotion: shouldRunHeaderAmbientMotion,
  } = useViewportMotionGate<HTMLDivElement>({ rootMargin: '96px' });
  const shouldRunAmbientMotion = shouldRunHeaderAmbientMotion && !shouldReduceMotion;
  const shouldRunFullAmbientMotion = shouldRunAmbientMotion && motionTier === 'full';
  const arenaTrailRef = useRef<HTMLDivElement | null>(null);
  const arenaDomCacheRef = useRef<ArenaDomCache | null>(null);
  const arenaOffsetRef = useRef(0);
  const arenaRafRef = useRef<number | null>(null);
  const arenaDragStartRef = useRef<{ pointerId: number; x: number; value: number; moved: boolean } | null>(null);
  const arenaSuppressClickUntilRef = useRef(0);
  const groupStatsForUser = useStatsStore(s => s.groupStats);
  const liveNowPlayingByUserId = useStatsStore(s => s.liveNowPlayingByUserId);
  const storeUser = useMemo(
    () => getCanonicalMembers(groupStatsForUser).find(u => u.id === user.id),
    [groupStatsForUser, user.id]
  );
  const profileAvatarOriginal = useMemo(() => {
    const avatarCandidates = [
      user.avatar,
      (user as any).profile?.image,
      storeUser?.avatar,
      (storeUser as any)?.profile?.image,
    ];
    const nextAvatar = avatarCandidates
      .map((candidate) => coreUtils.getUserAvatar(user.id, candidate))
      .find(Boolean) || '';
    const stableAvatar = readRuntimeCacheEntry(stableHeaderAvatarByUserId, user.id);
    if (stableAvatar) return stableAvatar;
    if (nextAvatar) {
      setRuntimeCacheEntry(stableHeaderAvatarByUserId, user.id, nextAvatar, 'tiny');
      return nextAvatar;
    }
    return '';
  }, [storeUser?.avatar, user.id, user.avatar]);
  const profileAvatar = useMemo(() => getStaticAvatarCandidate(profileAvatarOriginal), [profileAvatarOriginal]);
  const profileAvatarFallback = profileAvatar !== profileAvatarOriginal ? profileAvatarOriginal : undefined;
  const activeUser = attachLiveNowPlayingToMember(storeUser || user, liveNowPlayingByUserId);
  const nowPlaying = activeUser.nowPlaying;
  const liveTrack = nowPlaying?.track as any;
  const track = useMemo(() => {
    if (!liveTrack || !recentPlays.length) return liveTrack;
    const match = recentPlays
      .map((item: any) => item?.track || item)
      .find((candidate: any) => isSameResolvedTrack(liveTrack, candidate));
    return match ? mergeResolvedTrackMetadata(liveTrack, match) : liveTrack;
  }, [liveTrack, recentPlays]);
  const parsedTrackTitle = useMemo(() => parseTrackTitleBadges(track?.name), [track?.name]);
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
  const lyricsKey = track?.name && mainArtistName
    ? `${track?.id || track.name}::${mainArtistName}`
    : '';
  const hasPreparedLyrics = !!lyricsKey && preparedLyrics?.key === lyricsKey;
  const [hasLyricsBadge, setHasLyricsBadge] = useState(() => hasPreparedLyrics && preparedLyrics?.hasLyrics === true);
  const secondaryArtists = useMemo(() => track ? getSecondaryArtists(track) : [], [track]);
  const displayArtists = useMemo(() => {
    const artists = [];
    if (mainArtistName) {
      artists.push({
        id: mainArtist?.id || '',
        name: mainArtistName,
        type: 'primary' as const,
      });
    }
    secondaryArtists.forEach((artist) => {
      if (!artist?.name) return;
      artists.push({
        id: artist.id || '',
        name: artist.name,
        type: 'secondary' as const,
      });
    });
    return artists;
  }, [mainArtist?.id, mainArtistName, secondaryArtists]);
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
    if (hasPreparedLyrics) {
      setHasLyricsBadge(preparedLyrics?.hasLyrics === true);
      return;
    }
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
  }, [hasPreparedLyrics, mainArtistName, preparedLyrics?.hasLyrics, track?.name]);

  const fetchLiveProbe = useStatsStore(state => state.fetchLiveProbe);

  const playback = coreUtils.getPlaybackStatus({ nowPlaying });
  const backendIsLive = playback.status === "live";
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

  const nowPlayingAccentColor = (nowPlaying as any)?.accentColor;
  const trackDominantColor = (track as any)?.dominantColor;
  const trackAccentColor = (track as any)?.accentColor;
  const providedArtworkColor = useMemo(() => {
    const colorCandidates = [
      nowPlaying?.dominantColor,
      nowPlayingAccentColor,
      trackDominantColor,
      trackAccentColor,
    ];
    const color = colorCandidates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);
    return normalizePlaybackAccent(color || null);
  }, [
    nowPlaying?.dominantColor,
    nowPlayingAccentColor,
    trackDominantColor,
    trackAccentColor,
  ]);
  const fallbackArtworkPalette = useMemo(() => createFallbackArtworkPalette(providedArtworkColor), [providedArtworkColor]);
  const [artworkPalette, setArtworkPalette] = useState<ArtworkPalette | null>(fallbackArtworkPalette);

  useEffect(() => {
    let isMounted = true;

    setArtworkPalette(previous => previous ?? fallbackArtworkPalette);

    if (!albumImage && fallbackArtworkPalette) {
      setArtworkPalette(fallbackArtworkPalette);
    }

    if (!albumImage) {
      return () => {
        isMounted = false;
      };
    }

    getArtworkPalette(albumImage).then(palette => {
      if (isMounted) setArtworkPalette(palette);
    }).catch(() => {
      if (isMounted && fallbackArtworkPalette) {
        setArtworkPalette(fallbackArtworkPalette);
      }
    });

    return () => {
       isMounted = false;
    };
  }, [albumImage, fallbackArtworkPalette]);

  const dominantColor = artworkPalette?.vinylColor || fallbackArtworkPalette?.vinylColor || null;
  const progressColor = artworkPalette?.progressColor || fallbackArtworkPalette?.progressColor || getTonalProgressAccent(dominantColor);
  const [ambientColorA, ambientColorB, ambientColorC] = useMemo(
    () => getDistinctAmbientColors(artworkPalette, dominantColor),
    [artworkPalette, dominantColor]
  );
  const fetchTrackStatsForAll = useStatsStore(state => state.fetchTrackStatsForAll);
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const userTrackStats = useStatsStore(state => state.userTrackStats);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const hideRankingBadge = useStatsStore(state => state.hideRankingBadge);
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);

  const trackStatsKey = `${user.id}:${track?.id}`;
  const [headerTrackGroupStats, setHeaderTrackGroupStats] = useState<{ trackId: string; stats: Record<string, number> } | null>(null);
  const localTrackGroupStats = headerTrackGroupStats?.trackId === String(track?.id || '')
    ? headerTrackGroupStats.stats
    : null;
  const playCount = userTrackStats[trackStatsKey] ?? localTrackGroupStats?.[user.id];
  const rankingMembersSignature = useMemo(() => {
    return getCanonicalMembers(groupStats).map(member => member.id).filter(Boolean).join('|');
  }, [groupStats]);
  const hasHydratedTrackRanking = useMemo(() => {
    if (!track?.id) return false;
    const memberIds = rankingMembersSignature ? rankingMembersSignature.split('|') : [];
    if (memberIds.length === 0) return false;
    return memberIds.every((memberId) => Object.prototype.hasOwnProperty.call(userTrackStats, `${memberId}:${track.id}`));
  }, [rankingMembersSignature, track?.id, userTrackStats]);

  useEffect(() => {
    if (track?.id && rankingMembersSignature && !hasHydratedTrackRanking) {
      fetchTrackStatsForAll(track.id);
    }
  }, [track?.id, fetchTrackStatsForAll, hasHydratedTrackRanking, rankingMembersSignature]);

  useEffect(() => {
    const trackId = track?.id ? String(track.id) : '';
    if (!trackId) {
      setHeaderTrackGroupStats(null);
      return;
    }
    if (!rankingMembersSignature || hasHydratedTrackRanking) return;

    let cancelled = false;
    const cancelFallbackFetch = motionRuntime.scheduleTask(() => {
      statsService.fetchEntityGroupStats('track', trackId)
        .then((stats) => {
          if (!cancelled) setHeaderTrackGroupStats({ trackId, stats });
        })
        .catch(() => {
          if (!cancelled) setHeaderTrackGroupStats(null);
        });
    }, 950, 'interaction', 'leo-header-ranking-fallback');

    return () => {
      cancelled = true;
      cancelFallbackFetch();
    };
  }, [hasHydratedTrackRanking, rankingMembersSignature, track?.id]);

  const allTrackArenaUsers = useMemo(() => {
    if (!track?.id) return [];
    const users = getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId)
      .map(u => ({
        id: u.id,
        name: u.name,
        plays: userTrackStats[`${u.id}:${track?.id}`] ?? localTrackGroupStats?.[u.id] ?? 0,
        avatar: coreUtils.getUserAvatar(u.id, u.avatar)
      }))
      .sort((a, b) => b.plays - a.plays);
    return users.filter(u => u.plays > 0 || u.id === user.id).sort((a, b) => {
      if (b.plays !== a.plays) return b.plays - a.plays;
      if (a.id === user.id) return 1;
      if (b.id === user.id) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [groupStats, userTrackStats, track?.id, hiddenUsers, user.id, liveNowPlayingByUserId, localTrackGroupStats]);

  const trackArenaUsers = allTrackArenaUsers;
  const arenaPageSize = ARENA_BADGE_VISIBLE_SLOTS;
  const trailingArenaUsers = trackArenaUsers.slice(arenaPageSize);
  const hiddenArenaCount = trailingArenaUsers.length;
  const visibleArenaCount = Math.min(trackArenaUsers.length, ARENA_BADGE_VISIBLE_SLOTS);
  const arenaSummaryWidth = hiddenArenaCount > 0
    ? ARENA_BADGE_RIGHT_MORE_LEFT + 40
    : Math.max(52, ((visibleArenaCount - 1) * ARENA_BADGE_SLOT_SIZE) + 52);
  const selectedArenaIndex = allTrackArenaUsers.findIndex(u => u.id === user.id);
  const arenaDragDistance = Math.max(0, hiddenArenaCount * ARENA_BADGE_SLOT_SIZE);
  const arenaRenderableUsers = trackArenaUsers;
  const leftHiddenArenaCount = hiddenArenaCount;
  const rightHiddenArenaCount = hiddenArenaCount;

  const getArenaDomCache = useCallback(() => {
    const trail = arenaTrailRef.current;
    if (!trail) return null;
    const cached = arenaDomCacheRef.current;
    if (cached?.trail === trail && cached.bubbles.length === arenaRenderableUsers.length) {
      return cached;
    }
    const nextCache: ArenaDomCache = {
      trail,
      leftMoreBack: trail.querySelector<HTMLElement>('[data-arena-left-more-back="true"]'),
      leftMore: trail.querySelector<HTMLElement>('[data-arena-left-more="true"]'),
      rightMoreNext: trail.querySelector<HTMLElement>('[data-arena-right-more-next="true"]'),
      rightMore: trail.querySelector<HTMLElement>('[data-arena-right-more="true"]'),
      bubbles: Array.from(trail.querySelectorAll<HTMLElement>('[data-arena-bubble="true"]')),
    };
    arenaDomCacheRef.current = nextCache;
    return nextCache;
  }, [arenaRenderableUsers.length]);

  const applyArenaOffset = useCallback((value: number) => {
    const domCache = getArenaDomCache();
    if (!domCache) return;
    const dragDistance = Math.max(0, hiddenArenaCount * ARENA_BADGE_SLOT_SIZE);
    const offset = Math.abs(value);
    const progress = dragDistance > 0 ? clamp01(offset / dragDistance) : 0;
    const shift = offset / ARENA_BADGE_SLOT_SIZE;
    const baseShift = Math.min(hiddenArenaCount, Math.floor(shift));
    const shiftProgress = baseShift >= hiddenArenaCount ? 0 : clamp01(shift - baseShift);
    const visibleLastPosition = (ARENA_BADGE_VISIBLE_SLOTS - 1) * ARENA_BADGE_SLOT_SIZE;

    const { leftMoreBack } = domCache;
    if (leftMoreBack) {
      const leftBackCount = Math.min(hiddenArenaCount, baseShift);
      const leftBackScale = leftBackCount > 0 && baseShift < hiddenArenaCount
        ? 1 - shiftProgress
        : leftBackCount > 0 ? 1 : 0;
      const leftBackLeft = ARENA_BADGE_LEFT_MORE_COLLAPSE_LEFT + ((ARENA_BADGE_LEFT_MORE_LEFT - ARENA_BADGE_LEFT_MORE_COLLAPSE_LEFT) * leftBackScale);
      const leftBackContainsSelected = selectedArenaIndex >= 0 && selectedArenaIndex < leftBackCount;
      setArenaText(leftMoreBack, leftBackCount > 0 ? `+${leftBackCount}` : '');
      setArenaStyle(leftMoreBack, {
        background: leftBackContainsSelected ? ARENA_MORE_SELECTED_BACKGROUND : null,
        boxShadow: leftBackContainsSelected ? ARENA_MORE_SELECTED_BOX_SHADOW : null,
        color: leftBackContainsSelected ? ARENA_MORE_SELECTED_COLOR : null,
        opacity: String(leftBackScale <= 0.02 ? 0 : 1),
        transform: `translate3d(${leftBackLeft}px, -50%, 0) scale(${leftBackScale})`,
        transformOrigin: 'right center',
      });
    }

    const { leftMore } = domCache;
    if (leftMore) {
      const leftFrontCount = baseShift < hiddenArenaCount && shiftProgress > 0.02
        ? baseShift + 1
        : 0;
      const leftMoreScale = leftFrontCount > 0 ? shiftProgress : 0;
      const leftMoreStartLeft = leftFrontCount === 1
        ? ARENA_BADGE_LEFT_MORE_FIRST_START_LEFT
        : ARENA_BADGE_LEFT_MORE_START_LEFT;
      const leftMoreLeft = leftMoreStartLeft + ((ARENA_BADGE_LEFT_MORE_LEFT - leftMoreStartLeft) * leftMoreScale);
      const leftMoreContainsSelected = selectedArenaIndex >= 0 && selectedArenaIndex < leftFrontCount;
      setArenaText(leftMore, leftFrontCount > 0 ? `+${leftFrontCount}` : '');
      setArenaStyle(leftMore, {
        background: leftMoreContainsSelected ? ARENA_MORE_SELECTED_BACKGROUND : null,
        boxShadow: leftMoreContainsSelected ? ARENA_MORE_SELECTED_BOX_SHADOW : null,
        color: leftMoreContainsSelected ? ARENA_MORE_SELECTED_COLOR : null,
        opacity: String(leftMoreScale <= 0.02 ? 0 : 1),
        transform: `translate3d(${leftMoreLeft}px, -50%, 0) scale(${leftMoreScale})`,
        transformOrigin: 'right center',
      });
    }

    const { rightMore } = domCache;
    if (rightMore) {
      const remainingHiddenUsers = Math.max(0, hiddenArenaCount - baseShift);
      const rightMoreProgress = remainingHiddenUsers <= 0 ? 0 : 1 - shiftProgress;
      const rightMoreLeft = ARENA_BADGE_RIGHT_MORE_COLLAPSE_LEFT + ((ARENA_BADGE_RIGHT_MORE_LEFT - ARENA_BADGE_RIGHT_MORE_COLLAPSE_LEFT) * rightMoreProgress);
      const rightMoreStartIndex = arenaPageSize + baseShift;
      const rightMoreContainsSelected = selectedArenaIndex >= rightMoreStartIndex && selectedArenaIndex < trackArenaUsers.length;
      setArenaText(rightMore, remainingHiddenUsers > 0 ? `+${remainingHiddenUsers}` : '');
      setArenaStyle(rightMore, {
        background: rightMoreContainsSelected ? ARENA_MORE_SELECTED_BACKGROUND : null,
        boxShadow: rightMoreContainsSelected ? ARENA_MORE_SELECTED_BOX_SHADOW : null,
        color: rightMoreContainsSelected ? ARENA_MORE_SELECTED_COLOR : null,
        opacity: String(rightMoreProgress <= 0.02 ? 0 : 1),
        transform: `translate3d(${rightMoreLeft}px, -50%, 0) scale(${rightMoreProgress})`,
        transformOrigin: 'left center',
      });
    }

    const { rightMoreNext } = domCache;
    if (rightMoreNext) {
      const remainingHiddenUsers = Math.max(0, hiddenArenaCount - baseShift);
      const nextHiddenUsers = Math.max(0, remainingHiddenUsers - 1);
      const rightMoreNextScale = nextHiddenUsers > 0 ? shiftProgress : 0;
      const rightMoreNextLeft = ARENA_BADGE_RIGHT_MORE_LEFT + ((ARENA_BADGE_RIGHT_NEXT_LEFT - ARENA_BADGE_RIGHT_MORE_LEFT) * (1 - rightMoreNextScale));
      const rightMoreNextStartIndex = arenaPageSize + baseShift + 1;
      const rightMoreNextContainsSelected = selectedArenaIndex >= rightMoreNextStartIndex && selectedArenaIndex < trackArenaUsers.length;
      setArenaText(rightMoreNext, nextHiddenUsers > 0 ? `+${nextHiddenUsers}` : '');
      setArenaStyle(rightMoreNext, {
        background: rightMoreNextContainsSelected ? ARENA_MORE_SELECTED_BACKGROUND : null,
        boxShadow: rightMoreNextContainsSelected ? ARENA_MORE_SELECTED_BOX_SHADOW : null,
        color: rightMoreNextContainsSelected ? ARENA_MORE_SELECTED_COLOR : null,
        opacity: String(rightMoreNextScale <= 0.02 ? 0 : 1),
        transform: `translate3d(${rightMoreNextLeft}px, -50%, 0) scale(${rightMoreNextScale})`,
        transformOrigin: 'left center',
      });
    }

    domCache.bubbles.forEach((bubble) => {
      const index = Number(bubble.dataset.arenaIndex || 0);
      const baseScale = Number(bubble.dataset.arenaBaseScale || 1);
      const relativeIndex = index - baseShift;
      let visiblePosition = relativeIndex * ARENA_BADGE_SLOT_SIZE - shiftProgress * ARENA_BADGE_SLOT_SIZE;
      let scale = baseScale;

      if (relativeIndex < 0) {
        visiblePosition = -ARENA_BADGE_SLOT_SIZE;
        scale = 0;
      } else if (relativeIndex === 0) {
        scale = baseScale * (1 - shiftProgress);
      } else if (relativeIndex > 0 && relativeIndex < ARENA_BADGE_VISIBLE_SLOTS) {
        scale = baseScale;
      } else if (relativeIndex === ARENA_BADGE_VISIBLE_SLOTS) {
        visiblePosition = visibleLastPosition;
        scale = baseScale * shiftProgress;
      } else {
        visiblePosition = visibleLastPosition;
        scale = 0;
      }

      setArenaStyle(bubble, {
        opacity: String(scale <= 0.02 ? 0 : 1),
        transform: `translate3d(${ARENA_BADGE_LEFT_PAD + visiblePosition}px, -50%, 0) scale(${scale})`,
        transformOrigin: relativeIndex === ARENA_BADGE_VISIBLE_SLOTS ? 'right center' : '',
      });
    });
  }, [arenaPageSize, getArenaDomCache, hiddenArenaCount, selectedArenaIndex, trackArenaUsers.length]);

  useLayoutEffect(() => {
    arenaOffsetRef.current = 0;
    arenaDomCacheRef.current = null;
    applyArenaOffset(0);
  }, [applyArenaOffset, hiddenArenaCount, track?.id]);

  useEffect(() => {
    return () => {
      if (arenaRafRef.current != null) {
        window.cancelAnimationFrame(arenaRafRef.current);
      }
    };
  }, []);

  const updateArenaOffset = useCallback((next: number) => {
    const clamped = Math.max(-arenaDragDistance, Math.min(0, next));
    arenaOffsetRef.current = clamped;
    if (arenaRafRef.current != null) return;
    arenaRafRef.current = window.requestAnimationFrame(() => {
      arenaRafRef.current = null;
      applyArenaOffset(arenaOffsetRef.current);
    });
  }, [applyArenaOffset, arenaDragDistance]);

  const snapArenaOffset = useCallback(() => {
    if (hiddenArenaCount <= 0) return;
    const nearestSlot = Math.min(
      hiddenArenaCount,
      Math.max(0, Math.round(Math.abs(arenaOffsetRef.current) / ARENA_BADGE_SLOT_SIZE))
    );
    const snapped = -nearestSlot * ARENA_BADGE_SLOT_SIZE;
    arenaOffsetRef.current = snapped;
    if (arenaRafRef.current != null) {
      window.cancelAnimationFrame(arenaRafRef.current);
      arenaRafRef.current = null;
    }
    applyArenaOffset(snapped);
  }, [applyArenaOffset, hiddenArenaCount]);

  const handleArenaPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (hiddenArenaCount <= 0 || shouldReduceMotion) return;
    event.stopPropagation();
    arenaDragStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      value: arenaOffsetRef.current,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [hiddenArenaCount, shouldReduceMotion]);

  const handleArenaPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = arenaDragStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const delta = event.clientX - start.x;
    if (Math.abs(delta) > 3) start.moved = true;
    updateArenaOffset(start.value + delta);
  }, [updateArenaOffset]);

  const handleArenaPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = arenaDragStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.moved) {
      arenaSuppressClickUntilRef.current = window.performance.now() + 180;
      event.preventDefault();
      event.stopPropagation();
      snapArenaOffset();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    arenaDragStartRef.current = null;
  }, [snapArenaOffset]);

  const shouldSuppressArenaClick = useCallback(() => {
    return window.performance.now() < arenaSuppressClickUntilRef.current;
  }, []);

  const handleArenaClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!shouldSuppressArenaClick()) return;
    event.preventDefault();
    event.stopPropagation();
  }, [shouldSuppressArenaClick]);

  const handleArenaSummaryClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (shouldSuppressArenaClick()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onTrackClick?.({ ...track, type: 'track' });
  }, [onTrackClick, shouldSuppressArenaClick, track]);

  const isToday = nowPlaying?.timestamp ? isTodaySP(new Date(nowPlaying.timestamp)) : true;
  const isYesterday = nowPlaying?.timestamp ? isYesterdaySP(new Date(nowPlaying.timestamp)) : false;
  const formattedTime = nowPlaying?.timestamp ? formatTimeSP(new Date(nowPlaying.timestamp)) : "";
  const formattedDate = nowPlaying?.timestamp ? formatDateSP(new Date(nowPlaying.timestamp)) : "";
  const durationMs = track?.durationMs || nowPlaying?.durationMs || null;
  const livePlayback = useLivePlaybackProgress({
    userId: user.id,
    nowPlaying,
    durationMs,
    fetchLiveProbe,
  });
  const isActuallyLive = backendIsLive && livePlayback.shouldSpinVinyl;
  const playbackSignatureSource = nowPlaying as any;
  const vinylPlaybackKey = useMemo(() => getPlaybackKey(user.id, nowPlaying, null), [
    user.id,
    nowPlaying?.track?.id,
    playbackSignatureSource?.playbackKey,
    playbackSignatureSource?.streamId,
    playbackSignatureSource?.stream?.id,
    playbackSignatureSource?.playedAt,
    playbackSignatureSource?.endTime,
    nowPlaying?.timestamp,
  ]);
  const vinylTrackIdentity = useMemo(
    () => getTrackVisualIdentity(user.id, liveTrack || track, mainArtistName),
    [liveTrack, mainArtistName, track, user.id]
  );
  const backendPlaybackSignature = `${vinylPlaybackKey}:${isActuallyLive ? 'live' : 'idle'}`;
  const [playbackOverride, setPlaybackOverride] = useState<{ signature: string; isPlaying: boolean } | null>(null);
  useEffect(() => {
    if (playbackOverride && playbackOverride.signature !== backendPlaybackSignature) {
      setPlaybackOverride(null);
    }
  }, [backendPlaybackSignature, playbackOverride]);
  const visualIsLive = playbackOverride?.signature === backendPlaybackSignature
    ? playbackOverride.isPlaying
    : isActuallyLive;
  const shouldRunBackdropAmbientMotion = shouldRunAmbientMotion;
  const shouldRunLiveBackdropAmbientMotion = visualIsLive && shouldRunBackdropAmbientMotion;
  const shouldRunIdleBackdropBreathe = !visualIsLive && shouldRunBackdropAmbientMotion;
  useCompositorLoopTelemetry(shouldRunLiveBackdropAmbientMotion, 'leo-header-ambient');
  const handleVinylPlaybackIntent = useCallback((nextIsPlaying: boolean) => {
    setPlaybackOverride({ signature: backendPlaybackSignature, isPlaying: nextIsPlaying });
  }, [backendPlaybackSignature]);
  const statusLabel = isActuallyLive
    ? "OUVINDO AGORA"
    : isToday
      ? "REPRODUZIDO ÀS " + formattedTime
      : isYesterday
        ? "ONTEM ÀS " + formattedTime
        : `VISTO EM ${formattedDate}`;

  const othersPlayed = allTrackArenaUsers.some(u => u.id !== user.id);
  const showRankingSummary = !hideRankingBadge && othersPlayed;
  const showExclusiveFirstListen = playCount === 1 && !showRankingSummary;
  const showRepeatsSummary = playCount !== undefined && !showExclusiveFirstListen && !showRankingSummary;

  const shouldShowAlbumTitle = !!track?.albumName;
  const liveRingDuration = useMemo(() => 2.7 + (user.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7) * 0.18, [user.id]);

  const filteredMembers = useMemo(() => {
    return getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId);
  }, [groupStats, hiddenUsers, liveNowPlayingByUserId]);

  const containerVariants = {
    initial: { opacity: 0, scale: 1.015, y: 8 },
    animate: {
      opacity: 1, scale: 1, y: 0,
      transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const, staggerChildren: 0.055, delayChildren: 0.03 }
    },
    exit: {
      opacity: 0, scale: 0.985, y: -5,
      transition: { duration: 0.16, staggerChildren: 0.035, staggerDirection: -1 }
    }
  };

  const itemVariants = {
    initial: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15, scale: 0.95 },
    animate: shouldReduceMotion ? { opacity: 1 } : {
      opacity: 1, y: 0, scale: 1,
      transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const }
    },
    exit: shouldReduceMotion ? { opacity: 0 } : {
      opacity: 0, y: -10, scale: 0.95,
      transition: { duration: 0.2 }
    }
  };

  const lyricsActionBadge = hasLyricsBadge ? (
    <motion.button
      key={`lyrics-action-${track?.id || track?.name || 'track'}`}
      type="button"
      layout="position"
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.96 }}
      transition={{
        duration: 0.55,
        delay: 0.38,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('stats-lc-open-track-stats', {
          detail: { panel: 'lyrics' }
        }));
      }}
      whileTap={{ scale: 0.94 }}
      className={cn(
        "leo-soft-badge pointer-events-auto relative order-2 z-[90] flex shrink-0 cursor-pointer items-center rounded-full transition-colors",
        visualIsLive ? "h-8 gap-2 pl-3 pr-2.5" : "h-7 gap-1.5 pl-2.5 pr-2"
      )}
      aria-label="Abrir letra"
      data-stats-lc-lyrics-badge="confirmed"
    >
      <BookOpen
        className={cn(
          "transition-colors duration-500",
          visualIsLive ? "h-3 w-3" : "h-2.5 w-2.5",
          visualIsLive ? "text-orange-400" : "text-white/40"
        )}
        strokeWidth={2.4}
      />
      <span className={cn(
        "font-black uppercase tracking-[0.18em] leading-none transition-colors duration-500",
        visualIsLive ? "text-[7.5px]" : "text-[7px]",
        visualIsLive ? "text-white/60" : "text-white/40"
      )}>
        Letra
      </span>
    </motion.button>
  ) : null;

  return (
    <div ref={headerMotionRef} className={cn(
      "relative -mt-3 px-5 sm:px-8 overflow-visible",
      visualIsLive ? "mb-4" : "mb-2"
    )}
    data-stats-lc-leo-header-track-id={track?.id || ''}
    data-stats-lc-leo-header-ranking-hidden={hideRankingBadge ? 'true' : 'false'}
    data-stats-lc-leo-header-ranking-hydrated={hasHydratedTrackRanking ? 'true' : 'false'}
    data-stats-lc-leo-header-ranking-source={hasHydratedTrackRanking ? 'store' : localTrackGroupStats ? 'local' : 'pending'}
    data-stats-lc-leo-header-ranking-member-count={rankingMembersSignature ? String(rankingMembersSignature.split('|').length) : '0'}
    data-stats-lc-leo-header-arena-count={String(allTrackArenaUsers.length)}
    data-stats-lc-leo-header-others-played={othersPlayed ? 'true' : 'false'}
    data-stats-lc-leo-header-play-count={playCount == null ? '' : String(playCount)}>
      <div className={cn(
        "w-full relative overflow-visible",
        visualIsLive ? "min-h-[334px] sm:min-h-[410px]" : "min-h-[306px] sm:min-h-[376px]"
      )}>
      <motion.div
        className="relative h-full overflow-visible"
      >
        {/* Open ambient header backdrop */}
        <div className={cn(
          "absolute left-1/2 top-[calc(-22rem-env(safe-area-inset-top,0px))] bottom-[-680px] z-0 w-[190vw] min-w-[920px] -translate-x-1/2 isolate overflow-visible transition-[box-shadow,opacity] duration-500 pointer-events-none",
          isHighlighted
            ? "shadow-[0_0_40px_rgba(249,115,22,0.38)]"
            : "shadow-[0_24px_70px_-45px_rgba(0,0,0,0.9)]"
        )}
        style={{
          backgroundColor: '#020202',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.96) 0%, black 20%, black 60%, rgba(0,0,0,0.82) 76%, rgba(0,0,0,0.42) 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.96) 0%, black 20%, black 60%, rgba(0,0,0,0.82) 76%, rgba(0,0,0,0.42) 92%, transparent 100%)'
        }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 overflow-visible rounded-[inherit]"
          >
            {!track && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 28% 30%, rgba(255,255,255,0.065) 0%, transparent 42%), radial-gradient(circle at 74% 62%, rgba(249,115,22,0.11) 0%, transparent 46%), linear-gradient(135deg, rgba(0,0,0,0.66) 0%, rgba(15,12,12,0.28) 52%, rgba(0,0,0,0.58) 100%)',
                }}
              />
            )}
            {track && (
              <div
                className={cn(
                  "stats-lc-engine-loop stats-lc-artwork-drift absolute left-1/2 top-[42%] z-0 h-[470px] w-[min(150vw,760px)] transition-opacity duration-700",
                  visualIsLive ? "opacity-[0.7]" : "opacity-[0.56]",
                  !shouldRunLiveBackdropAmbientMotion && "stats-lc-ambient-idle-freeze"
                )}
                data-active={shouldRunLiveBackdropAmbientMotion ? "true" : "false"}
                style={{
                  background: `radial-gradient(circle at 62% 34%, ${withAlpha(ambientColorA, 0.46)} 0%, ${withAlpha(ambientColorA, 0.2)} 18%, transparent 44%), radial-gradient(circle at 28% 66%, ${withAlpha(ambientColorB, 0.28)} 0%, ${withAlpha(ambientColorB, 0.12)} 18%, transparent 42%)`,
                  translate: '-50% -50%',
                }}
              />
            )}
            {track && !visualIsLive && (
              <EngineBreathe
                active={shouldRunIdleBackdropBreathe}
                className="pointer-events-none absolute left-1/2 top-[42%] z-0 h-[340px] w-[min(118vw,620px)]"
                duration={8.5}
                fromOpacity={0.16}
                fromScale={0.98}
                style={{
                  background: `radial-gradient(circle at 58% 42%, ${withAlpha(ambientColorA, 0.28)} 0%, ${withAlpha(ambientColorB, 0.11)} 36%, transparent 70%)`,
                  translate: '-50% -50%',
                }}
                toOpacity={0.34}
                toScale={1.025}
              />
            )}
            <div
              className={cn(
                "stats-lc-engine-loop stats-lc-ambient-drift-primary absolute left-1/2 top-[38%] z-0 h-[420px] w-[min(136vw,700px)] pointer-events-none",
                !shouldRunLiveBackdropAmbientMotion && "stats-lc-ambient-idle-freeze"
              )}
              data-active={shouldRunLiveBackdropAmbientMotion ? "true" : "false"}
              style={{
                background: track
                  ? `radial-gradient(circle at 68% 38%, ${withAlpha(ambientColorB, visualIsLive ? 0.62 : 0.34)} 0%, ${withAlpha(ambientColorB, visualIsLive ? 0.18 : 0.1)} 24%, transparent 48%)`
                  : 'radial-gradient(circle at 38% 38%, rgba(255,255,255,0.075) 0%, transparent 50%), radial-gradient(circle at 58% 54%, rgba(249,115,22,0.12) 0%, transparent 56%)',
                translate: '-50% -50%',
              }}
            />
            <div
              className={cn(
                "stats-lc-engine-loop stats-lc-ambient-drift-secondary absolute left-1/2 top-[56%] z-0 h-[380px] w-[min(128vw,660px)] pointer-events-none",
                !shouldRunLiveBackdropAmbientMotion && "stats-lc-ambient-idle-freeze"
              )}
              data-active={shouldRunLiveBackdropAmbientMotion ? "true" : "false"}
              style={{
                background: track
                  ? `radial-gradient(circle at 18% 58%, ${withAlpha(ambientColorC, visualIsLive ? 0.5 : 0.26)} 0%, ${withAlpha(ambientColorC, visualIsLive ? 0.16 : 0.08)} 22%, transparent 44%)`
                  : 'radial-gradient(circle at 68% 58%, rgba(255,255,255,0.055) 0%, transparent 48%), radial-gradient(circle at 32% 72%, rgba(124,45,18,0.12) 0%, transparent 54%)',
                translate: '-50% -50%',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/14 to-black/34" />
          </motion.div>
          <div className="stats-lc-grain stats-lc-header-grain absolute inset-0 pointer-events-none" />
        </div>
        {track && (
          <div className={cn(
            "absolute -right-[190px] -top-[58px] z-40 h-[360px] w-[360px] shrink-0 pointer-events-none"
          )}
          style={{
            filter: visualIsLive
              ? 'drop-shadow(0 8px 14px rgba(0,0,0,0.16))'
              : 'drop-shadow(0 7px 12px rgba(0,0,0,0.14))'
          }}>
            <motion.div
              className="h-full w-full overflow-visible"
              animate={{ scale: visualIsLive ? 1 : 0.916667 }}
              transition={{ duration: 0.92, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: '50% 50%' }}
            >
              <div
                className="pointer-events-none absolute inset-[3%] rounded-full"
                style={{
                  background: 'radial-gradient(circle at 50% 54%, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.08) 62%, transparent 78%)',
                  boxShadow: visualIsLive
                    ? '0 16px 30px rgba(0,0,0,0.2), 0 0 34px rgba(0,0,0,0.12)'
                    : '0 12px 24px rgba(0,0,0,0.16), 0 0 24px rgba(0,0,0,0.1)'
                }}
              />
              <VinylRecord
                albumImage={albumImage || ""}
                dominantColor={dominantColor || ""}
                isPlaying={visualIsLive}
                playbackKey={vinylPlaybackKey}
                trackIdentity={vinylTrackIdentity}
                onPlaybackIntent={handleVinylPlaybackIntent}
              />
            </motion.div>
          </div>
        )}
        <div className="pointer-events-none relative z-50 px-0 sm:px-2 pt-0 pb-3 sm:pb-4 overflow-visible">

          <AnimatePresence mode="sync">
            <motion.div
              key={user.id}
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
                  className={cn("relative shrink-0", onAvatarClick && "pointer-events-auto cursor-pointer")}
                  whileTap={onAvatarClick ? { scale: 0.95 } : undefined}
                >
                  {isActuallyLive && profileAvatar && (
                    <EngineSpin
                      active={shouldRunAmbientMotion}
                      duration={liveRingDuration}
                      className="absolute inset-[-3px] rounded-full"
                      style={{
                        background: `conic-gradient(${dominantColor || '#f97316'}, transparent, ${dominantColor || '#f97316'})`,
                        filter: 'brightness(1.5) saturate(1.3)'
                      }}
                    />
                  )}
                    <div className={cn(
                      "relative rounded-full overflow-hidden border-2 transition-[width,height,border-color,box-shadow,opacity,transform] duration-500",
                      isActuallyLive
                        ? "w-[70px] h-[70px] sm:w-[86px] sm:h-[86px] border-white/80 shadow-[0_0_16px_rgba(255,255,255,0.45)]"
                        : "w-16 h-16 sm:w-[72px] sm:h-[72px] border-white/20",
                      !profileAvatar && "bg-black/28 border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    )}>
                    <SmartImage
                      src={profileAvatar}
                      fallbackSrc={profileAvatarFallback}
                      cacheKey={`leoheader-avatar:${user.id}`}
                      className="h-full w-full"
                      fallback={profileAvatar ? "" : user.name}
                      rounded="full"
                    />
                  </div>
                </motion.div>

                {/* Nome + Streams */}
                <div className={cn(
                  "flex flex-col items-start min-w-0 gap-1 flex-1 transition-[padding-right] duration-500",
                  visualIsLive ? "pr-[118px] sm:pr-[168px]" : "pr-[92px] sm:pr-[150px]"
                )}>

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
                    className="leo-soft-badge -ml-1 flex h-6 max-w-[min(62vw,220px)] items-center gap-1 rounded-full px-2 transition-[color,background-color,border-color,opacity,transform] duration-500"
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
                        <AnimatedNumber key={user.id} value={streamsToday} startFrom={0} adaptive />
                      </span>
                      <span className="stats-lc-dense-label text-[6px] sm:text-[6.5px] font-black uppercase text-white/60">
                        TOTAL HOJE
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {track ? (
                <div className={cn(
                  "flex flex-col mt-0",
                  visualIsLive && !showRankingSummary ? "gap-7" : "gap-6"
                )}>
                  {/* Track Info Section */}
                  <motion.div variants={itemVariants} className="flex relative items-start min-h-[168px] sm:min-h-[210px] w-full">

                    {/* Conteúdo Esquerdo: textos e ranking compactos, com o vinil vazando por trás */}
                    <div className="flex flex-col justify-start w-full shrink-0 min-w-0 pl-0 pr-1 gap-5 sm:gap-6 relative z-50">
                      <div className="flex flex-col gap-0.5">
                        <div className={cn(
                          "flex items-start gap-1.5",
                          "max-w-[min(62vw,250px)] sm:max-w-[360px]"
                        )}>
                          <ScrollingTrackTitle
                            title={parsedTrackTitle.displayTitle || track.name}
                            isPlaying={visualIsLive}
                            onClick={() => onTrackClick?.({ ...track, type: 'track' })}
                          />
                          <TrackTitleBadges badges={parsedTrackTitle.badges} />
                        </div>
                        <div
                          className="block w-[min(62vw,250px)] max-w-full overflow-hidden whitespace-nowrap pb-0.5 text-[19.70px] font-normal leading-[1.14] tracking-[-0.016em] text-white/72 pointer-events-auto select-none sm:w-[360px]"
                        >
                          {displayArtists.map((artist, idx) => {
                            const isLast = idx === displayArtists.length - 1;
                            const separator = idx === 0 ? '' : isLast ? ' & ' : ', ';
                            return (
                              <React.Fragment key={`${artist.type}-${artist.id || artist.name}-${idx}`}>
                                {separator && <span className="text-white/40">{separator}</span>}
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onTrackClick?.({
                                      id: artist.id || '',
                                      name: artist.name,
                                      type: 'artist'
                                    });
                                  }}
                                  className={cn(
                                    "hover:underline cursor-pointer",
                                    artist.type === 'primary' ? "text-white/72" : "text-white/65"
                                  )}
                                >
                                  {artist.name}
                                </span>
                              </React.Fragment>
                            );
                          })}
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
                            className="mt-0.5 text-[10px] sm:text-[12px] font-black uppercase tracking-[0.02em] text-white/60 line-clamp-2 hover:underline hover:text-white/85 cursor-pointer text-left pointer-events-auto w-[62vw] max-w-[300px] leading-[1.18] [text-wrap:balance]"
                          >
                            {track.albumName.toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className={cn(
                        "w-[calc((100vw-40px)*0.5)] min-w-[154px] max-w-[220px]",
                        visualIsLive && "mt-1"
                      )}>
                         <LiveTrackProgress
                            progressMs={livePlayback.progressMs}
                            progressPercent={livePlayback.progressPercent}
                            progressTargetPercent={livePlayback.progressTargetPercent}
                            progressAnimationMs={livePlayback.progressAnimationMs}
                            progressAnimationKey={livePlayback.progressAnimationKey}
                            durationMs={durationMs || undefined}
                            timestamp={nowPlaying.timestamp}
                            isNowPlaying={isActuallyLive}
                            platform={platform.primary}
                            compact
                            progressColor={progressColor || undefined}
                            isSynchronizing={livePlayback.isCheckingNext}
                         />
                      </div>

                      <div className={cn(
                        "relative flex w-[calc(100vw-40px)] max-w-[350px] items-start pr-1",
                        visualIsLive && (showRankingSummary ? "mt-2" : "mt-2.5")
                      )}>
                        <motion.div
                          layout
                          className="flex min-w-0 w-full flex-wrap items-center gap-3"
                          transition={{ duration: shouldReduceMotion ? 0.01 : 0.42, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <AnimatePresence initial={false} mode="popLayout">
                          {showExclusiveFirstListen ? (
                            <motion.div
                              key={`first-listen-${track.id || track.name || 'track'}`}
                              layout="position"
                              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.96 }}
                              transition={{ duration: 0.55, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
                              className={cn(
                              "leo-soft-badge order-1 flex cursor-pointer items-center rounded-full",
                              visualIsLive ? "h-8 gap-2 pl-3 pr-2.5" : "h-7 gap-1.5 pl-2.5 pr-2"
                            )}>
                              <Star className={cn(
                                "transition-colors duration-500",
                                visualIsLive ? "h-3 w-3 fill-orange-400 text-orange-400" : "h-2.5 w-2.5 fill-white/40 text-white/40"
                              )} />
                              <span className={cn(
                                "font-black uppercase tracking-[0.18em] leading-none whitespace-nowrap transition-colors duration-500",
                                visualIsLive ? "text-[7.5px] text-white/60" : "text-[7px] text-white/40"
                              )}>
                                FIRST LISTEN
                              </span>
                            </motion.div>
                          ) : showRankingSummary ? (
                            <motion.div
                              key={`arena-summary-${track.id || track.name || 'track'}`}
                              layout="position"
                              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -7, scale: 0.95 }}
                              transition={{ duration: 0.55, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
                              onClick={handleArenaSummaryClick}
                              whileTap={{ scale: 0.98 }}
                              className="pointer-events-auto relative order-1 flex h-[58px] max-w-[calc(100vw-112px)] shrink cursor-pointer items-center group/arena"
                            >
                              <div
                                ref={arenaTrailRef}
                                key={`arena-trail-${track.id || track.name || 'track'}`}
                                data-home-horizontal-scroll="true"
                                className="relative h-[58px] overflow-visible pr-0"
                                style={{ width: `${arenaSummaryWidth}px`, minWidth: `${Math.min(arenaSummaryWidth, 52)}px` }}
                              >
                                <div
                                  className="absolute -inset-x-5 -inset-y-4 z-[80] cursor-grab touch-none active:cursor-grabbing"
                                  onPointerDown={handleArenaPointerDown}
                                  onPointerMove={handleArenaPointerMove}
                                  onPointerUp={handleArenaPointerEnd}
                                  onPointerCancel={handleArenaPointerEnd}
                                  onLostPointerCapture={handleArenaPointerEnd}
                                  onClickCapture={handleArenaClickCapture}
                                  style={{ opacity: 0, touchAction: 'none' }}
                                >
                                  <div className="h-full w-full" />
                                </div>
                                {leftHiddenArenaCount > 0 && (
                                  <>
                                    <div
                                      data-arena-left-more-back="true"
                                      key={`arena-more-left-back-${leftHiddenArenaCount}`}
                                      className={cn(
                                        "pointer-events-none absolute left-0 top-1/2 z-0 flex h-10 min-w-10 origin-right items-center justify-center rounded-full px-2 text-[10px] font-black leading-none text-white shadow-[0_14px_20px_rgba(0,0,0,0.42)] backdrop-blur-md sm:h-11 sm:min-w-11",
                                        "leo-soft-badge text-white/86"
                                      )}
                                      style={{ opacity: 0, transform: `translate3d(${ARENA_BADGE_LEFT_MORE_LEFT}px, -50%, 0) scale(1)` }}
                                      aria-hidden="true"
                                    />
                                    <div
                                      data-arena-left-more="true"
                                      key={`arena-more-left-${leftHiddenArenaCount}`}
                                      className={cn(
                                        "pointer-events-none absolute left-0 top-1/2 z-[1] flex h-10 min-w-10 origin-right items-center justify-center rounded-full px-2 text-[10px] font-black leading-none text-white shadow-[0_14px_20px_rgba(0,0,0,0.42)] backdrop-blur-md sm:h-11 sm:min-w-11",
                                        "leo-soft-badge text-white/86"
                                      )}
                                      style={{
                                        opacity: 0,
                                        transform: `translate3d(${ARENA_BADGE_LEFT_MORE_LEFT}px, -50%, 0) scale(0)`,
                                      }}
                                      aria-hidden="true"
                                    />
                                  </>
                                )}
                                {arenaRenderableUsers.map((u, i) => (
                                  <ArenaRankingBubble
                                    key={`${u.id}-arena-${i}`}
                                    user={u}
                                    index={i}
                                    total={trackArenaUsers.length}
                                    selectedUserId={user.id}
                                    shouldReduceMotion={shouldReduceMotion}
                                    isHiddenInitial={i >= arenaPageSize}
                                    isLive={isActuallyLive}
                                  />
                                ))}
                                {rightHiddenArenaCount > 0 && (
                                  <>
                                    <div
                                      data-arena-right-more-next="true"
                                      key={`arena-more-next-${rightHiddenArenaCount}`}
                                      className={cn(
                                        "pointer-events-none absolute left-0 top-1/2 z-0 flex h-10 min-w-10 origin-left items-center justify-center rounded-full px-2 text-[10px] font-black leading-none text-white shadow-[0_14px_20px_rgba(0,0,0,0.42)] backdrop-blur-md sm:h-11 sm:min-w-11",
                                        "leo-soft-badge text-white/86"
                                      )}
                                      style={{ opacity: 0, transform: `translate3d(${ARENA_BADGE_RIGHT_NEXT_LEFT}px, -50%, 0) scale(0)`, transformOrigin: 'left center' }}
                                      aria-hidden="true"
                                    />
                                    <div
                                      data-arena-right-more="true"
                                      key={`arena-more-${rightHiddenArenaCount}`}
                                      className="pointer-events-none absolute left-0 top-1/2 z-[1] h-10 min-w-10 origin-left sm:h-11 sm:min-w-11"
                                      style={{
                                        opacity: 1,
                                        transform: `translate3d(${ARENA_BADGE_RIGHT_MORE_LEFT}px, -50%, 0) scale(1)`,
                                        transformOrigin: 'left center',
                                      }}
                                      aria-hidden="true"
                                    >
                                      <motion.div
                                        data-arena-more-visual="true"
                                        className="leo-soft-badge flex h-full min-w-10 items-center justify-center rounded-full px-2 text-[10px] font-black leading-none text-white/86 shadow-[0_14px_20px_rgba(0,0,0,0.42)] backdrop-blur-md sm:min-w-11"
                                        initial={shouldReduceMotion
                                          ? false
                                          : { opacity: 0, x: -ARENA_BADGE_RIGHT_MORE_LEFT, scale: 0.18, rotate: -9 }}
                                        animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
                                        exit={shouldReduceMotion
                                          ? { opacity: 0 }
                                          : { opacity: 0, x: -ARENA_BADGE_RIGHT_MORE_LEFT, scale: 0.16, rotate: 8 }}
                                        transition={{
                                          duration: shouldReduceMotion ? 0.01 : 0.52,
                                          delay: shouldReduceMotion ? 0 : visibleArenaCount * 0.18,
                                          ease: [0.34, 1.56, 0.64, 1],
                                        }}
                                      >
                                        +{rightHiddenArenaCount}
                                      </motion.div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          ) : showRepeatsSummary ? (
                            <motion.div
                              key={`repeats-summary-${track.id || track.name || 'track'}`}
                              layout="position"
                              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.96 }}
                              transition={{ duration: 0.55, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
                              onClick={(e) => { e.stopPropagation(); onTrackClick?.({ ...track, type: 'track' }); }}
                              whileTap={{ scale: 0.96 }}
                              className="pointer-events-auto flex items-center gap-2 cursor-pointer shrink-0"
                            >
                              <div className={cn(
                                "leo-soft-badge flex cursor-pointer items-center rounded-full",
                                visualIsLive ? "h-8 gap-1.5 pl-3 pr-2.5" : "h-7 gap-1 pl-2.5 pr-2"
                              )}>
                                <Repeat className={cn(
                                  "transition-colors duration-500",
                                  visualIsLive ? "h-3 w-3" : "h-2.5 w-2.5",
                                  visualIsLive ? "text-orange-400" : "text-white/40"
                                )} />
                                <span className={cn(
                                  "font-black tabular-nums leading-none transition-colors duration-500",
                                  visualIsLive ? "text-[10.8px]" : "text-[10.3px]",
                                  visualIsLive ? "text-white" : "text-white/60"
                                )}>
                                  <AnimatedNumber value={playCount ?? 0} />
                                </span>
                                <span className={cn(
                                  "font-black uppercase tracking-[0.18em] leading-none transition-colors duration-500",
                                  visualIsLive ? "text-[7.5px]" : "text-[7px]",
                                  visualIsLive ? "text-white/60" : "text-white/40"
                                )}>
                                  REPEATS
                                </span>
                              </div>
                            </motion.div>
                          ) : null}
                          </AnimatePresence>
                          <AnimatePresence initial={false} mode="popLayout">
                            {lyricsActionBadge}
                          </AnimatePresence>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ) : (
                <motion.div
                  variants={itemVariants}
                  className="py-16 sm:py-20 rounded-[32px] sm:rounded-[48px] flex flex-col items-center justify-center border-2 border-dashed border-white/10 bg-black/10 backdrop-blur-xl group transition-[background-color,border-color,opacity,transform] relative overflow-hidden"
                >
                  <div
                    className="stats-lc-engine-loop stats-lc-engine-breathe absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_70%)]"
                    data-active={shouldRunAmbientMotion ? "true" : "false"}
                  />
                  <EngineDrift
                    active={shouldRunAmbientMotion}
                    duration={5}
                    rotateA={0}
                    rotateB={0}
                    xA={0}
                    xB={0}
                    yA={-5}
                    yB={0}
                    className="relative mb-4 sm:mb-6"
                  >
                    <StatsLCLogo size={34} className="opacity-55 grayscale transition-[opacity,transform] duration-700 group-hover:opacity-95 sm:scale-110" />
                    <div className="absolute inset-[-10px] bg-orange-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  </EngineDrift>
                  <span className="text-[11px] sm:text-[13px] font-black uppercase tracking-[0.4em] sm:tracking-[0.5em] text-white/40 drop-shadow-lg">Sinal de Fã</span>
                  <span className="text-[8px] sm:text-[10px] font-medium text-white/18 mt-2 sm:mt-3 uppercase tracking-[0.2em] flex items-center gap-2">
                    Sintonizando...
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
