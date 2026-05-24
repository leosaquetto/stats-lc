/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ColorThiefModule from 'colorthief';

type ColorThiefApi = {
  getColor?: (image: HTMLImageElement) => Promise<any>;
  getColorSync?: (image: HTMLImageElement) => any;
};

const colorThiefApi = ColorThiefModule as unknown as ColorThiefApi;

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

/**
 * Get dominant color from image using ColorThief with canvas fallback
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
        // Try ColorThief first
        const color = typeof colorThiefApi.getColorSync === 'function'
          ? colorThiefApi.getColorSync(img)
          : await colorThiefApi.getColor?.(img);

        if (color) {
          // New versions return an object with .hex() and .array()
          if (typeof color.hex === 'function') {
            const hexColor = color.hex();
            cacheColor(imageSrc, hexColor);
            resolve(hexColor);
            return;
          }
          // Fallback for older versions that might return [r, g, b]
          if (Array.isArray(color) && color.length >= 3) {
            const hexColor = normalizeColor(color);
            cacheColor(imageSrc, hexColor);
            resolve(hexColor);
            return;
          }
        }
      } catch (e) {
        // ColorThief failed, fall through to canvas sampling
        if ((import.meta as any).env?.DEV) {
          console.warn('[colorUtils] ColorThief failed, using canvas fallback:', e);
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
          if (data[i + 3] > 128) {
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
