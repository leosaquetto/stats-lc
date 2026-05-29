/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This file is now an export aggregator for modularized components.
 * Please import from specific directories for better performance and maintainability.
 */

// Shared components
export * from './shared/CommonUI';
export * from './shared/MusicCard';

// Home components
export * from './home/LeoHeader';
export * from './home/HomeHighlights';
export * from './home/FriendsMonthlyHighlights';
export * from './home/StatsAlike';
export * from './home/FriendsSection';

// History components
export * from './history/FriendHistoryCard';

// Battle components
export * from './battle/GroupGrowthChart';

// Modal components
export * from './modals/UserModals';
// AlbumDetailModal removed from aggregator to enable code splitting
export * from './modals/UserHistoryModal';
export * from './modals/TrackLeaderboardModal';
export * from './modals/TrackHistoryModal';
export * from './modals/UserAlbumHistoryModal';

// Note: If you need MonthlyGroupLeaderboard or LiveGroupOverview, 
// they are now in ./home/HomeHighlights
