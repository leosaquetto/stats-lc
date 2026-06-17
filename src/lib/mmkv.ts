/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class MMKV {
  private prefix: string;
  constructor(options?: { id?: string }) {
    this.prefix = options?.id ? `mmkv:${options.id}:` : 'mmkv:default:';
  }

  set(key: string, value: string | number | boolean) {
    try {
      localStorage.setItem(this.prefix + key, String(value));
    } catch {}
  }

  getString(key: string): string | undefined {
    try {
      const val = localStorage.getItem(this.prefix + key);
      return val === null ? undefined : val;
    } catch {
      return undefined;
    }
  }

  getNumber(key: string): number | undefined {
    try {
      const val = localStorage.getItem(this.prefix + key);
      if (val === null) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    } catch {
      return undefined;
    }
  }

  getBoolean(key: string): boolean | undefined {
    try {
      const val = localStorage.getItem(this.prefix + key);
      if (val === null) return undefined;
      return val === 'true';
    } catch {
      return undefined;
    }
  }

  delete(key: string) {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {}
  }

  clearAll() {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }

  getAllKeys(): string[] {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keys.push(k.substring(this.prefix.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  }
}

export { MMKV };
