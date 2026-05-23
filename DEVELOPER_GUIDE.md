# Stats-LC Architecture & API Reference

This document serves as the architectural reference for AI agents working on the Stats-LC project.

## Core Architecture
- **Framework:** React + Vite (TypeScript).
- **State Management:** Zustand with `persist` middleware.
- **Persistence:** Local storage abstraction via `MMKV` (with `MockMMKV` fallback for web).
- **UI/UX:** Framer Motion for high-performance, GPU-accelerated animations.

## API Contract & Interaction
- **Primary Entrypoint:** `statsfmFetch(path, { force })` in `statsService.ts`.
- **Deduplication:** Simultaneous requests to the same path are deduplicated.
- **Resilience:** Automatic timeout protection and 1-retry mechanism for 5xx errors.
- **Live Polling:** `/api/group-live` is the primary lightweight endpoint for home screen polling.
- **Entity Pages:** Use `/api/entity`, `/api/entity-streams`, and `/api/entity-listeners` instead of raw upstream stats.fm payloads.
- **Comparisons:** Use `/api/compare` for multi-user analysis. It matches by ID, then `externalIds` (Spotify/Apple Music).

## Performance Standards
- **Memoization:** High-traffic components (`HomeHighlights`, `FriendsMonthlyHighlights`, etc.) must use `React.memo` and `useMemo` for complex calculations.
- **GPU Acceleration:** High-frequency animating elements (Vinyl record, Tonearm, Header) MUST use `will-change: transform, opacity`.
- **Timer Centralization:** Do NOT use local `setInterval`. Use the global `heartbeat` provided by `useStatsStore` (`state.heartbeat`) to synchronize UI updates.
- **Proactive Loading:** Use `prefetchUserTops` and `prefetchNextFriend` when a user focuses on a friend to warm the cache.

## UI/UX Guidelines
- **Animations:** Use quartic-out easing for values (like `AnimatedNumber`) for a premium feel.
- **Layout Transitions:** Always use `layout` or `layout="position"` in Framer Motion for smooth list reordering and expansion.
- **Images:** Use `SmartImage` for automated loading states and error handling.

## Directory Structure
- `src/components/home`: Modularized home components.
- `src/services`: API interaction and core utilities.
- `src/store`: Centralized state (Zustand).
- `src/types`: TypeScript definitions.
