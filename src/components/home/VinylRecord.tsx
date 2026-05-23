import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Disc } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { SmartImage } from '../shared/CommonUI';

interface VinylRecordProps {
  albumImage: string;
  dominantColor: string;
  isPlaying: boolean;
  progressMs?: number;
  durationMs?: number;
  onClick?: () => void;
}

export const VinylRecord = ({ 
  albumImage, 
  dominantColor, 
  isPlaying, 
  progressMs,
  durationMs,
  onClick 
}: VinylRecordProps) => {
  // Estado para progresso em tempo real
  const [realTimeProgress, setRealTimeProgress] = useState(progressMs || 0);

  useEffect(() => {
    setRealTimeProgress(progressMs || 0);
    if (!isPlaying || !progressMs || !durationMs) return;

    const interval = setInterval(() => {
      setRealTimeProgress(prev => {
        const next = prev + 1000;
        return next > durationMs ? durationMs : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [progressMs, durationMs, isPlaying]);

  // Razão atual de progresso
  const currentRatio = useMemo(() => {
    if (!durationMs || !realTimeProgress) return 0.5;
    return Math.min(1, Math.max(0, realTimeProgress / durationMs));
  }, [realTimeProgress, durationMs]);

  // Tempo do batimento cardíaco da música (BPM)
  // No início, a música pulsa mais suave (ex: 1.4s período), e próximo do fim pulsa mais rápido (ex: 0.7s período)
  const beatDuration = useMemo(() => {
    return 1.4 - currentRatio * 0.7; // de 1.4s até 0.7s
  }, [currentRatio]);

  // Intensidade da pulsação
  const pulseScale = useMemo(() => {
    return 1.05 + currentRatio * 0.05; // 1.05 a 1.10
  }, [currentRatio]);

  const pulseOpacity = useMemo(() => {
    return 0.45 + currentRatio * 0.25; // 0.45 a 0.70
  }, [currentRatio]);

  // O brilho/shimmer corre na diagonal, cruzando a arte do álbum mais rápido no final da faixa
  const shimmerDuration = useStatsStore(state => state.shimmerDuration) ?? 2.8;
  const shimmerSpeed = useMemo(() => {
    return shimmerDuration - currentRatio * (shimmerDuration / 2); // de shimmerDuration até shimmerDuration/2
  }, [currentRatio, shimmerDuration]);

  return (
    <div 
      className="relative w-full aspect-square flex items-center justify-center rounded-full cursor-pointer"
      onClick={onClick}
    >
      {/* O CORPO NEGRO DO VINIL - Usando wrapper para rotação isolada */}
      <div
        className={`absolute inset-0 rounded-full shadow-2xl z-10 flex items-center justify-center border border-white/10 bg-[#050505] animate-spin-vinyl`}
        style={{
          background: `radial-gradient(circle at center, transparent 0%, transparent 30%, rgba(5, 5, 5, 0.6) 31%),
          conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.05) 45deg, transparent 90deg, rgba(255,255,255,0.05) 135deg, transparent 180deg, rgba(255,255,255,0.05) 225deg, transparent 270deg, rgba(255,255,255,0.05) 315deg, transparent 360deg)`,
          animationPlayState: isPlaying ? 'running' : 'paused',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transformOrigin: 'center center'
        }}
      >
        {/* Grooves / Sulcos */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-40 mix-blend-overlay pointer-events-none">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#fff" strokeWidth="0.2" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" strokeWidth="0.3" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#fff" strokeWidth="0.2" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="#fff" strokeWidth="0.4" />
        </svg>

        {/* Glow pulsing effect wrapping the album cover */}
        {isPlaying && (
          <motion.div
            className="absolute inset-[28%] rounded-full z-15 pointer-events-none filter blur-md"
            style={{
              background: dominantColor ? dominantColor : 'rgba(234, 88, 12, 0.5)',
            }}
            animate={{
              scale: [0.98, pulseScale, 0.98],
              opacity: [0.3, pulseOpacity, 0.3],
            }}
            transition={{
              duration: beatDuration,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}

        {/* Capa do Álbum */}
        <div 
          className="absolute inset-[30%] rounded-full overflow-hidden z-20 border-[3px] border-black/80 shadow-inner flex items-center justify-center bg-stone-900"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={albumImage || 'placeholder'}
              className="w-full h-full absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {albumImage ? (
                <div className="w-full h-full relative">
                  <SmartImage 
                    src={albumImage}
                    className="w-full h-full object-cover"
                    fallback="💿"
                    rounded="full"
                  />
                  {/* Subtle Overlay to blend with vinyl */}
                  <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900 z-10">
                   <div className="w-2/3 h-2/3 rounded-full border border-white/5 bg-stone-800 flex items-center justify-center shadow-lg">
                      <Disc className="w-1/2 h-1/2 text-white/20 animate-pulse-slow" />
                   </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          {isPlaying && (
            <motion.div
              className="absolute inset-0 pointer-events-none mix-blend-overlay rounded-full"
              style={{
                background: 'linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                width: '200%',
                height: '200%',
                top: '-50%',
                left: '-50%'
              }}
              animate={{
                x: ['-50%', '50%'],
                y: ['-50%', '50%']
              }}
              transition={{
                duration: shimmerSpeed,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          )}
        </div>
      </div>
      
    </div>
  );
};

