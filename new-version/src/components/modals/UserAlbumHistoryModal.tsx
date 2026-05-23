/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Disc, 
  Search, 
  History, 
  TrendingUp, 
  Award,
  Music4
} from 'lucide-react';
import { statsService } from '../../services/statsService';
import { coreUtils } from '../../services/statsCore';
import { SmartImage } from '../shared/CommonUI';
import { AlbumDetailModal } from './AlbumDetailModal'; // Import existing album detail modal

interface UserAlbumHistoryModalProps {
  user: any;
  onClose: () => void;
}

export const UserAlbumHistoryModal = ({ 
  user, 
  onClose 
}: UserAlbumHistoryModalProps) => {
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'lifetime'>('month');
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);

  const fetchAlbumHistory = async () => {
    setLoading(true);
    try {
      const items = await statsService.getTopItems(user.id, 'albums', period);
      
      // Transform & unify fields to be totally resilient
      const mapped = (items || []).map((al: any) => ({
        id: al.album?.id || al.id,
        name: al.album?.name || al.name,
        image: al.album?.image || al.image,
        playCount: al.playcount || al.streams || al.playCount || 0,
        artistName: al.artist?.name || al.artistName || (al.album?.artists?.[0]?.name) || "Vários Artistas"
      }));

      setAlbums(mapped);
    } catch (e) {
      console.error("Failed to fetch user album history", e);
      setAlbums([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbumHistory();
  }, [user.id, period]);

  const filteredAlbums = useMemo(() => {
    if (!search) return albums;
    const query = search.toLowerCase();
    return albums.filter(al => 
      (al.name || "").toLowerCase().includes(query) || 
      (al.artistName || "").toLowerCase().includes(query)
    );
  }, [albums, search]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/90 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-[#050505] w-full max-w-lg h-[88vh] rounded-t-[48px] overflow-hidden border-t border-white/5 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-8 pb-4 flex flex-col shrink-0">
           <div className="flex items-center justify-between w-full">
             <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  <SmartImage 
                    src={coreUtils.getUserAvatar(user.id, user.avatar)} 
                    className="h-12 w-12 rounded-full border-2 border-orange-500/30" 
                    fallback="" 
                    rounded="full"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-orange-600 border border-black h-5 w-5 rounded-full flex items-center justify-center text-[9px] text-white">
                    <Disc className="h-3 w-3 animate-spin duration-3000" />
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                    <h2 className="text-lg font-mundial font-bold text-white truncate">{user.name}</h2>
                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-[0.15em] flex items-center gap-1">
                      <History className="h-3 w-3" /> Histórico de Álbuns
                    </span>
                </div>
             </div>
             <button 
               onClick={onClose} 
               className="h-10 w-10 glass rounded-full flex items-center justify-center text-white/55 hover:text-white/95 transition-colors border border-white/5 text-xl"
             >
               ×
             </button>
           </div>

           {/* Ranges Tabs */}
           <div className="flex gap-2.5 mt-5">
              {(['week', 'month', 'year', 'lifetime'] as const).map((p) => {
                const label = p === 'week' ? '7D' : p === 'month' ? '30D' : p === 'year' ? '1A' : 'Tudo';
                const isActive = period === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`flex-1 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      isActive 
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30' 
                        : 'bg-white/[0.02] border border-white/5 text-white/50 hover:bg-white/[0.05] hover:text-white/90'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
           </div>

           {/* Search Field */}
           <div className="pt-4">
             <div className="relative">
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar álbum ou artista..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-xs font-semibold text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-white">
                  <Search className="h-4 w-4" />
                </div>
                {search && (
                  <button 
                    onClick={() => setSearch("")} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs font-semibold"
                  >
                    limpar
                  </button>
                )}
             </div>
           </div>
        </div>

        {/* Albuns Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-6 py-2 pb-10 custom-scrollbar">
           {loading ? (
             <div className="flex flex-col gap-3.5 py-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-20 w-full bg-white/[0.02] border border-white/5 rounded-3xl animate-pulse flex items-center px-4 gap-4">
                    <div className="h-5 w-5 bg-white/5 rounded-full" />
                    <div className="h-12 w-12 bg-white/5 rounded-2xl" />
                    <div className="flex flex-col flex-1 gap-2">
                      <div className="h-3 w-1/2 bg-white/5 rounded-full" />
                      <div className="h-2 w-1/3 bg-white/5 rounded-full" />
                    </div>
                  </div>
                ))}
             </div>
           ) : filteredAlbums.length > 0 ? (
             <div className="flex flex-col gap-3 py-4">
                {filteredAlbums.map((album, idx) => {
                  const hasImage = !!album.image;
                  return (
                    <motion.div 
                      key={`${album.id}-${idx}`}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: Math.min(idx * 0.05, 0.3), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => setSelectedAlbum(album)}
                      className="flex items-center gap-4 p-3 bg-white/[0.01] border border-white/5 rounded-3xl hover:bg-white/[0.04] transition-all cursor-pointer group active:scale-[0.99]"
                    >
                      {/* Rank Number */}
                      <span className="text-[11px] font-black font-mono text-white/25 w-6 text-center group-hover:text-orange-500 transition-colors">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>

                      {/* Cover Art */}
                      <div className="relative shrink-0 h-14 w-14 rounded-2xl overflow-hidden bg-stone-900 border border-white/10 shadow-md">
                         <SmartImage 
                           src={album.image} 
                           className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                           fallback="" 
                           rounded="2xl" 
                         />
                      </div>

                      {/* Name & Artist */}
                      <div className="flex flex-col flex-1 min-w-0">
                         <span className="text-xs font-black text-white/90 truncate leading-tight group-hover:text-orange-400 transition-colors">
                           {album.name || "Álbum Desconhecido"}
                         </span>
                         <span className="text-[10px] font-bold text-white/40 truncate mt-0.5">
                           {album.artistName || "Desconhecido"}
                         </span>
                      </div>

                      {/* Plays Badge */}
                      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-full group-hover:bg-orange-500/10 group-hover:border-orange-500/20 shrink-0 transition-all">
                        <TrendingUp className="h-3 w-3 text-white/40 group-hover:text-orange-500" />
                        <span className="text-[10px] font-black text-white/80 group-hover:text-orange-400 font-mono">
                          {coreUtils.formatNumber(album.playCount)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
             </div>
           ) : (
             <div className="py-20 text-center glass rounded-[32px] border-dashed border-white/10 flex flex-col items-center">
                <Music4 className="h-10 w-10 text-white/20 mb-3" />
                <span className="text-xs font-bold text-white/40">Sem álbuns nesse período</span>
             </div>
           )}
        </div>
      </motion.div>

      {/* Internal Album Detail Transition Layer */}
      <AnimatePresence>
        {selectedAlbum && (
          <AlbumDetailModal 
            user={user}
            album={selectedAlbum}
            onClose={() => setSelectedAlbum(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
