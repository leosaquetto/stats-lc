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
    localStorage.setItem(this.prefix + key, String(value));
  }

  getString(key: string): string | undefined {
    const val = localStorage.getItem(this.prefix + key);
    return val === null ? undefined : val;
  }

  getNumber(key: string): number | undefined {
    const val = localStorage.getItem(this.prefix + key);
    if (val === null) return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }

  getBoolean(key: string): boolean | undefined {
    const val = localStorage.getItem(this.prefix + key);
    if (val === null) return undefined;
    return val === 'true';
  }

  delete(key: string) {
    localStorage.removeItem(this.prefix + key);
  }

  clearAll() {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }

  getAllKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.prefix)) {
        keys.push(k.substring(this.prefix.length));
      }
    }
    return keys;
  }
}

export { MMKV };
