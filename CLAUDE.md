# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stats Loop (stats-lc) is a React-based music statistics dashboard that displays listening data from stats.fm. The app shows real-time "now playing" status, historical statistics, rankings, and comparisons across multiple users in a group. It's built with Vite, React 19, TypeScript, and Tailwind CSS.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://0.0.0.0:3000)
npm run dev

# Build for production
npm run build

# Type check without emitting files
npm run lint

# Clean build artifacts
npm run clean
```

## Architecture

### State Management

The app uses **Zustand** for global state management with persistence:

- **Primary store**: `src/store/useStatsStore.ts` manages all group stats, user data, caching, and settings
- **Persistence**: Uses a custom MMKV mock that wraps localStorage for web compatibility
- **Cache layers**: Multiple cache strategies for offline support and performance:
  - `statsCache`: Pre-calculated user stats (streams today/month/year/lifetime)
  - `historyCache`: Recent listening history per user
  - `userFullStatsCache`: Detailed user statistics
  - `timeRangeStatsCache`: Time-based statistics
  - `topItemsCache`: Top tracks/artists/albums

### API Integration

- **Backend API**: Proxied through Vite dev server to `VITE_API_BASE_URL` (defaults to https://statslc.leosaquetto.com)
- **Service layer**: `src/services/statsService.ts` handles all API calls with normalization
- **Core utilities**: `src/services/statsCore.ts` provides platform detection, formatting, and data transformation
- **API contract**: See `api-contract.md` for detailed endpoint documentation and data normalization rules

Key API endpoints consumed:
- `/api/group` - Group statistics and member data
- `/api/group-live` - Lightweight polling for now-playing updates
- `/api/user` - Individual user statistics
- `/api/top` - Top tracks/artists/albums
- `/api/stats` - Time-range statistics
- `/api/compare` - Multi-user comparison data

### Data Normalization

All API responses are normalized through `statsService.ts`:
- **Tracks**: Normalized with `primaryArtist`, `primaryArtistId`, `primaryArtistName`, `secondaryArtists`, and `catalogAvailability`
- **Platform detection**: Uses `member.platform` for user's primary platform and `nowPlaying.platformCandidate` for stream-level context
- **Catalog availability**: `track.catalogAvailability` indicates Spotify/Apple Music availability (not playback source)
- **Important**: `externalIds` are for catalog mapping only, never used alone to infer playback source

### Component Structure

```
src/
├── screens/          # Top-level route screens
│   ├── HomeScreen.tsx       # Main dashboard with now-playing and insights
│   ├── StatsScreen.tsx      # Detailed statistics view
│   ├── RankingScreen.tsx    # User rankings and leaderboards
│   ├── AlikeScreen.tsx      # Music taste comparison
│   └── SettingsScreen.tsx   # App configuration
├── components/
│   ├── home/         # Home screen components (vinyl record, insights, friends)
│   ├── stats/        # Statistics visualization components
│   ├── shared/       # Reusable UI components (CommonUI, MusicCard, ShareButton)
│   ├── battle/       # Comparison/battle components
│   ├── history/      # Listening history components
│   └── modals/       # Modal dialogs
├── services/         # API and business logic
│   ├── statsService.ts      # API client and data normalization
│   ├── statsCore.ts         # Core utilities and GROUP_USERS config
│   ├── statsCacheService.ts # Cache management
│   ├── notificationService.ts # Push notifications
│   └── snapshotService.ts   # Snapshot generation
├── store/            # Zustand state management
├── lib/              # Utility functions
│   ├── time.ts       # São Paulo timezone formatting
│   ├── colorUtils.ts # Color extraction and manipulation
│   └── artistUtils.ts # Artist data helpers
└── types/            # TypeScript type definitions
```

### Routing

Uses **React Router v7** with HashRouter:
- `/` - Home screen (now playing, insights)
- `/highlights` - Statistics highlights
- `/ranking` - User rankings
- `/alike` - Music taste comparison
- `/settings` - Settings and configuration

### Styling

- **Tailwind CSS v4** with Vite plugin
- Custom glass morphism effects via `.glass` class
- Responsive design with mobile-first approach
- Framer Motion for animations

### Key Features

1. **Real-time polling**: Fetches group live data every 20+ seconds (configurable via `pollingFrequency`)
2. **Offline support**: Multi-layer caching with stale data fallbacks
3. **Cross-tab sync**: Listens to localStorage changes to sync state across tabs
4. **User selection**: Modal on first load to select featured user from group
5. **Platform detection**: Automatic detection of Spotify vs Apple Music based on API signals
6. **Push notifications**: Service worker integration for background updates (production only)

## Important Patterns

### Time Formatting

All time formatting uses **São Paulo timezone** (America/Sao_Paulo) via `src/lib/time.ts`:
- `formatTimeSP()` - Format time in SP timezone
- `formatDateSP()` - Format date in SP timezone
- `formatRelativeTimeSP()` - Relative time ("há 5 minutos")
- `isTodaySP()` - Check if date is today in SP timezone

### Platform Detection Rules

From `api-contract.md`:
- `member.platform` = user's primary platform (from profile/settings)
- `nowPlaying.platformCandidate` = platform candidate from stream item (item-level context)
- `track.catalogAvailability` = catalog availability (NOT playback origin)
- Never use `externalIds` alone to infer playback source

### Playback Status

`coreUtils.getPlaybackStatus()` returns:
- `"live"` - Currently playing (< 5 minutes ago or `isNow === true`)
- `"lastPlayed"` - Recently played (> 5 minutes ago)
- `"inactive"` - No valid track data

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
# Optional: Backend API base URL (defaults to https://statslc.leosaquetto.com)
VITE_API_BASE_URL="https://statslc.leosaquetto.com"

# AI Studio specific (not used in core app)
GEMINI_API_KEY="..."
APP_URL="..."
```

## Deployment

- **Vercel**: Configured via `vercel.json` with API proxy rewrites
- **Build output**: `dist/` directory
- **Service Worker**: Registered in production for push notifications

## Code Conventions

- All source files include Apache 2.0 license header
- TypeScript with strict mode disabled for class fields
- Path alias `@/*` maps to project root
- `react-native-mmkv` aliased to `src/lib/mmkv.ts` for web compatibility
- Component files use `.tsx`, utilities use `.ts`
- Portuguese language for UI strings and user-facing text

## Notes

- The `new-version/` directory is excluded from TypeScript compilation
- HMR can be disabled via `DISABLE_HMR=true` environment variable (used in AI Studio)
- No test framework currently configured
- Service worker only registers in production builds
