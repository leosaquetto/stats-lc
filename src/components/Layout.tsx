/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Home, AudioLines, SlidersHorizontal, WifiOff, Orbit, Music2, FileText, Loader2, Disc3, UserCircle, ListMusic, BookOpen, ExternalLink, Copy, Share, ChevronLeft, ChevronRight, CalendarDays, Sparkles, Moon, Rabbit } from 'lucide-react';
import { motion, AnimatePresence, animate as animateMotion, useMotionValue, useDragControls } from 'motion/react';
import { clsx } from 'clsx';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';
import { statsService } from '../services/statsService';
import { AnimatedNumber, EngineBreathe, EngineEqualizer, EngineShimmer, EngineSpinner, SkeletonSurface, SmartImage } from './shared/CommonUI';
import { attachLiveNowPlayingToMember, getCanonicalMembersWithLive } from '../lib/memberSelectors';
import { getMainArtist, getMainArtistName } from '../lib/artistUtils';
import { parseTrackTitleBadges } from '../lib/trackTitleBadges';
import type { LyricsFullResponse, LyricsMatch } from '../types/stats';
import { preloadRouteModule } from '../lib/routePreloads';
import { useMotionRuntime } from '../hooks/useMotionRuntime';
import { useCompositorLoopTelemetry } from '../hooks/useCompositorLoopTelemetry';
import { useViewportMotionGate } from '../hooks/useViewportMotionGate';
import { readRuntimeCacheEntry, setRuntimeCacheEntry } from '../lib/memoryRuntime';
import { useModalMotionScope } from '../hooks/useModalMotionScope';
import { motionRuntime as motionRuntimeScheduler } from '../lib/motionRuntime';

const NAV_ITEMS = [
  { label: 'Início', icon: Home, path: '/', activePaths: ['/'] },
  { label: 'Stats', icon: AudioLines, path: '/stats', activePaths: ['/stats', '/highlights'] },
  { label: 'Órbita', icon: Orbit, path: '/circle', activePaths: ['/circle', '/ranking', '/alike'] },
  { label: 'Ajustes', icon: SlidersHorizontal, path: '/settings', activePaths: ['/settings'] },
];

const preloadRouteModules = (path: string) => {
  const runPreload = () => {
    preloadRouteModule(path).catch(() => undefined);
  };

  motionRuntimeScheduler.scheduleTask(runPreload, 0, 'interaction', 'route-module-preload');
};

const EqualizerIcon = () => {
  const motionRuntime = useMotionRuntime();
  return (
    <EngineEqualizer
      active={motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve'}
      className="h-3 w-3.5 shrink-0 select-none pb-[1px]"
    />
  );
};

const NavStatsIcon = ({
  isActive,
  shouldAnimate,
}: {
  isActive: boolean;
  shouldAnimate: boolean;
}) => {
  const bars = [0.58, 1, 0.74, 0.92, 0.5];
  return (
    <span className="flex h-[22px] w-[22px] items-center justify-center gap-[2.2px]" aria-hidden="true">
      {bars.map((scale, index) => (
        <motion.span
          key={index}
          className={clsx(
            "w-[2px] origin-center rounded-full",
            isActive ? "bg-white" : "bg-white/50"
          )}
          style={{ height: `${13 + (index % 2) * 5}px` }}
          initial={false}
          animate={isActive && shouldAnimate
            ? { scaleY: [1, scale, 1.18 - scale * 0.12, 1] }
            : { scaleY: 1 }}
          transition={{
            duration: isActive && shouldAnimate ? 0.52 : 0.18,
            ease: [0.16, 1, 0.3, 1],
            delay: isActive && shouldAnimate ? index * 0.035 : 0,
          }}
        />
      ))}
    </span>
  );
};

const NavOrbitIcon = ({
  isActive,
  shouldAnimate,
}: {
  isActive: boolean;
  shouldAnimate: boolean;
}) => (
  <motion.span
    className="flex h-[22px] w-[22px] items-center justify-center"
    initial={false}
    animate={isActive && shouldAnimate
      ? { rotate: [0, 18, -7, 0], scale: [1, 1.08, 0.99, 1] }
      : { rotate: 0, scale: 1 }}
    transition={{ duration: isActive && shouldAnimate ? 0.62 : 0.18, ease: [0.16, 1, 0.3, 1] }}
  >
    <Orbit
      className={clsx(isActive ? "h-[22px] w-[22px] text-white" : "h-[21px] w-[21px] text-white/50 hover:text-white/80")}
      strokeWidth={isActive ? 2.4 : 1.7}
    />
  </motion.span>
);

const NavSettingsIcon = ({
  isActive,
  shouldAnimate,
}: {
  isActive: boolean;
  shouldAnimate: boolean;
}) => (
  <motion.svg
    viewBox="0 0 24 24"
    className={clsx(isActive ? "h-[22px] w-[22px] text-white" : "h-[21px] w-[21px] text-white/50 hover:text-white/80")}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth={isActive ? 2.35 : 1.7}
    initial={false}
    animate={isActive && shouldAnimate ? { scale: [1, 1.045, 1] } : { scale: 1 }}
    transition={{ duration: isActive && shouldAnimate ? 0.5 : 0.18, ease: [0.16, 1, 0.3, 1] }}
    aria-hidden="true"
  >
    <motion.line x1="4" x2="20" y1="6" y2="6" />
    <motion.line x1="4" x2="20" y1="12" y2="12" />
    <motion.line x1="4" x2="20" y1="18" y2="18" />
    <motion.circle
      cx="9"
      cy="6"
      r="1.8"
      fill="currentColor"
      animate={isActive && shouldAnimate ? { cx: [9, 13, 9] } : { cx: 9 }}
      transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
    />
    <motion.circle
      cx="15"
      cy="12"
      r="1.8"
      fill="currentColor"
      animate={isActive && shouldAnimate ? { cx: [15, 11, 15] } : { cx: 15 }}
      transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1], delay: 0.035 }}
    />
    <motion.circle
      cx="11"
      cy="18"
      r="1.8"
      fill="currentColor"
      animate={isActive && shouldAnimate ? { cx: [11, 16, 11] } : { cx: 11 }}
      transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1], delay: 0.07 }}
    />
  </motion.svg>
);

const NavMotionIcon = ({
  icon: Icon,
  isActive,
  path,
  shouldAnimate,
}: {
  icon: typeof Home;
  isActive: boolean;
  path: string;
  shouldAnimate: boolean;
}) => {
  if (path === '/stats') return <NavStatsIcon isActive={isActive} shouldAnimate={shouldAnimate} />;
  if (path === '/circle') return <NavOrbitIcon isActive={isActive} shouldAnimate={shouldAnimate} />;
  if (path === '/settings') return <NavSettingsIcon isActive={isActive} shouldAnimate={shouldAnimate} />;
  return (
    <Icon
      className={clsx(
        isActive
          ? "h-[22px] w-[22px] text-white"
          : "h-[21px] w-[21px] text-white/50 hover:text-white/80"
      )}
      strokeWidth={isActive ? 2.4 : 1.7}
    />
  );
};

const GeniusLogo = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Genius">
    <path
      fill="currentColor"
      d="M12.897 1.235c-.36.001-.722.013-1.08.017-.218-.028-.371.225-.352.416-.035 1.012.023 2.025-.016 3.036-.037.841-.555 1.596-1.224 2.08-.5.345-1.118.435-1.671.663.121.78.434 1.556 1.057 2.07 1.189 1.053 3.224.86 4.17-.426.945-1.071.453-2.573.603-3.854.286-.48.937-.132 1.317-.49-.34-1.249-.81-2.529-1.725-3.472a11.125 11.125 0 00-1.08-.04zm-10.42.006C.53 2.992-.386 5.797.154 8.361c.384 2.052 1.682 3.893 3.45 4.997.134-.23.23-.476.09-.73-.95-2.814-.138-6.119 1.986-8.19.014-.986.043-1.976-.003-2.961l-.188-.214c-1.003-.051-2.008 0-3.01-.022zm17.88.055l-.205.356c.265.938.6 1.862.72 2.834.58 3.546-.402 7.313-2.614 10.14-1.816 2.353-4.441 4.074-7.334 4.773-2.66.66-5.514.45-8.064-.543-.068.079-.207.237-.275.318 2.664 2.629 6.543 3.969 10.259 3.498 3.075-.327 5.995-1.865 8.023-4.195 1.935-2.187 3.083-5.07 3.125-7.992.122-3.384-1.207-6.819-3.636-9.19z"
    />
  </svg>
);

const SpotifyMark = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 800 800" className={className} role="img" aria-label="Spotify">
    <path
      fill="currentColor"
      d="M400,17.3C188.7,17.3,17.3,188.7,17.3,400s171.4,382.7,382.7,382.7,382.7-171.3,382.7-382.7S611.4,17.3,400,17.3ZM575.5,569.2c-6.8,11.2-21.5,14.8-32.8,8-89.8-54.9-202.9-67.3-336.1-36.8-12.9,3-25.6-5.1-28.6-18-3-12.9,5.1-25.6,17.9-28.6,145.8-33.3,270.8-19,371.7,42.7,11.2,6.9,14.8,21.5,7.9,32.8h.1ZM622.3,465c-8.7,14.1-27.1,18.5-41,9.8-102.9-63.2-259.7-81.6-381.4-44.6-15.8,4.8-32.5-4.1-37.3-19.9-4.8-15.7,4.2-32.5,19.9-37.3,139-42.2,311.7-21.7,429.8,50.8,14,8.7,18.5,27.1,9.8,41h.1ZM626.6,356.4h-.2c-123.3-73.2-326.9-79.9-444.5-44.2-18.9,5.7-38.9-4.9-44.6-23.9-5.7-18.9,4.9-38.9,23.9-44.6,135.2-41,359.9-33.1,501.9,51.1,16.9,10,22.7,32,12.6,49-10,17-32.1,22.7-49,12.6Z"
    />
  </svg>
);

const AppleMark = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 800 800" className={className} role="img" aria-label="Apple Music">
    <path
      fill="currentColor"
      d="M508.7,122.8c-26.9,30.7-69.1,57.6-111.3,53.7-7.7-46.1,15.4-92.1,38.4-119C462.7,23,508.7,0,547.1,0c3.8,42.2-11.5,88.3-38.4,122.8h0Z"
    />
    <path
      fill="currentColor"
      d="M547.1,184.2c23,0,92.1,7.7,138.2,76.8-3.8,3.8-80.6,49.9-80.6,145.8s99.8,153.5,99.8,153.5c0,3.8-15.4,53.7-49.9,107.5-30.7,46.1-65.2,92.1-115.1,92.1s-65.2-30.7-122.8-30.7-76.8,30.7-122.8,30.7-88.3-49.9-119-95.9c-65.2-95.9-115.1-268.7-46.1-383.8,30.7-57.6,92.1-95.9,153.5-95.9s95.9,34.5,122.8,34.5c26.9,0,80.6-38.4,142-34.5h0Z"
    />
  </svg>
);

const StatsFmMark = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 800 800" className={className} role="img" aria-label="stats.fm">
    <rect fill="currentColor" x="16.6" y="248.1" width="173" height="534.4" rx="56.6" ry="56.6" />
    <rect fill="currentColor" x="610.4" y="452.5" width="173" height="329.9" rx="56.6" ry="56.6" />
    <rect fill="currentColor" x="313.3" y="17.6" width="173" height="764.6" rx="56.6" ry="56.6" />
  </svg>
);

const BottomNavigation = React.memo(({
  pathname,
}: {
  pathname: string;
}) => {
  const motionRuntime = useMotionRuntime();
  const activeNavIndex = Math.max(0, NAV_ITEMS.findIndex(item => item.activePaths.includes(pathname)));
  const navAnimationKey = pathname;
  const shouldAnimateNav = motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve';
  const navGlassFilter = motionRuntime.tier === 'conserve'
    ? 'blur(8px) saturate(125%)'
    : motionRuntime.tier === 'balanced'
      ? 'blur(14px) saturate(155%)'
      : 'blur(24px) saturate(190%)';
  const navGlassShadow = motionRuntime.tier === 'conserve'
    ? '0 8px 24px -12px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.08)'
    : '0 12px 40px -10px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.10)';

  return (
    <nav className="w-full pb-[calc(env(safe-area-inset-bottom)+12px)] pointer-events-auto mx-auto">
      <div className="relative left-[2px] rounded-[9999px]">
        <div
          className="relative overflow-hidden rounded-[9999px]"
          style={{
            background: 'rgba(20,20,20,0.50)',
            WebkitBackdropFilter: navGlassFilter,
            backdropFilter: navGlassFilter,
            boxShadow: navGlassShadow,
            border: 'none',
          }}
        >

          <div className="relative grid h-[54px] grid-cols-4 gap-0 px-[4px] py-1.5">
            <motion.div
              className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 w-[calc((100%_-_0.75rem)/4)] rounded-[9999px] bg-white/[0.15]"
              animate={{ x: `calc(${activeNavIndex} * 100%)` }}
              transition={{ duration: shouldAnimateNav ? 0.24 : 0.01, ease: [0.16, 1, 0.3, 1] }}
            />
            {NAV_ITEMS.map((item, index) => {
              const isActive = index === activeNavIndex;
              const Icon = item.icon;
              const handlePreloadIntent = () => {
                preloadRouteModules(item.path);
              };
              const handleNavigateIntent = () => {
                handlePreloadIntent();
              };

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-label={item.label}
                  onFocus={() => preloadRouteModules(item.path)}
                  onPointerEnter={handlePreloadIntent}
                  onPointerDown={handlePreloadIntent}
                  onTouchStart={handlePreloadIntent}
                  onClick={handleNavigateIntent}
                  className="relative flex flex-col items-center justify-center gap-1 outline-none touch-manipulation select-none"
                >
                  <motion.div
                    key={`${item.path}-${isActive ? navAnimationKey : 'idle'}`}
                    className="relative z-10 flex items-center justify-center"
                    initial={false}
                    animate={{ scale: 1, y: 0 }}
                    whileTap={shouldAnimateNav ? { scale: 0.94 } : undefined}
                    transition={{ duration: shouldAnimateNav ? 0.18 : 0.01, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="relative flex h-7 w-7 items-center justify-center">
                      <NavMotionIcon
                        icon={Icon}
                        isActive={isActive}
                        path={item.path}
                        shouldAnimate={shouldAnimateNav}
                      />
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
});

BottomNavigation.displayName = 'BottomNavigation';

const getTrackArtwork = (track: any) => {
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

const getTrackArtistName = (track: any) => {
  const prioritized = getMainArtistName(track);
  if (prioritized) return prioritized;
  const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : undefined;
  if (typeof firstArtist === 'string') return firstArtist;
  if (firstArtist?.name) return firstArtist.name;
  if (typeof track?.artist === 'string') return track.artist;
  return track?.artist?.name || track?.artistName || 'Artista';
};

const getArtistDisplayName = (artist: any) => {
  if (!artist) return '';
  if (typeof artist === 'string') return artist;
  return artist.name || artist.artistName || artist.displayName || artist.primaryArtistName || '';
};

const getArtistDisplayId = (artist: any) => {
  if (!artist || typeof artist === 'string') return '';
  return String(artist.id || artist.statsfmId || artist.spotifyId || artist.appleMusicId || artist.artistId || '');
};

const getTrackArtists = (track: any) => {
  const rawArtists = Array.isArray(track?.artists) ? track.artists : [];
  const mainArtist = getMainArtist(track);
  const mainArtistId = getArtistDisplayId(mainArtist);
  const mainArtistName = getArtistDisplayName(mainArtist).trim().toLowerCase();
  const normalized = rawArtists
    .map((artist: any, index: number) => {
      if (typeof artist === 'string') {
        return { id: '', name: artist, image: '', key: `${artist}-${index}` };
      }
      const id = String(artist?.id || artist?.statsfmId || artist?.spotifyId || artist?.appleMusicId || '');
      const name = artist?.name || artist?.artistName || artist?.displayName || '';
      const image = artist?.image || artist?.avatar || artist?.artistImage || artist?.picture || '';
      return { id, name, image, key: id || `${name}-${index}` };
    })
    .filter((artist) => artist.name);

  if (normalized.length > 0) {
    const mainIndex = normalized.findIndex((artist) => {
      if (mainArtistId && artist.id === mainArtistId) return true;
      return !!mainArtistName && artist.name.trim().toLowerCase() === mainArtistName;
    });
    if (mainIndex > 0) {
      return [normalized[mainIndex], ...normalized.filter((_, index) => index !== mainIndex)];
    }
    return normalized;
  }

  const fallbackName = getTrackArtistName(track);
  const fallbackId = getMainArtistId(track);
  return fallbackName ? [{ id: fallbackId, name: fallbackName, image: getTrackArtistImage(track), key: fallbackId || fallbackName }] : [];
};

const getTrackArtistImage = (track: any) => {
  const mainArtist = getMainArtist(track);
  const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : undefined;
  return [
    mainArtist?.image,
    mainArtist?.avatar,
    mainArtist?.artistImage,
    firstArtist?.image,
    firstArtist?.avatar,
    firstArtist?.artistImage,
    track?.artist?.image,
    track?.artist?.avatar,
    track?.artistImage,
    track?.primaryArtistImage,
  ].find((url) => typeof url === 'string' && url.trim().length > 5) || '';
};

const getMainArtistId = (track: any) => {
  const mainArtist = getMainArtist(track);
  const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : undefined;
  return String(
    getArtistDisplayId(mainArtist) ||
    firstArtist?.id ||
    firstArtist?.statsfmId ||
    firstArtist?.spotifyId ||
    firstArtist?.appleMusicId ||
    track?.artist?.id ||
    track?.artistId ||
    ''
  );
};

const getAlbumId = (track: any) => String(track?.albumId || track?.album?.id || '');

const getAlbumReleaseDate = (track: any) => {
  const firstAlbum = Array.isArray(track?.albums) ? track.albums[0] : undefined;
  return [
    track?.album?.releaseDate,
    track?.album?.releasedAt,
    track?.album?.release_date,
    track?.album?.date,
    firstAlbum?.releaseDate,
    firstAlbum?.releasedAt,
    firstAlbum?.release_date,
    firstAlbum?.date,
    track?.albumReleaseDate,
    // Último recurso para payloads antigos: a data da faixa não deve sobrepor a do álbum.
    track?.releaseDate,
    track?.releasedAt,
  ].find((value) => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return false;
  }) || '';
};

const firstExternalId = (value: any) => {
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item.trim()) || '';
  return typeof value === 'string' ? value : '';
};

const getTrackLinks = (track: any, statsAppUrl?: string) => {
  const spotifyId = track?.spotifyId || firstExternalId(track?.externalIds?.spotify);
  const appleMusicId = track?.appleMusicId || firstExternalId(track?.externalIds?.appleMusic);
  const statsId = track?.id || track?.statsfmId;
  return [
    statsId && { kind: 'statsfm' as const, label: 'stats.fm', url: `https://stats.fm/track/${statsId}`, appUrl: statsAppUrl },
    spotifyId && { kind: 'spotify' as const, label: 'Spotify', url: `https://open.spotify.com/track/${spotifyId}`, appUrl: `spotify:track:${spotifyId}` },
    appleMusicId && { kind: 'apple' as const, label: 'Apple Music', url: `https://music.apple.com/song/${appleMusicId}`, appUrl: `music://music.apple.com/song/${appleMusicId}` },
  ].filter(Boolean) as Array<{ kind: 'statsfm' | 'spotify' | 'apple' | 'genius'; label: string; url: string; appUrl?: string }>;
};

const formatShortDate = (value: any) => {
  if (!value) return 'sem registro';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'sem registro';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatFullDate = (value: any) => {
  if (!value) return 'sem registro';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'sem registro';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatBadgeDate = (timestamp: string | number) => {
  const time = parseDateMs(timestamp);
  if (!time) return '';
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return '';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (dateStart === todayStart.getTime()) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (dateStart === yesterdayStart.getTime()) return 'ONTEM';

  const currentYear = new Date().getFullYear();
  const year = date.getFullYear();

  const options: Intl.DateTimeFormatOptions = year === currentYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' };

  return date.toLocaleDateString('pt-BR', options).replace(/\sde\s/g, ' ').toUpperCase();
};

const parseDateMs = (value: any) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && /^\d+$/.test(trimmed)) return numeric;
    const parsed = new Date(trimmed).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const getSaoPauloDayKey = (value: any) => {
  const time = parseDateMs(value);
  if (!time) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const getReleaseDateDayKey = (value: any) => {
  const time = parseDateMs(value);
  if (!time) return '';
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return '';
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatAlbumReleaseDate = (value: any) => {
  const releaseDayKey = getReleaseDateDayKey(value);
  if (!releaseDayKey) return '';
  const date = new Date(`${releaseDayKey}T00:00:00.000Z`);
  const currentYear = new Date().getFullYear();
  const releaseYear = Number(releaseDayKey.slice(0, 4)) || date.getUTCFullYear();
  const options: Intl.DateTimeFormatOptions = releaseYear === currentYear
    ? { timeZone: 'UTC', day: 'numeric', month: 'short' }
    : { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('pt-BR', options).replace(/\sde\s/g, ' ').replace('.', '.');
};

const cleanLyricsForDisplay = (lyrics?: string | null) => {
  if (!lyrics) return '';

  const isBracketAnnotation = (line: string) => /^\[[^\]]+\]$/.test(line);
  const isSectionBreakAnnotation = (line: string) => /[A-Za-zÀ-ÿ]/.test(line);
  const isHeaderAnnotation = (line: string) =>
    /^(?:letra\s+de|lyrics?\s+for|lyrics?\s+of|paroles\s+de|letra\s*:)/i.test(line);

  const lines = lyrics
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n');
  const output: string[] = [];
  let hasStarted = false;
  let previousBlank = false;

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/\u200b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const isBracketLine = isBracketAnnotation(line);

    if (isBracketLine) {
      if (hasStarted && isSectionBreakAnnotation(line) && output[output.length - 1] !== '') {
        output.push('');
        previousBlank = true;
      }
      continue;
    }

    if (isHeaderAnnotation(line)) continue;

    if (!line) {
      continue;
    }

    hasStarted = true;
    previousBlank = false;
    output.push(line);
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const getDayKey = (value: any) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const getStreamTime = (item: any) => {
  const value = item?.playedAt || item?.timestamp || item?.endTime || item?.date || item?.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const summarizeTrackHistory = (items: any[], currentTimestamp?: string) => {
  const currentTime = currentTimestamp ? new Date(currentTimestamp).getTime() : 0;
  const history = items
    .filter((item) => {
      const time = getStreamTime(item);
      if (!time) return false;
      if (!currentTime) return true;
      return Math.abs(time - currentTime) > 90_000;
    })
    .sort((a, b) => getStreamTime(a) - getStreamTime(b));
  const years = history.reduce<Record<string, number>>((acc, item) => {
    const year = new Date(getStreamTime(item)).getFullYear();
    if (Number.isFinite(year)) acc[String(year)] = (acc[String(year)] || 0) + 1;
    return acc;
  }, {});
  const bestYear = Object.entries(years).sort((a, b) => b[1] - a[1])[0];
  return {
    firstPlayedAt: history[0] ? getStreamTime(history[0]) : 0,
    lastPlayedAt: history[history.length - 1] ? getStreamTime(history[history.length - 1]) : 0,
    bestYear: bestYear ? bestYear[0] : '',
    bestYearCount: bestYear ? bestYear[1] : 0,
  };
};

const getEarliestStream = (items: any[]) => {
  return items
    .map((item) => getStreamTime(item))
    .filter((time) => time > 0)
    .sort((a, b) => a - b)[0] || 0;
};

const getRecentPlaybackTrack = (user: any) => {
  const recent = Array.isArray(user?.recent)
    ? user.recent
    : Array.isArray(user?.history)
      ? user.history
      : [];
  const latest = recent[0];
  const track = latest?.track || latest;
  if (!track?.name) return null;
  return {
    track,
    isNow: false,
    timestamp: latest?.playedAt || latest?.timestamp || latest?.endTime || latest?.date || user?.nowPlaying?.timestamp,
    platform: latest?.platform || latest?.source || user?.nowPlaying?.platform,
    durationMs: latest?.durationMs || track?.durationMs,
  };
};

const getUserTrackStatsSource = (user: any) => {
  if (!user) return null;
  if (user.nowPlaying?.track?.name) return user;
  const recentPlayback = getRecentPlaybackTrack(user);
  if (!recentPlayback) return user;
  return {
    ...user,
    nowPlaying: recentPlayback,
  };
};

const entryTimestampMs = (value: any) => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const formatPlaybackTimeLabel = (value: any) => {
  const time = entryTimestampMs(value);
  if (!time) return 'Recente';

  const date = new Date(time);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const timeLabel = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (dateStart === todayStart) return timeLabel;
  if (dateStart === todayStart - 24 * 60 * 60 * 1000) return `ontem, ${timeLabel}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${timeLabel}`;
};

const getPlaybackHistoryEntries = (user: any) => {
  const source = Array.isArray(user?.recent)
    ? user.recent
    : Array.isArray(user?.history)
      ? user.history
      : [];
  return source
    .map((item: any) => {
      const track = item?.track || item;
      if (!track?.name) return null;
      return {
        track,
        timestamp: item?.playedAt || item?.timestamp || item?.endTime || item?.date || item?.createdAt,
        platform: item?.platform || item?.source || user?.nowPlaying?.platform,
        durationMs: item?.durationMs || track?.durationMs,
      };
    })
    .filter(Boolean) as Array<{ track: any; timestamp?: any; platform?: any; durationMs?: any }>;
};

type TrackLink = ReturnType<typeof getTrackLinks>[number];

type BottomTrackStatsPanelData = {
  entityStats: { artist: number; track: number; album: number };
  artistStats: Array<{ id: string; name: string; image: string; key: string; count: number }>;
  circleFirstListen: { user: any; playedAt: number } | null;
  circleFirstListeners: Array<{ user: any; playedAt: number }>;
  hasFriendHistory: boolean;
  trackHistory: { firstPlayedAt: number; lastPlayedAt: number; bestYear: string; bestYearCount: number };
};

type BottomTrackStatsHydrationState = {
  metrics: boolean;
  artistStats: boolean;
  history: boolean;
  social: boolean;
};

type BottomTrackStatsPanelSnapshot = {
  data: BottomTrackStatsPanelData;
  hydration: BottomTrackStatsHydrationState;
};

type BottomTrackDragStart = { x: number; y: number; fromScroll?: boolean };
type BottomTrackExternalPlayback = {
  userId?: string;
  track: any;
  timestamp?: any;
  platform?: any;
  durationMs?: any;
  progressMs?: any;
  isLive?: boolean;
};
type BottomTrackOpenDetail = {
  panel?: 'stats' | 'lyrics';
  userId?: string;
  track?: any;
  playback?: any;
};

const emptyBottomTrackStatsPanelData: BottomTrackStatsPanelData = {
  entityStats: { artist: 0, track: 0, album: 0 },
  artistStats: [],
  circleFirstListen: null,
  circleFirstListeners: [],
  hasFriendHistory: false,
  trackHistory: { firstPlayedAt: 0, lastPlayedAt: 0, bestYear: '', bestYearCount: 0 },
};

const emptyBottomTrackStatsHydration: BottomTrackStatsHydrationState = {
  metrics: false,
  artistStats: false,
  history: false,
  social: false,
};

const createInitialBottomTrackStatsPanelData = (knownTrackCount?: number): BottomTrackStatsPanelData => ({
  ...emptyBottomTrackStatsPanelData,
  entityStats: {
    artist: 0,
    track: typeof knownTrackCount === 'number' ? knownTrackCount : 0,
    album: 0,
  },
});

const createPreloadedBottomTrackStatsPanelData = (knownTrackCount?: number, activePlayback?: any): BottomTrackStatsPanelData => {
  const timestamp = activePlayback?.timestamp;
  const playedAt = timestamp ? entryTimestampMs(timestamp) : 0;

  return {
    entityStats: {
      artist: 0,
      track: typeof knownTrackCount === 'number' ? knownTrackCount : 0,
      album: 0,
    },
    artistStats: [],
    circleFirstListen: null,
    circleFirstListeners: [],
    hasFriendHistory: false,
    trackHistory: {
      firstPlayedAt: playedAt,
      lastPlayedAt: playedAt,
      bestYear: '',
      bestYearCount: 0,
    },
  };
};

const BOTTOM_TRACK_STATS_CACHE_TTL = 15 * 60 * 1000;
const bottomTrackStatsCache = new Map<string, { expiresAt: number; data: BottomTrackStatsPanelSnapshot }>();
const bottomTrackStatsInFlight = new Map<string, Promise<BottomTrackStatsPanelSnapshot>>();
const bottomTrackStatsFastInFlight = new Map<string, Promise<BottomTrackStatsPanelSnapshot>>();
const lyricsMatchCache = new Map<string, { expiresAt: number; data: LyricsMatch }>();
const lyricsFullCache = new Map<string, { expiresAt: number; data: LyricsFullResponse }>();
const lyricsInFlight = new Map<string, Promise<LyricsMatch | LyricsFullResponse>>();

const readBottomTrackSessionCache = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > BOTTOM_TRACK_STATS_CACHE_TTL) return null;
    return parsed.value as T;
  } catch {
    return null;
  }
};

const writeBottomTrackSessionCache = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {}
};

const normalizeBottomTrackRecentItems = (items: any[]) => items
  .map(statsService.normalizeRecentStream)
  .filter((item: any) => item?.track?.name);

const getLyricsCacheKey = (trackName: string, artistName: string) => `${trackName.trim().toLowerCase()}::${artistName.trim().toLowerCase()}`;

const readExpiringCache = <T,>(cache: Map<string, { expiresAt: number; data: T }>, key: string) => {
  const cached = readRuntimeCacheEntry(cache, key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.data;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  if (typeof window === 'undefined') return promise.catch(() => fallback);
  let timeoutId = 0;
  try {
    return await Promise.race([
      promise.catch(() => fallback),
      new Promise<T>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const runLimited = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
};

const loadLyricsMatch = (trackName: string, artistName: string) => {
  const key = getLyricsCacheKey(trackName, artistName);
  const cached = readExpiringCache(lyricsMatchCache, key);
  if (cached) return Promise.resolve(cached);

  const inFlightKey = `match:${key}`;
  const running = readRuntimeCacheEntry(lyricsInFlight, inFlightKey);
  if (running) return running as Promise<LyricsMatch>;

  const promise = statsService.fetchLyricsMatch(trackName, artistName)
    .then((match) => {
      setRuntimeCacheEntry(lyricsMatchCache, key, { data: match, expiresAt: Date.now() + BOTTOM_TRACK_STATS_CACHE_TTL }, 'medium');
      return match;
    })
    .finally(() => lyricsInFlight.delete(inFlightKey));
  setRuntimeCacheEntry(lyricsInFlight, inFlightKey, promise, 'small');
  return promise;
};

const loadLyricsFull = (trackName: string, artistName: string) => {
  const key = getLyricsCacheKey(trackName, artistName);
  const cached = readExpiringCache(lyricsFullCache, key);
  if (cached) return Promise.resolve(cached);

  const inFlightKey = `full:${key}`;
  const running = readRuntimeCacheEntry(lyricsInFlight, inFlightKey);
  if (running) return running as Promise<LyricsFullResponse>;

  const promise = statsService.fetchLyricsFull(trackName, artistName)
    .then((response) => {
      setRuntimeCacheEntry(lyricsFullCache, key, { data: response, expiresAt: Date.now() + BOTTOM_TRACK_STATS_CACHE_TTL }, 'small');
      setRuntimeCacheEntry(lyricsMatchCache, key, { data: response, expiresAt: Date.now() + BOTTOM_TRACK_STATS_CACHE_TTL }, 'medium');
      return response;
    })
    .finally(() => lyricsInFlight.delete(inFlightKey));
  setRuntimeCacheEntry(lyricsInFlight, inFlightKey, promise, 'small');
  return promise;
};

const getBottomTrackStatsCacheKey = (
  userId: string,
  trackId: string,
  albumId: string,
  artistIds: string,
  memberIds: string,
) => `${userId}:${trackId}:${albumId}:${artistIds}:${memberIds}`;

const getBottomTrackStatsLookupKey = (
  user: any,
  trackId: string,
  albumId: string,
  trackArtists: Array<{ id: string }>,
  members: any[],
) => getBottomTrackStatsCacheKey(
  user?.id || '',
  trackId,
  albumId,
  trackArtists.map((artist) => artist.id).filter(Boolean).sort().join('|'),
  members.map((member) => member.id).filter(Boolean).sort().join('|'),
);

const loadBottomTrackStatsPanelData = async ({
  user,
  trackId,
  albumId,
  trackArtists,
  members,
  currentTimestamp,
  knownTrackCount,
  mode = 'full',
}: {
  user: any;
  trackId: string;
  albumId: string;
  trackArtists: Array<{ id: string; name: string; image: string; key: string }>;
  members: any[];
  currentTimestamp?: any;
  knownTrackCount?: number;
  mode?: 'fast' | 'full';
}): Promise<BottomTrackStatsPanelSnapshot> => {
  const cacheKey = getBottomTrackStatsLookupKey(user, trackId, albumId, trackArtists, members);
  const cached = readExpiringCache(bottomTrackStatsCache, cacheKey);
  if (cached && (mode === 'fast' || cached.hydration.social)) return cached;

  const inFlightMap = mode === 'fast' ? bottomTrackStatsFastInFlight : bottomTrackStatsInFlight;
  const running = readRuntimeCacheEntry(inFlightMap, cacheKey);
  if (running) return running;

  const promise = (async () => {
    const artistsToFetch = trackArtists.filter((artist) => artist.id);
    const [artistCounts, trackCount, album, history] = await Promise.all([
      Promise.all(artistsToFetch.map((artist) =>
        withTimeout(statsService.fetchEntityStats(user.id, 'artist', artist.id), mode === 'fast' ? 1200 : 2200, 0)
      )),
      typeof knownTrackCount === 'number'
        ? Promise.resolve(knownTrackCount)
        : withTimeout(statsService.fetchEntityStats(user.id, 'track', trackId), mode === 'fast' ? 1200 : 2200, 0),
      albumId ? withTimeout(statsService.fetchEntityStats(user.id, 'album', albumId), mode === 'fast' ? 1200 : 2200, 0) : Promise.resolve(0),
      withTimeout(statsService.fetchEntityStreams(user.id, 'track', trackId, 240), mode === 'fast' ? 1400 : 2800, []),
    ]);
    const memberHistories = mode === 'fast'
      ? []
      : await runLimited(
        members.filter((member) => member.id !== user.id),
        3,
        (member) =>
        withTimeout(
          statsService.fetchEntityStreams(member.id, 'track', trackId, 80)
            .then((items) => ({ member, items })),
          1800,
          { member, items: [] }
        )
      );
    const nextArtistStats = artistsToFetch.map((artist, index) => ({
      ...artist,
      count: artistCounts[index] || 0,
    }));
    const primaryArtistCount = nextArtistStats[0]?.count || 0;
    const ownEntry = { member: user, playedAt: getEarliestStream(history), hasItems: history.length > 0 };
    const friendEntries = [
      ownEntry,
      ...memberHistories.map(({ member, items }) => {
        return { member, playedAt: getEarliestStream(items), hasItems: items.length > 0 };
      }),
    ]
      .filter((entry) => entry.playedAt > 0)
      .sort((a, b) => a.playedAt - b.playedAt);
    const friendsWithHistory = friendEntries.filter((entry) => entry.member.id !== user.id);
    const firstEntry = friendEntries[0];
    const firstDayEntries = firstEntry
      ? friendEntries.filter((entry) => getDayKey(entry.playedAt) === getDayKey(firstEntry.playedAt))
      : [];

    const data: BottomTrackStatsPanelData = {
      artistStats: nextArtistStats,
      entityStats: { artist: primaryArtistCount, track: trackCount, album },
      trackHistory: summarizeTrackHistory(history, currentTimestamp || user?.nowPlaying?.timestamp),
      circleFirstListen: friendsWithHistory.length > 0 && firstEntry
        ? { user: firstEntry.member, playedAt: firstEntry.playedAt }
        : null,
      circleFirstListeners: friendsWithHistory.length > 0
        ? firstDayEntries.map((entry) => ({ user: entry.member, playedAt: entry.playedAt }))
        : [],
      hasFriendHistory: friendsWithHistory.length > 0,
    };
    const snapshot: BottomTrackStatsPanelSnapshot = {
      data,
      hydration: {
        metrics: true,
        artistStats: true,
        history: true,
        social: mode === 'full',
      },
    };
    const existing = readRuntimeCacheEntry(bottomTrackStatsCache, cacheKey);
    if (mode === 'full' || !existing || !existing.data.hydration.social) {
      setRuntimeCacheEntry(bottomTrackStatsCache, cacheKey, { data: snapshot, expiresAt: Date.now() + BOTTOM_TRACK_STATS_CACHE_TTL }, 'small');
    }
    return snapshot;
  })().finally(() => inFlightMap.delete(cacheKey));

  setRuntimeCacheEntry(inFlightMap, cacheKey, promise, 'small');
  return promise;
};

const ArtistNamesInline = ({ artists, fallback }: { artists: Array<{ name: string }>; fallback: string }) => {
  const names = artists.map((artist) => artist.name).filter(Boolean);
  const displayNames = names.length > 0 ? names : [fallback].filter(Boolean);

  return (
    <>
      {displayNames.map((name, index) => {
        const isLast = index === displayNames.length - 1;
        const separator = index === 0
          ? ''
          : isLast
            ? ' & '
            : ', ';

        return (
          <React.Fragment key={`${name}-${index}`}>
            {separator && <span className="text-orange-300/72">{separator}</span>}
            <span>{name}</span>
          </React.Fragment>
        );
      })}
    </>
  );
};

const TrackTitleBadges = ({ badges, className }: { badges: string[]; className?: string }) => {
  if (badges.length === 0) return null;
  return (
    <div className={clsx("flex max-w-[128px] shrink-0 flex-col items-start justify-start gap-px", className)}>
      {badges.map((badge, index) => (
        <span
          key={badge}
          className="rounded-full px-1.5 py-[3px] text-left text-[6px] font-black uppercase leading-none tracking-[0.11em] text-white/72 backdrop-blur-md"
          style={{ backgroundColor: index === 0 ? 'rgba(255,255,255,0.062)' : 'rgba(255,255,255,0.036)' }}
        >
          {badge}
        </span>
      ))}
    </div>
  );
};

const ModalScrollingAlbumName = ({ albumName }: { albumName: string }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const measureRef = React.useRef<HTMLSpanElement | null>(null);
  const [scrollDistance, setScrollDistance] = React.useState(0);
  const shouldScroll = scrollDistance > 0;
  const {
    ref: marqueeMotionRef,
    shouldRunAmbientMotion,
  } = useViewportMotionGate<HTMLSpanElement>({ rootMargin: '120px' });
  const shouldRunMarquee = shouldScroll && shouldRunAmbientMotion;
  useCompositorLoopTelemetry(shouldRunMarquee, 'marquee');

  React.useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const text = measureRef.current;
      if (!container || !text) return;
      const overflow = text.scrollWidth - container.clientWidth;
      setScrollDistance(overflow > 2 ? text.scrollWidth + 24 : 0);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [albumName]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative block min-w-0 overflow-hidden text-left",
        shouldScroll && "[mask-image:linear-gradient(90deg,black_0%,black_85%,transparent_100%)]"
      )}
      title={albumName}
    >
      {shouldScroll ? (
        <span
          ref={marqueeMotionRef}
          className="stats-lc-engine-loop stats-lc-track-marquee flex w-max whitespace-nowrap text-[10px] font-black uppercase leading-tight tracking-[0.05em] text-white/28"
          data-active={shouldRunMarquee ? 'true' : 'false'}
          style={{
            '--track-title-distance': `${scrollDistance}px`,
            '--track-title-duration': `${Math.min(15, Math.max(6, albumName.length * 0.28))}s`,
          } as React.CSSProperties}
        >
          <span className="pr-6">{albumName}</span>
          <span className="pr-6" aria-hidden="true">{albumName}</span>
        </span>
      ) : (
        <span className="block whitespace-nowrap text-[10px] font-black uppercase leading-tight tracking-[0.05em] text-white/28">{albumName}</span>
      )}
      <span
        ref={measureRef}
        className="pointer-events-none absolute -z-10 whitespace-nowrap text-[10px] font-black uppercase leading-tight tracking-[0.05em] opacity-0"
        aria-hidden="true"
      >
        {albumName}
      </span>
    </div>
  );
};

const ModalScrollingTrackTitle = ({ title, wide = false }: { title: string; wide?: boolean }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const measureRef = React.useRef<HTMLSpanElement | null>(null);
  const [scrollDistance, setScrollDistance] = React.useState(0);
  const shouldScroll = scrollDistance > 0;
  const {
    ref: marqueeMotionRef,
    shouldRunAmbientMotion,
  } = useViewportMotionGate<HTMLSpanElement>({ rootMargin: '120px' });
  const shouldRunMarquee = shouldScroll && shouldRunAmbientMotion;
  useCompositorLoopTelemetry(shouldRunMarquee, 'marquee');

  React.useEffect(() => {
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
    <div
      ref={containerRef}
      className={clsx(
        "relative block min-w-0 shrink overflow-hidden text-left",
        wide ? "max-w-[250px]" : "max-w-[170px]",
        shouldScroll && "[mask-image:linear-gradient(90deg,black_0%,black_78%,transparent_100%)]"
      )}
      title={title}
    >
      {shouldScroll ? (
        <span
          ref={marqueeMotionRef}
          className="stats-lc-engine-loop stats-lc-track-marquee flex w-max whitespace-nowrap text-[22px] font-black leading-[1.02] text-white"
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
        <span className="block whitespace-nowrap text-[22px] font-black leading-[1.02] text-white">{title}</span>
      )}
      <span
        ref={measureRef}
        className="pointer-events-none absolute -z-10 whitespace-nowrap text-[22px] font-black leading-[1.02] opacity-0"
        aria-hidden="true"
      >
        {title}
      </span>
    </div>
  );
};

const TrackLinkIconButton = ({ link, onChoose }: { link: TrackLink; onChoose: (link: TrackLink, button: HTMLButtonElement) => void }) => {
  const icon = link.kind === 'statsfm'
    ? <StatsFmMark className="h-4 w-4 text-current" />
    : link.kind === 'spotify'
      ? <SpotifyMark className="h-4 w-4 text-current" />
      : link.kind === 'apple'
        ? <AppleMark className="h-4 w-4 text-current" />
        : <GeniusLogo className="h-4 w-4 text-current" />;

  return (
    <button
      type="button"
      onClick={(event) => onChoose(link, event.currentTarget)}
      aria-label={`Opções do ${link.label}`}
      className="stats-lc-soft-white-glass flex h-10 w-10 items-center justify-center rounded-full border-0 text-white/72 transition-transform active:scale-95"
    >
      {icon}
    </button>
  );
};

const ModalMetricValue = ({
  fallbackValue,
  ready,
  value,
}: {
  fallbackValue?: number;
  ready: boolean;
  value: number;
}) => {
  const displayValue = ready ? value : fallbackValue;
  if (typeof displayValue === 'number') return <AnimatedNumber value={displayValue} />;
  return <SkeletonSurface as="span" className="block h-5 w-12 rounded-full bg-white/[0.045]" />;
};

const ModalSkeleton = ({ className = "" }: { className?: string }) => (
  <SkeletonSurface as="span" className={clsx("block rounded-full bg-white/[0.045]", className)} />
);

const BottomTrackStatsBubble = React.memo(({ user }: { user: any }) => {
  const groupStats = useStatsStore(state => state.groupStats);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const userTrackStats = useStatsStore(state => state.userTrackStats);
  const fetchTrackStatsForAll = useStatsStore(state => state.fetchTrackStatsForAll);
  const getHistoryCache = useStatsStore(state => state.getHistoryCache);
  const setHistoryCache = useStatsStore(state => state.setHistoryCache);
  const motionRuntime = useMotionRuntime();

  const MemoizedSocialAvatar = React.useMemo(() => React.memo<{ entry: any; index: number; total: number }>(
    ({ entry, index, total }) => {
      const entryUserId = entry.user?.id || user?.id || `social-${index}`;
      const avatarUrl = React.useMemo(
        () => coreUtils.getUserAvatar(entry.user?.id || user?.id, entry.user?.avatar || user?.avatar),
        [entry.user?.id, entry.user?.avatar]
      );

      return (
        <div
          key={`${entryUserId}-${entry.playedAt}`}
          className="-mr-1.5 h-[29px] w-[29px] shrink-0 overflow-hidden rounded-full bg-white/[0.055] ring-0 shadow-[0_4px_10px_rgba(0,0,0,0.24)]"
          style={{ zIndex: total - index }}
        >
          <SmartImage
            src={avatarUrl}
            cacheKey={`bottom-track-social-avatar:${entryUserId}`}
            className="h-full w-full object-cover"
            rounded="full"
            fallback=""
          />
        </div>
      );
    },
    (prev, next) =>
      prev.entry.user?.id === next.entry.user?.id &&
      prev.entry.user?.avatar === next.entry.user?.avatar &&
      prev.entry.playedAt === next.entry.playedAt &&
      prev.index === next.index
  ), [user]);

  const [isOpen, setIsOpen] = React.useState(false);
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = React.useState(false);
  const [isLyricsClosing, setIsLyricsClosing] = React.useState(false);
  const [isStandaloneLyrics, setIsStandaloneLyrics] = React.useState(false);
  const [isAnimationDone, setIsAnimationDone] = React.useState(false);
  const [isLyricsAnimationDone, setIsLyricsAnimationDone] = React.useState(false);
  useModalMotionScope(isOpen);

  React.useEffect(() => {
    if (!isLyricsOpen) {
      setIsLyricsAnimationDone(false);
    }
  }, [isLyricsOpen]);

  const modalRef = React.useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();
  const [lyricsMatch, setLyricsMatch] = React.useState<LyricsMatch | null>(null);
  const [lyricsText, setLyricsText] = React.useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = React.useState(false);
  const [panel, setPanel] = React.useState<'stats' | 'lyrics'>('stats');
  const [selectedTrackLink, setSelectedTrackLink] = React.useState<TrackLink | null>(null);
  const [trackLinkSheetAnchor, setTrackLinkSheetAnchor] = React.useState({ right: 16, bottom: 16 });
  const [toastMessage, setToastMessage] = React.useState('');
  const cancelToastDismissRef = React.useRef<() => void>(() => {});
  const [panelData, setPanelData] = React.useState<BottomTrackStatsPanelData>(emptyBottomTrackStatsPanelData);
  const [panelHydration, setPanelHydration] = React.useState<BottomTrackStatsHydrationState>(emptyBottomTrackStatsHydration);
  const [playbackIndex, setPlaybackIndex] = React.useState(0);
  const [recentPickerOpen, setRecentPickerOpen] = React.useState(false);
  const [resolvedOwnRecent, setResolvedOwnRecent] = React.useState<any[]>([]);
  const [externalPlayback, setExternalPlayback] = React.useState<BottomTrackExternalPlayback | null>(null);
  const modalPointerStartRef = React.useRef<BottomTrackDragStart | null>(null);
  const lyricsPointerStartRef = React.useRef<BottomTrackDragStart | null>(null);
  const lyricsScrollRef = React.useRef<HTMLDivElement | null>(null);
  const historySwipeX = useMotionValue(0);
  const historySwipeTokenRef = React.useRef(0);
  const ignoreBackdropClickUntilRef = React.useRef(0);
  const panelDataKeyRef = React.useRef('');
  const panelRequestKeyRef = React.useRef('');
  const lyricsRequestKeyRef = React.useRef('');
  const modalOpenTokenRef = React.useRef(0);
  const modalOpenedAtRef = React.useRef(Date.now());
  const cancelLyricsMaskTaskRef = React.useRef<() => void>(() => {});
  const cancelCloseModalTaskRef = React.useRef<() => void>(() => {});
  const cancelCloseLyricsTaskRef = React.useRef<() => void>(() => {});

  React.useEffect(() => () => {
    cancelLyricsMaskTaskRef.current();
    cancelCloseModalTaskRef.current();
    cancelToastDismissRef.current();
  }, []);

  const members = React.useMemo(() => getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId), [groupStats, liveNowPlayingByUserId]);
  const panelUser = React.useMemo(() => {
    if (!externalPlayback?.userId) return user;
    return members.find((member) => member.id === externalPlayback.userId) || user;
  }, [externalPlayback?.userId, members, user]);
  const panelUserId = panelUser?.id;
  React.useEffect(() => {
    setResolvedOwnRecent([]);
  }, [panelUserId]);
  const ownRecentCandidates = React.useMemo(() => {
    if (!panelUser?.id) return [];
    const directRecent = normalizeBottomTrackRecentItems(panelUser?.recent || (panelUser as any)?.history || []);
    const cachedRecent = normalizeBottomTrackRecentItems(getHistoryCache(panelUser.id) || []);
    const sessionRecent = normalizeBottomTrackRecentItems(readBottomTrackSessionCache<any[]>(`stats-lc-home-recent:${panelUser.id}`) || []);
    return [resolvedOwnRecent, cachedRecent, sessionRecent, directRecent]
      .sort((a, b) => b.length - a.length)[0]
      .slice(0, 20);
  }, [getHistoryCache, panelUser, resolvedOwnRecent]);
  const playbackHistory = React.useMemo(() => {
    const seen = new Set<string>();
    return getPlaybackHistoryEntries({ ...panelUser, recent: ownRecentCandidates })
      .filter((entry) => {
        const key = `${entry.track?.id || entry.track?.name}:${entry.timestamp || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => entryTimestampMs(b.timestamp) - entryTimestampMs(a.timestamp))
      .slice(0, 12);
  }, [ownRecentCandidates, panelUser]);
  const liveTrack = panelUser?.nowPlaying?.track;
  const getPlaybackMatchKey = React.useCallback((playback: { track?: any; timestamp?: any } | null | undefined) => {
    const playbackTrack = playback?.track;
    const trackKey = String(playbackTrack?.id || playbackTrack?.track?.id || playbackTrack?.name || '')
      .trim()
      .toLowerCase();
    if (!trackKey) return '';
    const timestamp = entryTimestampMs(playback?.timestamp);
    return timestamp > 0 ? `${trackKey}:${timestamp}` : trackKey;
  }, []);
  const isSamePlayback = React.useCallback((left: { track?: any; timestamp?: any } | null | undefined, right: { track?: any; timestamp?: any } | null | undefined) => {
    const leftKey = getPlaybackMatchKey(left);
    const rightKey = getPlaybackMatchKey(right);
    if (!leftKey || !rightKey) return false;
    if (leftKey === rightKey) return true;

    const leftTrack = String(left?.track?.id || left?.track?.track?.id || left?.track?.name || '').trim().toLowerCase();
    const rightTrack = String(right?.track?.id || right?.track?.track?.id || right?.track?.name || '').trim().toLowerCase();
    const leftTime = entryTimestampMs(left?.timestamp);
    const rightTime = entryTimestampMs(right?.timestamp);
    if (!leftTrack || leftTrack !== rightTrack) return false;
    if (leftTime > 0 && rightTime > 0) return Math.abs(leftTime - rightTime) <= 1000;
    return true;
  }, [getPlaybackMatchKey]);
  const livePlayback = React.useMemo(() => {
    if (!liveTrack) return null;
    return {
      track: liveTrack,
      timestamp: panelUser?.nowPlaying?.timestamp,
      platform: panelUser?.nowPlaying?.platform,
      durationMs: panelUser?.nowPlaying?.durationMs || liveTrack?.durationMs,
    };
  }, [liveTrack, panelUser?.nowPlaying?.durationMs, panelUser?.nowPlaying?.platform, panelUser?.nowPlaying?.timestamp]);
  const visiblePlaybackHistory = React.useMemo(() => {
    return playbackHistory
      .map((entry, index) => ({ entry, index: index + 1 }))
      .filter(({ entry, index }) => index !== 1 || !livePlayback || !isSamePlayback(livePlayback, entry));
  }, [isSamePlayback, livePlayback, playbackHistory]);
  const visiblePlaybackIndexes = React.useMemo(() => [0, ...visiblePlaybackHistory.map(item => item.index)], [visiblePlaybackHistory]);
  const getAdjacentPlaybackIndex = React.useCallback((direction: 'older' | 'newer') => {
    if (direction === 'older') {
      return visiblePlaybackIndexes.find(index => index > playbackIndex) ?? playbackIndex;
    }

    const reversed = [...visiblePlaybackIndexes].reverse();
    return reversed.find(index => index < playbackIndex) ?? playbackIndex;
  }, [playbackIndex, visiblePlaybackIndexes]);
  const olderPlaybackIndex = getAdjacentPlaybackIndex('older');
  const newerPlaybackIndex = getAdjacentPlaybackIndex('newer');
  const activePlayback = React.useMemo(() => {
    if (externalPlayback?.track?.name) {
      return externalPlayback;
    }
    if (playbackIndex <= 0 || playbackHistory.length === 0) {
      return livePlayback;
    }
    return playbackHistory[Math.min(playbackIndex - 1, playbackHistory.length - 1)] || null;
  }, [externalPlayback, livePlayback, playbackHistory, playbackIndex]);

  // Bubble always shows current track (index 0), independent of modal navigation
  const bubblePlayback = React.useMemo(() => {
    if (externalPlayback?.track?.name) {
      return externalPlayback;
    }
    return livePlayback;
  }, [externalPlayback, livePlayback]);
  const hasExternalPlayback = !!externalPlayback?.track?.name;
  const activePlaybackLabel = hasExternalPlayback
    ? formatPlaybackTimeLabel(activePlayback?.timestamp)
    : playbackIndex > 0
      ? formatPlaybackTimeLabel(activePlayback?.timestamp)
      : '';
  const recentPickerItems = React.useMemo(() => {
    const current = liveTrack
      ? [{
        index: 0,
        label: panelUser?.nowPlaying?.isNow === true ? 'Ao vivo' : 'Atual',
        title: liveTrack.name || 'Música',
        artist: getTrackArtistName(liveTrack),
        image: getTrackArtwork(liveTrack),
        timestamp: panelUser?.nowPlaying?.timestamp,
      }]
      : [];
    const history = visiblePlaybackHistory.map(({ entry, index }) => ({
      index,
      label: formatPlaybackTimeLabel(entry.timestamp),
      title: entry.track?.name || 'Música',
      artist: getTrackArtistName(entry.track),
      image: getTrackArtwork(entry.track),
      timestamp: entry.timestamp,
    }));
    return [...current, ...history];
  }, [liveTrack, panelUser?.nowPlaying?.isNow, panelUser?.nowPlaying?.timestamp, visiblePlaybackHistory]);
  const invalidateLyricsForPlaybackChange = React.useCallback(() => {
    lyricsRequestKeyRef.current = `invalidated:${Date.now()}`;
    setLyricsMatch(null);
    setLyricsText(null);
    setLyricsLoading(false);
  }, []);
  const selectPlaybackChoice = React.useCallback((index: number) => {
    if (index === playbackIndex) {
      setRecentPickerOpen(false);
      animateMotion(historySwipeX, 0, { duration: 0.16, ease: [0.16, 1, 0.3, 1] });
      return;
    }
    invalidateLyricsForPlaybackChange();
    setPlaybackIndex(index);
    setPanel('stats');
    setRecentPickerOpen(false);
    historySwipeTokenRef.current += 1;
    historySwipeX.set(index > playbackIndex ? 52 : -52);
    animateMotion(historySwipeX, 0, { duration: 0.2, ease: [0.16, 1, 0.3, 1] });
  }, [historySwipeX, invalidateLyricsForPlaybackChange, playbackIndex]);
  const animateHistorySwipe = React.useCallback((direction: 'older' | 'newer') => {
    const nextIndex = getAdjacentPlaybackIndex(direction);

    if (nextIndex === playbackIndex) {
      animateMotion(historySwipeX, 0, { duration: 0.16, ease: [0.16, 1, 0.3, 1] });
      return;
    }

    const exitX = direction === 'older' ? 190 : -190;
    const token = historySwipeTokenRef.current + 1;
    historySwipeTokenRef.current = token;
    animateMotion(historySwipeX, exitX, {
      duration: 0.16,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => {
        if (historySwipeTokenRef.current !== token) return;
        invalidateLyricsForPlaybackChange();
        setPlaybackIndex(nextIndex);
        setPanel('stats');
        historySwipeX.set(direction === 'older' ? -46 : 46);
        animateMotion(historySwipeX, 0, { duration: 0.2, ease: [0.16, 1, 0.3, 1] });
      },
    });
  }, [getAdjacentPlaybackIndex, historySwipeX, invalidateLyricsForPlaybackChange, playbackIndex]);

  // Modal content uses activePlayback (can navigate history)
  const track = activePlayback?.track;
  const trackId = String(track?.id || track?.track?.id || '');
  const artistId = getMainArtistId(track);
  const albumId = getAlbumId(track);
  const trackTitle = track?.name || 'Música';
  const parsedTrackTitle = React.useMemo(() => parseTrackTitleBadges(trackTitle), [trackTitle]);
  const artistName = getTrackArtistName(track);

  // Bubble display always uses current track (index 0)
  const bubbleTrack = bubblePlayback?.track;
  const bubbleTrackId = String(bubbleTrack?.id || bubbleTrack?.track?.id || '');
  const bubbleTrackTitle = bubbleTrack?.name || 'Música';
  const bubbleParsedTrackTitle = React.useMemo(() => parseTrackTitleBadges(bubbleTrackTitle), [bubbleTrackTitle]);
  const bubbleArtistName = getTrackArtistName(bubbleTrack);
  const bubbleArtwork = getTrackArtwork(bubbleTrack);
  const trackArtists = React.useMemo(() => getTrackArtists(track), [track]);
  const artwork = getTrackArtwork(track);
  const artistImage = trackArtists[0]?.image || getTrackArtistImage(track) || artwork;
  const albumName = track?.albumName || track?.album?.name || 'Álbum';
  const dominantColor = panelUser?.nowPlaying?.dominantColor || track?.dominantColor || '#ff5f00';

  // Bubble-specific data (always current track)
  const bubbleTrackArtists = React.useMemo(() => getTrackArtists(bubbleTrack), [bubbleTrack]);
  const bubbleArtistImage = bubbleTrackArtists[0]?.image || getTrackArtistImage(bubbleTrack) || bubbleArtwork;
  const bubbleDominantColor = panelUser?.nowPlaying?.dominantColor || bubbleTrack?.dominantColor || '#ff5f00';

  const albumReleaseRawDate = React.useMemo(() => getAlbumReleaseDate(track), [track]);
  const albumReleaseDate = React.useMemo(() => formatAlbumReleaseDate(albumReleaseRawDate), [albumReleaseRawDate]);
  const isBubbleLive = panelUser?.nowPlaying?.isNow === true && playbackIndex === 0 && !hasExternalPlayback;
  const shouldRunBubbleMotion = !isModalVisible && motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve';
  const shouldAnimateBubble = isBubbleLive && shouldRunBubbleMotion;
  const shouldPulseIdleBubble = !isBubbleLive && shouldRunBubbleMotion;
  const bubbleAccentColor = bubbleDominantColor || '#ff5f00';
  const bubbleGlassFilter = motionRuntime.tier === 'conserve'
    ? 'blur(8px) saturate(125%)'
    : motionRuntime.tier === 'balanced'
      ? 'blur(14px) saturate(155%)'
      : 'blur(24px) saturate(190%)';
  const bubbleGlassShadow = motionRuntime.tier === 'conserve'
    ? '0 8px 24px -12px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.08)'
    : '0 12px 38px -14px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.10)';
  const isAppleMusicUser = panelUser?.platform?.primary === 'appleMusic' || panelUser?.platform === 'appleMusic' || panelUser?.nowPlaying?.platform === 'appleMusic';
  const statsAppUrl = isAppleMusicUser && trackId ? `statsam://track/${trackId}` : undefined;
  const trackLinks = React.useMemo(() => getTrackLinks(track, statsAppUrl), [track, statsAppUrl]);
  const shouldReserveGeniusLink = !!track?.name && lyricsMatch?.hasLyrics !== false;
  const currentLyricsRequestKey = React.useMemo(() => {
    if (!track?.name) return '';
    return `${trackId || 'track'}:${getLyricsCacheKey(track.name, artistName)}:${activePlayback?.timestamp || ''}`;
  }, [activePlayback?.timestamp, artistName, track?.name, trackId]);
  const chooseTrackLink = React.useCallback((link: TrackLink, button: HTMLButtonElement) => {
    const modal = button.closest('.bottom-track-stats-modal');
    if (modal) {
      const modalRect = modal.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      setTrackLinkSheetAnchor({
        right: modalRect.right - buttonRect.left,
        bottom: modalRect.bottom - buttonRect.top + 4,
      });
    }
    setSelectedTrackLink(link);
  }, []);
  const membersSignature = React.useMemo(() => members.map((member) => member.id).filter(Boolean).sort().join('|'), [members]);
  const trackArtistsSignature = React.useMemo(() => trackArtists.map((artist) => artist.id || artist.name).filter(Boolean).sort().join('|'), [trackArtists]);
  const panelCacheKey = React.useMemo(
    () => getBottomTrackStatsLookupKey(panelUser, trackId, albumId, trackArtists, members),
    [albumId, membersSignature, panelUserId, trackArtistsSignature, trackId]
  );
  const knownUserTrackCount = userTrackStats[`${panelUserId}:${trackId}`];
  const hasHydratedTrackRanking = React.useMemo(() => {
    if (!trackId || members.length === 0) return false;
    return members.every((member) => Object.prototype.hasOwnProperty.call(userTrackStats, `${member.id}:${trackId}`));
  }, [members, trackId, userTrackStats]);
  const { entityStats, artistStats, circleFirstListen, circleFirstListeners, hasFriendHistory, trackHistory } = panelData;
  const isReleaseDayFirstListen = React.useMemo(() => {
    if (!albumReleaseRawDate || !circleFirstListen?.playedAt) return false;
    const releaseDayKey = getReleaseDateDayKey(albumReleaseRawDate);
    const playedDayKey = getSaoPauloDayKey(circleFirstListen.playedAt);
    if (!releaseDayKey || !playedDayKey) return false;

    if (releaseDayKey === playedDayKey) return true;

    const releaseDate = new Date(`${releaseDayKey}T00:00:00.000Z`);
    if (!Number.isFinite(releaseDate.getTime())) return false;
    releaseDate.setUTCDate(releaseDate.getUTCDate() - 1);
    const previousReleaseDayKey = releaseDate.toISOString().slice(0, 10);

    return previousReleaseDayKey === playedDayKey;
  }, [albumReleaseRawDate, circleFirstListen?.playedAt]);
  const writerNames = React.useMemo(() => {
    const writers = (lyricsMatch?.writers || [])
      .map((writer) => writer.trim())
      .filter(Boolean)
      .join(', ');
    return writers || lyricsMatch?.match?.artist?.trim() || artistName;
  }, [artistName, lyricsMatch?.match?.artist, lyricsMatch?.writers]);
  const cleanedLyricsText = React.useMemo(() => cleanLyricsForDisplay(lyricsText), [lyricsText]);
  const isPanelFullyReady = panelHydration.metrics && panelHydration.artistStats && panelHydration.history && panelHydration.social;
  const shouldLoadStatsPanel = isOpen && !isStandaloneLyrics;
  const shouldRenderLyricsSheet = isLyricsOpen || isLyricsClosing;

  React.useEffect(() => {
    if (hasExternalPlayback) return;
    setPlaybackIndex(0);
    historySwipeTokenRef.current += 1;
    historySwipeX.set(0);
  }, [hasExternalPlayback, historySwipeX, liveTrack?.id, liveTrack?.name, panelUserId]);

  React.useEffect(() => {
    if (!panelUser?.id) {
      setResolvedOwnRecent([]);
      return;
    }

    let cancelled = false;
    const directRecent = normalizeBottomTrackRecentItems(panelUser?.recent || (panelUser as any)?.history || []);
    const cachedRecent = normalizeBottomTrackRecentItems(getHistoryCache(panelUser.id) || []);
    const sessionRecent = normalizeBottomTrackRecentItems(readBottomTrackSessionCache<any[]>(`stats-lc-home-recent:${panelUser.id}`) || []);
    const preparedRecent = [cachedRecent, sessionRecent, directRecent]
      .sort((a, b) => b.length - a.length)[0] || [];

    if (preparedRecent.length > 0) {
      setResolvedOwnRecent(preparedRecent.slice(0, 20));
    }

    if (preparedRecent.length >= 8 || isStandaloneLyrics) return;

    const cancelTask = motionRuntimeScheduler.scheduleTask(() => {
      statsService.fetchRecent(panelUser.id, 20, 0)
        .then((freshItems) => {
          if (cancelled) return;
          const normalizedFresh = normalizeBottomTrackRecentItems(freshItems || []);
          const nextRecent = normalizedFresh.length > 0 ? normalizedFresh : preparedRecent;
          if (nextRecent.length === 0) return;
          setResolvedOwnRecent(nextRecent.slice(0, 20));
          setHistoryCache(panelUser.id, nextRecent);
          writeBottomTrackSessionCache(`stats-lc-home-recent:${panelUser.id}`, nextRecent);
        })
        .catch(() => undefined);
    }, shouldLoadStatsPanel ? 180 : 900, shouldLoadStatsPanel ? 'interaction' : 'ambient');

    return () => {
      cancelled = true;
      cancelTask();
    };
  }, [getHistoryCache, isStandaloneLyrics, panelUser, setHistoryCache, shouldLoadStatsPanel]);

  React.useEffect(() => {
    if (!track?.name || !isOpen) {
      setLyricsMatch(null);
      setLyricsText(null);
      setLyricsLoading(false);
      return;
    }

    const cachedFullLyrics = readExpiringCache(lyricsFullCache, getLyricsCacheKey(track.name, artistName));
    let cancelled = false;
    const requestKey = currentLyricsRequestKey;
    lyricsRequestKeyRef.current = requestKey;
    setLyricsText(cachedFullLyrics?.lyrics || null);
    if (cachedFullLyrics) {
      setLyricsMatch(cachedFullLyrics);
      setLyricsLoading(false);
      return;
    }
    setLyricsMatch(null);
    if (!isLyricsOpen) setLyricsLoading(false);

    const cancelTask = motionRuntimeScheduler.scheduleTask(() => {
      window.requestAnimationFrame(() => {
        loadLyricsMatch(track.name, artistName)
          .then((match) => {
            if (cancelled || lyricsRequestKeyRef.current !== requestKey) return;
            setLyricsMatch((current) => current && 'lyrics' in current && current.lyrics ? current : match);
          })
          .catch(() => undefined);
      });
    }, 420, 'interaction');
    return () => {
      cancelled = true;
      cancelTask();
    };
  }, [artistName, currentLyricsRequestKey, isOpen, isLyricsOpen, track?.name]);

  React.useEffect(() => {
    if (!track?.name || isOpen) return;
    const cancelTask = motionRuntimeScheduler.scheduleTask(() => {
      loadLyricsMatch(track.name, artistName).catch(() => undefined);
    }, 900, 'ambient');
    return () => cancelTask();
  }, [artistName, isOpen, track?.name, trackId]);

  // Prefetch track stats in background when the song changes and the modal is closed
  React.useEffect(() => {
    if (!panelUser?.id || !trackId || isOpen) return;
    const cancelTask = motionRuntimeScheduler.scheduleTask(() => {
      loadBottomTrackStatsPanelData({
        user: panelUser,
        trackId,
        albumId,
        trackArtists,
        members,
        currentTimestamp: undefined,
        knownTrackCount: knownUserTrackCount,
        mode: 'full',
      }).catch(() => undefined);
    }, 800, 'ambient');
    return () => cancelTask();
  }, [albumId, isOpen, knownUserTrackCount, members, panelUser, trackArtists, trackId]);

  React.useEffect(() => {
    if (!shouldLoadStatsPanel || !trackId || !members.length || hasHydratedTrackRanking) return;
    const cancelTask = motionRuntimeScheduler.scheduleTask(() => {
      fetchTrackStatsForAll(trackId).catch(() => undefined);
    }, 760, 'interaction');
    return () => cancelTask();
  }, [fetchTrackStatsForAll, hasHydratedTrackRanking, members.length, shouldLoadStatsPanel, trackId]);

  React.useEffect(() => {
    if (!panelUser?.id || !trackId) {
      setPanelData(emptyBottomTrackStatsPanelData);
      setPanelHydration(emptyBottomTrackStatsHydration);
      return;
    }

    if (shouldLoadStatsPanel && isPanelFullyReady && panelDataKeyRef.current === panelCacheKey) {
      return;
    }

    const cached = readExpiringCache(bottomTrackStatsCache, panelCacheKey);
    if (cached) {
      if (!shouldLoadStatsPanel) {
        setPanelData(cached.data);
        setPanelHydration(cached.hydration);
        panelDataKeyRef.current = panelCacheKey;
        return;
      }
      React.startTransition(() => {
        setPanelData(cached.data);
        setPanelHydration(cached.hydration);
        panelDataKeyRef.current = panelCacheKey;
      });
      return;
    }

    if (!shouldLoadStatsPanel) {
      setPanelData(createInitialBottomTrackStatsPanelData(knownUserTrackCount));
      setPanelHydration(emptyBottomTrackStatsHydration);
      return;
    }

    let cancelled = false;
    const requestKey = `${panelCacheKey}:${activePlayback?.timestamp || ''}`;
    panelRequestKeyRef.current = requestKey;
    setPanelData(createPreloadedBottomTrackStatsPanelData(knownUserTrackCount, activePlayback));
    setPanelHydration({
      metrics: typeof knownUserTrackCount === 'number',
      artistStats: false,
      history: !!activePlayback?.timestamp,
      social: false,
    });
    const cancelFastTask = motionRuntimeScheduler.scheduleTask(() => {
      window.requestAnimationFrame(() => {
        loadBottomTrackStatsPanelData({
          user: panelUser,
          trackId,
          albumId,
          trackArtists,
          members,
          currentTimestamp: activePlayback?.timestamp,
          knownTrackCount: knownUserTrackCount,
          mode: 'fast',
        }).then((snapshot) => {
          if (cancelled || panelRequestKeyRef.current !== requestKey) return;
          React.startTransition(() => {
            setPanelData(snapshot.data);
            setPanelHydration(snapshot.hydration);
          });
        }).catch(() => undefined);
      });
    }, 0, 'interaction');

    const cancelFullTask = motionRuntimeScheduler.scheduleTask(() => {
      loadBottomTrackStatsPanelData({
        user: panelUser,
        trackId,
        albumId,
        trackArtists,
        members,
        currentTimestamp: activePlayback?.timestamp,
        knownTrackCount: knownUserTrackCount,
        mode: 'full',
      }).then((snapshot) => {
        if (cancelled || panelRequestKeyRef.current !== requestKey) return;
        React.startTransition(() => {
          setPanelData(snapshot.data);
          setPanelHydration(snapshot.hydration);
          panelDataKeyRef.current = panelCacheKey;
        });
      });
    }, 180, 'interaction');

    return () => {
      cancelled = true;
      cancelFastTask();
      cancelFullTask();
    };
  }, [activePlayback?.timestamp, albumId, isPanelFullyReady, knownUserTrackCount, membersSignature, panelCacheKey, panelUser, shouldLoadStatsPanel, trackArtistsSignature, trackId]);

  const ranking = React.useMemo(() => {
    if (!trackId) return [];
    return members
      .map(member => ({
        user: member,
        count: userTrackStats[`${member.id}:${trackId}`] || 0,
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [members, trackId, userTrackStats]);
  const hasPreviousTrackHistory = panelHydration.history && !!trackHistory.firstPlayedAt;
  const historyReferencePlayedAt = trackHistory.lastPlayedAt
    || trackHistory.firstPlayedAt
    || entryTimestampMs(activePlayback?.timestamp)
    || modalOpenedAtRef.current;
  const firstPlayedBadgeAt = trackHistory.firstPlayedAt || historyReferencePlayedAt;
  const lastPlayedBadgeAt = trackHistory.lastPlayedAt || historyReferencePlayedAt;
  const historyYear = trackHistory.bestYear || String(new Date(historyReferencePlayedAt).getFullYear());
  const historyYearCount = trackHistory.bestYearCount || 1;
  const visibleSocialRanking = hasHydratedTrackRanking ? ranking : [];
  const shouldShowSocialRankingBadge = visibleSocialRanking.length > 1;
  const circleFirstName = circleFirstListen?.user?.name?.split(/\s+/)[0]?.toLowerCase() || '';
  const firstDayGroup = circleFirstListeners.length > 0
    ? circleFirstListeners
    : circleFirstListen
      ? [circleFirstListen]
      : [];
  const hasFirstDayGroup = firstDayGroup.length > 1;
  const socialInsight = circleFirstListen
    ? hasFirstDayGroup
      ? isReleaseDayFirstListen
        ? `Vocês foram os primeiros do círculo a ouvirem essa faixa na data de lançamento, ${formatFullDate(circleFirstListen.playedAt)}.`
        : `Vocês foram os primeiros do círculo a ouvirem essa faixa em ${formatFullDate(circleFirstListen.playedAt)}.`
      : circleFirstListen.user.id === panelUser?.id
      ? isReleaseDayFirstListen
        ? `Você foi o primeiro do círculo a ouvir essa faixa na data de lançamento, ${formatFullDate(circleFirstListen.playedAt)}.`
        : `Você foi o primeiro do círculo a ouvir essa faixa em ${formatFullDate(circleFirstListen.playedAt)}.`
      : isReleaseDayFirstListen
        ? `${circleFirstName.charAt(0).toUpperCase()}${circleFirstName.slice(1)} foi o primeiro do círculo a ouvir essa faixa na data de lançamento, ${formatFullDate(circleFirstListen.playedAt)}.`
        : `${circleFirstName.charAt(0).toUpperCase()}${circleFirstName.slice(1)} foi o primeiro do círculo a ouvir essa faixa em ${formatFullDate(circleFirstListen.playedAt)}.`
    : hasFriendHistory
      ? 'O círculo já ouviu, mas sem data confiável.'
      : 'Só você ouviu essa faixa por enquanto.';
  const trackMetricReady = panelHydration.metrics || typeof knownUserTrackCount === 'number';
  const socialAvatarEntries = React.useMemo(() => {
    return firstDayGroup.length > 0 ? firstDayGroup : [{ user: panelUser, playedAt: 0 }];
  }, [firstDayGroup, panelUser]);
  const artistStatSkeletons = (trackArtists.length > 0
    ? trackArtists
    : [{ id: 'artist-skeleton', name: artistName || 'Artista', image: artistImage || '', key: 'artist-skeleton' }]
  ).slice(0, Math.max(2, Math.min(trackArtists.length || 2, 3)));

  const showToast = React.useCallback((message: string) => {
    cancelToastDismissRef.current();
    setToastMessage(message);
    cancelToastDismissRef.current = motionRuntimeScheduler.scheduleTask(() => {
      setToastMessage('');
      cancelToastDismissRef.current = () => {};
    }, 1800, 'interaction');
  }, []);

  React.useEffect(() => () => {
    cancelCloseLyricsTaskRef.current();
    cancelToastDismissRef.current();
  }, []);

  const updateLyricsScrollMask = React.useCallback(() => {
    const element = lyricsScrollRef.current;
    if (!element) return;
    const atTop = element.scrollTop <= 2;
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
    const mask = atTop && atBottom
      ? 'none'
      : atTop
        ? 'linear-gradient(to bottom, black 0%, black calc(100% - 34px), transparent 100%)'
        : atBottom
          ? 'linear-gradient(to bottom, transparent 0%, black 34px, black 100%)'
          : 'linear-gradient(to bottom, transparent 0%, black 34px, black calc(100% - 34px), transparent 100%)';

    element.style.webkitMaskImage = mask;
    element.style.maskImage = mask;
  }, []);

  const scheduleLyricsScrollMask = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    cancelLyricsMaskTaskRef.current();
    window.requestAnimationFrame(() => {
      updateLyricsScrollMask();
      window.requestAnimationFrame(updateLyricsScrollMask);
      cancelLyricsMaskTaskRef.current = motionRuntimeScheduler.scheduleTask(() => {
        updateLyricsScrollMask();
        cancelLyricsMaskTaskRef.current = () => {};
      }, 180, 'interaction');
    });
  }, [updateLyricsScrollMask]);

  React.useEffect(() => {
    if (panel !== 'lyrics') return;
    scheduleLyricsScrollMask();
  }, [cleanedLyricsText, panel, scheduleLyricsScrollMask]);

  const setLyricsScrollElement = React.useCallback((element: HTMLDivElement | null) => {
    lyricsScrollRef.current = element;
    if (element) scheduleLyricsScrollMask();
  }, [scheduleLyricsScrollMask]);



  const finalizeStatsModalClose = React.useCallback((closeToken: number) => {
    if (modalOpenTokenRef.current !== closeToken || isStandaloneLyrics) return;
    setIsOpen(false);
    setPanel('stats');
    setExternalPlayback(null);
    cancelCloseModalTaskRef.current();
    cancelCloseModalTaskRef.current = () => {};
  }, [isStandaloneLyrics]);

  const finalizeLyricsClose = React.useCallback(() => {
    if (!isStandaloneLyrics || isModalVisible) return;
    setIsOpen(false);
    setIsLyricsClosing(false);
    setIsStandaloneLyrics(false);
    setPanel('stats');
    setExternalPlayback(null);
    cancelCloseLyricsTaskRef.current();
    cancelCloseLyricsTaskRef.current = () => {};
  }, [isModalVisible, isStandaloneLyrics]);

  const closeStatsModal = React.useCallback(() => {
    const closeToken = modalOpenTokenRef.current + 1;
    modalOpenTokenRef.current = closeToken;
    setIsStandaloneLyrics(false);
    setIsModalVisible(false);
    setIsLyricsOpen(false);
    setIsLyricsClosing(false);
    setSelectedTrackLink(null);
    setRecentPickerOpen(false);
    setIsAnimationDone(false);
    animateMotion(historySwipeX, 0, { duration: 0.18, ease: [0.16, 1, 0.3, 1] });
    cancelCloseModalTaskRef.current();
    cancelCloseModalTaskRef.current = motionRuntimeScheduler.scheduleTask(() => {
      finalizeStatsModalClose(closeToken);
    }, 620, 'interaction', 'bottom-track-close-safety');
  }, [finalizeStatsModalClose, historySwipeX]);

  const closeLyrics = React.useCallback(() => {
    const shouldClosePortal = isStandaloneLyrics && !isModalVisible;
    setIsLyricsClosing(true);
    setIsLyricsOpen(false);
    setIsLyricsAnimationDone(false);
    cancelCloseLyricsTaskRef.current();
    cancelCloseLyricsTaskRef.current = motionRuntimeScheduler.scheduleTask(() => {
      setIsLyricsClosing(false);
      if (shouldClosePortal) finalizeLyricsClose();
    }, 520, 'interaction', 'lyrics-close-safety');
  }, [finalizeLyricsClose, isModalVisible, isStandaloneLyrics]);

  const handleLyricsDragEnd = React.useCallback((start: BottomTrackDragStart | null, clientX: number, clientY: number) => {
    if (!start || selectedTrackLink) return;
    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    const isVertical = Math.abs(deltaY) > Math.abs(deltaX) * 0.85;

    if (!isVertical) return;
    if (deltaY > 65) {
      if (start.fromScroll) {
        const lyricsScroll = lyricsScrollRef.current;
        if (lyricsScroll && lyricsScroll.scrollTop > 2) return;
      }
      setPanel('stats');
    } else if (!start.fromScroll && deltaY < -58) {
      closeStatsModal();
    }
  }, [closeStatsModal, selectedTrackLink]);

  const handleOpenStats = React.useCallback((nextPanel: 'stats' | 'lyrics' = 'stats') => {
    const openToken = modalOpenTokenRef.current + 1;
    modalOpenTokenRef.current = openToken;
    cancelCloseModalTaskRef.current();
    cancelCloseLyricsTaskRef.current();
    setIsStandaloneLyrics(false);
    setIsLyricsClosing(false);
    modalOpenedAtRef.current = Date.now();
    ignoreBackdropClickUntilRef.current = window.performance.now() + 260;

    // Always reset to current track (index 0) when opening modal
    setPlaybackIndex(0);

    if (panelDataKeyRef.current !== panelCacheKey) {
      setPanelData(createPreloadedBottomTrackStatsPanelData(knownUserTrackCount, activePlayback));
      setPanelHydration({
        metrics: typeof knownUserTrackCount === 'number',
        artistStats: false,
        history: !!activePlayback?.timestamp,
        social: false,
      });
    }
    setPanel('stats');
    if (nextPanel === 'lyrics') {
      setIsLyricsOpen(true);
    } else {
      setIsLyricsOpen(false);
    }
    setRecentPickerOpen(false);
    setIsModalVisible(true);
    setIsOpen(true);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (modalOpenTokenRef.current !== openToken) return;
        const cached = readExpiringCache(bottomTrackStatsCache, panelCacheKey);
        if (!cached) return;
        React.startTransition(() => {
          setPanelData(cached.data);
          setPanelHydration(cached.hydration);
          panelDataKeyRef.current = panelCacheKey;
        });
      });
    });
  }, [knownUserTrackCount, panelCacheKey]);

  const handleOpenLyricsOnly = React.useCallback(() => {
    const openToken = modalOpenTokenRef.current + 1;
    modalOpenTokenRef.current = openToken;
    cancelCloseModalTaskRef.current();
    cancelCloseLyricsTaskRef.current();
    modalOpenedAtRef.current = Date.now();
    setPlaybackIndex(0);
    setPanel('lyrics');
    setRecentPickerOpen(false);
    setSelectedTrackLink(null);
    setIsAnimationDone(false);
    setIsStandaloneLyrics(true);
    setIsLyricsClosing(false);
    setIsModalVisible(false);
    setIsOpen(true);
    setIsLyricsOpen(true);
  }, []);

  const handleBubblePress = React.useCallback(() => {
    if (isModalVisible) {
      closeStatsModal();
      return;
    }
    handleOpenStats();
  }, [closeStatsModal, handleOpenStats, isModalVisible]);

  const copyTrackLink = async (url: string) => {
    try {
      await navigator.clipboard?.writeText(url);
      showToast('Link copiado para a área de transferência.');
    } catch {}
    setSelectedTrackLink(null);
  };

  const shareTrackLink = async (link: TrackLink) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${trackTitle} - ${artistName}`,
          text: `${trackTitle} - ${artistName}`,
          url: link.url,
        });
      } else {
        await navigator.clipboard?.writeText(link.url);
        showToast('Link copiado para a área de transferência.');
      }
    } catch {}
    setSelectedTrackLink(null);
  };

  const handleLyrics = React.useCallback(async () => {
    if (!track?.name) return;
    setIsLyricsClosing(false);
    setIsLyricsOpen(true);
    const requestKey = currentLyricsRequestKey;
    lyricsRequestKeyRef.current = requestKey;
    const cachedFullLyrics = readExpiringCache(lyricsFullCache, getLyricsCacheKey(track.name, artistName));
    if (cachedFullLyrics) {
      setLyricsMatch(cachedFullLyrics);
      setLyricsText(cachedFullLyrics.lyrics || '');
      setLyricsLoading(false);
      return;
    }

    setLyricsLoading(true);
    try {
      const response = await loadLyricsFull(track.name, artistName);
      if (lyricsRequestKeyRef.current !== requestKey) return;
      setLyricsMatch(response);
      if (response.lyrics) {
        setLyricsText(response.lyrics);
      }
      return;
    } finally {
      if (lyricsRequestKeyRef.current === requestKey) setLyricsLoading(false);
    }
  }, [artistName, currentLyricsRequestKey, track?.name]);

  const handleStatsDragEnd = React.useCallback((start: BottomTrackDragStart | null, clientX: number, clientY: number) => {
    if (!start || selectedTrackLink || panel !== 'stats') return false;
    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;

    if (Math.abs(deltaY) > 38 && Math.abs(deltaY) > Math.abs(deltaX) * 1.02) {
      animateMotion(historySwipeX, 0, { duration: 0.16, ease: [0.16, 1, 0.3, 1] });
      if (deltaY < 0) {
        handleLyrics();
      } else if (deltaY > 118) {
        closeStatsModal();
      }
      return true;
    }

    if (Math.abs(deltaX) < 38 || Math.abs(deltaX) < Math.abs(deltaY) * 1.1) {
      animateMotion(historySwipeX, 0, { duration: 0.18, ease: [0.16, 1, 0.3, 1] });
      return false;
    }

    if (deltaX > 0 && olderPlaybackIndex !== playbackIndex) {
      setRecentPickerOpen(false);
      animateHistorySwipe('older');
      return true;
    }

    if (deltaX < 0 && newerPlaybackIndex !== playbackIndex) {
      setRecentPickerOpen(false);
      animateHistorySwipe('newer');
      return true;
    }

    animateMotion(historySwipeX, 0, { duration: 0.18, ease: [0.16, 1, 0.3, 1] });
    return false;
  }, [animateHistorySwipe, closeStatsModal, handleLyrics, historySwipeX, newerPlaybackIndex, olderPlaybackIndex, panel, playbackIndex, selectedTrackLink]);

  React.useEffect(() => {
    if (!isOpen || !isLyricsOpen || !track?.name) return;

    let cancelled = false;
    const requestKey = currentLyricsRequestKey;
    lyricsRequestKeyRef.current = requestKey;
    const cachedFullLyrics = readExpiringCache(lyricsFullCache, getLyricsCacheKey(track.name, artistName));
    if (cachedFullLyrics) {
      setLyricsMatch(cachedFullLyrics);
      setLyricsText(cachedFullLyrics.lyrics || '');
      setLyricsLoading(false);
      return;
    }

    setLyricsMatch(null);
    setLyricsText(null);
    setLyricsLoading(true);
    loadLyricsFull(track.name, artistName)
      .then((response) => {
        if (cancelled || lyricsRequestKeyRef.current !== requestKey) return;
        setLyricsMatch(response);
        setLyricsText(response.lyrics || '');
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled && lyricsRequestKeyRef.current === requestKey) setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [artistName, currentLyricsRequestKey, isOpen, isLyricsOpen, track?.name]);

  const copyLyrics = React.useCallback(async () => {
    if (!track?.name) return;
    const requestKey = currentLyricsRequestKey;
    lyricsRequestKeyRef.current = requestKey;
    setLyricsLoading(true);
    try {
      const response = await loadLyricsFull(track.name, artistName);
      if (lyricsRequestKeyRef.current !== requestKey) return;
      setLyricsMatch(response);
      const cleaned = cleanLyricsForDisplay(response.lyrics);
      if (!cleaned) {
        showToast('Letra indisponível.');
        return;
      }
      setLyricsText(response.lyrics || '');
      try {
        await navigator.clipboard?.writeText(cleaned);
        showToast('Letra copiada para a área de transferência.');
      } catch {}
      setSelectedTrackLink(null);
    } finally {
      if (lyricsRequestKeyRef.current === requestKey) setLyricsLoading(false);
    }
  }, [artistName, currentLyricsRequestKey, showToast, track?.name]);

  React.useEffect(() => {
    const openTrackStats = (event: Event) => {
      const detail = (event as CustomEvent<BottomTrackOpenDetail>).detail || {};
      const rawPlayback = detail.playback || {};
      const eventTrack = detail.track || rawPlayback.track;
      if (eventTrack?.name) {
        setExternalPlayback({
          userId: detail.userId,
          track: eventTrack,
          timestamp: rawPlayback.playedAt || rawPlayback.timestamp || rawPlayback.endTime || rawPlayback.date || rawPlayback.createdAt,
          platform: rawPlayback.platform || rawPlayback.source || rawPlayback.platformCandidate,
          durationMs: rawPlayback.durationMs || eventTrack.durationMs,
          progressMs: rawPlayback.progressMs,
          isLive: rawPlayback.isLive,
        });
        setPlaybackIndex(0);
        setRecentPickerOpen(false);
        historySwipeTokenRef.current += 1;
        historySwipeX.set(0);
        if (detail.panel === 'lyrics') {
          handleOpenLyricsOnly();
        } else {
          handleOpenStats();
        }
        return;
      }

      if (detail.panel === 'lyrics') {
        handleOpenLyricsOnly();
      } else {
        handleOpenStats();
      }
    };
    window.addEventListener('stats-lc-open-track-stats', openTrackStats);
    return () => window.removeEventListener('stats-lc-open-track-stats', openTrackStats);
  }, [handleOpenLyricsOnly, handleOpenStats, historySwipeX]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const { body } = document;
    const previousModalOpenAttr = body.dataset.bottomTrackModalOpen;
    if (isOpen) body.dataset.bottomTrackModalOpen = 'true';
    else delete body.dataset.bottomTrackModalOpen;

    return () => {
      if (previousModalOpenAttr === undefined) {
        delete body.dataset.bottomTrackModalOpen;
      } else {
        body.dataset.bottomTrackModalOpen = previousModalOpenAttr;
      }
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (typeof document === 'undefined' || !isOpen) return;
    const { documentElement, body } = document;
    const lockedScrollY = window.scrollY;
    const previousRootOverflow = documentElement.style.overflow;
    const previousRootOverscroll = documentElement.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    let activeTouchScroller: HTMLElement | null = null;
    let previousTouchY = 0;

    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    const findLyricsScroller = (target: EventTarget | null) => {
      return target instanceof Element
        ? target.closest<HTMLElement>('[data-lyrics-scroll="true"]')
        : null;
    };
    const canScrollLyrics = (element: HTMLElement, deltaY: number) => {
      if (deltaY < 0) return element.scrollTop > 0;
      if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
      return false;
    };
    const preventBackgroundWheel = (event: WheelEvent) => {
      const scroller = findLyricsScroller(event.target);
      if (scroller && canScrollLyrics(scroller, event.deltaY)) return;
      event.preventDefault();
    };
    const captureTouchStart = (event: TouchEvent) => {
      activeTouchScroller = findLyricsScroller(event.target);
      previousTouchY = event.touches[0]?.clientY ?? 0;
    };
    const preventBackgroundTouch = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? previousTouchY;
      const deltaY = previousTouchY - currentY;
      previousTouchY = currentY;
      if (!activeTouchScroller || !canScrollLyrics(activeTouchScroller, deltaY)) {
        event.preventDefault();
      }
    };
    const preserveDocumentScroll = () => {
      if (Math.abs(window.scrollY - lockedScrollY) > 0.5) {
        window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
      }
    };

    document.addEventListener('wheel', preventBackgroundWheel, { passive: false, capture: true });
    document.addEventListener('touchstart', captureTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', preventBackgroundTouch, { passive: false, capture: true });
    window.addEventListener('scroll', preserveDocumentScroll, { passive: true });

    return () => {
      document.removeEventListener('wheel', preventBackgroundWheel, true);
      document.removeEventListener('touchstart', captureTouchStart, true);
      document.removeEventListener('touchmove', preventBackgroundTouch, true);
      window.removeEventListener('scroll', preserveDocumentScroll);
      documentElement.style.overflow = previousRootOverflow;
      documentElement.style.overscrollBehavior = previousRootOverscroll;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      if (Math.abs(window.scrollY - lockedScrollY) > 0.5) {
        window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
      }
    };
  }, [isOpen]);

  if (!track && !user) return null;

  return (
    <>
      <div
        className="relative mb-[calc(env(safe-area-inset-bottom)+8px)] h-[50px] w-[50px] shrink-0"
        aria-hidden={false}
        data-stats-lc-bottom-bubble="true"
      >
        <motion.button
          type="button"
          onClick={handleBubblePress}
          className={clsx(
            "pointer-events-auto z-[1001] flex h-[50px] w-[50px] touch-manipulation items-center justify-center overflow-hidden rounded-full bg-black/[0.22] shadow-[0_10px_30px_-14px_rgba(0,0,0,0.72)] backdrop-blur-xl",
            "absolute inset-0"
          )}
          style={{
            WebkitBackdropFilter: bubbleGlassFilter,
            backdropFilter: bubbleGlassFilter,
            boxShadow: bubbleGlassShadow,
          }}
          whileTap={{ scale: 0.9 }}
          aria-label={isModalVisible ? "Fechar modal da música" : "Abrir stats da música"}
        >
          <AnimatePresence initial={false}>
            {isBubbleLive ? (
              <motion.span
                key="live-bubble-base"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, color-mix(in srgb, ${bubbleAccentColor} 92%, rgba(255,255,255,0.12)) 0%, color-mix(in srgb, ${bubbleAccentColor} 70%, rgba(0,0,0,0.22)) 72%, color-mix(in srgb, ${bubbleAccentColor} 52%, rgba(0,0,0,0.38)) 100%)`,
                  filter: 'saturate(1.65) contrast(1.08)',
                }}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: shouldAnimateBubble ? 0.68 : 0.72, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : (
              <motion.span
                key="idle-bubble-base"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full bg-white/[0.03]"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{
                  opacity: shouldPulseIdleBubble ? [0.82, 1, 0.82] : 1,
                  scale: shouldPulseIdleBubble ? [1, 1.045, 1] : 1,
                }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{
                  duration: shouldPulseIdleBubble ? 3.2 : 0.38,
                  repeat: shouldPulseIdleBubble ? Infinity : 0,
                  ease: shouldPulseIdleBubble ? "easeInOut" : [0.16, 1, 0.3, 1],
                }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {isBubbleLive && (
              <motion.span
                key="live-bubble-gloss"
                aria-hidden="true"
                className="pointer-events-none absolute inset-[2px] rounded-full"
                style={{
                  background: 'radial-gradient(circle at 45% 36%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.16) 36%, rgba(255,255,255,0.05) 64%, transparent 100%)',
                  mixBlendMode: 'screen',
                }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: shouldAnimateBubble ? 0.46 : 0.42, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </AnimatePresence>
          <EngineBreathe
            active={shouldAnimateBubble || shouldPulseIdleBubble}
            className="relative z-10 flex h-[32px] w-[32px] items-center justify-center"
            duration={shouldPulseIdleBubble ? 4.2 : 2.6}
            fromOpacity={1}
            fromScale={shouldPulseIdleBubble ? 0.985 : shouldAnimateBubble ? 0.97 : 1}
            toOpacity={1}
            toScale={shouldPulseIdleBubble ? 1.025 : shouldAnimateBubble ? 1.09 : 1}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={`${bubbleTrackId || bubbleTrackTitle}:${bubbleArtistImage || 'fallback'}`}
                className="absolute inset-0 h-full w-full rounded-full overflow-hidden flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                style={{ backfaceVisibility: 'hidden' }}
                initial={{
                  opacity: 0,
                  x: 34,
                  scale: 0.84,
                  rotate: 42,
                  zIndex: 2,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: 1,
                  rotate: 0,
                  zIndex: 2,
                }}
                exit={{
                  opacity: 0,
                  x: -24,
                  scale: 0.92,
                  rotate: -28,
                  zIndex: 1,
                }}
                transition={{
                  duration: 0.46,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {bubbleArtistImage ? (
                  <SmartImage src={bubbleArtistImage} className="h-full w-full object-cover object-center" rounded="full" fallback="" />
                ) : (
                  <Music2 className="h-6 w-6 text-white/72" />
                )}
              </motion.div>
            </AnimatePresence>
          </EngineBreathe>
        </motion.button>
      </div>

      {typeof document !== 'undefined' && isOpen && createPortal(
          <div
            data-stats-lc-modal-surface="true"
            className={clsx(
              "fixed inset-0 z-[1205]",
              isModalVisible ? "pointer-events-auto" : "pointer-events-none"
            )}
            aria-hidden={!isModalVisible && !shouldRenderLyricsSheet}
            style={{ visibility: isOpen ? 'visible' : 'hidden' }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isModalVisible ? 1 : 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className={clsx(
                "absolute inset-0 bg-black/45 backdrop-blur-[6px]",
                isModalVisible ? "pointer-events-auto cursor-default" : "pointer-events-none"
              )}
              aria-label="Fechar stats da música"
              onClick={() => {
                if (window.performance.now() < ignoreBackdropClickUntilRef.current) return;
                if (isLyricsOpen) {
                  closeLyrics();
                  return;
                }
                if (selectedTrackLink) {
                  setSelectedTrackLink(null);
                  return;
                }
                if (recentPickerOpen) {
                  setRecentPickerOpen(false);
                  return;
                }
                closeStatsModal();
              }}
            />
            {!isStandaloneLyrics && (
            <div className="absolute inset-0 flex items-end justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+104px)] pt-12 pointer-events-none">
            <motion.section
              ref={modalRef}
              initial={{ opacity: 1, y: 540, scale: 0.985 }}
              onPointerDownCapture={(event) => {
                if (!isModalVisible) return;
                if (selectedTrackLink) return;
                const target = event.target as HTMLElement;
                if (recentPickerOpen && !target.closest('[data-recent-picker],[data-recent-toggle]')) {
                  event.stopPropagation();
                  setRecentPickerOpen(false);
                  modalPointerStartRef.current = null;
                  lyricsPointerStartRef.current = null;
                  animateMotion(historySwipeX, 0, { duration: 0.14, ease: [0.16, 1, 0.3, 1] });
                  return;
                }
                if (target.closest('button,a,input,textarea,select,[data-home-horizontal-scroll],[data-lyrics-scroll]')) return;
                modalPointerStartRef.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerMoveCapture={(event) => {
                if (!isModalVisible) return;
                const start = modalPointerStartRef.current;
                if (!start || selectedTrackLink) return;
                const deltaX = event.clientX - start.x;
                const deltaY = event.clientY - start.y;
                if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY) * 1.08) return;
                const atBoundary = (deltaX > 0 && olderPlaybackIndex === playbackIndex)
                  || (deltaX < 0 && playbackIndex <= 0);
                historySwipeX.set(Math.max(-120, Math.min(120, deltaX * (atBoundary ? 0.25 : 0.78))));
              }}
              onPointerUpCapture={(event) => {
                if (!isModalVisible) return;
                const start = modalPointerStartRef.current;
                modalPointerStartRef.current = null;
                handleStatsDragEnd(start, event.clientX, event.clientY);
              }}
              onTouchStartCapture={(event) => {
                if (!isModalVisible || selectedTrackLink) return;
                const touch = event.touches[0];
                if (!touch) return;
                const target = event.target as HTMLElement;
                if (recentPickerOpen && !target.closest('[data-recent-picker],[data-recent-toggle]')) {
                  event.stopPropagation();
                  setRecentPickerOpen(false);
                  modalPointerStartRef.current = null;
                  lyricsPointerStartRef.current = null;
                  animateMotion(historySwipeX, 0, { duration: 0.14, ease: [0.16, 1, 0.3, 1] });
                  return;
                }
                if (target.closest('a,input,textarea,select,[data-home-horizontal-scroll],[data-lyrics-scroll]')) return;
                modalPointerStartRef.current = { x: touch.clientX, y: touch.clientY };
              }}
              onTouchMoveCapture={(event) => {
                if (!isModalVisible) return;
                const start = modalPointerStartRef.current;
                const touch = event.touches[0];
                if (!start || !touch || selectedTrackLink) return;
                const deltaX = touch.clientX - start.x;
                const deltaY = touch.clientY - start.y;
                if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX) * 1.02) {
                  event.preventDefault();
                }
                if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY) * 1.08) return;
                const atBoundary = (deltaX > 0 && olderPlaybackIndex === playbackIndex)
                  || (deltaX < 0 && playbackIndex <= 0);
                historySwipeX.set(Math.max(-120, Math.min(120, deltaX * (atBoundary ? 0.25 : 0.78))));
              }}
              onTouchEndCapture={(event) => {
                if (!isModalVisible) return;
                const touch = event.changedTouches[0];
                if (!touch) return;
                const start = modalPointerStartRef.current;
                modalPointerStartRef.current = null;
                if (handleStatsDragEnd(start, touch.clientX, touch.clientY)) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              onPointerCancelCapture={() => {
                modalPointerStartRef.current = null;
                lyricsPointerStartRef.current = null;
                animateMotion(historySwipeX, 0, { duration: 0.18, ease: [0.16, 1, 0.3, 1] });
              }}
              onClick={(event) => {
                event.stopPropagation();
                const target = event.target as HTMLElement;
                if (recentPickerOpen && !target.closest('[data-recent-picker],[data-recent-toggle]')) {
                  setRecentPickerOpen(false);
                }
                if (selectedTrackLink && !target.closest('[data-action-sheet]')) {
                  setSelectedTrackLink(null);
                }
              }}
              className={clsx(
                "bottom-track-stats-modal relative w-full max-w-[430px] overflow-visible rounded-[30px] border-0 p-0 pointer-events-auto",
                "z-10 h-auto"
              )}
              data-animation-done={isAnimationDone}
              animate={{
                opacity: 1,
                y: isModalVisible ? 0 : 540,
                scale: isModalVisible ? 1 : 0.985,
              }}
              transition={{
                ...(isModalVisible
                  ? { type: 'spring' as const, stiffness: 190, damping: 24, mass: 0.92 }
                  : { duration: 0.42, ease: [0.32, 0, 0.2, 1] as const }),
              }}
              onAnimationComplete={() => {
                if (isModalVisible) {
                  setIsAnimationDone(true);
                }
              }}
              style={{
                touchAction: 'none',
                willChange: isModalVisible && isAnimationDone ? 'auto' : 'transform',
              }}
            >
              <div className="bottom-track-stats-controls-glass-layer pointer-events-none absolute inset-x-0 -bottom-[58px] z-0 h-[58px] rounded-[29px]" aria-hidden="true" />
              {visiblePlaybackHistory.length > 0 && panel === 'stats' && !hasExternalPlayback && (
                <motion.div
                  className="absolute inset-x-0 -bottom-[58px] z-30 flex items-center justify-center gap-3"
                  initial={{ opacity: 0, y: -10, scale: 0.9 }}
                  animate={isModalVisible && isAnimationDone
                    ? { opacity: 1, y: 0, scale: 1 }
                    : { opacity: 0, y: 18, scale: 0.94 }
                  }
                  exit={{ opacity: 0, y: 18, scale: 0.94 }}
                  transition={{
                    type: 'spring',
                    stiffness: 280,
                    damping: 25,
                    mass: 0.72,
                    delay: isModalVisible && isAnimationDone ? 0.1 : 0,
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    modalPointerStartRef.current = null;
                  }}
                  onPointerMove={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  {olderPlaybackIndex !== playbackIndex ? (
                    <button
                      type="button"
                      aria-label="Abrir música anterior do seu histórico"
                      onClick={() => selectPlaybackChoice(olderPlaybackIndex)}
                      className="bottom-track-controls-button flex h-11 w-11 items-center justify-center rounded-full text-white/82 transition-[opacity,transform,color] active:scale-95"
                    >
                      <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  ) : (
                    <span className="h-11 w-11" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    data-recent-toggle="true"
                    aria-label="Abrir lista das suas recentes"
                    onClick={() => setRecentPickerOpen(value => !value)}
                    className={clsx(
                      "bottom-track-controls-button flex h-10 min-w-10 items-center justify-center rounded-full px-3.5 transition-[background-color,transform,color] active:scale-95",
                      recentPickerOpen ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_12px_rgba(249,115,22,0.35)]" : "text-white/84"
                    )}
                  >
                    <ListMusic className="h-[18px] w-[18px]" strokeWidth={2.4} />
                    <span className="ml-2 text-[8px] font-black uppercase tracking-[0.14em]">Recentes</span>
                  </button>
                  {newerPlaybackIndex !== playbackIndex ? (
                    <button
                      type="button"
                      aria-label="Voltar para música mais recente"
                      onClick={() => selectPlaybackChoice(newerPlaybackIndex)}
                      className="bottom-track-controls-button flex h-11 w-11 items-center justify-center rounded-full text-white/82 transition-[opacity,transform,color] active:scale-95"
                    >
                      <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  ) : (
                    <span className="h-11 w-11" aria-hidden="true" />
                  )}
                </motion.div>
              )}
              <div className="bottom-track-stats-body-backdrop relative w-full overflow-hidden rounded-[30px] p-4">
                <AnimatePresence>
                {recentPickerOpen && panel === 'stats' && (
                  <motion.div
                    data-recent-picker="true"
                    className="bottom-track-recent-picker absolute inset-x-3 top-14 z-40 max-h-[254px] overflow-hidden rounded-[24px] p-2"
                    initial={{ opacity: 0, y: -12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      modalPointerStartRef.current = null;
                    }}
                    onPointerMove={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="max-h-[238px] overflow-y-auto pr-1 no-scrollbar">
                      {recentPickerItems.map((item) => {
                        const isSelected = playbackIndex === item.index;
                        return (
                          <button
                            key={`${item.index}-${item.title}-${item.timestamp || ''}`}
                            type="button"
                            onClick={() => selectPlaybackChoice(item.index)}
                            className={clsx(
                              "flex w-full items-center gap-3 rounded-[18px] px-2.5 py-2 text-left transition-[background-color,transform,color] active:scale-[0.985]",
                              isSelected ? "bg-orange-500/18 text-white" : "text-white/66 hover:bg-white/[0.045]"
                            )}
                          >
                            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                              {item.image ? (
                                <SmartImage src={item.image} className="h-full w-full object-cover" rounded="full" fallback="" />
                              ) : (
                                <Music2 className="m-2.5 h-5 w-5 text-white/42" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={clsx("block text-[7px] font-black uppercase tracking-[0.14em]", isSelected ? "text-orange-200" : "text-white/34")}>{item.label}</span>
                              <span className="mt-0.5 block truncate text-[11px] font-black leading-tight">{item.title}</span>
                              <span className="mt-0.5 block truncate text-[9px] font-bold text-white/38">{item.artist}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                data-bottom-track-drag-handle="true"
                className="absolute left-1/2 top-0 z-30 flex h-8 w-24 -translate-x-1/2 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                aria-label="Arrastar modal"
                role="button"
              >
                <div className="pointer-events-none h-1 w-10 rounded-full bg-white/24" aria-hidden="true" />
              </div>

              <motion.div className="relative z-10 will-change-transform" style={{ x: historySwipeX }}>
              <div className="flex items-center gap-3 pt-2">
                <div className="stats-lc-soft-white-glass relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px]">
                  {artwork ? (
                    <SmartImage src={artwork} className="h-full w-full object-cover" rounded="none" fallback="" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music2 className="h-9 w-9 text-white/36" />
                    </div>
                  )}
                  {panel === 'lyrics' && (
                    <GeniusLogo className="absolute bottom-1 right-1 h-5 w-5 text-yellow-300 drop-shadow-[0_5px_10px_rgba(0,0,0,0.34)]" />
                  )}
                </div>
                <div className="min-w-0 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="block text-[8px] font-black uppercase tracking-[0.24em] text-orange-400">
                      {panel === 'lyrics' ? 'Letra' : activePlaybackLabel || 'Stats da música'}
                    </span>
                    {panel === 'lyrics' && (
                      <span className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.14em] text-yellow-100/70">
                        Genius
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex min-w-0 max-w-full items-start gap-1.5">
                    <ModalScrollingTrackTitle title={parsedTrackTitle.displayTitle || trackTitle} wide={parsedTrackTitle.badges.length === 0} />
                    <TrackTitleBadges badges={parsedTrackTitle.badges} className="pt-0.5" />
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-tight text-white/48">
                    <ArtistNamesInline artists={trackArtists} fallback={artistName} />
                  </p>
                  <div className="mt-1 flex w-full min-w-0 items-center justify-between gap-2 text-[10px] font-black uppercase leading-tight tracking-[0.05em] text-white/28">
                    <div className="min-w-0 flex-1">
                      <ModalScrollingAlbumName albumName={albumName} />
                    </div>
                    {panel === 'stats' && albumReleaseDate && (
                      <span
                        className={clsx(
                          "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] leading-none tracking-[0.09em]",
                          isReleaseDayFirstListen
                            ? "relative bg-orange-400/70 text-orange-100 shadow-[0_0_16px_rgba(255,122,26,0.35)] overflow-hidden"
                            : "stats-lc-soft-white-glass text-white"
                        )}
                        title={isReleaseDayFirstListen ? "Primeira escuta no dia do lançamento" : "Data de lançamento"}
                      >
                        {isReleaseDayFirstListen && (
                          <span className="absolute inset-0 rounded-full">
                            <EngineShimmer
                              active
                              duration={2.5}
                              className="opacity-50"
                              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)' }}
                            />
                          </span>
                        )}
                        <CalendarDays className={clsx(
                          "h-2.5 w-2.5 relative z-10",
                          !isReleaseDayFirstListen && "text-orange-300"
                        )} />
                        <span className="relative z-10">{albumReleaseDate}</span>
                      </span>
                    )}
                  </div>
            </div>
          </div>


              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="stats-lc-soft-white-glass min-w-0 rounded-[22px] p-3">
                  <UserCircle className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="block text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">Artista</span>
                  <strong className="mt-1 block whitespace-nowrap font-black tabular-nums leading-none text-white" style={{ fontSize: 'clamp(17px, 5.2vw, 22px)' }}>
                    <ModalMetricValue ready={panelHydration.metrics} value={entityStats.artist} />
                  </strong>
                </div>
                <div className="stats-lc-soft-white-glass min-w-0 rounded-[22px] p-3">
                  <ListMusic className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="block text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">Faixa</span>
                  <strong className="mt-1 block whitespace-nowrap font-black tabular-nums leading-none text-white" style={{ fontSize: 'clamp(17px, 5.2vw, 22px)' }}>
                    <ModalMetricValue ready={trackMetricReady} value={entityStats.track} fallbackValue={knownUserTrackCount} />
                  </strong>
                </div>
                <div className="stats-lc-soft-white-glass min-w-0 rounded-[22px] p-3">
                  <Disc3 className="mb-2 h-4 w-4 text-orange-300" />
                  <span className="block text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">Álbum</span>
                  <strong className="mt-1 block whitespace-nowrap font-black tabular-nums leading-none text-white" style={{ fontSize: 'clamp(17px, 5.2vw, 22px)' }}>
                    <ModalMetricValue ready={panelHydration.metrics} value={entityStats.album} />
                  </strong>
                </div>
              </div>

              {trackArtists.length > 1 && (
                panelHydration.artistStats && artistStats.length > 1 ? (
                <div className="mt-3 flex w-full gap-2 overflow-x-auto no-scrollbar px-px pb-1" data-home-horizontal-scroll="true">
                  {artistStats.map((artist) => (
                    <div
                      key={artist.key}
                      className="bottom-track-stats-surface flex min-w-0 items-center gap-2 rounded-full pl-2.5 pr-4 py-2"
                    >
                      <div className="h-8 w-8 overflow-hidden rounded-full bg-white/[0.05]">
                        <SmartImage src={artist.image || artistImage} className="h-full w-full object-cover" rounded="full" fallback={artist.name} />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-[7px] font-black uppercase leading-none tracking-[0.13em] text-white/34">{artist.name}</span>
                        <span className="mt-1 block text-[10px] font-black uppercase leading-none tabular-nums text-white"><AnimatedNumber value={artist.count} /></span>
                      </div>
                    </div>
                  ))}
                </div>
                ) : (
                <div className="mt-3 flex w-full gap-2 overflow-x-auto no-scrollbar px-px pb-1" data-home-horizontal-scroll="true" aria-hidden="true">
                  {artistStatSkeletons.map((artist, index) => (
                    <div
                      key={`${artist.key || artist.id || artist.name}-${index}`}
                      className="bottom-track-stats-surface flex min-w-[132px] max-w-[220px] shrink-0 items-center gap-2 rounded-full px-2.5 py-2"
                    >
                      <div className="h-8 w-8 overflow-hidden rounded-full bg-white/[0.05]">
                        {artist.image ? (
                          <SmartImage src={artist.image} className="h-full w-full object-cover" rounded="full" fallback="" />
                        ) : (
                          <ModalSkeleton className="h-full w-full rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <ModalSkeleton className="h-2.5 w-14 max-w-full" />
                        <ModalSkeleton className="mt-1 h-3 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
                )
              )}

              {panelHydration.history && trackHistory && (
                <div className="mt-2 grid w-full grid-cols-[max-content_max-content_max-content_minmax(0,1fr)] items-center gap-1.5">
                  <span
                    className={clsx(
                      "inline-flex h-[25px] min-h-[25px] max-h-[25px] min-w-0 flex-nowrap items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 text-[7px] font-black leading-none tracking-[0.09em]",
                      isReleaseDayFirstListen
                        ? "relative bg-orange-400/70 text-orange-100 shadow-[0_0_16px_rgba(255,122,26,0.35)] overflow-hidden"
                        : "bottom-track-stats-surface text-white"
                    )}
                    title="Primeiro stream"
                  >
                    {isReleaseDayFirstListen && (
                      <span className="absolute inset-0 rounded-full">
                        <EngineShimmer
                          active
                          duration={2.5}
                          className="opacity-50"
                          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)' }}
                        />
                      </span>
                    )}
                    <Sparkles className={clsx(
                      "h-2.5 w-2.5 relative z-10",
                      !isReleaseDayFirstListen && "text-orange-300"
                    )} fill="currentColor" />
                    <span className="relative z-10 whitespace-nowrap text-[7px] leading-none">{formatBadgeDate(firstPlayedBadgeAt)}</span>
                  </span>
                  <span
                    className="inline-flex h-[25px] min-h-[25px] max-h-[25px] min-w-0 flex-nowrap items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 text-[7px] font-black leading-none tracking-[0.09em] bottom-track-stats-surface text-white"
                    title="Último stream"
                  >
                    <Moon className="h-2.5 w-2.5 relative z-10 text-orange-300" fill="currentColor" />
                    <span className="relative z-10 whitespace-nowrap text-[7px] leading-none">{formatBadgeDate(lastPlayedBadgeAt)}</span>
                  </span>
                  {historyYear && (
                    <span
                      className="inline-flex h-[25px] min-h-[25px] max-h-[25px] min-w-0 flex-nowrap items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 text-[7px] font-black leading-none tracking-[0.09em] bottom-track-stats-surface text-white"
                      title="Ano recorde"
                    >
                      <span className="relative z-10 inline-flex items-center justify-center rounded bg-orange-300 px-0.5 py-0.5 font-black tracking-[-0.04em]" style={{ fontSize: '7.5px', color: 'rgba(0,0,0,0.75)' }}>{historyYearCount}×</span>
                      <span className="relative z-10 whitespace-nowrap text-[7px] leading-none">{historyYear}</span>
                    </span>
                  )}
                  {firstDayGroup.length > 0 && (
                    <span
                      className="relative inline-flex h-[25px] min-h-[25px] max-h-[25px] min-w-0 flex-nowrap items-center justify-center gap-0.5 overflow-hidden whitespace-nowrap rounded-full bg-orange-400/70 px-1.5 text-[7px] font-black leading-none tracking-[0.04em] text-orange-100 shadow-[0_0_16px_rgba(255,122,26,0.35)]"
                      title="Primeiros ouvintes do círculo"
                    >
                      <EngineShimmer
                        active
                        duration={2.5}
                        className="pointer-events-none opacity-50"
                        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)' }}
                      />
                      <span className="relative z-10 flex -space-x-1.5">
                        {firstDayGroup.slice(0, 3).map((listener, idx) => (
                          <span
                            key={listener.user?.id || idx}
                            className="h-4 w-4 overflow-hidden rounded-full bg-white/[0.08]"
                          >
                            <SmartImage
                              src={listener.user?.avatar}
                              className="h-full w-full object-cover"
                              rounded="full"
                              fallback={listener.user?.name || '?'}
                            />
                          </span>
                        ))}
                      </span>
                      <Rabbit className="relative z-10 h-3.5 w-3.5 shrink-0 text-orange-100" strokeWidth={2.5} />
                      <span className="relative z-10 whitespace-nowrap text-[7px] leading-none">{formatBadgeDate(circleFirstListen?.playedAt || firstPlayedBadgeAt)}</span>
                    </span>
                  )}
                </div>
              )}

              {panelHydration.history ? (
                hasPreviousTrackHistory ? (
                <motion.div
                  className="mt-3"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  <div className={clsx("grid w-full gap-1.5 px-px", trackHistory.bestYear ? "grid-cols-[1fr_1fr_1.05fr]" : "grid-cols-2")}>
                    <div className={clsx(
                      "bottom-track-stats-surface min-w-0 rounded-full px-3 py-1.5",
                      isReleaseDayFirstListen && "relative overflow-hidden !bg-orange-400/70 ring-1 ring-orange-400/50 shadow-[0_0_20px_rgba(255,122,26,0.35)] backdrop-filter-none"
                    )}>
                      {isReleaseDayFirstListen && (
                        <div className="absolute inset-0 overflow-hidden rounded-full">
                          <EngineShimmer
                            active
                            duration={2.5}
                            className="opacity-50"
                            style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)' }}
                          />
                        </div>
                      )}
                      <span className={clsx(
                        "relative z-10 block text-[6px] font-black uppercase leading-none tracking-[0.08em]",
                        isReleaseDayFirstListen ? "text-orange-200/60" : "text-white/36"
                      )}>Primeiro stream</span>
                      <span className={clsx(
                        "relative z-10 mt-1 block whitespace-nowrap text-[10px] font-black leading-none",
                        isReleaseDayFirstListen ? "text-orange-100" : "text-white/82"
                      )}>{formatFullDate(trackHistory.firstPlayedAt)}</span>
                    </div>
                    <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-1.5">
                      <span className="block text-[6px] font-black uppercase leading-none tracking-[0.08em] text-white/36">Último stream</span>
                      <span className="mt-1 block whitespace-nowrap text-[10px] font-black leading-none text-white/82">{formatFullDate(trackHistory.lastPlayedAt)}</span>
                    </div>
                    {trackHistory.bestYear && (
                    <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-1.5">
                      <span className="block text-[6px] font-black uppercase leading-none tracking-[0.08em] text-white/36">Ano recorde</span>
                      <span className="mt-1 block whitespace-nowrap text-[10px] font-black leading-none text-white/82">
                        {trackHistory.bestYearCount}x em {trackHistory.bestYear}
                      </span>
                    </div>
                    )}
                  </div>
                </motion.div>
                ) : (
                <motion.div
                  className="mt-3 rounded-[22px] bg-orange-500/[0.09] px-4 py-3 text-[11px] font-black leading-snug text-orange-100/86"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  Essa é sua primeira reprodução dessa faixa!
                </motion.div>
                )
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-1.5" aria-hidden="true">
                  <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-2">
                    <ModalSkeleton className="h-2 w-16" />
                    <ModalSkeleton className="mt-1.5 h-3 w-20" />
                  </div>
                  <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-2">
                    <ModalSkeleton className="h-2 w-16" />
                    <ModalSkeleton className="mt-1.5 h-3 w-20" />
                  </div>
                  <div className="bottom-track-stats-surface min-w-0 rounded-full px-3 py-2">
                    <ModalSkeleton className="h-2 w-14" />
                    <ModalSkeleton className="mt-1.5 h-3 w-24" />
                  </div>
                </div>
              )}

              <motion.div
                className="mt-3 flex w-full items-center gap-2 overflow-x-auto no-scrollbar px-px pb-1"
                data-home-horizontal-scroll="true"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {shouldShowSocialRankingBadge && (
                  <div
                    className="bottom-track-stats-surface flex h-[48px] w-max shrink-0 items-center rounded-full px-3 py-1.5"
                    aria-label="ranking de reproduções no círculo"
                  >
                    {visibleSocialRanking.map((item, index) => (
                      <div
                        key={item.user.id}
                        className="relative -mr-3 shrink-0 last:mr-0"
                        style={{ zIndex: visibleSocialRanking.length - index }}
                      >
                        <div className={clsx(
                          "stats-lc-soft-white-glass h-[29px] w-[29px] overflow-hidden rounded-full",
                          "ring-0"
                        )}>
                          <SmartImage
                            src={coreUtils.getUserAvatar(item.user.id, item.user.avatar)}
                            cacheKey={`bottom-track-ranking-avatar:${item.user.id}`}
                            className="h-full w-full object-cover"
                            rounded="full"
                            fallback=""
                          />
                        </div>
                        <span className={clsx(
                          "stats-lc-soft-white-glass absolute -bottom-1 left-1/2 min-w-[18px] -translate-x-1/2 rounded-full px-1.5 py-[2px] text-center text-[7px] font-black leading-none",
                          "text-white"
                        )}>
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {!hasHydratedTrackRanking && (
                  <div className="bottom-track-stats-surface flex h-[48px] min-w-[88px] shrink-0 items-center rounded-full px-3 py-1.5" aria-hidden="true">
                    <ModalSkeleton className="h-7 w-14" />
                  </div>
                )}
                {panelHydration.social ? (
                  <div className={clsx(
                    "bottom-track-stats-surface relative flex h-[48px] items-center gap-2 overflow-hidden rounded-full px-3 py-1",
                    shouldShowSocialRankingBadge ? "min-w-0 flex-1" : "w-full min-w-full max-w-[310px] shrink-0",
                    isReleaseDayFirstListen && "!bg-orange-400/70 ring-1 ring-orange-400/50 shadow-[0_0_20px_rgba(255,122,26,0.35)] backdrop-filter-none"
                  )}
                  >
                    {isReleaseDayFirstListen && (
                      <div className="absolute inset-0 z-0 overflow-hidden rounded-full pointer-events-none">
                        <EngineShimmer
                          active
                          duration={2.5}
                          className="opacity-50"
                          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)' }}
                        />
                      </div>
                    )}
                    <div
                      className="flex h-full min-w-0 flex-1 overflow-x-auto overflow-y-hidden no-scrollbar relative z-10"
                      data-home-horizontal-scroll="true"
                    >
                      <div
                        className="flex min-w-full shrink-0 items-center gap-2 py-1"
                        style={{
                          width: socialInsight.length > 56 ? '24rem' : '100%',
                          minWidth: socialInsight.length > 56 ? '24rem' : '100%',
                        }}
                      >
                        <div className="relative flex h-9 shrink-0 items-center py-0.5 pl-1 pr-2">
                          {socialAvatarEntries.map((entry, index) => (
                            <MemoizedSocialAvatar
                              key={`${entry.user?.id || user?.id || index}-${entry.playedAt}`}
                              entry={entry}
                              index={index}
                              total={socialAvatarEntries.length}
                            />
                          ))}
                        </div>
                        <span className={clsx(
                          "block max-h-[2.3em] min-w-0 flex-1 overflow-hidden whitespace-normal text-[9px] font-bold leading-[1.12]",
                          isReleaseDayFirstListen ? "text-orange-100/80" : "text-white/58"
                        )}>
                          {socialInsight}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={clsx(
                      "bottom-track-stats-surface relative flex h-[48px] items-center gap-2 overflow-hidden rounded-full px-3 py-1",
                      shouldShowSocialRankingBadge ? "min-w-0 flex-1" : "w-full min-w-full max-w-[310px] shrink-0"
                    )}
                    aria-hidden="true"
                  >
                    <div className="relative flex h-9 shrink-0 items-center py-0.5 pl-1 pr-2">
                      <ModalSkeleton className="-mr-2.5 h-[29px] w-[29px] rounded-full" />
                      <ModalSkeleton className="-mr-2.5 h-[29px] w-[29px] rounded-full opacity-75" />
                    </div>
                    <div className="relative w-full max-w-[220px] space-y-1.5 py-1">
                      <ModalSkeleton className="h-2.5 w-36 max-w-full" />
                      <ModalSkeleton className="h-2.5 w-24" />
                    </div>
                  </div>
                )}
              </motion.div>

              <div className="mt-4 flex items-center gap-2">
                {track?.name && (
                  <button
                    type="button"
                    onClick={handleLyrics}
                    disabled={lyricsLoading || lyricsMatch?.hasLyrics === false}
                    className={clsx(
                      "stats-lc-soft-white-glass flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition-colors",
                      lyricsMatch?.hasLyrics === false
                        ? "cursor-not-allowed text-white/28"
                        : "border-0 text-white/72 hover:text-white"
                    )}
                  >
                    {lyricsLoading ? (
                      <EngineSpinner className="h-4 w-4">
                        <Loader2 className="h-full w-full" />
                      </EngineSpinner>
                    ) : (
                      <BookOpen className="h-4 w-4 text-current" strokeWidth={2.4} />
                    )}
                    <span className="whitespace-nowrap">
                      {lyricsLoading ? 'Buscando' : lyricsMatch?.hasLyrics === false ? 'Letra indisponível' : 'Ver letra'}
                    </span>
                  </button>
                )}
                {(trackLinks.length > 0 || shouldReserveGeniusLink) && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {trackLinks.map((link) => (
                      <TrackLinkIconButton key={link.label} link={link} onChoose={chooseTrackLink} />
                    ))}
                    {lyricsMatch?.match?.url ? (
                      <TrackLinkIconButton
                        link={{
                          kind: 'genius',
                          label: 'Genius',
                          url: lyricsMatch.match.url,
                          appUrl: lyricsMatch.match.url,
                        }}
                        onChoose={chooseTrackLink}
                      />
                    ) : shouldReserveGeniusLink ? (
                      <span className="h-10 w-10 shrink-0 rounded-full bg-white/[0.035] opacity-0" aria-hidden="true" />
                    ) : null}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {toastMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                    className="stats-lc-soft-white-glass absolute inset-x-8 bottom-5 z-40 rounded-full px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.08em] text-white/82"
                  >
                    {toastMessage}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            </div>
          </motion.section>
          </div>
            )}

            {/* Separate Lyrics Modal Overlay */}
            <AnimatePresence>
              {shouldRenderLyricsSheet && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.78 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: isLyricsOpen ? 0.22 : 0.32, ease: "easeOut" }}
                    className="fixed inset-0 z-[1208] bg-black/28 backdrop-blur-[3px] pointer-events-auto"
                    onClick={closeLyrics}
                  />
                  <motion.div
                    className="pointer-events-auto fixed inset-x-0 bottom-0 z-[1210] mx-auto flex w-full max-w-[430px] flex-col rounded-t-[30px] border-0 p-4 bottom-track-lyrics-modal"
                    data-animation-done={isLyricsAnimationDone}
                    initial={{ y: 'calc(100% + 28px)' }}
                    animate={{ y: isLyricsOpen ? '0%' : 'calc(100% + 28px)' }}
                    exit={{ y: 'calc(100% + 28px)' }}
                    transition={isLyricsOpen
                      ? { type: 'spring', stiffness: 280, damping: 28, mass: 0.86 }
                      : { duration: 0.44, ease: [0.32, 0, 0.2, 1] }}
                    onAnimationComplete={() => {
                      if (isLyricsOpen) {
                        setIsLyricsAnimationDone(true);
                      }
                    }}
                    drag="y"
                    dragListener={false}
                    dragControls={dragControls}
                    dragConstraints={{ top: 0, bottom: 450 }}
                    dragElastic={{ top: 0.05, bottom: 0.85 }}
                    onDragEnd={(_, info) => {
                      if (info.offset.y > 100 || info.velocity.y > 450) {
                        closeLyrics();
                      }
                    }}
                    style={{
                      height: '88svh',
                      touchAction: 'pan-y',
                      willChange: isLyricsOpen && isLyricsAnimationDone ? 'auto' : 'transform, opacity',
                    }}
                  >
                  {/* Drag Handle Area */}
                  <button
                    type="button"
                    data-bottom-track-drag-handle="true"
                    aria-label="Arrastar modal de letra"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      dragControls.start(e);
                    }}
                    className="flex w-full shrink-0 cursor-grab touch-none select-none flex-col items-center pb-4 active:cursor-grabbing"
                  >
                    <div className="pointer-events-none h-1 w-10 rounded-full bg-white/22" aria-hidden="true" />
                  </button>

                  {/* Header content inside Lyrics Modal */}
                  <div className="flex items-center gap-3 pt-1 shrink-0 select-none">
                    <div className="stats-lc-soft-white-glass relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px]">
                      {artwork ? (
                        <SmartImage src={artwork} className="h-full w-full object-cover" rounded="none" fallback="" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Music2 className="h-9 w-9 text-white/36" />
                        </div>
                      )}
                      <GeniusLogo className="absolute bottom-1 right-1 h-5 w-5 text-yellow-300 drop-shadow-[0_5px_10px_rgba(0,0,0,0.34)]" />
                    </div>
                    <div className="min-w-0 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="block text-[8px] font-black uppercase tracking-[0.24em] text-orange-400">
                          Letra
                        </span>
                        <span className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.14em] text-yellow-100/70">
                          Genius
                        </span>
                      </div>
                      <div className="mt-1 flex min-w-0 max-w-full items-start gap-1.5">
                        <ModalScrollingTrackTitle title={parsedTrackTitle.displayTitle || trackTitle} wide={parsedTrackTitle.badges.length === 0} />
                        <TrackTitleBadges badges={parsedTrackTitle.badges} className="pt-0.5" />
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-tight text-white/48">
                        <ArtistNamesInline artists={trackArtists} fallback={artistName} />
                      </p>
                      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] font-black uppercase leading-tight tracking-[0.05em] text-white/28">
                        <ModalScrollingAlbumName albumName={albumName} />
                      </div>
                    </div>
                  </div>

                  {/* Lyrics scrollable area (removed soft-white-glass background) */}
                  <div className="mt-4 flex-1 select-none overflow-hidden flex flex-col min-h-0">
                    {lyricsLoading ? (
                      <div className="flex flex-1 items-center justify-center">
                        <EngineSpinner className="h-5 w-5 text-orange-300">
                          <Loader2 className="h-full w-full" />
                        </EngineSpinner>
                      </div>
                    ) : cleanedLyricsText ? (
                      <div
                        ref={setLyricsScrollElement}
                        data-lyrics-scroll="true"
                        onScroll={updateLyricsScrollMask}
                        className="flex-1 overflow-y-auto overscroll-contain py-4 pl-1 pr-2 text-[15px] font-black leading-[1.34] text-white/92 [touch-action:pan-y] sm:text-[16px] custom-scrollbar"
                      >
                        <AnimatePresence mode="popLayout">
                          <motion.div
                            key={track?.id || trackTitle}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.28, ease: "easeOut" }}
                          >
                            <div className="whitespace-pre-line">{cleanedLyricsText}</div>
                            <p className="mt-7 pb-1 leading-snug text-white/78">
                              <span className="font-black text-white/92">Autoria:</span>{' '}
                              <span className="font-normal">{writerNames || 'Autoria indisponível'}</span>
                            </p>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    ) : lyricsMatch?.hasLyrics === false ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center text-white/52">
                        <FileText className="h-7 w-7 text-orange-300/70" />
                        <span className="text-[10px] font-black uppercase tracking-[0.16em]">letra indisponível</span>
                      </div>
                    ) : lyricsMatch?.hasLyrics && lyricsMatch.match?.url ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
                        <FileText className="h-8 w-8 text-orange-300" />
                        <div>
                          <p className="text-sm font-black leading-tight text-white/82">Letra encontrada</p>
                          <p className="mt-2 text-[11px] font-bold leading-snug text-white/45">
                            O Genius bloqueou a extração completa agora, mas o link oficial está pronto.
                          </p>
                        </div>
                        <a
                          href={lyricsMatch.match.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="stats-lc-soft-white-glass rounded-full px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/72"
                        >
                          abrir no Genius
                        </a>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleLyrics}
                        className="flex flex-1 w-full flex-col items-center justify-center gap-3 text-white/52"
                      >
                        <FileText className="h-7 w-7 text-orange-300" />
                        <span className="text-[10px] font-black uppercase tracking-[0.16em]">carregar letra</span>
                      </button>
                    )}
                    <div className="mt-3 shrink-0 pb-2 flex select-none items-center justify-center gap-1.5 text-[7px] font-black uppercase tracking-[0.14em] text-white/42">
                      <span>Powered by</span>
                      {lyricsMatch?.match?.url ? (
                        <a
                          href={lyricsMatch.match.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-0.5 text-white/46 transition-colors hover:text-white/70"
                          aria-label="Abrir Genius"
                        >
                          <span className="text-[7px] font-black tracking-[0.1em] text-white/58 transition-colors group-hover:text-white/76">GENIUS</span>
                          <ExternalLink className="mt-[-2px] h-2 w-2 text-current" strokeWidth={2.6} />
                        </a>
                      ) : (
                        <span className="text-[7px] font-black tracking-[0.1em] text-white/44">GENIUS</span>
                      )}
                    </div>
                  </div>
                </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Separate Link Action Sheet Portal Overlay */}
            <AnimatePresence>
              {selectedTrackLink && (
                <div
                  data-action-sheet-overlay="true"
                  className="fixed inset-0 z-[1215] pointer-events-auto"
                  onClick={() => setSelectedTrackLink(null)}
                >
                  <motion.div
                    data-action-sheet="true"
                    initial={{ opacity: 0, scale: 0.82 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.9 }}
                    onClick={(event) => event.stopPropagation()}
                    className="fixed w-max max-w-[calc(100%_-_16px)] overflow-hidden rounded-[18px] p-1.5"
                    style={{
                      right: trackLinkSheetAnchor.right,
                      bottom: trackLinkSheetAnchor.bottom,
                      background: 'rgba(0,0,0,0.20)',
                      backdropFilter: 'blur(20px) saturate(120%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(120%)',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.24)',
                      border: 'none',
                      transformOrigin: 'bottom right',
                    }}
                  >
                    <div className="space-y-1">
                      <a
                        href={selectedTrackLink.appUrl || selectedTrackLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setSelectedTrackLink(null)}
                        className="flex items-center gap-2 rounded-[10px] py-1.5 pl-2.5 pr-2 text-white/86 active:bg-white/[0.055]"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/74" strokeWidth={2.4} />
                        <span className="text-[11px] font-semibold leading-none">
                          Abrir no {selectedTrackLink.label === 'stats.fm' && isAppleMusicUser ? 'stats.am' : selectedTrackLink.label}
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() => copyTrackLink(selectedTrackLink.url)}
                        className="flex w-full items-center gap-2 rounded-[10px] py-1.5 pl-2.5 pr-2 text-left text-white/86 active:bg-white/[0.055]"
                      >
                        <Copy className="h-3.5 w-3.5 shrink-0 text-white/74" strokeWidth={2.4} />
                        <span className="text-[11px] font-semibold leading-none">Copiar link</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => shareTrackLink(selectedTrackLink)}
                        className="flex w-full items-center gap-2 rounded-[10px] py-1.5 pl-2.5 pr-2 text-left text-white/86 active:bg-white/[0.055]"
                      >
                        <Share className="h-3.5 w-3.5 shrink-0 text-white/74" strokeWidth={2.4} />
                        <span className="text-[11px] font-semibold leading-none">Compartilhar</span>
                      </button>
                      {selectedTrackLink.kind === 'genius' && (
                        <button
                          type="button"
                          onClick={copyLyrics}
                          className="flex w-full items-center gap-2 rounded-[10px] py-1.5 pl-2.5 pr-2 text-left text-white/86 active:bg-white/[0.055]"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-white/74" />
                          <span className="text-[11px] font-semibold leading-none">Copiar letra</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>,
        document.body
      )}
    </>
  );
});

BottomTrackStatsBubble.displayName = 'BottomTrackStatsBubble';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isOffline = useStatsStore(state => state.isOffline);
  const groupStats = useStatsStore(state => state.groupStats);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const [homeReady, setHomeReady] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return window.__STATS_LC_HOME_READY__ === true || window.sessionStorage?.getItem('stats-lc-home-boot-ready') === '1';
  });
  
  const allUsers = React.useMemo(() => {
    return getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId);
  }, [groupStats, liveNowPlayingByUserId]);

  const activeMembersSorted = React.useMemo(() => {
    const list = allUsers.filter(u => {
      const pb = coreUtils.getPlaybackStatus(u);
      return pb.status === "live";
    });
    return list.sort((a, b) => {
      if (a.id === featuredUserId) return -1;
      if (b.id === featuredUserId) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [allUsers, featuredUserId]);

  const selectedStatsUser = React.useMemo(() => {
    const coldUser = groupStats?.users?.[featuredUserId] || allUsers.find((user) => user.id === featuredUserId) || allUsers[0];
    return coldUser ? attachLiveNowPlayingToMember(coldUser, liveNowPlayingByUserId) : coldUser;
  }, [allUsers, groupStats?.users, featuredUserId, liveNowPlayingByUserId]);

  const playingUser = React.useMemo(() => {
    return getUserTrackStatsSource(selectedStatsUser);
  }, [selectedStatsUser]);

  const track = playingUser?.nowPlaying?.track;
  const songName = track?.name || "Nenhuma música";
  const artistName = track?.artists
    ? (typeof track.artists[0] === 'string' ? track.artists[0] : (track.artists[0] as any)?.name || "Artista")
    : "Artista";
  
  const [isSyncInfoExpanded, setIsSyncInfoExpanded] = React.useState(false);
  const [isSyncTraySeparating, setIsSyncTraySeparating] = React.useState(false);

  const [showSyncFooter, setShowSyncFooter] = React.useState(false);
  const [viewportWidth, setViewportWidth] = React.useState(() => {
    if (typeof window === 'undefined') return 480;
    return window.innerWidth;
  });

  const [highlightedBubbles, setHighlightedBubbles] = React.useState<Record<string, boolean>>({});
  const syncPointerStartRef = React.useRef<{ x: number; y: number; scrollLeft: number } | null>(null);
  const syncDidDragRef = React.useRef(false);
  const cancelSyncRegroupTaskRef = React.useRef<() => void>(() => {});
  const bubbleHighlightCancelersRef = React.useRef(new Map<string, () => void>());
  const markSyncTraySeparating = React.useCallback(() => {
    setIsSyncTraySeparating(true);
    cancelSyncRegroupTaskRef.current();
    cancelSyncRegroupTaskRef.current = motionRuntimeScheduler.scheduleTask(() => {
      setIsSyncTraySeparating(false);
      cancelSyncRegroupTaskRef.current = () => {};
    }, 900, 'interaction', 'sync-tray-regroup');
  }, []);
  React.useEffect(() => () => cancelSyncRegroupTaskRef.current(), []);
  const hasWarmHomeReady = React.useCallback(() => {
    if (typeof window === 'undefined') return true;
    return (
      window.__STATS_LC_HOME_READY__ === true ||
      window.sessionStorage?.getItem('stats-lc-home-boot-ready') === '1' ||
      Boolean(document.documentElement.dataset.statsLcHomeReadyMs)
    );
  }, []);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowSyncFooter(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial scroll position

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const handleNowPlaying = (event: any) => {
      const { userId } = event.detail || {};
      if (userId && userId !== featuredUserId) {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReduced) {
          bubbleHighlightCancelersRef.current.get(userId)?.();
          setHighlightedBubbles(prev => ({ ...prev, [userId]: true }));
          const cancel = motionRuntimeScheduler.scheduleTask(() => {
            bubbleHighlightCancelersRef.current.delete(userId);
            setHighlightedBubbles(prev => {
              const next = { ...prev };
              delete next[userId];
              return next;
            });
          }, 2000, 'interaction');
          bubbleHighlightCancelersRef.current.set(userId, cancel);
        }
      }
    };
    window.addEventListener('nowPlayingChanged', handleNowPlaying);
    return () => {
      window.removeEventListener('nowPlayingChanged', handleNowPlaying);
      bubbleHighlightCancelersRef.current.forEach((cancel) => cancel());
      bubbleHighlightCancelersRef.current.clear();
    };
  }, [featuredUserId]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setIsSyncInfoExpanded(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const handleHomeReady = (event: Event) => {
      const ready = (event as CustomEvent<{ ready?: boolean }>).detail?.ready;
      if (ready === true) {
        window.__STATS_LC_HOME_READY__ = true;
        sessionStorage.setItem('stats-lc-home-boot-ready', '1');
      } else if (ready === false) {
        if (hasWarmHomeReady()) {
          window.__STATS_LC_HOME_READY__ = true;
          window.sessionStorage?.setItem('stats-lc-home-boot-ready', '1');
          setHomeReady(true);
          return;
        }
        window.__STATS_LC_HOME_READY__ = false;
        sessionStorage.removeItem('stats-lc-home-boot-ready');
      }
      setHomeReady(ready === true);
    };
    window.addEventListener('stats-lc-home-ready', handleHomeReady);
    return () => window.removeEventListener('stats-lc-home-ready', handleHomeReady);
  }, [hasWarmHomeReady]);

  React.useEffect(() => {
    if (!homeReady) return;
    window.__STATS_LC_HOME_READY__ = true;
    window.sessionStorage?.setItem('stats-lc-home-boot-ready', '1');
    window.__STATS_LC_DISMISS_SPLASH__?.();
  }, [homeReady]);

  const toggleSyncInfo = () => {
    setIsSyncInfoExpanded(prev => !prev);
  };
  
  const shouldShowExpanded = isSyncInfoExpanded;
  
  const lastUpdate = groupStats?.lastUpdated;
  const isStatsOrRanking = location.pathname === '/highlights' || location.pathname === '/ranking';
  const isHomeRoute = location.pathname === '/';
  const shouldGateHome = isHomeRoute && !homeReady;
  const syncTrayExpandedWidth = Math.max(188, Math.min(viewportWidth - 128, 254));
  const syncTrayCompactWidth = 58;
  const syncTrayCompactHeight = 28;
  const syncTrayExpandedHeight = 42;
  const syncTrayPrimaryMember = activeMembersSorted[0];

  return (
    <div
      className="app-shell relative flex w-full max-w-[480px] mx-auto flex-col overflow-x-clip overflow-y-visible font-sans"
      style={{ ['--app-background' as string]: '#000' }}
    >
      {/* Scroll Fade Gradients removed to prevent overlaying headers */}

      {/* Offline Status */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="z-[100] min-h-7 bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 flex items-center justify-center gap-2"
          >
            <WifiOff className="h-3 w-3 text-red-500" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Modo Offline</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Content */}
      <main className={clsx(
        "flex-1 w-full pt-[max(env(safe-area-inset-top),40px)] pb-[calc(env(safe-area-inset-bottom)+100px)]",
        shouldGateHome && "pointer-events-none opacity-0"
      )}>
        {children}
      </main>

      {/* Tab Bar (Floating Bottom Nav) */}
      <div className={clsx(
        "stable-bottom-bar fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none gap-1",
        shouldGateHome && "hidden"
      )}>
        {/* Sync Info Footer - aparece apenas quando scrollar */}
        <AnimatePresence initial={false}>
          {showSyncFooter && lastUpdate && activeMembersSorted.length > 0 && (
            <motion.div
              initial={{ y: 38, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 34, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 360,
                damping: 32,
                mass: 0.78
              }}
              className="pointer-events-none flex h-[44px] w-full justify-center px-3"
              data-stats-lc-sync-tray="true"
              data-stats-lc-sync-tray-expanded={shouldShowExpanded ? 'true' : 'false'}
            >
              <div
                className="relative flex items-center justify-center"
                style={{ width: syncTrayExpandedWidth, height: syncTrayExpandedHeight }}
              >
                <motion.div
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 rounded-full bg-black/34 shadow-[0_6px_18px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-md will-change-transform"
                  style={{
                    width: syncTrayExpandedWidth,
                    height: syncTrayExpandedHeight,
                    x: '-50%',
                    y: '-50%',
                    transformOrigin: 'center',
                  }}
                  initial={false}
                  animate={{
                    opacity: shouldShowExpanded ? 0.22 : 1,
                    scaleX: shouldShowExpanded ? 1 : syncTrayCompactWidth / syncTrayExpandedWidth,
                    scaleY: shouldShowExpanded ? 1 : syncTrayCompactHeight / syncTrayExpandedHeight,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 390,
                    damping: 34,
                    mass: 0.74,
                  }}
                />
                <button
                  type="button"
                  style={{
                    width: shouldShowExpanded ? syncTrayExpandedWidth : syncTrayCompactWidth,
                    height: shouldShowExpanded ? syncTrayExpandedHeight : syncTrayCompactHeight,
                  }}
                  onClick={() => {
                    if (syncDidDragRef.current) {
                      syncDidDragRef.current = false;
                      return;
                    }
                    toggleSyncInfo();
                  }}
                  className="pointer-events-auto relative z-10 flex cursor-pointer select-none items-center justify-center overflow-hidden rounded-full text-left outline-none active:scale-[0.99]"
                  data-stats-lc-sync-tray-button="true"
                  title={shouldShowExpanded ? "Minimizar informações" : "Exibir informações de sincronização"}
                  aria-label={shouldShowExpanded ? "Minimizar sincronização do grupo" : "Expandir sincronização do grupo"}
                >
                  <AnimatePresence initial={false} mode="wait">
                    {shouldShowExpanded ? (
                      <motion.div
                        key="expanded-sync-tray"
                        className="flex h-full w-full min-w-0 items-center justify-start gap-0 overflow-x-auto overflow-y-hidden px-2 no-scrollbar scrolling-touch"
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        onPointerDown={(event) => {
                          syncDidDragRef.current = false;
                          syncPointerStartRef.current = {
                            x: event.clientX,
                            y: event.clientY,
                            scrollLeft: event.currentTarget.scrollLeft,
                          };
                        }}
                        onPointerMove={(event) => {
                          const start = syncPointerStartRef.current;
                          if (!start) return;
                          const deltaX = Math.abs(event.clientX - start.x);
                          const deltaY = Math.abs(event.clientY - start.y);
                          const deltaScroll = Math.abs(event.currentTarget.scrollLeft - start.scrollLeft);
                          if (deltaX > 6 || deltaY > 6 || deltaScroll > 2) {
                            syncDidDragRef.current = true;
                            markSyncTraySeparating();
                          }
                        }}
                        onScroll={markSyncTraySeparating}
                        onPointerUp={() => {
                          syncPointerStartRef.current = null;
                        }}
                        onPointerCancel={() => {
                          syncPointerStartRef.current = null;
                        }}
                      >
                        {activeMembersSorted.map((user, idx) => {
                          const userAvatar = coreUtils.getUserAvatar(user.id, user.avatar);
                          const userTrack = user.nowPlaying?.track;
                          const uSongName = userTrack?.name || "Nenhuma música";
                          const uArtistName = userTrack?.artists
                            ? (typeof userTrack.artists[0] === 'string' ? userTrack.artists[0] : (userTrack.artists[0] as any)?.name || "Artista")
                            : "Artista";
                          const isBubbleHighlighted = highlightedBubbles[user.id];
                          const overlapOffset = idx === 0 ? 0 : (isSyncTraySeparating ? 0 : -14);

                          return (
                            <motion.div
                              key={user.id}
                              layout="position"
                              initial={{ opacity: 0, x: -18, rotate: -2.5, scale: 0.96, marginLeft: idx === 0 ? 0 : -10 }}
                              animate={isBubbleHighlighted
                                ? { opacity: 1, x: 0, rotate: 0, scale: [1, 1.045, 1], marginLeft: overlapOffset }
                                : { opacity: 1, x: 0, rotate: 0, scale: 1, marginLeft: overlapOffset }}
                              exit={{ opacity: 0, x: 18, rotate: 2, scale: 0.96, marginLeft: idx === 0 ? 0 : -8 }}
                              transition={{
                                layout: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                                duration: isBubbleHighlighted ? 1.1 : 0.24,
                                delay: Math.min(idx * 0.025, 0.08),
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className="leo-soft-badge flex min-w-[126px] max-w-[178px] flex-[0_0_auto] items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 active:scale-[0.98]"
                            >
                              <div className="relative shrink-0">
                                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-stone-900/80 ring-1 ring-white/10">
                                  <AnimatePresence initial={false} mode="popLayout">
                                    <motion.div
                                      key={`${user.id}:${userAvatar}`}
                                      className="h-full w-full"
                                      initial={{ opacity: 0, x: -10, rotate: -8, scale: 0.96 }}
                                      animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                                      exit={{ opacity: 0, x: 10, rotate: 8, scale: 0.98 }}
                                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                    >
                                      <SmartImage
                                        src={userAvatar}
                                        className="h-full w-full object-cover"
                                        rounded="full"
                                        fallback={user.name?.charAt(0) || ""}
                                      />
                                    </motion.div>
                                  </AnimatePresence>
                                </div>
                                {user.nowPlaying?.isNow && (
                                  <div className="absolute -bottom-0.5 -right-1 z-10 flex h-3.5 w-3.5 items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                                    <EqualizerIcon />
                                  </div>
                                )}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <AnimatePresence initial={false} mode="wait">
                                  <motion.span
                                    key={`${user.id}:${uSongName}`}
                                    className="truncate text-[11px] font-black leading-tight text-white"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                  >
                                    {uSongName}
                                  </motion.span>
                                </AnimatePresence>
                                <span className="mt-0.5 truncate text-[8px] font-bold leading-none text-white/42">
                                  {uArtistName}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="compact-sync-tray"
                        className="flex h-full items-center justify-center gap-1.5 px-1.5"
                        initial={{ opacity: 0, y: 7, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {syncTrayPrimaryMember && (
                          <div className="h-[22px] w-[22px] overflow-hidden rounded-full bg-stone-900/80 ring-1 ring-white/10">
                            <AnimatePresence initial={false} mode="popLayout">
                              <motion.div
                                key={`${syncTrayPrimaryMember.id}:${coreUtils.getUserAvatar(syncTrayPrimaryMember.id, syncTrayPrimaryMember.avatar)}`}
                                className="h-full w-full"
                                initial={{ opacity: 0, x: -9, rotate: -10, scale: 0.94 }}
                                animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 9, rotate: 8, scale: 0.98 }}
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                              >
                                <SmartImage
                                  src={coreUtils.getUserAvatar(syncTrayPrimaryMember.id, syncTrayPrimaryMember.avatar)}
                                  className="h-full w-full object-cover"
                                  rounded="full"
                                  fallback={syncTrayPrimaryMember.name?.charAt(0) || ""}
                                />
                              </motion.div>
                            </AnimatePresence>
                          </div>
                        )}
                        {activeMembersSorted.some(u => u.nowPlaying?.isNow) && (
                          <div className="opacity-90">
                            <EqualizerIcon />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex w-full max-w-[480px] items-center justify-center gap-2 px-3">
          {/* Navigation - Liquid Glass Capsule */}
          <div className="min-w-0 flex-1">
            <BottomNavigation pathname={location.pathname} />
          </div>
          <BottomTrackStatsBubble user={playingUser} />
        </div>
      </div>

      {/* Background Atmosphere */}
      <div className="app-background pointer-events-none overflow-hidden">
        {/* Subtle Noise Texture */}
        <div className="stats-lc-grain absolute inset-0 opacity-[0.015] mix-blend-overlay" />
      </div>
    </div>
  );
};
