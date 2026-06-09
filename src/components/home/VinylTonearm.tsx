import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface VinylTonearmProps {
  isPlaying: boolean;
  onUserPlaybackChange?: (isPlaying: boolean) => void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const VinylTonearm = ({ isPlaying, onUserPlaybackChange }: VinylTonearmProps) => {
  const uniqueId = useId();
  const [level, setLevel] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const levelRef = useRef(0.5);
  const isDraggingRef = useRef(false);

  const pivotX = 62;
  const pivotY = -15;
  const armLength = 49;
  const idleAngle = 161;
  const playingAngle = 143;
  const angle = idleAngle + (playingAngle - idleAngle) * level;
  const transition = { duration: 0.72, ease: [0.16, 1, 0.3, 1] as const };
  const angleRadians = angle * Math.PI / 180;
  const unitX = Math.cos(angleRadians);
  const unitY = Math.sin(angleRadians);
  const perpX = -unitY;
  const perpY = unitX;
  const pointAt = (distance: number, offset = 0) => ({
    x: pivotX + unitX * distance + perpX * offset,
    y: pivotY + unitY * distance + perpY * offset,
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
  const shadowYOffset = 2.65;
  const shadowXOffset = 0.15;
  const finalArmShadowStart = pointAt(42.2);
  const finalArmShadowEnd = pointAt(55.3);
  const collarPoints = polygonPoints([
    [42.8, -1.55],
    [50.8, -1.55],
    [50.8, 1.55],
    [42.8, 1.55],
  ]);
  const headPoints = polygonPoints([
    [49.4, -2.45],
    [56.6, -2.18],
    [56.2, 2.48],
    [49.1, 2.2],
  ]);
  const headShadowPoints = translatedPolygonPoints([
    [49.4, -2.45],
    [56.6, -2.18],
    [56.2, 2.48],
    [49.1, 2.2],
  ], shadowXOffset, shadowYOffset);
  const headHighlight = polygonPoints([
    [50.3, -1.35],
    [55.3, -1.14],
    [55.2, -0.52],
    [50.2, -0.74],
  ]);
  const needleStart = pointAt(56.2, -2.12);
  const needleEnd = pointAt(56.88, -2.76);

  useEffect(() => {
    if (isDraggingRef.current) return;
    const nextLevel = isPlaying ? 1 : 0;
    levelRef.current = nextLevel;
    setLevel(nextLevel);
  }, [isPlaying]);

  const updateFromPointer = (event: ReactPointerEvent<SVGGElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;

    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    const pointerAngle = Math.atan2(pointerY - pivotY, pointerX - pivotX) * 180 / Math.PI;
    const nextLevel = clamp01((idleAngle - pointerAngle) / (idleAngle - playingAngle));
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
          <filter id={`${uniqueId}-tonearm-shadow`} x="-50%" y="-80%" width="220%" height="260%">
            <feGaussianBlur stdDeviation="1.05" />
          </filter>
        </defs>

        <g
          className="pointer-events-auto cursor-grab touch-none active:cursor-grabbing"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation();
            isDraggingRef.current = true;
            setIsDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (!isDraggingRef.current) return;
            updateFromPointer(event);
          }}
          onPointerUp={(event) => {
            isDraggingRef.current = false;
            setIsDragging(false);
            event.currentTarget.releasePointerCapture(event.pointerId);
            commitPointerLevel();
          }}
          onPointerCancel={() => {
            isDraggingRef.current = false;
            setIsDragging(false);
            const nextLevel = isPlaying ? 1 : 0;
            levelRef.current = nextLevel;
            setLevel(nextLevel);
          }}
        >
          <g transform={`translate(${pivotX} ${pivotY}) rotate(34)`}>
            <circle
              cx="0"
              cy="0"
              r="14.2"
              fill="rgba(255,255,255,0.035)"
              stroke="rgba(0,0,0,0.26)"
              strokeWidth="0.7"
            />
            <circle
              cx="0"
              cy="0"
              r="12.2"
              fill="transparent"
              stroke="rgba(255,255,255,0.055)"
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
            animate={isPlaying && !isDragging
              ? { rotate: [0, 1.4, -0.65, 0.82, 0], transformOrigin: `${pivotX}px ${pivotY}px` }
              : { rotate: 0, transformOrigin: `${pivotX}px ${pivotY}px` }
            }
            transition={isPlaying && !isDragging
              ? { duration: 5.1, times: [0, 0.22, 0.52, 0.78, 1], repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
          >
          <motion.line
            x1={pivotX}
            y1={pivotY}
            stroke="transparent"
            strokeWidth="7"
            strokeLinecap="round"
            animate={{ x2: armEnd.x, y2: armEnd.y }}
            transition={transition}
          />
          <g filter={`url(#${uniqueId}-tonearm-shadow)`} opacity="0.34">
            <motion.line
              x1={finalArmShadowStart.x + shadowXOffset}
              y1={finalArmShadowStart.y + shadowYOffset}
              stroke="rgba(0,0,0,0.48)"
              strokeWidth="1.9"
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
              fill="rgba(0,0,0,0.46)"
            />
          </g>
          <motion.line
            x1={pivotX}
            y1={pivotY}
            stroke="rgba(0,0,0,0.72)"
            strokeWidth="1.46"
            strokeLinecap="round"
            animate={{ x2: armEnd.x, y2: armEnd.y }}
            transition={transition}
          />
          <motion.line
            x1={pivotX}
            y1={pivotY}
            stroke="#c4cad2"
            strokeWidth="0.94"
            strokeLinecap="round"
            animate={{ x2: armEnd.x, y2: armEnd.y }}
            transition={transition}
          />

          <motion.polygon points={collarPoints} animate={{ points: collarPoints }} transition={transition} fill="#17181c" stroke="rgba(255,255,255,0.1)" strokeWidth="0.28" />
          <motion.polygon
            points={polygonPoints([
              [49.6, 3.35],
              [56.9, 3.6],
              [56.5, 5.28],
              [49.2, 5.02],
            ])}
            animate={{
              points: polygonPoints([
                [49.6, 3.35],
                [56.9, 3.6],
                [56.5, 5.28],
                [49.2, 5.02],
              ])
            }}
            transition={transition}
            fill="rgba(0,0,0,0.13)"
          />
          <motion.polygon points={headPoints} animate={{ points: headPoints }} transition={transition} fill={`url(#${uniqueId}-tonearm-head)`} stroke="rgba(255,255,255,0.12)" strokeWidth="0.32" />
          <motion.polygon points={headHighlight} animate={{ points: headHighlight }} transition={transition} fill="rgba(255,255,255,0.08)" />
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
            stroke="rgba(251,146,60,0.78)"
            strokeWidth="0.36"
            strokeLinecap="round"
          />
          <motion.circle
            cx={needleEnd.x}
            cy={needleEnd.y}
            r="0.16"
            animate={{ cx: needleEnd.x, cy: needleEnd.y }}
            transition={transition}
            fill="rgba(254,215,170,0.82)"
          />
          </motion.g>
        </g>
      </motion.svg>
    </AnimatePresence>
  );
};
