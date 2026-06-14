import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useMotionRuntime } from './useMotionRuntime';
import { usePageVisibility } from './useViewportMotionGate';

interface AutoOrbitRotationOptions {
  enabled: boolean;
  intervalMs: number;
  onAdvance: () => void;
}

export const useAutoOrbitRotation = ({
  enabled,
  intervalMs,
  onAdvance,
}: AutoOrbitRotationOptions) => {
  const onAdvanceRef = useRef(onAdvance);
  const [isInteracting, setIsInteracting] = useState(false);
  const isPageVisible = usePageVisibility();
  const motionRuntime = useMotionRuntime();
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    if (!enabled || !isPageVisible || isInteracting || !motionRuntime.canRunMotion || motionRuntime.tier === 'conserve') return;
    const multiplier = motionRuntime.tier === 'balanced' ? 1.65 : 1;
    const timer = window.setTimeout(() => onAdvanceRef.current(), intervalMs * multiplier);
    return () => window.clearTimeout(timer);
  }, [enabled, generation, intervalMs, isInteracting, isPageVisible, motionRuntime.canRunMotion, motionRuntime.tier]);

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
