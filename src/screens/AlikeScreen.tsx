import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';
import { SmartImage, SectionHeader } from '../components/shared/CommonUI';
import { TopItem, UserStats } from '../types/stats';
import { HeartHandshake, Users, Sparkles, UserCircle2, Clock, PlayCircle, Flame } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getVisibleMembers } from '../lib/memberSelectors';
import { statsService } from '../services/statsService';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

// Compute affinity score between user and friend
function computeAffinity(user: UserStats, friend: UserStats): number {
  if (!user.topItems || !friend.topItems) return 0;
  let totalScore = 0;
  
  const categories = ['artists', 'tracks', 'albums'] as const;
  
  categories.forEach(cat => {
    const userItems = (user.topItems![cat] || []).slice(0, 50).map(i => {
      const nested = (i as any).track || (i as any).artist || (i as any).album;
      return coreUtils.normalizeText(nested?.name || i.name || (i as any).artistName || (i as any).albumName || '');
    }).filter(Boolean);
    
    const friendItems = (friend.topItems![cat] || []).slice(0, 50).map(i => {
      const nested = (i as any).track || (i as any).artist || (i as any).album;
      return coreUtils.normalizeText(nested?.name || i.name || (i as any).artistName || (i as any).albumName || '');
    }).filter(Boolean);
    
    let matches = 0;
    userItems.forEach(uItem => {
      if (friendItems.includes(uItem)) {
        matches += 1;
      } else {
        // partial match for tracks long enough
        if (cat === 'tracks') {
          if (friendItems.some(fItem => (fItem.includes(uItem) && uItem.length > 5) || (uItem.includes(fItem) && fItem.length > 5))) {
            matches += 0.5;
          }
        }
      }
    });
    
    const maxPossible = Math.min(50, Math.max(userItems.length, friendItems.length));
    if (maxPossible > 0) {
      totalScore += (matches / maxPossible) * 100;
    }
  });

  // Average over the 3 categories
  return Math.round(totalScore / 3);
}

// Get intersected items
function getIntersection(user: UserStats, friend: UserStats, type: 'artists' | 'tracks' | 'albums') {
  if (!user.topItems || !friend.topItems) return [];
  const friendItemsMap = new Map();
  
  (friend.topItems[type] || []).slice(0, 50).forEach(i => {
    const nested = (i as any).track || (i as any).artist || (i as any).album;
    const norm = coreUtils.normalizeText(nested?.name || i.name || (i as any).artistName || (i as any).albumName || '');
    if (norm) friendItemsMap.set(norm, Object.assign({}, i, { normalizedName: norm }));
  });

  const intersection: any[] = [];
  
  (user.topItems[type] || []).slice(0, 50).forEach(uItem => {
    const nested = (uItem as any).track || (uItem as any).artist || (uItem as any).album;
    const norm = coreUtils.normalizeText(nested?.name || uItem.name || (uItem as any).artistName || (uItem as any).albumName || '');
    
    if (norm && friendItemsMap.has(norm)) {
      intersection.push({
        item: uItem,
        friendItem: friendItemsMap.get(norm)
      });
    } else if (norm && type === 'tracks') {
      const pMatch = Array.from(friendItemsMap.keys()).find(fNorm => (fNorm.includes(norm) && norm.length > 5) || (norm.includes(fNorm) && fNorm.length > 5));
      if (pMatch) {
         intersection.push({
           item: uItem,
           friendItem: friendItemsMap.get(pMatch)
         });
      }
    }
  });
  
  return intersection;
}

function compareRowsToIntersection(rows: any[] = []) {
  return rows.slice(0, 12).map((row) => {
    const byUserItems = Object.values(row.byUser || {}) as any[];
    return {
      item: row.item || byUserItems[0]?.item || {},
      friendItem: byUserItems[1]?.item || row.item || {},
      sharedByCount: row.sharedByCount,
      score: row.score,
    };
  });
}

export default function AlikeScreen() {
  const groupStats = useStatsStore(state => state.groupStats);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const members = useMemo(() => getVisibleMembers(groupStats, hiddenUsers), [groupStats, hiddenUsers]);
  const featuredUser = useMemo(
    () => members.find(m => m.id === featuredUserId) || members[0] || null,
    [members, featuredUserId]
  );
  const effectiveFeaturedUserId = featuredUser?.id || featuredUserId || '';
  const friends = useMemo(
    () => members.filter(m => m.id !== effectiveFeaturedUserId),
    [members, effectiveFeaturedUserId]
  );

  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<any>(null);
  const [compareStatus, setCompareStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const friendAffinities = useMemo(() => {
    if (!featuredUser) return [];
    return friends.map(f => ({
      friend: f,
      affinity: computeAffinity(featuredUser, f)
    })).sort((a, b) => b.affinity - a.affinity);
  }, [featuredUser, friends]);

  // If no initial friend is selected, pick highest affinity
  useEffect(() => {
    const selectedExists = selectedFriendId
      ? friends.some(friend => friend.id === selectedFriendId)
      : false;
    const nextFriendId = friendAffinities[0]?.friend.id || friends[0]?.id || null;

    if ((!selectedFriendId || !selectedExists) && selectedFriendId !== nextFriendId) {
      setSelectedFriendId(nextFriendId);
    }
  }, [selectedFriendId, friendAffinities, friends]);

  const selectedFriend = useMemo(
    () => friends.find(f => f.id === selectedFriendId) || friends[0] || null,
    [friends, selectedFriendId]
  );

  useEffect(() => {
    if (!featuredUser?.id || !selectedFriend?.id) {
      setCompareData(null);
      setCompareStatus('idle');
      return;
    }

    const controller = new AbortController();
    setCompareStatus('loading');

    statsService.getCompareData({
      users: [featuredUser.id, selectedFriend.id],
      period: 'month',
      limit: 80,
      commonMode: 'any',
      minSharedBy: 2,
      signal: controller.signal,
    })
      .then((data) => {
        setCompareData(data);
        setCompareStatus('ready');
      })
      .catch((error: any) => {
        if (controller.signal.aborted || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
        setCompareData(null);
        setCompareStatus('error');
      });

    return () => controller.abort();
  }, [featuredUser?.id, selectedFriend?.id]);

  const compareStats = useMemo(() => {
    if (!featuredUser || !selectedFriend) return null;
    
    const uStats = featuredUser;
    const fStats = selectedFriend;

    return {
      streams: {
        today: { user: uStats.streamsToday || 0, friend: fStats.streamsToday || 0 },
        week: { user: uStats.streamsWeek || 0, friend: fStats.streamsWeek || 0 },
        month: { user: uStats.streamsMonth || 0, friend: fStats.streamsMonth || 0 },
      },
      duration: {
        user: uStats.totalDurationMs || 0,
        friend: fStats.totalDurationMs || 0
      },
      intersection: {
        artists: compareData?.common?.artists?.length ? compareRowsToIntersection(compareData.common.artists) : getIntersection(featuredUser, selectedFriend, 'artists'),
        tracks: compareData?.common?.tracks?.length ? compareRowsToIntersection(compareData.common.tracks) : getIntersection(featuredUser, selectedFriend, 'tracks'),
        albums: compareData?.common?.albums?.length ? compareRowsToIntersection(compareData.common.albums) : getIntersection(featuredUser, selectedFriend, 'albums')
      }
    };
  }, [featuredUser, selectedFriend, compareData]);


  if (!featuredUser || friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
          <HeartHandshake className="h-8 w-8 text-white/20" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white/90 uppercase font-mundial">Faltam Conexões</h2>
        <p className="text-sm text-white/50 max-w-sm">
          A seção Alike compara seu gosto musical com o dos seus amigos. Adicione mais pessoas ao grupo para descobrir afinidades.
        </p>
      </div>
    );
  }

  const affinityScore = friendAffinities.find(a => a.friend.id === selectedFriendId)?.affinity || 0;

  return (
    <div className="flex flex-col gap-6 px-4 py-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-3">
        <motion.div 
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 15, stiffness: 200 }}
          className="h-16 w-16 bg-gradient-to-tr from-orange-500/20 to-rose-500/20 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl relative"
        >
          <HeartHandshake className="h-8 w-8 text-orange-400" />
          <div className="absolute -bottom-1 -right-1 bg-rose-500 rounded-full p-1 shadow-lg border border-white/20">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
        </motion.div>
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white font-mundial uppercase mt-2">Stats Alike</h1>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-[0.2em] mt-1">Conexões Musicais</p>
        </div>
      </div>

      {/* Amigos Mais Parecidos Ranking */}
      <div className="flex flex-col gap-4">
        <SectionHeader title="Ranking de Afinidade" icon={<Users className="h-4 w-4 text-orange-500" />} />
        <div className="grid grid-cols-2 gap-3">
          {friendAffinities.map((aff, index) => (
            <motion.button
              key={aff.friend.id}
              onClick={() => setSelectedFriendId(aff.friend.id)}
              aria-pressed={selectedFriendId === aff.friend.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "glass-card p-4 rounded-3xl border-white/5 transition-[background-color,border-color,transform] duration-200 text-left flex flex-col gap-3 relative overflow-hidden group",
                selectedFriendId === aff.friend.id ? "bg-white/[0.08] border-orange-500/30" : "hover:bg-white/[0.04]"
              )}
            >
              {selectedFriendId === aff.friend.id && (
                <motion.div layoutId="active-affinity" className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-rose-500/5 pointer-events-none" />
              )}
              <div className="flex items-center justify-between z-10 w-full relative">
                <SmartImage 
                  src={coreUtils.getUserAvatar(aff.friend.id, aff.friend.avatar)} 
                  fallback={aff.friend.name?.charAt(0)}
                  rounded="full" 
                  className="h-10 w-10 border border-white/10"
                />
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black text-orange-400">{aff.affinity}%</span>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Match</span>
                </div>
              </div>
              <span className="text-sm font-bold text-white/90 truncate z-10">{aff.friend.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Versus Section */}
      {selectedFriend && compareStats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6"
        >
          <div className="glass-card rounded-[40px] p-6 border-white/5 flex gap-8 items-center justify-center relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-64 h-64 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="flex flex-col items-center gap-3 z-10">
                <SmartImage
                  src={coreUtils.getUserAvatar(effectiveFeaturedUserId, featuredUser.avatar)}
                  fallback={featuredUser.name?.charAt(0)}
                  rounded="full"
                className="h-20 w-20 border-4 border-white/10 shadow-2xl bg-black"
              />
              <span className="text-sm font-bold text-white/90">{featuredUser.name}</span>
            </div>

            <div className="flex flex-col items-center z-10 px-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">Vs</span>
              <div className="h-12 w-12 rounded-full glass flex items-center justify-center border-white/10 shadow-xl bg-white/[0.02]">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <span className="text-xl font-mundial font-black text-white tracking-tighter mt-3">{affinityScore}%</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-orange-500/80">Afinidade</span>
            </div>

            <div className="flex flex-col items-center gap-3 z-10">
              <SmartImage 
                src={coreUtils.getUserAvatar(selectedFriend.id, selectedFriend.avatar)} 
                fallback={selectedFriend.name?.charAt(0)} 
                rounded="full" 
                className="h-20 w-20 border-4 border-white/10 shadow-2xl bg-black"
              />
              <span className="text-sm font-bold text-white/90">{selectedFriend.name}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Stats Comparison */}
            <div className="glass-card rounded-[32px] p-6 border-white/5 flex flex-col gap-6 w-full">
              <SectionHeader title="Comparativo (Hoje)" icon={<Clock className="h-4 w-4 text-orange-500" />} />
              <div className="flex flex-col gap-5 mt-2">
                <CompareBar label="Streams Hoje" userVal={compareStats.streams.today.user} friendVal={compareStats.streams.today.friend} />
                <CompareBar label="Streams Semana" userVal={compareStats.streams.week.user} friendVal={compareStats.streams.week.friend} />
                <CompareBar label="Tempo Ouvido (Horas)" userVal={Math.round(compareStats.duration.user/3600000)} friendVal={Math.round(compareStats.duration.friend/3600000)} isTime />
              </div>
            </div>

            {/* In Common */}
            <div className="glass-card rounded-[32px] p-6 border-white/5 flex flex-col gap-6 w-full">
              <SectionHeader title="Em Comum" icon={<Sparkles className="h-4 w-4 text-orange-500" />} />
              {compareStatus === 'loading' && (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                  Atualizando afinidade pela API...
                </div>
              )}
              {compareStatus === 'error' && (
                <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.04] px-4 py-3 text-[10px] font-bold leading-relaxed text-orange-200/70">
                  Nao foi possivel atualizar a afinidade agora. Mostrando dados locais.
                </div>
              )}
              
              <div className="flex flex-col gap-6 mt-2 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
                <CommonList title="Artistas Top 50" items={compareStats.intersection.artists} type="artista" />
                <CommonList title="Músicas Top 50" items={compareStats.intersection.tracks} type="faixa" />
                <CommonList title="Álbuns Top 50" items={compareStats.intersection.albums} type="álbum" />
                
                {compareStats.intersection.artists.length === 0 && compareStats.intersection.tracks.length === 0 && compareStats.intersection.albums.length === 0 && (
                  <div className="py-8 text-center flex flex-col items-center gap-2 opacity-40">
                     <HeartHandshake className="h-6 w-6" />
                     <span className="text-xs uppercase tracking-widest font-bold">Nenhum Top em comum</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </motion.div>
      )}

    </div>
  );
}

const CompareBar = ({ label, userVal, friendVal, isTime = false }: { label: string, userVal: number, friendVal: number, isTime?: boolean }) => {
  const max = Math.max(userVal, friendVal, 1);
  const uPct = (userVal / max) * 100;
  const fPct = (friendVal / max) * 100;

  const displayVal = (v: number) => isTime ? `${coreUtils.formatNumber(v)}h` : coreUtils.formatNumber(v);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-[40px] text-right">
          <span className={cn("text-xs font-bold leading-none", userVal >= friendVal ? "text-orange-500" : "text-white/40")}>{displayVal(userVal)}</span>
        </div>
        <div className="flex-1 h-3 bg-white/[0.02] rounded-full flex overflow-hidden">
          <motion.div 
            initial={{ scaleX: 0 }}
            animate={{ scaleX: uPct / 100 }}
            style={{ transformOrigin: 'left center' }}
            className={cn("h-full w-full", userVal >= friendVal ? "bg-orange-500" : "bg-white/20")}
          />
        </div>
        <div className="w-[1px] h-4 bg-white/10" />
        <div className="flex-1 h-3 bg-white/[0.02] rounded-full flex justify-end overflow-hidden">
          <motion.div 
            initial={{ scaleX: 0 }}
            animate={{ scaleX: fPct / 100 }}
            style={{ transformOrigin: 'right center' }}
            className={cn("h-full w-full", friendVal >= userVal ? "bg-blue-500" : "bg-white/20")}
          />
        </div>
        <div className="w-[40px] text-left">
          <span className={cn("text-xs font-bold leading-none", friendVal >= userVal ? "text-blue-500" : "text-white/40")}>{displayVal(friendVal)}</span>
        </div>
      </div>
    </div>
  );
};

const CommonList = ({ title, items, type }: { title: string, items: any[], type: string }) => {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-[1px] bg-white/5" />
        <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{title}</span>
        <div className="flex-1 h-[1px] bg-white/5" />
      </div>
      <div className="flex flex-col gap-2">
        {items.slice(0, 5).map((match, idx) => {
           const uItem = match.item;
           const img = (uItem as any).image || (uItem as any).album?.image || (uItem as any).artist?.image || (uItem as any).track?.album?.image;
           const name = (uItem as any).name || (uItem as any).track?.name || 'Unknown';
           const artist = (uItem as any).artist?.name || (uItem as any).artistName || (uItem as any).primaryArtist?.name || '';
           
           return (
             <div key={idx} className="flex items-center gap-3 p-2 rounded-2xl bg-white/[0.02] border border-white/5">
                <SmartImage src={img} fallback={name} rounded="lg" className="h-10 w-10" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-bold text-white/90 truncate">{name}</span>
                  <span className="text-[9px] text-white/40 truncate uppercase tracking-wider mt-0.5">{type}{artist ? ` • ${artist}` : ''}</span>
                </div>
             </div>
           );
        })}
        {items.length > 5 && (
          <div className="text-center mt-1">
            <span className="text-[9px] text-orange-500/70 font-bold uppercase tracking-widest">+{items.length - 5} matches</span>
          </div>
        )}
      </div>
    </div>
  );
};
