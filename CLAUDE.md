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

## Permanent stats-lc Agent Rules

### 1. Do not persist heavy cache data

Never save large objects into `stats-lc-storage` or persisted `groupStats`.

Avoid persisting:
- full `topItems` arrays inside `groupStats`
- `historyCache`
- `topItemsCache`
- `userFullStatsCache`
- `timeRangeStatsCache`
- large stream/recent/history arrays

Reason: Safari/PWA/localStorage quota is limited and can throw `QuotaExceededError`, breaking app startup and leaving the UI stuck in loading.

Preferred approach:
- persist only lightweight preferences in Zustand;
- keep large caches in dedicated cache layers with TTL and safe fallbacks;
- if `groupStats` must be saved, save a stripped/lightweight version.

### 2. Stats Alike topItems hydration

`StatsAlike` needs tracks, artists, and albums to build matches, but those arrays must not inflate persisted `groupStats`.

Rules:
- do not inject full `topItems` into persisted `groupStats`;
- use a specific cache, lightweight local state, or returned `prefetchUserTops` data;
- avoid loops like `StatsAlike -> prefetchUserTops -> set groupStats -> StatsAlike`.

Required defenses:
- in-flight guard by `userId:period`;
- mark recent attempts even when arrays are empty;
- protect `activeIndex` when the list changes;
- never modulo by zero.

### 3. Orbital UI means a real orbital stage

When a task mentions `orbit`, `orbital`, `órbita`, or compares behavior to Stats Alike, do not implement it as a standard stacked card.

Orbital means:
- a large relative stage;
- absolute-positioned elements;
- large rings;
- satellites around a center;
- light points;
- subtle floating motion;
- preserved vertical scroll;
- no new requests.

Avoid:
- stacking artist/user/track/album in a column;
- tiny 90px orbits for primary sections;
- heavy rectangular cards around everything;
- undersized center avatars.

### 4. Vinyl/LeoHeader album resolution

For tracks that exist in multiple albums or compilations, the app should prefer the album resolved by stream evidence.

Backend support already exists:
- `/api/recent?resolveAlbums=1`
- `useTrackStreamEvidence`
- `track-album-enrichment.ts`

Rules:
- when recent tracks feed the vinyl/LeoHeader, call `resolveAlbums=1`;
- prefer enriched `track.album`, `track.albumImage`, `track.albumName`, and `track.albums[0]`;
- keep the old fallback if enrichment fails;
- do not add new polling.

### 5. Scroll-triggered UI must not mount heavy components

Elements that appear on scroll, such as floating mini headers, should remain mounted and only change:
- `opacity`
- `transform`
- `pointer-events`

Avoid:
- mounting/unmounting with `AnimatePresence` during scroll;
- recalculating images, dominant colors, or large arrays on scroll;
- animating `height`, `width`, `blur`, or heavy shadows;
- passing scroll state into heavy sections.

### 6. Stats charts are first-class features

Do not hide `Evolução de Atividade` or `Distribuição Horária` just because they render as zero.

If data exists but charts appear empty:
- treat it as a mapper/source bug;
- inspect `datesData`, `historyData`, `fullUserData`, `chartData`, and `hourlyDistributionData`;
- fix duration conversions and shape handling;
- distinguish true empty data from mapper failure.

### 7. Glassmorphism is React Web/Tailwind, not React Native

Do not use `expo-blur` or `BlurView` in this repo.

Use:
- `backdrop-filter`
- `-webkit-backdrop-filter`
- translucent backgrounds
- translucent borders
- shadow/inset highlights
- fallback styles when backdrop-filter is unsupported

Apply carefully:
- nav and modals can use stronger blur;
- repeated lists/cards should use moderate blur;
- avoid stacking too many blur layers.

### 8. App reset action

Settings may expose a `Reiniciar app` action to clear local app caches.

It may clear:
- app-specific `localStorage` keys;
- `stats-cache_*`;
- `stats-lc-storage`;
- `sessionStorage`;
- `CacheStorage`, with try/catch.

It must not clear:
- cookies;
- service workers via automatic unregister;
- external account data.

Always ask for confirmation before clearing local state.

### 9. Before large changes

Always read the real files involved before editing.

Checklist:
- identify the exact component;
- identify the data source;
- confirm whether a new request is being added;
- confirm whether persistence/cache is affected;
- check for loop risk;
- check mobile scroll impact;
- run `npm run lint`;
- run `npm run build`.

### 10. Required final report format

Every final report should include:
- files changed;
- real cause;
- what changed;
- whether a new request was added;
- whether persistence/cache changed;
- whether mobile scroll is preserved;
- lint result;
- build result;
- remaining risks;
- suggested commit command;
- confirmation that no commit was made, unless explicitly instructed otherwise.

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
