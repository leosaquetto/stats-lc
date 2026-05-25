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

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash);
};

const seededValue = (seed: number, index: number) => {
  const x = Math.sin(seed + index * 97.13) * 10000;
  return x - Math.floor(x);
};

const vinylTextureCache = new Map<string, { seed: number; variant: number }>();

const getTextureProfile = (albumImage: string, dominantColor: string) => {
  const key = `${albumImage || 'no-cover'}|${dominantColor}`;
  const cached = vinylTextureCache.get(key);
  if (cached) return cached;

  const imageHash = hashString(albumImage || 'no-cover');
  const colorHash = hashString(dominantColor);
  const seed = Math.abs(Math.imul(imageHash || 17, 101) ^ Math.imul(colorHash || 29, 53) ^ key.length);
  const profile = { seed, variant: (seed + Math.floor(seededValue(seed, 4) * 1000)) % 3 };

  if (vinylTextureCache.size > 120) {
    vinylTextureCache.delete(vinylTextureCache.keys().next().value);
  }
  vinylTextureCache.set(key, profile);
  return profile;
};

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
  const textureProfile    = useMemo(() => getTextureProfile(albumImage, safeDominantColor), [albumImage, safeDominantColor]);
  const textureSeed       = textureProfile.seed;
  const textureVariant    = textureProfile.variant;
  const splatters = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    angle: seededValue(textureSeed, i) * 360,
    length: 8 + seededValue(textureSeed, i + 31) * 22,
    width: 0.5 + seededValue(textureSeed, i + 61) * 1.2,
    radius: 24 + seededValue(textureSeed, i + 91) * 22,
    opacity: 0.25 + seededValue(textureSeed, i + 121) * 0.55,
  })), [textureSeed]);
  const wisps = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    angle: seededValue(textureSeed, i + 151) * 360,
    radius: 18 + seededValue(textureSeed, i + 181) * 32,
    width: 10 + seededValue(textureSeed, i + 211) * 18,
    height: 1.6 + seededValue(textureSeed, i + 241) * 4,
    opacity: 0.07 + seededValue(textureSeed, i + 271) * 0.18,
  })), [textureSeed]);

  const tonearmRotate = isPlaying ? -22 - currentRatio * 17 : 18;
  const tonearmY      = isPlaying ? 0  : -5;

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
            radial-gradient(circle at center, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.48) 19%, transparent 20%),
            radial-gradient(circle at 24% 18%, ${withAlpha(lightColor, textureVariant === 0 ? 0.38 : 0.30)} 0%, transparent 56%),
            radial-gradient(circle at 78% 82%, ${withAlpha(darkColor,  textureVariant === 1 ? 0.22 : 0.16)} 0%, transparent 54%),
            radial-gradient(circle at 58% 8%, rgba(255,255,255,0.11) 0%, transparent 38%),
            conic-gradient(
              from 0deg,
              ${withAlpha(safeDominantColor, 0.34)} 0deg,
              ${withAlpha(darkColor,         0.18)} 60deg,
              ${withAlpha(safeDominantColor, 0.24)} 120deg,
              ${withAlpha(lightColor,        0.40)} 180deg,
              ${withAlpha(safeDominantColor, 0.28)} 240deg,
              ${withAlpha(darkColor,         0.16)} 300deg,
              ${withAlpha(safeDominantColor, 0.34)} 360deg
            )
          `,
          backdropFilter: 'blur(1.5px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(1.5px) saturate(1.15)',
          maskImage: 'radial-gradient(circle at center, transparent 4.5%, rgba(0,0,0,0.3) 4.8%, black 5.5%)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 4.5%, rgba(0,0,0,0.3) 4.8%, black 5.5%)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transformOrigin: 'center center',
          willChange: isPlaying ? 'transform' : 'auto',
          filter: isPlaying ? 'brightness(1.18) saturate(1.16)' : 'none',
          boxShadow: isPlaying
            ? `0 0 30px ${withAlpha(safeDominantColor, 0.5)}, 0 0 60px ${withAlpha(safeDominantColor, 0.3)}`
            : 'none'
        }}
        animate={
          isPlaying && !prefersReducedMotion
            ? { rotate: 360, opacity: 1, scale: 1 }
            : { rotate: [-3, 3, -3], opacity: [0.65, 0.82, 0.65], scale: [0.99, 1.01, 0.99] }
        }
        transition={
          isPlaying && !prefersReducedMotion
            ? { duration: 3, repeat: Infinity, ease: 'linear' }
            : { duration: 12, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {/* Texturas translúcidas inspiradas nas referências de vinil */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-[11]"
          style={{
            background:
              textureVariant === 0
                ? `radial-gradient(circle at 50% 50%, transparent 0 23%, rgba(255,255,255,0.13) 24%, transparent 29%),
                   radial-gradient(circle at 44% 40%, rgba(255,255,255,0.18), transparent 34%),
                   radial-gradient(circle at 66% 32%, rgba(255,255,255,0.12), transparent 22%),
                   conic-gradient(from 20deg, transparent 0deg, rgba(255,255,255,0.12) 9deg, transparent 18deg, transparent 54deg, rgba(255,255,255,0.10) 66deg, transparent 78deg, transparent 360deg)`
                : textureVariant === 1
                  ? `radial-gradient(circle at 30% 28%, ${withAlpha(lightColor, 0.24)}, transparent 29%),
                     radial-gradient(circle at 62% 68%, ${withAlpha(darkColor, 0.17)}, transparent 40%),
                     radial-gradient(circle at 74% 24%, rgba(255,255,255,0.09), transparent 24%),
                     conic-gradient(from 120deg, ${withAlpha(darkColor, 0.19)}, transparent 45deg, ${withAlpha(lightColor, 0.15)} 90deg, transparent 145deg, ${withAlpha(darkColor, 0.14)} 220deg, transparent 360deg)`
                  : `radial-gradient(circle at 42% 32%, rgba(255,255,255,0.13), transparent 28%),
                     radial-gradient(circle at 72% 46%, ${withAlpha(lightColor, 0.17)}, transparent 38%),
                     radial-gradient(circle at 28% 78%, ${withAlpha(darkColor, 0.11)}, transparent 28%),
                     conic-gradient(from 260deg, transparent, ${withAlpha(safeDominantColor, 0.16)}, transparent, ${withAlpha(darkColor, 0.12)}, transparent)`,
            mixBlendMode: textureVariant === 0 ? 'screen' : 'soft-light',
            opacity: isPlaying ? 0.74 : 0.54,
          }}
        />

        {(textureVariant === 0 || textureVariant === 2) && (
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none z-[12]"
            style={{ opacity: isPlaying ? 0.78 : 0.42, mixBlendMode: 'screen' }}
          >
            {splatters.map((s, i) => (
              <ellipse
                key={`${uniqueId}-splat-${i}`}
                cx="50"
                cy={50 - s.radius}
                rx={s.width}
                ry={s.length}
                fill="rgba(255,255,255,0.75)"
                opacity={textureVariant === 0 ? s.opacity : s.opacity * 0.28}
                transform={`rotate(${s.angle} 50 50)`}
              />
            ))}
          </svg>
        )}

        {(textureVariant === 1 || textureVariant === 2) && (
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none z-[12]"
            style={{ opacity: isPlaying ? 0.85 : 0.55, mixBlendMode: 'multiply' }}
          >
            {wisps.map((w, i) => (
              <ellipse
                key={`${uniqueId}-wisp-${i}`}
                cx="50"
                cy={50 - w.radius}
                rx={w.width}
                ry={w.height}
                fill={withAlpha(darkColor, w.opacity)}
                transform={`rotate(${w.angle} 50 50)`}
              />
            ))}
          </svg>
        )}

        {/* Sulcos realistas + grain */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: isPlaying ? 0.52 : 0.24, mixBlendMode: 'soft-light', zIndex: 13 }}
        >
          <defs>
            <filter id={`${uniqueId}-grain`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          {Array.from({ length: 15 }, (_, i) => (
            <circle
              key={`${uniqueId}-groove-${i}`}
              cx="50" cy="50"
              r={45 - i * 2.45}
              fill="none"
              stroke="white"
              strokeWidth={i % 3 === 0 ? 0.36 : 0.16}
              opacity={0.9 - i * 0.045}
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
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.95), inset 0 0 8px rgba(0,0,0,0.7)',
          }}
        />

        {/* Glow pulsante atrás da capa — só playing */}
        {isPlaying && (
          <motion.div
            className="absolute inset-[22%] rounded-full pointer-events-none"
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
            right:           isPlaying ? '-5%' : '-10%',
            top:             isPlaying ? '5%' : '-1%',
            width:           isPlaying ? '50%' : '52%',
            height:          '9%',
            transformOrigin: '90% 42%',
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
          className="absolute rounded-full transition-all duration-700"
          style={{
            background: isPlaying
              ? 'linear-gradient(90deg, #1f2937 0%, #d1d5db 18%, #f9fafb 48%, #9ca3af 72%, #111827 100%)'
              : 'linear-gradient(90deg, #27272a 0%, #71717a 25%, #e4e4e7 55%, #a1a1aa 75%, #52525b 100%)',
            height: '24%',
            top:    '38%',
            left:   '8%',
            right:  '17%',
            boxShadow: isPlaying
              ? '0 1px 5px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.35)'
              : '0 1px 3px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            left: '13%',
            right: '20%',
            top: '43%',
            height: '7%',
            background: 'rgba(255,255,255,0.5)',
            filter: 'blur(1px)',
          }}
        />
        {/* Pivô circular */}
        <div
          className="absolute rounded-full"
          style={{
            right:     '-1%',
            top:       '42%',
            transform: 'translateY(-50%)',
            width:     '26%',
            height:    '290%',
            background: 'radial-gradient(circle at 42% 35%, rgba(255,255,255,0.14) 0%, rgba(39,39,42,0.78) 38%, rgba(0,0,0,0.78) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow:  '0 2px 12px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
        />
        {/* Headshell */}
        <div
          className="absolute rounded-md"
          style={{
            left:      '0%',
            top:       '16%',
            width:     '18%',
            height:    '88%',
            background: 'linear-gradient(135deg, #18181b 0%, #09090b 72%, #27272a 100%)',
            boxShadow:  '0 2px 7px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
            transform: 'skewX(-10deg)',
          }}
        />
        {/* Agulha */}
        <div
          className="absolute rounded-full"
          style={{
            left:      '2%',
            top:       '86%',
            transform: 'rotate(-28deg)',
            transformOrigin: '50% 0%',
            width:     '3%',
            height:    '70%',
            background: isPlaying ? '#fb923c' : '#3f3f46',
            boxShadow:  isPlaying ? '0 0 8px rgba(249,115,22,0.72)' : 'none',
          }}
        />
      </motion.div>
      )}

    </div>
  );
};
