import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

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
  const [isPageVisible, setIsPageVisible] = useState(
    typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    const handleVisibility = () => setIsPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!enabled || !isPageVisible || isInteracting) return;
    const timer = window.setTimeout(() => onAdvanceRef.current(), intervalMs);
    return () => window.clearTimeout(timer);
  }, [enabled, generation, intervalMs, isInteracting, isPageVisible]);

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
