import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { Zap, Heart, Sparkles, Trophy, Clock, Disc3, Radio, ChevronLeft, ChevronRight } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';
import { getVisibleMembers } from '../../lib/memberSelectors';

interface HomeInsightsProps {
  onFriendClick: (friend: any) => void;
}

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

const getLiveInsight = (member: any): string => {
  if (!member) return 'ativo neste momento';

  const track = member.nowPlaying?.track?.name;
  const artist = member.nowPlaying?.track?.artist?.name;

  if (track && artist) {
    return `ouvindo ${track} por ${artist}`;
  }

  if (track) {
    return `ouvindo agora: ${track}`;
  }

  return 'ativo neste momento';
};

export const HomeInsights: React.FC<HomeInsightsProps> = React.memo(({ onFriendClick }) => {
  const shouldReduceMotion = useReducedMotion();
  const [insightsRef, isInsightsVisible] = useInsightsVisibility();
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const [activeInsightIndex, setActiveInsightIndex] = React.useState(0);
  const [isAutoPaused, setIsAutoPaused] = React.useState(false);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const activeMembers = React.useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);

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
    const liveUser = activeMembers.find(m => m.nowPlaying?.isNow);
    const albumUser = [...activeMembers].sort((a, b) => ((b.topItems?.albums?.[0]?.playcount || b.topItems?.albums?.[0]?.streams || 0) - (a.topItems?.albums?.[0]?.playcount || a.topItems?.albums?.[0]?.streams || 0)))[0];
    const lateUser = [...activeMembers].sort((a, b) => new Date(b.nowPlaying?.timestamp || 0).getTime() - new Date(a.nowPlaying?.timestamp || 0).getTime())[0];
    const runnerUp = sortedToday[1];

    return [
      mostActive && {
        key: 'active',
        tone: 'orange',
        icon: <Zap className="h-2.5 w-2.5 text-orange-400" />,
        title: 'Mais Ativo Hoje',
        primary: firstName(mostActive.name),
        secondary: getMostActiveInsight(mostActive, activeMembers.length),
        users: [mostActive],
        onClick: () => onFriendClick(mostActive),
        type: 'active'
      },
      match && buildMatchReason(match) && {
        key: 'match',
        tone: 'red',
        icon: <Heart className="h-2.5 w-2.5 fill-red-400 text-red-400" />,
        title: 'Match do Dia',
        primary: `${firstName(match.u1.name)} + ${firstName(match.u2.name)}`,
        secondary: buildMatchReason(match),
        users: [match.u1, match.u2],
        type: 'match'
      },
      topMonth && {
        key: 'month',
        tone: 'white',
        icon: <Trophy className="h-2.5 w-2.5 text-yellow-300" />,
        title: 'Líder do Mês',
        primary: firstName(topMonth.name),
        secondary: getMonthLeaderInsight(topMonth),
        users: [topMonth],
        onClick: () => onFriendClick(topMonth),
        type: 'month'
      },
      liveUser && {
        key: 'live',
        tone: 'green',
        icon: <Radio className="h-2.5 w-2.5 text-green-300" />,
        title: 'No Ar Agora',
        primary: firstName(liveUser.name),
        secondary: getLiveInsight(liveUser),
        users: [liveUser],
        onClick: () => onFriendClick(liveUser),
        type: 'live'
      },
      albumUser && albumUser.topItems?.albums?.[0] && {
        key: 'album',
        tone: 'blue',
        icon: <Disc3 className="h-2.5 w-2.5 text-blue-300" />,
        title: 'Álbum Dominante',
        primary: albumUser.topItems.albums[0].name || firstName(albumUser.name),
        secondary: getDominantAlbumInsight(albumUser),
        users: [albumUser],
        onClick: () => onFriendClick(albumUser),
        type: 'album',
        albumArt: albumUser.topItems.albums[0].image
      },
      (runnerUp || lateUser) && {
        key: 'pulse',
        tone: 'purple',
        icon: <Clock className="h-2.5 w-2.5 text-violet-300" />,
        title: runnerUp ? 'Disputa do Dia' : 'Última Sintonia',
        primary: runnerUp ? `${firstName(mostActive?.name)} vs ${firstName(runnerUp.name)}` : firstName(lateUser?.name),
        secondary: runnerUp ? getRivalryInsight(mostActive, runnerUp) : lateUser?.nowPlaying?.track?.name || 'última atividade registrada',
        users: runnerUp && mostActive ? [mostActive, runnerUp] : lateUser ? [lateUser] : [],
        type: runnerUp ? 'rivalry' : 'late'
      }
    ].filter(Boolean) as any[];
  }, [activeMembers, match, mostActive, onFriendClick]);

  const goToInsight = React.useCallback((index: number) => {
    if (insights.length === 0) return;
    setActiveInsightIndex((index + insights.length) % insights.length);
  }, [insights.length]);

  const handlePrev = React.useCallback(() => {
    setIsAutoPaused(true);
    goToInsight(activeInsightIndex - 1);
  }, [activeInsightIndex, goToInsight]);

  const handleNext = React.useCallback(() => {
    setIsAutoPaused(true);
    goToInsight(activeInsightIndex + 1);
  }, [activeInsightIndex, goToInsight]);

  React.useEffect(() => {
    if (activeInsightIndex >= insights.length) {
      setActiveInsightIndex(0);
    }
  }, [activeInsightIndex, insights.length]);

  React.useEffect(() => {
    if (!isInsightsVisible || insights.length <= 1 || isAutoPaused) return;
    const timer = window.setInterval(() => {
      setActiveInsightIndex((current) => (current + 1) % insights.length);
    }, 14000);
    return () => window.clearInterval(timer);
  }, [isInsightsVisible, insights.length, isAutoPaused]);

  const handleTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    setIsAutoPaused(true);
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

  const renderInsightCard = (insight: any) => {
    const isRivalry = insight.type === 'rivalry';
    const isMatch = insight.type === 'match';
    const isAlbum = insight.type === 'album';
    const isLive = insight.type === 'live';

    return (
      <div className="relative flex h-full min-h-[150px] flex-col overflow-visible px-2 py-2 text-left">
        <div className="pointer-events-none absolute inset-[-10px] rounded-[30px] bg-black/18 blur-2xl" />
        {isAlbum && insight.albumArt ? (
          <SmartImage src={insight.albumArt} rounded="3xl" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08]" fallback="" />
        ) : null}

        <div className="relative z-10 mb-3 flex items-start justify-between gap-2">
          <div className="flex -space-x-2 overflow-visible py-1 pl-0.5">
            {isRivalry ? (
              insight.users.slice(0, 2).map((user: any) => (
                <div key={user.id} className="h-9 w-9 overflow-hidden rounded-full border-2 border-orange-500/55 bg-black shadow-[0_12px_28px_rgba(0,0,0,0.38)]">
                  <SmartImage src={coreUtils.getUserAvatar(user.id, user.avatar)} rounded="full" className="h-full w-full object-cover" fallback="" />
                </div>
              ))
            ) : isMatch ? (
              insight.users.slice(0, 2).map((user: any) => (
                <div key={user.id} className="h-9 w-9 overflow-hidden rounded-full border-2 border-red-500/55 bg-black shadow-[0_12px_28px_rgba(0,0,0,0.38)]">
                  <SmartImage src={coreUtils.getUserAvatar(user.id, user.avatar)} rounded="full" className="h-full w-full object-cover" fallback="" />
                </div>
              ))
            ) : isAlbum && insight.albumArt ? (
              <div className="h-10 w-10 overflow-hidden rounded-[14px] border border-orange-500/35 bg-black shadow-[0_12px_28px_rgba(0,0,0,0.38)]">
                <SmartImage src={insight.albumArt} rounded="xl" className="h-full w-full object-cover" fallback="" />
              </div>
            ) : insight.users[0] ? (
              <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-orange-500/55 bg-black shadow-[0_12px_28px_rgba(0,0,0,0.38)]">
                <SmartImage src={coreUtils.getUserAvatar(insight.users[0].id, insight.users[0].avatar)} rounded="full" className="h-full w-full object-cover" fallback="" />
                {isLive && <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_14px_rgba(34,197,94,0.75)]" />}
              </div>
            ) : null}
          </div>

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white shadow-[0_14px_30px_rgba(0,0,0,0.34)]">
            {insight.icon}
          </div>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <span className="mb-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-orange-400">
            {insight.title}
          </span>
          <h3 className="line-clamp-2 text-[18px] font-black leading-[1.02] text-white">
            {insight.primary}
          </h3>
          <p className="mt-2 line-clamp-3 text-[10.5px] font-medium leading-snug text-white/58">
            {insight.secondary}
          </p>
        </div>
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
        <div className="flex items-center gap-1">
          <button type="button" onClick={handlePrev} className="rounded-full p-1.5 transition-colors hover:bg-white/10">
            <ChevronLeft className="h-4 w-4 text-white/35" />
          </button>
          <button type="button" onClick={handleNext} className="rounded-full p-1.5 transition-colors hover:bg-white/10">
            <ChevronRight className="h-4 w-4 text-white/35" />
          </button>
        </div>
      </div>

      <div
        ref={insightsRef}
        data-home-horizontal-scroll="true"
        className="relative h-[268px] select-none overflow-hidden rounded-[34px] border border-white/[0.04] bg-white/[0.012] px-3 py-4 shadow-[0_22px_58px_rgba(0,0,0,0.32)]"
        onMouseEnter={() => setIsAutoPaused(true)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null; }}
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[286px] w-[286px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[224px] w-[224px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-orange-500/[0.18]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[118px] w-[118px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-500/[0.2] bg-black/12 shadow-[0_0_38px_rgba(249,115,22,0.08)]" />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-500/25 bg-black/40"
          animate={shouldReduceMotion || !isInsightsVisible ? {} : { rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: 'center' }}
        >
          <span className="absolute -right-[88px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-orange-500/55 shadow-[0_0_18px_rgba(249,115,22,0.45)]" />
        </motion.div>

        <div className="relative z-10 h-full">
          {[0, 1].map((offset) => {
            const index = (activeInsightIndex + offset) % insights.length;
            const insight = insights[index];
            if (!insight) return null;
            const isPrimary = offset === 0;
            return (
              <motion.button
                type="button"
                key={`${insight.key}-${index}`}
                onClick={() => {
                  setIsAutoPaused(true);
                  insight.onClick?.();
                }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{
                  opacity: 1,
                  y: isPrimary ? [0, -8, 0] : [0, 7, 0],
                  x: isPrimary ? [0, 5, 0] : [0, -5, 0],
                  rotate: isPrimary ? [0, -1.5, 0] : [0, 1.5, 0],
                }}
                transition={{ duration: 9 + offset * 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className={`absolute w-[160px] text-left ${isPrimary ? "left-1 top-6" : "right-1 bottom-4"}`}
              >
                {renderInsightCard(insight)}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
