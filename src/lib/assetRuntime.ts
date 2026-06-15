import { motionRuntime } from './motionRuntime';

type ImageAssetPriority = 'critical' | 'visible' | 'ambient';

type ImageAssetOptions = {
  decode?: boolean;
  limit?: number;
  priority?: ImageAssetPriority;
  timeoutMs?: number;
};

type ImageAssetJob = Required<Pick<ImageAssetOptions, 'decode' | 'priority' | 'timeoutMs'>> & {
  order: number;
  promise: Promise<void>;
  resolve: () => void;
  source: string;
};
type IdleWindow = Window & {
  cancelIdleCallback?: (id: number) => void;
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

const PRIORITY_WEIGHT: Record<ImageAssetPriority, number> = {
  critical: 0,
  visible: 1,
  ambient: 2,
};

const loadedImageSrcs = new Set<string>();
const loadedImageOrder: string[] = [];
const inFlightImageSrcs = new Map<string, Promise<void>>();
const queuedImageSrcs = new Map<string, ImageAssetJob>();
const imageQueue: ImageAssetJob[] = [];

let activeImageLoads = 0;
let drainTimer: number | null = null;
let cancelDrainTask: (() => void) | null = null;
let drainScheduledAsIdle = false;
let jobOrder = 0;
let runtimeSubscriptionReady = false;

const getDeviceMemory = () => (
  typeof navigator === 'undefined'
    ? 8
    : (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
);

const getLoadedImageBudget = () => {
  const deviceMemory = getDeviceMemory();
  if (deviceMemory <= 4) return 100;
  if (deviceMemory <= 8) return 180;
  return 260;
};

const normalizeImageSource = (source: string | undefined | null) => (
  typeof source === 'string' ? source.trim() : ''
);

const syncAssetDataset = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.statsLcImageQueue = String(imageQueue.length);
  root.dataset.statsLcImageActive = String(activeImageLoads);
  root.dataset.statsLcImageLoaded = String(loadedImageSrcs.size);
  root.dataset.statsLcImageBudget = String(getLoadedImageBudget());
};

const getMaxConcurrentImageLoads = () => {
  const { tier } = motionRuntime.getSnapshot();
  if (getDeviceMemory() <= 4) return 1;
  if (tier === 'conserve') return 1;
  if (tier === 'balanced') return 2;
  return 3;
};

const rememberLoadedImage = (source: string) => {
  if (loadedImageSrcs.has(source)) return;
  loadedImageSrcs.add(source);
  loadedImageOrder.push(source);

  while (loadedImageOrder.length > getLoadedImageBudget()) {
    const staleSource = loadedImageOrder.shift();
    if (staleSource) loadedImageSrcs.delete(staleSource);
  }

  syncAssetDataset();
};

const sortQueue = () => {
  imageQueue.sort((a, b) => (
    PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || a.order - b.order
  ));
};

const runImageJob = (job: ImageAssetJob) => {
  queuedImageSrcs.delete(job.source);
  activeImageLoads += 1;
  syncAssetDataset();

  const loadPromise = new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (loaded) rememberLoadedImage(job.source);
      resolve();
    };

    const timeout = window.setTimeout(() => finish(false), job.timeoutMs);

    image.onload = () => {
      if (job.decode && image.decode) {
        image.decode().then(() => finish(true)).catch(() => finish(true));
        return;
      }
      finish(true);
    };
    image.onerror = () => finish(false);
    image.decoding = 'async';
    if ('fetchPriority' in image) {
      (image as HTMLImageElement & { fetchPriority?: 'high' | 'low' }).fetchPriority = job.priority === 'critical' ? 'high' : 'low';
    }
    image.src = job.source;
  });

  inFlightImageSrcs.set(job.source, loadPromise);
  loadPromise.finally(() => {
    inFlightImageSrcs.delete(job.source);
    activeImageLoads = Math.max(0, activeImageLoads - 1);
    job.resolve();
    syncAssetDataset();
    drainImageQueue();
  });
};

const drainImageQueue = () => {
  drainTimer = null;
  cancelDrainTask = null;
  drainScheduledAsIdle = false;
  if (typeof window === 'undefined') return;
  if (!motionRuntime.getSnapshot().isPageVisible) {
    syncAssetDataset();
    return;
  }

  sortQueue();
  const maxConcurrent = getMaxConcurrentImageLoads();
  while (activeImageLoads < maxConcurrent && imageQueue.length > 0) {
    const job = imageQueue.shift();
    if (job) runImageJob(job);
  }
  syncAssetDataset();
};

const scheduleDrain = () => {
  if (typeof window === 'undefined' || drainTimer !== null || cancelDrainTask) return;
  ensureRuntimeSubscription();
  const requestIdleCallback = (window as IdleWindow).requestIdleCallback;
  if (imageQueue.every((job) => job.priority === 'ambient') && requestIdleCallback) {
    drainScheduledAsIdle = true;
    drainTimer = requestIdleCallback(drainImageQueue, { timeout: 320 });
    return;
  }
  cancelDrainTask = motionRuntime.scheduleTask(drainImageQueue, 0, 'interaction');
};

const promoteScheduledDrain = () => {
  if (typeof window === 'undefined' || drainTimer === null || !drainScheduledAsIdle) return;
  const cancelIdleCallback = (window as IdleWindow).cancelIdleCallback;
  if (!cancelIdleCallback) return;
  cancelIdleCallback(drainTimer);
  drainTimer = null;
  drainScheduledAsIdle = false;
  scheduleDrain();
};

const dropQueuedAmbientJobs = () => {
  for (let index = imageQueue.length - 1; index >= 0; index -= 1) {
    const job = imageQueue[index];
    if (job.priority !== 'ambient') continue;
    imageQueue.splice(index, 1);
    queuedImageSrcs.delete(job.source);
    job.resolve();
  }
};

const ensureRuntimeSubscription = () => {
  if (runtimeSubscriptionReady || typeof window === 'undefined') return;
  runtimeSubscriptionReady = true;
  motionRuntime.subscribe(() => {
    const runtime = motionRuntime.getSnapshot();
    if (!runtime.isPageVisible || runtime.tier === 'conserve') dropQueuedAmbientJobs();
    if (runtime.isPageVisible) scheduleDrain();
    syncAssetDataset();
  });
};

const queueImageAsset = (source: string, options: Required<Pick<ImageAssetOptions, 'decode' | 'priority' | 'timeoutMs'>>) => {
  if (loadedImageSrcs.has(source)) return Promise.resolve();
  if (options.priority === 'ambient' && !motionRuntime.getSnapshot().isPageVisible) return Promise.resolve();

  const inFlight = inFlightImageSrcs.get(source);
  if (inFlight) return inFlight;

  const queued = queuedImageSrcs.get(source);
  if (queued) {
    if (PRIORITY_WEIGHT[options.priority] < PRIORITY_WEIGHT[queued.priority]) {
      queued.priority = options.priority;
      sortQueue();
    }
    return queued.promise;
  }

  let resolveJob = () => {};
  const promise = new Promise<void>((resolve) => {
    resolveJob = resolve;
  });

  const job: ImageAssetJob = {
    decode: options.decode,
    order: jobOrder++,
    priority: options.priority,
    promise,
    resolve: resolveJob,
    source,
    timeoutMs: options.timeoutMs,
  };

  queuedImageSrcs.set(source, job);
  imageQueue.push(job);
  if (options.priority !== 'ambient') promoteScheduledDrain();
  scheduleDrain();
  syncAssetDataset();
  return promise;
};

export const hasImageAssetLoaded = (source: string | undefined | null) => {
  const normalized = normalizeImageSource(source);
  return normalized.length > 0 && loadedImageSrcs.has(normalized);
};

export const markImageAssetLoaded = (source: string | undefined | null) => {
  const normalized = normalizeImageSource(source);
  if (normalized.length > 0) rememberLoadedImage(normalized);
};

export const preloadImageAssets = (
  sources: Array<string | undefined | null>,
  options: ImageAssetOptions = {}
) => {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return Promise.resolve();

  const limit = options.limit ?? 18;
  const uniqueSources = Array.from(new Set(
    sources
      .map(normalizeImageSource)
      .filter((source) => source.length > 5 && !source.includes('private.webp'))
  )).slice(0, limit);

  if (uniqueSources.length === 0) return Promise.resolve();

  const normalizedOptions = {
    decode: options.decode ?? true,
    priority: options.priority ?? 'ambient',
    timeoutMs: options.timeoutMs ?? 1800,
  };

  return Promise.allSettled(uniqueSources.map((source) => queueImageAsset(source, normalizedOptions)))
    .then(() => undefined);
};

export const getImageAssetRuntimeStats = () => ({
  active: activeImageLoads,
  loaded: loadedImageSrcs.size,
  queued: imageQueue.length,
});
