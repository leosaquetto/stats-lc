/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useId } from 'react';
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
  hideTonearm?: boolean;
}

export const VinylRecord = ({
  albumImage,
  dominantColor,
  isPlaying,
  progressMs,
  durationMs,
  onClick,
  hideTonearm = false
}: VinylRecordProps) => {
  const uniqueId = useId();
  const heartbeat = useStatsStore(state => state.heartbeat);

  const realTimeProgress = useMemo(() => {
    if (!isPlaying || !progressMs || !durationMs) return progressMs || 0;
    const now = Date.now();
    const elapsedSinceLastUpdate = Math.max(0, now - (useStatsStore.getState().lastFetchTime.group || now));
    const next = (progressMs || 0) + elapsedSinceLastUpdate;
    return next > durationMs ? durationMs : next;
  }, [progressMs, durationMs, isPlaying, heartbeat]);

  const currentRatio = useMemo(() => {
    if (!durationMs || !realTimeProgress) return 0.5;
    return Math.min(1, Math.max(0, realTimeProgress / durationMs));
  }, [realTimeProgress, durationMs]);

  const beatDuration    = useMemo(() => 1.4 - currentRatio * 0.7,              [currentRatio]);
  const pulseScale      = useMemo(() => 1.05 + currentRatio * 0.05,            [currentRatio]);
  const pulseOpacity    = useMemo(() => 0.45 + currentRatio * 0.25,            [currentRatio]);
  const shimmerDuration = useStatsStore(state => state.shimmerDuration) ?? 2.8;
  const shimmerSpeed    = useMemo(() => shimmerDuration - currentRatio * (shimmerDuration / 2), [currentRatio, shimmerDuration]);

  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const safeDominantColor = useMemo(() => normalizeColor(dominantColor, '#ea580c'), [dominantColor]);
  const darkColor         = useMemo(() => adjustBrightness(safeDominantColor, -0.4), [safeDominantColor]);
  const lightColor        = useMemo(() => adjustBrightness(safeDominantColor,  0.3), [safeDominantColor]);

  const tonearmRotate = isPlaying ? 18 : -38;
  const tonearmY      = isPlaying ? 0  : -6;

  return (
    <div
      className="relative w-full aspect-square flex items-center justify-center cursor-pointer"
      onClick={onClick}
    >

      {/* ── PENUMBRA IDLE — atrás do disco ──────────────────────── */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            className="absolute inset-[-8%] rounded-full pointer-events-none z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.15, 0.35, 0.15] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: `radial-gradient(circle at center, ${withAlpha(safeDominantColor, 0.25)} 0%, transparent 70%)`,
              filter: 'blur(18px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── DISCO ───────────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0 rounded-full shadow-2xl z-10 flex items-center justify-center border border-white/10"
        style={{
          background: `
            radial-gradient(circle at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.55) 19%, transparent 20%),
            radial-gradient(circle at 25% 20%, ${withAlpha(lightColor, 0.50)} 0%, transparent 55%),
            radial-gradient(circle at 75% 80%, ${withAlpha(darkColor,  0.35)} 0%, transparent 50%),
            radial-gradient(circle at 60% 10%, rgba(255,255,255,0.12) 0%, transparent 40%),
            conic-gradient(
              from 0deg,
              ${withAlpha(safeDominantColor, 0.55)} 0deg,
              ${withAlpha(darkColor,         0.38)} 60deg,
              ${withAlpha(safeDominantColor, 0.50)} 120deg,
              ${withAlpha(lightColor,        0.65)} 180deg,
              ${withAlpha(safeDominantColor, 0.50)} 240deg,
              ${withAlpha(darkColor,         0.35)} 300deg,
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
          willChange: isPlaying ? 'transform' : 'auto',
          filter: isPlaying ? 'brightness(1.3) saturate(1.2)' : 'none',
          boxShadow: isPlaying
            ? `0 0 30px ${withAlpha(safeDominantColor, 0.5)}, 0 0 60px ${withAlpha(safeDominantColor, 0.3)}`
            : 'none'
        }}
        animate={
          isPlaying && !prefersReducedMotion
            ? { rotate: 360, opacity: 1, scale: 1 }
            : { rotate: [-1.5, 1.5, -1.5], opacity: [0.75, 0.88, 0.75], scale: [0.995, 1.005, 0.995] }
        }
        transition={
          isPlaying && !prefersReducedMotion
            ? { duration: 3.5, repeat: Infinity, ease: 'linear' }
            : { duration: 16, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {/* Sulcos realistas + grain */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: isPlaying ? 0.42 : 0.18, mixBlendMode: 'soft-light' }}
        >
          <defs>
            <filter id={`${uniqueId}-grain`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          {Array.from({ length: 12 }, (_, i) => (
            <circle
              key={`${uniqueId}-groove-${i}`}
              cx="50" cy="50"
              r={45 - i * 3.0}
              fill="none"
              stroke="white"
              strokeWidth={i % 3 === 0 ? 0.45 : 0.2}
              opacity={1 - i * 0.055}
            />
          ))}
          <circle cx="50" cy="50" r="26" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.55" />
          <rect width="100" height="100" filter={`url(#${uniqueId}-grain)`} opacity="0.08" />
        </svg>

        {/* Reflexo especular rotativo */}
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.13) 7%, transparent 14%, transparent 50%, rgba(255,255,255,0.06) 57%, transparent 64%)',
            mixBlendMode: 'overlay',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />

        {/* Furo central com sombra — profundidade no miolo */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-15"
          style={{
            width: '9%',
            height: '9%',
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.75) 100%)',
          }}
        />

        {/* Glow pulsante atrás da capa — só playing */}
        {isPlaying && (
          <motion.div
            className="absolute inset-[24%] rounded-full pointer-events-none"
            style={{
              background: withAlpha(safeDominantColor, 0.5),
              filter: 'blur(12px)',
              zIndex: 15,
            }}
            animate={{
              scale:   [0.98, pulseScale,   0.98],
              opacity: [0.3,  pulseOpacity, 0.3],
            }}
            transition={{ duration: beatDuration, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* ── CAPA DO ÁLBUM ──────────────────────────────────────── */}
        <div className="absolute inset-[22%] rounded-full overflow-hidden z-20 shadow-2xl flex items-center justify-center bg-stone-900">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={albumImage || 'placeholder'}
              className="w-full h-full absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 1.04, filter: 'blur(4px)' }}
              animate={{ opacity: 1,  scale: 1,    filter: 'blur(0px)' }}
              exit={{    opacity: 0,  scale: 0.96, filter: 'blur(4px)' }}
              transition={{ duration: 0.45 }}
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

          {/* Shimmer na capa — só playing */}
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

          {/* Escurecimento da capa no idle — como luz apagando */}
          <AnimatePresence>
            {!isPlaying && (
              <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2 }}
                style={{
                  background: 'radial-gradient(circle at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 100%)',
                  zIndex: 25,
                }}
              />
            )}
          </AnimatePresence>

        </div>

        {/* Partículas de poeira — só idle */}
        <AnimatePresence>
          {!isPlaying && !prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 rounded-full pointer-events-none z-30 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <motion.div
                  key={`${uniqueId}-dust-${i}`}
                  className="absolute rounded-full bg-white"
                  style={{
                    width:  i % 2 === 0 ? '1.5px' : '1px',
                    height: i % 2 === 0 ? '1.5px' : '1px',
                    left:   `${20 + i * 12}%`,
                    top:    `${30 + (i % 3) * 15}%`,
                    opacity: 0.15 + i * 0.04,
                  }}
                  animate={{
                    x:       [0, i % 2 === 0 ? 6 : -4, 0],
                    y:       [0, -8, 0],
                    opacity: [0.1, 0.3, 0.1],
                  }}
                  transition={{
                    duration: 4 + i * 1.2,
                    repeat:   Infinity,
                    ease:     'easeInOut',
                    delay:    i * 0.7,
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>

      {/* ── TONEARM ─────────────────────────────────────────────── */}
      {!hideTonearm && (
        <motion.div
          className="absolute z-40 pointer-events-none"
          style={{
            right:           '0%',
            top:             '6%',
            width:           '50%',
            height:          '8%',
            transformOrigin: '92% 50%',
            willChange:      'transform',
            filter:          'drop-shadow(0 6px 16px rgba(0,0,0,0.9))',
            zIndex:          50,
          }}
          animate={{
            rotate: tonearmRotate,
            y:      tonearmY,
          }}
          transition={{
            duration: 1.4,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
        {/* Corpo do braço */}
        <div
          className="absolute rounded-full"
          style={{
            background: 'linear-gradient(90deg, #27272a 0%, #71717a 25%, #e4e4e7 55%, #a1a1aa 75%, #52525b 100%)',
            height: '30%',
            top:    '35%',
            left:   '2%',
            right:  '12%',
            boxShadow: '0 1px 3px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        />
        {/* Pivô circular */}
        <div
          className="absolute rounded-full"
          style={{
            right:     0,
            top:       '50%',
            transform: 'translateY(-50%)',
            width:     '11%',
            height:    '240%',
            background: 'radial-gradient(circle at 38% 32%, #e4e4e7 0%, #71717a 45%, #3f3f46 100%)',
            boxShadow:  '0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
        />
        {/* Headshell */}
        <div
          className="absolute rounded-sm"
          style={{
            left:      '1%',
            top:       '15%',
            width:     '8%',
            height:    '70%',
            background: 'linear-gradient(135deg, #71717a 0%, #3f3f46 100%)',
            boxShadow:  '0 1px 4px rgba(0,0,0,0.5)',
          }}
        />
        {/* Agulha */}
        <div
          className="absolute rounded-full"
          style={{
            left:      '0%',
            top:       '50%',
            transform: 'translateY(-50%)',
            width:     '3%',
            height:    '180%',
            background: 'linear-gradient(180deg, #fda4af 0%, #fb7185 40%, #f43f5e 100%)',
            boxShadow:  '0 0 6px rgba(244,63,94,0.8), 0 0 2px rgba(244,63,94,1)',
          }}
        />
      </motion.div>
      )}

    </div>
  );
};
