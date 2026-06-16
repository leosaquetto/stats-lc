/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    __SPLASH_READY__?: boolean;
    __STATS_LC_HOME_READY__?: boolean;
    __STATS_LC_HOME_READY_DOCUMENT__?: boolean;
    __STATS_LC_SECONDARY_ROUTES_READY__?: boolean;
    __STATS_LC_DISMISS_SPLASH__?: () => void;
    __STATS_LC_PERFORMANCE__?: {
      homeReadyMs: number | null;
      routeSettles: Array<{ name: string; duration: number; startedAt: number }>;
      longTasks: Array<{ name: string; duration: number; startedAt: number }>;
      longAnimationFrames: Array<{ name: string; duration: number; startedAt: number }>;
      bootLongTasks: number;
      postReadyLongTasks: number;
      bootLongAnimationFrames: number;
      postReadyLongAnimationFrames: number;
      maxLongTaskMs: number;
      maxLongAnimationFrameMs: number;
    };
  }
}

export {};
