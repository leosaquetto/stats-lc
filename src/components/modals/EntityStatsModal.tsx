/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUpDown,
  BookOpen,
  CalendarDays,
  Clock3,
  Copy,
  ExternalLink,
  History,
  ListMusic,
  Loader2,
  MoreHorizontal,
  Music2,
  Share2,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SmartImage } from '../shared/CommonUI';
import { statsService } from '../../services/statsService';
import { coreUtils } from '../../services/statsCore';
import { useStatsStore } from '../../store/useStatsStore';
import { getVisibleMembers } from '../../lib/memberSelectors';
import { getMainArtistName } from '../../lib/artistUtils';
import { FixedSizeList as List } from 'react-window';

type EntityKind = 'album' | 'artist';
type EntityTab = 'summary' | 'tracks' | 'circle' | 'history' | 'lyrics';
type SortMode = 'plays' | 'trackNumber';

interface BaseEntityStatsModalProps {
  user: any;
  entity: any;
  onClose: () => void;
  onTrackClick?: (track: any) => void;
}

interface EntityStatsModalProps extends BaseEntityStatsModalProps {
  kind: EntityKind;
}

type TrackRow = {
  id: string;
  name: string;
  image: string;
  artistName: string;
  trackNumber: number | null;
  discNumber: number | null;
  playCount: number;
  durationMs: number;
  track: any;
};

const HISTORY_PAGE_SIZE = 30;
const COMPACT_TRACK_ROW_HEIGHT = 68;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const normalizeText = (value: any) => coreUtils.normalizeText(String(value || ''));

const getEntityId = (entity: any) => String(entity?.id || entity?.album?.id || entity?.artist?.id || entity?.item?.id || '');
const getEntityName = (entity: any, kind: EntityKind) => {
  if (kind === 'artist') return entity?.name || entity?.artistName || entity?.artist?.name || 'Artista';
  return entity?.name || entity?.albumName || entity?.album?.name || 'Album';
};
const getEntityImage = (entity: any, kind: EntityKind) => {
  if (kind === 'artist') {
    return [
      entity?.image,
      entity?.artist?.image,
      entity?.avatar,
      entity?.artistImage,
    ].find((url) => typeof url === 'string' && url.trim().length > 5) || '';
  }

  return [
    entity?.image,
    entity?.albumImage,
    entity?.album?.image,
    entity?.track?.albumImage,
    entity?.track?.album?.image,
  ].find((url) => typeof url === 'string' && url.trim().length > 5) || '';
};
const getEntitySubtitle = (entity: any, kind: EntityKind) => {
  if (kind === 'artist') return 'Stats do artista';
  const artist = entity?.artistName || entity?.albumArtistName || entity?.artist?.name || entity?.album?.artistName || entity?.album?.artist?.name;
  return artist || 'Stats do album';
};

const getTrack = (item: any) => item?.track || item?.item?.track || item?.item || item;
const getTrackId = (item: any) => String(getTrack(item)?.id || item?.trackId || item?.id || '');
const getTrackName = (item: any) => getTrack(item)?.name || item?.trackName || item?.name || 'Musica';
const getTrackImage = (item: any) => {
  const track = getTrack(item);
  return [
    track?.albumImage,
    track?.album?.image,
    track?.image,
    item?.albumImage,
    item?.trackImage,
    item?.image,
  ].find((url) => typeof url === 'string' && url.trim().length > 5) || '';
};
const getTrackArtist = (item: any) => {
  const track = getTrack(item);
  const main = getMainArtistName(track);
  if (main) return main;
  const first = Array.isArray(track?.artists) ? track.artists[0] : null;
  if (typeof first === 'string') return first;
  return first?.name || track?.artistName || track?.artist?.name || item?.artistName || item?.albumArtistName || 'Artista';
};
const getTrackDurationMs = (item: any) => {
  const track = getTrack(item);
  return Number(track?.durationMs || item?.durationMs || item?.playedMs || 0) || 0;
};
const getTrackNumber = (item: any) => {
  const track = getTrack(item);
  const raw = track?.trackNumber || track?.track_number || track?.position || item?.trackNumber || item?.track_number || item?.position;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const getDiscNumber = (item: any) => {
  const track = getTrack(item);
  const raw = track?.discNumber || track?.disc_number || item?.discNumber || item?.disc_number;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const getStreamDate = (item: any) => item?.playedAt || item?.endTime || item?.timestamp || item?.date || item?.createdAt || null;
const sameEntity = (item: any, entity: any) => {
  const entityId = getEntityId(entity);
  const itemId = String(item?.id || item?.album?.id || item?.artist?.id || item?.item?.id || '');
  if (entityId && itemId && entityId === itemId) return true;
  return normalizeText(item?.name || item?.album?.name || item?.artist?.name) === normalizeText(getEntityName(entity, item?.type === 'artist' ? 'artist' : 'album'));
};

const getExternalId = (track: any, key: 'spotify' | 'appleMusic') => {
  const direct = key === 'spotify' ? track?.spotifyId : track?.appleMusicId;
  if (direct) return String(direct);
  const external = track?.externalIds?.[key];
  if (Array.isArray(external)) return external[0] ? String(external[0]) : '';
  return external ? String(external) : '';
};

const buildTrackLinks = (track: any) => {
  const id = getTrackId(track);
  const name = getTrackName(track);
  const artistName = getTrackArtist(track);
  const searchTerm = encodeURIComponent(`${name} ${artistName}`.trim());
  const spotifyId = getExternalId(track, 'spotify');
  const appleMusicId = getExternalId(track, 'appleMusic');

  return {
    statsfm: id ? `https://stats.fm/track/${encodeURIComponent(id)}` : '',
    spotify: spotifyId ? `https://open.spotify.com/track/${encodeURIComponent(spotifyId)}` : `https://open.spotify.com/search/${searchTerm}`,
    appleMusic: appleMusicId ? `https://music.apple.com/song/${encodeURIComponent(appleMusicId)}` : `https://music.apple.com/search?term=${searchTerm}`,
  };
};

const mergeUniqueHistory = (current: any[], next: any[]) => {
  const seen = new Set<string>();
  return [...current, ...next].filter((item, index) => {
    const key = String(item?.streamId || item?.id || `${getTrackId(item)}:${getStreamDate(item) || index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildTrackRows = (catalog: any[], history: any[], sortMode: SortMode): TrackRow[] => {
  const rows = new Map<string, TrackRow>();

  const upsert = (item: any, increment = 0) => {
    const id = getTrackId(item) || normalizeText(getTrackName(item));
    if (!id) return;
    const existing = rows.get(id);
    const durationMs = getTrackDurationMs(item);
    if (existing) {
      existing.playCount += increment;
      existing.durationMs += durationMs && increment > 0 ? durationMs : 0;
      existing.image = existing.image || getTrackImage(item);
      existing.artistName = existing.artistName || getTrackArtist(item);
      existing.trackNumber = existing.trackNumber || getTrackNumber(item);
      existing.discNumber = existing.discNumber || getDiscNumber(item);
      existing.track = { ...getTrack(item), ...existing.track };
      return;
    }

    rows.set(id, {
      id,
      name: getTrackName(item),
      image: getTrackImage(item),
      artistName: getTrackArtist(item),
      trackNumber: getTrackNumber(item),
      discNumber: getDiscNumber(item),
      playCount: increment,
      durationMs: durationMs && increment > 0 ? durationMs : 0,
      track: getTrack(item),
    });
  };

  catalog.forEach((item) => upsert(item, 0));
  history.forEach((item) => upsert(item, 1));

  const output = Array.from(rows.values());
  if (sortMode === 'trackNumber') {
    return output.sort((a, b) => {
      const discA = a.discNumber || 1;
      const discB = b.discNumber || 1;
      if (discA !== discB) return discA - discB;
      const numA = a.trackNumber || Number.MAX_SAFE_INTEGER;
      const numB = b.trackNumber || Number.MAX_SAFE_INTEGER;
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name);
    });
  }

  return output.sort((a, b) => b.playCount - a.playCount || a.name.localeCompare(b.name));
};

const getBestYear = (history: any[]) => {
  const years = new Map<string, number>();
  history.forEach((item) => {
    const date = getStreamDate(item);
    if (!date) return;
    const year = new Date(date).getFullYear();
    if (!Number.isFinite(year)) return;
    const key = String(year);
    years.set(key, (years.get(key) || 0) + 1);
  });

  return Array.from(years.entries()).sort((a, b) => b[1] - a[1])[0] || null;
};

const cleanLyrics = (lyrics?: string | null) => {
  if (!lyrics) return '';
  return lyrics
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const EntityStatsModal = ({ user, entity, kind, onClose, onTrackClick }: EntityStatsModalProps) => {
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const members = useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);

  const entityId = getEntityId(entity);
  const entityName = getEntityName(entity, kind);
  const entityImage = getEntityImage(entity, kind);
  const subtitle = getEntitySubtitle(entity, kind);
  const topType = kind === 'album' ? 'albums' : 'artists';

  const [activeTab, setActiveTab] = useState<EntityTab>('summary');
  const [sortMode, setSortMode] = useState<SortMode>(kind === 'album' ? 'trackNumber' : 'plays');
  const [rankSheetOpen, setRankSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [groupStatsLoaded, setGroupStatsLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [entityCount, setEntityCount] = useState(0);
  const [entityDurationMs, setEntityDurationMs] = useState(0);
  const [bestYearSummary, setBestYearSummary] = useState<[string, number] | null>(null);
  const [groupEntityStats, setGroupEntityStats] = useState<Record<string, number>>({});
  const [topYearRank, setTopYearRank] = useState<number | null>(null);
  const [topTotalRank, setTopTotalRank] = useState<number | null>(null);
  const [selectedLyricsTrack, setSelectedLyricsTrack] = useState<any | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsText, setLyricsText] = useState('');
  const [lyricsUrl, setLyricsUrl] = useState('');
  const [lyricsStatus, setLyricsStatus] = useState('');

  const trackRows = useMemo(() => buildTrackRows(catalog, historyItems, sortMode), [catalog, historyItems, sortMode]);
  const bestYear = bestYearSummary || getBestYear(historyItems);
  const loadedDurationMs = useMemo(() => historyItems.reduce((sum, item) => sum + getTrackDurationMs(item), 0), [historyItems]);
  const totalDurationMs = entityDurationMs || loadedDurationMs;
  const firstPlay = useMemo(() => {
    const dated = historyItems.filter((item) => getStreamDate(item)).sort((a, b) => new Date(getStreamDate(a)).getTime() - new Date(getStreamDate(b)).getTime());
    return dated[0] || null;
  }, [historyItems]);
  const lastPlay = useMemo(() => {
    const dated = historyItems.filter((item) => getStreamDate(item)).sort((a, b) => new Date(getStreamDate(b)).getTime() - new Date(getStreamDate(a)).getTime());
    return dated[0] || null;
  }, [historyItems]);

  const circleRows = useMemo(() => {
    return members
      .map((member) => ({ ...member, count: groupEntityStats[member.id] || groupEntityStats[member.key || ''] || 0 }))
      .filter((member) => member.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [groupEntityStats, members]);

  const selectedTrack = selectedLyricsTrack || trackRows.find((row) => row.playCount > 0)?.track || trackRows[0]?.track || null;
  const selectedTrackName = selectedTrack ? getTrackName(selectedTrack) : '';
  const selectedTrackArtist = selectedTrack ? getTrackArtist(selectedTrack) : '';

  const loadHistoryPage = useCallback(async (offset: number) => {
    if (!user?.id || !entityId) return;
    setHistoryLoading(true);
    const page = await statsService.fetchEntityStreamsPage(user.id, kind, entityId, {
      limit: HISTORY_PAGE_SIZE,
      offset,
    });
    setHistoryItems((current) => offset === 0 ? page.items : mergeUniqueHistory(current, page.items));
    setHistoryOffset(offset + page.items.length);
    setHasMoreHistory(page.items.length >= page.limit);
    setHistoryLoading(false);
  }, [entityId, kind, user?.id]);

  useEffect(() => {
    if (!user?.id || !entityId) return;
    const controller = new AbortController();
    let cancelled = false;

    setActiveTab('summary');
    setLoading(true);
    setCatalogLoaded(false);
    setGroupStatsLoaded(false);
    setCatalog([]);
    setHistoryItems([]);
    setHistoryOffset(0);
    setHasMoreHistory(true);
    setEntityCount(0);
    setEntityDurationMs(0);
    setBestYearSummary(null);
    setGroupEntityStats({});
    setTopYearRank(null);
    setTopTotalRank(null);
    setSelectedLyricsTrack(null);
    setLyricsText('');
    setLyricsUrl('');
    setLyricsStatus('');

    const load = async () => {
      const [statsResult, historyResult, topYearResult, topTotalResult] = await Promise.allSettled([
        statsService.fetchEntityStatsSummary(user.id, kind, entityId),
        statsService.fetchEntityStreamsPage(user.id, kind, entityId, { limit: HISTORY_PAGE_SIZE, offset: 0, signal: controller.signal }),
        statsService.getTopItems(user.id, topType, { period: 'year', limit: 100 }),
        statsService.getTopItems(user.id, topType, { period: 'all', limit: 100 }),
      ]);

      if (cancelled) return;

      if (statsResult.status === 'fulfilled') {
        setEntityCount(statsResult.value.count || 0);
        setEntityDurationMs(statsResult.value.durationMs || 0);
      }
      if (historyResult.status === 'fulfilled') {
        setHistoryItems(historyResult.value.items || []);
        setHistoryOffset(historyResult.value.items.length);
        setHasMoreHistory(historyResult.value.items.length >= historyResult.value.limit);
      }
      if (topYearResult.status === 'fulfilled') {
        const index = (topYearResult.value || []).findIndex((item: any) => sameEntity(item, entity));
        setTopYearRank(index >= 0 ? index + 1 : null);
      }
      if (topTotalResult.status === 'fulfilled') {
        const index = (topTotalResult.value || []).findIndex((item: any) => sameEntity(item, entity));
        setTopTotalRank(index >= 0 ? index + 1 : null);
      }
      setLoading(false);
    };

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [entity, entityId, kind, topType, user?.id]);

  useEffect(() => {
    if (!user?.id || !entityId) return;
    let cancelled = false;
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: Math.max(1, currentYear - 2024 + 1) }, (_, index) => 2024 + index);

    Promise.all(years.map(async (year) => {
      const summary = await statsService.fetchEntityStatsSummary(user.id, kind, entityId, {
        after: Date.UTC(year, 0, 1),
        before: Date.UTC(year + 1, 0, 1) - 1,
      });
      return [String(year), summary.count] as [string, number];
    })).then((summaries) => {
      if (cancelled) return;
      const strongest = summaries.filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])[0] || null;
      setBestYearSummary(strongest);
    });

    return () => {
      cancelled = true;
    };
  }, [entityId, kind, user?.id]);

  useEffect(() => {
    if (!entityId || activeTab !== 'tracks' || catalogLoaded) return;
    const controller = new AbortController();
    const request = kind === 'album'
      ? statsService.fetchAlbumTracks(entityId, { signal: controller.signal })
      : statsService.fetchArtistCatalog(entityId, 'top-tracks', { limit: 80, signal: controller.signal });

    request
      .then(setCatalog)
      .finally(() => {
        if (!controller.signal.aborted) setCatalogLoaded(true);
      });

    return () => controller.abort();
  }, [activeTab, catalogLoaded, entityId, kind]);

  useEffect(() => {
    if (!entityId || groupStatsLoaded || (activeTab !== 'summary' && activeTab !== 'circle')) return;
    let cancelled = false;
    statsService.fetchEntityGroupStats(kind, entityId)
      .then((nextStats) => {
        if (!cancelled) setGroupEntityStats(nextStats || {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGroupStatsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, entityId, groupStatsLoaded, kind]);

  useEffect(() => {
    if (activeTab !== 'lyrics' || !selectedTrackName) return;
    let cancelled = false;
    setLyricsLoading(true);
    setLyricsText('');
    setLyricsUrl('');
    setLyricsStatus('Buscando letra...');

    statsService.fetchLyricsFull(selectedTrackName, selectedTrackArtist)
      .then((response) => {
        if (cancelled) return;
        setLyricsText(cleanLyrics(response.lyrics));
        setLyricsUrl(response.match?.url || '');
        setLyricsStatus(response.lyrics ? 'Letra carregada' : response.hasLyrics ? 'Letra externa disponivel' : 'Letra indisponivel');
      })
      .catch(() => {
        if (!cancelled) setLyricsStatus('Letra indisponivel agora');
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedTrackArtist, selectedTrackName]);

  const openLyricsForTrack = (track: any) => {
    setSelectedLyricsTrack(track);
    setActiveTab('lyrics');
  };

  const copyLyrics = async () => {
    if (!lyricsText) return;
    await navigator.clipboard?.writeText(lyricsText);
    setLyricsStatus('Letra copiada');
  };

  const shareLyrics = async () => {
    if (!lyricsText) return;
    const text = `${selectedTrackName} - ${selectedTrackArtist}\n\n${lyricsText}`;
    if (navigator.share) {
      await navigator.share({ title: selectedTrackName, text });
      return;
    }
    await navigator.clipboard?.writeText(text);
    setLyricsStatus('Letra copiada para compartilhar');
  };

  const tabs: Array<{ id: EntityTab; label: string; icon: React.ElementType }> = [
    { id: 'summary', label: 'Resumo', icon: Sparkles },
    { id: 'tracks', label: kind === 'album' ? 'Faixas' : 'Musicas', icon: ListMusic },
    { id: 'circle', label: 'Circulo', icon: Users },
    { id: 'history', label: 'Historico', icon: History },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end justify-center liquid-glass-overlay px-0 sm:px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0.92 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0.92 }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="liquid-glass-modal relative flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[38px] border border-white/10 bg-black/70 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative shrink-0 overflow-hidden p-4 pb-3">
          <div className="absolute inset-0 pointer-events-none opacity-60">
            {entityImage && <img src={entityImage} alt="" className="h-full w-full scale-110 object-cover blur-3xl opacity-25" />}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/70 to-black" />
          </div>

          <div className="relative z-10 mx-auto mb-3 h-1 w-12 rounded-full bg-white/22" />
          <div className="relative z-10 flex items-start gap-3 pr-7">
            <SmartImage
              src={entityImage}
              className={cn("h-20 w-20 shrink-0 border border-white/10 shadow-2xl", kind === 'artist' ? 'rounded-[24px]' : 'rounded-[20px]')}
              fallback={entityName}
              rounded={kind === 'artist' ? '[24px]' : '[20px]'}
            />
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-1.5 overflow-hidden">
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-orange-300">
                  {kind === 'album' ? 'Album stats' : 'Artist stats'}
                </span>
                {(topYearRank || topTotalRank) && (
                  <button
                    type="button"
                    onClick={() => setRankSheetOpen(true)}
                    className="rounded-full border border-orange-500/25 bg-orange-500/[0.12] px-2 py-1 text-[8px] font-black uppercase tracking-widest text-orange-100/85 transition-[background-color,transform] active:scale-95"
                  >
                    {topYearRank ? `#${topYearRank} ano` : ''}
                    {topYearRank && topTotalRank ? ' · ' : ''}
                    {topTotalRank ? `#${topTotalRank} total` : ''}
                  </button>
                )}
              </div>
              <h2 className="line-clamp-2 text-xl font-black leading-[0.98] text-white font-display">{entityName}</h2>
              <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">{subtitle}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Metric label="plays" value={coreUtils.formatNumber(entityCount || historyItems.length)} />
                <Metric label="tempo" value={totalDurationMs ? coreUtils.formatDuration(totalDurationMs) : 'carregando'} />
                <Metric label="melhor ano" value={bestYear ? `${bestYear[0]} (${coreUtils.formatNumber(bestYear[1])})` : 'em analise'} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="absolute right-0 top-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-white/60 transition-colors hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="shrink-0 px-4 pb-3">
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white/[0.025] p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[7px] font-black uppercase tracking-[0.08em] transition-colors",
                    active ? "bg-orange-500 text-white shadow-lg shadow-orange-950/30" : "bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white/80"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] custom-scrollbar">
          <AnimatePresence mode="sync" initial={false}>
            {activeTab === 'summary' && (
              <TabPanel key="summary">
                <SummaryContent
                  kind={kind}
                  loading={loading}
                  entityCount={entityCount || historyItems.length}
                  totalDurationMs={totalDurationMs}
                  firstPlay={firstPlay}
                  lastPlay={lastPlay}
                  bestYear={bestYear}
                  topYearRank={topYearRank}
                  topTotalRank={topTotalRank}
                  circleRows={circleRows}
                  trackRows={trackRows}
                />
              </TabPanel>
            )}

            {activeTab === 'tracks' && (
              <TabPanel key="tracks">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-white">{kind === 'album' ? 'Faixas do album' : 'Musicas do artista'}</h3>
                    <p className="mt-1 text-[10px] text-white/40">{trackRows.length} itens carregados</p>
                  </div>
                  <button
                    onClick={() => setSortMode(sortMode === 'plays' ? 'trackNumber' : 'plays')}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white/65"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {sortMode === 'plays' ? 'plays' : 'numero'}
                  </button>
                </div>
                <TrackRows rows={trackRows} sortMode={sortMode} onLyrics={openLyricsForTrack} onTrackClick={onTrackClick} />
              </TabPanel>
            )}

            {activeTab === 'circle' && (
              <TabPanel key="circle">
                <CircleContent rows={circleRows} currentUserId={user?.id} />
              </TabPanel>
            )}

            {activeTab === 'history' && (
              <TabPanel key="history">
                <HistoryContent
                  items={historyItems}
                  loading={historyLoading}
                  hasMore={hasMoreHistory}
                  onLoadMore={() => loadHistoryPage(historyOffset)}
                  onLyrics={openLyricsForTrack}
                />
              </TabPanel>
            )}

            {activeTab === 'lyrics' && (
              <TabPanel key="lyrics">
                <LyricsContent
                  track={selectedTrack}
                  loading={lyricsLoading}
                  lyrics={lyricsText}
                  lyricsUrl={lyricsUrl}
                  status={lyricsStatus}
                  onCopy={copyLyrics}
                  onShare={shareLyrics}
                />
              </TabPanel>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {rankSheetOpen && (
            <motion.div
              className="absolute inset-0 z-40 flex items-end bg-black/28 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRankSheetOpen(false)}
            >
              <motion.div
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 14, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                onClick={(event) => event.stopPropagation()}
                className="w-full rounded-[28px] border border-white/10 bg-[#141414]/95 p-4 shadow-2xl backdrop-blur-2xl"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-300">Ranking pessoal</p>
                    <p className="mt-1 line-clamp-1 text-xs font-black text-white/84">{entityName}</p>
                  </div>
                  <button type="button" onClick={() => setRankSheetOpen(false)} className="rounded-full p-2 text-white/45 transition-colors hover:text-white" aria-label="Fechar ranking">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[22px] border border-orange-500/18 bg-orange-500/[0.08] px-4 py-4">
                    <span className="text-[8px] font-black uppercase tracking-[0.16em] text-orange-200/70">Top do ano</span>
                    <span className="mt-2 block text-2xl font-black leading-none text-white">{topYearRank ? `#${topYearRank}` : 'fora'}</span>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.045] px-4 py-4">
                    <span className="text-[8px] font-black uppercase tracking-[0.16em] text-white/42">Top total</span>
                    <span className="mt-2 block text-2xl font-black leading-none text-white">{topTotalRank ? `#${topTotalRank}` : 'fora'}</span>
                  </div>
                </div>
                <p className="mt-3 text-[10px] font-semibold leading-relaxed text-white/42">
                  Rankings calculados contra seu Top 100 pessoal para {kind === 'album' ? 'albuns' : 'artistas'}.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
    <span className="block text-[7px] font-black uppercase tracking-[0.18em] text-white/35">{label}</span>
    <span className="mt-0.5 block truncate text-[12px] font-black text-white">{value}</span>
  </div>
);

const TabPanel = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    className="pb-3"
  >
    {children}
  </motion.div>
);

const SummaryContent = ({
  kind,
  loading,
  entityCount,
  totalDurationMs,
  firstPlay,
  lastPlay,
  bestYear,
  topYearRank,
  topTotalRank,
  circleRows,
  trackRows,
}: {
  kind: EntityKind;
  loading: boolean;
  entityCount: number;
  totalDurationMs: number;
  firstPlay: any;
  lastPlay: any;
  bestYear: [string, number] | null;
  topYearRank: number | null;
  topTotalRank: number | null;
  circleRows: any[];
  trackRows: TrackRow[];
}) => {
  const leader = circleRows[0];
  const mostPlayedTrack = trackRows.slice().sort((a, b) => b.playCount - a.playCount)[0];
  const insights = [
    topYearRank ? `Top #${topYearRank} do ano` : null,
    topTotalRank ? `Top #${topTotalRank} no total` : null,
    bestYear ? `${bestYear[0]} foi o ano mais forte` : null,
    mostPlayedTrack?.playCount > 0 ? `${mostPlayedTrack.name}: ${coreUtils.formatNumber(mostPlayedTrack.playCount)}x` : null,
    firstPlay ? `Desde ${coreUtils.formatDateSP(getStreamDate(firstPlay))}` : null,
    lastPlay ? `Ultimo play ${coreUtils.formatDateSP(getStreamDate(lastPlay))}` : null,
  ].filter(Boolean).slice(0, 4) as string[];

  return (
    <div className="flex flex-col gap-3">
      {loading && (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 text-[11px] font-bold text-white/45">
          Carregando stats pessoais, circulo e historico...
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <InfoCard icon={Music2} label="Reproducoes" value={coreUtils.formatNumber(entityCount)} />
        <InfoCard icon={Clock3} label="Tempo carregado" value={totalDurationMs ? coreUtils.formatDuration(totalDurationMs) : 'em calculo'} />
        <InfoCard icon={CalendarDays} label="Ano mais forte" value={bestYear ? `${bestYear[0]} - ${coreUtils.formatNumber(bestYear[1])} plays` : 'sem historico'} />
        <InfoCard icon={Users} label="Circulo" value={leader ? `#1 ${leader.name}` : 'sem amigos ainda'} />
      </div>

      <div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">
          <Sparkles className="h-4 w-4" />
          Destaques
        </div>
        <p className="mb-3 text-[11px] font-semibold leading-relaxed text-white/58">
          {kind === 'album' ? 'Album' : 'Artista'} com {coreUtils.formatNumber(entityCount)} reproducoes carregadas.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {insights.map((insight) => (
            <div key={insight} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5 text-[10px] font-bold leading-snug text-white/68">
              {insight}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '80px' }}
    className="rounded-[26px] border border-white/10 bg-white/[0.035] p-4"
  >
    <Icon className="mb-3 h-4 w-4 text-orange-300" />
    <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-white/35">{label}</span>
    <span className="mt-1 block text-[14px] font-black text-white">{value}</span>
  </motion.div>
);

const CompactTrackRow = ({
  row,
  position,
  sortMode,
  onTrackClick,
  onActions,
  style,
}: {
  row: TrackRow;
  position: number;
  sortMode: SortMode;
  onTrackClick?: (track: any) => void;
  onActions: (track: any) => void;
  style?: React.CSSProperties;
}) => (
  <div style={style} className="px-0.5 py-1">
    <div className="flex h-full items-center gap-2.5 rounded-[20px] border border-white/8 bg-white/[0.025] px-2.5">
      <span className="w-6 shrink-0 text-center text-[9px] font-black tabular-nums text-white/28">
        {sortMode === 'trackNumber' && row.trackNumber ? row.trackNumber : position + 1}
      </span>
      <SmartImage src={row.image} className="h-10 w-10 shrink-0 rounded-xl" fallback={row.name} rounded="xl" />
      <button onClick={() => onTrackClick?.(row.track)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[11px] font-black text-white">{row.name}</span>
        <span className="mt-0.5 block truncate text-[9px] font-semibold text-white/38">{row.artistName}</span>
      </button>
      <div className="shrink-0 text-right">
        <span className="block text-[11px] font-black text-orange-300">{coreUtils.formatNumber(row.playCount)}x</span>
        {row.durationMs > 0 && <span className="block text-[7px] font-bold text-white/30">{coreUtils.formatDuration(row.durationMs)}</span>}
      </div>
      <button
        type="button"
        onClick={() => onActions(row.track)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.035] text-white/45"
        aria-label={`Acoes para ${row.name}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  </div>
);

const TrackRows = ({ rows, sortMode, onLyrics, onTrackClick }: { rows: TrackRow[]; sortMode: SortMode; onLyrics: (track: any) => void; onTrackClick?: (track: any) => void }) => {
  const [actionTrack, setActionTrack] = useState<any | null>(null);

  if (rows.length === 0) {
    return <EmptyState icon={ListMusic} text="Nenhuma musica carregada para esta entidade ainda." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.length > 16 ? (
        <List
          height={Math.min(520, rows.length * COMPACT_TRACK_ROW_HEIGHT)}
          itemCount={rows.length}
          itemSize={COMPACT_TRACK_ROW_HEIGHT}
          width="100%"
        >
          {({ index, style }) => (
            <CompactTrackRow
              row={rows[index]}
              position={index}
              sortMode={sortMode}
              onTrackClick={onTrackClick}
              onActions={setActionTrack}
              style={style}
            />
          )}
        </List>
      ) : rows.map((row, index) => (
        <CompactTrackRow
          key={`${row.id}-${index}`}
          row={row}
          position={index}
          sortMode={sortMode}
          onTrackClick={onTrackClick}
          onActions={setActionTrack}
        />
      ))}
      <AnimatePresence>
        {actionTrack && (
          <TrackActionMenu
            track={actionTrack}
            onClose={() => setActionTrack(null)}
            onLyrics={() => {
              onLyrics(actionTrack);
              setActionTrack(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const TrackActionMenu = ({ track, onLyrics, onClose }: { track: any; onLyrics: () => void; onClose: () => void }) => {
  const links = buildTrackLinks(track);
  const actionClass = "flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[8px] font-black uppercase tracking-widest text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="sticky bottom-2 z-20 mt-2 rounded-[22px] border border-white/10 bg-[#171717]/95 p-3 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="truncate text-[10px] font-black text-white/80">{getTrackName(track)}</span>
        <button type="button" onClick={onClose} aria-label="Fechar acoes" className="text-white/45"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.statsfm && <a className={actionClass} href={links.statsfm} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> stats.fm</a>}
        <a className={actionClass} href={links.spotify} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> Spotify</a>
        <a className={actionClass} href={links.appleMusic} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> Apple</a>
        <button className={actionClass} onClick={onLyrics}><BookOpen className="h-3 w-3" /> Letra</button>
      </div>
    </motion.div>
  );
};

const CircleContent = ({ rows, currentUserId }: { rows: any[]; currentUserId?: string }) => {
  if (rows.length === 0) return <EmptyState icon={Users} text="Ninguem do circulo apareceu com plays para esta entidade ainda." />;

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((member, index) => (
        <motion.div
          key={`${member.id}-${index}`}
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className={cn("flex items-center gap-3 rounded-[24px] border p-3", member.id === currentUserId ? "border-orange-500/25 bg-orange-500/[0.06]" : "border-white/10 bg-white/[0.025]")}
        >
          <span className="w-8 text-center text-[10px] font-black text-white/35">#{index + 1}</span>
          <SmartImage src={coreUtils.getUserAvatar(member.id, member.avatar)} className="h-11 w-11 rounded-full" fallback={member.name || member.id} rounded="full" />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-black text-white">{member.name}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">{member.id === currentUserId ? 'usuario principal' : 'circulo'}</span>
          </div>
          <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[11px] font-black text-orange-300">{coreUtils.formatNumber(member.count)}x</span>
        </motion.div>
      ))}
    </div>
  );
};

const HistoryContent = ({ items, loading, hasMore, onLoadMore, onLyrics }: { items: any[]; loading: boolean; hasMore: boolean; onLoadMore: () => void; onLyrics: (track: any) => void }) => {
  const [actionTrack, setActionTrack] = useState<any | null>(null);

  if (items.length === 0 && loading) {
    return <EmptyState icon={Loader2} text="Carregando historico..." spinning />;
  }
  if (items.length === 0) {
    return <EmptyState icon={History} text="Historico ainda nao retornou reproducoes para esta entidade." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => {
        const track = getTrack(item);
        const date = getStreamDate(item);
        return (
          <motion.div
            key={`${getTrackId(item)}-${date || index}`}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '120px' }}
            className="rounded-[20px] border border-white/8 bg-white/[0.025] p-2.5"
          >
            <div className="flex items-center gap-2.5">
              <SmartImage src={getTrackImage(item)} className="h-10 w-10 shrink-0 rounded-xl" fallback={getTrackName(item)} rounded="xl" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-black text-white">{getTrackName(item)}</span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/40">{getTrackArtist(item)}</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-black text-white/65">{date ? coreUtils.formatDateSP(date) : 'sem data'}</span>
                {date && <span className="block text-[8px] font-bold text-white/30">{coreUtils.formatTimeSP(date)}</span>}
              </div>
              <button
                type="button"
                onClick={() => setActionTrack(track)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.035] text-white/45"
                aria-label={`Acoes para ${getTrackName(item)}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        );
      })}
      <AnimatePresence>
        {actionTrack && (
          <TrackActionMenu
            track={actionTrack}
            onClose={() => setActionTrack(null)}
            onLyrics={() => {
              onLyrics(actionTrack);
              setActionTrack(null);
            }}
          />
        )}
      </AnimatePresence>
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
          {loading ? 'Carregando' : 'Ver mais historico'}
        </button>
      )}
    </div>
  );
};

const LyricsContent = ({ track, loading, lyrics, lyricsUrl, status, onCopy, onShare }: { track: any; loading: boolean; lyrics: string; lyricsUrl: string; status: string; onCopy: () => void; onShare: () => void }) => {
  if (!track) return <EmptyState icon={BookOpen} text="Escolha uma musica na lista para ver a letra." />;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-3">
          <SmartImage src={getTrackImage(track)} className="h-14 w-14 shrink-0 rounded-2xl" fallback={getTrackName(track)} rounded="2xl" />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-black text-white">{getTrackName(track)}</span>
            <span className="mt-0.5 block truncate text-[11px] font-bold text-white/45">{getTrackArtist(track)}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {lyricsUrl && <a href={lyricsUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white/65">Genius</a>}
          <button disabled={!lyrics} onClick={onCopy} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white/65 disabled:opacity-35"><Copy className="mr-1 inline h-3 w-3" /> Copiar</button>
          <button disabled={!lyrics} onClick={onShare} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white/65 disabled:opacity-35"><Share2 className="mr-1 inline h-3 w-3" /> Compartilhar</button>
        </div>
      </div>

      <div className="rounded-[30px] border border-white/10 bg-black/25 p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] font-bold text-white/45"><Loader2 className="h-4 w-4 animate-spin" /> {status || 'Buscando letra...'}</div>
        ) : lyrics ? (
          <pre className="whitespace-pre-wrap font-sans text-[13px] font-semibold leading-7 text-white/78">{lyrics}</pre>
        ) : (
          <div className="text-[12px] font-semibold text-white/45">{status || 'Letra indisponivel no app agora.'}</div>
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, text, spinning = false }: { icon: React.ElementType; text: string; spinning?: boolean }) => (
  <div className="flex flex-col items-center justify-center rounded-[30px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
    <Icon className={cn("mb-3 h-8 w-8 text-white/20", spinning && "animate-spin")} />
    <span className="text-[12px] font-bold text-white/42">{text}</span>
  </div>
);

export const UserAlbumStatsModal = (props: BaseEntityStatsModalProps) => (
  <EntityStatsModal {...props} kind="album" />
);

export const UserArtistStatsModal = (props: BaseEntityStatsModalProps) => (
  <EntityStatsModal {...props} kind="artist" />
);
