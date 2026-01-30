# Project Index: wingspan-score

Generated: 2026-01-26

## 📁 Project Structure

- `src/` - SvelteKit application (routes, components, utilities, stores)
- `docs/` - Design, API, deployment, and troubleshooting documentation
- `scripts/` - One-off maintenance and data import scripts
- `design-system/` - Design system documentation for Wingspan Score Tracker
- `.shared/` - Shared helper scripts and assets

## 🚀 Entry Points

- **Dev server**: `npm run dev` (Vite + SvelteKit)
- **Build**: `npm run build`
- **Preview**: `npm run preview`
- **API**: `src/routes/api/*` (e.g. `/api/games`, `/api/leagues`, `/api/profile`)
- **Database**: `src/lib/utils/db.ts`
- **Server hooks**: `src/hooks.server.ts`

## 📦 Core Modules

### Module: Database
- **Path**: `src/lib/utils/db.ts`
- **Exports**: `getDb`, `initDatabase` (and helpers)
- **Purpose**: Initialize and access the SQLite database used for users, leagues, games, and scores.

### Module: Auth
- **Path**: `src/lib/utils/auth.ts`
- **Exports**: `hashPassword`, `verifyPassword`, `generateToken`, `verifyToken`, `getUserIdFromRequest`
- **Purpose**: JWT-based authentication with bcrypt password hashing and cookie handling.

### Module: Screenshot Image Parser
- **Path**: `src/lib/utils/image-parser.ts`
- **Exports**: `parseScreenshot`, `calculateConfidence`, `extractWarnings`
- **Purpose**: Use Anthropic Claude Vision to extract player names and scoring breakdowns from Wingspan end-of-game screenshots.

### Module: Stores
- **Path**: `src/lib/stores/`
- **Files**: `auth.ts`, `league.ts`, `ui.ts`
- **Purpose**: Svelte stores for authentication state, league selection, and UI state.

## 🔧 Configuration

- `svelte.config.js` - SvelteKit adapter and preprocessing configuration
- `vite.config.js` - Vite build and dev-server configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - TailwindCSS + DaisyUI configuration
- `postcss.config.js` - PostCSS (Tailwind pipeline) configuration
- `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`, `docker-compose.prod.yml` - Containerization and deployment configuration

## 📚 Documentation

- `README.md` - High-level project overview and setup
- `SETUP.md` - Detailed local environment setup instructions
- `docs/development/DESIGN.md` - Product and UI/UX design overview
- `docs/development/API_DOCUMENTATION.md` - HTTP API reference
- `docs/development/DATABASE_SCHEMA.md` - Database schema and relationships
- `docs/development/COMPONENT_SPECS.md` - Frontend component specifications
- `docs/development/USER_FLOWS.md` - Key user flows and interactions
- `docs/MANUAL_DATA_UPLOAD_GUIDE.md` - Manual screenshot upload and data extraction guide
- `SCREENSHOT_UPLOAD_DESIGN.md` - Screenshot upload feature design details
- `docs/deployment/DOCKER_README.md` & related deployment docs - Docker and production deployment guides
- `docs/troubleshooting/*` - 502 errors, upload timeouts, and other troubleshooting guides

## 🧪 Test & Maintenance Scripts

- **Database & data**:
  - `scripts/seed-database.ts` - Seed the local SQLite database
  - `scripts/check-database.ts` - Inspect and validate database state
  - `scripts/cleanup-duplicates.ts` - Clean duplicate records
  - `scripts/fix-league-1.ts`, `scripts/fix-league-players.ts` - One-off league fixes
- **Migrations**:
  - `scripts/migrate-to-5-players.ts` - Update schema/data to support up to 5 players
  - `scripts/migrate-profile-columns.ts` - Profile-related migrations
- **Users & leagues**:
  - `scripts/add-users.ts`, `scripts/add-admin-users.ts`, `scripts/list-users.ts`
  - `scripts/check-leagues.ts`, `scripts/check-league-players.ts`, `scripts/remove-league-2.ts`
- **Import & screenshot data**:
  - `scripts/import-new-game-data.ts`, `scripts/import-image-game-data.ts`, `scripts/import-two-games.ts`
  - `scripts/associate-game-to-league.ts` - Link imported games to leagues

## 🔗 Key Dependencies

- **Runtime**:
  - `@anthropic-ai/sdk` - Claude API client for screenshot parsing
  - `better-sqlite3` - Embedded SQLite database
  - `bcryptjs` - Password hashing
  - `jsonwebtoken` - JWT creation and verification
  - `chart.js` - Charts for stats visualizations
- **Dev / Tooling**:
  - `@sveltejs/kit`, `@sveltejs/adapter-node`, `@sveltejs/vite-plugin-svelte` - SvelteKit framework and adapter
  - `svelte` (v5), `svelte-check` - Svelte runtime and diagnostics
  - `typescript`, `tsx` - TypeScript tooling and script runner
  - `vite` - Dev server and bundler
  - `tailwindcss`, `daisyui`, `postcss`, `autoprefixer` - Styling and design system tooling

## 📝 Quick Start

1. **Install dependencies**
   - `npm install`
2. **Initialize database (optional but recommended)**
   - `npm run seed`
3. **Run the app**
   - `npm run dev` and open the printed URL in your browser

