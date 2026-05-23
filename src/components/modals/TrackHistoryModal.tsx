/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, History, Users, RefreshCcw } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';
import { statsService } from '../../services/statsService';
import { coreUtils } from '../../services/statsCore';
import { clsx } from 'clsx';

interface TrackHistoryModalProps {
  track: any;
  onClose: () => void;
}

export const TrackHistoryModal: React.FC<TrackHistoryModalProps> = ({ track, onClose }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        const data = await statsService.getTrackGlobalHistory(track.id || track.spotifyId || track.appleMusicId);
        setHistory(data);
      } catch (e) {
        console.error("Failed to load global track history", e);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [track.id, track.spotifyId, track.appleMusicId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-[#080808] w-full max-w-lg rounded-[40px] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header BG Accent */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full glass border border-white/10 text-white/70 hover:text-white z-20"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-8 pb-4 relative z-10 flex flex-col items-center text-center">
          <div className="relative h-28 w-28 mb-6">
            <div className="absolute -inset-4 rounded-[32px] bg-orange-500/20 blur-2xl animate-pulse" />
            <SmartImage 
              src={track.image || track.album?.image} 
              className="h-full w-full shadow-2xl relative z-10 border border-white/20" 
              rounded="2xl" 
              fallback="🎵"
            />
          </div>
          
          <h2 className="text-xl font-display font-black text-white leading-tight mb-1 line-clamp-1 truncate w-full px-4">
            {track.name}
          </h2>
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-[0.2em] mb-4">
            {track.artists?.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')}
          </p>

          <div className="flex items-center gap-6 bg-white/[0.03] border border-white/5 px-6 py-2.5 rounded-2xl">
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Plays Totais</span>
               <span className="text-[14px] font-black text-orange-500 leading-none">{history.length}</span>
             </div>
             <div className="h-6 w-[1px] bg-white/10" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Ouvintes</span>
               <span className="text-[14px] font-black text-white leading-none">
                 {new Set(history.map(item => item.user?.id || item.userId)).size}
               </span>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
          <div className="flex items-center gap-2 mb-4 px-2">
            <History className="h-3 w-3 text-orange-500" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Fluxo de Reprodução Global</span>
          </div>

          <div className="flex flex-col gap-2 pb-8">
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-16 w-full rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
                ))}
              </div>
            ) : history.length > 0 ? (
              history.map((item, idx) => {
                const user = item.user || { name: 'Membro', avatar: '' };
                return (
                  <motion.div
                    key={`${item.id}-${idx}`}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <SmartImage 
                        src={coreUtils.getUserAvatar(item.userId || user.id, user.avatar)} 
                        className="h-8 w-8 rounded-full border border-white/10"
                        rounded="full"
                        fallback="👤"
                      />
                      <div className="flex flex-col">
                         <span className="text-[11px] font-bold text-white/90">{user.name}</span>
                         <span className="text-[8px] font-medium text-white/40 uppercase tracking-widest">
                           {coreUtils.formatRelativeTimeSP(item.playedAt || item.timestamp)}
                         </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end">
                       <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                          <RefreshCcw className="h-2 w-2 text-orange-500" />
                          <span className="text-[8px] font-black text-orange-500">SYNC</span>
                       </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                 <div className="h-12 w-12 rounded-full border border-dashed border-white/10 flex items-center justify-center opacity-20">
                    <Users className="h-6 w-6" />
                 </div>
                 <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] italic">
                   Nenhum registro global encontrado para esta faixa.
                 </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
