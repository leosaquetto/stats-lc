
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  Music2, 
  Calendar, 
  RefreshCcw, 
  AlertTriangle, 
  Swords, 
  Trophy,
  Users, 
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
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { cn } from '../lib/utils';
import { SectionHeader, Skeleton, SmartImage, TrackHistoryModal } from '../components/MusicUI';
import { MonthlyGroupLeaderboard } from '../components/MusicUI';
import { StatsBattleModal, TrackLeaderboardModal } from '../components/MusicUI';
import { FriendsStatsComparer } from '../components/stats/FriendsStatsComparer';
import { UserQuickStats } from '../components/stats/UserQuickStats';
import { coreUtils, GROUP_USERS } from '../services/statsCore';
import { UserStats, TopItem } from '../types/stats';
import { statsService } from '../services/statsService';
import { trackEvent, identifyUser } from '../services/analyticsService';
import { ShareButton } from '../components/shared/ShareButton';
import { WeeklyReportGenerator } from '../components/stats/WeeklyReportGenerator';
import { DailyActivityHeatmap } from '../components/stats/DailyActivityHeatmap';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

import { FixedSizeList as List } from 'react-window';
// @ts-ignore
import * as AutoSizerModule from 'react-virtualized-auto-sizer';

const AutoSizer = ((AutoSizerModule as any).AutoSizer || (AutoSizerModule as any).default || AutoSizerModule) as any;

import { getStartOfTodaySP, getStartOfWeekSP, getStartOfMonthSP, getStartOfYearSP, getHourSP, formatDateSP } from '../lib/time';

interface VirtualRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    items: any[];
    activeType: 'artists' | 'tracks' | 'albums';
    members: any[];
    currentUserId: string;
    onTrackClick?: (track: any) => void;
  };
}

const VirtualRow = ({ index, style, data }: VirtualRowProps) => {
  const item = data.items[index];
  if (!item) return null;
  const { activeType, members, currentUserId, onTrackClick } = data;
  const rowRef = useRef<HTMLDivElement>(null);
  
  const displayArtistName = useMemo(() => {
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

  return (
    <div style={{ ...style, paddingBottom: 10 }} key={item.id || index}>
      <div 
        ref={rowRef}
        onClick={handleClick}
        className="glass flex items-center justify-between rounded-[24px] p-3 border-white/5 hover:bg-white/[0.03] transition-all group/row h-full cursor-pointer active:scale-[0.98]"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span className="text-[10px] font-black text-white/30 w-5 text-center">{(index + 1).toString().padStart(2, '0')}</span>
          <div className="h-12 w-12 shrink-0 rounded-[14px] bg-white/5 relative overflow-hidden shadow-lg">
            <SmartImage 
              src={item.image || item.album?.image || item.artist?.image} 
              className="h-full w-full" 
              fallback={name}
              rounded={activeType === 'artists' ? "full" : "[14px]"}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
          <div className="flex flex-col min-w-0 pr-2">
            <span className="font-bold text-[13px] text-white/90 truncate group-hover:text-orange-500 transition-colors uppercase tracking-tight">{name}</span>
            <span className="text-[9px] text-white/50 uppercase font-black tracking-wider truncate flex items-center gap-1.5">
              {activeType === 'artists' ? (
                <>
                  <UserCircle className="h-3 w-3 text-orange-500/80" />
                  <span>Artista</span>
                </>
              ) : activeType === 'albums' ? (
                <>
                  <Disc className="h-3 w-3 text-orange-500/80" />
                  <span>{displayArtistName || 'Álbum'}</span>
                </>
              ) : (
                <>
                  <Music2 className="h-3 w-3 text-orange-500/80" />
                  <span>{displayArtistName || 'Faixa'}</span>
                </>
              )}
              {activeType === 'tracks' && (item.playcount || item.streams) === 1 && (
                <span className="text-[7px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-md border border-orange-500/40 font-black">INÉDITO</span>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-0.5">
             <span className="text-[10px] font-black text-orange-500 tracking-tight leading-none">{item.playcount || item.streams || 0}</span>
             <span className="text-[7px] font-black text-white/20 uppercase tracking-widest leading-none">STREAMS</span>
          </div>
          <ShareButton 
            targetRef={rowRef} 
            variant="minimal" 
            title={`Top ${activeType}: ${name}`}
            className="opacity-0 group-hover/row:opacity-100 transition-opacity"
          />
        </div>
      </div>
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

const TopRankingRow = ({ item, index, activeType, members, currentUserId, onTrackClick }: TopRankingRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  
  const displayArtistName = useMemo(() => {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.35), ease: "easeOut" }}
      className="mb-1"
    >
      <div 
        ref={rowRef}
        onClick={handleClick}
        className="glass flex items-center justify-between rounded-[24px] p-3.5 border-white/5 hover:bg-white/[0.03] transition-all group/row cursor-pointer active:scale-[0.99]"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span className="text-[10px] font-black text-white/30 w-5 text-center">{(index + 1).toString().padStart(2, '0')}</span>
          <div className="h-12 w-12 shrink-0 rounded-[14px] bg-white/5 relative overflow-hidden shadow-lg">
            <SmartImage 
              src={item.image || item.album?.image || item.artist?.image} 
              className="h-full w-full" 
              fallback={name}
              rounded={activeType === 'artists' ? "full" : "[14px]"}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
          <div className="flex flex-col min-w-0 pr-2">
            <span className="font-bold text-[13px] text-white/90 truncate group-hover:text-orange-500 transition-colors uppercase tracking-tight">{name}</span>
            <span className="text-[9px] text-white/50 uppercase font-black tracking-wider truncate flex items-center gap-1.5">
              {activeType === 'artists' ? (
                <>
                  <UserCircle className="h-3 w-3 text-orange-500/80" />
                  <span>Artista</span>
                </>
              ) : activeType === 'albums' ? (
                <>
                  <Disc className="h-3 w-3 text-orange-500/80" />
                  <span>{displayArtistName || 'Álbum'}</span>
                </>
              ) : (
                <>
                  <Music2 className="h-3 w-3 text-orange-500/80" />
                  <span>{displayArtistName || 'Faixa'}</span>
                </>
              )}
              {activeType === 'tracks' && (item.playcount || item.streams) === 1 && (
                <span className="text-[7px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-md border border-orange-500/40 font-black">INÉDITO</span>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-0.5">
             <span className="text-[10px] font-black text-orange-500 tracking-tight leading-none">{item.playcount || item.streams || 0}</span>
             <span className="text-[7px] font-black text-white/20 uppercase tracking-widest leading-none">STREAMS</span>
          </div>
          <ShareButton 
            targetRef={rowRef} 
            variant="minimal" 
            title={`Top ${activeType}: ${name}`}
            className="opacity-0 group-hover/row:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </motion.div>
  );
};

type Filter = 'Hoje' | 'Semana' | 'Mês' | 'Ano' | 'Total';
type ItemType = 'artists' | 'tracks' | 'albums';
type ViewMode = 'user' | 'friends';

export default function StatsScreen() {
  const [activeFilter, setActiveFilter] = useState<Filter>('Hoje');
  const [activeType, setActiveType] = useState<ItemType>('artists');
  const [viewMode, setViewMode] = useState<ViewMode>('user');
  
  const [battleOpponent, setBattleOpponent] = useState<UserStats | null>(null);
  const [fullUserData, setFullUserData] = useState<any>(null);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [showFusionSelector, setShowFusionSelector] = useState(false);
  
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [chartMetric, setChartMetric] = useState<'streams' | 'hours'>('streams');
  
  const [activePeriodArtists, setActivePeriodArtists] = useState<any[]>([]);
  const [activePeriodTracks, setActivePeriodTracks] = useState<any[]>([]);
  const [activePeriodAlbums, setActivePeriodAlbums] = useState<any[]>([]);
  const [isTopItemsLoading, setIsTopItemsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [selectedTrackHistory, setSelectedTrackHistory] = useState<any>(null);
  const [showScrollTop, setShowScrollTop] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [visibleItemsCount, setVisibleItemsCount] = useState(15);
  const [activeRangeStats, setActiveRangeStats] = useState<{ count: number; durationMs: number } | null>(null);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      if (currentScrollY > 300 || currentScrollY < 15) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    // Run initially
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  const { 
    groupStats, 
    isLoading: isGlobalLoading, 
    isOffline,
    error: globalError, 
    fetchGroup,
    fetchGroupLive,
    featuredUserId,
    hiddenUsers,
    setFeaturedUserId
  } = useStatsStore();
  
  const members = (groupStats?.members || Object.values(groupStats?.users || {})).filter((m: any) => !hiddenUsers.includes(m.id));
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

  // Track View Mode (user stats vs group leaderboard)
  useEffect(() => {
    trackEvent('stats_view_mode_changed', { viewMode });
  }, [viewMode]);

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
    if (showFusionSelector) {
      trackEvent('fusion_selector_opened');
    }
  }, [showFusionSelector]);

  useEffect(() => {
    async function loadFullData() {
      if (!CURRENT_USER_ID) {
        setFullUserData(null);
        setIsLocalLoading(false);
        return;
      }

      setIsLocalLoading(true);
      try {
        const fullData = await statsService.getUserFullStats(CURRENT_USER_ID);
        setFullUserData(fullData);
      } catch (e) {
        console.error("Failed to load full user data", e);
      } finally {
        setIsLocalLoading(false);
      }
    }
    loadFullData();
  }, [CURRENT_USER_ID]);

  const [datesData, setDatesData] = useState<any>(null);
  const [cardinalityData, setCardinalityData] = useState<any>(null);

  useEffect(() => {
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
        setDatesData(datesRes);
        // Cardinality can be in stats endpoint directly (data.items.cardinality) or in a separate cardinalityRes
        setCardinalityData(cardRes?.items?.cardinality || cardRes?.cardinality ? cardRes : data);
        
        // Save raw metrics for selected period indicator
        if (data && typeof data === 'object') {
          const statsContainer = data.stats || data;
          const sourceObj = statsContainer.items || statsContainer;
          const countVal = sourceObj.count ?? sourceObj.streams ?? sourceObj.c ?? sourceObj.totalStreams ?? 0;
          const durationVal = sourceObj.durationMs ?? sourceObj.playedMs ?? sourceObj.totalDurationMs ?? 0;
          
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
                    durationMs: val.durationMs || val.playedMs || 0
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
        }).filter((item: any) => item !== null && (item.streams > 0 || item.duration > 0 || rawItems.length < 50));

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

        setHistoryData(formatted);
      } catch (e) {
        console.error("Failed to load chart data", e);
      } finally {
        setIsChartLoading(false);
      }
    }
    loadChartData();
  }, [CURRENT_USER_ID, activeFilter, fullUserData]);

  const dailyEvolutionData = useMemo(() => {
    const datesContainer = datesData?.stats || datesData;
    const datesItems = datesContainer?.items || datesContainer;
    const today = new Date();

    // Safely format Date as YYYY-MM-DD helper
    const getDayKey = (date: Date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (activeFilter === 'Hoje') {
      const hourlyMap: Record<number, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
      for (let h = 0; h < 24; h++) {
        const hourStr = `${h.toString().padStart(2, '0')}:00`;
        hourlyMap[h] = { date: hourStr, displayLabel: hourStr, timestamp: h, streams: 0, duration: 0, hours: 0 };
      }
      
      const hourlyDataPoints = datesItems?.hours;
      if (hourlyDataPoints && Object.keys(hourlyDataPoints).length > 0) {
        Object.entries(hourlyDataPoints).forEach(([hStr, v]: [string, any]) => {
          const h = Number(hStr);
          if (h >= 0 && h < 24 && hourlyMap[h]) {
            hourlyMap[h].streams = v.count ?? v.streams ?? 0;
            hourlyMap[h].duration = v.durationMs || 0;
            hourlyMap[h].hours = Number(((v.durationMs || 0) / 3600000).toFixed(2));
          }
        });
        return Object.values(hourlyMap);
      } else if (historyData && historyData.length > 0) {
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
      
      if (datesItems?.weekDays && Object.keys(datesItems.weekDays).length > 0) {
        return Object.entries(datesItems.weekDays).map(([wStr, v]: [string, any]) => {
           let day = Number(wStr);
           if (day === 0) day = 7; // backend might map differently
           return {
             date: String(wStr),
             displayLabel: daysLabel[day - 1] || wStr,
             timestamp: Number(wStr),
             streams: v.count ?? v.streams ?? 0,
             duration: v.durationMs || 0,
             hours: Number(((v.durationMs || 0) / 3600000).toFixed(2))
           };
        }).sort((a,b) => a.timestamp - b.timestamp);
      } else if (historyData && historyData.length > 0) {
        // Last 7 days fallback
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
      if (datesItems?.monthDays && Object.keys(datesItems.monthDays).length > 0) {
        return Object.entries(datesItems.monthDays).map(([dStr, v]: [string, any]) => {
           const d = Number(dStr);
           return {
             date: String(dStr),
             displayLabel: String(d).padStart(2, '0'),
             timestamp: d,
             streams: v.count ?? v.streams ?? 0,
             duration: v.durationMs || 0,
             hours: Number(((v.durationMs || 0) / 3600000).toFixed(2))
           };
        }).sort((a,b) => a.timestamp - b.timestamp);
      } else if (historyData && historyData.length > 0) {
        // Current month days fallback
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
      if (datesItems?.months && Object.keys(datesItems.months).length > 0) {
        return Object.entries(datesItems.months).map(([mStr, v]: [string, any]) => {
           const m = Number(mStr);
           return {
             date: String(mStr),
             displayLabel: monthNames[m - 1] || String(mStr),
             timestamp: m,
             streams: v.count ?? v.streams ?? 0,
             duration: v.durationMs || 0,
             hours: Number(((v.durationMs || 0) / 3600000).toFixed(2))
           };
        }).sort((a,b) => a.timestamp - b.timestamp);
      } else if (historyData && historyData.length > 0) {
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

    // Default / Total
    if (historyData && historyData.length > 0) {
      const totalMap: Record<string, { date: string; displayLabel: string; timestamp: number; streams: number; duration: number; hours: number }> = {};
      historyData.forEach((item) => {
        const d = new Date(item.date);
        let dayKey = "";
        let dateLabel = "";
        let ts = 0;
        
        if (!isNaN(d.getTime())) {
          ts = d.getTime();
          dayKey = getDayKey(d);
          dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else {
          dayKey = String(item.date).substring(0, 10);
          dateLabel = dayKey;
        }
        
        if (!totalMap[dayKey]) {
          totalMap[dayKey] = {
            date: dayKey,
            displayLabel: dateLabel,
            timestamp: ts || Date.parse(dayKey) || 0,
            streams: 0,
            duration: 0,
            hours: 0
          };
        }
        
        totalMap[dayKey].streams += item.streams;
        totalMap[dayKey].duration += item.duration;
        totalMap[dayKey].hours = Number((totalMap[dayKey].duration / 60).toFixed(2));
      });
      return Object.values(totalMap).sort((a, b) => a.timestamp - b.timestamp);
    }

    return [];
  }, [datesData, historyData, activeFilter]);

  const hourlyDistributionData = useMemo(() => {
    // Override behavior to use new stats-dates hourly endpoint
    const datesContainer = datesData?.stats || datesData;
    const datesItems = datesContainer?.items || datesContainer;
    const activeHourly = datesItems?.hours ? datesItems.hours : fullUserData?.statsDates?.hours;
    if (activeHourly && Object.keys(activeHourly).length > 0) {
      const mapped = [];
      for (let h = 0; h < 24; h++) {
         const d = activeHourly[String(h)] || { count: 0, durationMs: 0 };
         mapped.push({
           hour: h,
           streams: d.count ?? d.streams ?? 0,
           duration: d.durationMs || 0
         });
      }
      return mapped;
    }

    // Robust history detection from fullUserData
    const fullHistory = fullUserData?.history || fullUserData?.streams || fullUserData?.recent || fullUserData?.scrobbles || [];
    
    const sourceData = (fullHistory && Array.isArray(fullHistory) && fullHistory.length > 0) 
      ? fullHistory 
      : historyData;

    // Build default hourly distribution of 24 hours with zeros
    const hourlyMap: Record<number, { hour: number; streams: number; duration: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { hour: h, streams: 0, duration: 0 };
    }

    if (sourceData && sourceData.length > 0) {
      sourceData.forEach((item: any) => {
        let dateVal = item.date || item.t || item.timestamp || item.ts || item.time || item.playedAt || item.played_at || item.dt;
        if (!dateVal) return;

        // Handle unix timestamps in seconds
        if (typeof dateVal === 'number' && dateVal < 2147483647) {
          dateVal = dateVal * 1000;
        }
        
        const hour = getHourSP(dateVal);
        
        if (hour >= 0 && hour < 24 && hourlyMap[hour]) {
          const hasExplicitCount = ('streams' in item) || ('count' in item) || ('c' in item) || ('plays' in item) || ('playcount' in item) || ('scrobbles' in item);
          const streamCount = hasExplicitCount 
            ? (item.streams || item.count || item.c || item.plays || item.playcount || item.scrobbles || 0)
            : (item.streams ?? 1);

          const dur = item.durationMs || item.playedMs || (item.duration * 1000 * 60) || 0;

          hourlyMap[hour].streams += Number(streamCount);
          hourlyMap[hour].duration += Number(dur);
        }
      });
    }
    
    return Object.values(hourlyMap);
  }, [datesData, historyData, fullUserData]);

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
        count: currentStats.count || currentStats.streams || currentStats.c || 0,
        durationMs: currentStats.durationMs || currentStats.playedMs || currentStats.totalDurationMs || 0
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
        value: `${streamsCount} stream${streamsCount !== 1 ? 's' : ''}`
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
        value: `${streamsCount} tocadas`
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
    async function loadAllPeriodData() {
      if (viewMode === 'friends' || !CURRENT_USER_ID) return;
      setIsTopItemsLoading(true);
      try {
        const period = periodMap[activeFilter];
        const [artists, tracks, albums] = await Promise.all([
          statsService.getTopItems(CURRENT_USER_ID, 'artists', period),
          statsService.getTopItems(CURRENT_USER_ID, 'tracks', period),
          statsService.getTopItems(CURRENT_USER_ID, 'albums', period)
        ]);
        setActivePeriodArtists(artists || []);
        setActivePeriodTracks(tracks || []);
        setActivePeriodAlbums(albums || []);
      } catch (e) {
        console.error("Failed to load period top items for StatsScreen", e);
      } finally {
        setIsTopItemsLoading(false);
      }
    }
    loadAllPeriodData();
  }, [CURRENT_USER_ID, activeFilter, viewMode]);

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

  if (!user) {
    return (
      <div className="flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-12">
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
    <div className="flex flex-col gap-6 pb-32 px-4 sm:px-6 lg:px-8">
      <header className="px-1 flex justify-between items-start pb-1">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white/95">Stats</h1>
          <p className="text-white/60 text-sm">
            {isOffline ? `Modo offline (dados salvos) de ${user?.name}` : `O legado sonoro de ${user?.name}`}
          </p>
        </div>
        <div className="flex gap-2 relative mt-1">
          {/* Fusion Button */}
          <button 
            type="button"
            onClick={() => setShowFusionSelector(!showFusionSelector)}
            className={clsx(
              "h-10 w-10 flex items-center justify-center rounded-full bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] backdrop-blur-md transition-all cursor-pointer text-white/70 shrink-0",
              showFusionSelector && "bg-orange-500/20 text-orange-500 border-orange-500/20"
            )}
            title="Modo Fusion"
          >
            <Swords className="h-4 w-4" />
          </button>

          {/* User Selector */}
          <button 
            type="button"
            onClick={() => setShowUserSelector(!showUserSelector)} 
            className={clsx(
              "h-10 w-10 flex items-center justify-center rounded-full bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] backdrop-blur-md overflow-hidden cursor-pointer active:scale-95 transition-all p-0 shrink-0",
              showUserSelector && "bg-white/25 border-white/25"
            )}
            title="Mudar Usuário"
          >
            <SmartImage src={coreUtils.getUserAvatar(user.id, user.avatar)} className="h-full w-full" fallback={user.name} rounded="full" />
          </button>
          
          <button 
            type="button"
            onClick={() => fetchGroupLive()} 
            className="h-10 w-10 flex items-center justify-center rounded-full bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] backdrop-blur-md active:scale-95 transition-all text-white/70 cursor-pointer shrink-0"
            title="Sincronizar"
          >
             <RefreshCcw className={clsx("h-4 w-4 text-white/70", (isGlobalLoading || isLocalLoading) && "animate-spin")} />
          </button>

          <AnimatePresence>
            {showFusionSelector && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFusionSelector(false)} className="fixed inset-0 z-40" />
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full right-16 mt-2 w-56 glass-card border-orange-500/20 p-2 z-50 shadow-2xl backdrop-blur-3xl">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-orange-500 px-3 py-2 mb-1 border-b border-white/5 flex items-center gap-1.5"><Swords className="h-3 w-3" /> Modo Fusion</div>
                  <div className="flex flex-col gap-1">
                    {members.filter(m => m.id !== CURRENT_USER_ID).map((u) => (
                      <button key={u.id} type="button" onClick={() => { setBattleOpponent(u); setShowFusionSelector(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-all text-left cursor-pointer">
                        <SmartImage src={coreUtils.getUserAvatar(u.id, u.avatar)} className="h-8 w-8 border border-white/10" fallback={u.name} rounded="full" />
                        <span className="text-xs font-bold text-white/80">{u.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}

            {showUserSelector && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUserSelector(false)} className="fixed inset-0 z-40" />
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full right-0 mt-2 w-52 glass-card border-white/10 p-2 z-50 shadow-2xl backdrop-blur-3xl max-h-[300px] overflow-y-auto no-scrollbar">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-white/50 px-3 py-2 mb-1">Trocar Perfil</div>
                  <div className="flex flex-col gap-1">
                    {members.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setFeaturedUserId(u.id);
                          setShowUserSelector(false);
                          setViewMode('user');
                        }}
                        className={clsx(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer",
                          CURRENT_USER_ID === u.id && viewMode === 'user'
                            ? "bg-white/10 border border-white/10" 
                            : "hover:bg-white/5 opacity-70 hover:opacity-100"
                        )}
                      >
                         <SmartImage src={coreUtils.getUserAvatar(u.id, u.avatar)} className="h-8 w-8 border border-white/10" fallback={u.name} rounded="full" />
                         <span className="text-xs font-bold text-white/80">{u.name}</span>
                         {CURRENT_USER_ID === u.id && viewMode === 'user' && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />}
                      </button>
                    ))}
                    <div className="h-[1px] bg-white/5 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('friends');
                        setShowUserSelector(false);
                      }}
                      className={clsx(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer",
                        viewMode === 'friends' ? "bg-white/10 border border-white/10" : "hover:bg-white/5 opacity-70 hover:opacity-100"
                      )}
                    >
                      <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
                        <Users className="h-4 w-4 text-white/60" />
                      </div>
                      <span className="text-xs font-bold text-white/80">Visão do Grupo</span>
                      {viewMode === 'friends' && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />}
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Universal Period Filter (The Master Selector - Floating Glass Pill) */}
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+12px)] z-50 w-full flex flex-col transition-all py-3 bg-[#050505]/75 backdrop-blur-md">
        <div className="relative w-full z-10 flex gap-1.5 p-1.5 bg-white/[0.03] backdrop-blur-xl rounded-[32px] overflow-x-auto no-scrollbar border border-white/[0.08] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] premium-gradient">
          {/* Glossy shine reflection top half */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none rounded-t-[32px]" />
          
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setActiveFilter(f);
                trackEvent('stats_period_changed', { period: f });
              }}
              className={clsx(
                "filter-pill flex-1 px-1.5 py-3 rounded-[24px] text-[10.5px] font-black uppercase tracking-[0.14em] transition-all shrink-0 cursor-pointer text-center relative z-10 select-none",
                activeFilter === f 
                  ? "bg-white text-black shadow-lg" 
                  : "text-white/45 hover:text-white/75 hover:bg-white/5"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'user' ? (
        <>
          {/* Active Period Metrics Spotlight */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 px-1">
              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                key={`streams-card-${activeFilter}`}
                className="glass-card p-4 flex flex-col gap-3.5 border-white/5 bg-white/[0.02] relative overflow-hidden group"
              >
                <div className="absolute right-3.5 top-3.5 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                  <PlayCircle className="h-10 w-10 text-orange-500" />
                </div>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-orange-500/10 text-orange-500 border border-orange-500/10">
                  <PlayCircle className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[18px] font-display font-black text-white leading-none tracking-tight">
                    {coreUtils.formatNumber(periodSummaryStats.count)}
                  </span>
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.15em] mt-2 flex items-center gap-1 font-mono">
                    Streams Acumulados
                  </span>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                key={`played-card-${activeFilter}`}
                className="glass-card p-4 flex flex-col gap-3.5 border-white/5 bg-white/[0.02] relative overflow-hidden group"
              >
                <div className="absolute right-3.5 top-3.5 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                  <Clock className="h-10 w-10 text-orange-500" />
                </div>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-orange-500/10 text-orange-500 border border-orange-500/10">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[18px] font-display font-black text-white leading-none tracking-tight truncate">
                    {coreUtils.formatDuration(periodSummaryStats.durationMs)}
                  </span>
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.15em] mt-2 font-mono">
                    Tempo Estimado Ouvido
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Badges de Cardinalidade Extras */}
            <div className="flex flex-wrap gap-2 px-1 justify-start">
              <div 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 text-[9px] font-black uppercase tracking-wider text-white/50 shadow-sm backdrop-blur-md transition-all hover:bg-white/[0.04] cursor-default"
                title="Artistas únicos ouvidos"
              >
                <UserCircle className="h-3.5 w-3.5 text-orange-500/80" />
                <span>{uniqueArtists ? `${uniqueArtists} artistas` : '— artistas'}</span>
              </div>
              <div 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 text-[9px] font-black uppercase tracking-wider text-white/50 shadow-sm backdrop-blur-md transition-all hover:bg-white/[0.04] cursor-default"
                title="Músicas únicas ouvidas"
              >
                <Music2 className="h-3.5 w-3.5 text-orange-500/80" />
                <span>{uniqueTracks ? `${uniqueTracks} músicas` : '— músicas'}</span>
              </div>
              <div 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 text-[9px] font-black uppercase tracking-wider text-white/50 shadow-sm backdrop-blur-md transition-all hover:bg-white/[0.04] cursor-default"
                title="Álbuns únicos ouvidos"
              >
                <Disc className="h-3.5 w-3.5 text-orange-500/80" />
                <span>{uniqueAlbums ? `${uniqueAlbums} álbuns` : '— álbuns'}</span>
              </div>
            </div>
          </div>

          {/* Hall of Fame - Top #1 Highlights */}
          {!isTopItemsLoading && (activePeriodArtists?.length > 0 || activePeriodTracks?.length > 0 || activePeriodAlbums?.length > 0) && (
            <div className="flex flex-col gap-3">
              <SectionHeader 
                title={`Hall of Fame • ${activeFilter}`} 
                icon={<Trophy className="h-3 w-3 text-yellow-500" />} 
                action={
                  <button 
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('search-bar-ranking');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-[9px] font-black text-orange-500 hover:text-orange-400 transition-colors uppercase tracking-widest hover:underline cursor-pointer"
                  >
                    ver mais
                  </button>
                }
              />
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '#1 Artista', data: activePeriodArtists?.[0], type: 'artist' },
                  { label: '#1 Música', data: activePeriodTracks?.[0], type: 'track' },
                  { label: '#1 Álbum', data: activePeriodAlbums?.[0], type: 'album' }
                ].map((highlight, i) => {
                  const itemData = highlight.data as any;
                  return (
                    <motion.div
                      key={highlight.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => {
                        if (itemData) {
                          setSelectedTrack({ ...itemData, type: highlight.type });
                        }
                      }}
                      className="glass-card p-3 flex flex-col items-center gap-3 border-white/5 bg-white/[0.02] relative overflow-hidden group hover:bg-white/[0.05] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div className="absolute top-0 right-0 p-1">
                         <Star className="h-2 w-2 text-yellow-500/40" />
                      </div>
                      <div className="relative h-14 w-14 sm:h-16 sm:w-16">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-200 blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
                        <SmartImage 
                          src={itemData?.image || itemData?.album?.image || itemData?.artist?.image} 
                          className="h-full w-full border border-white/10 z-10 relative" 
                          rounded={highlight.type === 'artist' ? "full" : "2xl"} 
                          fallback={itemData?.name || itemData?.track?.name || 'Top #1'} 
                        />
                      </div>
                      <div className="flex flex-col items-center text-center gap-0.5 w-full">
                        <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">{highlight.label}</span>
                        <span className="text-[10px] font-bold text-white/95 line-clamp-1 w-full leading-tight">
                          {itemData?.name || itemData?.track?.name || '---'}
                        </span>
                        <span className="text-[8px] font-black text-orange-500 uppercase tracking-tighter">
                          {itemData?.playcount || itemData?.streams || itemData?.count || 0} streams
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Insights Fade-Rotator */}
          {insights.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionHeader 
                title="Insights de Reprodução" 
                icon={<Zap className="h-3 w-3 text-orange-500 animate-pulse" />} 
                action={
                  insights.length > 1 ? (
                    <div className="flex items-center gap-1 bg-white/[0.03] border border-white/5 px-2 py-1 rounded-full shadow-inner">
                      <span className="text-[9px] font-mono font-bold text-white/40 leading-none mr-2 select-none">
                        {((currentInsightIndex % insights.length) + 1)}/{insights.length}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentInsightIndex((prev) => (prev - 1 + insights.length) % insights.length);
                        }}
                        className="h-5 w-5 rounded-full bg-white/[0.03] hover:bg-white/[0.1] active:scale-90 border border-white/5 flex items-center justify-center transition-all cursor-pointer select-none text-white/60 hover:text-white/90"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentInsightIndex((prev) => (prev + 1) % insights.length);
                        }}
                        className="h-5 w-5 rounded-full bg-white/[0.03] hover:bg-white/[0.1] active:scale-90 border border-white/5 flex items-center justify-center transition-all cursor-pointer select-none text-white/60 hover:text-white/90"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null
                }
              />

              <div className="relative min-h-[145px] w-full flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {(() => {
                    const idx = currentInsightIndex % insights.length;
                    const insight = insights[idx];
                    if (!insight) return null;
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                        className={clsx(
                          "glass-card w-full p-5 flex flex-col gap-3.5 relative overflow-hidden transition-all duration-300 rounded-[24px] bg-[#0b0b0bb5] backdrop-blur-xl border border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.55)]",
                          (insight as any).isDiscovery ? "border-orange-500/35 bg-orange-500/[0.03] shadow-[0_0_20px_rgba(249,115,22,0.1)]" : ""
                        )}
                      >
                        {/* Glossy shine reflection top half */}
                        <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none rounded-t-[24px]" />
                        
                        <div className={clsx(
                          "absolute -top-4 -right-4 h-24 w-24 rounded-full blur-3xl transition-all duration-500",
                          (insight as any).isDiscovery ? "bg-orange-500/20" : "bg-orange-500/5"
                        )} />

                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-3">
                            <div className={clsx(
                              "h-8 w-8 rounded-xl flex items-center justify-center border transition-all duration-300",
                              (insight as any).isDiscovery ? "bg-orange-500 text-black border-orange-500" : "bg-orange-500/10 text-orange-500 border-orange-500/15"
                            )}>
                              <insight.icon className="h-4 w-4" />
                            </div>
                            <span className={clsx(
                              "text-[10px] font-black uppercase tracking-[0.15em]",
                              (insight as any).isDiscovery ? "text-orange-500 font-black" : "text-white/80"
                            )}>
                              {insight.title}
                            </span>
                          </div>

                          {/* Dots / Page indicators */}
                          {insights.length > 1 && (
                            <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-1 rounded-full border border-white/5">
                              {insights.map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentInsightIndex(i);
                                  }}
                                  className={cn(
                                    "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                                    i === idx ? "w-3 bg-orange-500" : "w-1.5 bg-white/10 hover:bg-white/30"
                                  )}
                                  aria-label={`Ir para insight ${i + 1}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 relative z-10 mt-1">
                          <span className="text-sm font-medium text-white/90 leading-snug">{insight.description}</span>
                          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-1.5">{insight.value}</span>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            </div>
          )}

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
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border transition-all cursor-pointer",
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
              className="w-full bg-white/[0.02] border border-white/5 hover:border-white/10 focus:border-orange-500/30 rounded-2xl py-2.5 pl-10 pr-10 text-xs font-semibold text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-orange-500/20 shadow-inner transition-all duration-300"
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
                className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/10 active:scale-95 transition-all"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
          
          <AnimatePresence mode="wait">
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
              {isTopItemsLoading && filteredTopItems.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <RefreshCcw className="h-8 w-8 text-white/10 animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Buscando Rankings...</span>
                </div>
              ) : filteredTopItems.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  <div className="h-[520px] w-full min-h-[350px]">
                    <AutoSizer>
                      {({ height, width }: { height: number; width: number }) => (
                        <List
                          height={height}
                          itemCount={Math.min(filteredTopItems.length, visibleItemsCount)}
                          itemSize={82}
                          width={width}
                          itemData={{
                            items: filteredTopItems,
                            activeType,
                            members,
                            currentUserId: CURRENT_USER_ID,
                            onTrackClick: (clickedItem: any) => {
                              setSelectedTrack({
                                ...clickedItem,
                                type: activeType === 'artists' ? 'artist' : activeType === 'albums' ? 'album' : 'track'
                              });
                            }
                          }}
                          className="no-scrollbar"
                        >
                          {VirtualRow}
                        </List>
                      )}
                    </AutoSizer>
                  </div>

                  {filteredTopItems.length > 15 && (
                    <div className="flex justify-center mt-2.5 mb-2">
                      {visibleItemsCount < filteredTopItems.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            setVisibleItemsCount(prev => prev + 15);
                            trackEvent('ranking_load_more_clicked', { currentCount: visibleItemsCount });
                          }}
                          className="px-6 py-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 rounded-2xl text-[10px] text-white/70 hover:text-white font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg"
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
                          className="px-6 py-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 rounded-2xl text-[10px] text-white/70 hover:text-white font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg"
                        >
                          Recolher Lista
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center gap-4 opacity-30">
                  <Music2 className="h-10 w-10" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                    {searchQuery.trim() ? "Nenhum resultado correspondente" : "Nenhum dado encontrado"}
                  </span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Evolução de Streams Chart */}
          <div className="glass-card p-6 border-white/5 flex flex-col gap-5 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-orange-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Evolução de Atividade</span>
              </div>
              <div className="bg-white/[0.03] border border-white/5 py-1 px-2.5 rounded-full text-[8.5px] font-black uppercase tracking-widest text-orange-500">
                {activeFilter}
              </div>
            </div>

            {/* Toggle chart metric */}
            <div className="flex gap-1.5 bg-white/[0.02] border border-white/5 p-1 rounded-xl w-full">
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
                    "flex-1 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] rounded-lg transition-all text-center cursor-pointer",
                    chartMetric === btn.metric 
                      ? "bg-white text-black shadow-md p-1" 
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
                  )}
                >
                  {btn.label}
                </button>
              ))}
            </div>
 
            <div className="h-56 w-full mt-2 relative">
              {isChartLoading && dailyEvolutionData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCcw className="h-6 w-6 text-white/10 animate-spin" />
                </div>
              ) : dailyEvolutionData.length > 0 ? (
                <div className={clsx("h-full w-full transition-all duration-300", isChartLoading && "opacity-35 pointer-events-none")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyEvolutionData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={accentColor} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={accentColor} stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                      <XAxis 
                        dataKey="displayLabel" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                        minTickGap={20}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const val = payload[0].value;
                            const displayLabel = label || payload[0].payload.displayLabel;
                            const isHours = chartMetric === 'hours';
                            
                            return (
                              <div className="glass-card p-3 border border-orange-500/10 bg-black/95 backdrop-blur-xl flex flex-col gap-1.5 shadow-2xl rounded-2xl">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">{displayLabel}</span>
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                                    <span className="text-sm font-black text-white">
                                      {isHours ? `${Number(val).toFixed(2)}` : val}{' '}
                                      <span className="text-[9px] text-white/50 font-medium uppercase tracking-wider">
                                        {isHours ? 'HORAS' : 'STREAMS'}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                        cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey={chartMetric} 
                        stroke={accentColor} 
                        strokeWidth={3}
                        fill="url(#colorMetric)"
                        dot={{ r: 2, strokeWidth: 1, fill: '#050505', stroke: accentColor }}
                        activeDot={{ r: 6, stroke: accentColor, strokeWidth: 2, fill: '#050505' }}
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center opacity-30 gap-3">
                  <TrendingUp className="h-8 w-8" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Sem dados históricos</span>
                </div>
              )}
            </div>
          </div>

          {/* Daily Activity Heatmap */}
          <div className="transition-opacity duration-300">
            {isChartLoading && (!hourlyDistributionData || hourlyDistributionData.length === 0 || hourlyDistributionData.every(d => d.streams === 0)) ? (
              // Discrete skeleton loading state
              <div className="glass-card p-6 border-white/5 flex flex-col gap-5 mt-4 opacity-40 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-white/30" />
                    <div className="h-3.5 w-32 bg-white/10 rounded-full" />
                  </div>
                  <div className="h-2 w-16 bg-white/5 rounded-full" />
                </div>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-12 gap-1.5 sm:gap-2">
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
            ) : (hourlyDistributionData && hourlyDistributionData.length > 0 && hourlyDistributionData.some(d => d.streams > 0)) ? (
              <div className={clsx(isChartLoading && "opacity-40 pointer-events-none")}>
                <DailyActivityHeatmap 
                  data={hourlyDistributionData} 
                  accentColor={accentColor} 
                />
              </div>
            ) : (
              // Empty state with reduced vertical space (p-4 instead of p-8 to reduce empty vertical space)
              <div className="glass-card p-4 border-white/5 flex flex-col items-center justify-center gap-2 mt-4 opacity-30">
                <Clock className="h-5 w-5" />
                <span className="text-[9px] font-black uppercase tracking-[0.14em]">Sem dados de distribuição horária</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <SectionHeader 
              title="Destaques do Grupo" 
              icon={<Trophy className="h-4 w-4 text-orange-500" />} 
            />
            <MonthlyGroupLeaderboard 
              users={members} 
              type={activeFilter === 'Hoje' ? 'today' : activeFilter === 'Semana' ? 'week' : 'month'} 
            />
          </div>

          <div className="flex flex-col gap-4">
            <SectionHeader 
              title="Comparador de Amigos" 
              icon={<Users className="h-4 w-4 text-orange-500" />} 
            />
            <FriendsStatsComparer 
              members={members} 
              onArtistClick={(artist) => setSelectedTrack({ ...artist, type: 'artist' })} 
            />
          </div>
        </div>
      )}

      {/* MODALS PERSISTENCE LAYER */}
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
          <TrackLeaderboardModal 
            track={selectedTrack} 
            onClose={() => setSelectedTrack(null)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            layout
            key="scroll-top-btn"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={scrollY < 15 ? () => fetchGroup(true) : scrollToTop}
            className={cn(
              "fixed bottom-[110px] right-6 z-50 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg select-none group/btn overflow-hidden",
              scrollY < 15 
                ? "h-11 px-4.5 bg-[#080808]/95 border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-[#121212]/95 hover:border-emerald-500/60" 
                : "h-11 w-11 bg-orange-500 hover:bg-orange-600 border-white/10 text-white shadow-[0_4px_20px_rgba(249,115,22,0.4)]"
            )}
            id="scroll-to-top-btn"
            title={scrollY < 15 ? "Status: Sincronizado" : "Voltar ao topo"}
          >
            {scrollY < 15 ? (
              <div className="flex items-center gap-2 relative z-10">
                {/* Edge/Side glows inside button */}
                <span className="absolute inset-x-0 -bottom-1 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent blur-[1px]" />
                <span className="absolute inset-y-0 -left-1 w-[2px] bg-gradient-to-b from-transparent via-emerald-400 to-transparent blur-[1px]" />
                <span className="absolute inset-y-0 -right-1 w-[2px] bg-gradient-to-b from-transparent via-emerald-400 to-transparent blur-[1px]" />
                
                {/* Pulsing auras */}
                <span className="absolute -inset-1 rounded-full bg-emerald-500/10 animate-ping" />
                
                {/* Live pulse dot */}
                <span className="relative flex h-2 w-2">
                  <span className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75",
                    (isGlobalLoading || isLocalLoading) ? "animate-spin border-t border-emerald-400" : "animate-ping bg-emerald-400"
                  )}></span>
                  <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    (isGlobalLoading || isLocalLoading) ? "bg-amber-500" : "bg-emerald-500"
                  )}></span>
                </span>
                
                <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                  {(isGlobalLoading || isLocalLoading) ? 'SINC...' : 'SINCRONIZADO'}
                </span>
              </div>
            ) : (
              <ChevronUp className="h-5 w-5 stroke-[2.5]" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
