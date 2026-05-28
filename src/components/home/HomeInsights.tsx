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
        let sampleMatch = "";
        u2Artists.forEach((name: string) => {
          if (name && u1Artists.has(name)) {
            commonScore += 10;
            if (!sampleMatch) {
              const aItem = u1.topItems?.artists.find((a: any) => (a.name || "").toLowerCase() === name);
              sampleMatch = aItem?.name || "";
            }
          }
        });

        const u1Tracks = new Set((u1.topItems?.tracks || []).map((t: any) => (t.name || "").toLowerCase()));
        const u2Tracks = (u2.topItems?.tracks || []).map((t: any) => (t.name || "").toLowerCase());
        u2Tracks.forEach((name: string) => {
          if (name && u1Tracks.has(name)) {
            commonScore += 15;
            if (!sampleMatch) {
              const tItem = u1.topItems.tracks.find((t: any) => (t.name || "").toLowerCase() === name);
              sampleMatch = tItem?.name || "";
            }
          }
        });

        const activityTieBreaker = ((u1.streamsToday || 0) + (u2.streamsToday || 0)) / 100;
        if (commonScore > 0) {
          candidates.push({
            u1,
            u2,
            score: commonScore + activityTieBreaker,
            reason: sampleMatch ? `Curtem ${sampleMatch}` : "Alinhamento sonoro!"
          });
        }
      }
    }

    if (candidates.length === 0) {
      return {
        u1: activeMembers[daySeed % activeMembers.length],
        u2: activeMembers[(daySeed + 1) % activeMembers.length] || activeMembers[0],
        score: 0,
        reason: "Conexão de Ritmo"
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
        secondary: `${mostActive.streamsToday || 0} reproduções hoje`,
        users: [mostActive],
        onClick: () => onFriendClick(mostActive)
      },
      match && {
        key: 'match',
        tone: 'red',
        icon: <Heart className="h-2.5 w-2.5 fill-red-400 text-red-400" />,
        title: 'Match do Dia',
        primary: `${match.u1.name} + ${match.u2.name}`,
        secondary: match.reason,
        users: [match.u1, match.u2]
      },
      topMonth && {
        key: 'month',
        tone: 'white',
        icon: <Trophy className="h-2.5 w-2.5 text-yellow-300" />,
        title: 'Líder do Mês',
        primary: topMonth.name,
        secondary: `${topMonth.streamsMonth || 0} reproduções no mês`,
        users: [topMonth],
        onClick: () => onFriendClick(topMonth)
      },
      liveUser && {
        key: 'live',
        tone: 'green',
        icon: <Radio className="h-2.5 w-2.5 text-green-300" />,
        title: 'No Ar Agora',
        primary: liveUser.name,
        secondary: liveUser.nowPlaying?.track?.name || 'tocando neste momento',
        users: [liveUser],
        onClick: () => onFriendClick(liveUser)
      },
      albumUser && {
        key: 'album',
        tone: 'blue',
        icon: <Disc3 className="h-2.5 w-2.5 text-blue-300" />,
        title: 'Álbum Dominante',
        primary: albumUser.topItems?.albums?.[0]?.name || albumUser.name,
        secondary: albumUser.name,
        users: [albumUser],
        onClick: () => onFriendClick(albumUser)
      },
      (runnerUp || lateUser) && {
        key: 'pulse',
        tone: 'purple',
        icon: <Clock className="h-2.5 w-2.5 text-violet-300" />,
        title: runnerUp ? 'Disputa do Dia' : 'Última Sintonia',
        primary: runnerUp ? `${mostActive?.name} vs ${runnerUp.name}` : lateUser?.name,
        secondary: runnerUp ? `${Math.abs((mostActive?.streamsToday || 0) - (runnerUp.streamsToday || 0))} de diferença` : lateUser?.nowPlaying?.track?.name,
        users: runnerUp && mostActive ? [mostActive, runnerUp] : lateUser ? [lateUser] : []
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

  return (
    <div className="flex flex-col gap-3 mb-3 mt-1">
      <SectionHeader 
        title="Insights do Dia" 
        icon={<Sparkles className="h-3 w-3 text-orange-500" />} 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visibleInsights.map((insight) => (
          <motion.div
            key={insight.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={insight.onClick}
            className="glass-card bg-white/[0.02] border border-white/5 hover:border-orange-500/20 rounded-2xl p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors relative overflow-hidden"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center shrink-0 -space-x-3">
                {insight.users.slice(0, 2).map((user: any, index: number) => (
                  <div key={`${insight.key}-${user.id}`} className="h-9 w-9 rounded-full overflow-hidden border border-[#0d0d0d] relative shrink-0" style={{ zIndex: 2 - index }}>
                    <SmartImage
                      src={coreUtils.getUserAvatar(user.id, user.avatar)}
                      rounded="full"
                      className="h-full w-full object-cover"
                      fallback=""
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[8.5px] font-black text-orange-500 uppercase tracking-widest leading-none mb-1">
                  <span className="inline-flex items-center gap-1">{insight.icon}{insight.title}</span>
                </span>
                <span className="text-xs font-bold text-white truncate leading-tight">
                  {insight.primary}
                </span>
                <p className="text-[10px] font-medium text-white/40 truncate mt-0.5">
                  {insight.secondary}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right pr-1">
              <Flame className="h-3.5 w-3.5 text-white/10" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});
