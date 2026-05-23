/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple local analytics service for development logging
let isInitialized = true;

/**
 * Initialize analytics (No-op in simple version)
 */
export const initAnalytics = () => {
  isInitialized = true;
  if ((import.meta as any).env?.DEV) console.log('💡 [Analytics] Simple console-only analytics service initialized.');
};

/**
 * Track an analytical user action
 * @param eventName Name of the action
 * @param eventProperties Key/value variables containing context info
 */
export const trackEvent = (eventName: string, eventProperties?: Record<string, any>) => {
  if (!(import.meta as any).env?.DEV) return;
  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `%c📊 [Event Tracked] %c${eventName} %c@ ${timestamp}`,
    'color: #f97316; font-weight: bold; background: rgba(249, 115, 22, 0.08); padding: 2px 6px; border-radius: 4px;',
    'color: #ffffff; font-weight: 800;',
    'color: rgba(255,255,255,0.4); font-size: 10px;',
    eventProperties || ''
  );
};

/**
 * Set user identity context for analytics tracking
 * @param userId Unique identifier for user
 * @param userProperties Profile attributes to store for segments
 */
export const identifyUser = (userId: string, userProperties?: Record<string, any>) => {
  if (!(import.meta as any).env?.DEV) return;
  console.log(
    `%c👤 [User Identified] %c${userId}`,
    'color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.08); padding: 2px 6px; border-radius: 4px;',
    'color: #ffffff; font-weight: 800;',
    userProperties || ''
  );
};
