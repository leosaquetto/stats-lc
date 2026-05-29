import React from 'react';
import { motion } from 'motion/react';
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
    return `álbum mais repetido por ${userName}: ${count} plays`;
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
    return `disputa colada: só ${diff} plays separam os dois`;
  }

  if (diff <= 25) {
    return `briga aberta: ${diff} plays de diferença`;
  }

  return `${leaderName} abriu vantagem de ${diff} plays`;
};

const getMostActiveInsight = (member: any, totalMembers: number): string => {
  if (!member) return 'ativo hoje';

  const streams = member.streamsToday || 0;

  if (streams === 0) return 'ativo hoje';

  if (streams === 1) {
    return 'deu o play inicial do dia';
  }

  if (streams < 10) {
    return `lidera o dia com ${streams} plays`;
  }

  return `puxou o ritmo do círculo com ${streams} plays`;
};

const getMonthLeaderInsight = (member: any): string => {
  if (!member) return 'lidera o mês';

  const streams = member.streamsMonth || 0;

  if (streams === 0) return 'lidera o mês';

  return `lidera o mês com ${streams} plays`;
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

  const renderOrbitalInsight = (insight: any) => {
    const isRivalry = insight.type === 'rivalry';
    const isMatch = insight.type === 'match';
    const isAlbum = insight.type === 'album';
    const isLive = insight.type === 'live';
    const isActive = insight.type === 'active';

    return (
      <motion.div
        key={insight.key}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={insight.onClick}
        className={`relative flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/5 ${insight.onClick ? 'cursor-pointer hover:border-orange-500/30' : ''} overflow-hidden`}
        style={{ minHeight: '140px' }}
      >
        {/* Orbital visual */}
        <div className="relative shrink-0" style={{ width: '90px', height: '90px' }}>
          {/* Anel principal */}
          <div className="absolute inset-0 rounded-full border border-white/10" />

          {/* Anel pontilhado */}
          <div
            className="absolute inset-0 rounded-full border-2 border-dashed border-orange-500/20"
            style={{ transform: 'scale(1.1)' }}
          />

          {/* Arco laranja parcial */}
          {(isActive || isAlbum) && (
            <div
              className="absolute inset-0 rounded-full border-t-2 border-orange-500/40"
              style={{ transform: 'rotate(45deg)' }}
            />
          )}

          {/* Núcleo central */}
          {isRivalry ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-orange-500 font-black text-lg">VS</div>
              {insight.users[0] && (
                <div
                  className="absolute h-8 w-8 rounded-full overflow-hidden border-2 border-orange-500/50 shadow-lg shadow-orange-500/20"
                  style={{ top: '8px', left: '8px' }}
                >
                  <SmartImage
                    src={coreUtils.getUserAvatar(insight.users[0].id, insight.users[0].avatar)}
                    rounded="full"
                    className="h-full w-full object-cover"
                    fallback=""
                  />
                </div>
              )}
              {insight.users[1] && (
                <div
                  className="absolute h-8 w-8 rounded-full overflow-hidden border-2 border-orange-500/50 shadow-lg shadow-orange-500/20"
                  style={{ bottom: '8px', right: '8px' }}
                >
                  <SmartImage
                    src={coreUtils.getUserAvatar(insight.users[1].id, insight.users[1].avatar)}
                    rounded="full"
                    className="h-full w-full object-cover"
                    fallback=""
                  />
                </div>
              )}
            </div>
          ) : isMatch ? (
            <div className="absolute inset-0 flex items-center justify-center">
              {insight.users[0] && (
                <div
                  className="absolute h-10 w-10 rounded-full overflow-hidden border-2 border-red-500/50 shadow-lg shadow-red-500/20"
                  style={{ top: '12px', left: '12px' }}
                >
                  <SmartImage
                    src={coreUtils.getUserAvatar(insight.users[0].id, insight.users[0].avatar)}
                    rounded="full"
                    className="h-full w-full object-cover"
                    fallback=""
                  />
                </div>
              )}
              {insight.users[1] && (
                <div
                  className="absolute h-10 w-10 rounded-full overflow-hidden border-2 border-red-500/50 shadow-lg shadow-red-500/20"
                  style={{ bottom: '12px', right: '12px' }}
                >
                  <SmartImage
                    src={coreUtils.getUserAvatar(insight.users[1].id, insight.users[1].avatar)}
                    rounded="full"
                    className="h-full w-full object-cover"
                    fallback=""
                  />
                </div>
              )}
              <Heart className="h-5 w-5 fill-red-400 text-red-400" />
            </div>
          ) : isAlbum && insight.albumArt ? (
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <div className="h-full w-full rounded-lg overflow-hidden border border-white/10 shadow-lg shadow-orange-500/10">
                <SmartImage
                  src={insight.albumArt}
                  rounded="lg"
                  className="h-full w-full object-cover"
                  fallback=""
                />
              </div>
              {insight.users[0] && (
                <div
                  className="absolute h-7 w-7 rounded-full overflow-hidden border-2 border-blue-500/50 shadow-lg"
                  style={{ bottom: '-4px', right: '-4px' }}
                >
                  <SmartImage
                    src={coreUtils.getUserAvatar(insight.users[0].id, insight.users[0].avatar)}
                    rounded="full"
                    className="h-full w-full object-cover"
                    fallback=""
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              {insight.users[0] && (
                <div className="h-full w-full rounded-full overflow-hidden border-2 border-orange-500/50 shadow-lg shadow-orange-500/20">
                  <SmartImage
                    src={coreUtils.getUserAvatar(insight.users[0].id, insight.users[0].avatar)}
                    rounded="full"
                    className="h-full w-full object-cover"
                    fallback=""
                  />
                </div>
              )}
            </div>
          )}

          {/* Pontos de luz orbitais */}
          <motion.div
            className="absolute h-1.5 w-1.5 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50"
            style={{ top: '4px', left: '50%', marginLeft: '-3px' }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {isLive && (
            <motion.div
              className="absolute h-1.5 w-1.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50"
              style={{ top: '50%', right: '4px', marginTop: '-3px' }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* Badge com contagem */}
          {(isActive || isAlbum) && insight.users[0] && (
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-orange-500 border-2 border-black flex items-center justify-center shadow-lg">
              <Flame className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        {/* Texto do insight */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5">
            {insight.icon}
            <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">
              {insight.title}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white leading-tight truncate">
            {insight.primary}
          </h3>
          <p className="text-[11px] font-medium text-white/50 leading-snug line-clamp-2">
            {insight.secondary}
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col gap-3 mb-3 mt-1">
      <SectionHeader
        title="Insights do Dia"
        icon={<Sparkles className="h-3 w-3 text-orange-500" />}
      />

      <div className="flex flex-col gap-3">
        {visibleInsights.map(renderOrbitalInsight)}
      </div>
    </div>
  );
});
