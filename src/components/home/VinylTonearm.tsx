import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface VinylTonearmProps {
  isPlaying?: boolean;
  state?: 'rest' | 'lifted' | 'playing';
  onUserPlaybackChange?: (isPlaying: boolean) => void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const VinylTonearm = ({ isPlaying = false, state, onUserPlaybackChange }: VinylTonearmProps) => {
  const uniqueId = useId();
  const [level, setLevel] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const levelRef = useRef(0.5);
  const isDraggingRef = useRef(false);
  const tonearmState = state ?? (isPlaying ? 'playing' : 'rest');

  const pivotX = 60;
  const pivotY = -18;
  const armReachBoost = tonearmState === 'playing' ? 2.35 : tonearmState === 'lifted' ? 1.05 : 0;
  const armLength = 47.2 + armReachBoost;
  // SVG angles use the browser coordinate plane: 0deg points right, 90deg points down.
  // Pivot lives at the tonearm mount. Rest stays outside the record; lifted hovers near the groove.
  const restAngle = 154;
  const liftedAngle = 139;
  const playAngle = 132.5;
  const angle = restAngle + (playAngle - restAngle) * level;
  const liftOffset = tonearmState === 'lifted' ? -2.2 : 0;
  const liftScale = tonearmState === 'lifted' ? 0.992 : 1;
  const liftOpacity = tonearmState === 'rest' ? 0.58 : tonearmState === 'lifted' ? 0.88 : 0.96;
  const transition = { duration: 0.72, ease: [0.16, 1, 0.3, 1] as const };
  const angleRadians = angle * Math.PI / 180;
  const unitX = Math.cos(angleRadians);
  const unitY = Math.sin(angleRadians);
  const perpX = -unitY;
  const perpY = unitX;
  const pointAt = (distance: number, offset = 0) => ({
    x: pivotX + unitX * distance + perpX * offset,
    y: pivotY + unitY * distance + perpY * offset + liftOffset,
  });
  const polygonPoints = (corners: Array<[number, number]>) =>
    corners
      .map(([distance, offset]) => {
        const point = pointAt(distance, offset);
        return `${point.x},${point.y}`;
      })
      .join(' ');
  const translatedPolygonPoints = (corners: Array<[number, number]>, dx: number, dy: number) =>
    corners
      .map(([distance, offset]) => {
        const point = pointAt(distance, offset);
        return `${point.x + dx},${point.y + dy}`;
      })
      .join(' ');
  const armEnd = pointAt(armLength);
  const armShadowYOffset = 2.4;
  const shadowYOffset = 3.05;
  const shadowXOffset = 0.2;
  const finalArmShadowStart = pointAt(46.8);
  const finalArmShadowEnd = pointAt(55.1 + armReachBoost);
  const collarPoints = polygonPoints([
    [43.2, -1.65],
    [52.1 + armReachBoost, -1.65],
    [52.1 + armReachBoost, 1.65],
    [43.2, 1.65],
  ]);
  const headPoints = polygonPoints([
    [50.0 + armReachBoost, -2.58],
    [58.4 + armReachBoost, -2.12],
    [57.8 + armReachBoost, 2.56],
    [49.6 + armReachBoost, 2.22],
  ]);
  const headShadowPoints = translatedPolygonPoints([
    [50.0 + armReachBoost, -2.58],
    [58.4 + armReachBoost, -2.12],
    [57.8 + armReachBoost, 2.56],
    [49.6 + armReachBoost, 2.22],
  ], shadowXOffset, shadowYOffset);
  const headHighlight = polygonPoints([
    [51.1 + armReachBoost, -1.28],
    [56.7 + armReachBoost, -1.02],
    [56.6 + armReachBoost, -0.44],
    [51.0 + armReachBoost, -0.7],
  ]);
  const needleStart = pointAt(57.5 + armReachBoost, -2.06);
  const needleEnd = pointAt(58.95 + armReachBoost, -2.92);
  const getTargetLevel = () => {
    if (tonearmState === 'playing') return 1;
    if (tonearmState === 'lifted') return (liftedAngle - restAngle) / (playAngle - restAngle);
    return 0;
  };

  useEffect(() => {
    if (isDraggingRef.current) return;
    const nextLevel = getTargetLevel();
    levelRef.current = nextLevel;
    setLevel(nextLevel);
  }, [tonearmState]);

  const updateFromPointer = (event: ReactPointerEvent<SVGGElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;

    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    const pointerAngle = Math.atan2(pointerY - pivotY, pointerX - pivotX) * 180 / Math.PI;
    const nextLevel = clamp01((pointerAngle - restAngle) / (playAngle - restAngle));
    levelRef.current = nextLevel;
    setLevel(nextLevel);
  };

  const commitPointerLevel = () => {
    const nextIsPlaying = levelRef.current >= 0.58;
    const targetLevel = nextIsPlaying ? 1 : 0;
    levelRef.current = targetLevel;
    setLevel(targetLevel);
    if (nextIsPlaying !== isPlaying) {
      onUserPlaybackChange?.(nextIsPlaying);
    }
  };

  return (
    <AnimatePresence>
      <motion.svg
        className="pointer-events-none absolute inset-0"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 80, overflow: 'visible' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <defs>
          <linearGradient id={`${uniqueId}-tonearm-metal`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#949ca8" />
            <stop offset="42%" stopColor="#596273" />
            <stop offset="72%" stopColor="#8a92a0" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <radialGradient id={`${uniqueId}-tonearm-head`} cx="38%" cy="25%" r="85%">
            <stop offset="0%" stopColor="#2b2c30" />
            <stop offset="62%" stopColor="#111216" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <filter id={`${uniqueId}-tonearm-shadow`} x="-50%" y="-80%" width="220%" height="260%">
            <feGaussianBlur stdDeviation="1.05" />
          </filter>
        </defs>

        <g
          data-vinyl-tonearm-control="true"
          className="pointer-events-auto cursor-grab touch-none active:cursor-grabbing"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            isDraggingRef.current = true;
            setIsDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event);
          }}
          onPointerMove={(event) => {
            event.preventDefault();
            if (!isDraggingRef.current) return;
            updateFromPointer(event);
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            isDraggingRef.current = false;
            setIsDragging(false);
            event.currentTarget.releasePointerCapture(event.pointerId);
            commitPointerLevel();
          }}
          onPointerCancel={(event) => {
            event.preventDefault();
            isDraggingRef.current = false;
            setIsDragging(false);
            const nextLevel = getTargetLevel();
            levelRef.current = nextLevel;
            setLevel(nextLevel);
          }}
        >
          <g transform={`translate(${pivotX} ${pivotY}) rotate(34)`}>
            <circle
              cx="0"
              cy="0"
              r="14.2"
              fill="rgba(255,255,255,0.026)"
              stroke="rgba(0,0,0,0.26)"
              strokeWidth="0.7"
            />
            <circle
              cx="0"
              cy="0"
              r="12.2"
              fill="transparent"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.42"
            />
            <rect
              x="-5.4"
              y="-4.1"
              width="10.8"
              height="8.9"
              rx="1.6"
              fill={`url(#${uniqueId}-tonearm-head)`}
              stroke="rgba(255,255,255,0.075)"
              strokeWidth="0.24"
            />
            <rect x="1.6" y="-5.45" width="5.1" height="4.7" rx="1" fill="#101115" />
            <rect x="-3.55" y="3.2" width="7.1" height="3.2" rx="1.1" fill="#0c0d10" />
            <rect x="-5.55" y="0.5" width="2.15" height="5.4" rx="0.8" fill="#111216" />
          </g>

          <motion.g
            animate={tonearmState === 'playing' && !isDragging
              ? { rotate: [0, 0.68, -0.38, 0.42, 0], opacity: liftOpacity, scale: liftScale, transformOrigin: `${pivotX}px ${pivotY}px` }
              : { rotate: 0, opacity: liftOpacity, scale: liftScale, transformOrigin: `${pivotX}px ${pivotY}px` }
            }
            transition={tonearmState === 'playing' && !isDragging
              ? { duration: 5.1, times: [0, 0.22, 0.52, 0.78, 1], repeat: Infinity, ease: 'easeInOut' }
              : { duration: tonearmState === 'rest' ? 0 : 0.72, ease: [0.16, 1, 0.3, 1] }
            }
          >
          <motion.line
            x1={pivotX}
            y1={pivotY}
            stroke="transparent"
            strokeWidth="15"
            strokeLinecap="round"
            animate={{ x2: armEnd.x, y2: armEnd.y }}
            transition={transition}
          />
          <motion.line
            x1={pivotX - 4}
            y1={pivotY + 1}
            stroke="transparent"
            strokeWidth="18"
            strokeLinecap="round"
            animate={{ x2: needleEnd.x + 4, y2: needleEnd.y + 4 }}
            transition={transition}
          />
          <motion.line
            x1={pivotX}
            y1={pivotY + armShadowYOffset}
            stroke="rgba(0,0,0,0.34)"
            strokeWidth="1.7"
            strokeLinecap="round"
            filter={`url(#${uniqueId}-tonearm-shadow)`}
            animate={{
              x2: armEnd.x,
              y2: armEnd.y + armShadowYOffset,
            }}
            transition={transition}
          />
          <g filter={`url(#${uniqueId}-tonearm-shadow)`} opacity={isDragging ? 0.14 : 0.26}>
            <motion.line
              x1={finalArmShadowStart.x + shadowXOffset}
              y1={finalArmShadowStart.y + shadowYOffset}
              stroke="rgba(0,0,0,0.42)"
              strokeWidth="1.25"
              strokeLinecap="round"
              animate={{
                x1: finalArmShadowStart.x + shadowXOffset,
                y1: finalArmShadowStart.y + shadowYOffset,
                x2: finalArmShadowEnd.x + shadowXOffset,
                y2: finalArmShadowEnd.y + shadowYOffset,
              }}
              transition={transition}
            />
            <motion.polygon
              points={headShadowPoints}
              animate={{ points: headShadowPoints }}
              transition={transition}
              fill="rgba(0,0,0,0.42)"
            />
          </g>
          <motion.line
            x1={pivotX}
            y1={pivotY}
            stroke={`url(#${uniqueId}-tonearm-metal)`}
            strokeWidth="1.22"
            strokeLinecap="round"
            animate={{ x2: armEnd.x, y2: armEnd.y }}
            transition={transition}
          />

          <motion.polygon points={collarPoints} animate={{ points: collarPoints }} transition={transition} fill="#121318" stroke="rgba(255,255,255,0.07)" strokeWidth="0.28" />
          <motion.polygon points={headPoints} animate={{ points: headPoints }} transition={transition} fill={`url(#${uniqueId}-tonearm-head)`} stroke="rgba(255,255,255,0.08)" strokeWidth="0.32" />
          <motion.polygon points={headHighlight} animate={{ points: headHighlight }} transition={transition} fill="rgba(255,255,255,0.045)" />
          <motion.line
            x1={needleStart.x}
            y1={needleStart.y}
            x2={needleEnd.x}
            y2={needleEnd.y}
            animate={{
              x1: needleStart.x,
              y1: needleStart.y,
              x2: needleEnd.x,
              y2: needleEnd.y,
            }}
            transition={transition}
            stroke="rgba(217,119,6,0.78)"
            strokeWidth="0.36"
            strokeLinecap="round"
          />
          <motion.circle
            cx={needleEnd.x}
            cy={needleEnd.y}
            r="0.16"
            animate={{ cx: needleEnd.x, cy: needleEnd.y }}
            transition={transition}
            fill="rgba(251,146,60,0.78)"
          />
          </motion.g>
        </g>
      </motion.svg>
    </AnimatePresence>
  );
};
