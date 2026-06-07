import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { Zap, Heart, Sparkles, Trophy, Clock, Disc3, ChevronLeft, ChevronRight } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';
import { getVisibleMembersWithLive } from '../../lib/memberSelectors';

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

const useInsightsVisibility = () => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '180px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible] as const;
};

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

  if (commonTracks.length > 0) {
    const trackName = commonTracks[0];
    if (commonTracks.length === 1) {
      return `os dois repetiram '${trackName}' no período`;
    }
    return `${commonTracks.length} faixas em comum no topo`;
  }

  if (commonArtists.length > 0) {
    const artistName = commonArtists[0];
    if (commonArtists.length === 1) {
      return `${artistName} conecta os dois rankings de hoje`;
    }
    return `compartilham ${commonArtists.length} artistas no topo`;
  }

  const totalCommon = commonTracks.length + commonArtists.length;
  if (totalCommon > 1) {
    return `${totalCommon} pontos em comum entre artistas e faixas`;
  }

  return '';
};

const getDominantAlbumInsight = (member: any): string => {
  if (!member) return 'álbum em destaque';

  const album = member.topItems?.albums?.[0];
  if (!album) return 'álbum em destaque';

  const count = getItemCount(album);
  const userName = member.name || 'usuário';

  if (count > 0) {
    return `álbum mais repetido por ${userName}: ${coreUtils.formatNumber(count)} plays`;
  }

  return `álbum que domina o topo de ${userName}`;
};

const getRivalryInsight = (leader: any, runnerUp: any): string => {
  if (!leader || !runnerUp) return 'disputa em andamento';

  const leaderStreams = leader.streamsToday || 0;
  const runnerUpStreams = runnerUp.streamsToday || 0;
  const diff = Math.abs(leaderStreams - runnerUpStreams);
  const leaderName = firstName(leader.name) || 'líder';

  if (diff === 0) {
    return 'empate técnico no momento';
  }

  if (diff <= 5) {
      return `disputa colada: só ${coreUtils.formatNumber(diff)} plays separam os dois`;
  }

  if (diff <= 25) {
    return `briga aberta: ${coreUtils.formatNumber(diff)} plays de diferença`;
  }

  return `${leaderName} abriu vantagem de ${coreUtils.formatNumber(diff)} plays`;
};

const getMostActiveInsight = (member: any, totalMembers: number): string => {
  if (!member) return 'ativo hoje';

  const streams = member.streamsToday || 0;

  if (streams === 0) return 'ativo hoje';

  if (streams === 1) {
    return 'deu o play inicial do dia';
  }

  if (streams < 10) {
    return `lidera o dia com ${coreUtils.formatNumber(streams)} plays`;
  }

  return `puxou o ritmo do círculo com ${coreUtils.formatNumber(streams)} plays`;
};

const getMonthLeaderInsight = (member: any): string => {
  if (!member) return 'lidera o mês';

  const streams = member.streamsMonth || 0;

  if (streams === 0) return 'lidera o mês';

  return `lidera o mês com ${coreUtils.formatNumber(streams)} plays`;
};

export const HomeInsights: React.FC<HomeInsightsProps> = React.memo(({ onFriendClick }) => {
  const shouldReduceMotion = useReducedMotion();
  const [insightsRef, isInsightsVisible] = useInsightsVisibility();
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
        title: 'Mais Ativo Hoje',
        headline: firstName(mostActive.name),
        detail: getMostActiveInsight(mostActive, activeMembers.length),
        users: [mostActive],
        image: coreUtils.getUserAvatar(mostActive.id, mostActive.avatar),
        action: () => onFriendClick(mostActive),
        type: 'active'
      },
      match && buildMatchReason(match) && {
        key: 'match',
        tone: 'red',
        icon: <Heart className="h-3.5 w-3.5 fill-red-300 text-red-300" />,
        title: 'Match do Dia',
        headline: `${firstName(match.u1.name)} + ${firstName(match.u2.name)}`,
        detail: buildMatchReason(match),
        users: [match.u1, match.u2],
        type: 'match'
      },
      topMonth && {
        key: 'month',
        tone: 'yellow',
        icon: <Trophy className="h-3.5 w-3.5 text-yellow-200" />,
        title: 'Líder do Mês',
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
        title: 'Álbum Dominante',
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
        title: runnerUp ? 'Disputa do Dia' : 'Última Sintonia',
        headline: runnerUp ? `${firstName(mostActive?.name)} vs ${firstName(runnerUp.name)}` : firstName(lateUser?.name),
        detail: runnerUp ? getRivalryInsight(mostActive, runnerUp) : lateUser?.nowPlaying?.track?.name || 'última atividade registrada',
        users: runnerUp && mostActive ? [mostActive, runnerUp] : lateUser ? [lateUser] : [],
        action: runnerUp && mostActive ? () => onFriendClick(mostActive) : lateUser ? () => onFriendClick(lateUser) : undefined,
        type: runnerUp ? 'rivalry' : 'late'
      }
    ].filter(Boolean) as HomeInsight[];
  }, [activeMembers, match, mostActive, onFriendClick]);

  const goToInsight = React.useCallback((index: number) => {
    if (insights.length === 0) return;
    const nextIndex = (index + insights.length) % insights.length;
    cachedInsightIndex = nextIndex;
    setActiveInsightIndex(nextIndex);
  }, [insights.length]);

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

  const activeInsight = insights[activeInsightIndex % insights.length];
  const satelliteInsights = insights
    .map((insight, index) => ({ insight, index }))
    .filter(({ index }) => index !== activeInsightIndex % insights.length)
    .slice(0, 4);
  const shouldAnimateOrbit = !shouldReduceMotion && isInsightsVisible;

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
    const imageSize = isMain ? 'h-[58px] w-[58px]' : 'h-12 w-12';
    const userImageSize = isMain ? 'h-[58px] w-[58px]' : 'h-9 w-9';
    const iconSize = isMain ? 'h-[58px] w-[58px]' : 'h-12 w-12';
    const users = insight.users.slice(0, 2);

    if (insight.image) {
      return (
        <div className={`${imageSize} shrink-0 overflow-hidden ${insight.type === 'album' ? 'rounded-[18px]' : 'rounded-full'} bg-white/[0.06] ring-2 ${tone.ring} shadow-[0_14px_34px_rgba(0,0,0,0.42)]`}>
          <SmartImage src={insight.image} rounded={insight.type === 'album' ? '2xl' : 'full'} className="h-full w-full object-cover" fallback="" />
        </div>
      );
    }

    if (users.length > 0) {
      return (
        <div className={`flex ${isMain ? '-space-x-4' : '-space-x-2'} shrink-0`}>
          {users.map((user) => (
            <div key={user.id} className={`${userImageSize} overflow-hidden rounded-full bg-black ring-2 ${tone.ring} shadow-[0_14px_34px_rgba(0,0,0,0.42)]`}>
              <SmartImage src={coreUtils.getUserAvatar(user.id, user.avatar)} rounded="full" className="h-full w-full object-cover" fallback="" />
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
        className="relative h-[286px] select-none overflow-hidden rounded-[30px] px-1 py-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null; }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_50%_48%,rgba(249,115,22,0.13),rgba(0,0,0,0)_42%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[268px] w-[268px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[206px] w-[206px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-orange-400/[0.18]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[132px] w-[132px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-300/[0.13]" />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[206px] w-[206px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          animate={shouldAnimateOrbit ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
        >
          <span className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-orange-400/65 shadow-[0_0_18px_rgba(249,115,22,0.55)]" />
          <span className="absolute left-5 top-6 h-1.5 w-1.5 rounded-full bg-white/24" />
        </motion.div>

        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <motion.button
            type="button"
            key={activeInsight.key}
            onClick={() => activeInsight.action?.()}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className={`relative flex h-[158px] w-[238px] max-w-[calc(100%-104px)] flex-col overflow-hidden rounded-[28px] border bg-black/48 p-4 text-left shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-2xl ${getToneClasses(activeInsight.tone).border}`}
            style={{ boxShadow: `0 22px 70px rgba(0,0,0,0.46), 0 0 46px ${getToneClasses(activeInsight.tone).glow}` }}
          >
            <div className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/28 to-transparent`} />
            <div className="flex min-w-0 items-start gap-3">
              {renderInsightMedia(activeInsight, 'main')}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${getToneClasses(activeInsight.tone).bg} ${getToneClasses(activeInsight.tone).text}`}>
                    {activeInsight.icon}
                  </span>
                  <span className={`min-w-0 truncate text-[7px] font-black uppercase tracking-[0.18em] ${getToneClasses(activeInsight.tone).text}`}>
                    {activeInsight.title}
                  </span>
                </div>
                <h3 className="line-clamp-2 text-[22px] font-black leading-[0.96] text-white">
                  {activeInsight.headline}
                </h3>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-[11px] font-semibold leading-snug text-white/58">
              {activeInsight.detail}
            </p>
          </motion.button>
        </div>

        <div className="absolute inset-0 z-20">
          {satelliteInsights.map(({ insight, index }, offset) => {
            const tone = getToneClasses(insight.tone);
            const positionClass = [
              'left-7 top-5',
              'right-7 top-8',
              'left-8 bottom-6',
              'right-8 bottom-7',
            ][offset] || 'right-7 bottom-7';
            return (
              <motion.button
                type="button"
                key={`${insight.key}-${index}`}
                onClick={() => goToInsight(index)}
                initial={false}
                animate={shouldAnimateOrbit ? {
                  y: offset % 2 === 0 ? [0, -5, 0] : [0, 5, 0],
                  x: offset < 2 ? [0, 3, 0] : [0, -3, 0],
                  scale: [1, 1.035, 1],
                } : { y: 0, x: 0, scale: 1 }}
                transition={shouldAnimateOrbit ? { duration: 8 + offset, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.18 }}
                className={`absolute flex h-[64px] w-[64px] items-center justify-center rounded-full border bg-black/58 shadow-[0_16px_42px_rgba(0,0,0,0.42)] backdrop-blur-xl ${positionClass} ${tone.border}`}
                aria-label={`Abrir insight ${insight.title}`}
              >
                {renderInsightMedia(insight, 'satellite')}
                <span className={`pointer-events-none absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${tone.bg}`} />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
