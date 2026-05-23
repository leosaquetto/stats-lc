/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ColorThiefModule from 'colorthief';

type ColorThiefApi = {
  getColor?: (image: HTMLImageElement) => Promise<number[]> | number[];
  getColorSync?: (image: HTMLImageElement) => number[];
};

const colorThiefApi = ColorThiefModule as ColorThiefApi;

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
 * Get dominant color from image using ColorThief with canvas fallback
 * @returns Promise<string> - Hex color (#rrggbb)
 */
export function getDominantColor(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;

    img.onload = async () => {
      try {
        // Try ColorThief first
        const rgb = typeof colorThiefApi.getColorSync === 'function'
          ? colorThiefApi.getColorSync(img)
          : await colorThiefApi.getColor?.(img);
        if (rgb && Array.isArray(rgb) && rgb.length === 3) {
          resolve(normalizeColor(rgb));
          return;
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
          resolve(normalizeColor([r, g, b]));
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
