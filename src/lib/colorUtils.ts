/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Cache para cores extraídas
const colorCache = new Map<string, string>();
const paletteCache = new Map<string, ArtworkPalette>();
const MAX_CACHE_SIZE = 100;

export interface ArtworkPaletteCandidate {
  hex: string;
  score: number;
  population: number;
  saturation: number;
  brightness: number;
  hue: number;
}

export interface ArtworkPalette {
  vinylColor: string;
  progressColor: string;
  candidates: ArtworkPaletteCandidate[];
}

type Rgb = { r: number; g: number; b: number };

/**
 * Normalize color input to #rrggbb format
 */
export function normalizeColor(input: string | number[] | null | undefined, fallback: string = '#ea580c'): string {
  if (!input) return fallback;

  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

  // If already hex
  if (typeof input === 'string') {
    if (input.startsWith('#')) {
      return input.length === 7 ? input : fallback;
    }
    // Parse rgb/rgba
    const rgbMatch = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    return fallback;
  }

  // If array [r, g, b]
  if (Array.isArray(input) && input.length >= 3) {
    const [r, g, b] = input;
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return fallback;
}

/**
 * Adjust brightness of a hex color
 * @param color - Hex color (#rrggbb)
 * @param amount - Amount to adjust (-1 to 1, negative darkens, positive lightens)
 */
export function adjustBrightness(color: string, amount: number): string {
  const hex = normalizeColor(color).replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const adjust = (val: number) => {
    const adjusted = amount > 0
      ? val + (255 - val) * amount
      : val + val * amount;
    return Math.max(0, Math.min(255, Math.round(adjusted)));
  };

  const newR = adjust(r);
  const newG = adjust(g);
  const newB = adjust(b);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Add alpha channel to hex color
 * @param color - Hex color (#rrggbb)
 * @param alpha - Alpha value (0 to 1)
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = normalizeColor(color).replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

/**
 * Calculate perceived brightness of a color (0-255)
 */
export function getPerceivedBrightness(color: string): number {
  const hex = normalizeColor(color).replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Weighted formula for perceived brightness
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Calculate color saturation (0-1)
 */
export function getSaturation(color: string): number {
  const hex = normalizeColor(color).replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (max === 0) return 0;
  return delta / max;
}

function parseHexColor(color: string): Rgb {
  const hex = normalizeColor(color).replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

function rgbToHsl({ r, g, b }: Rgb): { hue: number; saturation: number; lightness: number } {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case nr:
        hue = ((ng - nb) / delta + (ng < nb ? 6 : 0)) * 60;
        break;
      case ng:
        hue = ((nb - nr) / delta + 2) * 60;
        break;
      default:
        hue = ((nr - ng) / delta + 4) * 60;
        break;
    }
  }

  return { hue, saturation, lightness };
}

function getHue(color: string): number {
  return rgbToHsl(parseHexColor(color)).hue;
}

function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 360;
  return Math.min(distance, 360 - distance);
}

function createCandidate(
  color: string,
  score: number,
  population: number
): ArtworkPaletteCandidate {
  const normalized = normalizeColor(color, '#647062');
  return {
    hex: normalized,
    score,
    population,
    saturation: getSaturation(normalized),
    brightness: getPerceivedBrightness(normalized),
    hue: getHue(normalized)
  };
}

function isVividCandidate(candidate: ArtworkPaletteCandidate): boolean {
  return candidate.saturation >= 0.16 && candidate.brightness >= 38 && candidate.brightness <= 228;
}

function getTonalProgressColor(color: string): string {
  const normalized = normalizeColor(color, '#647062');
  const brightness = getPerceivedBrightness(normalized);

  if (brightness < 88) return adjustBrightness(normalized, 0.48);
  if (brightness < 138) return adjustBrightness(normalized, 0.3);
  if (brightness > 214) return adjustBrightness(normalized, -0.24);
  return adjustBrightness(normalized, brightness < 176 ? 0.18 : -0.18);
}

function createFallbackPalette(color: string = '#647062'): ArtworkPalette {
  const vinylColor = normalizeColor(color, '#647062');
  return {
    vinylColor,
    progressColor: getTonalProgressColor(vinylColor),
    candidates: [createCandidate(vinylColor, 1, 1)]
  };
}

function chooseProgressCandidate(
  vinyl: ArtworkPaletteCandidate,
  candidates: ArtworkPaletteCandidate[]
): ArtworkPaletteCandidate {
  const viable = candidates.filter((candidate) => {
    if (candidate.hex === vinyl.hex) return false;
    if (candidate.brightness < 22 || candidate.brightness > 238) return false;

    const hueDelta = candidate.saturation >= 0.12 && vinyl.saturation >= 0.12
      ? hueDistance(candidate.hue, vinyl.hue)
      : 0;
    const brightnessDelta = Math.abs(candidate.brightness - vinyl.brightness);
    const saturationDelta = Math.abs(candidate.saturation - vinyl.saturation);

    return hueDelta >= 24 || brightnessDelta >= 36 || saturationDelta >= 0.2;
  });

  const scoreProgress = (candidate: ArtworkPaletteCandidate) => {
    const hueDelta = candidate.saturation >= 0.12 && vinyl.saturation >= 0.12
      ? hueDistance(candidate.hue, vinyl.hue)
      : 0;
    const brightnessDelta = Math.abs(candidate.brightness - vinyl.brightness);

    return (
      candidate.score * 0.85 +
      candidate.population * 120 +
      candidate.saturation * 120 +
      Math.min(hueDelta, 105) * 2.2 +
      Math.min(brightnessDelta, 88) * 1.15
    );
  };

  const vivid = viable
    .filter(isVividCandidate)
    .sort((a, b) => scoreProgress(b) - scoreProgress(a))[0];

  if (vivid) return vivid;

  const realNeutral = viable
    .sort((a, b) => scoreProgress(b) - scoreProgress(a))[0];

  if (realNeutral) return realNeutral;

  return createCandidate(getTonalProgressColor(vinyl.hex), vinyl.score * 0.4, 0);
}

function getAverageCanvasColor(img: HTMLImageElement): string | null {
  const canvas = document.createElement('canvas');
  const size = 96;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;

  for (let i = 0; i < data.length; i += 16) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.65) continue;

    const brightness = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    if (brightness > 244 || brightness < 14) continue;

    r += data[i] * alpha;
    g += data[i + 1] * alpha;
    b += data[i + 2] * alpha;
    weight += alpha;
  }

  if (weight <= 0) return null;
  return normalizeColor([r / weight, g / weight, b / weight]);
}

function getSmartCanvasPalette(img: HTMLImageElement): ArtworkPalette | null {
  const canvas = document.createElement('canvas');
  const size = 112;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<string, { r: number; g: number; b: number; score: number; count: number }>();
  let totalWeight = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.65) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const hsvSaturation = Math.max(r, g, b) === 0 ? 0 : (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
    const hsl = rgbToHsl({ r, g, b });

    // Covers often have large paper/black fields. Keep real neutrals, but skip
    // extreme voids so they do not drown out small but intentional artwork color.
    if (brightness > 246 || brightness < 16) continue;
    if (brightness > 236 && hsvSaturation < 0.14) continue;
    if (brightness < 24 && hsvSaturation < 0.18) continue;

    const isVivid = hsvSaturation >= 0.16 && brightness >= 36 && brightness <= 228;
    const quantizeBy = isVivid ? 18 : 26;
    const qR = Math.round(r / quantizeBy) * quantizeBy;
    const qG = Math.round(g / quantizeBy) * quantizeBy;
    const qB = Math.round(b / quantizeBy) * quantizeBy;
    const key = `${qR},${qG},${qB}`;
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, score: 0, count: 0 };
    const lightnessPenalty = hsl.lightness > 0.88 || hsl.lightness < 0.12 ? 0.68 : 1;
    let score = alpha * lightnessPenalty;

    if (isVivid) {
      score *= 1.05 + hsvSaturation * 3.2;
    } else {
      score *= 0.42 + hsvSaturation * 1.3;
    }

    bucket.r += r * score;
    bucket.g += g * score;
    bucket.b += b * score;
    bucket.score += score;
    bucket.count += alpha;
    buckets.set(key, bucket);
    totalWeight += alpha;
  }

  const candidates = [...buckets.values()]
    .filter(bucket => bucket.score > 0 && bucket.count >= 1.2)
    .map((bucket) => {
      const hex = normalizeColor([
        bucket.r / bucket.score,
        bucket.g / bucket.score,
        bucket.b / bucket.score
      ]);
      const candidate = createCandidate(hex, bucket.score, totalWeight > 0 ? bucket.count / totalWeight : 0);
      const areaBoost = 0.62 + Math.sqrt(Math.max(candidate.population, 0.004)) * 2;
      const saturationBoost = candidate.saturation >= 0.16 ? 1 + candidate.saturation * 1.35 : 0.72 + candidate.saturation;
      return {
        ...candidate,
        score: candidate.score * areaBoost * saturationBoost
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 14);

  if (candidates.length === 0) {
    const averageColor = getAverageCanvasColor(img);
    return averageColor ? createFallbackPalette(averageColor) : null;
  }

  const vividCandidates = candidates.filter(isVividCandidate);
  const vinyl = (vividCandidates.length > 0 ? vividCandidates : candidates)[0];
  const progress = chooseProgressCandidate(vinyl, candidates);

  return {
    vinylColor: vinyl.hex,
    progressColor: progress.hex,
    candidates
  };
}

/**
 * Get a stable artwork palette using local canvas sampling.
 * Includes caching to avoid reprocessing the same images.
 */
export function getArtworkPalette(imageSrc: string): Promise<ArtworkPalette> {
  if (paletteCache.has(imageSrc)) {
    return Promise.resolve(paletteCache.get(imageSrc)!);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;

    img.onload = async () => {
      try {
        const palette = getSmartCanvasPalette(img);
        if (palette) {
          cachePalette(imageSrc, palette);
          cacheColor(imageSrc, palette.vinylColor);
          resolve(palette);
          return;
        }
      } catch (e) {
        if ((import.meta as any).env?.DEV) {
          console.warn('[colorUtils] Smart canvas palette failed, using average fallback:', e);
        }
      }

      try {
        const averageColor = getAverageCanvasColor(img);
        if (averageColor) {
          const palette = createFallbackPalette(averageColor);
          cachePalette(imageSrc, palette);
          cacheColor(imageSrc, palette.vinylColor);
          resolve(palette);
        } else {
          const palette = createFallbackPalette();
          cachePalette(imageSrc, palette);
          cacheColor(imageSrc, palette.vinylColor);
          resolve(palette);
        }
      } catch (e) {
        const palette = createFallbackPalette();
        cachePalette(imageSrc, palette);
        cacheColor(imageSrc, palette.vinylColor);
        resolve(palette);
      }
    };

    img.onerror = () => {
      const palette = createFallbackPalette();
      cachePalette(imageSrc, palette);
      cacheColor(imageSrc, palette.vinylColor);
      resolve(palette);
    };
  });
}

/**
 * Get a stable accent color from the artwork using local canvas sampling.
 * Includes caching to avoid reprocessing the same images.
 * @returns Promise<string> - Hex color (#rrggbb)
 */
export function getDominantColor(imageSrc: string): Promise<string> {
  if (colorCache.has(imageSrc)) {
    return Promise.resolve(colorCache.get(imageSrc)!);
  }

  return getArtworkPalette(imageSrc).then(palette => palette.vinylColor);
}

function cacheEntry<T>(cache: Map<string, T>, imageSrc: string, value: T): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(imageSrc, value);
}

/**
 * Cache a color with LRU eviction
 */
function cacheColor(imageSrc: string, color: string): void {
  cacheEntry(colorCache, imageSrc, color);
}

/**
 * Cache a palette with LRU eviction
 */
function cachePalette(imageSrc: string, palette: ArtworkPalette): void {
  cacheEntry(paletteCache, imageSrc, palette);
}

/**
 * Ensure color is visible against dark background by adjusting brightness/saturation
 * @param color - Input color
 * @param minBrightness - Minimum brightness (0-255)
 * @param minSaturation - Minimum saturation (0-1)
 */
export function ensureVisibility(
  color: string,
  minBrightness: number = 100,
  minSaturation: number = 0.3
): string {
  const brightness = getPerceivedBrightness(color);
  const saturation = getSaturation(color);

  let result = color;

  // If too dark, brighten it
  if (brightness < minBrightness) {
    const brightenAmount = (minBrightness - brightness) / 255;
    result = adjustBrightness(result, brightenAmount * 1.5);
  }

  // If too desaturated (grayish), boost saturation by mixing with a vibrant version
  if (saturation < minSaturation) {
    const hex = normalizeColor(result).replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Find the dominant channel and boost it
    const max = Math.max(r, g, b);
    const boostFactor = 1.4;
    const newR = r === max ? Math.min(255, Math.round(r * boostFactor)) : r;
    const newG = g === max ? Math.min(255, Math.round(g * boostFactor)) : g;
    const newB = b === max ? Math.min(255, Math.round(b * boostFactor)) : b;

    result = normalizeColor([newR, newG, newB]);
  }

  return result;
}
