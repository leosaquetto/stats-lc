/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Disc } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';
import { adjustBrightness, getPerceivedBrightness, getSaturation, normalizeColor, withAlpha } from '../../lib/colorUtils';

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

const fallbackVinylColors = ['#7fa8c7', '#c9d783', '#d8614f', '#f0a22a', '#2aa8a3'];

const VINYL_TEXTURE_COUNT = 3;

const vinylTextureCache = new Map<string, { seed: number; variant: number }>();

const getTextureProfile = (albumImage: string, dominantColor: string) => {
  const key = albumImage || dominantColor || 'no-cover';
  const cached = vinylTextureCache.get(key);
  if (cached) return cached;

  const seed = hashString(key);
  const rawVariant = (seed + Math.floor(seededValue(seed, 4) * 1000)) % VINYL_TEXTURE_COUNT;
  const variant = rawVariant;
  const profile = { seed, variant };

  if (vinylTextureCache.size > 120) {
    vinylTextureCache.delete(vinylTextureCache.keys().next().value);
  }
  vinylTextureCache.set(key, profile);
  return profile;
};

const useVinylVisibility = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '220px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible] as const;
};

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return prefersReducedMotion;
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
  const [containerRef, isVisible] = useVinylVisibility();
  const prefersReducedMotion = usePrefersReducedMotion();
  const canAnimate = isVisible && !prefersReducedMotion;

  const currentRatio = useMemo(() => {
    if (!durationMs || progressMs == null) return 0.5;
    return Math.min(1, Math.max(0, progressMs / durationMs));
  }, [progressMs, durationMs]);

  const baseDominantColor = useMemo(() => normalizeColor(dominantColor, '#ea580c'), [dominantColor]);
  const textureProfile    = useMemo(() => getTextureProfile(albumImage, baseDominantColor), [albumImage, baseDominantColor]);
  const textureSeed       = textureProfile.seed;
  const textureVariant    = textureProfile.variant;
  const textureName       = textureVariant === 0 ? 'classic' : textureVariant === 1 ? 'marble' : 'splatter';
  const safeDominantColor = useMemo(() => {
    const saturation = getSaturation(baseDominantColor);
    const brightness = getPerceivedBrightness(baseDominantColor);
    if (saturation < 0.24 || brightness < 48) {
      return fallbackVinylColors[textureSeed % fallbackVinylColors.length];
    }
    if (brightness < 82) return adjustBrightness(baseDominantColor, 0.32);
    return baseDominantColor;
  }, [baseDominantColor, textureSeed]);
  const darkColor         = useMemo(() => adjustBrightness(safeDominantColor, -0.34), [safeDominantColor]);
  const lightColor        = useMemo(() => adjustBrightness(safeDominantColor,  0.42), [safeDominantColor]);
  const splatterStreaks = useMemo(() => {
    if (textureVariant !== 2) return [];
    return Array.from({ length: 75 }, (_, i) => {
      const angle = seededValue(textureSeed, i) * 360;
      const inner = 20 + seededValue(textureSeed, i + 41) * 8;
      const outer = Math.min(49.5, inner + 15 + seededValue(textureSeed, i + 73) * 25);
      const width = 0.6 + seededValue(textureSeed, i + 101) * 3.4;
      const bend = (seededValue(textureSeed, i + 119) - 0.5) * 2.0;
      return { angle, inner, outer, width, bend, opacity: 0.85 + seededValue(textureSeed, i + 137) * 0.15 };
    });
  }, [textureSeed, textureVariant]);
  const splatterDrops = useMemo(() => {
    if (textureVariant !== 2) return [];
    return Array.from({ length: 40 }, (_, i) => ({
      angle: seededValue(textureSeed, i + 411) * 360,
      radius: 22 + seededValue(textureSeed, i + 439) * 26,
      size: 0.5 + seededValue(textureSeed, i + 467) * 2.0,
      opacity: 0.7 + seededValue(textureSeed, i + 491) * 0.3,
    }));
  }, [textureSeed, textureVariant]);
  const grooveRings = useMemo(() => Array.from({ length: 28 }, (_, i) => 22 + i * 0.95 + seededValue(textureSeed, i + 309) * 0.05), [textureSeed]);

  const tonearmNeedleX = 66 - currentRatio * 6;
  const tonearmNeedleY = 66 - currentRatio * 12;
  const tonearmPivotX = 77;
  const tonearmPivotY = 15;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square flex items-center justify-center cursor-pointer"
      onClick={onClick}
      data-vinyl-variant={textureName}
    >
      <>

      {/* ── PENUMBRA IDLE — atrás do disco ──────────────────────── */}
      <AnimatePresence>
        {!isPlaying && canAnimate && (
          <div
            className="vinyl-record-aura absolute inset-[-8%] rounded-full pointer-events-none z-0"
            style={{
              background: `radial-gradient(circle at center, ${withAlpha(safeDominantColor, 0.25)} 0%, transparent 70%)`,
              filter: 'blur(18px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── DISCO ───────────────────────────────────────────────── */}
      <motion.div
        className={`absolute inset-0 rounded-full shadow-2xl z-10 flex items-center justify-center border border-white/10 ${isPlaying && canAnimate ? "vinyl-record-spin" : canAnimate ? "vinyl-record-idle" : ""}`}
        style={{
          background: `
            radial-gradient(circle at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.28) 18%, transparent 19%),
            radial-gradient(circle at 33% 25%, ${withAlpha(lightColor, textureVariant === 0 ? 0.5 : 0.34)} 0%, transparent 44%),
            radial-gradient(circle at 72% 80%, ${withAlpha(darkColor, textureVariant === 1 ? 0.14 : 0.08)} 0%, transparent 48%),
            radial-gradient(circle at 58% 7%, rgba(255,255,255,0.1) 0%, transparent 32%),
            conic-gradient(
              from ${textureVariant * 34}deg,
              ${withAlpha(safeDominantColor, 0.62)} 0deg,
              ${withAlpha(lightColor, 0.38)} 46deg,
              ${withAlpha(safeDominantColor, 0.46)} 118deg,
              ${withAlpha(darkColor, 0.12)} 174deg,
              ${withAlpha(lightColor, 0.4)} 232deg,
              ${withAlpha(safeDominantColor, 0.46)} 304deg,
              ${withAlpha(safeDominantColor, 0.62)} 360deg
            )
          `,
          isolation: 'isolate',
          backdropFilter: 'blur(1.2px) saturate(1.18)',
          WebkitBackdropFilter: 'blur(1.2px) saturate(1.18)',
          maskImage: 'radial-gradient(circle at center, transparent 4.5%, rgba(0,0,0,0.3) 4.8%, black 5.5%)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 4.5%, rgba(0,0,0,0.3) 4.8%, black 5.5%)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transformOrigin: 'center center',
          willChange: isPlaying ? 'transform' : 'auto',
          filter: isPlaying ? 'brightness(1.08) saturate(1.08)' : 'none',
          boxShadow: isPlaying
            ? `0 0 24px ${withAlpha(safeDominantColor, 0.32)}, 0 0 48px ${withAlpha(safeDominantColor, 0.18)}`
            : 'none'
        }}
      >
        {/* Camada de textura: variantes isoladas (solido, smoke/marble, splatter). */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-[11]"
          style={{
            background:
              textureVariant === 1
                ? `
                  conic-gradient(from ${textureSeed % 360}deg, transparent, rgba(0,0,0,0.2) 12%, transparent 25%, rgba(0,0,0,0.24) 45%, transparent 60%, rgba(0,0,0,0.18) 80%, transparent),
                  conic-gradient(from ${(textureSeed + 120) % 360}deg, transparent, rgba(255,255,255,0.1) 20%, transparent 40%, rgba(0,0,0,0.18) 75%, transparent),
                  radial-gradient(circle at 35% 40%, rgba(0,0,0,0.14) 0%, transparent 50%)
                `
                : textureVariant === 2
                  ? `
                    radial-gradient(circle at 50% 50%, transparent 0 24%, rgba(255,255,255,0.08) 25%, transparent 29%)
                  `
                  : `
                    radial-gradient(circle at 50% 50%, transparent 0 24%, rgba(255,255,255,0.12) 25%, transparent 29%),
                    conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.05) 15deg, transparent 30deg, transparent 180deg, rgba(255,255,255,0.05) 195deg, transparent 210deg)
                  `,
            mixBlendMode: textureVariant === 1 ? 'soft-light' : 'screen',
            opacity: isPlaying ? 0.72 : 0.58,
          }}
        />

        {/* Sulcos e splatter vetorial. */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full pointer-events-none"
          style={{ zIndex: 13, opacity: isPlaying ? 1 : 0.85 }}
        >
          <defs>
            <clipPath id={`${uniqueId}-vinyl-disc-clip`}>
              <circle cx="50" cy="50" r="49.2" />
              <circle cx="50" cy="50" r="5.2" />
            </clipPath>
            <filter id={`${uniqueId}-splatter-soften`}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.08" />
            </filter>
          </defs>
          <g clipPath={`url(#${uniqueId}-vinyl-disc-clip)`}>
            <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3" opacity="0.4" />
            <circle cx="50" cy="50" r="41.5" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" opacity="0.5" />
            <circle cx="50" cy="50" r="24.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" opacity="0.4" />
            {grooveRings.map((r, i) => (
              <circle
                key={`${uniqueId}-groove-${i}`}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={i % 4 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.22)'}
                strokeWidth={i % 5 === 0 ? 0.22 : 0.12}
                opacity={i % 2 === 0 ? 0.65 : 0.35}
              />
            ))}

            {textureVariant === 2 && (
              <g filter={`url(#${uniqueId}-splatter-soften)`} style={{ mixBlendMode: 'normal' }}>
                {splatterStreaks.map((s, i) => (
                  <path
                    key={`${uniqueId}-streak-${i}`}
                    d={`M 50 ${50 - s.inner} Q ${50 + s.bend} ${50 - (s.inner + s.outer) / 2}, 50 ${50 - s.outer}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.98)"
                    strokeWidth={s.width}
                    strokeLinecap="round"
                    opacity={s.opacity}
                    transform={`rotate(${s.angle} 50 50)`}
                  />
                ))}
                {splatterDrops.map((drop, i) => (
                  <circle
                    key={`${uniqueId}-drop-${i}`}
                    cx="50"
                    cy={50 - drop.radius}
                    r={drop.size}
                    fill="rgba(255,255,255,0.98)"
                    opacity={drop.opacity}
                    transform={`rotate(${drop.angle} 50 50)`}
                  />
                ))}
              </g>
            )}
          </g>
        </svg>

        {/* Reflexo especular rotativo */}
        <div
          className={`absolute inset-0 rounded-full pointer-events-none ${isPlaying && canAnimate ? "vinyl-reflection-spin" : ""}`}
          style={{
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.13) 7%, transparent 14%, transparent 50%, rgba(255,255,255,0.06) 57%, transparent 64%)',
            mixBlendMode: 'overlay',
          }}
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
        {isPlaying && canAnimate && (
          <div
            className="absolute inset-[22%] rounded-full pointer-events-none"
            style={{
              background: withAlpha(safeDominantColor, 0.5),
              filter: 'blur(12px)',
              zIndex: 15,
              opacity: 0.42,
              transform: `scale(${1.04 + currentRatio * 0.04})`,
            }}
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

      </motion.div>
      </>

      {/* ── TONEARM ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {!hideTonearm && isPlaying && (
          <motion.svg
            className="absolute inset-0 pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ zIndex: 80, overflow: 'visible', filter: 'drop-shadow(0 9px 18px rgba(0,0,0,0.78))' }}
            initial={{ opacity: 0, x: 10, y: -8, rotate: -4 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
            exit={{ opacity: 0, x: 14, y: -8 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <defs>
              <linearGradient id={`${uniqueId}-tonearm-metal`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="42%" stopColor="#94a3b8" />
                <stop offset="72%" stopColor="#e5e7eb" />
                <stop offset="100%" stopColor="#1f2937" />
              </linearGradient>
              <radialGradient id={`${uniqueId}-tonearm-head`} cx="38%" cy="25%" r="85%">
                <stop offset="0%" stopColor="#2b2c30" />
                <stop offset="62%" stopColor="#111216" />
                <stop offset="100%" stopColor="#000000" />
              </radialGradient>
            </defs>
            <circle
              cx={tonearmPivotX}
              cy={tonearmPivotY}
              r="9.5"
              fill="rgba(0,0,0,0.16)"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.5"
            />
            <line
              x1={tonearmPivotX}
              y1={tonearmPivotY}
              x2={tonearmNeedleX}
              y2={tonearmNeedleY}
              stroke="rgba(0,0,0,0.72)"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
            <line
              x1={tonearmPivotX - 0.8}
              y1={tonearmPivotY + 0.6}
              x2={tonearmNeedleX + 0.8}
              y2={tonearmNeedleY - 0.6}
              stroke={`url(#${uniqueId}-tonearm-metal)`}
              strokeWidth="2.15"
              strokeLinecap="round"
            />
            <circle
              cx={tonearmPivotX}
              cy={tonearmPivotY}
              r="5.2"
              fill={`url(#${uniqueId}-tonearm-head)`}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="0.5"
            />
            <circle cx={tonearmPivotX - 1.2} cy={tonearmPivotY - 1.1} r="1.15" fill="rgba(255,255,255,0.22)" />
            <g transform={`translate(${tonearmNeedleX} ${tonearmNeedleY}) rotate(-48)`}>
              <rect
                x="-4.8"
                y="-4.7"
                width="10.4"
                height="8.2"
                rx="2.2"
                fill={`url(#${uniqueId}-tonearm-head)`}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="0.45"
              />
              <rect x="-3.2" y="-2.9" width="7" height="1.1" rx="0.55" fill="rgba(255,255,255,0.08)" />
              <line
                x1="0"
                y1="3"
                x2="4.8"
                y2="8.2"
                stroke="rgba(251,146,60,0.78)"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
              <circle cx="4.8" cy="8.2" r="0.55" fill="rgba(254,215,170,0.82)" />
            </g>
          </motion.svg>
        )}
      </AnimatePresence>

    </div>
  );
};
