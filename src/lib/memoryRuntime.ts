export type RuntimeCacheSize = 'tiny' | 'small' | 'medium' | 'large';
export type RuntimeMemoryClass = 'low' | 'standard' | 'high';

const BASE_CACHE_BUDGETS: Record<RuntimeCacheSize, number> = {
  tiny: 16,
  small: 32,
  medium: 64,
  large: 120,
};

const getDeviceMemory = () => (
  typeof navigator === 'undefined'
    ? 8
    : (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
);

export const getRuntimeMemoryClass = (): RuntimeMemoryClass => {
  const deviceMemory = getDeviceMemory();
  if (deviceMemory <= 4) return 'low';
  if (deviceMemory >= 12) return 'high';
  return 'standard';
};

export const getRuntimeCacheBudget = (size: RuntimeCacheSize) => {
  const memoryClass = getRuntimeMemoryClass();
  const multiplier = memoryClass === 'low' ? 0.5 : memoryClass === 'high' ? 1.5 : 1;
  return Math.max(8, Math.round(BASE_CACHE_BUDGETS[size] * multiplier));
};

const syncMemoryDataset = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.statsLcMemoryClass = getRuntimeMemoryClass();
  root.dataset.statsLcDeviceMemoryGb = String(getDeviceMemory());
};

export const trimRuntimeCache = <K, V>(cache: Map<K, V>, size: RuntimeCacheSize) => {
  const budget = getRuntimeCacheBudget(size);
  while (cache.size > budget) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey === 'undefined') break;
    cache.delete(oldestKey);
  }
  syncMemoryDataset();
};

export const setRuntimeCacheEntry = <K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
  size: RuntimeCacheSize
) => {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  trimRuntimeCache(cache, size);
};

export const readRuntimeCacheEntry = <K, V>(cache: Map<K, V>, key: K) => {
  const value = cache.get(key);
  if (typeof value === 'undefined') return undefined;
  cache.delete(key);
  cache.set(key, value);
  return value;
};

