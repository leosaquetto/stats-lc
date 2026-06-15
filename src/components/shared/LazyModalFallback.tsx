import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useModalMotionScope } from '../../hooks/useModalMotionScope';
import { EngineSpinner } from './CommonUI';

export const LazyModalFallback = ({ label = 'Abrindo detalhe' }: { label?: string }) => {
  useModalMotionScope();

  return (
    <motion.div
      data-stats-lc-modal-surface="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[120] flex h-[100svh] min-h-[100svh] items-center justify-center overflow-hidden bg-black/72 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+84px)] pt-[env(safe-area-inset-top,0px)]"
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.22, delay: 0.02, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-center gap-3"
      >
        <div className="ranking-badge flex h-14 min-w-14 items-center justify-center rounded-[21px] border border-orange-500/35 bg-orange-500/[0.16] px-4 shadow-[0_0_30px_rgba(249,115,22,0.22),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <EngineSpinner className="h-5 w-5 text-orange-300">
            <Loader2 className="h-full w-full" />
          </EngineSpinner>
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-200/68">{label}</span>
      </motion.div>
    </motion.div>
  );
};
