import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Image as ImageIcon, Share2, Trash2, Calendar, Clock } from 'lucide-react';
import { snapshotService, SnapshotItem } from '../../services/snapshotService';
import { clsx } from 'clsx';
import { coreUtils } from '../../services/statsCore';

interface SnapshotHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SnapshotHistoryModal: React.FC<SnapshotHistoryModalProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<SnapshotItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(snapshotService.getHistory());
    }
  }, [isOpen]);

  const handleShare = async (item: SnapshotItem) => {
    await snapshotService.shareImage(item.dataUrl, item.title);
  };

  const handleDelete = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('stats_snapshot_history', JSON.stringify(updated));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl glass-card rounded-[40px] border border-white/10 overflow-hidden bg-black/40 flex flex-col max-h-[80vh]"
      >
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-500/20 flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Galeria de Snaps</h2>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-0.5">Últimos snapshots gerados</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5 text-white/50" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <ImageIcon className="h-10 w-10 text-white/10" />
              </div>
              <p className="text-white/30 font-bold max-w-xs uppercase tracking-widest text-xs">
                Nenhum snapshot encontrado. Compartilhe seus cards para salvar aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {history.map((item) => (
                <motion.div 
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative flex flex-col rounded-3xl overflow-hidden bg-white/[0.03] border border-white/5"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-black/20">
                    <img 
                      src={item.dataUrl} 
                      alt={item.title} 
                      className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-tight line-clamp-1">{item.title}</span>
                      <div className="flex items-center gap-2 text-[8px] text-white/30 uppercase font-bold">
                         <span className="flex items-center gap-1"><Calendar className="h-2 w-2" /> {new Date(item.timestamp).toLocaleDateString()}</span>
                         <span className="flex items-center gap-1"><Clock className="h-2 w-2" /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => handleShare(item)}
                        className="p-2 rounded-xl bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white transition-all"
                       >
                         <Share2 className="h-3.5 w-3.5" />
                       </button>
                       <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all"
                       >
                         <Trash2 className="h-3.5 w-3.5" />
                       </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
