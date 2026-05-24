
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Music, Clock, Music2 } from 'lucide-react';
import { SmartImage, MusicPlatformBadge } from '../shared/CommonUI';
import { BassPulseIcon } from '../shared/BassPulseIcon';
import { coreUtils } from '../../services/statsCore';
import { useStatsStore } from '../../store/useStatsStore';

interface CircleActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackClick: (track: any) => void;
  onFriendClick: (friend: any) => void;
}

export const CircleActivityModal: React.FC<CircleActivityModalProps> = ({
  isOpen,
  onClose,
  onTrackClick,
  onFriendClick
}) => {
  const { groupStats, hiddenUsers } = useStatsStore();
  
  const allMembers = groupStats?.members || [];
  const members = allMembers.filter(m => !hiddenUsers.includes(m.id));
  
  // Ordenar por quem está ouvindo agora ou por timestamp mais recente
  const sortedFriends = [...members].sort((a, b) => {
    const isPlayingA = a.nowPlaying?.isNow ? 1 : 0;
    const isPlayingB = b.nowPlaying?.isNow ? 1 : 0;
    
    if (isPlayingA !== isPlayingB) return isPlayingB - isPlayingA;
    
    const timeA = new Date(a.nowPlaying?.timestamp || 0).getTime();
    const timeB = new Date(b.nowPlaying?.timestamp || 0).getTime();
    return timeB - timeA;
  });

  const handleAvatarClick = (e: React.MouseEvent, friend: any) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('openHistory', { detail: friend }));
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ y: "100%", opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-lg bg-[#0a0a0a] rounded-t-[32px] overflow-hidden border border-white/10 flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-white/5 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-20">
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-white leading-tight">Atividade do Círculo</h3>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mt-1">Explorar Reproduções Ativas</p>
              </div>
              <button 
                onClick={onClose}
                className="h-10 w-10 rounded-full glass border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5 text-white/60" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="flex flex-col gap-3">
                {sortedFriends.map((friend, idx) => {
                  const isPlaying = friend.nowPlaying?.isNow;
                  const trackSymbol = isPlaying ? <Play className="h-2.5 w-2.5 fill-orange-500 text-orange-500" /> : <Clock className="h-2.5 w-2.5 text-white/30" />;
                  const hasTrack = friend.nowPlaying?.track;
                  
                  return (
                    <motion.div
                      key={friend.id}
                      initial={{ opacity: 0, scale: 0.9, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ 
                        delay: idx * 0.04,
                        type: "spring",
                        stiffness: 300,
                        damping: 25
                      }}
                      className="group flex items-center gap-4 p-3 rounded-2xl glass border border-white/5 hover:border-orange-500/30 hover:bg-white/[0.04] transition-all cursor-pointer"
                      onClick={() => onFriendClick(friend)}
                    >
                      {/* User Avatar */}
                      <div 
                        className="relative shrink-0"
                        onClick={(e) => handleAvatarClick(e, friend)}
                      >
                        <div className={`h-14 w-14 rounded-full border-2 p-0.5 overflow-hidden transition-all duration-500 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] ${isPlaying ? 'border-orange-500' : 'border-white/10'}`}>
                          <SmartImage 
                            src={coreUtils.getUserAvatar(friend.id, friend.avatar)} 
                            className="h-full w-full object-cover rounded-full" 
                            rounded="full" 
                            fallback="" 
                          />
                        </div>
                        {isPlaying && (
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-orange-500 rounded-full flex items-center justify-center border border-black shadow-[0_0_10px_rgba(249,115,22,0.5)]">
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                               <Play className="h-2.5 w-2.5 fill-white text-white translate-x-[0.5px]" />
                            </motion.div>
                          </div>
                        )}
                      </div>

                      {/* Track Info */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5 relative">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[12px] font-black text-white group-hover:text-orange-400 transition-colors">{friend.name}</span>
                        </div>

                        <div
                          className="flex flex-col min-w-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasTrack) {
                              onTrackClick(friend.nowPlaying.track);
                            }
                          }}
                        >
                          {hasTrack ? (
                            <>
                              <span className="text-[11px] font-bold text-white/90 truncate leading-tight group-hover:underline">
                                {friend.nowPlaying.track.name}
                              </span>
                              <span className="text-[9px] font-medium text-white/30 truncate">
                                {friend.nowPlaying.track.artists?.[0] ? (
                                  typeof friend.nowPlaying.track.artists[0] === 'string'
                                    ? friend.nowPlaying.track.artists[0]
                                    : (friend.nowPlaying.track.artists[0] as any).name
                                ) : "Artista Desconhecido"}
                              </span>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 py-0.5">
                              <Music2 className="h-3 w-3 text-white/10" />
                              <span className="text-[10px] font-medium text-white/20 italic tracking-wide">
                                Nenhuma atividade capturada
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Badge Live - Posicionado no canto inferior direito */}
                        {isPlaying && (
                          <div className="absolute bottom-0 right-0 flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                            <BassPulseIcon />
                            <span className="text-[7.5px] font-black text-orange-500 uppercase tracking-wider">
                              Live
                            </span>
                          </div>
                        )}

                        {/* Badge de tempo - quando não está live */}
                        {!isPlaying && hasTrack && (
                          <div className="absolute bottom-0 right-0 flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/5">
                            <Clock className="h-2.5 w-2.5 text-white/30" />
                            <span className="text-[7.5px] font-black text-white/40 uppercase tracking-wider">
                              {coreUtils.getTimeAgoSmart(new Date(friend.nowPlaying?.timestamp || 0))}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 pl-2 opacity-40 group-hover:opacity-100 transition-opacity">
                         <MusicPlatformBadge platform={friend.platform} variant="minimal" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-white/[0.02] border-t border-white/5 flex flex-col gap-2">
               <p className="text-[9px] font-black text-center text-white/20 uppercase tracking-[0.3em]">Círculo de Amigos • Atualizado em Tempo Real</p>
               <p className="text-[8px] font-medium text-center text-white/15 uppercase tracking-[0.2em]">Powered by stats.fm</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
