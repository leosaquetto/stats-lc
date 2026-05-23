import React from 'react';
import { motion } from 'motion/react';
import { useStatsStore } from '../../store/useStatsStore';
import { coreUtils } from '../../services/statsCore';
import { Zap, Heart, Flame, Sparkles } from 'lucide-react';
import { SmartImage, SectionHeader } from '../shared/CommonUI';

interface HomeInsightsProps {
  onFriendClick: (friend: any) => void;
}

export const HomeInsights: React.FC<HomeInsightsProps> = ({ onFriendClick }) => {
  const { groupStats, hiddenUsers } = useStatsStore();

  const members = groupStats?.members || [];
  const activeMembers = members.filter(m => !hiddenUsers.includes(m.id));

  if (activeMembers.length < 2) return null;

  // 1. Mais ativo hoje
  const mostActive = [...activeMembers].reduce((prev, current) => {
    return (current.streamsToday || 0) > (prev.streamsToday || 0) ? current : prev;
  }, activeMembers[0]);

  // 2. Match do dia (Afinidade)
  const getMatchOfTheDay = () => {
    let bestPair = null;
    let maxScore = -1;
    let matchedItemName = "";

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

        if (commonScore > maxScore) {
          maxScore = commonScore;
          bestPair = { u1, u2 };
          matchedItemName = sampleMatch;
        }
      }
    }

    if (!bestPair || maxScore === 0) {
      // Fallback
      return {
        u1: activeMembers[0],
        u2: activeMembers[1] || activeMembers[0],
        score: 0,
        reason: "Conexão de Ritmo"
      };
    }

    return {
      u1: bestPair.u1,
      u2: bestPair.u2,
      score: maxScore,
      reason: matchedItemName ? `Curtem ${matchedItemName}` : "Alinhamento sonoro!"
    };
  };

  const match = getMatchOfTheDay();

  return (
    <div className="flex flex-col gap-3 mb-3 mt-1">
      <SectionHeader 
        title="Insights do Dia" 
        icon={<Sparkles className="h-3 w-3 text-orange-500" />} 
      />

      {/* Grid containing 2 horizontal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card 1: Mais ativo hoje */}
        {mostActive && (
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onFriendClick(mostActive)}
            className="glass-card bg-white/[0.02] border border-white/5 hover:border-orange-500/20 rounded-2xl p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors relative overflow-hidden"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full overflow-hidden shrink-0 border border-white/10 relative">
                <SmartImage
                  src={coreUtils.getUserAvatar(mostActive.id, mostActive.avatar)}
                  rounded="full"
                  className="h-full w-full object-cover"
                  fallback=""
                />
                <div className="absolute -bottom-0.5 -right-0.5 bg-orange-600 rounded-full p-0.5 border border-black shadow">
                  <Zap className="h-2 w-2 text-white" />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[8.5px] font-black text-orange-500 uppercase tracking-widest leading-none mb-1">
                  Mais Ativo Hoje
                </span>
                <span className="text-xs font-bold text-white truncate leading-tight">
                  {mostActive.name}
                </span>
                <p className="text-[10px] font-medium text-white/40 truncate mt-0.5">
                  {mostActive.streamsToday || 0} reproduções hoje
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right pr-1">
              <span className="text-xs font-black text-white/10 select-none">#1</span>
            </div>
          </motion.div>
        )}

        {/* Card 2: Match do dia */}
        {match && (
          <div className="glass-card bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3 relative overflow-hidden">
            <div className="flex items-center gap-3 min-w-0">
              {/* Dual Avatars */}
              <div className="flex items-center shrink-0 -space-x-4">
                <div className="h-9 w-9 rounded-full overflow-hidden border border-[#0d0d0d] relative z-10 shrink-0">
                  <SmartImage
                    src={coreUtils.getUserAvatar(match.u1.id, match.u1.avatar)}
                    rounded="full"
                    className="h-full w-full object-cover"
                    fallback=""
                  />
                </div>
                <div className="h-9 w-9 rounded-full overflow-hidden border border-[#0d0d0d] relative shrink-0">
                  <SmartImage
                    src={coreUtils.getUserAvatar(match.u2.id, match.u2.avatar)}
                    rounded="full"
                    className="h-full w-full object-cover"
                    fallback=""
                  />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[8.5px] font-black text-red-400 uppercase tracking-widest leading-none mb-1 flex items-center gap-1">
                  <Heart className="h-2.5 w-2.5 fill-red-400 text-red-400" /> Match do Dia
                </span>
                <span className="text-xs font-bold text-white truncate leading-tight">
                  {match.u1.name} + {match.u2.name}
                </span>
                <p className="text-[10px] font-medium text-red-200/50 truncate mt-0.5">
                  {match.reason}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
