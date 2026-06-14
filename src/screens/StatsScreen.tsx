
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  Music2, 
  Calendar, 
  RefreshCcw, 
  AlertTriangle, 
  Trophy,
  Star, 
  PlayCircle,
  Clock,
  Zap,
  Disc,
  UserCircle,
  Search,
  X,
  ChevronUp,
  Share2,
  Check,
  Sparkles,
  Flame,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import { cn } from '../lib/utils';
import { SectionHeader, Skeleton, SmartImage } from '../components/shared/CommonUI';
import { coreUtils, GROUP_USERS } from '../services/statsCore';
import { UserStats, TopItem } from '../types/stats';
import { statsService } from '../services/statsService';
import { trackEvent, identifyUser } from '../services/analyticsService';
import { ShareButton } from '../components/shared/ShareButton';
import { PerceptionsPanel } from '../components/stats/PerceptionsPanel';
import type { ReplayFilterPeriod, ReplaySelectedSubValues } from '../components/home/replayUtils';

import { getStartOfTodaySP, getStartOfWeekSP, getStartOfMonthSP, getStartOfYearSP, getHourSP, formatDateSP } from '../lib/time';
import { getVisibleMembers } from '../lib/memberSelectors';

const DailyActivityHeatmap = lazy(() => import('../components/stats/DailyActivityHeatmap').then(module => ({ default: module.DailyActivityHeatmap })));
const StatsBattleModal = lazy(() => import('../components/modals/UserModals').then(module => ({ default: module.StatsBattleModal })));
const TrackLeaderboardModal = lazy(() => import('../components/modals/TrackLeaderboardModal').then(module => ({ default: module.TrackLeaderboardModal })));
const TrackHistoryModal = lazy(() => import('../components/modals/TrackHistoryModal').then(module => ({ default: module.TrackHistoryModal })));
const UserAlbumStatsModal = lazy(() => import('../components/modals/EntityStatsModal').then(module => ({ default: module.UserAlbumStatsModal })));
const UserArtistStatsModal = lazy(() => import('../components/modals/EntityStatsModal').then(module => ({ default: module.UserArtistStatsModal })));
const ReplaySection = lazy(() => import('../components/home/ReplaySection').then(module => ({ default: module.ReplaySection })));

const ActivityAreaChart = lazy(async () => {
  const {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
  } = await import('recharts');

  return {
    default: ({ data, chartMetric, accentColor, width, height }: { data: any[]; chartMetric: 'streams' | 'hours'; accentColor: string; width: number; height: number }) => (
      <AreaChart width={width} height={height} data={data} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
        <defs>
          <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={accentColor} stopOpacity={0.25}/>
            <stop offset="95%" stopColor={accentColor} stopOpacity={0.01}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
        <XAxis dataKey="displayLabel" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} minTickGap={20} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
          tickFormatter={(value) => chartMetric === 'hours' ? String(value) : coreUtils.formatNumber(Number(value))}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const val = payload[0].value;
              const displayLabel = label || payload[0].payload.displayLabel;
              const isHours = chartMetric === 'hours';
              return (
                <div className="glass-card p-3 border border-orange-500/10 bg-black/95 backdrop-blur-xl flex flex-col gap-1.5 shadow-2xl rounded-2xl">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">{displayLabel}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                    <span className="text-sm font-black text-white">
                      {isHours ? `${Number(val).toFixed(2)}` : coreUtils.formatNumber(Number(val))}{' '}
                      <span className="text-[9px] text-white/50 font-medium uppercase tracking-wider">
                        {isHours ? 'HORAS' : 'STREAMS'}
                      </span>
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          }}
          cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
        />
        <Area type="monotone" dataKey={chartMetric} stroke={accentColor} strokeWidth={3} fill="url(#colorMetric)" dot={{ r: 2, strokeWidth: 1, fill: '#050505', stroke: accentColor }} activeDot={{ r: 6, stroke: accentColor, strokeWidth: 2, fill: '#050505' }} animationDuration={1500} />
      </AreaChart>
    ),
  };
});

const MeasuredActivityAreaChart = ({ data, chartMetric, accentColor }: { data: any[]; chartMetric: 'streams' | 'hours'; accentColor: string }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width > 0 && height > 0) {
        setSize((current) => (
          current.width === width && current.height === height
            ? current
            : { width, height }
        ));
      }
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const width = Math.max(size.width, 1);
  const height = Math.max(size.height, 1);

  return (
    <div ref={containerRef} className="h-full w-full min-h-[224px] min-w-0">
      {size.width > 1 && size.height > 1 ? (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><RefreshCcw className="h-5 w-5 text-white/10 animate-spin" /></div>}>
          <ActivityAreaChart data={data} chartMetric={chartMetric} accentColor={accentColor} width={width} height={height} />
        </Suspense>
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <RefreshCcw className="h-5 w-5 text-white/10 animate-spin" />
        </div>
      )}
    </div>
  );
};

interface TopRankingRowProps {
  item: any;
  index: number;
  activeType: 'artists' | 'tracks' | 'albums';
  members: any[];
  currentUserId: string;
  onTrackClick?: (track: any) => void;
}

const getStatsItemArtistName = (item: any) => {
  const candidates = [
    item?.primaryArtist,
    item?.primaryArtistName,
    item?.albumArtist,
    item?.albumArtistName,
    item?.artist,
    item?.artistName,
    Array.isArray(item?.artists) ? item.artists[0] : undefined,
    item?.album?.artist,
    item?.album?.artistName,
    item?.album?.primaryArtist,
    item?.album?.primaryArtistName,
    item?.track?.primaryArtist,
    item?.track?.primaryArtistName,
    item?.track?.artist,
    item?.track?.artistName,
    Array.isArray(item?.track?.artists) ? item.track.artists[0] : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (candidate && typeof candidate === 'object') {
      const name = candidate.name || candidate.artistName || candidate.displayName;
      if (typeof name === 'string' && name.trim()) return name;
    }
  }

  return '';
};

const TopRankingRow = ({ item, index, activeType, members, currentUserId, onTrackClick }: TopRankingRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  
  const displayArtistName = useMemo(() => {
    const normalized = getStatsItemArtistName(item);
    if (normalized) return normalized;
    if (item.primaryArtist) {
      let name = typeof item.primaryArtist === 'string' ? item.primaryArtist : item.primaryArtist.name;
      if (Array.isArray(item.secondaryArtists) && item.secondaryArtists.length > 0) {
        const secondaryNames = item.secondaryArtists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ');
        name += `, ${secondaryNames}`;
      }
      return name;
    }
    const trackArtist = item.track?.artist || item.artist;
    if (trackArtist) {
      return typeof trackArtist === 'string' ? trackArtist : trackArtist.name;
    }
    if (Array.isArray(item.track?.artists) && item.track.artists.length > 0) {
      return item.track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ');
    }
    return item.artistName || item.albumName || '';
  }, [item]);

  const handleClick = () => {
    if (onTrackClick) {
      onTrackClick(item);
    }
  };

  const name = item.name || item.track?.name || 'Unknown';
  const playCount = item.playcount || item.streams || item.count || 0;
  const albumImage = item.image || item.album?.image || item.albumImage || item.track?.album?.image || item.track?.image;
  const artistImage = item.artist?.image || item.primaryArtist?.image || item.track?.artist?.image || item.track?.artists?.[0]?.image || albumImage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.35), ease: "easeOut" }}
      className="mb-1.5"
    >
      <div 
        ref={rowRef}
        onClick={handleClick}
        className="glass flex items-center justify-between rounded-[22px] border-white/5 px-3 py-2.5 transition-[background-color,border-color,transform] duration-200 group/row cursor-pointer active:scale-[0.99] hover:bg-white/[0.035]"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="w-6 shrink-0 text-center text-[11px] font-black tabular-nums text-white/30">{(index + 1).toString().padStart(2, '0')}</span>
          <div className="relative h-12 w-12 shrink-0">
            {activeType === 'artists' ? (
              <SmartImage
                src={artistImage || albumImage}
                className="h-12 w-12 rounded-full object-cover shadow-[0_10px_24px_rgba(0,0,0,0.34)]"
                fallback={name}
                rounded="full"
              />
            ) : (
              <>
                <SmartImage
                  src={artistImage}
                  className="absolute left-0 top-1 h-9 w-9 rounded-full object-cover opacity-80 shadow-[0_8px_18px_rgba(0,0,0,0.32)]"
                  fallback={displayArtistName || name}
                  rounded="full"
                />
                <SmartImage
                  src={albumImage}
                  className="absolute bottom-0 right-0 h-10 w-10 rounded-full border-2 border-black object-cover shadow-[0_10px_24px_rgba(0,0,0,0.42)]"
                  fallback={name}
                  rounded="full"
                />
              </>
            )}
          </div>
          <div className="flex min-w-0 flex-col pr-2">
            <span className="truncate text-[13px] font-black leading-tight tracking-tight text-white/90 transition-colors group-hover/row:text-orange-300">{name}</span>
            <span className="mt-1 flex items-center gap-1.5 truncate text-[8px] font-black uppercase tracking-[0.14em] text-white/34">
              {activeType === 'artists' ? (
                <>artista em #{index + 1}</>
              ) : activeType === 'albums' ? (
                <>álbum no seu ranking</>
              ) : (
                <>faixa no seu ranking</>
              )}
              {activeType === 'tracks' && (item.playcount || item.streams) === 1 && (
                <span className="text-[7px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-md border border-orange-500/40 font-black">INÉDITO</span>
              )}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex min-w-[48px] flex-col items-center rounded-full border border-orange-500/24 bg-orange-500/[0.11] px-2.5 py-1.5">
             <span className="text-[11px] font-black leading-none tracking-tight text-orange-200">{coreUtils.formatNumber(playCount)}</span>
             <span className="mt-1 text-[6px] font-black uppercase tracking-[0.12em] text-orange-200/52">plays</span>
          </div>
          <ShareButton 
            targetRef={rowRef} 
            variant="minimal" 
            title={`Top ${activeType}: ${name}`}
            className="opacity-40 transition-opacity group-hover/row:opacity-100"
          />
        </div>
      </div>
    </motion.div>
  );
};

const StatsEmptyPanel = ({
  icon: Icon,
  eyebrow,
  title,
  description,
  action
}: {
  icon: typeof Music2;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="glass-card relative overflow-hidden rounded-[32px] border-white/[0.08] bg-black/42 px-5 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.045] to-transparent" />
    <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-orange-500/[0.12] blur-3xl" />
    <div className="relative z-10 flex items-start gap-4">
      <div className="glass-aura-orange flex h-12 w-12 shrink-0 items-center justify-center rounded-[22px] text-white shadow-[0_0_24px_rgba(249,115,22,0.16)]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-300/85">{eyebrow}</span>
        <h2 className="mt-2 text-lg font-black leading-tight tracking-tight text-white">{title}</h2>
        <p className="mt-2 max-w-[240px] text-[12px] font-semibold leading-relaxed text-white/46">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  </div>
);

const StatsRankingLoading = () => (
  <div className="glass-card relative overflow-hidden rounded-[32px] border-white/[0.08] bg-black/42 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.04] to-transparent" />
    <div className="relative z-10 flex flex-col gap-3">
      {[0, 1, 2].map((item) => (
        <div key={`stats-ranking-loading-${item}`} className="flex items-center gap-3 rounded-[24px] border border-white/[0.055] bg-white/[0.025] p-3">
          <div className="stats-lc-skeleton-shimmer h-11 w-11 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="stats-lc-skeleton-shimmer h-3 w-2/3 rounded-full" />
            <div className="stats-lc-skeleton-shimmer h-2 w-1/3 rounded-full opacity-60" />
          </div>
          <div className="stats-lc-skeleton-shimmer h-8 w-14 rounded-full opacity-70" />
        </div>
      ))}
      <div className="flex items-center justify-center gap-2 pt-1 text-[9px] font-black uppercase tracking-[0.22em] text-white/24">
        <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
        Buscando rankings
      </div>
    </div>
  </div>
);

type Filter = 'Hoje' | 'Semana' | 'Mês' | 'Ano' | 'Total';
type ItemType = 'artists' | 'tracks' | 'albums';
type StatsSection = 'overview' | 'replay' | 'rankings';

const statsSections: Array<{ id: StatsSection; label: string; icon: typeof BarChart3 }> = [
  { id: 'overview', label: 'Visão', icon: Sparkles },
  { id: 'replay', label: 'Replay', icon: PlayCircle },
  { id: 'rankings', label: 'Mais tocados', icon: Trophy },
];

const filterToReplayTab = (filter: Filter): ReplayFilterPeriod => {
  if (filter === 'Hoje') return 'today';
  if (filter === 'Semana') return 'week';
  if (filter === 'Mês') return 'month';
  if (filter === 'Ano') return 'year';
  return 'all';
};

const replayTabToFilter = (tab: ReplayFilterPeriod): Filter => {
  if (tab === 'today') return 'Hoje';
  if (tab === 'week') return 'Semana';
  if (tab === 'month') return 'Mês';
  if (tab === 'year') return 'Ano';
  return 'Total';
};

const getStatsCountValue = (source: any) => Number(source?.count ?? source?.streams ?? source?.c ?? source?.totalStreams ?? 0) || 0;
const getStatsDurationMsValue = (source: any) => {
  const durationMs = source?.durationMs ?? source?.playedMs ?? source?.totalDurationMs;
  if (Number.isFinite(durationMs) && durationMs > 0) return Number(durationMs);

  const minutes = source?.totalMinutes ?? source?.minutes ?? source?.playedMinutes;
  if (Number.isFinite(minutes) && minutes > 0) return Number(minutes) * 60000;

  return 0;
};

const getReplayItemMinutes = (source: any, type: ItemType) => {
  const directMinutes = source?.totalMinutes ?? source?.playedMinutes ?? source?.minutes ?? source?.stats?.minutes;
  if (Number.isFinite(directMinutes) && Number(directMinutes) > 0) return Number(directMinutes);

  const aggregateDurationMs =
    source?.totalDurationMs ??
    source?.playedMs ??
    source?.totalPlayedMs ??
    source?.playedDurationMs ??
    source?.stats?.durationMs ??
    source?.d;
  if (Number.isFinite(aggregateDurationMs) && Number(aggregateDurationMs) > 0) {
    return Number(aggregateDurationMs) / 60000;
  }

  if (type === 'tracks') {
    const count = getStatsCountValue(source);
    const perPlayDurationMs =
      source?.track?.durationMs ??
      source?.durationMs ??
      source?.album?.trackDurationMs;
    if (Number.isFinite(perPlayDurationMs) && Number(perPlayDurationMs) > 0 && count > 0) {
      return (Number(perPlayDurationMs) * count) / 60000;
    }
  }

  if (Number.isFinite(source?.durationMs) && Number(source.durationMs) > 0) {
    return Number(source.durationMs) / 60000;
  }

  return 0;
};

export default function StatsScreen() {
  const [activeFilter, setActiveFilter] = useState<Filter>('Mês');
  const [activeType, setActiveType] = useState<ItemType>('artists');
  const [activeStatsSection, setActiveStatsSection] = useState<StatsSection>('overview');
  
  const [battleOpponent, setBattleOpponent] = useState<UserStats | null>(null);
  const [fullUserData, setFullUserData] = useState<any>(null);
  
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartRetryNonce, setChartRetryNonce] = useState(0);
  const [chartMetric, setChartMetric] = useState<'streams' | 'hours'>('streams');
  
  const [activePeriodArtists, setActivePeriodArtists] = useState<any[]>([]);
  const [activePeriodTracks, setActivePeriodTracks] = useState<any[]>([]);
  const [activePeriodAlbums, setActivePeriodAlbums] = useState<any[]>([]);
  const [isTopItemsLoading, setIsTopItemsLoading] = useState(false);
  const [topItemsError, setTopItemsError] = useState<string | null>(null);
  const [topItemsRetryNonce, setTopItemsRetryNonce] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [selectedTrackHistory, setSelectedTrackHistory] = useState<any>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [visibleItemsCount, setVisibleItemsCount] = useState(15);
  const [activeRangeStats, setActiveRangeStats] = useState<{ count: number; durationMs: number } | null>(null);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  const [statsReplayTab, setStatsReplayTab] = useState<ReplayFilterPeriod>('month');
  const [statsReplaySubValues, setStatsReplaySubValues] = useState<ReplaySelectedSubValues>({
    weekMode: 'last-7',
    month: String(new Date().getMonth()).padStart(2, '0'),
    year: String(new Date().getFullYear())
  });
  const [replayOwnerId, setReplayOwnerId] = useState('');
  const [friendReplayItems, setFriendReplayItems] = useState<{ artists: any[]; tracks: any[]; albums: any[] }>({
    artists: [],
    tracks: [],
    albums: []
  });
  const [isFriendReplayLoading, setIsFriendReplayLoading] = useState(false);
  const showScrollTopRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const nextShowScrollTop = currentScrollY > 300;
        if (nextShowScrollTop !== showScrollTopRef.current) {
          showScrollTopRef.current = nextShowScrollTop;
          setShowScrollTop(nextShowScrollTop);
        }
        frame = 0;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  const groupStats = useStatsStore(state => state.groupStats);
  const isOffline = useStatsStore(state => state.isOffline);
  const globalError = useStatsStore(state => state.error);
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);

  const members = useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);
  const selectedUserId = featuredUserId || members[0]?.id || '';
  const user = groupStats?.users[selectedUserId] || members.find(m => m.id === selectedUserId) || members[0];
  const CURRENT_USER_ID = user?.id || selectedUserId;
  const accentColor = (user?.id && (GROUP_USERS as any)[user.id.toUpperCase()]?.color) || "#FF9F0A";

  const filters: Filter[] = ['Hoje', 'Semana', 'Mês', 'Ano', 'Total'];

  const periodMap: Record<Filter, string> = {
    'Hoje': 'today',
    'Semana': 'week',
    'Mês': 'month',
    'Ano': 'years',
    'Total': 'lifetime'
  };

  const setStatsPeriod = (filter: Filter) => {
    setActiveFilter(filter);
    setStatsReplayTab(filterToReplayTab(filter));
    trackEvent('stats_period_changed', { period: filter });
  };

  const handleReplayTabChange = (tab: ReplayFilterPeriod) => {
    setStatsReplayTab(tab);
    setActiveFilter(replayTabToFilter(tab));
  };

  useEffect(() => {
    if (!replayOwnerId && CURRENT_USER_ID) {
      setReplayOwnerId(CURRENT_USER_ID);
    }
  }, [CURRENT_USER_ID, replayOwnerId]);

  useEffect(() => {
    if (replayOwnerId && members.some(member => member.id === replayOwnerId)) return;
    if (CURRENT_USER_ID) setReplayOwnerId(CURRENT_USER_ID);
  }, [CURRENT_USER_ID, members, replayOwnerId]);

  // Reset search query and visible items limit when active category/filter changes
  useEffect(() => {
    setSearchQuery("");
    setVisibleItemsCount(15);
  }, [activeType, activeFilter]);

  // Track sub-view filter switching
  useEffect(() => {
    trackEvent('stats_filter_changed', { filter: activeFilter });
  }, [activeFilter]);

  // Track key types (artists/tracks/albums)
  useEffect(() => {
    trackEvent('stats_type_changed', { type: activeType });
  }, [activeType]);

  // Track top-level Stats section switching
  useEffect(() => {
    trackEvent('stats_section_changed', { section: activeStatsSection });
  }, [activeStatsSection]);

  // Track Stats Battle Arena activation
  useEffect(() => {
    if (battleOpponent) {
      trackEvent('modal_opened', { 
        modalName: 'stats_battle_arena', 
        opponentId: battleOpponent.id, 
        opponentName: battleOpponent.name 
      });
    }
  }, [battleOpponent]);

  useEffect(() => {
    let cancelled = false;
    async function loadFullData() {
      if (!CURRENT_USER_ID) {
        setFullUserData(null);
        return;
      }

      try {
        const fullData = await statsService.getUserFullStats(CURRENT_USER_ID);
        if (!cancelled) setFullUserData(fullData);
      } catch (e) {
        if (!cancelled) console.error("Failed to load full user data", e);
      }
    }
    loadFullData();
    return () => {
      cancelled = true;
    };
  }, [CURRENT_USER_ID]);

  const [datesData, setDatesData] = useState<any>(null);
  const [cardinalityData, setCardinalityData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadChartData() {
      if (!CURRENT_USER_ID) {
        setDatesData(null);
        setCardinalityData(null);
        setHistoryData([]);
        setActiveRangeStats(null);
        setIsChartLoading(false);
        return;
      }

      setIsChartLoading(true);
      setChartError(null);
      try {
        const today = getStartOfTodaySP();
        let after = 0;
        if (activeFilter === 'Hoje') {
          after = today.getTime();
        } else if (activeFilter === 'Semana') {
          after = getStartOfWeekSP().getTime();
        } else if (activeFilter === 'Mês') {
          after = getStartOfMonthSP().getTime();
        } else if (activeFilter === 'Ano') {
          after = getStartOfYearSP().getTime();
        } else if (activeFilter === 'Total') {
          after = 0;
        }

        const [statsRes, datesRes, cardRes] = await Promise.all([
          statsService.fetchTimeRangeStats(CURRENT_USER_ID, after),
          statsService.fetchTimeRangeDates(CURRENT_USER_ID, after),
          statsService.fetchTimeRangeCardinality(CURRENT_USER_ID, after)
        ]);

        const data = statsRes;
        if (cancelled) return;

        // DEV LOGS - Mapear estrutura real dos dados
        if ((import.meta as any).env?.DEV) {
          console.group(`[StatsScreen DEV] Chart Data Load - Filter: ${activeFilter}`);
          console.log('activeFilter:', activeFilter);
          console.log('CURRENT_USER_ID:', CURRENT_USER_ID);
          console.log('after timestamp:', after, new Date(after).toISOString());
          console.log('statsRes keys:', statsRes ? Object.keys(statsRes) : 'null');
          console.log('statsRes.streams:', statsRes?.streams);
          console.log('statsRes.durationMs:', statsRes?.durationMs);
          console.log('datesRes.empty:', datesRes?.empty);
          console.log('datesRes.reason:', datesRes?.reason);
          console.log('cardRes.cardinality:', cardRes?.cardinality);
          console.log('fullUserData keys:', fullUserData ? Object.keys(fullUserData) : 'null');
          console.log('fullUserData.history length:', fullUserData?.history?.length);
          console.groupEnd();
        }

        setDatesData(datesRes);
        // Cardinality can be in stats endpoint directly (data.items.cardinality) or in a separate cardinalityRes
        setCardinalityData(cardRes?.items?.cardinality || cardRes?.cardinality ? cardRes : data);
        
        // Save raw metrics for selected period indicator
        if (data && typeof data === 'object') {
          const statsContainer = data.stats || data;
          const sourceObj = statsContainer.items || statsContainer;
          const countVal = getStatsCountValue(sourceObj);
          const durationVal = getStatsDurationMsValue(sourceObj);
          
          if (countVal > 0 || durationVal > 0) {
            setActiveRangeStats({ count: Number(countVal), durationMs: Number(durationVal) });
          } else {
            setActiveRangeStats(null);
          }
        } else {
          setActiveRangeStats(null);
        }
        
        let rawItems: any[] = [];
        
        if (data?.items && Array.isArray(data.items)) {
          rawItems = data.items;
        } else if (data?.history && Array.isArray(data.history)) {
          rawItems = data.history;
        } else if (Array.isArray(data)) {
          rawItems = data;
        } else if (data && typeof data === 'object') {
          // Check if it's an object with date keys (e.g. { "2023-10-01": 5 })
          const entries = Object.entries(data);
          if (entries.length > 0) {
            rawItems = entries
              .filter(([key]) => key.match(/^\d{4}-\d{2}-\d{2}$/) || key.match(/^\d{13,15}$/) || !isNaN(Date.parse(key)))
              .map(([key, val]: [string, any]) => {
                if (typeof val === 'number') return { date: key, streams: val };
                if (typeof val === 'object' && val !== null) {
                  return { 
                    date: key, 
                    streams: val.streams || val.count || val.c || val.plays || 0,
                    durationMs: getStatsDurationMsValue(val)
                  };
                }
                return null;
              })
              .filter((item): item is NonNullable<typeof item> => item !== null);
          }
        }
        
	        // Fallback: ONLY if activeFilter is Total and we have nothing else
	        if (rawItems.length === 0 && activeFilter === 'Total' && fullUserData?.history) {
	          rawItems = Array.isArray(fullUserData.history) ? fullUserData.history : [];
	        }

	        if (rawItems.length === 0) {
	          try {
	            rawItems = await statsService.fetchRecent(CURRENT_USER_ID, activeFilter === 'Total' ? 1000 : 1500, 0);
	          } catch {
	            rawItems = [];
	          }
	        }

        // DEV LOG - Mapear rawItems antes de formatar
        if ((import.meta as any).env?.DEV) {
          console.group(`[StatsScreen DEV] rawItems Formatting - Filter: ${activeFilter}`);
          console.log('rawItems length:', rawItems.length);
          console.log('rawItems sample (first 3):', rawItems.slice(0, 3));
          console.log('data type:', typeof data);
          console.log('data.items exists?', !!data?.items);
          console.log('data.history exists?', !!data?.history);
          console.groupEnd();
        }

        const formatted = rawItems.map((item: any) => {
          if (!item) return null;

          // Robust key detection for date/time
          let dateVal = item.date || item.t || item.timestamp || item.ts || item.time || item.day || item.playedAt || item.played_at || item.dt;

          if (!dateVal || dateVal === 'undefined' || dateVal === 'null') return null;

          // Handle Unix timestamps in seconds (common in some APIs)
          if (typeof dateVal === 'number' && dateVal < 2147483647) {
            dateVal = dateVal * 1000;
          }

          // Handle both ISO strings and YYYY-MM-DD short dates safely
          let dateObj: Date;
          try {
            if (typeof dateVal === 'string' && dateVal.length === 10 && dateVal.includes('-')) {
              // YYYY-MM-DD format - parse without timezone shift
              const [y, m, d] = dateVal.split('-').map(Number);
              if (isNaN(y) || isNaN(m) || isNaN(d)) {
                dateObj = new Date(dateVal);
              } else {
                dateObj = new Date(y, m - 1, d);
              }
            } else {
              dateObj = new Date(dateVal);
            }

            if (isNaN(dateObj.getTime())) return null;

            const hasExplicitCount = ('streams' in item) || ('count' in item) || ('c' in item) || ('plays' in item) || ('playcount' in item) || ('scrobbles' in item);
            const streamCount = hasExplicitCount
              ? (item.streams || item.count || item.c || item.plays || item.playcount || item.scrobbles || 0)
              : 1; // Default to 1 stream if it is a single stream event in history

            const durationVal = item.durationMs || item.playedMs || item.totalDurationMs || item.d || (item.duration ? item.duration * 60000 : 0) || 0;

            return {
              date: dateObj.toISOString(),
              streams: Number(streamCount) || 0,
              duration: Number(durationVal) / (1000 * 60) || 0 // Convert to minutes for better visualization
            };
          } catch (err) {
            return null;
          }
	        }).filter((item: any) => {
	          if (!item || !(item.streams > 0 || item.duration > 0 || rawItems.length < 50)) return false;
	          const itemTs = new Date(item.date).getTime();
	          if (!Number.isFinite(itemTs)) return true;
	          return itemTs >= after && itemTs <= Date.now();
	        });

        // DEV LOG - Resultado do formatting
        if ((import.meta as any).env?.DEV) {
          console.group(`[StatsScreen DEV] Formatted Result - Filter: ${activeFilter}`);
          console.log('formatted length:', formatted.length);
          console.log('formatted sample (first 3):', formatted.slice(0, 3));
          const totalStreams = formatted.reduce((acc: number, item: any) => acc + (item.streams || 0), 0);
          const totalHours = formatted.reduce((acc: number, item: any) => acc + (item.duration || 0), 0) / 60;
          console.log('total streams in chartData:', totalStreams);
          console.log('total hours in chartData:', totalHours.toFixed(2));
          console.groupEnd();
        }

        // Sort items by date if they aren't
        formatted.sort((a: any, b: any) => {
          try {
            const dA = new Date(a.date).getTime();
            const dB = new Date(b.date).getTime();
            if (isNaN(dA) || isNaN(dB)) return 0;
            return dA - dB;
          } catch {
            return 0;
          }
        });

        // Ensure we have at least 2 points for an AreaChart to look like a flow
        if (formatted.length === 1) {
          const single = formatted[0];
          try {
            const dateTs = new Date(single.date).getTime();
            if (!isNaN(dateTs)) {
              const prevDate = new Date(dateTs - 24 * 60 * 60 * 1000).toISOString();
              formatted.unshift({ date: prevDate, streams: 0, duration: 0 });
            }
          } catch (err) {
            console.warn("Failed to create prevDate for single point history", err);
          }
        }

        if (!cancelled) setHistoryData(formatted);
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load chart data", e);
          setChartError("Nao foi possivel carregar a analise temporal agora.");
          setDatesData(null);
          setCardinalityData(null);
          setActiveRangeStats(null);
          setHistoryData([]);
        }
      } finally {
        if (!cancelled) setIsChartLoading(false);
      }
    }
    loadChartData();
    return () => {
      cancelled = true;
    };
  }, [CURRENT_USER_ID, activeFilter, fullUserData, chartRetryNonce]);

  const dailyEvolutionData = useMemo(() => {
    // Robust multi-path navigation for API response
    const datesContainer = datesData?.stats || datesData?.data || datesData;
    const datesItems = datesContainer?.items || datesContainer?.stats?.items || datesContainer;
    const today = new Date();

    // DEV LOG - Mapear estrutura de datesItems para Evolução de Atividade
    if ((import.meta as any).env?.DEV) {
      console.group(`[StatsScreen DEV] dailyEvolutionData Mapper - Filter: ${activeFilter}`);
      console.log('datesData.empty:', datesData?.empty);
      console.log('datesData.reason:', datesData?.reason);
      console.log('historyData length:', historyData?.length);
      console.log('fullUserData?.history length:', fullUserData?.history?.length);

      // Check if API dates is empty and we need to use history fallback
      if (datesData?.empty && fullUserData?.history?.length > 0) {
        console.debug('[StatsScreen] API /stats-dates returned empty. Using fullUserData.history as primary source.');
      }
      console.groupEnd();
    }

    // Helper: filter fullUserData.history by active period
    const getFilteredHistory = () => {
      const sourceHistory = Array.isArray(historyData) && historyData.length > 0
        ? historyData
        : Array.isArray(fullUserData?.history)
          ? fullUserData.history
          : [];
      if (sourceHistory.length === 0) return [];

      const now = Date.now();
      let afterTimestamp = 0;

      if (activeFilter === 'Hoje') {
        afterTimestamp = getStartOfTodaySP().getTime();
      } else if (activeFilter === 'Semana') {
        afterTimestamp = getStartOfWeekSP().getTime();
      } else if (activeFilter === 'Mês') {
        afterTimestamp = getStartOfMonthSP().getTime();
      } else if (activeFilter === 'Ano') {
        afterTimestamp = getStartOfYearSP().getTime();
      } else {
        afterTimestamp = 0; // Total
      }

      return sourceHistory.filter((item: any) => {
        const dateVal = item.date || item.t || item.timestamp || item.ts || item.playedAt || item.played_at;
        if (!dateVal) return false;

        let ts = typeof dateVal === 'number' ? dateVal : new Date(dateVal).getTime();
        if (ts < 2147483647) ts *= 1000; // Convert seconds to ms

        return ts >= afterTimestamp && ts <= now;
      });
    };

    // Safely format Date as YYYY-MM-DD helper
    const getDayKey = (date: Date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (activeFilter === 'Hoje') {
      const hourlyMap: Record<number, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
      const currentHour = getHourSP(today);
      for (let h = 0; h <= currentHour; h++) {
        const hourStr = `${h.toString().padStart(2, '0')}:00`;
        hourlyMap[h] = { date: hourStr, displayLabel: hourStr, timestamp: h, streams: 0, duration: 0, hours: 0 };
      }

      // Try API data first (but it's likely empty)
      const hourlyDataPoints = datesItems?.hours || datesItems?.hourly || datesItems?.byHour;
      if (hourlyDataPoints && Object.keys(hourlyDataPoints).length > 0) {
        Object.entries(hourlyDataPoints).forEach(([hStr, v]: [string, any]) => {
          const h = Number(hStr);
          if (h >= 0 && h <= currentHour && hourlyMap[h]) {
            hourlyMap[h].streams = v.count ?? v.streams ?? v.c ?? 0;
            const durationMs = getStatsDurationMsValue(v);
            hourlyMap[h].duration = durationMs;
            hourlyMap[h].hours = Number((durationMs / 3600000).toFixed(2));
          }
        });

        const totalStreams = Object.values(hourlyMap).reduce((acc, h) => acc + h.streams, 0);
        if (totalStreams > 0) {
          return Object.values(hourlyMap);
        }
      }

      // Primary fallback: use filtered fullUserData.history
      const filteredHistory = getFilteredHistory();
      if (filteredHistory.length > 0) {
        filteredHistory.forEach((item: any) => {
          const dateVal = item.date || item.t || item.timestamp || item.ts || item.playedAt || item.played_at;
          const hour = getHourSP(dateVal);
          if (hour >= 0 && hour < 24 && hourlyMap[hour]) {
            hourlyMap[hour].streams += 1;
            const dur = item.durationMs || item.playedMs || (item.duration ? item.duration * 60000 : 0) || 0;
            hourlyMap[hour].duration += dur;
            hourlyMap[hour].hours = Number((hourlyMap[hour].duration / 3600000).toFixed(2));
          }
        });
        return Object.values(hourlyMap);
      }

      // Last fallback: historyData (already filtered by loadChartData)
      if (historyData && historyData.length > 0) {
        historyData.forEach((item) => {
          const hour = getHourSP(item.date);
          if (hour >= 0 && hour < 24 && hourlyMap[hour]) {
            hourlyMap[hour].streams += item.streams;
            hourlyMap[hour].duration += item.duration; // in minutes
            hourlyMap[hour].hours = Number((hourlyMap[hour].duration / 60).toFixed(2));
          }
        });
        return Object.values(hourlyMap);
      }
      return Object.values(hourlyMap);
    }

    if (activeFilter === 'Semana') {
      const daysLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

      // Try API data first (but it's likely empty)
      const weeklyDataPoints = datesItems?.weekDays || datesItems?.weekly || datesItems?.byWeekDay || datesItems?.days;
      if (weeklyDataPoints && Object.keys(weeklyDataPoints).length > 0) {
        const mapped = Object.entries(weeklyDataPoints).map(([wStr, v]: [string, any]) => {
           let day = Number(wStr);
           if (day === 0) day = 7;
           return {
             date: String(wStr),
             displayLabel: daysLabel[day - 1] || wStr,
             timestamp: Number(wStr),
             streams: v.count ?? v.streams ?? v.c ?? 0,
             duration: getStatsDurationMsValue(v),
             hours: Number((getStatsDurationMsValue(v) / 3600000).toFixed(2))
           };
        }).sort((a,b) => a.timestamp - b.timestamp);

        const totalStreams = mapped.reduce((acc, d) => acc + d.streams, 0);
        if (totalStreams > 0) {
          return mapped;
        }
      }

      // Primary fallback: use filtered fullUserData.history
      const filteredHistory = getFilteredHistory();
      if (filteredHistory.length > 0) {
        const weekMap: Record<string, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dayKey = getDayKey(d);
          const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          weekMap[dayKey] = {
            date: dayKey,
            displayLabel: dateLabel,
            timestamp: d.getTime(),
            streams: 0,
            duration: 0,
            hours: 0
          };
        }

        filteredHistory.forEach((item: any) => {
          const dateVal = item.date || item.t || item.timestamp || item.ts || item.playedAt || item.played_at;
          let ts = typeof dateVal === 'number' ? dateVal : new Date(dateVal).getTime();
          if (ts < 2147483647) ts *= 1000;

          const d = new Date(ts);
          if (!isNaN(d.getTime())) {
            const dayKey = getDayKey(d);
            if (weekMap[dayKey]) {
              weekMap[dayKey].streams += 1;
              const dur = item.durationMs || item.playedMs || (item.duration ? item.duration * 60000 : 0) || 0;
              weekMap[dayKey].duration += dur;
              weekMap[dayKey].hours = Number((weekMap[dayKey].duration / 3600000).toFixed(2));
            }
          }
        });
        return Object.values(weekMap).sort((a, b) => a.timestamp - b.timestamp);
      }

      // Last fallback: historyData
      if (historyData && historyData.length > 0) {
        const weekMap: Record<string, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dayKey = getDayKey(d);
          const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          weekMap[dayKey] = {
            date: dayKey,
            displayLabel: dateLabel,
            timestamp: d.getTime(),
            streams: 0,
            duration: 0,
            hours: 0
          };
        }

        historyData.forEach((item) => {
          const d = new Date(item.date);
          if (!isNaN(d.getTime())) {
            const dayKey = getDayKey(d);
            if (weekMap[dayKey]) {
              weekMap[dayKey].streams += item.streams;
              weekMap[dayKey].duration += item.duration;
              weekMap[dayKey].hours = Number((weekMap[dayKey].duration / 60).toFixed(2));
            }
          }
        });
        return Object.values(weekMap).sort((a, b) => a.timestamp - b.timestamp);
      }
    }

    if (activeFilter === 'Mês') {
      // Try API data first (but it's likely empty)
      const monthlyDataPoints = datesItems?.monthDays || datesItems?.monthly || datesItems?.byMonthDay || datesItems?.daysOfMonth;
      if (monthlyDataPoints && Object.keys(monthlyDataPoints).length > 0) {
        const mapped = Object.entries(monthlyDataPoints).map(([dStr, v]: [string, any]) => {
           const d = Number(dStr);
           return {
             date: String(dStr),
             displayLabel: String(d).padStart(2, '0'),
             timestamp: d,
             streams: v.count ?? v.streams ?? v.c ?? 0,
             duration: getStatsDurationMsValue(v),
             hours: Number((getStatsDurationMsValue(v) / 3600000).toFixed(2))
           };
        }).sort((a,b) => a.timestamp - b.timestamp);

        const totalStreams = mapped.reduce((acc, d) => acc + d.streams, 0);
        if (totalStreams > 0) {
          return mapped.filter((point) => point.timestamp <= today.getDate());
        }
      }

      // Primary fallback: use filtered fullUserData.history
      const filteredHistory = getFilteredHistory();
      if (filteredHistory.length > 0) {
        const monthMap: Record<string, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
        const year = today.getFullYear();
        const month = today.getMonth();
        const currentDay = today.getDate();

        for (let day = 1; day <= currentDay; day++) {
          const d = new Date(year, month, day);
          const dayKey = getDayKey(d);
          const dateLabel = String(day).padStart(2, '0');
          monthMap[dayKey] = {
            date: dayKey,
            displayLabel: dateLabel,
            timestamp: d.getTime(),
            streams: 0,
            duration: 0,
            hours: 0
          };
        }

        filteredHistory.forEach((item: any) => {
          const dateVal = item.date || item.t || item.timestamp || item.ts || item.playedAt || item.played_at;
          let ts = typeof dateVal === 'number' ? dateVal : new Date(dateVal).getTime();
          if (ts < 2147483647) ts *= 1000;

          const d = new Date(ts);
          if (!isNaN(d.getTime())) {
            const dayKey = getDayKey(d);
            if (monthMap[dayKey]) {
              monthMap[dayKey].streams += 1;
              const dur = item.durationMs || item.playedMs || (item.duration ? item.duration * 60000 : 0) || 0;
              monthMap[dayKey].duration += dur;
              monthMap[dayKey].hours = Number((monthMap[dayKey].duration / 3600000).toFixed(2));
            }
          }
        });
        return Object.values(monthMap).sort((a, b) => a.timestamp - b.timestamp);
      }

      // Last fallback: historyData
      if (historyData && historyData.length > 0) {
        const monthMap: Record<string, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
        const year = today.getFullYear();
        const month = today.getMonth();
        const currentDay = today.getDate();

        for (let day = 1; day <= currentDay; day++) {
          const d = new Date(year, month, day);
          const dayKey = getDayKey(d);
          const dateLabel = String(day).padStart(2, '0');
          monthMap[dayKey] = {
            date: dayKey,
            displayLabel: dateLabel,
            timestamp: d.getTime(),
            streams: 0,
            duration: 0,
            hours: 0
          };
        }

        historyData.forEach((item) => {
          const d = new Date(item.date);
          if (!isNaN(d.getTime())) {
            const dayKey = getDayKey(d);
            if (monthMap[dayKey]) {
              monthMap[dayKey].streams += item.streams;
              monthMap[dayKey].duration += item.duration;
              monthMap[dayKey].hours = Number((monthMap[dayKey].duration / 60).toFixed(2));
            }
          }
        });
        return Object.values(monthMap).sort((a, b) => a.timestamp - b.timestamp);
      }
    }

    if (activeFilter === 'Ano') {
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

      // Try API data first (but it's likely empty)
      const yearlyDataPoints = datesItems?.months || datesItems?.yearly || datesItems?.byMonth || datesItems?.monthsOfYear;
      if (yearlyDataPoints && Object.keys(yearlyDataPoints).length > 0) {
        const mapped = Object.entries(yearlyDataPoints).map(([mStr, v]: [string, any]) => {
           const m = Number(mStr);
           return {
             date: String(mStr),
             displayLabel: monthNames[m - 1] || String(mStr),
             timestamp: m,
             streams: v.count ?? v.streams ?? v.c ?? 0,
             duration: getStatsDurationMsValue(v),
             hours: Number((getStatsDurationMsValue(v) / 3600000).toFixed(2))
           };
        }).sort((a,b) => a.timestamp - b.timestamp);

        const totalStreams = mapped.reduce((acc, m) => acc + m.streams, 0);
        if (totalStreams > 0) {
          return mapped;
        }
      }

      // Primary fallback: use filtered fullUserData.history
      const filteredHistory = getFilteredHistory();
      if (filteredHistory.length > 0) {
        const yearMap: Record<string, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        for (let m = 0; m <= currentMonth; m++) {
          const d = new Date(currentYear, m, 1);
          const key = `${currentYear}-${(m + 1).toString().padStart(2, '0')}`;
          yearMap[key] = {
            date: key,
            displayLabel: monthNames[m],
            timestamp: d.getTime(),
            streams: 0,
            duration: 0,
            hours: 0
          };
        }

        filteredHistory.forEach((item: any) => {
          const dateVal = item.date || item.t || item.timestamp || item.ts || item.playedAt || item.played_at;
          let ts = typeof dateVal === 'number' ? dateVal : new Date(dateVal).getTime();
          if (ts < 2147483647) ts *= 1000;

          const d = new Date(ts);
          if (!isNaN(d.getTime()) && d.getFullYear() === currentYear) {
            const m = d.getMonth();
            const key = `${currentYear}-${(m + 1).toString().padStart(2, '0')}`;
            if (yearMap[key]) {
              yearMap[key].streams += 1;
              const dur = item.durationMs || item.playedMs || (item.duration ? item.duration * 60000 : 0) || 0;
              yearMap[key].duration += dur;
              yearMap[key].hours = Number((yearMap[key].duration / 3600000).toFixed(2));
            }
          }
        });
        return Object.values(yearMap).sort((a, b) => a.timestamp - b.timestamp);
      }

      // Last fallback: historyData
      if (historyData && historyData.length > 0) {
        const yearMap: Record<string, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        for (let m = 0; m <= currentMonth; m++) {
          const d = new Date(currentYear, m, 1);
          const key = `${currentYear}-${(m + 1).toString().padStart(2, '0')}`;
          yearMap[key] = {
            date: key,
            displayLabel: monthNames[m],
            timestamp: d.getTime(),
            streams: 0,
            duration: 0,
            hours: 0
          };
        }

        historyData.forEach((item) => {
          const d = new Date(item.date);
          if (!isNaN(d.getTime()) && d.getFullYear() === currentYear) {
            const m = d.getMonth();
            const key = `${currentYear}-${(m + 1).toString().padStart(2, '0')}`;
            if (yearMap[key]) {
              yearMap[key].streams += item.streams;
              yearMap[key].duration += item.duration;
              yearMap[key].hours = Number((yearMap[key].duration / 60).toFixed(2));
            }
          }
        });
        return Object.values(yearMap).sort((a, b) => a.timestamp - b.timestamp);
      }
    }

	    // Default / Total - group by year, never cumulative.
	    const sourceHistory = fullUserData?.history && Array.isArray(fullUserData.history) && fullUserData.history.length > 0
	      ? fullUserData.history
	      : historyData;
	
	    if (sourceHistory && sourceHistory.length > 0) {
	      const totalMap: Record<string, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
	      sourceHistory.forEach((item: any) => {
	        const dateVal = item.date || item.t || item.timestamp || item.ts || item.playedAt || item.played_at;
	        let ts = typeof dateVal === 'number' ? dateVal : new Date(dateVal).getTime();
	        if (ts < 2147483647) ts *= 1000;
	
	        const d = new Date(ts);
	        if (isNaN(d.getTime())) return;
	        const year = String(d.getFullYear());
	
	        if (!totalMap[year]) {
	          totalMap[year] = {
	            date: year,
	            displayLabel: year,
	            timestamp: new Date(d.getFullYear(), 0, 1).getTime(),
	            streams: 0,
	            duration: 0,
	            hours: 0
          };
        }

        // Check if this is raw history (each item = 1 stream) or aggregated
        const isRawHistory = !('streams' in item) && !('count' in item);
	        totalMap[year].streams += isRawHistory ? 1 : (item.streams || item.count || 0);
	
	        const dur = item.durationMs || item.playedMs || (item.duration ? item.duration * 60000 : 0) || 0;
	        totalMap[year].duration += dur;
	        totalMap[year].hours = Number((totalMap[year].duration / 3600000).toFixed(2));
	      });
      return Object.values(totalMap).sort((a, b) => a.timestamp - b.timestamp);
    }

    return [];
  }, [datesData, historyData, activeFilter, fullUserData]);

  const hourlyDistributionData = useMemo(() => {
    // Robust multi-path navigation for API response
    const datesContainer = datesData?.stats || datesData?.data || datesData;
    const datesItems = datesContainer?.items || datesContainer?.stats?.items || datesContainer;

    // Try multiple possible keys for hourly data
    const activeHourly = datesItems?.hours || datesItems?.hourly || datesItems?.byHour || fullUserData?.statsDates?.hours;

    // DEV LOG - Mapear estrutura de hourlyDistributionData
    if ((import.meta as any).env?.DEV) {
      console.group(`[StatsScreen DEV] hourlyDistributionData Mapper - Filter: ${activeFilter}`);
      console.log('datesData.empty:', datesData?.empty);
      console.log('activeHourly exists:', !!activeHourly);
      console.log('fullUserData?.history length:', fullUserData?.history?.length);
      console.log('historyData length:', historyData?.length);

      // Check if API dates is empty and we need to use history fallback
      if (datesData?.empty && fullUserData?.history?.length > 0) {
        console.debug('[StatsScreen] API /stats-dates returned empty. Using fullUserData.history for hourly distribution.');
      }
      console.groupEnd();
    }

    if (activeHourly && Object.keys(activeHourly).length > 0) {
      const mapped = [];
      for (let h = 0; h < 24; h++) {
         const d = activeHourly[String(h)] || { count: 0, durationMs: 0 };
         mapped.push({
           hour: h,
           streams: d.count ?? d.streams ?? d.c ?? 0,
           duration: getStatsDurationMsValue(d)
         });
      }

      // Check if we got real data
      const totalStreams = mapped.reduce((acc, h) => acc + h.streams, 0);
      if (totalStreams > 0) {
        return mapped;
      }
    }

    // Build default hourly distribution of 24 hours with zeros
    const hourlyMap: Record<number, { hour: number; streams: number; duration: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { hour: h, streams: 0, duration: 0 };
    }

    // Primary source: fullUserData.history (complete history, not filtered by period)
    const fullHistory = (Array.isArray(historyData) && historyData.length > 0)
      ? historyData
      : fullUserData?.history || fullUserData?.streams || fullUserData?.recent || fullUserData?.scrobbles || [];

    const sourceData = (fullHistory && Array.isArray(fullHistory) && fullHistory.length > 0)
      ? fullHistory
      : historyData;
    const periodStart = activeFilter === 'Hoje'
      ? getStartOfTodaySP().getTime()
      : activeFilter === 'Semana'
        ? getStartOfWeekSP().getTime()
        : activeFilter === 'Mês'
          ? getStartOfMonthSP().getTime()
          : activeFilter === 'Ano'
            ? getStartOfYearSP().getTime()
            : 0;

    if (sourceData && sourceData.length > 0) {
      sourceData.forEach((item: any) => {
        let dateVal = item.date || item.t || item.timestamp || item.ts || item.time || item.playedAt || item.played_at || item.dt;
        if (!dateVal) return;

        // Handle unix timestamps in seconds
        if (typeof dateVal === 'number' && dateVal < 2147483647) {
          dateVal = dateVal * 1000;
        }
        const timestamp = typeof dateVal === 'number' ? dateVal : new Date(dateVal).getTime();
        if (!Number.isFinite(timestamp) || timestamp < periodStart || timestamp > Date.now()) return;

        const hour = getHourSP(dateVal);

        if (hour >= 0 && hour < 24 && hourlyMap[hour]) {
          // Check if this is raw history (each item = 1 stream) or aggregated
          const hasExplicitCount = ('streams' in item) || ('count' in item) || ('c' in item) || ('plays' in item) || ('playcount' in item) || ('scrobbles' in item);
          const streamCount = hasExplicitCount
            ? (item.streams || item.count || item.c || item.plays || item.playcount || item.scrobbles || 0)
            : 1; // Raw history: each item = 1 stream

          const dur = item.durationMs || item.playedMs || (item.duration ? item.duration * 60000 : 0) || 0;

          hourlyMap[hour].streams += Number(streamCount);
          hourlyMap[hour].duration += Number(dur);
        }
      });
    }

    return Object.values(hourlyMap);
  }, [datesData, historyData, fullUserData, activeFilter]);

  const getStatsByFilter = () => {
    if (!fullUserData) return null;
    
    // Look for stats in different possible locations
    const statsContainer = fullUserData.stats || fullUserData;
    
    switch (activeFilter) {
      case 'Hoje': return statsContainer.today || statsContainer.day;
      case 'Semana': return statsContainer.week || statsContainer['7days'];
      case 'Mês': return statsContainer.month || statsContainer.months || statsContainer['30days'];
      case 'Ano': return statsContainer.year || statsContainer.current_year || statsContainer['365days'];
      case 'Total': return statsContainer.lifetime || statsContainer.total || statsContainer.overall;
      default: return statsContainer.today;
    }
  };

  const currentStats = getStatsByFilter();

  const periodSummaryStats = useMemo(() => {
    // 1. If we have activeRangeStats dynamically updated from the API
    if (activeRangeStats && (activeRangeStats.count > 0 || activeRangeStats.durationMs > 0)) {
      return activeRangeStats;
    }
    
    // 2. Fallback to fullUserData pre-computed snapshot
    if (currentStats) {
      return {
        count: getStatsCountValue(currentStats),
        durationMs: getStatsDurationMsValue(currentStats)
      };
    }
    
    // 3. Fallback to summing up historyData
    if (historyData && historyData.length > 0) {
      const sumStreams = historyData.reduce((acc, item) => acc + (item.streams || 0), 0);
      const sumDurationMs = historyData.reduce((acc, item) => acc + (item.duration * 60 * 1000 || 0), 0);
      return {
        count: sumStreams,
        durationMs: sumDurationMs
      };
    }
    
    return { count: 0, durationMs: 0 };
  }, [activeRangeStats, currentStats, historyData]);

  const chartDisplayData = useMemo(() => {
    return dailyEvolutionData;
  }, [dailyEvolutionData]);
  const chartCoverage = datesData?.coverage;
  const isChartCoveragePartial = chartCoverage?.partial === true;
  const chartCoverageLabel = isChartCoveragePartial
    ? `${coreUtils.formatNumber(chartCoverage?.aggregatedCount || 0)} de ${coreUtils.formatNumber(chartCoverage?.totalCount || 0)}`
    : '';

  const { uniqueArtists, uniqueTracks, uniqueAlbums } = useMemo(() => {
    const cardContainer = cardinalityData?.stats || cardinalityData;
    const cardItems = cardContainer?.items || cardContainer;
    return {
      uniqueArtists: cardItems?.cardinality?.artists || (activePeriodArtists && activePeriodArtists.length > 0 ? activePeriodArtists.length : 0),
      uniqueTracks: cardItems?.cardinality?.tracks || (activePeriodTracks && activePeriodTracks.length > 0 ? activePeriodTracks.length : 0),
      uniqueAlbums: cardItems?.cardinality?.albums || (activePeriodAlbums && activePeriodAlbums.length > 0 ? activePeriodAlbums.length : 0)
    };
  }, [cardinalityData, activePeriodArtists, activePeriodTracks, activePeriodAlbums]);

  const insights = useMemo(() => {
    if (!user) return [];
    const list = [];
    const periodName = activeFilter === 'Hoje' ? 'hoje' : activeFilter === 'Semana' ? 'esta semana' : activeFilter === 'Mês' ? 'este mês' : activeFilter === 'Ano' ? 'este ano' : 'todo o período';
    
    // Insight 1: Em Alta (Música nº 1 do período)
    if (activePeriodTracks && activePeriodTracks.length > 0) {
      const topTrack = activePeriodTracks[0];
      const streamsCount = topTrack.playcount || topTrack.streams || topTrack.count || 0;
      list.push({
        title: "Em Alta",
        description: `Sua música líder absoluta ${periodName}: "${topTrack.name || (topTrack as any).track?.name}" por ${topTrack.artist?.name || 'Vários Artistas'}.`,
        icon: PlayCircle,
        value: `${coreUtils.formatNumber(streamsCount)} stream${streamsCount !== 1 ? 's' : ''}`
      });
    }

    // Insight 2: Artista Predileto (Nº 1 Artista)
    if (activePeriodArtists && activePeriodArtists.length > 0) {
      const topArtist = activePeriodArtists[0];
      const streamsCount = topArtist.playcount || topArtist.streams || topArtist.count || 0;
      list.push({
        title: "Artista Favorito",
        description: `Seu canal mais sintonizado ${periodName} é "${topArtist.name}".`,
        icon: UserCircle,
        value: `${coreUtils.formatNumber(streamsCount)} tocadas`
      });
    }

    // Insight 3: Imersão Musical (Tempo de audição adaptativo)
    const trackedDurationMs = periodSummaryStats.durationMs;
    if (trackedDurationMs && trackedDurationMs > 0) {
      list.push({
        title: "Imersão Sonora",
        description: `Você dedicou bastante tempo escutando suas músicas preferidas ${periodName}.`,
        icon: Clock,
        value: coreUtils.formatDuration(trackedDurationMs)
      });
    }

    // Insight 4: Paleta Musical & Diversidade de Artistas
    if (uniqueArtists > 0) {
      let desc = '';
      if (uniqueArtists > 15) {
        desc = `Explorador nata! Você sintonizou uma enorme lista de ${uniqueArtists} artistas diferentes ${periodName}.`;
      } else if (uniqueArtists > 5) {
        desc = `Sua paleta de preferências variou entre ${uniqueArtists} criadores musicais ${periodName}.`;
      } else {
        desc = `Foco e fidelidade: Você concentrou sua atenção em ${uniqueArtists} artistas específicos ${periodName}.`;
      }
      list.push({
        title: "Paleta Musical",
        description: desc,
        icon: Star,
        value: `${uniqueArtists} artistas`
      });
    }

    // Insight 4.5: Diversidade de Faixas (Nova Cardinalidade)
    if (uniqueTracks > 0) {
      list.push({
        title: "Diversidade de Faixas",
        description: `Você navegou por um catálogo de ${uniqueTracks} faixas distintas.`,
        icon: Music2,
        value: `${uniqueTracks} faixas`
      });
    }
    
    // Insight 4.6: Diversidade de Álbuns (Nova Cardinalidade)
    if (uniqueAlbums > 0) {
      list.push({
        title: "Diversidade de Álbuns",
        description: `Sua exploração alcançou ${uniqueAlbums} álbuns diferentes.`,
        icon: Disc,
        value: `${uniqueAlbums} álbuns`
      });
    }

    // Insight 5: Álbum em Destaque (Nº 1 Álbum)
    if (activePeriodAlbums && activePeriodAlbums.length > 0) {
      const topAlbum = activePeriodAlbums[0];
      const albumStreams = topAlbum.playcount || topAlbum.streams || topAlbum.count || 0;
      list.push({
        title: "Álbum Preferido",
        description: `O compilado mais reproduzido ${periodName} foi "${topAlbum.name}" com ${albumStreams} streams.`,
        icon: Disc,
        value: "Top Álbum"
      });
    }

    // Insight 6: Índice de Consistência (Média de Streams por Artista)
    if (activePeriodArtists && activePeriodArtists.length > 0 && periodSummaryStats.count > 0) {
      const avgStreams = (periodSummaryStats.count / activePeriodArtists.length).toFixed(1);
      list.push({
        title: "Consistência",
        description: `Você ouviu uma média de ${avgStreams} streams de cada um dos seus artistas sintonizados.`,
        icon: Zap,
        value: `Média de ${avgStreams}`
      });
    }

    // Insight 7: Descoberta ou Joias Escondidas
    if (activePeriodTracks && activePeriodTracks.length > 1) {
      const discoveryTrack = activePeriodTracks.find((t: any) => {
        const count = t.playcount || t.streams || t.count || 0;
        return count === 1 || count === 2;
      });

      if (discoveryTrack) {
        const playedByOthers = members.some((m: any) => {
          if (m.id === CURRENT_USER_ID) return false;
          const friendTracks = m.topItems?.tracks || [];
          return friendTracks.some((tt: any) => 
            coreUtils.normalizeText(tt.name) === coreUtils.normalizeText(discoveryTrack.name || (discoveryTrack as any).track?.name)
          );
        });

        if (!playedByOthers) {
          list.push({
            title: "Descoberta",
            description: `Você ouviu "${discoveryTrack.name || (discoveryTrack as any).track?.name}" para catalogar nova música em sua coleção.`,
            icon: Sparkles,
            value: "Inédita",
            isDiscovery: true
          });
        }
      }
    }

    if (list.length === 0) {
      list.push({
        title: "Falta de dados",
        description: "Adicione mais streams à sua biblioteca para gerar novas análises inteligentes.",
        icon: Flame,
        value: "0 insights"
      });
    }

    return list;
  }, [user, activePeriodArtists, activePeriodTracks, activePeriodAlbums, periodSummaryStats, activeFilter, members, CURRENT_USER_ID]);

  // Reset index when filter/insights list change to prevent out of bounds
  useEffect(() => {
    setCurrentInsightIndex(0);
  }, [activeFilter]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const timer = setTimeout(() => {
      setCurrentInsightIndex((prev) => (prev + 1) % insights.length);
    }, 6000); // 6 seconds before next auto-rotation
    return () => clearTimeout(timer);
  }, [currentInsightIndex, insights.length]);

  useEffect(() => {
    let cancelled = false;
    async function loadAllPeriodData() {
      if (!CURRENT_USER_ID) return;
      const fallbackTops = (user?.topItems || {}) as { artists?: any[]; tracks?: any[]; albums?: any[] };
      const hasFallbackTops =
        !!fallbackTops.artists?.length ||
        !!fallbackTops.tracks?.length ||
        !!fallbackTops.albums?.length;

      if (hasFallbackTops) {
        setActivePeriodArtists(prev => prev.length > 0 ? prev : (fallbackTops.artists || []));
        setActivePeriodTracks(prev => prev.length > 0 ? prev : (fallbackTops.tracks || []));
        setActivePeriodAlbums(prev => prev.length > 0 ? prev : (fallbackTops.albums || []));
      }

      setIsTopItemsLoading(!hasFallbackTops);
      setTopItemsError(null);
      try {
        const period = periodMap[activeFilter];
        const [artists, tracks, albums] = await Promise.all([
          statsService.getTopItems(CURRENT_USER_ID, 'artists', period),
          statsService.getTopItems(CURRENT_USER_ID, 'tracks', period),
          statsService.getTopItems(CURRENT_USER_ID, 'albums', period)
        ]);
        if (cancelled) return;
        setActivePeriodArtists((artists && artists.length > 0) ? artists : (fallbackTops.artists || []));
        setActivePeriodTracks((tracks && tracks.length > 0) ? tracks : (fallbackTops.tracks || []));
        setActivePeriodAlbums((albums && albums.length > 0) ? albums : (fallbackTops.albums || []));
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load period top items for StatsScreen", e);
          const fallbackTops = (user?.topItems || {}) as { artists?: any[]; tracks?: any[]; albums?: any[] };
          if ((fallbackTops.artists || fallbackTops.tracks || fallbackTops.albums)) {
            setTopItemsError(null);
            setActivePeriodArtists(fallbackTops.artists || []);
            setActivePeriodTracks(fallbackTops.tracks || []);
            setActivePeriodAlbums(fallbackTops.albums || []);
          } else {
            setTopItemsError("Nao foi possivel carregar seus mais tocados agora.");
            setActivePeriodArtists([]);
            setActivePeriodTracks([]);
            setActivePeriodAlbums([]);
          }
        }
      } finally {
        if (!cancelled) setIsTopItemsLoading(false);
      }
    }
    loadAllPeriodData();
    return () => {
      cancelled = true;
    };
  }, [CURRENT_USER_ID, activeFilter, activeStatsSection, topItemsRetryNonce, user?.topItems]);

  useEffect(() => {
    let cancelled = false;
    async function loadFriendReplayData() {
      if (!replayOwnerId || replayOwnerId === CURRENT_USER_ID) {
        setIsFriendReplayLoading(false);
        setFriendReplayItems({ artists: [], tracks: [], albums: [] });
        return;
      }

      const friend = members.find(member => member.id === replayOwnerId);
      const fallbackTops = (friend?.topItems || {}) as { artists?: any[]; tracks?: any[]; albums?: any[] };
      setFriendReplayItems({
        artists: fallbackTops.artists || [],
        tracks: fallbackTops.tracks || [],
        albums: fallbackTops.albums || []
      });
      setIsFriendReplayLoading(true);

      try {
        const period = periodMap[activeFilter];
        const [artists, tracks, albums] = await Promise.all([
          statsService.getTopItems(replayOwnerId, 'artists', period),
          statsService.getTopItems(replayOwnerId, 'tracks', period),
          statsService.getTopItems(replayOwnerId, 'albums', period)
        ]);
        if (cancelled) return;
        setFriendReplayItems({
          artists: (artists && artists.length > 0) ? artists : (fallbackTops.artists || []),
          tracks: (tracks && tracks.length > 0) ? tracks : (fallbackTops.tracks || []),
          albums: (albums && albums.length > 0) ? albums : (fallbackTops.albums || [])
        });
      } catch (error) {
        if (!cancelled) {
          setFriendReplayItems({
            artists: fallbackTops.artists || [],
            tracks: fallbackTops.tracks || [],
            albums: fallbackTops.albums || []
          });
        }
      } finally {
        if (!cancelled) setIsFriendReplayLoading(false);
      }
    }
    loadFriendReplayData();
    return () => {
      cancelled = true;
    };
  }, [CURRENT_USER_ID, activeFilter, members, replayOwnerId]);

  const topItems = useMemo(() => {
    if (activeType === 'artists') return activePeriodArtists;
    if (activeType === 'tracks') return activePeriodTracks;
    return activePeriodAlbums;
  }, [activeType, activePeriodArtists, activePeriodTracks, activePeriodAlbums]);

  const filteredTopItems = useMemo(() => {
    if (!searchQuery.trim()) return topItems;
    const q = searchQuery.toLowerCase();
    return topItems.filter((item: any) => {
      const name = item.name || item.track?.name || '';
      const artist = item.artist?.name || item.albumName || '';
      return name.toLowerCase().includes(q) || artist.toLowerCase().includes(q);
    });
  }, [topItems, searchQuery]);

  const itemData = useMemo(() => ({
    items: filteredTopItems,
    activeType,
    members,
    currentUserId: CURRENT_USER_ID,
    onTrackClick: setSelectedTrackHistory
  }), [filteredTopItems, activeType, members, CURRENT_USER_ID]);

  const replayOwner = members.find(member => member.id === replayOwnerId) || user;
  const replayOwnerFirstName = replayOwnerId === CURRENT_USER_ID
    ? 'Você'
    : (replayOwner?.name || 'Amigo').trim().split(/\s+/)[0] || 'Amigo';
  const replaySourceItems = replayOwnerId === CURRENT_USER_ID
    ? { artists: activePeriodArtists, tracks: activePeriodTracks, albums: activePeriodAlbums }
    : friendReplayItems;
  const hasReplayItems =
    replaySourceItems.artists.length > 0 ||
    replaySourceItems.tracks.length > 0 ||
    replaySourceItems.albums.length > 0;
  const replayDurationMs = replayOwnerId === CURRENT_USER_ID
    ? periodSummaryStats.durationMs
    : (replaySourceItems.tracks || []).reduce((sum, item: any) => {
        const count = item.playcount || item.streams || item.count || 0;
        const durationMs = item.durationMs || item.track?.durationMs || item.playedMs || 0;
        return sum + (Number(durationMs) || 0) * (Number(count) || 0);
      }, 0);
  const isReplayLoading = replayOwnerId === CURRENT_USER_ID ? isTopItemsLoading : isFriendReplayLoading;
  const openRankingsFromReplay = (type: ItemType) => {
    setActiveType(type);
    setActiveStatsSection('rankings');
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document.getElementById('search-bar-ranking')?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    });
  };

  if (!user) {
    return (
      <div className="flex flex-col gap-6 px-4 py-12">
        <Skeleton className="h-12 w-48" />
        <div className="flex gap-4">
           <Skeleton className="h-32 flex-1 rounded-[32px]" />
           <Skeleton className="h-32 flex-1 rounded-[32px]" />
        </div>
        <Skeleton className="h-80 w-full rounded-[40px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-32 px-4">
      {/* Universal Period Filter */}
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+12px)] z-50 w-full py-3">
        <div className="glass-aura relative z-10 flex w-full gap-1.5 overflow-x-auto rounded-[9999px] p-1.5 no-scrollbar">
          {/* Glossy shine reflection top half */}
          <div className="absolute inset-x-6 top-[0.5px] h-[0.5px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setStatsPeriod(f);
              }}
              className={clsx(
                "filter-pill relative z-10 flex-1 shrink-0 cursor-pointer select-none rounded-full px-2 py-3 text-center text-[10.5px] font-black uppercase tracking-[0.14em] transition-[background-color,color,filter,transform] duration-200",
                activeFilter === f
                  ? "bg-white/[0.055] text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.25)]"
                  : "text-white/45 hover:bg-white/[0.035] hover:text-white/75"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+82px)] z-40 -mt-1">
        <div className="grid grid-cols-3 gap-1 rounded-3xl border border-white/8 bg-black/72 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          {statsSections.map((section) => {
            const Icon = section.icon;
            const isActive = activeStatsSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveStatsSection(section.id)}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[7px] font-black uppercase tracking-[0.1em] transition-[color,transform] duration-200 active:scale-[0.96]",
                  isActive ? "text-orange-400" : "text-white/35 hover:text-white/60"
                )}
              >
                {isActive && (
                  <motion.span
                    className="absolute inset-0 rounded-2xl border border-orange-500/20 bg-orange-500/10"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                <Icon className="relative h-3.5 w-3.5" />
                <span className="relative">{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={activeStatsSection}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3"
        >
      {activeStatsSection === 'overview' && (
        <>
          {/* Hero Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={`hero-summary-${activeFilter}`}
            className="glass-card p-6 border-white/[0.08] bg-black/40 backdrop-blur-xl relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            {/* Glossy shine reflection */}
            <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none rounded-t-[32px]" />

            {/* Background glow */}
            <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-orange-500/15 blur-3xl" />

            <div className="relative z-10 flex flex-col gap-5">
              {/* Main Metrics Row */}
              <div className="flex items-start justify-between gap-4">
                {/* Streams - Primary */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-orange-500 border border-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.15)]">
                      <PlayCircle className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em]">Streams</span>
                  </div>
                  <span className="text-[32px] font-display font-black text-white leading-none tracking-tight drop-shadow-[0_2px_8px_rgba(255,255,255,0.1)]">
                    {coreUtils.formatNumber(periodSummaryStats.count)}
                  </span>
                </div>

                {/* Time Listened - Secondary */}
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em]">Tempo</span>
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/[0.06] text-white/60 border border-white/[0.08]">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <span className="text-[16px] font-display font-black text-white/80 leading-none tracking-tight">
                    {coreUtils.formatDuration(periodSummaryStats.durationMs)}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

              {/* Cardinality Chips */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm shadow-inner">
                  <UserCircle className="h-4 w-4 text-orange-500/80" />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-black text-white leading-none">{uniqueArtists || 0}</span>
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-wider leading-none mt-0.5">Artistas</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm shadow-inner">
                  <Music2 className="h-4 w-4 text-orange-500/80" />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-black text-white leading-none">{uniqueTracks || 0}</span>
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-wider leading-none mt-0.5">Músicas</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm shadow-inner">
                  <Disc className="h-4 w-4 text-orange-500/80" />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-black text-white leading-none">{uniqueAlbums || 0}</span>
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-wider leading-none mt-0.5">Álbuns</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {CURRENT_USER_ID && (activePeriodTracks.length > 0 || activePeriodArtists.length > 0) && (
            <PerceptionsPanel
              tracks={activePeriodTracks}
              artists={activePeriodArtists}
              userId={CURRENT_USER_ID}
              activeTab={filterToReplayTab(activeFilter)}
              selectedSubValues={statsReplaySubValues}
            />
          )}

          {/* Insights + Replay */}
          {insights.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionHeader
                title="Insights de Reprodução"
                icon={<Zap className="h-3 w-3 text-orange-500" />}
                action={insights.length > 1 ? (
                  <div className="glass-aura flex items-center gap-1 rounded-full px-2 py-1">
                    <span className="mr-1 text-[9px] font-black text-white/45">{((currentInsightIndex % insights.length) + 1)}/{insights.length}</span>
                    <button type="button" onClick={() => setCurrentInsightIndex((prev) => (prev - 1 + insights.length) % insights.length)} className="rounded-full p-1 text-white/55 active:scale-90">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setCurrentInsightIndex((prev) => (prev + 1) % insights.length)} className="rounded-full p-1 text-white/55 active:scale-90">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              />
              {(() => {
                const insight = insights[currentInsightIndex % insights.length];
                if (!insight) return null;
                return (
                  <motion.div
                    key={`stats-insight-${currentInsightIndex}`}
                    initial={{ opacity: 0, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.985 }}
                    className="glass-aura relative overflow-hidden rounded-[28px] px-5 py-4"
                    style={{ willChange: 'transform, opacity' }}
                  >
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="glass-aura-orange flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white">
                        <insight.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-400">{insight.title}</span>
                        <p className="mt-1 text-[13px] font-semibold leading-snug text-white/84">{insight.description}</p>
                        <span className="mt-2 inline-flex rounded-full bg-orange-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">{insight.value}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {activeStatsSection === 'replay' && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            title="Replay do Período"
            icon={<PlayCircle className="h-3.5 w-3.5 text-orange-500" />}
          />
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-fade-h" data-home-horizontal-scroll="true">
            {members.map((member) => {
              const isSelected = member.id === replayOwnerId;
              return (
                <button
                  key={`stats-replay-owner-${member.id}`}
                  type="button"
                  onClick={() => setReplayOwnerId(member.id)}
                  className={clsx(
                    "glass-aura flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 transition-[background-color,border-color,color,opacity,transform] duration-200 active:scale-95",
                    isSelected ? "text-orange-300 ring-1 ring-orange-500/25" : "text-white/42 opacity-72"
                  )}
                  title={`Ver Replay de ${member.name}`}
                >
                  <div className={clsx("h-7 w-7 overflow-hidden rounded-full border", isSelected ? "border-orange-500" : "border-white/10")}>
                    <SmartImage src={coreUtils.getUserAvatar(member.id, member.avatar)} className="h-full w-full object-cover" fallback="" rounded="full" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.12em]">
                    {member.id === CURRENT_USER_ID ? 'Você' : (member.name || '').split(/\s+/)[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {hasReplayItems ? (
            <Suspense fallback={<div className="glass-aura h-48 rounded-[32px] animate-pulse" />}>
              <ReplaySection
                topArtists={replaySourceItems.artists.slice(0, 20).map((a: any) => ({
                  id: a.id || a.name,
                  name: a.name,
                  image: a.image || a.artist?.image,
                  streams: a.playcount || a.streams || a.count || 0,
                  minutes: getReplayItemMinutes(a, 'artists')
                }))}
                topTracks={replaySourceItems.tracks.slice(0, 30).map((t: any) => ({
                  id: t.id || t.name,
                  name: t.name || t.track?.name,
                  artist: getStatsItemArtistName(t) || 'Artista',
                  image: t.image || t.album?.image || t.albumImage,
                  streams: t.playcount || t.streams || t.count || 0,
                  minutes: getReplayItemMinutes(t, 'tracks')
                }))}
                topAlbums={replaySourceItems.albums.slice(0, 15).map((a: any) => ({
                  id: a.id || a.name,
                  name: a.name,
                  artist: a.artist?.name || a.artistName || '',
                  image: a.image || a.album?.image,
                  streams: a.playcount || a.streams || a.count || 0,
                  minutes: getReplayItemMinutes(a, 'albums')
                }))}
                totalMinutesCount={Math.max(0, Math.round((replayDurationMs || 0) / 60000))}
                activeTab={statsReplayTab}
                selectedSubValues={statsReplaySubValues}
                onActiveTabChange={handleReplayTabChange}
                onSelectedSubValuesChange={setStatsReplaySubValues}
                onOpenArtistsModal={() => openRankingsFromReplay('artists')}
                onOpenSongsModal={() => openRankingsFromReplay('tracks')}
                onOpenAlbumsModal={() => openRankingsFromReplay('albums')}
                onOpenTrack={(track) => setSelectedTrack({ ...track, type: 'track' })}
                isLoading={isReplayLoading}
                ownerFirstName={replayOwnerFirstName}
              />
            </Suspense>
          ) : (
            <StatsEmptyPanel
              icon={isReplayLoading ? RefreshCcw : PlayCircle}
              eyebrow={isReplayLoading ? "Carregando" : activeFilter}
              title={isReplayLoading ? "Montando replay" : "Replay sem faixas ainda"}
              description={isReplayLoading
                ? "Buscando artistas, músicas e álbuns para compor este recorte."
                : "Quando houver dados neste período, o replay aparece aqui com artistas, faixas e álbuns em destaque."
              }
              action={!isReplayLoading ? (
                <button
                  type="button"
                  onClick={() => setStatsPeriod('Total')}
                  className="rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-orange-200 active:scale-95"
                >
                  Ver total
                </button>
              ) : null}
            />
          )}
        </div>
      )}

      {activeStatsSection === 'overview' && (
        <>
          {/* Análise Temporal - Gráficos */}
          <div className="flex flex-col gap-3">
            <SectionHeader
              title="Análise Temporal"
              icon={<BarChart3 className="h-3 w-3 text-orange-500" />}
            />

            {/* Evolução de Atividade */}
            <div className="glass-card p-6 border-white/[0.08] bg-black/40 backdrop-blur-xl flex flex-col gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
              {/* Glossy shine */}
              <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none rounded-t-[32px]" />

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Evolução de Atividade</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isChartCoveragePartial && (
                    <div
                      className="rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.12em] text-white/42"
                      title={`Cobertura parcial: ${chartCoverageLabel} reproduções agregadas`}
                    >
                      amostra
                    </div>
                  )}
                  <div className="bg-orange-500/10 border border-orange-500/30 py-1 px-2.5 rounded-full text-[8.5px] font-black uppercase tracking-widest text-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.15)]">
                    {activeFilter}
                  </div>
                </div>
              </div>

              {/* Toggle chart metric */}
              <div className="flex gap-1.5 bg-black/40 border border-white/[0.08] p-1 rounded-xl w-full relative z-10">
                {[
                  { metric: 'streams', label: 'Streams' },
                  { metric: 'hours', label: 'Horas' }
                ].map((btn) => (
                  <button
                    key={btn.metric}
                    type="button"
                    onClick={() => {
                      setChartMetric(btn.metric as any);
                      trackEvent('stats_chart_metric_changed', { metric: btn.metric });
                    }}
                    className={clsx(
                      "flex-1 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] rounded-lg transition-[background-color,color,box-shadow,transform] duration-200 text-center cursor-pointer",
                      chartMetric === btn.metric
                        ? "bg-gradient-to-b from-orange-500 to-orange-600 text-black shadow-[0_0_12px_rgba(249,115,22,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <div className="h-56 w-full mt-2 relative z-10">
                {chartError ? (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center">
                    <AlertTriangle className="h-9 w-9 text-orange-400/80" />
                    <div className="flex flex-col items-center gap-1 px-4">
                      <span className="text-[11px] font-black uppercase tracking-widest text-white/65">Falha ao carregar</span>
                      <span className="text-[9px] text-white/35 leading-relaxed">{chartError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChartRetryNonce((value) => value + 1)}
                      className="rounded-2xl bg-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/70 active:scale-95"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : isChartLoading && dailyEvolutionData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCcw className="h-6 w-6 text-white/10 animate-spin" />
                  </div>
                ) : (() => {
                  // Check if all data points are zero
                  const hasRealData = chartDisplayData.length > 0 && chartDisplayData.some(d => (d.streams || 0) > 0 || (d.hours || 0) > 0);

                  if (!hasRealData) {
                    return (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-3 opacity-40">
                        <TrendingUp className="h-10 w-10 text-white/30" />
                        <div className="flex flex-col items-center gap-1 text-center px-4">
                          <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Sem dados suficientes</span>
                          <span className="text-[9px] text-white/30 leading-relaxed">
                            Ainda não há dados para montar a evolução deste período.
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className={clsx("h-full w-full transition-opacity duration-200", isChartLoading && "opacity-35 pointer-events-none")}>
                      <MeasuredActivityAreaChart data={chartDisplayData} chartMetric={chartMetric} accentColor={accentColor} />
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Distribuição Horária */}
            <div className="transition-opacity duration-300">
              {chartError ? null : isChartLoading && (!hourlyDistributionData || hourlyDistributionData.length === 0 || hourlyDistributionData.every(d => d.streams === 0)) ? (
                <div className="glass-card p-6 border-white/[0.08] bg-black/40 backdrop-blur-xl flex flex-col gap-5 opacity-40 animate-pulse shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-white/30" />
                      <div className="h-3.5 w-32 bg-white/10 rounded-full" />
                    </div>
                    <div className="h-2 w-16 bg-white/5 rounded-full" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-12 gap-1.5">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="aspect-square bg-white/5 rounded-lg border border-white/5" />
                      ))}
                    </div>
                    <div className="flex justify-between px-1">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="h-2 w-4 bg-white/5 rounded-full" />
                      ))}
                    </div>
                  </div>
                </div>
	              ) : (() => {
	                const hasHourlyShape = hourlyDistributionData && hourlyDistributionData.length > 0;
	                if (!hasHourlyShape) return null;
	
	                return (
                  <div className={clsx(isChartLoading && "opacity-40 pointer-events-none")}>
                    {isChartCoveragePartial && (
                      <p className="mb-2 px-2 text-[8px] font-black uppercase tracking-[0.12em] text-white/28">
                        Distribuição baseada em amostra de {chartCoverageLabel} reproduções
                      </p>
                    )}
                    <Suspense fallback={<div className="glass-card p-6 border-white/5 h-36 animate-pulse" />}>
                      <DailyActivityHeatmap
                        data={hourlyDistributionData}
                        accentColor={accentColor}
                        periodLabel={activeFilter}
                      />
                    </Suspense>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {activeStatsSection === 'rankings' && (
        <>
          {/* Rankings Section */}
          <SectionHeader 
            title="Meus Mais Tocados" 
            icon={<BarChart3 className="h-4 w-4 text-orange-500" />} 
          />

          {/* Category Selector (Artists, Músicas, Álbuns) */}
          <div className="flex gap-2 px-1 mb-2">
            {(['artists', 'tracks', 'albums'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setActiveType(t);
                  trackEvent('stats_category_changed', { category: t });
                }}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform] duration-200 cursor-pointer",
                  activeType === t 
                    ? "bg-orange-500/10 border-orange-500/20 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]" 
                    : "bg-white/[0.02] border-white/5 text-white/40 hover:text-white/60 hover:bg-white/[0.05]"
                )}
              >
                {t === 'artists' ? <UserCircle className="h-3.5 w-3.5" /> : t === 'tracks' ? <Music2 className="h-3.5 w-3.5" /> : <Disc className="h-3.5 w-3.5" />}
                <span className="text-[9px] font-black uppercase tracking-widest">{t === 'artists' ? 'Artistas' : t === 'tracks' ? 'Músicas' : 'Álbuns'}</span>
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div id="search-bar-ranking" className="relative mt-1 mb-1">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) {
                  trackEvent('ranking_search_query_changed', { queryLength: e.target.value.length });
                }
              }}
              placeholder={activeType === 'artists' ? "Buscar por nome do artista..." : activeType === 'tracks' ? "Buscar por música ou artista..." : "Buscar por álbum ou artista..."}
              className="w-full bg-white/[0.02] border border-white/5 hover:border-white/10 focus:border-orange-500/30 rounded-2xl py-2.5 pl-10 pr-10 text-xs font-semibold text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-orange-500/20 shadow-inner transition-[background-color,border-color,box-shadow,color] duration-200"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
              <Search className="h-4 w-4" />
            </div>
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery("");
                  trackEvent('ranking_search_cleared');
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/10 active:scale-95 transition-[background-color,border-color,color,transform] duration-200"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
          
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={`ranking-list-${activeType}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.21, 1.02, 0.43, 1.01] }}
              className={clsx(
                "flex flex-col gap-2.5 transition-opacity duration-300",
                isTopItemsLoading && filteredTopItems.length > 0 ? "opacity-35 pointer-events-none" : "opacity-100"
              )}
            >
              {topItemsError ? (
                <div className="py-16 flex flex-col items-center gap-4 text-center rounded-[28px] border border-orange-500/15 bg-orange-500/[0.04]">
                  <AlertTriangle className="h-8 w-8 text-orange-400/80" />
                  <div className="flex flex-col items-center gap-1 px-5">
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/65">Ranking indisponivel</span>
                    <span className="max-w-xs text-[10px] font-medium leading-relaxed text-white/35">{topItemsError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTopItemsRetryNonce((value) => value + 1)}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/70 active:scale-95"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : isTopItemsLoading && filteredTopItems.length === 0 ? (
                <StatsRankingLoading />
              ) : filteredTopItems.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {filteredTopItems.slice(0, visibleItemsCount).map((item, index) => (
                    <TopRankingRow
                      key={item.id || `${activeType}-${index}`}
                      item={item}
                      index={index}
                      activeType={activeType}
                      members={members}
                      currentUserId={CURRENT_USER_ID}
                      onTrackClick={(clickedItem: any) => {
                        setSelectedTrack({
                          ...clickedItem,
                          type: activeType === 'artists' ? 'artist' : activeType === 'albums' ? 'album' : 'track'
                        });
                      }}
                    />
                  ))}

                  {filteredTopItems.length > 15 && (
                    <div className="flex justify-center mt-2.5 mb-2">
                      {visibleItemsCount < filteredTopItems.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            setVisibleItemsCount(prev => prev + 15);
                            trackEvent('ranking_load_more_clicked', { currentCount: visibleItemsCount });
                          }}
                          className="px-6 py-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 rounded-2xl text-[10px] text-white/70 hover:text-white font-black uppercase tracking-widest transition-[background-color,border-color,color,box-shadow,transform] duration-200 cursor-pointer shadow-lg"
                        >
                          Carregar Mais ({filteredTopItems.length - visibleItemsCount} restantes)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setVisibleItemsCount(15);
                            window.scrollTo({ top: document.getElementById('search-bar-ranking')?.offsetTop || 300, behavior: 'smooth' });
                          }}
                          className="px-6 py-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 rounded-2xl text-[10px] text-white/70 hover:text-white font-black uppercase tracking-widest transition-[background-color,border-color,color,box-shadow,transform] duration-200 cursor-pointer shadow-lg"
                        >
                          Recolher Lista
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <StatsEmptyPanel
                  icon={searchQuery.trim() ? Search : Music2}
                  eyebrow={activeFilter}
                  title={searchQuery.trim() ? "Nada encontrado" : "Ranking vazio"}
                  description={searchQuery.trim()
                    ? "Tente outro nome ou limpe a busca para voltar ao ranking completo."
                    : "Ainda não há itens suficientes para montar este recorte."
                  }
                  action={!searchQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => setTopItemsRetryNonce((value) => value + 1)}
                      className="rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/62 active:scale-95"
                    >
                      Recarregar
                    </button>
                  ) : null}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}

        </motion.div>
      </AnimatePresence>

      {/* MODALS PERSISTENCE LAYER */}
      <Suspense fallback={<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-sm"><Loader2 className="h-5 w-5 animate-spin text-orange-400" /></div>}>
        <AnimatePresence>
          {battleOpponent && user && (
            <StatsBattleModal 
              userA={user}
              userB={battleOpponent}
              onClose={() => setBattleOpponent(null)}
            />
          )}
          {selectedTrackHistory && (
            <TrackHistoryModal 
              track={selectedTrackHistory}
              onClose={() => setSelectedTrackHistory(null)}
            />
          )}
          {selectedTrack && (
            selectedTrack.type === 'album' ? (
              <UserAlbumStatsModal
                user={user}
                entity={selectedTrack}
                onClose={() => setSelectedTrack(null)}
                onTrackClick={(track) => setSelectedTrack({ ...track, type: 'track' })}
              />
            ) : selectedTrack.type === 'artist' ? (
              <UserArtistStatsModal
                user={user}
                entity={selectedTrack}
                onClose={() => setSelectedTrack(null)}
                onTrackClick={(track) => setSelectedTrack({ ...track, type: 'track' })}
              />
            ) : (
              <TrackLeaderboardModal
                track={selectedTrack}
                onClose={() => setSelectedTrack(null)}
                onArtistClick={(artist) => setSelectedTrack({ ...artist, type: 'artist' })}
              />
            )
          )}
        </AnimatePresence>
      </Suspense>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            key="scroll-top-btn"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={scrollToTop}
            className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] right-5 z-40 h-11 w-11 rounded-full border bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 border-white/[0.12] text-white shadow-[0_0_20px_rgba(249,115,22,0.3),0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center transition-[background-color,border-color,box-shadow,opacity,transform] duration-200 cursor-pointer select-none overflow-hidden backdrop-blur-xl"
            id="scroll-to-top-btn"
            title="Voltar ao topo"
          >
            {/* Glossy shine */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.15] to-transparent pointer-events-none rounded-t-full" />
            <ChevronUp className="h-5 w-5 stroke-[2.5] relative z-10" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
