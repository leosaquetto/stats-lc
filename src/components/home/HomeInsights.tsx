import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { Zap, Heart, Flame, Sparkles, Trophy, Clock, Disc3, Radio } from 'lucide-react';
import { SmartImage, SectionHeader } from '../shared/CommonUI';
import { getVisibleMembers } from '../../lib/memberSelectors';

interface HomeInsightsProps {
  onFriendClick: (friend: any) => void;
}

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

const buildMatchReason = (match: any): string => {
  if (!match) return 'sem match claro ainda — comparação em aberto';

  const u1 = match.u1;
  const u2 = match.u2;

  if (!u1 || !u2) return 'sem match claro ainda — comparação em aberto';

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

  return 'sem match claro ainda — comparação em aberto';
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
  const leaderName = leader.name || 'líder';

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
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const [insightOffset, setInsightOffset] = React.useState(0);

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

    if (candidates.length === 0) {
      return {
        u1: activeMembers[daySeed % activeMembers.length],
        u2: activeMembers[(daySeed + 1) % activeMembers.length] || activeMembers[0],
        score: 0
      };
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[daySeed % Math.min(candidates.length, 4)];
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
        primary: mostActive.name,
        secondary: getMostActiveInsight(mostActive, activeMembers.length),
        users: [mostActive],
        onClick: () => onFriendClick(mostActive),
        type: 'active'
      },
      match && {
        key: 'match',
        tone: 'red',
        icon: <Heart className="h-2.5 w-2.5 fill-red-400 text-red-400" />,
        title: 'Match do Dia',
        primary: `${match.u1.name} + ${match.u2.name}`,
        secondary: buildMatchReason(match),
        users: [match.u1, match.u2],
        type: 'match'
      },
      topMonth && {
        key: 'month',
        tone: 'white',
        icon: <Trophy className="h-2.5 w-2.5 text-yellow-300" />,
        title: 'Líder do Mês',
        primary: topMonth.name,
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
        primary: liveUser.name,
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
        primary: albumUser.topItems.albums[0].name || albumUser.name,
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
        primary: runnerUp ? `${mostActive?.name} vs ${runnerUp.name}` : lateUser?.name,
        secondary: runnerUp ? getRivalryInsight(mostActive, runnerUp) : lateUser?.nowPlaying?.track?.name || 'última atividade registrada',
        users: runnerUp && mostActive ? [mostActive, runnerUp] : lateUser ? [lateUser] : [],
        type: runnerUp ? 'rivalry' : 'late'
      }
    ].filter(Boolean) as any[];
  }, [activeMembers, match, mostActive, onFriendClick]);

  React.useEffect(() => {
    if (insights.length <= 2) return;
    const timer = window.setInterval(() => {
      setInsightOffset((current) => (current + 2) % insights.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [insights.length]);

  const visibleInsights = React.useMemo(() => {
    if (insights.length <= 2) return insights;
    return [insights[insightOffset % insights.length], insights[(insightOffset + 1) % insights.length]];
  }, [insightOffset, insights]);

  if (activeMembers.length < 2) return null;

  const renderOrbitalInsight = (insight: any, index: number) => {
    const isRivalry = insight.type === 'rivalry';
    const isMatch = insight.type === 'match';
    const isAlbum = insight.type === 'album';
    const isLive = insight.type === 'live';
    const isActive = insight.type === 'active';

    // Alternate layout: first insight orbit left, second orbit right
    const orbitOnLeft = index === 0;

    return (
      <motion.div
        key={insight.key}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={insight.onClick}
        className={`relative overflow-visible ${insight.onClick ? 'cursor-pointer' : ''}`}
        style={{ minHeight: '320px' }}
      >
        <div className={`flex ${orbitOnLeft ? 'flex-row' : 'flex-row-reverse'} items-center gap-6 p-6 rounded-[32px] bg-black/20 border border-white/5 ${insight.onClick ? 'hover:border-orange-500/20' : ''} overflow-visible backdrop-blur-sm`}>
          {/* Orbital Stage */}
          <div className="relative shrink-0" style={{ width: '240px', height: '240px' }}>
            {/* Orbital Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Outer ring */}
              <div className="absolute w-full h-full rounded-full border border-white/8" />

              {/* Dotted ring */}
              <div className="absolute w-[85%] h-[85%] rounded-full border-2 border-dashed border-orange-500/15" />

              {/* Orange arc */}
              {(isActive || isAlbum || isLive) && (
                <svg className="absolute w-[70%] h-[70%] -rotate-45">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="40%"
                    fill="none"
                    stroke="rgba(249, 115, 22, 0.4)"
                    strokeWidth="2"
                    strokeDasharray="80 200"
                  />
                </svg>
              )}

              {/* Light points */}
              <motion.div
                animate={shouldReduceMotion ? {} : { opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 3, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
                className="absolute w-full h-full"
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-orange-500/60 blur-[2px]" />
              </motion.div>
              <motion.div
                animate={shouldReduceMotion ? {} : { opacity: [0.4, 0.9, 0.4], scale: [0.9, 1.3, 0.9] }}
                transition={{ duration: 3.5, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute w-[85%] h-[85%]"
              >
                <div className="absolute bottom-0 right-1/4 w-1.5 h-1.5 rounded-full bg-orange-500/50 blur-[1px]" />
              </motion.div>
            </div>

            {/* Core/Nucleus */}
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -4, 0] }}
              transition={{ duration: 5, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {isRivalry ? (
                <div className="relative flex items-center justify-center w-full h-full">
                  <div className="text-orange-500 font-black text-3xl z-10 drop-shadow-[0_0_20px_rgba(249,115,22,0.6)]">VS</div>
                  {insight.users[0] && (
                    <motion.div
                      animate={shouldReduceMotion ? {} : { y: [0, -2, 0] }}
                      transition={{ duration: 4, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 0.5 }}
                      className="absolute h-16 w-16 rounded-full overflow-hidden border-3 border-orange-500/60 shadow-2xl shadow-orange-500/30"
                      style={{ top: '20%', left: '15%' }}
                    >
                      <SmartImage
                        src={coreUtils.getUserAvatar(insight.users[0].id, insight.users[0].avatar)}
                        rounded="full"
                        className="h-full w-full object-cover"
                        fallback=""
                      />
                    </motion.div>
                  )}
                  {insight.users[1] && (
                    <motion.div
                      animate={shouldReduceMotion ? {} : { y: [0, -3, 0] }}
                      transition={{ duration: 4.5, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 1 }}
                      className="absolute h-16 w-16 rounded-full overflow-hidden border-3 border-orange-500/60 shadow-2xl shadow-orange-500/30"
                      style={{ bottom: '20%', right: '15%' }}
                    >
                      <SmartImage
                        src={coreUtils.getUserAvatar(insight.users[1].id, insight.users[1].avatar)}
                        rounded="full"
                        className="h-full w-full object-cover"
                        fallback=""
                      />
                    </motion.div>
                  )}
                </div>
              ) : isMatch ? (
                <div className="relative flex items-center justify-center w-full h-full">
                  <Heart className="h-10 w-10 fill-red-400 text-red-400 z-10 drop-shadow-[0_0_20px_rgba(248,113,113,0.6)]" />
                  {insight.users[0] && (
                    <motion.div
                      animate={shouldReduceMotion ? {} : { y: [0, -2, 0] }}
                      transition={{ duration: 4, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 0.3 }}
                      className="absolute h-16 w-16 rounded-full overflow-hidden border-3 border-red-500/60 shadow-2xl shadow-red-500/30"
                      style={{ top: '18%', left: '18%' }}
                    >
                      <SmartImage
                        src={coreUtils.getUserAvatar(insight.users[0].id, insight.users[0].avatar)}
                        rounded="full"
                        className="h-full w-full object-cover"
                        fallback=""
                      />
                    </motion.div>
                  )}
                  {insight.users[1] && (
                    <motion.div
                      animate={shouldReduceMotion ? {} : { y: [0, -3, 0] }}
                      transition={{ duration: 4.5, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut', delay: 0.8 }}
                      className="absolute h-16 w-16 rounded-full overflow-hidden border-3 border-red-500/60 shadow-2xl shadow-red-500/30"
                      style={{ bottom: '18%', right: '18%' }}
                    >
                      <SmartImage
                        src={coreUtils.getUserAvatar(insight.users[1].id, insight.users[1].avatar)}
                        rounded="full"
                        className="h-full w-full object-cover"
                        fallback=""
                      />
                    </motion.div>
                  )}
                </div>
              ) : isAlbum && insight.albumArt ? (
                <div className="relative flex items-center justify-center w-full h-full p-12">
                  <div className="h-full w-full rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl shadow-orange-500/20">
                    <SmartImage
                      src={insight.albumArt}
                      rounded="lg"
                      className="h-full w-full object-cover"
                      fallback=""
                    />
                  </div>
                  {insight.users[0] && (
                    <motion.div
                      animate={shouldReduceMotion ? {} : { y: [0, -2, 0] }}
                      transition={{ duration: 4, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
                      className="absolute h-12 w-12 rounded-full overflow-hidden border-3 border-blue-500/60 shadow-2xl"
                      style={{ bottom: '8%', right: '8%' }}
                    >
                      <SmartImage
                        src={coreUtils.getUserAvatar(insight.users[0].id, insight.users[0].avatar)}
                        rounded="full"
                        className="h-full w-full object-cover"
                        fallback=""
                      />
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="relative flex items-center justify-center w-full h-full p-10">
                  {insight.users[0] && (
                    <div className="h-full w-full rounded-full overflow-hidden border-3 border-orange-500/60 shadow-2xl shadow-orange-500/30">
                      <SmartImage
                        src={coreUtils.getUserAvatar(insight.users[0].id, insight.users[0].avatar)}
                        rounded="full"
                        className="h-full w-full object-cover"
                        fallback=""
                      />
                    </div>
                  )}
                  {isLive && (
                    <motion.div
                      animate={shouldReduceMotion ? {} : { scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
                      className="absolute bottom-2 right-2 h-4 w-4 rounded-full bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)]"
                    />
                  )}
                </div>
              )}
            </motion.div>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-3">
            <div className="flex items-center gap-2">
              {insight.icon}
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">
                {insight.title}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white leading-tight line-clamp-2">
              {insight.primary}
            </h3>
            <p className="text-sm font-medium text-white/60 leading-relaxed line-clamp-3">
              {insight.secondary}
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col gap-4 mb-3 mt-1">
      <SectionHeader
        title="Insights do Dia"
        icon={<Sparkles className="h-3 w-3 text-orange-500" />}
      />

      <div className="flex flex-col gap-6">
        {visibleInsights.map((insight, index) => (
          <React.Fragment key={insight.key}>
            {renderOrbitalInsight(insight, index)}
            {index === 0 && visibleInsights.length > 1 && (
              <div className="relative h-px w-full flex items-center justify-center my-2">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
                <div className="relative w-2 h-2 rounded-full bg-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.6)]" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
});
