
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { coreUtils } from '../../services/statsCore';
import { SmartImage, MusicPlatformBadge } from '../shared/CommonUI';
import { clsx } from 'clsx';
import { Music, Clock, Play } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { getVisibleMembersWithLive } from '../../lib/memberSelectors';
import { GroupActivityMember, statsService } from '../../services/statsService';

interface FriendActivityReelProps {
  onTrackClick: (track: any) => void;
  onFriendClick: (friend: any) => void;
  onViewAll?: () => void;
  excludeUserId?: string;
}

const EqualizerIcon = ({ active }: { active: boolean }) => (
  <div className="flex items-center gap-[1px] h-1.5">
    <motion.div
      animate={active ? { scaleY: [0.2, 1, 0.5, 1, 0.2] } : { scaleY: 0.45 }}
      transition={active ? { duration: 0.8, repeat: Infinity, ease: "linear" } : { duration: 0.16 }}
      className="h-full w-[1.2px] origin-bottom rounded-full bg-orange-500 will-change-transform"
    />
    <motion.div
      animate={active ? { scaleY: [0.5, 0.2, 1, 0.2, 0.5] } : { scaleY: 0.75 }}
      transition={active ? { duration: 1, repeat: Infinity, ease: "linear" } : { duration: 0.16 }}
      className="h-full w-[1.2px] origin-bottom rounded-full bg-orange-500 will-change-transform"
    />
    <motion.div
      animate={active ? { scaleY: [1, 0.5, 0.2, 0.5, 1] } : { scaleY: 0.3 }}
      transition={active ? { duration: 0.9, repeat: Infinity, ease: "linear" } : { duration: 0.16 }}
      className="h-full w-[1.2px] origin-bottom rounded-full bg-orange-500 will-change-transform"
    />
  </div>
);

export const FriendActivityReel: React.FC<FriendActivityReelProps> = ({ 
  onTrackClick, 
  onFriendClick,
  onViewAll,
  excludeUserId
}) => {
  const reelRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const isReelVisible = useInView(reelRef, { amount: 0.12, margin: '160px 0px' });
  const shouldAnimate = isReelVisible && !shouldReduceMotion;
  const groupStats = useStatsStore(state => state.groupStats);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const liveNowPlayingByUserId = useStatsStore(state => state.liveNowPlayingByUserId);
  const [historicalMembers, setHistoricalMembers] = useState<GroupActivityMember[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  
  const members = useMemo(
    () => getVisibleMembersWithLive(groupStats, hiddenUsers, liveNowPlayingByUserId).filter(m =>
      String(m.id).trim() !== String(excludeUserId).trim()
    ),
    [groupStats, hiddenUsers, excludeUserId, liveNowPlayingByUserId]
  );

  useEffect(() => {
    if (!isReelVisible || members.length === 0) return;

    const controller = new AbortController();
    let active = true;

    statsService.getGroupActivity(controller.signal)
      .then((response) => {
        if (!active) return;
        setHistoricalMembers(response.members);
        setHasLoadedHistory(true);
      })
      .catch((error: any) => {
        if (!active || controller.signal.aborted) return;
        setHasLoadedHistory(true);
        if ((import.meta as any).env?.DEV) {
          console.warn('[FriendActivityReel] Group activity unavailable:', error);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isReelVisible, members.length]);

  const historicalByUserId = useMemo(
    () => new Map(
      historicalMembers
        .filter(member => member?.userId && member.activity?.track)
        .map(member => [String(member.userId), member.activity])
    ),
    [historicalMembers]
  );
  
  const sortedFriends = useMemo(() => {
    return members
      .map((friend) => {
        const liveActivity = liveNowPlayingByUserId[friend.id]?.track
          ? liveNowPlayingByUserId[friend.id]
          : null;
        const historicalActivity = historicalByUserId.get(String(friend.id));
        const initialActivity = !hasLoadedHistory && friend.nowPlaying?.track
          ? friend.nowPlaying
          : null;
        const activity = liveActivity || historicalActivity || initialActivity;

        return activity?.track
          ? {
              ...friend,
              nowPlaying: liveActivity
                ? liveActivity
                : {
                    ...activity,
                    isNow: false,
                  },
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => {
      const isPlayingA = a?.nowPlaying?.isNow ? 1 : 0;
      const isPlayingB = b?.nowPlaying?.isNow ? 1 : 0;
      if (isPlayingA !== isPlayingB) return isPlayingB - isPlayingA;

      return new Date(b?.nowPlaying?.timestamp || 0).getTime() - new Date(a?.nowPlaying?.timestamp || 0).getTime();
    });
  }, [
    hasLoadedHistory,
    historicalByUserId,
    liveNowPlayingByUserId,
    members,
  ]);

  const topFriends = useMemo(() => sortedFriends.slice(0, 3), [sortedFriends]);

  if (topFriends.length === 0) {
    return hasLoadedHistory
      ? null
      : <div ref={reelRef} aria-hidden="true" className="h-px w-full" />;
  }

  return (
    <div
      ref={reelRef}
      className="relative z-10 flex flex-col gap-4 my-6"
      data-circle-activity-count={topFriends.length}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
            Atividade do Círculo
          </h3>
        </div>
        <div className="flex items-center gap-1.5 opacity-30 hover:opacity-100 transition-opacity cursor-default">
           <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Atividade recente</span>
        </div>
      </div>

      <div
        data-home-horizontal-scroll="true"
        className="flex h-[184px] gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 scrolling-touch [contain:layout_paint]"
      >
          {topFriends.map((friend, idx) => {
            if (!friend) return null;
            const isPlaying = friend.nowPlaying?.isNow;
            const track = friend.nowPlaying?.track;
            const trackImage = track?.image || undefined;
            const artistName = track?.artists?.[0] 
              ? (typeof track.artists[0] === 'string' ? track.artists[0] : track.artists[0].name)
              : track?.primaryArtistName || track?.albumArtist || "";
            const userAvatar = coreUtils.getUserAvatar(friend.id, friend.avatar);

            return (
              <motion.div
                key={friend.id}
                data-circle-activity-card={friend.id}
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: idx * 0.035 }}
                className="flex-shrink-0 w-[144px] group cursor-pointer transform-gpu"
                style={{ contentVisibility: idx > 2 ? 'auto' : 'visible', containIntrinsicSize: '144px 180px' }}
                onClick={() => onFriendClick(friend)}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative">
                  {isPlaying && (
                    <div className="absolute -inset-1 rounded-[26px] bg-orange-500/[0.025]" />
                  )}

	                  <div className={clsx(
	                    "relative aspect-[4/5] rounded-[22px] overflow-hidden bg-white/[0.018] transition-[box-shadow,opacity,transform] duration-300 shadow-lg",
	                    isPlaying ? "shadow-[0_16px_40px_rgba(249,115,22,0.1)]" : ""
	                  )}>
	                    <div className="absolute inset-0 z-0">
	                        <div
	                          className="absolute inset-0"
	                        >
	                          <SmartImage
	                            src={trackImage}
	                            className="h-full w-full object-cover opacity-38 transition-[opacity,transform] duration-500 group-hover:scale-[1.06] group-hover:opacity-52"
	                            rounded="none"
	                            fallback=""
	                          />
	                        </div>
	                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-[#0a0a0a]" />
	                    </div>

	                    <div className="absolute inset-0 z-10 p-3.5 flex flex-col justify-between">
	                      <div className="flex items-center gap-2">
	                        <div className="relative">
	                          <div className={clsx(
	                            "h-7 w-7 rounded-full border-2 p-0.5 overflow-hidden transition-[border-color,box-shadow,opacity,transform] duration-300",
	                            isPlaying ? "border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" : "border-white/10"
	                          )}>
	                            <SmartImage src={userAvatar} className="h-full w-full object-cover rounded-full" rounded="full" fallback="" />
	                          </div>
	                          {isPlaying && (
	                            <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-black/80 flex items-center justify-center border border-white/10">
	                              <EqualizerIcon active={shouldAnimate} />
	                            </div>
	                          )}
	                        </div>
	                        <div className="flex flex-col min-w-0">
	                          <span className="text-[9.5px] font-black text-white truncate leading-none mb-0.5 group-hover:text-orange-400 transition-colors">
	                            {friend.name.split(' ')[0]}
	                          </span>
	                          <span className="text-[7px] font-bold text-white/40 uppercase tracking-widest leading-none">
	                            {isPlaying ? "Ouvindo agora" : coreUtils.getTimeAgoSmart(new Date(friend.nowPlaying?.timestamp || 0))}
	                          </span>
	                        </div>
	                      </div>

	                        <motion.div
	                          className="flex flex-col gap-1"
	                          animate={{ opacity: 1, y: 0 }}
	                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
	                        >
	                          <div
	                            className="flex flex-col min-w-0"
	                            onClick={(e) => {
	                              e.stopPropagation();
	                              if (track) onTrackClick(track);
	                            }}
	                          >
	                            <h4 className="text-[11px] font-bold text-white leading-tight line-clamp-2 mix-blend-plus-lighter">
	                              {track?.name}
	                            </h4>
	                            {artistName && (
	                              <p className="text-[8.5px] font-medium text-white/50 truncate leading-tight mt-0.5">
	                                {artistName}
	                              </p>
	                            )}
	                          </div>

	                          <div className="flex items-center gap-2 mt-0.5">
	                            <MusicPlatformBadge platform={friend.platform} variant="minimal" />
	                            {isPlaying && (
	                              <div className="px-1.5 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/[0.055] flex items-center gap-1 shadow-[0_0_8px_rgba(249,115,22,0.05)]">
	                                <div className="relative flex h-1 w-1">
	                                  <motion.span
	                                    animate={shouldAnimate ? { scale: [1, 1.8, 1], opacity: [1, 0.4, 1] } : { scale: 1, opacity: 0.65 }}
	                                    transition={shouldAnimate ? { duration: 2, repeat: Infinity } : { duration: 0.16 }}
	                                    className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"
	                                  />
	                                  <span className="relative inline-flex rounded-full h-1 w-1 bg-orange-500" />
	                                </div>
	                                <span className="text-[6px] font-black text-white uppercase tracking-widest">Live</span>
	                              </div>
	                            )}
	                          </div>
	                        </motion.div>
	                    </div>

	                    <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.04] to-transparent pointer-events-none" />
	                  </div>
	                </div>
	              </motion.div>
            );
          })}
        {/* View All Card */}
        <motion.div
          className="flex-shrink-0 w-[70px] h-full flex flex-col items-center justify-center gap-2.5 cursor-pointer group pr-4"
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onViewAll?.()}
        >
          <div className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center transition-[background-color,border-color,transform] group-hover:bg-white/10 group-hover:border-orange-500/50">
            <motion.div
              animate={shouldAnimate ? { x: [0, 3, 0] } : { x: 0 }}
              transition={shouldAnimate ? { duration: 2, repeat: Infinity } : { duration: 0.16 }}
            >
              <Play className="h-3.5 w-3.5 text-white/40 group-hover:text-orange-500 fill-transparent group-hover:fill-orange-500/20" />
            </motion.div>
          </div>
          <span className="text-[7.5px] font-black text-white/30 uppercase tracking-[0.2em] text-center leading-tight"> Ver<br/>Todos</span>
        </motion.div>
      </div>
    </div>
  );
};
