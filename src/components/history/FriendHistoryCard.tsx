import React, { useState, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShimmerOverlay, Skeleton, SmartImage } from '../shared/CommonUI';
import { cn } from '../../lib/utils';
import { coreUtils } from '../../services/statsCore';
import { getArtistListString } from '../../lib/artistUtils';
import { statsCacheService } from '../../services/statsCacheService';
import { useStatsStore } from '../../store/useStatsStore';
import { ExternalLink, Send } from 'lucide-react';
import { getCanonicalMembers } from '../../lib/memberSelectors';

const historyItemKey = (item: any, index: number) => {
  const track = item?.track || {};
  const stableId = track.id || track.name || 'track';
  const time = item?.playedAt || item?.endTime || item?.timestamp || item?.played_at || 'unknown-time';
  return `history-${stableId}-${time}-${index}`;
};

interface FriendHistoryCardProps {
  user: any;
  onTrackClick: (track: any) => void;
  onFullHistoryClick?: (user: any) => void;
  index?: number;
  showFullHistoryButton?: boolean;
  showInlineHistory?: boolean;
}

// Ícone de equalizer para o header (ao vivo no card)
const EqualizerIcon = () => (
  <div className="flex items-end gap-[1.5px] h-3 mr-2">
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        className="h-full w-[2px] origin-bottom rounded-[1px] bg-orange-500 will-change-transform"
        animate={{ scaleY: [0.3, 1, 0.4] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
      />
    ))}
  </div>
);

// Ícone animado para "ouvindo agora" nos itens da lista - ondas de rádio
const LiveWaveIcon = () => (
  <div className="relative h-5 w-5 flex items-center justify-center">
    <motion.div
      className="absolute inset-0 rounded-full border border-orange-500/60"
      animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
    />
    <motion.div
      className="absolute inset-[3px] rounded-full border border-orange-500/50"
      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
    />
    <div className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.8)]" />
  </div>
);

const firstFiniteNumber = (...values: any[]) => {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return 0;
};

const getTrackImage = (track: any) => {
  const candidates = [
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
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 5) return candidate;
    if (candidate?.url && typeof candidate.url === 'string') return candidate.url;
  }

  return '';
};

const getActivityTimestamp = (user: any) => (
  user?.nowPlaying?.timestamp ||
  user?.nowPlaying?.playedAt ||
  user?.nowPlaying?.endTime ||
  user?.recent?.[0]?.playedAt ||
  user?.recent?.[0]?.timestamp ||
  user?.recent?.[0]?.endTime ||
  null
);

const openOrbitComposer = (track: any) => {
  if (!track) return;
  window.dispatchEvent(new CustomEvent('stats-lc:compose-orbit', { detail: { track } }));
};

export const FriendHistoryCard = memo(({
  user,
  onTrackClick,
  onFullHistoryClick,
  index = 0,
  showFullHistoryButton = true,
  showInlineHistory = true
}: FriendHistoryCardProps) => {
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [recents, setRecents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<any>(null);

  const groupStats = useStatsStore(state => state.groupStats);
  const storeUser = useMemo(
    () => getCanonicalMembers(groupStats).find(m => m.id === user.id) || user,
    [groupStats, user]
  );
  const animationDuration = useStatsStore(state => state.animationDuration) || 0.5;
  const animationDelay = useStatsStore(state => state.animationDelay) || 0.04;

  const isLive = storeUser.nowPlaying?.isNow === true;
  const activityTimestamp = getActivityTimestamp(storeUser) || getActivityTimestamp(user);
  const activityLabel = activityTimestamp
    ? coreUtils.formatRelativeTimeSP(activityTimestamp).toUpperCase()
    : 'SESSÃO RECENTE';

  const getHistoryList = (): any[] => {
    if (isLive && (storeUser.nowPlaying?.track || user.nowPlaying?.track)) {
      const liveTrack = {
        track: storeUser.nowPlaying?.track || user.nowPlaying?.track,
        playedAt: new Date().toISOString(),
        isLive: true
      };
      const otherRecents = recents.filter(
        item => item.track?.id !== (storeUser.nowPlaying?.track?.id || user.nowPlaying?.track?.id)
      );
      return [liveTrack, ...otherRecents].slice(0, 5);
    }
    return recents.slice(0, 5);
  };

  // Sempre carrega dados ao montar — não só ao expandir
  useEffect(() => {
    let mounted = true;
    const store = useStatsStore.getState();

    const fetchData = async () => {
      if (!showInlineHistory) {
        const initialStats = statsCacheService.getStats(user.id);
        if (initialStats && mounted) setUserStats(initialStats);
        if (mounted) setLoading(false);
        return;
      }

      const embeddedRecent = storeUser.recent || user.recent || [];
      if (embeddedRecent.length > 0 && mounted) {
        setRecents(embeddedRecent);
        setLoading(false);
      }

      // 1. Servir cache imediatamente se disponível
      const cachedHistory = store.getHistoryCache(user.id);
      if (cachedHistory && cachedHistory.length > 0 && mounted) {
        setRecents(cachedHistory);
        setLoading(false);
      }

      const initialStats = statsCacheService.getStats(user.id);
      if (initialStats && mounted) setUserStats(initialStats);
      const needsYearStats = !initialStats || !Number(initialStats.totalStreamsThisYear);
      if (needsYearStats) {
        statsCacheService.cacheUserStats(user.id).then((stats) => {
          if (mounted && stats) setUserStats(stats);
        });
      }

      // 2. Só buscar dados novos se não tiver cache ou se o cache for muito antigo (> 5 min)
      const hasValidCache =
        (cachedHistory && cachedHistory.length > 0) ||
        embeddedRecent.length > 0;
      if (hasValidCache) {
        // Já tem histórico, não precisa buscar músicas novamente; stats podem chegar em background.
        return;
      }

      try {
        // 3. Buscar histórico real apenas se não tiver cache
        const historyData = await statsCacheService.cacheUserHistory(user.id);
        if (mounted) {
          setRecents(historyData);
          setLoading(false);
        }

        // 4. Stats consolidadas
        const stats = await statsCacheService.cacheUserStats(user.id);
        if (mounted && stats) setUserStats(stats);
      } catch (e) {
        console.error("Failed to load history for", user.id, e);
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [user.id, showInlineHistory]);

  const historyList = getHistoryList();

  const currentStats = {
    streamsToday: firstFiniteNumber(
      storeUser.streamsToday,
      user.streamsToday,
      storeUser.stats?.today?.streams,
      user.stats?.today?.streams,
      userStats?.streamsToday
    ),
    totalStreamsThisMonth: firstFiniteNumber(
      storeUser.streamsMonth,
      user.streamsMonth,
      storeUser.stats?.month?.streams,
      user.stats?.month?.streams,
      userStats?.totalStreamsThisMonth
    ),
    totalStreamsThisYear: firstFiniteNumber(
      storeUser.streamsYear,
      user.streamsYear,
      storeUser.stats?.year?.streams,
      storeUser.stats?.current_year?.streams,
      user.stats?.year?.streams,
      user.stats?.current_year?.streams,
      userStats?.totalStreamsThisYear
    ),
    lifetime: firstFiniteNumber(
      storeUser.totalStreams,
      user.totalStreams,
      storeUser.stats?.lifetime?.streams,
      user.stats?.lifetime?.streams,
      userStats?.lifetime
    )
  };

  const fmt = (n: number) => coreUtils.formatNumber(n || 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{
        opacity: { duration: animationDuration },
        x: { delay: Math.min((index % 4) * animationDelay, animationDelay * 5), duration: animationDuration, ease: [0.16, 1, 0.3, 1] }
      }}
      className="flex flex-col"
    >
      {/* Card principal */}
      <div className={cn(
        "flex flex-col rounded-[24px] border overflow-hidden transition-colors duration-200",
        "glass border-white/10"
      )}>
        {/* Header do usuário */}
        <motion.button
          onClick={() => setIsStatsExpanded(!isStatsExpanded)}
          className="flex items-center justify-between py-2.5 px-3.5 group transition-colors relative"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <SmartImage
                src={coreUtils.getUserAvatar(user.id, user.avatar)}
                className="h-10 w-10 rounded-full shrink-0 border border-white/20 shadow-lg"
                fallback=""
                rounded="full"
              />
              {isLive && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-orange-500 rounded-full border-2 border-[#050505] flex items-center justify-center shadow-lg"
                >
                  <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                </motion.div>
              )}
            </div>

            <div className="flex flex-col min-w-0 flex-1 text-left">
              <span className="text-[12px] font-bold text-white/90 truncate leading-tight">
                {user.name}
              </span>
              <span className="text-[9.5px] font-medium text-white/50 uppercase tracking-widest mt-0.5">
                {isLive ? (
                  <span className="text-orange-400 font-black flex items-center gap-1">
                    Ouvindo Agora
                  </span>
                ) : (
                  activityLabel
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLive && <EqualizerIcon />}
            {/* Stats resumidas colapsadas */}
            <AnimatePresence>
              {!isStatsExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center gap-2 mr-1"
                >
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-orange-500 leading-none">{fmt(currentStats.streamsToday)}</span>
                    <span className="text-[6.5px] font-black uppercase tracking-[0.2em] text-white/20 mt-0.5">Hoje</span>
                  </div>
                  <div className="w-px h-5 bg-white/10" />
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-white/70 leading-none">{fmt(currentStats.totalStreamsThisMonth)}</span>
                    <span className="text-[6.5px] font-black uppercase tracking-[0.2em] text-white/20 mt-0.5">Mês</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div
              animate={{ rotate: isStatsExpanded ? 180 : 0 }}
              className="text-white/40 shrink-0 text-sm"
            >
              ⌄
            </motion.div>
          </div>
        </motion.button>

        {/* Stats expandidas */}
        <AnimatePresence>
          {isStatsExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 border-t border-white/5 flex gap-4 text-center bg-white/[0.01]">
                {[
                  { label: 'Hoje', value: fmt(currentStats.streamsToday), color: 'text-orange-500' },
                  { label: 'Mês', value: fmt(currentStats.totalStreamsThisMonth), color: 'text-white/90' },
                  { label: 'Ano', value: fmt(currentStats.totalStreamsThisYear), color: 'text-white/90' },
                ].map(stat => (
                  <div key={stat.label} className="flex-1 flex flex-col gap-0.5">
                    <span className="text-[7px] font-black uppercase tracking-[0.25em] text-white/30">{stat.label}</span>
                    <span className={cn("text-[13px] font-black font-sans", stat.color)}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showInlineHistory && isStatsExpanded && (
        <div className="border-t border-white/5">
          {loading && recents.length === 0 ? (
            <div className="p-3 flex flex-col gap-2">
              <ShimmerOverlay duration={2.6} />
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="flex items-center gap-3 p-1.5 rounded-xl">
                  <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <Skeleton className="h-2.5 w-28 rounded-full" />
                    <Skeleton className="h-2 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-2 w-8 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          ) : historyList.length === 0 ? (
            <div className="text-center py-6">
              <span className="text-[11px] font-medium text-white/30">Nenhuma reprodução recente</span>
            </div>
          ) : (
            <div className="p-2.5 flex flex-col gap-1">
              <AnimatePresence>
                {historyList.map((item, idx) => (
                  <motion.div
                    key={historyItemKey(item, idx)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ willChange: "transform, opacity" }}
                    transition={{ delay: Math.min(idx * 0.04, 0.2), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => onTrackClick?.(item.track)}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    {/* Capa com badge de count */}
                    <div className="shrink-0 relative">
                      <SmartImage
                        src={getTrackImage(item.track)}
                        className="h-9 w-9 rounded-lg shrink-0"
                        fallback=""
                        rounded="lg"
                      />
                      {(item.playCount > 1) && !item.isLive && (
                        <div className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-600 border border-[#111] flex items-center justify-center shadow-lg z-20">
                          <span className="text-[8px] font-black text-white leading-none">{fmt(item.playCount)}</span>
                        </div>
                      )}
                    </div>

                    {/* Info da faixa */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] font-bold text-white/90 truncate leading-tight group-hover:text-orange-400 transition-colors">
                          {item.track?.name}
                        </span>
                        {item.playCount === 1 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-1 bg-orange-500/15 px-1.5 py-0.5 rounded-full border border-orange-500/25 shrink-0"
                          >
                            <div className="h-1 w-1 rounded-full bg-orange-400 animate-ping" />
                            <span className="text-[6px] font-black text-orange-400 uppercase tracking-widest leading-none">Inédito</span>
                          </motion.div>
                        )}
                      </div>
                      <span className="text-[8px] font-medium text-white/40 truncate">
                        {getArtistListString(item.track)}
                      </span>
                    </div>

                    {/* Direita: tempo ou ícone ao vivo */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openOrbitComposer(item.track);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-500/15 bg-orange-500/10 text-orange-400 opacity-70 transition-opacity hover:opacity-100"
                        aria-label="Enviar Orbit"
                      >
                        <Send className="h-3 w-3" />
                      </button>
                      {item.isLive ? (
                        <LiveWaveIcon />
                      ) : (
                        <span className="text-[7px] font-mono text-white/30">
                          {coreUtils.formatTimeSP(new Date(item.playedAt))}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
        )}

        {/* Botão "Ver histórico completo" */}
        {!loading && showFullHistoryButton && (
          <div className="px-3 pb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFullHistoryClick?.(user);
              }}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.22em] text-white/40 hover:text-white/70 hover:bg-white/[0.06] active:scale-[0.99] transition-all flex items-center justify-center gap-2 group"
            >
              <ExternalLink className="h-3 w-3 text-orange-500/50 group-hover:text-orange-500 transition-colors" />
              Ver histórico completo
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

FriendHistoryCard.displayName = 'FriendHistoryCard';
