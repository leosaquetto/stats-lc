/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Disc } from 'lucide-react';
import { SmartImage, preloadSmartImages } from '../shared/CommonUI';
import { adjustBrightness, getPerceivedBrightness, getSaturation, normalizeColor, withAlpha } from '../../lib/colorUtils';
import { VinylTonearm } from './VinylTonearm';
import { useViewportMotionGate } from '../../hooks/useViewportMotionGate';
import { useCompositorLoopTelemetry } from '../../hooks/useCompositorLoopTelemetry';
import { readRuntimeCacheEntry, setRuntimeCacheEntry } from '../../lib/memoryRuntime';

interface VinylRecordProps {
  albumImage: string;
  dominantColor: string;
  isPlaying: boolean;
  playbackKey?: string;
  hideTonearm?: boolean;
  onPlaybackIntent?: (isPlaying: boolean) => void;
}

type VinylVisualSnapshot = {
  albumImage: string;
  dominantColor: string;
  identity: string;
  playbackKey: string;
  revision: number;
};

type VinylPhase = 'booting' | 'playing' | 'swapping-album' | 'idle';
type TonearmState = 'rest' | 'lifted' | 'playing';

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
  const key = albumImage || dominantColor || 'no-cover';
  const cached = readRuntimeCacheEntry(vinylTextureCache, key);
  if (cached) return cached;

  const seed = hashString(key);
  const variant = 0;
  const profile = { seed, variant };

  setRuntimeCacheEntry(vinylTextureCache, key, profile, 'small');
  return profile;
};

const getRotationFromTransform = (transform: string) => {
  if (!transform || transform === 'none') return null;
  try {
    const matrix = new DOMMatrixReadOnly(transform);
    return (Math.atan2(matrix.m12, matrix.m11) * 180 / Math.PI + 360) % 360;
  } catch {
    return null;
  }
};

const getVisualIdentity = (_playbackKey: string | undefined, albumImage: string) => (
  albumImage || 'vinyl-placeholder'
);

const wait = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));
const steadyRotationDuration = 7200;
const accelerationDuration = 1200;
const accelerationRotations = accelerationDuration / steadyRotationDuration * 0.72;

const getTransitionMotion = (prefersReducedMotion: boolean) => {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.12, ease: 'linear' as const },
    };
  }

  return {
    initial: { x: 140, opacity: 0, scale: 0.96 },
    animate: { x: 0, opacity: 1, scale: 1 },
    exit: {
      x: 150,
      opacity: 0,
      scale: 0.94,
      transition: {
        duration: 0.54,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    },
    transition: {
      duration: 0.58,
      delay: 0.08,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  };
};

export const VinylRecord = ({
  albumImage,
  dominantColor,
  isPlaying,
  playbackKey,
  hideTonearm = false,
  onPlaybackIntent
}: VinylRecordProps) => {
  const uniqueId = useId();
  const {
    ref: containerRef,
    isInViewport: isVisible,
    prefersReducedMotion,
    canAnimate,
    shouldRunAmbientMotion,
    motionTier,
  } = useViewportMotionGate<HTMLDivElement>({ rootMargin: '96px' });
  const initialIdentity = getVisualIdentity(playbackKey, albumImage);
  const [visualSnapshot, setVisualSnapshot] = useState<VinylVisualSnapshot>(() => ({
    albumImage,
    dominantColor,
    identity: initialIdentity,
    playbackKey: playbackKey || initialIdentity,
    revision: 0,
  }));
  const [phase, setPhase] = useState<VinylPhase>(() => isPlaying ? 'booting' : 'idle');
  const [tonearmState, setTonearmState] = useState<TonearmState>(() => isPlaying ? 'lifted' : 'rest');
  const [spinEnabled, setSpinEnabled] = useState(false);
  const discRef = useRef<HTMLDivElement | null>(null);
  const spinAnimationRef = useRef<Animation | null>(null);
  const rotationRef = useRef(0);
  const previousPlayingRef = useRef(false);
  const visualRevisionRef = useRef(0);
  const visualRequestRef = useRef(0);
  const playbackSequenceRef = useRef(0);
  const albumSwapInFlightRef = useRef(false);
  const manualPlaybackStartRef = useRef(false);
  const shouldAnimateSpin = !prefersReducedMotion;
  const shouldSpin = isPlaying && spinEnabled && phase === 'playing';
  useCompositorLoopTelemetry(canAnimate && (shouldSpin || shouldRunAmbientMotion), 'vinyl');
  const incomingIdentity = getVisualIdentity(playbackKey, albumImage);
  const incomingVisualRef = useRef({ albumImage, dominantColor, identity: incomingIdentity, playbackKey });
  incomingVisualRef.current = { albumImage, dominantColor, identity: incomingIdentity, playbackKey };
  const transitionMotion = useMemo(
    () => getTransitionMotion(!canAnimate),
    [canAnimate]
  );

  const baseDominantColor = useMemo(
    () => normalizeColor(visualSnapshot.dominantColor, '#647062'),
    [visualSnapshot.dominantColor]
  );
  const textureProfile    = useMemo(
    () => getTextureProfile(visualSnapshot.albumImage, baseDominantColor),
    [visualSnapshot.albumImage, baseDominantColor]
  );
  const textureSeed       = textureProfile.seed;
  const textureVariant: number = 0;
  const isMulticolorVinyl = seededValue(textureSeed, 401) >= 0.75;
  const textureName       = isMulticolorVinyl ? 'multicolor' : 'classic';
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
  const resinAlpha        = isPlaying ? 0.27 : 0.225;

  const handleTonearmPlaybackChange = useCallback((nextIsPlaying: boolean) => {
    manualPlaybackStartRef.current = nextIsPlaying;
    onPlaybackIntent?.(nextIsPlaying);
  }, [onPlaybackIntent]);

  useEffect(() => {
    if (incomingIdentity === visualSnapshot.identity) return;

    const requestId = ++visualRequestRef.current;
    let cancelled = false;
    const commitSnapshot = () => {
      if (cancelled || requestId !== visualRequestRef.current) return;
      const nextVisual = incomingVisualRef.current;
      if (nextVisual.identity !== incomingIdentity) return;

      visualRevisionRef.current += 1;
      setVisualSnapshot({
        albumImage: nextVisual.albumImage,
        dominantColor: nextVisual.dominantColor,
        identity: nextVisual.identity,
        playbackKey: nextVisual.playbackKey || nextVisual.identity,
        revision: visualRevisionRef.current,
      });
    };

    const runAlbumSwap = async () => {
      albumSwapInFlightRef.current = true;

      if (canAnimate) {
        setPhase('swapping-album');
        setTonearmState('lifted');
        setSpinEnabled(false);
        await wait(isPlaying ? 460 : 620);
      }

      if (cancelled || requestId !== visualRequestRef.current) return;

      if (albumImage) {
        try {
          await preloadSmartImages([albumImage], {
            limit: 1,
            priority: 'critical',
            timeoutMs: 1400,
          });
        } catch {
          // Keep the previous decoded artwork instead of flashing an unloaded cover.
        }
      }

      commitSnapshot();

      if (!canAnimate) {
        setPhase(isPlaying ? 'playing' : 'idle');
        setTonearmState(isPlaying ? 'playing' : 'rest');
        setSpinEnabled(isPlaying);
        albumSwapInFlightRef.current = false;
        return;
      }

      await wait(560);
      if (cancelled || requestId !== visualRequestRef.current) return;
      if (!isPlaying) {
        setPhase('idle');
        setTonearmState('rest');
        setSpinEnabled(false);
        albumSwapInFlightRef.current = false;
        return;
      }

      setTonearmState('playing');
      await wait(620);
      if (cancelled || requestId !== visualRequestRef.current) return;
      setPhase('playing');
      setSpinEnabled(true);
      albumSwapInFlightRef.current = false;
    };

    void runAlbumSwap();

    return () => {
      cancelled = true;
      albumSwapInFlightRef.current = false;
    };
  }, [albumImage, incomingIdentity, isPlaying, visualSnapshot.identity]);

  useEffect(() => {
    const sequenceId = ++playbackSequenceRef.current;
    let cancelled = false;

    const runPlaybackSequence = async () => {
      if (!isPlaying) {
        setPhase('idle');
        setTonearmState(canAnimate ? 'lifted' : 'rest');
        setSpinEnabled(false);
        if (canAnimate) {
          await wait(360);
        }
        if (cancelled || sequenceId !== playbackSequenceRef.current) return;
        setTonearmState('rest');
        return;
      }

      if (incomingIdentity !== visualSnapshot.identity) return;
      if (albumSwapInFlightRef.current) return;

      if (manualPlaybackStartRef.current) {
        manualPlaybackStartRef.current = false;
        setTonearmState('playing');
        setPhase('playing');
        setSpinEnabled(true);
        return;
      }

      setPhase('booting');
      setSpinEnabled(false);
      setTonearmState(canAnimate ? 'lifted' : 'playing');

      if (canAnimate) await wait(120);
      if (cancelled || sequenceId !== playbackSequenceRef.current) return;

      setTonearmState('playing');
      if (canAnimate) await wait(760);
      if (cancelled || sequenceId !== playbackSequenceRef.current) return;

      setPhase('playing');
      setSpinEnabled(true);
    };

    void runPlaybackSequence();

    return () => {
      cancelled = true;
    };
  }, [incomingIdentity, isPlaying, visualSnapshot.identity]);

  useEffect(() => {
    if (
      visualSnapshot.identity !== incomingIdentity
      || visualSnapshot.dominantColor === dominantColor
    ) return;

    setVisualSnapshot(snapshot => ({
      ...snapshot,
      dominantColor,
    }));
  }, [dominantColor, incomingIdentity, visualSnapshot.dominantColor, visualSnapshot.identity]);

  useEffect(() => {
    const node = discRef.current;
    if (!node) return;
    // Só aplica transform se não houver animação ativa
    if (!spinAnimationRef.current) {
      node.style.transform = `rotate(${rotationRef.current}deg)`;
    }
  }, [visualSnapshot.revision]);

  useEffect(() => {
    const node = discRef.current;

    const startSpinWithAcceleration = (startRotation: number) => {
      if (!node) return;

      const accelAnimation = node.animate(
        [
          { transform: `rotate(${startRotation}deg)` },
          { transform: `rotate(${startRotation + (360 * accelerationRotations)}deg)` }
        ],
        {
          duration: accelerationDuration,
          fill: 'forwards',
          easing: 'cubic-bezier(0.35, 0, 0.65, 0.65)'
        }
      );

      accelAnimation.onfinish = () => {
        rotationRef.current = (startRotation + (360 * accelerationRotations)) % 360;

        if (!node) return;
        spinAnimationRef.current = node.animate(
          [
            { transform: `rotate(${rotationRef.current}deg)` },
            { transform: `rotate(${rotationRef.current + 360}deg)` }
          ],
          {
            duration: steadyRotationDuration,
            iterations: Infinity,
            easing: 'linear'
          }
        );
      };

      spinAnimationRef.current = accelAnimation;
    };

    const stopSpin = (mode: 'instant' | 'decelerate' = 'instant') => {
      const animation = spinAnimationRef.current;
      if (!node) return;

      const currentRotation = getRotationFromTransform(window.getComputedStyle(node).transform);
      if (currentRotation != null) rotationRef.current = currentRotation;

      if (animation) {
        animation.cancel();
        spinAnimationRef.current = null;
      }

      if (mode === 'decelerate' && canAnimate) {
        const baseVelocity = 360 / steadyRotationDuration;
        const decelerationTime = phase === 'swapping-album' ? 720 : 4000;

        // Distância percorrida durante desaceleração ≈ velocidade média × tempo ÷ 2
        const decelerationRotations = (baseVelocity * decelerationTime / 2) / 360;
        const endRotation = rotationRef.current + (360 * decelerationRotations);

        const deceleration = node.animate(
          [
            { transform: `rotate(${rotationRef.current}deg)` },
            { transform: `rotate(${endRotation}deg)` },
          ],
          {
            duration: decelerationTime,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            fill: 'forwards'
          }
        );
        (deceleration as any)._isDecel = true;
        spinAnimationRef.current = deceleration;
        deceleration.onfinish = () => {
          rotationRef.current = endRotation % 360;
          node.style.transform = `rotate(${rotationRef.current}deg)`;
          if (spinAnimationRef.current === deceleration) {
            spinAnimationRef.current = null;
          }
        };
        return;
      }

      // Pause should freeze the physical disc at the captured angle.
      node.style.transform = `rotate(${rotationRef.current}deg)`;
    };

    const isDecelerating = spinAnimationRef.current && (spinAnimationRef.current as any)._isDecel && (spinAnimationRef.current.effect as any)?.target === node;

    if (!node || !shouldAnimateSpin || !shouldSpin) {
      if (isDecelerating && shouldAnimateSpin) {
        previousPlayingRef.current = shouldSpin;
        return;
      }
      const shouldDecelerate = previousPlayingRef.current && !shouldSpin;
      stopSpin(shouldDecelerate ? 'decelerate' : 'instant');
      previousPlayingRef.current = shouldSpin;
      return;
    }

    // Limpar animações obsoletas antes de verificar se deve iniciar nova
    if (spinAnimationRef.current && previousPlayingRef.current !== shouldSpin) {
      spinAnimationRef.current.cancel();
      spinAnimationRef.current = null;
    }

    // Se já está tocando e o estado não mudou, não reiniciar animação
    if (previousPlayingRef.current === shouldSpin && spinAnimationRef.current) {
      return;
    }

    stopSpin('instant');
    const startRotation = rotationRef.current;
    startSpinWithAcceleration(startRotation);
    previousPlayingRef.current = shouldSpin;
    return () => stopSpin('instant');
  }, [phase, shouldAnimateSpin, shouldSpin]);

  useEffect(() => {
    const animation = spinAnimationRef.current;
    if (!animation || !shouldSpin) return;
    if (canAnimate && isVisible) animation.play();
    else animation.pause();
  }, [canAnimate, isVisible, shouldSpin]);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square flex items-center justify-center"
      data-vinyl-variant={textureName}
      data-vinyl-playback-key={visualSnapshot.playbackKey}
      data-vinyl-playing={shouldSpin ? "true" : "false"}
      data-vinyl-phase={phase}
      data-vinyl-visual-key={visualSnapshot.identity}
    >
      <>

      {/* ── PENUMBRA IDLE — atrás do disco ──────────────────────── */}
      <AnimatePresence>
        {!shouldSpin && shouldRunAmbientMotion && (
          <div
            className="stats-lc-engine-loop vinyl-record-aura absolute inset-[-8%] rounded-full pointer-events-none z-0"
            data-active="true"
            style={{
              background: `radial-gradient(circle at center, ${withAlpha(safeDominantColor, 0.22)} 0%, ${withAlpha(safeDominantColor, 0.1)} 38%, transparent 72%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── DISCO ───────────────────────────────────────────────── */}
      <AnimatePresence initial={canAnimate} mode="sync">
      <motion.div
        key={visualSnapshot.identity}
        data-vinyl-visual={visualSnapshot.identity}
        className="absolute inset-0 z-10 touch-none"
        style={{ touchAction: 'none' }}
        initial={transitionMotion.initial}
        animate={transitionMotion.animate}
        exit={transitionMotion.exit}
        transition={transitionMotion.transition}
      >
      <div
        className={`relative h-full w-full ${!shouldSpin && shouldRunAmbientMotion ? "stats-lc-engine-loop vinyl-record-idle" : ""}`}
        data-active={!shouldSpin && shouldRunAmbientMotion ? "true" : "false"}
      >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[4%] w-[4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70" />
      <div
        ref={(node) => {
          if (node) discRef.current = node;
        }}
        className="relative h-full w-full overflow-hidden rounded-full shadow-2xl flex items-center justify-center"
        style={{
          background: `
            radial-gradient(circle at center, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.18) 18%, transparent 19%),
            radial-gradient(circle at 33% 25%, ${withAlpha(lightColor, textureVariant === 0 ? 0.18 : 0.14)} 0%, transparent 46%),
            radial-gradient(circle at 72% 80%, ${withAlpha(darkColor, textureVariant === 1 ? 0.22 : 0.06)} 0%, transparent 50%),
            radial-gradient(circle at 58% 7%, rgba(255,255,255,0.035) 0%, transparent 34%),
            conic-gradient(
              from ${118 + textureVariant * 34}deg,
              ${withAlpha(safeDominantColor, textureVariant === 2 ? 0.28 : resinAlpha)} 0deg,
              ${withAlpha(lightColor, textureVariant === 2 ? 0.12 : 0.1)} 46deg,
              ${withAlpha(safeDominantColor, textureVariant === 2 ? 0.26 : resinAlpha - 0.06)} 118deg,
              ${withAlpha(darkColor, 0.08)} 174deg,
              ${withAlpha(lightColor, textureVariant === 2 ? 0.12 : 0.11)} 232deg,
              ${withAlpha(safeDominantColor, textureVariant === 2 ? 0.26 : resinAlpha - 0.06)} 304deg,
              ${withAlpha(safeDominantColor, textureVariant === 2 ? 0.28 : resinAlpha)} 360deg
            )
          `,
          isolation: 'isolate',
          contain: 'paint',
          maskImage: 'radial-gradient(circle at center, transparent 2%, rgba(0,0,0,0.55) 2.14%, black 2.35%)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 2%, rgba(0,0,0,0.55) 2.14%, black 2.35%)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transformOrigin: 'center center',
          transform: `rotate(${rotationRef.current}deg)`,
          willChange: canAnimate ? 'transform' : 'auto',
          transition: shouldSpin ? 'filter 0.45s ease, box-shadow 0.45s ease, opacity 0.45s ease' : 'filter 0.65s ease, box-shadow 0.65s ease, opacity 0.65s ease',
          opacity: isPlaying ? 1 : 0.82,
          filter: shouldSpin ? 'brightness(1.08) saturate(1.08)' : 'none',
          boxShadow: shouldSpin
            ? `0 0 24px ${withAlpha(safeDominantColor, 0.32)}, 0 0 48px ${withAlpha(safeDominantColor, 0.18)}`
            : 'none'
        }}
      >
        {visualSnapshot.albumImage && (
          <div
            className="absolute rounded-full pointer-events-none z-[10]"
            style={{
              inset: isMulticolorVinyl
                ? motionTier === 'conserve'
                  ? '-6%'
                  : motionTier === 'balanced'
                    ? '-9%'
                    : '-12%'
                : motionTier === 'conserve'
                  ? '-12%'
                  : motionTier === 'balanced'
                    ? '-18%'
                    : '-24%',
              backgroundImage: `url("${visualSnapshot.albumImage}")`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
              filter: isMulticolorVinyl
                ? motionTier === 'conserve'
                  ? 'blur(8px) saturate(1.75) contrast(1.08)'
                  : motionTier === 'balanced'
                    ? 'blur(11px) saturate(2) contrast(1.1)'
                    : 'blur(14px) saturate(2.2) contrast(1.12)'
                : motionTier === 'conserve'
                  ? 'blur(16px) saturate(1.65) contrast(1.08)'
                  : motionTier === 'balanced'
                    ? 'blur(24px) saturate(1.9) contrast(1.11)'
                    : 'blur(34px) saturate(2.1) contrast(1.14)',
              mixBlendMode: 'color',
              opacity: isMulticolorVinyl
                ? (shouldSpin ? 0.9 : 0.72)
                : (shouldSpin ? 0.82 : 0.68),
            }}
          />
        )}
        {/* Camada base translúcida do vinil. */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-[11]"
          style={{
            background: textureVariant === 1
              ? 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.1) 0%, transparent 50%)'
              : 'radial-gradient(circle at 50% 50%, transparent 0 52%, rgba(255,255,255,0.05) 78%, transparent 100%)',
            mixBlendMode: 'multiply',
            opacity: 0.34,
          }}
        />

        {/* Resina externa mais translúcida, como o vinil físico fora do rótulo. */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-[13]"
          style={{
            background: `
              radial-gradient(circle at 36% 24%, rgba(255,255,255,0.18) 0%, transparent 26%),
              radial-gradient(circle at center, transparent 0 31%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0.015) 72%, transparent 100%)
            `,
            mixBlendMode: 'screen',
            opacity: shouldSpin ? 0.68 : 0.56,
          }}
        />

        {/* Reflexo plástico principal. */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-[15]"
          style={{
            background: 'conic-gradient(from 35deg, transparent 0deg, rgba(255,255,255,0.12) 12deg, transparent 28deg, transparent 180deg, rgba(255,255,255,0.12) 192deg, transparent 208deg)',
            mixBlendMode: 'screen',
            opacity: shouldSpin ? 0.78 : 0.58,
            transition: 'opacity 0.5s ease',
          }}
        />

        {/* Sulcos e texturas específicas. */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full pointer-events-none"
          style={{ zIndex: 14, opacity: shouldSpin ? 1 : 0.85 }}
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
            <circle cx="50" cy="50" r="32.0" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.35" opacity="0.12" />
            <circle cx="50" cy="50" r="43" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="0.7" opacity="0.15" />
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

        {/* Faixa transparente do vinil, desenhada como anel físico logo fora do rótulo. */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full pointer-events-none"
          style={{ zIndex: 16 }}
        >
          <circle
            cx="50"
            cy="50"
            r="31"
            fill="none"
            stroke="rgba(0,0,0,0.115)"
            strokeWidth="7.8"
            opacity={shouldSpin ? 0.46 : 0.38}
          />
          <circle
            cx="50"
            cy="50"
            r="26.55"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.1"
            opacity={shouldSpin ? 0.62 : 0.54}
          />
        </svg>

        <div className="stats-lc-grain stats-lc-vinyl-grain absolute inset-0 rounded-full pointer-events-none z-[17]" />

        {/* Furo central do disco, visível fora do rótulo quando a capa ainda não carregou. */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-15"
          style={{
            width: '7.5%',
            height: '7.5%',
            background: 'radial-gradient(circle at 45% 42%, rgba(255,255,255,0.22) 0%, rgba(42,38,42,0.88) 36%, rgba(20,18,20,0.9) 100%)',
            boxShadow: 'inset 0 0 7px rgba(0,0,0,0.58), 0 0 0 0.65px rgba(255,255,255,0.14)',
          }}
        />

        {/* ── CAPA DO ÁLBUM ──────────────────────────────────────── */}
        <div className="absolute inset-[24%] rounded-full overflow-hidden z-20 flex items-center justify-center bg-stone-900">
            <div className="w-full h-full absolute inset-0 flex items-center justify-center">
              {visualSnapshot.albumImage ? (
                <div className="w-full h-full relative">
                  <SmartImage
                    src={visualSnapshot.albumImage}
                    className="w-full h-full object-cover"
                    fallback="💿"
                    rounded="full"
                  />
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: 'transparent' }}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900 z-10">
                  <div className="w-2/3 h-2/3 rounded-full border border-white/5 bg-stone-800 flex items-center justify-center shadow-lg">
                    <Disc className="stats-lc-engine-loop w-1/2 h-1/2 text-white/20 animate-pulse-slow" />
                  </div>
                </div>
              )}
            </div>

          {/* Escurecimento da capa no idle — como luz apagando */}
          <AnimatePresence>
            {!shouldSpin && (
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

      </div>
      </div>
      </motion.div>
      </AnimatePresence>
      </>

      {!hideTonearm && (
        <VinylTonearm
          state={tonearmState}
          isPlaying={isPlaying}
          playbackKey={visualSnapshot.playbackKey}
          shouldRunAmbientMotion={shouldRunAmbientMotion}
          onUserPlaybackChange={handleTonearmPlaybackChange}
        />
      )}

    </div>
  );
};
