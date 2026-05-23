import React, { useState, useRef } from 'react';
import { Share2, Download, Check, Loader2, Palette, ChevronRight, Layout } from 'lucide-react';
import { snapshotService, ShareTemplate } from '../../services/snapshotService';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

interface ShareButtonProps {
  targetRef: React.RefObject<HTMLElement>;
  title?: string;
  className?: string;
  variant?: 'minimal' | 'ghost' | 'glass';
}

const TEMPLATES: { id: ShareTemplate; name: string; color: string }[] = [
  { id: 'glass', name: 'Glass', color: 'bg-white/10' },
  { id: 'minimal', name: 'Minimal', color: 'bg-gray-500/20' },
  { id: 'bold', name: 'Bold', color: 'bg-orange-500' },
  { id: 'neon', name: 'Neon', color: 'bg-purple-600' },
];

export const ShareButton: React.FC<ShareButtonProps> = ({ 
  targetRef, 
  title, 
  className,
  variant = 'ghost' 
}) => {
  const [status, setStatus] = useState<'idle' | 'selecting' | 'capturing' | 'shared' | 'error'>('idle');
  const [activeTemplate, setActiveTemplate] = useState<ShareTemplate>('glass');
  const menuRef = useRef<HTMLDivElement>(null);

  const startCapture = async (template: ShareTemplate) => {
    if (!targetRef.current) return;
    
    setStatus('capturing');
    setActiveTemplate(template);
    
    try {
      const dataUrl = await snapshotService.captureElement(
        targetRef.current, 
        template, 
        title || 'Stats Snap'
      );

      if (dataUrl) {
        const shared = await snapshotService.shareImage(dataUrl, title);
        setStatus(shared ? 'shared' : 'idle');
        if (shared) {
          setTimeout(() => setStatus('idle'), 3000);
        }
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'capturing') return;
    setStatus(status === 'selecting' ? 'idle' : 'selecting');
  };

  return (
    <div className="relative inline-flex">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleMenu}
        disabled={status === 'capturing'}
        className={clsx(
          "relative flex items-center justify-center transition-all p-2 rounded-xl border z-10",
          variant === 'ghost' && "bg-white/5 border-white/10 hover:bg-white/10 text-white/50 hover:text-white",
          variant === 'minimal' && "bg-transparent border-transparent text-white/30 hover:text-white",
          variant === 'glass' && "glass border-white/20 text-white shadow-xl",
          status === 'shared' && "border-green-500/50 text-green-500",
          status === 'error' && "border-red-500/50 text-red-500",
          status === 'selecting' && "bg-white/10 border-white/30 text-white",
          className
        )}
        title="Estilo de Compartilhamento"
      >
        <AnimatePresence mode="wait">
          {status === 'capturing' ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="h-4 w-4" />
            </motion.div>
          ) : status === 'shared' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
          ) : status === 'selecting' ? (
            <motion.div key="selecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Layout className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Share2 className="h-4 w-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {status === 'selecting' && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            className="absolute right-full mr-2 top-0 glass-card p-1.5 rounded-2xl border border-white/10 flex items-center gap-1 shadow-2xl z-20 whitespace-nowrap"
          >
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={(e) => {
                  e.stopPropagation();
                  startCapture(t.id);
                }}
                className="group relative flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
                title={t.name}
              >
                <div className={clsx("h-6 w-6 rounded-lg border border-white/20 transition-transform group-hover:scale-110", t.color)} />
                <span className="text-[7px] font-black uppercase text-white/40 group-hover:text-white/80">{t.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
