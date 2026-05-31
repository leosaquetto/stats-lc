/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Disc } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';
import { adjustBrightness, getPerceivedBrightness, getSaturation, normalizeColor, withAlpha } from '../../lib/colorUtils';
import { useStatsStore } from '../../store/useStatsStore';

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
  const vinylTextureMode = useStatsStore(state => state.vinylTextureMode);
  const textureProfile    = useMemo(() => getTextureProfile(albumImage, baseDominantColor), [albumImage, baseDominantColor]);
  const textureSeed       = textureProfile.seed;
  const textureVariant    = vinylTextureMode === 'shuffle' ? textureProfile.variant : Math.max(0, Math.min(2, Number(vinylTextureMode) - 1));
  const textureName       = textureVariant === 0 ? 'classic' : textureVariant === 1 ? 'marble' : 'splatter';
  const safeDominantColor = useMemo(() => {
    const saturation = getSaturation(baseDominantColor);
    const brightness = getPerceivedBrightness(baseDominantColor);
    if (saturation < 0.16) {
      if (brightness > 168) return '#f2eee6';
      if (brightness < 58) return '#2f2f2f';
      return baseDominantColor;
    }
    if (brightness < 82) return adjustBrightness(baseDominantColor, 0.32);
    return baseDominantColor;
  }, [baseDominantColor]);
  const darkColor         = useMemo(() => adjustBrightness(safeDominantColor, -0.34), [safeDominantColor]);
  const lightColor        = useMemo(() => adjustBrightness(safeDominantColor,  0.42), [safeDominantColor]);
  const splatterStreaks = useMemo(() => {
    if (textureVariant !== 2) return [];
    return Array.from({ length: 48 }, (_, i) => {
      const angle = seededValue(textureSeed, i) * 360;
      const inner = 18 + seededValue(textureSeed, i + 12) * 12;
      const length = 12 + Math.pow(seededValue(textureSeed, i + 45), 2) * 26;
      const outer = Math.min(49.2, inner + length);
      const width = 0.8 + Math.pow(seededValue(textureSeed, i + 88), 2) * 3.8;
      const bend = (seededValue(textureSeed, i + 119) - 0.5) * 2.5;
      return {
        angle,
        inner,
        outer,
        width,
        bend,
        opacity: 0.85 + seededValue(textureSeed, i + 137) * 0.15
      };
    });
  }, [textureSeed, textureVariant]);
  const splatterDrops = useMemo(() => {
    if (textureVariant !== 2) return [];
    return Array.from({ length: 35 }, (_, i) => ({
      angle: seededValue(textureSeed, i + 313) * 360,
      radius: 20 + seededValue(textureSeed, i + 154) * 28,
      size: 0.5 + seededValue(textureSeed, i + 99) * 1.5,
      opacity: 0.8 + seededValue(textureSeed, i + 242) * 0.2,
    }));
  }, [textureSeed, textureVariant]);
  const marbleWisps = useMemo(() => {
    if (textureVariant !== 1) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const angle = seededValue(textureSeed, i + 151) * 360;
      const radius = 12 + seededValue(textureSeed, i + 181) * 35;
      const sweep = 15 + seededValue(textureSeed, i + 211) * 40;
      const bend = (seededValue(textureSeed, i + 241) - 0.5) * 25;
      const width = 5 + seededValue(textureSeed, i + 271) * 15;
      return {
        angle,
        radius,
        sweep,
        bend,
        width,
        opacity: 0.15 + seededValue(textureSeed, i + 281) * 0.25
      };
    });
  }, [textureSeed, textureVariant]);
  const grooveRings = useMemo(() => Array.from({ length: 28 }, (_, i) => 22 + i * 0.95 + seededValue(textureSeed, i + 309) * 0.05), [textureSeed]);

  const tonearmNeedleX = 78 - currentRatio * 7;
  const tonearmNeedleY = 31 + currentRatio * 6;
  const tonearmPivotX = 93;
  const tonearmPivotY = 17;

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
        className={`absolute inset-0 overflow-hidden rounded-full shadow-2xl z-10 flex items-center justify-center border border-white/10 ${isPlaying && canAnimate ? "vinyl-record-spin" : canAnimate ? "vinyl-record-idle" : ""}`}
        style={{
          background: `
            radial-gradient(circle at center, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.18) 18%, transparent 19%),
            radial-gradient(circle at 33% 25%, ${withAlpha(lightColor, textureVariant === 0 ? 0.55 : 0.26)} 0%, transparent 46%),
            radial-gradient(circle at 72% 80%, ${withAlpha(darkColor, textureVariant === 1 ? 0.22 : 0.06)} 0%, transparent 50%),
            radial-gradient(circle at 58% 7%, rgba(255,255,255,0.08) 0%, transparent 34%),
            conic-gradient(
              from ${textureVariant * 34}deg,
              ${withAlpha(safeDominantColor, textureVariant === 2 ? 0.3 : 0.52)} 0deg,
              ${withAlpha(lightColor, textureVariant === 2 ? 0.18 : 0.3)} 46deg,
              ${withAlpha(safeDominantColor, textureVariant === 2 ? 0.28 : 0.42)} 118deg,
              ${withAlpha(darkColor, 0.10)} 174deg,
              ${withAlpha(lightColor, textureVariant === 2 ? 0.2 : 0.34)} 232deg,
              ${withAlpha(safeDominantColor, textureVariant === 2 ? 0.28 : 0.42)} 304deg,
              ${withAlpha(safeDominantColor, textureVariant === 2 ? 0.3 : 0.52)} 360deg
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
        {/* Camada base translúcida do vinil. */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-[11]"
          style={{
            background: textureVariant === 1
              ? 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.1) 0%, transparent 50%)'
              : 'radial-gradient(circle at 50% 50%, transparent 0 24%, rgba(255,255,255,0.06) 25%, transparent 29%)',
          }}
        />

        {/* Reflexo plástico principal. */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-[14]"
          style={{
            background: 'conic-gradient(from 35deg, transparent 0deg, rgba(255,255,255,0.12) 12deg, transparent 28deg, transparent 180deg, rgba(255,255,255,0.12) 192deg, transparent 208deg)',
            mixBlendMode: 'screen',
            opacity: isPlaying ? 0.95 : 0.7,
            transition: 'opacity 0.5s ease',
          }}
        />

        {/* Sulcos e texturas específicas. */}
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
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.06" />
            </filter>
            <filter id={`${uniqueId}-marble-blur`}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
            </filter>
          </defs>
          <g clipPath={`url(#${uniqueId}-vinyl-disc-clip)`}>
            <circle cx="50" cy="50" r="32.0" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" opacity="0.4" />
            <circle cx="50" cy="50" r="41.5" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="0.8" opacity="0.5" />
            {grooveRings.map((r, i) => (
              <circle
                key={`${uniqueId}-groove-${i}`}
                cx="50"
                cy="50"
                r={Math.min(r, 48.8)}
                fill="none"
                stroke={i % 3 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.15)'}
                strokeWidth={textureVariant === 1 ? 0.28 : 0.22}
                opacity={textureVariant === 0 ? 0.13 : textureVariant === 1 ? 0.18 : 0.06}
              />
            ))}

            {textureVariant === 1 && (
              <g filter={`url(#${uniqueId}-marble-blur)`} style={{ mixBlendMode: 'multiply' }}>
                {marbleWisps.map((w, i) => (
                  <path
                    key={`${uniqueId}-wisp-${i}`}
                    d={`M 50 ${50 - w.radius} Q ${50 + w.bend} ${50 - w.radius + w.sweep / 2}, ${50 + w.sweep * 0.3} ${50 - w.radius + w.sweep}`}
                    fill="none"
                    stroke="rgba(0,0,0,0.95)"
                    strokeWidth={w.width}
                    strokeLinecap="round"
                    opacity={w.opacity}
                    transform={`rotate(${w.angle} 50 50)`}
                  />
                ))}
              </g>
            )}

            {textureVariant === 2 && (
              <g filter={`url(#${uniqueId}-splatter-soften)`} style={{ mixBlendMode: 'normal' }}>
                {splatterStreaks.map((s, i) => (
                  <path
                    key={`${uniqueId}-streak-${i}`}
                    d={`M 50 ${50 - s.inner} Q ${50 + s.bend} ${50 - (s.inner + s.outer) / 2}, 50 ${50 - s.outer}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.95)"
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
                    fill="rgba(255,255,255,0.95)"
                    opacity={drop.opacity}
                    transform={`rotate(${drop.angle} 50 50)`}
                  />
                ))}
              </g>
            )}
          </g>
        </svg>

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
            initial={{ opacity: 0, x: 16, y: -14, rotate: -10 }}
            animate={{
              opacity: 1,
              x: [0, -0.75, 0.45, 0],
              y: [0, 0.5, -0.2, 0],
              rotate: [0, -0.35, 0.25, 0],
            }}
            exit={{ opacity: 0, x: 16, y: -14, rotate: -9 }}
            transition={{
              opacity: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
              x: { duration: 18, repeat: Infinity, ease: 'easeInOut' },
              y: { duration: 18, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 18, repeat: Infinity, ease: 'easeInOut' },
            }}
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
              r="5.5"
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
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1={tonearmPivotX - 0.8}
              y1={tonearmPivotY + 0.6}
              x2={tonearmNeedleX + 0.8}
              y2={tonearmNeedleY - 0.6}
              stroke="#b0b8c1"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
            <circle
              cx={tonearmPivotX}
              cy={tonearmPivotY}
              r="4.6"
              fill={`url(#${uniqueId}-tonearm-head)`}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="0.5"
            />
            <circle cx={tonearmPivotX - 1.2} cy={tonearmPivotY - 1.1} r="1.15" fill="rgba(255,255,255,0.22)" />
            <g transform={`translate(${tonearmNeedleX} ${tonearmNeedleY}) rotate(-38)`}>
              <rect
                x="-4.2"
                y="-4.0"
                width="9.2"
                height="7.4"
                rx="2.0"
                fill={`url(#${uniqueId}-tonearm-head)`}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="0.45"
              />
              <rect x="-3.2" y="-2.9" width="7" height="1.1" rx="0.55" fill="rgba(255,255,255,0.08)" />
              <line
                x1="0"
                y1="3"
                x2="4.2"
                y2="7.8"
                stroke="rgba(251,146,60,0.78)"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
              <circle cx="4.2" cy="7.8" r="0.55" fill="rgba(254,215,170,0.82)" />
            </g>
          </motion.svg>
        )}
      </AnimatePresence>

    </div>
  );
};
