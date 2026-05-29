/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Adapter to inject store callbacks into statsService without creating circular dependency.
 * This allows statsService to access store state without dynamic imports.
 */

export interface StoreAdapter {
  getState: () => any;
  getCanonicalMembers: (groupStats: any) => any[];
}

let storeAdapter: StoreAdapter | null = null;

export const setStoreAdapter = (adapter: StoreAdapter) => {
  storeAdapter = adapter;
};

export const getStoreAdapter = (): StoreAdapter => {
  if (!storeAdapter) {
    throw new Error('StoreAdapter not initialized. Call setStoreAdapter() from App initialization.');
  }
  return storeAdapter;
};

export const withStoreState = async <T>(
  callback: (store: any) => T | Promise<T>
): Promise<T> => {
  try {
    const adapter = getStoreAdapter();
    return await callback(adapter.getState());
  } catch (error) {
    console.error('[storeAdapter] Failed to access store state:', error);
    throw error;
  }
};
