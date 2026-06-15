import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { Zap, Heart, Sparkles, Trophy, Clock, Disc3, ChevronLeft, ChevronRight } from 'lucide-react';
import { OrbitPagerIndicator, SmartImage } from '../shared/CommonUI';
import { getVisibleMembersWithLive } from '../../lib/memberSelectors';
import { useAutoOrbitRotation } from '../../hooks/useAutoOrbitRotation';
import { useViewportMotionGate } from '../../hooks/useViewportMotionGate';

interface HomeInsightsProps {
  onFriendClick: (friend: any) => void;
}

type HomeInsightTone = 'orange' | 'red' | 'yellow' | 'blue' | 'violet';

type HomeInsight = {
  key: string;
  type: 'active' | 'match' | 'month' | 'album' | 'rivalry' | 'late';
  tone: HomeInsightTone;
  icon: React.ReactNode;
  title: string;
  headline: string;
  detail: string;
  users: any[];
  image?: string;
  action?: () => void;
};

let cachedInsightIndex = 0;

// Helpers locais para melhorar inteligência dos insights
const getItemCount = (item: any): number => {
  if (!item) return 0;
  return item.playcount || item.streams || item.count || 0;
};

const getItemName = (item: any): string => {
  if (!item) return '';
  return item.name || item.title || '';
};

const normalizeName = (name: string): string => {
  return (name || '').toLowerCase().trim();
};

const firstName = (name?: string): string => {
  if (!name) return '';
  return name.trim().split(/\s+/)[0] || name;
};

const buildMatchReason = (match: any): string => {
  if (!match) return '';

  const u1 = match.u1;
  const u2 = match.u2;

  if (!u1 || !u2) return '';

  const u1Artists = new Set((u1.topItems?.artists || []).map((a: any) => normalizeName(getItemName(a))));
  const u2Artists = (u2.topItems?.artists || []).map((a: any) => normalizeName(getItemName(a)));

  const u1Tracks = new Set((u1.topItems?.tracks || []).map((t: any) => normalizeName(getItemName(t))));
  const u2Tracks = (u2.topItems?.tracks || []).map((t: any) => normalizeName(getItemName(t)));

  const commonTracks: string[] = [];
  const commonArtists: string[] = [];

  u2Tracks.forEach((name: string) => {
    if (name && u1Tracks.has(name)) {
      const tItem = u1.topItems?.tracks?.find((t: any) => normalizeName(getItemName(t)) === name);
      if (tItem) commonTracks.push(getItemName(tItem));
    }
  });

  u2Artists.forEach((name: string) => {
    if (name && u1Artists.has(name)) {
      const aItem = u1.topItems?.artists?.find((a: any) => normalizeName(getItemName(a)) === name);
      if (aItem) commonArtists.push(getItemName(aItem));
    }
  });

  const totalCommon = commonTracks.length + commonArtists.length;
  if (totalCommon > 1) {
    return `${totalCommon} itens em comum nesta semana.`;
  }

  if (commonTracks.length > 0) {
    const trackName = commonTracks[0];
    return `Faixa em comum: ${trackName}.`;
  }

  if (commonArtists.length > 0) {
    const artistName = commonArtists[0];
    return `Artista em comum: ${artistName}.`;
  }

  return '';
};

const getDominantAlbumInsight = (member: any): string => {
  if (!member) return 'Álbum em destaque nesta semana.';

  const album = member.topItems?.albums?.[0];
  if (!album) return 'Álbum em destaque nesta semana.';

  const count = getItemCount(album);
  const userName = member.name || 'usuário';

  if (count > 0) {
    return `${coreUtils.formatNumber(count)} plays nesta semana.`;
  }

  return `Álbum no topo semanal de ${userName}.`;
};

const getRivalryInsight = (leader: any, runnerUp: any): string => {
  if (!leader || !runnerUp) return 'Disputa em andamento hoje.';

  const leaderStreams = leader.streamsToday || 0;
  const runnerUpStreams = runnerUp.streamsToday || 0;
  const diff = Math.abs(leaderStreams - runnerUpStreams);
  const leaderName = firstName(leader.name) || 'líder';

  if (diff === 0) {
    return 'Empate técnico hoje.';
  }

  if (diff <= 5) {
      return `${coreUtils.formatNumber(diff)} plays separam os dois.`;
  }

  if (diff <= 25) {
    return `${coreUtils.formatNumber(diff)} plays de diferença.`;
  }

  return `${leaderName} abriu ${coreUtils.formatNumber(diff)} plays.`;
};

const getMostActiveInsight = (member: any): string => {
  if (!member) return 'Ativo hoje.';

  const streams = member.streamsToday || 0;

  if (streams === 0) return 'Ativo hoje.';

  if (streams === 1) {
    return 'Primeiro play do dia.';
  }

  if (streams < 10) {
    return `${coreUtils.formatNumber(streams)} plays hoje.`;
  }

  return `Lidera hoje com ${coreUtils.formatNumber(streams)} plays.`;
};

const getMonthLeaderInsight = (member: any): string => {
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
  if (!member) return `Lidera ${monthName}.`;

  const streams = member.streamsMonth || 0;

  if (streams === 0) return `Lidera ${monthName}.`;

  return `${coreUtils.formatNumber(streams)} plays em ${monthName}.`;
};

export const HomeInsights: React.FC<HomeInsightsProps> = React.memo(({ onFriendClick }) => {
  const shouldReduceMotion = useReducedMotion();
  const { ref: insightsRef, isInViewport: isInsightsVisible } = useViewportMotionGate<HTMLDivElement>({ rootMargin: '180px' });
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const [activeInsightIndex, setActiveInsightIndex] = React.useState(cachedInsightIndex);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const activeMembers = React.useMemo(
    () => getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId),
    [groupStats, hiddenUsers, liveNowPlayingByUserId]
  );

  const mostActive = React.useMemo(() => {
    if (activeMembers.length === 0) return null;
    return [...activeMembers].reduce((prev, current) => {
      return (current.streamsToday || 0) > (prev.streamsToday || 0) ? current : prev;
    }, activeMembers[0]);
  }, [activeMembers]);

  const match = React.useMemo(() => {
    if (activeMembers.length < 2) return null;

    const candidates: any[] = [];
    const daySeed = Math.floor(Date.now() / 86400000);

    for (let i = 0; i < activeMembers.length; i++) {
      for (let j = i + 1; j < activeMembers.length; j++) {
        const u1 = activeMembers[i];
        const u2 = activeMembers[j];

        const u1Artists = new Set((u1.topItems?.artists || []).map((a: any) => (a.name || "").toLowerCase()));
        const u2Artists = (u2.topItems?.artists || []).map((a: any) => (a.name || "").toLowerCase());

        let commonScore = 0;
        u2Artists.forEach((name: string) => {
          if (name && u1Artists.has(name)) {
            commonScore += 10;
          }
        });

        const u1Tracks = new Set((u1.topItems?.tracks || []).map((t: any) => (t.name || "").toLowerCase()));
        const u2Tracks = (u2.topItems?.tracks || []).map((t: any) => (t.name || "").toLowerCase());
        u2Tracks.forEach((name: string) => {
          if (name && u1Tracks.has(name)) {
            commonScore += 15;
          }
        });

        const activityTieBreaker = ((u1.streamsToday || 0) + (u2.streamsToday || 0)) / 100;
        if (commonScore > 0) {
          candidates.push({
            u1,
            u2,
            score: commonScore + activityTieBreaker
          });
        }
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    return candidates[daySeed % candidates.length];
  }, [activeMembers]);

  const insights = React.useMemo(() => {
    const sortedToday = [...activeMembers].sort((a, b) => (b.streamsToday || 0) - (a.streamsToday || 0));
    const topMonth = [...activeMembers].sort((a, b) => (b.streamsMonth || 0) - (a.streamsMonth || 0))[0];
    const albumUser = [...activeMembers].sort((a, b) => ((b.topItems?.albums?.[0]?.playcount || b.topItems?.albums?.[0]?.streams || 0) - (a.topItems?.albums?.[0]?.playcount || a.topItems?.albums?.[0]?.streams || 0)))[0];
    const lateUser = [...activeMembers].sort((a, b) => new Date(b.nowPlaying?.timestamp || 0).getTime() - new Date(a.nowPlaying?.timestamp || 0).getTime())[0];
    const runnerUp = sortedToday[1];
    const album = albumUser?.topItems?.albums?.[0];

    return [
      mostActive && {
        key: 'active',
        tone: 'orange',
        icon: <Zap className="h-3.5 w-3.5 text-orange-300" />,
        title: 'Mais ativo',
        headline: firstName(mostActive.name),
        detail: getMostActiveInsight(mostActive),
        users: [mostActive],
        image: coreUtils.getUserAvatar(mostActive.id, mostActive.avatar),
        action: () => onFriendClick(mostActive),
        type: 'active'
      },
      match && buildMatchReason(match) && {
        key: 'match',
        tone: 'red',
        icon: <Heart className="h-3.5 w-3.5 fill-red-300 text-red-300" />,
        title: 'Match semanal',
        headline: `${firstName(match.u1.name)} + ${firstName(match.u2.name)}`,
        detail: buildMatchReason(match),
        users: [match.u1, match.u2],
        type: 'match'
      },
      topMonth && {
        key: 'month',
        tone: 'yellow',
        icon: <Trophy className="h-3.5 w-3.5 text-yellow-200" />,
        title: 'Líder do mês',
        headline: firstName(topMonth.name),
        detail: getMonthLeaderInsight(topMonth),
        users: [topMonth],
        image: coreUtils.getUserAvatar(topMonth.id, topMonth.avatar),
        action: () => onFriendClick(topMonth),
        type: 'month'
      },
      albumUser && album && {
        key: 'album',
        tone: 'blue',
        icon: <Disc3 className="h-3.5 w-3.5 text-sky-200" />,
        title: 'Álbum do topo',
        headline: album.name || firstName(albumUser.name),
        detail: getDominantAlbumInsight(albumUser),
        users: [albumUser],
        image: album.image,
        action: () => onFriendClick(albumUser),
        type: 'album',
      },
      (runnerUp || lateUser) && {
        key: 'pulse',
        tone: 'violet',
        icon: <Clock className="h-3.5 w-3.5 text-violet-200" />,
        title: runnerUp ? 'Disputa hoje' : 'Última atividade',
        headline: runnerUp ? `${firstName(mostActive?.name)} vs ${firstName(runnerUp.name)}` : firstName(lateUser?.name),
        detail: runnerUp ? getRivalryInsight(mostActive, runnerUp) : lateUser?.nowPlaying?.track?.name || 'Sem playback recente.',
        users: runnerUp && mostActive ? [mostActive, runnerUp] : lateUser ? [lateUser] : [],
        action: runnerUp && mostActive ? () => onFriendClick(mostActive) : lateUser ? () => onFriendClick(lateUser) : undefined,
        type: runnerUp ? 'rivalry' : 'late'
      }
    ].filter(Boolean) as HomeInsight[];
  }, [activeMembers, match, mostActive, onFriendClick]);

  const advanceInsight = React.useCallback(() => {
    if (insights.length < 2) return;
    setActiveInsightIndex((current) => {
      const nextIndex = (current + 1) % insights.length;
      cachedInsightIndex = nextIndex;
      return nextIndex;
    });
  }, [insights.length]);

  const { restart: restartRotation, interactionProps } = useAutoOrbitRotation({
    enabled: isInsightsVisible && !shouldReduceMotion && insights.length > 1,
    intervalMs: 6500,
    kind: 'home-insights-rotation',
    onAdvance: advanceInsight,
  });

  const goToInsight = React.useCallback((index: number) => {
    if (insights.length === 0) return;
    const nextIndex = (index + insights.length) % insights.length;
    cachedInsightIndex = nextIndex;
    setActiveInsightIndex(nextIndex);
    restartRotation();
  }, [activeInsightIndex, insights.length, restartRotation]);

  const handlePrev = React.useCallback(() => {
    goToInsight(activeInsightIndex - 1);
  }, [activeInsightIndex, goToInsight]);

  const handleNext = React.useCallback(() => {
    goToInsight(activeInsightIndex + 1);
  }, [activeInsightIndex, goToInsight]);

  React.useEffect(() => {
    if (activeInsightIndex >= insights.length) {
      cachedInsightIndex = 0;
      setActiveInsightIndex(0);
    }
  }, [activeInsightIndex, insights.length]);

  const handleTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) handleNext();
    else handlePrev();
  }, [handleNext, handlePrev]);

  if (activeMembers.length < 2 || insights.length === 0) return null;

  const visibleInsightIndices = React.useMemo(() => {
    if (insights.length === 0) return [];
    if (insights.length === 1) return [activeInsightIndex % insights.length];
    const firstIndex = activeInsightIndex % insights.length;
    const secondIndex = (firstIndex + 1) % insights.length;
    return [firstIndex, secondIndex];
  }, [activeInsightIndex, insights]);

  const getToneClasses = (tone: HomeInsightTone) => {
    switch (tone) {
      case 'red':
        return {
          border: 'border-red-300/24',
          text: 'text-red-200',
          glow: 'rgba(248,113,113,0.2)',
          bg: 'bg-red-400/10',
          ring: 'ring-red-300/28',
        };
      case 'yellow':
        return {
          border: 'border-yellow-200/24',
          text: 'text-yellow-100',
          glow: 'rgba(250,204,21,0.2)',
          bg: 'bg-yellow-300/10',
          ring: 'ring-yellow-200/28',
        };
      case 'blue':
        return {
          border: 'border-sky-200/24',
          text: 'text-sky-100',
          glow: 'rgba(125,211,252,0.18)',
          bg: 'bg-sky-300/10',
          ring: 'ring-sky-200/28',
        };
      case 'violet':
        return {
          border: 'border-violet-200/24',
          text: 'text-violet-100',
          glow: 'rgba(196,181,253,0.18)',
          bg: 'bg-violet-300/10',
          ring: 'ring-violet-200/28',
        };
      default:
        return {
          border: 'border-orange-300/28',
          text: 'text-orange-200',
          glow: 'rgba(249,115,22,0.22)',
          bg: 'bg-orange-400/10',
          ring: 'ring-orange-300/30',
        };
    }
  };

  const renderInsightMedia = (insight: HomeInsight, size: 'main' | 'satellite') => {
    const tone = getToneClasses(insight.tone);
    const isMain = size === 'main';
    const imageSize = isMain ? 'h-10 w-10' : 'h-9 w-9';
    const userImageSize = isMain ? 'h-10 w-10' : 'h-8 w-8';
    const iconSize = isMain ? 'h-10 w-10' : 'h-9 w-9';
    const users = insight.users.slice(0, 2);

    if (insight.image) {
      return (
        <div className={`${imageSize} shrink-0 overflow-hidden ${insight.type === 'album' ? 'rounded-[16px]' : 'rounded-full'} bg-white/[0.04] ring-1 ${tone.ring} shadow-[0_10px_24px_rgba(0,0,0,0.28)]`}>
          <SmartImage src={insight.image} cacheKey={`home-insight-media:${insight.key}`} rounded={insight.type === 'album' ? '2xl' : 'full'} className="h-full w-full object-cover" fallback="" />
        </div>
      );
    }

    if (users.length > 0) {
      return (
        <div className={`flex ${isMain ? '-space-x-3' : '-space-x-2'} shrink-0`}>
          {users.map((user) => (
            <div key={user.id} className={`${userImageSize} overflow-hidden rounded-full bg-white/[0.04] ring-1 ${tone.ring} shadow-[0_10px_24px_rgba(0,0,0,0.28)]`}>
              <SmartImage src={coreUtils.getUserAvatar(user.id, user.avatar)} cacheKey={`home-insight-user:${user.id}`} rounded="full" className="h-full w-full object-cover" fallback="" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={`${iconSize} flex shrink-0 items-center justify-center rounded-full border ${tone.border} ${tone.bg} ${tone.text}`}>
        {insight.icon}
      </div>
    );
  };

  return (
    <div className="mb-0 mt-1 flex flex-col gap-2 overflow-visible">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <h2 className="text-[13px] font-black uppercase tracking-[0.36em] text-white/86">
            Insights do Dia
          </h2>
        </div>
        {insights.length > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={handlePrev} className="rounded-full p-1.5 transition-colors hover:bg-white/10">
              <ChevronLeft className="h-4 w-4 text-white/35" />
            </button>
            <button type="button" onClick={handleNext} className="rounded-full p-1.5 transition-colors hover:bg-white/10">
              <ChevronRight className="h-4 w-4 text-white/35" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={insightsRef}
        data-home-horizontal-scroll="true"
        className="relative h-[190px] select-none overflow-visible rounded-[28px] px-0 py-1.5"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null; }}
        {...interactionProps}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_50%_40%,rgba(249,115,22,0.12),rgba(0,0,0,0)_44%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 z-10 grid grid-cols-[1.35fr_0.65fr] gap-2 px-0.5">
          {visibleInsightIndices.map((index, slot) => {
            const insight = insights[index];
            const tone = getToneClasses(insight.tone);
            return (
              <motion.button
                key={insight.key}
                type="button"
                onClick={() => insight.action?.()}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 240, damping: 28, mass: 0.72 }}
                className={`apple-glass-panel relative flex h-[158px] min-w-0 flex-col overflow-visible rounded-[24px] border border-white/8 p-3 text-left shadow-[0_18px_48px_rgba(0,0,0,0.34)] ${slot === 0 ? 'translate-y-0' : 'translate-y-2 opacity-75'}`}
                style={{
                  boxShadow: `0 18px 48px rgba(0,0,0,0.34), 0 0 28px ${tone.glow}`,
                }}
              >
                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />
                <div className="flex min-w-0 items-center gap-2">
                  {renderInsightMedia(insight, 'main')}
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.bg} ${tone.text}`}>
                    {insight.icon}
                  </span>
                </div>
                <div className="mt-3 flex min-w-0 flex-col gap-1">
                  <span className={`text-[8px] font-black uppercase tracking-[0.22em] ${tone.text}`}>
                    {insight.title}
                  </span>
                  <h3 className={slot === 0 ? "line-clamp-2 text-[18px] font-black leading-[1] tracking-[-0.03em] text-white" : "line-clamp-2 text-[14px] font-black leading-[1.05] tracking-[-0.02em] text-white"}>
                    {insight.headline}
                  </h3>
                  <p className="line-clamp-2 text-[10px] font-medium leading-snug text-white/58">
                    {insight.detail}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
        <div className="absolute bottom-1 left-1/2 z-30 -translate-x-1/2">
          <OrbitPagerIndicator
            count={insights.length}
            activeIndex={activeInsightIndex}
            onSelect={goToInsight}
            label="insight"
          />
        </div>
      </div>
    </div>
  );
});
