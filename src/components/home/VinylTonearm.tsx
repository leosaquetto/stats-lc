import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { motionRuntime } from '../../lib/motionRuntime';

interface VinylTonearmProps {
  isPlaying?: boolean;
  playbackKey?: string;
  shouldRunAmbientMotion?: boolean;
  state?: 'rest' | 'lifted' | 'playing';
  onUserPlaybackChange?: (isPlaying: boolean, level: number) => void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const VinylTonearm = ({
  isPlaying = false,
  playbackKey,
  shouldRunAmbientMotion = true,
  state,
  onUserPlaybackChange,
}: VinylTonearmProps) => {
  const uniqueId = useId();
  const shouldReduceMotion = useReducedMotion();
  const [level, setLevel] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [isManuallyPositioned, setIsManuallyPositioned] = useState(false);
  const levelRef = useRef(0.5);
  const isDraggingRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tonearmState = state ?? (isPlaying ? 'playing' : 'rest');

  const pivotX = 60;
  const pivotY = -18;
  const armReachBoost = isManuallyPositioned
    ? 2.35 * level
    : tonearmState === 'playing'
      ? 2.35
      : tonearmState === 'lifted'
        ? 1.05
        : 0;
  const armLength = 47.2 + armReachBoost;
  // SVG angles use the browser coordinate plane: 0deg points right, 90deg points down.
  // Pivot lives at the tonearm mount. Rest stays outside the record; lifted hovers near the groove.
  const restAngle = 154;
  const liftedAngle = 139;
  const playAngle = 132.5;
  const angle = restAngle + (playAngle - restAngle) * level;
  const liftOffset = !isManuallyPositioned && tonearmState === 'lifted' ? -2.2 : 0;
  const liftScale = !isManuallyPositioned && tonearmState === 'lifted' ? 0.992 : 1;
  const liftOpacity = isManuallyPositioned
    ? 0.62 + level * 0.34
    : tonearmState === 'rest'
      ? 0.58
      : tonearmState === 'lifted'
        ? 0.88
        : 0.96;
  const transition = {
    duration: isDragging ? 0 : isManuallyPositioned ? 0.18 : 0.72,
    ease: [0.16, 1, 0.3, 1] as const,
  };
  const shouldGrooveDrift = isPlaying && level >= 0.58 && shouldRunAmbientMotion && !isDragging && !shouldReduceMotion;
  const tonearmGroupTransition = {
    duration: isDragging ? 0 : isManuallyPositioned ? 0.18 : tonearmState === 'rest' ? 0 : 0.72,
    ease: [0.16, 1, 0.3, 1] as const,
  };
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
    if (isDraggingRef.current || isManuallyPositioned) return;
    const nextLevel = getTargetLevel();
    levelRef.current = nextLevel;
    setLevel(nextLevel);
  }, [isManuallyPositioned, tonearmState]);

  useEffect(() => {
    setIsManuallyPositioned(false);
    const nextLevel = getTargetLevel();
    levelRef.current = nextLevel;
    setLevel(nextLevel);
  }, [playbackKey]);

  useEffect(() => {
    if (!shouldGrooveDrift) return undefined;
    return motionRuntime.registerCompositorLoop('tonearm');
  }, [shouldGrooveDrift]);

  const updateFromClientPoint = (clientX: number, clientY: number, svgElement: SVGSVGElement | null) => {
    const rect = svgElement?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;

    const pointerX = ((clientX - rect.left) / rect.width) * 100;
    const pointerY = ((clientY - rect.top) / rect.height) * 100;
    const pointerAngle = Math.atan2(pointerY - pivotY, pointerX - pivotX) * 180 / Math.PI;
    const nextLevel = clamp01((pointerAngle - restAngle) / (playAngle - restAngle));
    levelRef.current = nextLevel;
    setLevel(nextLevel);
  };

  const updateFromPointer = (event: ReactPointerEvent<SVGGElement>) => {
    updateFromClientPoint(event.clientX, event.clientY, event.currentTarget.ownerSVGElement);
  };

  const updateFromMouse = (event: ReactMouseEvent<SVGGElement>) => {
    updateFromClientPoint(event.clientX, event.clientY, event.currentTarget.ownerSVGElement);
  };

  const commitPointerLevel = () => {
    const nextIsPlaying = levelRef.current >= 0.58;
    setIsManuallyPositioned(true);
    setLevel(levelRef.current);
    if (nextIsPlaying !== isPlaying) {
      onUserPlaybackChange?.(nextIsPlaying, levelRef.current);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const moveWindowDrag = (event: PointerEvent) => {
      if (!isDraggingRef.current) return;
      updateFromClientPoint(event.clientX, event.clientY, svgRef.current);
    };

    const moveWindowMouseDrag = (event: MouseEvent) => {
      if (!isDraggingRef.current) return;
      updateFromClientPoint(event.clientX, event.clientY, svgRef.current);
    };

    const finishWindowDrag = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      commitPointerLevel();
    };

    window.addEventListener('pointermove', moveWindowDrag);
    window.addEventListener('pointerup', finishWindowDrag);
    window.addEventListener('pointercancel', finishWindowDrag);
    window.addEventListener('mousemove', moveWindowMouseDrag);
    window.addEventListener('mouseup', finishWindowDrag);

    return () => {
      window.removeEventListener('pointermove', moveWindowDrag);
      window.removeEventListener('pointerup', finishWindowDrag);
      window.removeEventListener('pointercancel', finishWindowDrag);
      window.removeEventListener('mousemove', moveWindowMouseDrag);
      window.removeEventListener('mouseup', finishWindowDrag);
    };
  }, [isDragging, isPlaying]);

  return (
    <AnimatePresence>
      <motion.svg
        ref={svgRef}
        className="pointer-events-none absolute inset-0"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        data-tonearm-state={tonearmState}
        data-tonearm-level={level.toFixed(3)}
        data-tonearm-dragging={isDragging ? 'true' : 'false'}
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
          onMouseDown={(event) => {
            if (isDraggingRef.current) return;
            event.stopPropagation();
            event.preventDefault();
            isDraggingRef.current = true;
            setIsDragging(true);
            updateFromMouse(event);
          }}
          onMouseMove={(event) => {
            if (!isDraggingRef.current) return;
            event.preventDefault();
            updateFromMouse(event);
          }}
          onMouseUp={(event) => {
            if (!isDraggingRef.current) return;
            event.preventDefault();
            isDraggingRef.current = false;
            setIsDragging(false);
            commitPointerLevel();
          }}
          onPointerDown={(event) => {
            if (isDraggingRef.current) return;
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
            animate={{ opacity: liftOpacity, scale: liftScale }}
            transition={tonearmGroupTransition}
            style={{ transformOrigin: `${pivotX}px ${pivotY}px` }}
          >
          <g
            className="stats-lc-engine-loop stats-lc-engine-tonearm-drift"
            data-active={shouldGrooveDrift ? 'true' : 'false'}
            style={{ transformOrigin: `${pivotX}px ${pivotY}px` }}
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
          </g>
          </motion.g>
        </g>
      </motion.svg>
    </AnimatePresence>
  );
};
