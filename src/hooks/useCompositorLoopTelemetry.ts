import { useEffect } from 'react';
import { motionRuntime } from '../lib/motionRuntime';

export const useCompositorLoopTelemetry = (active: boolean, kind: string) => {
  useEffect(() => {
    if (!active) return undefined;
    return motionRuntime.registerCompositorLoop(kind);
  }, [active, kind]);
};
