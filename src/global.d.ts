/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    __SPLASH_READY__?: boolean;
    __STATS_LC_HOME_READY__?: boolean;
    __STATS_LC_DISMISS_SPLASH__?: () => void;
  }
}

export {};
