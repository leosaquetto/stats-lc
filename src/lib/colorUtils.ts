/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Cache para cores dominantes extraídas
const colorCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

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

function getSmartCanvasColor(img: HTMLImageElement): string | null {
  const canvas = document.createElement('canvas');
  const size = 96;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<string, { r: number; g: number; b: number; score: number; count: number }>();
  let fallbackR = 0;
  let fallbackG = 0;
  let fallbackB = 0;
  let fallbackScore = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.65) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // Album covers often have large white/black fields; skip them so the UI
    // follows the artwork accent instead of the paper/background.
    if (brightness > 235 || brightness < 24 || saturation < 0.08) continue;

    const warmthBoost = r > b && r > g ? 1.18 : 1;
    const score = alpha * (0.7 + saturation * 1.8) * (brightness > 205 ? 0.72 : 1) * warmthBoost;
    const qR = Math.round(r / 24) * 24;
    const qG = Math.round(g / 24) * 24;
    const qB = Math.round(b / 24) * 24;
    const key = `${qR},${qG},${qB}`;
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, score: 0, count: 0 };

    bucket.r += r * score;
    bucket.g += g * score;
    bucket.b += b * score;
    bucket.score += score;
    bucket.count += 1;
    buckets.set(key, bucket);

    fallbackR += r * score;
    fallbackG += g * score;
    fallbackB += b * score;
    fallbackScore += score;
  }

  const candidates = [...buckets.values()]
    .filter(bucket => bucket.score > 0 && bucket.count >= 2)
    .sort((a, b) => b.score - a.score);

  const chosen = candidates[0];
  if (chosen) {
    return normalizeColor([
      chosen.r / chosen.score,
      chosen.g / chosen.score,
      chosen.b / chosen.score
    ]);
  }

  if (fallbackScore > 0) {
    return normalizeColor([fallbackR / fallbackScore, fallbackG / fallbackScore, fallbackB / fallbackScore]);
  }

  return null;
}

/**
 * Get a stable accent color from the artwork using local canvas sampling.
 * Includes caching to avoid reprocessing the same images
 * @returns Promise<string> - Hex color (#rrggbb)
 */
export function getDominantColor(imageSrc: string): Promise<string> {
  // Check cache first
  if (colorCache.has(imageSrc)) {
    return Promise.resolve(colorCache.get(imageSrc)!);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;

    img.onload = async () => {
      try {
        const smartColor = getSmartCanvasColor(img);
        if (smartColor) {
          cacheColor(imageSrc, smartColor);
          resolve(smartColor);
          return;
        }
      } catch (e) {
        if ((import.meta as any).env?.DEV) {
          console.warn('[colorUtils] Smart canvas color failed, using average fallback:', e);
        }
      }

      // Canvas sampling fallback
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('#ea580c');
          return;
        }

        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let r = 0, g = 0, b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 16 * 4) {
          const brightness = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
          if (data[i + 3] > 128 && brightness > 24 && brightness < 235) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }

        if (count > 0) {
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          const hexColor = normalizeColor([r, g, b]);
          cacheColor(imageSrc, hexColor);
          resolve(hexColor);
        } else {
          resolve('#ea580c');
        }
      } catch (e) {
        resolve('#ea580c');
      }
    };

    img.onerror = () => {
      resolve('#ea580c');
    };
  });
}

/**
 * Cache a color with LRU eviction
 */
function cacheColor(imageSrc: string, color: string): void {
  // LRU: se o cache está cheio, remove o mais antigo
  if (colorCache.size >= MAX_CACHE_SIZE) {
    const firstKey = colorCache.keys().next().value;
    colorCache.delete(firstKey);
  }
  colorCache.set(imageSrc, color);
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
