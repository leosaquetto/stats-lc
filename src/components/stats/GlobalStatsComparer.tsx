import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Swords, Clock, PlayCircle, Star, Info } from 'lucide-react';
import clsx from 'clsx';
import { SmartImage } from '../shared/CommonUI';
import { UserStats } from '../../types/stats';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { useMotionRuntime } from '../../hooks/useMotionRuntime';

interface GlobalStatsComparerProps {
  members: UserStats[];
}

const ratioScale = (value: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, value / max)) : 0);

export const GlobalStatsComparer = ({ members }: GlobalStatsComparerProps) => {
  const motionRuntime = useMotionRuntime();
  const shouldAnimateComparer = motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve';
  const [userAId, setUserAId] = useState<string>(members[0]?.id || '');
  const [userBId, setUserBId] = useState<string>(members[1]?.id || members[0]?.id || '');
  const [selectingFor, setSelectingFor] = useState<'A' | 'B' | 'none'>('none');
  const [showArtistComparison, setShowArtistComparison] = useState(false);
  const [compareData, setCompareData] = useState<any>(null);
  const [compareStatus, setCompareStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const userA = members.find(m => m.id === userAId) || members[0];
  const userB = members.find(m => m.id === userBId) || members[0];

  const swapUsers = () => {
    setUserAId(userBId);
    setUserBId(userAId);
  };

  const getWinner = (valA: number, valB: number) => {
    if (valA > valB) return 'A';
    if (valB > valA) return 'B';
    return 'tie';
  };

  const streamsWinner = getWinner(userA.totalStreams || 0, userB.totalStreams || 0);
  const timeWinner = getWinner(userA.totalDurationMs || 0, userB.totalDurationMs || 0);

  useEffect(() => {
    if (!showArtistComparison || !userA?.id || !userB?.id || userA.id === userB.id) return;

    const controller = new AbortController();
    setCompareStatus('loading');

    statsService.getCompareData({
      users: [userA.id, userB.id],
      period: 'month',
      limit: 50,
      signal: controller.signal,
    })
      .then((data) => {
        setCompareData(data);
        setCompareStatus('ready');
      })
      .catch((error: any) => {
        if (controller.signal.aborted || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
        setCompareStatus('error');
      });

    return () => controller.abort();
  }, [showArtistComparison, userA?.id, userB?.id]);

  const apiCommonArtists = useMemo(() => {
    const rows = compareData?.common?.artists;
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 5).map((row: any) => ({
      ...(row.item || {}),
      sharedByCount: row.sharedByCount,
      score: row.score,
    }));
  }, [compareData]);

  // Artist Comparison Logic
  const topArtistsA = (userA.topItems?.artists || []).slice(0, 5);
  const topArtistsB = (userB.topItems?.artists || []).slice(0, 5);

  const localCommonArtists = topArtistsA.filter(a =>
    topArtistsB.some(b => b.name.toLowerCase() === a.name.toLowerCase())
  );
  const commonArtists = apiCommonArtists.length > 0 ? apiCommonArtists : localCommonArtists;

  const uniqueArtistsA = topArtistsA.filter(a => 
    !topArtistsB.some(b => b.name.toLowerCase() === a.name.toLowerCase())
  );

  const uniqueArtistsB = topArtistsB.filter(b => 
    !topArtistsA.some(a => a.name.toLowerCase() === b.name.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 relative">
      {/* Container de Seleção */}
      <div className="flex items-center justify-between glass-card p-4">
        {/* User A */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <button 
            onClick={() => setSelectingFor(selectingFor === 'A' ? 'none' : 'A')}
            className={clsx(
              "h-16 w-16 rounded-full p-1 transition-[background-color,transform] duration-200 relative overflow-hidden",
              selectingFor === 'A' ? "bg-orange-500 scale-105" : "bg-white/10 hover:bg-white/20"
            )}
          >
            <SmartImage src={userA.avatar} className="h-full w-full rounded-full" fallback="" />
          </button>
          <span className="text-[10px] font-black uppercase tracking-wider text-white/80">{userA.name}</span>
        </div>

        {/* Swap Button */}
        <button 
          onClick={swapUsers}
          className="h-10 w-10 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-[background-color,border-color,color,transform] duration-200 text-orange-500 mx-2"
        >
          <Swords className="h-4 w-4" />
        </button>

        {/* User B */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <button 
            onClick={() => setSelectingFor(selectingFor === 'B' ? 'none' : 'B')}
            className={clsx(
              "h-16 w-16 rounded-full p-1 transition-[background-color,transform] duration-200 relative overflow-hidden",
              selectingFor === 'B' ? "bg-amber-400 scale-105" : "bg-white/10 hover:bg-white/20"
            )}
          >
            <SmartImage src={userB.avatar} className="h-full w-full rounded-full" fallback="" />
          </button>
          <span className="text-[10px] font-black uppercase tracking-wider text-white/80">{userB.name}</span>
        </div>
      </div>

      {/* Selector Dropdown */}
      <AnimatePresence>
        {selectingFor !== 'none' && (
          <motion.div 
            initial={shouldAnimateComparer ? { opacity: 0, y: -4, scaleY: 0.98 } : { opacity: 1, y: 0, scaleY: 1 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={shouldAnimateComparer ? { opacity: 0, y: -4, scaleY: 0.98 } : { opacity: 1, y: 0, scaleY: 1 }}
            transition={{ duration: shouldAnimateComparer ? 0.18 : 0.01, ease: [0.16, 1, 0.3, 1] }}
            className="origin-top"
          >
            <div className="glass-card p-3 flex gap-3 overflow-x-auto no-scrollbar border-orange-500/30">
              {members.map(member => {
                const isSelected = member.id === (selectingFor === 'A' ? userAId : userBId);
                const isOther = member.id === (selectingFor === 'A' ? userBId : userAId);
                
                return (
                  <button
                    key={member.id}
                    disabled={isOther}
                    onClick={() => {
                      if (selectingFor === 'A') setUserAId(member.id);
                      else setUserBId(member.id);
                      setSelectingFor('none');
                    }}
                    className={clsx(
                      "flex flex-col items-center gap-2 min-w-[64px] p-2 rounded-xl transition-[background-color,color,filter,opacity] duration-200",
                      isSelected ? "bg-white/10" : "hover:bg-white/5",
                      isOther && "opacity-30 grayscale cursor-not-allowed"
                    )}
                  >
                    <div className={clsx(
                      "h-12 w-12 rounded-full p-0.5",
                      isSelected ? (selectingFor === 'A' ? "bg-orange-500" : "bg-amber-400") : "bg-white/10"
                    )}>
                      <SmartImage src={member.avatar} className="h-full w-full rounded-full" fallback="" />
                    </div>
                    <span className="text-[9px] font-bold text-white/80 truncate w-full text-center">{member.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparisons */}
      <div className="glass-card p-5 flex flex-col gap-6 relative overflow-hidden">
        {/* Streams Totais */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <PlayCircle className="h-4 w-4 text-white/50" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Streams Totais</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col flex-1">
              <span className={clsx(
                "text-lg font-black tracking-tighter leading-none mb-1",
                streamsWinner === 'A' ? "text-orange-500 font-display" : "text-white/80"
              )}>
                {coreUtils.formatNumber(userA.totalStreams || 0)}
              </span>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={clsx("h-full w-full origin-left rounded-full transition-transform duration-500 ease-out", streamsWinner === 'A' ? "bg-orange-500" : "bg-white/20")}
                  style={{ transform: `scaleX(${ratioScale(userA.totalStreams || 0, Math.max(userA.totalStreams || 0, userB.totalStreams || 0))})` }}
                />
              </div>
            </div>
            
            <div className="w-8 shrink-0 flex justify-center text-white/20 font-black text-[10px]">vs</div>
            
            <div className="flex flex-col flex-1 items-end text-right">
              <span className={clsx(
                "text-lg font-black tracking-tighter leading-none mb-1",
                streamsWinner === 'B' ? "text-amber-400 font-display" : "text-white/80"
              )}>
                {coreUtils.formatNumber(userB.totalStreams || 0)}
              </span>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex justify-end">
                <div 
                  className={clsx("h-full w-full origin-right rounded-full transition-transform duration-500 ease-out", streamsWinner === 'B' ? "bg-amber-400" : "bg-white/20")}
                  style={{ transform: `scaleX(${ratioScale(userB.totalStreams || 0, Math.max(userA.totalStreams || 0, userB.totalStreams || 0))})` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tempo Ouvido */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-white/50" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Tempo Ouvido</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col flex-1">
              <span className={clsx(
                "text-lg font-black tracking-tighter leading-none mb-1",
                timeWinner === 'A' ? "text-orange-500 font-display" : "text-white/80"
              )}>
                {coreUtils.formatDuration(userA.totalDurationMs || 0)}
              </span>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={clsx("h-full w-full origin-left rounded-full transition-transform duration-500 ease-out", timeWinner === 'A' ? "bg-orange-500" : "bg-white/20")}
                  style={{ transform: `scaleX(${ratioScale(userA.totalDurationMs || 0, Math.max(userA.totalDurationMs || 0, userB.totalDurationMs || 0))})` }}
                />
              </div>
            </div>
            
            <div className="w-8 shrink-0 flex justify-center text-white/20 font-black text-[10px]">vs</div>
            
            <div className="flex flex-col flex-1 items-end text-right">
              <span className={clsx(
                "text-lg font-black tracking-tighter leading-none mb-1",
                timeWinner === 'B' ? "text-amber-400 font-display" : "text-white/80"
              )}>
                {coreUtils.formatDuration(userB.totalDurationMs || 0)}
              </span>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex justify-end">
                <div 
                  className={clsx("h-full w-full origin-right rounded-full transition-transform duration-500 ease-out", timeWinner === 'B' ? "bg-amber-400" : "bg-white/20")}
                  style={{ transform: `scaleX(${ratioScale(userB.totalDurationMs || 0, Math.max(userA.totalDurationMs || 0, userB.totalDurationMs || 0))})` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Artist Comparison Button */}
        <div className="pt-2">
          <button
            onClick={() => setShowArtistComparison(!showArtistComparison)}
            className={clsx(
              "w-full py-3 rounded-2xl border transition-[background-color,border-color,color,transform] duration-200 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-[0.99]",
              showArtistComparison 
                ? "bg-orange-500/20 border-orange-500/40 text-orange-500" 
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
            )}
          >
            <Star className={clsx("h-4 w-4", showArtistComparison && "fill-orange-500")} />
            {showArtistComparison ? "Ocultar Afinidade de Artistas" : "Comparar Top Artistas"}
          </button>
        </div>

        {/* Artist Comparison Logic Display */}
        <AnimatePresence>
          {showArtistComparison && (
            <motion.div
              initial={shouldAnimateComparer ? { opacity: 0, y: -4, scaleY: 0.98 } : { opacity: 1, y: 0, scaleY: 1 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={shouldAnimateComparer ? { opacity: 0, y: -4, scaleY: 0.98 } : { opacity: 1, y: 0, scaleY: 1 }}
              transition={{ duration: shouldAnimateComparer ? 0.2 : 0.01, ease: [0.16, 1, 0.3, 1] }}
              className="origin-top"
            >
              <div className="flex flex-col gap-6 pt-4 border-t border-white/5">
                {/* Common Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-green-500/20 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                      Em Comum ({commonArtists.length})
                    </span>
                  </div>

                  {compareStatus === 'loading' && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
                      <span className="text-[10px] font-bold text-white/35">Calculando afinidade pela API...</span>
                    </div>
                  )}

                  {compareStatus === 'error' && (
                    <div className="bg-orange-500/5 rounded-xl p-3 border border-orange-500/10 text-center">
                      <span className="text-[10px] font-bold text-orange-400/70">API indisponivel, usando dados locais.</span>
                    </div>
                  )}
                  
                  {commonArtists.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {commonArtists.map((artist, idx) => (
                        <div key={`common-${artist.id || idx}`} className="flex items-center gap-2 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
                          <SmartImage src={artist.image} className="h-5 w-5 rounded-md" fallback="" />
                          <span className="text-[10px] font-bold text-white/90">{artist.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white/5 rounded-xl p-3 border border-dashed border-white/10 text-center">
                      <span className="text-[10px] font-bold text-white/30 italic">Nenhum artista em comum no Top 5</span>
                    </div>
                  )}
                </div>

                {/* Split Section */}
                <div className="grid grid-cols-2 gap-4">
                  {/* User A Unique */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[8px] font-black uppercase tracking-widest text-orange-500/60 truncate">Só de {userA.name}</span>
                    <div className="flex flex-col gap-1.5">
                      {uniqueArtistsA.map((artist, idx) => (
                        <div key={`uniqueA-${artist.id || idx}`} className="flex items-center gap-2 bg-orange-500/[0.03] border border-orange-500/10 p-1.5 rounded-xl">
                          <SmartImage src={artist.image} className="h-6 w-6 rounded-lg" fallback="" />
                          <span className="text-[9px] font-black text-white/70 line-clamp-1">{artist.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* User B Unique */}
                  <div className="flex flex-col gap-3 items-end text-right">
                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-400/60 truncate">Só de {userB.name}</span>
                    <div className="flex flex-col gap-1.5 w-full">
                      {uniqueArtistsB.map((artist, idx) => (
                        <div key={`uniqueB-${artist.id || idx}`} className="flex items-center gap-2 bg-amber-400/[0.03] border border-amber-400/10 p-1.5 rounded-xl flex-row-reverse text-right">
                          <SmartImage src={artist.image} className="h-6 w-6 rounded-lg" fallback="" />
                          <span className="text-[9px] font-black text-white/70 line-clamp-1">{artist.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-orange-500/5 rounded-2xl p-4 flex items-start gap-3 border border-orange-500/10">
                  <Info className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-orange-500">Nota de afinidade</span>
                    <p className="text-[10px] font-medium text-white/50 leading-relaxed">
                      A afinidade é calculada cruzando os 5 artistas mais ouvidos de cada perfil neste momento. {commonArtists.length > 0 ? `Eles compartilham ${commonArtists.length} conexões musicais diretas.` : 'Não há conexões diretas no Top 5 atual.'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
