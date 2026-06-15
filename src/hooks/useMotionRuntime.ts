import { useSyncExternalStore } from 'react';
import { motionRuntime, type MotionRuntimeSnapshot } from '../lib/motionRuntime';

const subscribe = (listener: () => void) => motionRuntime.subscribe(listener);

const getSnapshot = (): MotionRuntimeSnapshot => motionRuntime.getSnapshot();

const getServerSnapshot = (): MotionRuntimeSnapshot => ({
  canRunMotion: false,
  displayFps: 60,
  fps: 30,
  isPageVisible: true,
  prefersReducedMotion: false,
  saveData: false,
  tier: 'balanced',
});

export const useMotionRuntime = () => useSyncExternalStore(
  subscribe,
  getSnapshot,
  getServerSnapshot
);
