import { useRef, useCallback } from 'react';

/**
 * Simple cooldown hook for manual refresh actions
 * Prevents spam by enforcing a minimum time between calls
 */
export function useRefreshCooldown(cooldownMs: number = 2000) {
  const lastCallTime = useRef(0);

  const canRefresh = useCallback(() => {
    const now = Date.now();
    return now - lastCallTime.current >= cooldownMs;
  }, [cooldownMs]);

  const executeWithCooldown = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    onCooldown?: () => void
  ) => {
    return ((...args: Parameters<T>) => {
      if (!canRefresh()) {
        onCooldown?.();
        return;
      }
      lastCallTime.current = Date.now();
      return fn(...args);
    }) as T;
  }, [canRefresh]);

  return { canRefresh, executeWithCooldown };
}
