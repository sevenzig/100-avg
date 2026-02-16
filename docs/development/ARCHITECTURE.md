# Architecture Overview

One-pager on stack, auth, and data model for onboarding and refactors.

## Stack

- **Frontend / server**: SvelteKit (Vite, Svelte 5)
- **Database**: SQLite via `better-sqlite3` (single file, e.g. `database/wingspan.db`)
- **Auth**: JWT in httpOnly cookie (`token`), verified in API routes
- **UI**: Tailwind CSS, DaisyUI

## Auth

- **Where**: `src/lib/utils/auth.ts`
- **Helpers**: `getUserId(cookies)`, `requireAuth(cookies)`, `requireLeagueMember(leagueId, cookies, db)`, `canManageLeagueGames`, `isAdmin`, `isSuperAdmin`
- **Types**: `CookieGetter`, `DbLike` (minimal interfaces so auth doesn’t depend on SvelteKit or better-sqlite3 types)
- **Flow**: API reads cookie → `getUserId` or `requireAuth` / `requireLeagueMember` → then business logic. League routes that need membership use `requireLeagueMember`; admin routes use their own `requireAdmin` (or equivalent).

## Data model

- **users** – accounts (username, email, password_hash, optional platform aliases: steam_alias, android_alias, iphone_alias)
- **leagues** – named groups; `created_by` = league admin
- **league_players** – many-to-many (league ↔ users)
- **games** – one per game session; `league_id`, `played_at`, `created_by`
- **scores** – one per player per game; `game_id`, `user_id`, placement, total_score, breakdown (birds, bonus_cards, etc.)

Relations: League has many games and many players (via league_players). Game has many scores (one per player). User is identified by username or any platform alias when matching (e.g. screenshot upload).

## Key paths

- **API**: `src/routes/api/` – auth in each handler via `getUserId` / `requireAuth` / `requireLeagueMember`
- **DB**: `src/lib/utils/db.ts` – `getDb()`, `initDatabase()` (called from `hooks.server.ts`)
- **Validation**: `src/lib/utils/validation.ts` – username, placements, platform aliases
- **Protected UI**: routes under `(protected)`; layout checks auth and redirects if needed

## Tests

- **Runner**: Vitest (`npm run test`, `npm run test:watch`)
- **Config**: `vitest.config.ts` (standalone, does not load SvelteKit)
- **Location**: `tests/*.test.ts` (e.g. `tests/validation.test.ts`)

## Env

- **JWT_SECRET** – required in production; dev fallback if unset
- **DATABASE_PATH** – optional; default `database/wingspan.db` (relative to cwd)
