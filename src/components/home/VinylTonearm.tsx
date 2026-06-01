import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface VinylTonearmProps {
  isPlaying: boolean;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const VinylTonearm = ({ isPlaying }: VinylTonearmProps) => {
  const uniqueId = useId();
  const [level, setLevel] = useState(0.5);
  const isDraggingRef = useRef(false);

  const pivotX = 62;
  const pivotY = -15;
  const armLength = 49;
  const idleAngle = 161;
  const playingAngle = 143;
  const angle = idleAngle + (playingAngle - idleAngle) * level;
  const cartridgeRotation = angle - 103;
  const transition = { duration: 0.72, ease: [0.16, 1, 0.3, 1] as const };
  const pointForAngle = (nextAngle: number) => {
    const angleRadians = nextAngle * Math.PI / 180;
    return {
      x: pivotX + Math.cos(angleRadians) * armLength,
      y: pivotY + Math.sin(angleRadians) * armLength,
    };
  };
  const armEnd = pointForAngle(angle);
  const playbackAngles = isPlaying
    ? [angle - 1.15, angle + 0.85, angle - 0.6, angle + 1.05, angle - 1.15]
    : null;
  const playbackPoints = playbackAngles?.map(pointForAngle);
  const playbackRotations = playbackAngles?.map((nextAngle) => nextAngle - 103);
  const playbackTransition = playbackAngles
    ? { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const }
    : transition;

  useEffect(() => {
    if (isDraggingRef.current) return;
    setLevel(isPlaying ? 1 : 0);
  }, [isPlaying]);

  const updateFromPointer = (event: ReactPointerEvent<SVGGElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;

    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    const pointerAngle = Math.atan2(pointerY - pivotY, pointerX - pivotX) * 180 / Math.PI;
    setLevel(clamp01((idleAngle - pointerAngle) / (idleAngle - playingAngle)));
  };

  return (
    <AnimatePresence>
      <motion.svg
        className="pointer-events-none absolute inset-0"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 80, overflow: 'visible', filter: 'drop-shadow(0 9px 18px rgba(0,0,0,0.78))' }}
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
        </defs>

        <g
          className="pointer-events-auto cursor-grab touch-none active:cursor-grabbing"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation();
            isDraggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (!isDraggingRef.current) return;
            updateFromPointer(event);
          }}
          onPointerUp={(event) => {
            isDraggingRef.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            isDraggingRef.current = false;
          }}
        >
          <g transform={`translate(${pivotX} ${pivotY}) rotate(34)`}>
            <circle
              cx="0"
              cy="0"
              r="10.8"
              fill="rgba(255,255,255,0.025)"
              stroke="rgba(0,0,0,0.34)"
              strokeWidth="0.85"
            />
            <rect x="-4.6" y="-4.2" width="9.2" height="8.4" rx="1.9" fill={`url(#${uniqueId}-tonearm-head)`} />
            <rect x="-3.2" y="1.7" width="6.4" height="3.2" rx="1.1" fill="#101115" />
          </g>

          <motion.line
            x1={pivotX}
            y1={pivotY}
            stroke="transparent"
            strokeWidth="7"
            strokeLinecap="round"
            animate={{
              x2: playbackPoints?.map((point) => point.x) ?? armEnd.x,
              y2: playbackPoints?.map((point) => point.y) ?? armEnd.y,
            }}
            transition={playbackTransition}
          />
          <motion.line
            x1={pivotX}
            y1={pivotY}
            stroke="rgba(0,0,0,0.72)"
            strokeWidth="1.28"
            strokeLinecap="round"
            animate={{
              x2: playbackPoints?.map((point) => point.x) ?? armEnd.x,
              y2: playbackPoints?.map((point) => point.y) ?? armEnd.y,
            }}
            transition={playbackTransition}
          />
          <motion.line
            x1={pivotX}
            y1={pivotY}
            stroke="#c4cad2"
            strokeWidth="0.82"
            strokeLinecap="round"
            animate={{
              x2: playbackPoints?.map((point) => point.x) ?? armEnd.x,
              y2: playbackPoints?.map((point) => point.y) ?? armEnd.y,
            }}
            transition={playbackTransition}
          />

          <motion.g
            animate={{
              x: playbackPoints?.map((point) => point.x) ?? armEnd.x,
              y: playbackPoints?.map((point) => point.y) ?? armEnd.y,
              rotate: playbackRotations ?? cartridgeRotation,
            }}
            transition={playbackTransition}
          >
            <rect x="-1.65" y="-0.5" width="3.3" height="3.1" rx="0.82" fill="#17181c" stroke="rgba(255,255,255,0.1)" strokeWidth="0.28" />
            <rect x="-2.25" y="1.85" width="4.5" height="6.8" rx="1.18" fill={`url(#${uniqueId}-tonearm-head)`} stroke="rgba(255,255,255,0.12)" strokeWidth="0.32" />
            <rect x="-1.5" y="2.65" width="3" height="0.68" rx="0.34" fill="rgba(255,255,255,0.08)" />
            <line x1="2.35" y1="8.25" x2="4.25" y2="8.9" stroke="rgba(251,146,60,0.78)" strokeWidth="0.42" strokeLinecap="round" />
            <circle cx="4.25" cy="8.9" r="0.2" fill="rgba(254,215,170,0.82)" />
          </motion.g>
        </g>
      </motion.svg>
    </AnimatePresence>
  );
};
