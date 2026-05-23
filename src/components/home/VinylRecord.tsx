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

  const heartbeat = useStatsStore(state => state.heartbeat);

  // Estado para progresso em tempo real sincronizado com o heartbeat
  const realTimeProgress = useMemo(() => {
    if (!isPlaying || !progressMs || !durationMs) return progressMs || 0;
    
    // Calcula quanto tempo passou desde que o heartbeat foi capturado
    const now = Date.now();
    const elapsedSinceLastUpdate = Math.max(0, now - (useStatsStore.getState().lastFetchTime.group || now));
    
    const next = (progressMs || 0) + elapsedSinceLastUpdate;
    return next > durationMs ? durationMs : next;
  }, [progressMs, durationMs, isPlaying, heartbeat]);

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
            radial-gradient(circle at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.55) 19%, transparent 20%),
            radial-gradient(circle at 25% 20%, ${withAlpha(lightColor, 0.50)} 0%, transparent 55%),
            radial-gradient(circle at 75% 80%, ${withAlpha(darkColor, 0.35)} 0%, transparent 50%),
            radial-gradient(circle at 60% 10%, rgba(255,255,255,0.12) 0%, transparent 40%),
            conic-gradient(
              from 0deg,
              ${withAlpha(safeDominantColor, 0.55)} 0deg,
              ${withAlpha(darkColor, 0.38)} 60deg,
              ${withAlpha(safeDominantColor, 0.50)} 120deg,
              ${withAlpha(lightColor, 0.65)} 180deg,
              ${withAlpha(safeDominantColor, 0.50)} 240deg,
              ${withAlpha(darkColor, 0.35)} 300deg,
              ${withAlpha(safeDominantColor, 0.55)} 360deg
            )
          `,
          backdropFilter: 'blur(0px)',
          WebkitBackdropFilter: 'blur(0px)',
          maskImage: 'radial-gradient(circle at center, transparent 4.5%, rgba(0,0,0,0.3) 4.8%, black 5.5%)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 4.5%, rgba(0,0,0,0.3) 4.8%, black 5.5%)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transformOrigin: 'center center',
          willChange: 'transform'
        }}
        animate={
          isPlaying && !prefersReducedMotion
            ? { rotate: 360 }
            : { rotate: [-1.5, 1.5, -1.5] }
        }
        transition={
          isPlaying && !prefersReducedMotion
            ? { duration: 2.5, repeat: Infinity, ease: 'linear' }
            : { duration: 10, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {/* Grooves — menos sulcos, mais espaçados */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full mix-blend-overlay pointer-events-none"
          style={{ opacity: isPlaying ? 0.5 : 0.2 }}
        >
          {Array.from({ length: 18 }, (_, i) => (
            <circle
              key={`${uniqueId}-groove-${i}`}
              cx="50" cy="50"
              r={46 - i * 2.0}
              fill="none"
              stroke="#fff"
              strokeWidth={i % 4 === 0 ? 0.28 : 0.14}
              opacity={0.85 - i * 0.03}
            />
          ))}
          {/* Anel separador label */}
          <circle cx="50" cy="50" r="27" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        </svg>

        {/* Glow pulsing effect wrapping the album cover */}
        {isPlaying && (
          <motion.div
            className="absolute inset-[24%] rounded-full z-15 pointer-events-none filter blur-md"
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

        {/* Album Cover — maior */}
        <div
          className="absolute inset-[24%] rounded-full overflow-hidden z-20 shadow-2xl flex items-center justify-center bg-stone-900"
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
              className="absolute inset-0 pointer-events-none rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.35) 25%, transparent 50%, rgba(255,255,255,0.15) 75%, transparent 100%)',
                mixBlendMode: 'overlay',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: shimmerSpeed, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>
      </motion.div>

      {/* Tonearm — ângulos corretos */}
      <motion.div
        className="absolute right-[-14%] top-[4%] w-[48%] h-[6%] pointer-events-none z-30"
        style={{ transformOrigin: '90% 50%', willChange: 'transform' }}
        animate={{ rotate: isPlaying ? 20 : -32 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="relative w-full h-full">
          <div
            className="absolute rounded-full"
            style={{
              background: 'linear-gradient(90deg, #3f3f46 0%, #a1a1aa 40%, #d4d4d8 60%, #71717a 100%)',
              height: '35%',
              top: '32%',
              left: '5%',
              right: '10%',
              boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}
          />
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: '9%',
              height: '210%',
              background: 'radial-gradient(circle at 40% 35%, #d4d4d8, #52525b)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}
          />
          <div
            className="absolute left-[4%] top-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: '4%',
              height: '150%',
              background: 'linear-gradient(180deg, #fb7185 0%, #f43f5e 100%)',
              boxShadow: '0 0 5px rgba(244,63,94,0.7)',
            }}
          />
        </div>
      </motion.div>

            ? { rotate: 360 }
            : { rotate: [-1.5, 1.5, -1.5] }
        }
        transition={
          isPlaying && !prefersReducedMotion
            ? { duration: 2.5, repeat: Infinity, ease: 'linear' }
            : { duration: 10, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {/* Grooves / Sulcos concêntricos */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full mix-blend-overlay pointer-events-none"
          style={{ opacity: groovesOpacity + 0.1 }}
        >
          {Array.from({ length: 24 }, (_, i) => {
            const radius = 47 - i * 1.6;
            const strokeWidth = i % 3 === 0 ? 0.3 : 0.2;
            return (
              <circle
                key={`${uniqueId}-groove-${i}`}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#fff"
                strokeWidth={strokeWidth}
                opacity={0.9 - i * 0.03}
              />
            );
          })}

          {/* Buraco central - apenas um detalhe de borda já que a máscara corta o meio */}
          <circle cx="50" cy="50" r="3.7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        </svg>

        {/* Glow pulsing effect wrapping the album cover */}
        {isPlaying && (
          <motion.div
            className="absolute inset-[24%] rounded-full z-15 pointer-events-none filter blur-md"
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
          className="absolute inset-[26%] rounded-full overflow-hidden z-20 shadow-2xl flex items-center justify-center bg-stone-900"
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
              className="absolute inset-0 pointer-events-none rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.35) 25%, transparent 50%, rgba(255,255,255,0.15) 75%, transparent 100%)',
                mixBlendMode: 'overlay',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: shimmerSpeed, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>
      </motion.div>

      {/* Tonearm */}
      <motion.div
        className="absolute right-[-14%] top-[4%] w-[48%] h-[6%] pointer-events-none z-30"
        style={{ transformOrigin: '90% 50%', willChange: 'transform' }}
        animate={{ rotate: isPlaying ? -45 : 28 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="relative w-full h-full">
          {/* Corpo do braço — mais fino e com gradiente metálico */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #3f3f46 0%, #a1a1aa 40%, #d4d4d8 60%, #71717a 100%)',
              height: '40%',
              top: '30%',
              boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}
          />
          {/* Pivô no lado direito */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: '10%',
              height: '220%',
              background: 'radial-gradient(circle at 40% 40%, #d4d4d8, #52525b)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}
          />
          {/* Agulha (stylus) — ponta fina na esquerda */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: '5%',
              height: '160%',
              background: 'linear-gradient(180deg, #fb7185 0%, #f43f5e 100%)',
              boxShadow: '0 0 4px rgba(244,63,94,0.6)',
            }}
          />
        </div>
      </motion.div>

    </div>
  );
};
