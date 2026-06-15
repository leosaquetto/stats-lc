import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { motionRuntime as motionRuntimeLib } from '../lib/motionRuntime';
import { useMotionRuntime } from './useMotionRuntime';

interface AutoOrbitRotationOptions {
  enabled: boolean;
  intervalMs: number;
  kind: string;
  onAdvance: () => void;
}

export const useAutoOrbitRotation = ({
  enabled,
  intervalMs,
  kind,
  onAdvance,
}: AutoOrbitRotationOptions) => {
  const onAdvanceRef = useRef(onAdvance);
  const [isInteracting, setIsInteracting] = useState(false);
  const motionRuntime = useMotionRuntime();
  const isPageVisible = motionRuntime.isPageVisible;
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    if (!enabled || !isPageVisible || isInteracting || !motionRuntime.canRunMotion || motionRuntime.tier === 'conserve') return;
    const multiplier = motionRuntime.tier === 'balanced' ? 1.65 : 1;
    const delayMs = intervalMs * multiplier;
    let cancelled = false;
    let cancelTask = () => {};

    const scheduleAdvance = () => {
      cancelTask = motionRuntimeLib.scheduleTask(() => {
        if (cancelled) return;
        onAdvanceRef.current();
        scheduleAdvance();
      }, delayMs, 'ambient', kind);
    };

    scheduleAdvance();
    return () => {
      cancelled = true;
      cancelTask();
    };
  }, [enabled, generation, intervalMs, isInteracting, isPageVisible, kind, motionRuntime.canRunMotion, motionRuntime.tier]);

  const restart = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  const pause = useCallback(() => setIsInteracting(true), []);
  const resume = useCallback(() => {
    setIsInteracting(false);
    restart();
  }, [restart]);
  const resumeWhenLeaving = useCallback((
    event: ReactMouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>
  ) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    resume();
  }, [resume]);

  return {
    restart,
    interactionProps: {
      onMouseEnter: pause,
      onMouseLeave: resume,
      onMouseOut: resumeWhenLeaving,
      onPointerEnter: pause,
      onPointerLeave: resume,
      onPointerOut: resumeWhenLeaving,
      onFocusCapture: pause,
      onBlurCapture: resume,
      onPointerDown: pause,
      onPointerUp: resume,
      onPointerCancel: resume,
    },
  };
};
