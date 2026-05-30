/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Disc } from 'lucide-react';
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
    if (!durationMs || !progressMs) return 0.5;
    return Math.min(1, Math.max(0, progressMs / durationMs));
  }, [progressMs, durationMs]);

  const safeDominantColor = useMemo(() => normalizeColor(dominantColor, '#ea580c'), [dominantColor]);
  const darkColor         = useMemo(() => adjustBrightness(safeDominantColor, -0.4), [safeDominantColor]);
  const lightColor        = useMemo(() => adjustBrightness(safeDominantColor,  0.3), [safeDominantColor]);
  const textureProfile    = useMemo(() => getTextureProfile(albumImage, safeDominantColor), [albumImage, safeDominantColor]);
  const textureSeed       = textureProfile.seed;
  const textureVariant    = textureProfile.variant;
  const splatters = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    angle: seededValue(textureSeed, i) * 360,
    length: 4 + seededValue(textureSeed, i + 31) * 11,
    width: 0.6 + seededValue(textureSeed, i + 61) * 1.4,
    radius: 25 + seededValue(textureSeed, i + 91) * 20,
    opacity: 0.18 + seededValue(textureSeed, i + 121) * 0.38,
  })), [textureSeed]);
  const wisps = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    angle: seededValue(textureSeed, i + 151) * 360,
    radius: 18 + seededValue(textureSeed, i + 181) * 32,
    width: 8 + seededValue(textureSeed, i + 211) * 14,
    height: 1.2 + seededValue(textureSeed, i + 241) * 2.4,
    opacity: 0.05 + seededValue(textureSeed, i + 271) * 0.13,
  })), [textureSeed]);

  const tonearmNeedleX = 56 - currentRatio * 3;
  const tonearmNeedleY = 13 + currentRatio * 4;
  const tonearmPivotX = 92;
  const tonearmPivotY = 4;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square flex items-center justify-center cursor-pointer"
      onClick={onClick}
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
          <rect width="100" height="100" filter={`url(#${uniqueId}-grain)`} opacity="0.08" />
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
            style={{ zIndex: 80, overflow: 'visible', filter: 'drop-shadow(0 7px 16px rgba(0,0,0,0.92))' }}
            initial={{ opacity: 0, x: 14, y: -8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 14, y: -8 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <defs>
              <linearGradient id="tonearm-metal" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#111827" />
                <stop offset="24%" stopColor="#f8fafc" />
                <stop offset="52%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#030712" />
              </linearGradient>
              <radialGradient id="tonearm-head" cx="38%" cy="25%" r="85%">
                <stop offset="0%" stopColor="#27272a" />
                <stop offset="62%" stopColor="#09090b" />
                <stop offset="100%" stopColor="#000000" />
              </radialGradient>
            </defs>
            <line
              x1={tonearmPivotX}
              y1={tonearmPivotY}
              x2={tonearmNeedleX}
              y2={tonearmNeedleY}
              stroke="rgba(15,23,42,0.9)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <line
              x1={tonearmPivotX - 1}
              y1={tonearmPivotY + 0.6}
              x2={tonearmNeedleX + 1}
              y2={tonearmNeedleY - 0.6}
              stroke="url(#tonearm-metal)"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <circle
              cx={tonearmPivotX}
              cy={tonearmPivotY}
              r="4.5"
              fill="url(#tonearm-head)"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="0.5"
            />
            <circle cx={tonearmPivotX - 1.2} cy={tonearmPivotY - 1.1} r="1.3" fill="rgba(255,255,255,0.25)" />
            <g transform={`translate(${tonearmNeedleX} ${tonearmNeedleY}) rotate(-28)`}>
              <rect
                x="-5.4"
                y="-4.3"
                width="9.8"
                height="7.4"
                rx="2"
                fill="url(#tonearm-head)"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="0.45"
              />
              <line
                x1="-0.4"
                y1="2.5"
                x2="5.5"
                y2="8.7"
                stroke="rgba(251,146,60,0.78)"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
              <circle cx="5.5" cy="8.7" r="0.55" fill="rgba(254,215,170,0.82)" />
            </g>
          </motion.svg>
        )}
      </AnimatePresence>

    </div>
  );
};
