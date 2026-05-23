import { useMemo, useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Disc } from 'lucide-react';
import { useStatsStore } from '../../store/useStatsStore';
import { SmartImage } from '../shared/CommonUI';
import { adjustBrightness, normalizeColor, withAlpha } from '../../lib/colorUtils';

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
  const uniqueId = useId();

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

  // O brilho/shimmer corre na diagonal
  const shimmerDuration = useStatsStore(state => state.shimmerDuration) ?? 2.8;
  const shimmerSpeed = useMemo(() => {
    return shimmerDuration - currentRatio * (shimmerDuration / 2);
  }, [currentRatio, shimmerDuration]);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // Derive color variations
  const safeDominantColor = useMemo(() => normalizeColor(dominantColor, '#ea580c'), [dominantColor]);
  const darkColor = useMemo(() => adjustBrightness(safeDominantColor, -0.4), [safeDominantColor]);
  const lightColor = useMemo(() => adjustBrightness(safeDominantColor, 0.3), [safeDominantColor]);

  // Grooves opacity based on playing state
  const groovesOpacity = isPlaying ? 0.6 : 0.3;

  return (
    <div
      className="relative w-full aspect-square flex items-center justify-center rounded-full cursor-pointer"
      onClick={onClick}
    >
      {/* Vinyl Disc Body */}
      <motion.div
        className="absolute inset-0 rounded-full shadow-2xl z-10 flex items-center justify-center border border-white/10"
        style={{
          background: `
            radial-gradient(circle at center, #000 0%, #000 28%, transparent 29%),
            conic-gradient(
              from 0deg,
              ${safeDominantColor} 0deg,
              ${darkColor} 60deg,
              ${safeDominantColor} 120deg,
              ${lightColor} 180deg,
              ${safeDominantColor} 240deg,
              ${darkColor} 300deg,
              ${safeDominantColor} 360deg
            ),
            radial-gradient(circle at center, #0a0a0a 0%, #050505 100%)
          `,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transformOrigin: 'center center'
        }}
        animate={
          isPlaying && !prefersReducedMotion
            ? { rotate: 360 }
            : { scale: [0.985, 1.015, 0.985] }
        }
        transition={
          isPlaying && !prefersReducedMotion
            ? { duration: 2.5, repeat: Infinity, ease: 'linear' }
            : { duration: 8, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {/* Grooves / Sulcos concêntricos */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full mix-blend-overlay pointer-events-none"
          style={{ opacity: groovesOpacity }}
        >
          {Array.from({ length: 20 }, (_, i) => {
            const radius = 46 - i * 1.8;
            const strokeWidth = i % 3 === 0 ? 0.25 : 0.15;
            return (
              <circle
                key={`${uniqueId}-groove-${i}`}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#fff"
                strokeWidth={strokeWidth}
                opacity={0.8 - i * 0.03}
              />
            );
          })}
        </svg>

        {/* Glow pulsing effect wrapping the album cover */}
        {isPlaying && (
          <motion.div
            className="absolute inset-[28%] rounded-full z-15 pointer-events-none filter blur-md"
            style={{
              background: withAlpha(safeDominantColor, 0.5),
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

        {/* Album Cover */}
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
      </motion.div>

      {/* Tonearm */}
      <motion.div
        className="absolute right-[-18%] top-[8%] w-[46%] h-[8%] pointer-events-none z-30 opacity-90 sm:opacity-100"
        style={{
          transformOrigin: '85% 50%',
        }}
        animate={{
          rotate: isPlaying ? 18 : -28
        }}
        transition={{
          duration: 1.2,
          ease: [0.16, 1, 0.3, 1]
        }}
      >
        {/* Tonearm body */}
        <div className="relative w-full h-full">
          <div
            className="absolute inset-0 rounded-full shadow-lg"
            style={{
              background: 'linear-gradient(90deg, #52525b 0%, #71717a 50%, #52525b 100%)',
            }}
          />
          {/* Stylus */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-[8%] h-[140%] rounded-full shadow-md"
            style={{
              background: 'linear-gradient(180deg, #fb7185 0%, #f43f5e 100%)',
            }}
          />
        </div>
      </motion.div>

    </div>
  );
};
