import { useEffect, useState } from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { MusicCard, Skeleton, LeoHeader, SectionHeader, FriendsHorizontalCard, FriendsCardSkeleton, LiveGroupOverview, StatsLCLogo, TrackLeaderboardModal } from '../components/MusicUI';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, Bell, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { coreUtils } from '../services/statsCore';

export default function HomeScreen() {
  const { groupStats, isLoading, error, fetchGroupStats } = useStatsStore();
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const LEO_ID = '000997.3647cff9cc2b42359d6ca7f79a0f2c91.0428';
  const leoStats = groupStats?.users[LEO_ID];
  
  const friends = Object.values(groupStats?.users || {}).filter(u => u.id !== LEO_ID);

  useEffect(() => {
    fetchGroupStats();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {selectedTrack && (
          <TrackLeaderboardModal 
            track={selectedTrack} 
            onClose={() => setSelectedTrack(null)} 
          />
        )}
      </AnimatePresence>

      {/* Top Bar Navigation */}
      <header className="flex items-center justify-between mb-6 px-1 pt-2">
        <div className="flex items-center gap-3">
          <StatsLCLogo size={36} />
          <div className="flex flex-col">
            <h1 className="font-mundial text-xl font-semibold tracking-wider leading-none lowercase">
              stats.lc
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
               <div className={clsx("h-1.5 w-1.5 rounded-full", isLoading ? "bg-orange-500 animate-pulse" : "bg-green-500")} />
               <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Leo's Circle Live</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => fetchGroupStats(true)}
            className="h-11 w-11 glass rounded-2xl flex items-center justify-center active:scale-95 transition-all hover:bg-white/10"
          >
            <RefreshCcw className={clsx("h-5 w-5 text-white/60", isLoading && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* Primary Highlight: Leo (Destaque Máximo) */}
      <AnimatePresence mode="wait">
        {isLoading && !leoStats ? (
          <Skeleton className="h-[340px] w-full rounded-[42px]" />
        ) : error ? (
            <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }}
             className="glass-card flex flex-col items-center justify-center gap-4 py-12 border-red-500/10 bg-red-500/5 px-6"
            >
               <AlertTriangle className="h-8 w-8 text-red-500/50" />
               <div className="text-center">
                 <p className="text-sm font-bold text-white/90">Erro de Sincronia</p>
                 <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1 mb-4 leading-tight">
                    {error || "Verifique sua conexão ou o status do backend."}
                 </p>
               </div>
               <button 
                 onClick={() => fetchGroupStats(true)}
                 className="px-6 py-2 glass rounded-full text-[10px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/10"
               >
                 Tentar Sincronizar Agora
               </button>
            </motion.div>
        ) : (
          <LeoHeader 
            userId={LEO_ID}
            userName={leoStats?.name}
            userAvatar={leoStats?.avatar}
            nowPlaying={leoStats?.nowPlaying} 
            streamsToday={leoStats?.streamsToday || 0} 
            onTrackClick={(track) => setSelectedTrack(track)}
          />
        )}
      </AnimatePresence>

      {groupStats && (
        <LiveGroupOverview 
          users={Object.values(groupStats.users)} 
          lastUpdate={groupStats.lastUpdated}
        />
      )}

      {/* Feed dos Amigos: Horizontal Scroll */}
      <SectionHeader 
        title="Amigos em Sintonia" 
        action={<span className="text-[9px] text-orange-500 font-black uppercase tracking-tighter">Live Feed</span>}
      />
      
      <div className="grid grid-cols-5 gap-1 pb-4">
        <AnimatePresence mode="popLayout">
          {isLoading && friends.length === 0 ? (
            [1, 2, 3, 4, 5].map(i => <FriendsCardSkeleton key={i} />)
          ) : (
            friends.slice(0, 5).map((user, idx) => {
              const track = user.nowPlaying?.track;
              const artistName = track?.artists
                ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')
                : (user.nowPlaying ? "Unknown Artist" : "-");

              return (
                <FriendsHorizontalCard
                  key={user.id || `friend-${idx}`}
                  userId={user.id}
                  userName={user.name}
                  userAvatar={user.avatar}
                  songName={track?.name}
                  artistName={artistName}
                  imageUrl={track?.image} 
                  isNowPlaying={!!user.nowPlaying && user.nowPlaying.isNow}
                  timestamp={user.nowPlaying?.timestamp}
                  playedCount={track?.playedCount}
                  onClick={() => track && setSelectedTrack(track)}
                />
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Actividade Recente (Listagem Condensada) */}
      <SectionHeader title="Histórico da Sessão" />
      <div className="flex flex-col gap-3">
         {friends.slice(0, 3).map((user, idx) => {
           const track = user.nowPlaying?.track;
           const artistName = track?.artists
             ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')
             : (user.nowPlaying ? "Unknown Artist" : "-");

             return (
               <MusicCard
                 key={`${user.id || idx}-session`}
                 userId={user.id}
                 userName={user.name}
                 songName={track?.name || "Offline"}
                 artistName={artistName}
                 imageUrl={track?.image}
                 isNowPlaying={false}
                 className="bg-transparent border-white/[0.03] p-3"
                 footer={user.nowPlaying?.timestamp ? coreUtils.getTimeAgoSmart(new Date(user.nowPlaying.timestamp)) : undefined}
                 onClick={() => track && setSelectedTrack(track)}
               />
             );
         })}
      </div>

      <p className="mt-12 text-center text-[9px] text-white/20 lowercase tracking-[0.4em] font-mundial font-semibold mb-20">
        stats.lc • Leo's Circle Exclusive v1.0
      </p>
    </div>
  );
}
