# Project Index: Wingspan Score Tracker

Generated: 2026-01-25

## 📁 Project Structure

```
wingspan-score/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── auth/          # LoginForm, RegisterForm
│   │   │   ├── league/        # LeagueSelector, LeagueCard, PlayerCard, CreateLeagueModal
│   │   │   ├── scoreboard/   # StatsTable, ScoringBreakdown, PerformanceChart, AddGameModal
│   │   │   └── shared/        # Button, Card, Input, Table, Badge, Modal
│   │   ├── stores/            # auth.ts, league.ts, ui.ts
│   │   └── utils/             # auth.ts, db.ts
│   ├── routes/
│   │   ├── (auth)/            # login, register pages
│   │   ├── (protected)/       # leagues pages
│   │   └── api/               # REST API endpoints
│   ├── hooks.server.ts        # Database initialization
│   └── app.html               # Root HTML template
├── scripts/                   # Database utilities (seed, migrate, cleanup)
├── database/                  # SQLite database files
└── static/                    # Static assets
```

## 🚀 Entry Points

- **CLI**: `npm run dev` - Development server (Vite + SvelteKit)
- **Build**: `npm run build` - Production build
- **API**: `/api/*` - REST API endpoints (see API_DOCUMENTATION.md)
- **Database**: `src/lib/utils/db.ts` - SQLite initialization and access
- **Hooks**: `src/hooks.server.ts` - Server-side initialization

## 📦 Core Modules

### Database Layer
- **Path**: `src/lib/utils/db.ts`
- **Exports**: `getDb()`, `initDatabase()`
- **Purpose**: SQLite database connection and schema initialization
- **Schema**: Users, Leagues, LeaguePlayers, Games, Scores (see DATABASE_SCHEMA.md)

### Authentication
- **Path**: `src/lib/utils/auth.ts`
- **Exports**: `hashPassword()`, `verifyPassword()`, `generateToken()`, `verifyToken()`, `getUserIdFromRequest()`
- **Purpose**: JWT-based authentication with bcrypt password hashing
- **Security**: httpOnly cookies, 7-day token expiry, bcrypt rounds: 10

### State Management
- **Path**: `src/lib/stores/`
- **Stores**:
  - `auth.ts` - User authentication state
  - `league.ts` - Current league and league list
  - `ui.ts` - UI state (modals, loading)

### API Routes
- **Auth**: `/api/auth/{login,logout,register,me}`
- **Leagues**: `/api/leagues` (GET, POST), `/api/leagues/[id]` (GET)
- **Games**: `/api/games` (POST), `/api/games/[id]` (GET)
- **Stats**: `/api/leagues/[id]/stats` (GET)
- **Users**: `/api/users` (GET)

### Components

#### Shared Components
- `Button.svelte` - Reusable button with variants
- `Card.svelte` - Card container with slots
- `Input.svelte` - Form input with validation
- `Table.svelte` - Data table with sorting
- `Badge.svelte` - Status indicators
- `Modal.svelte` - Modal dialog

#### Feature Components
- **Auth**: `LoginForm.svelte`, `RegisterForm.svelte`
- **League**: `LeagueSelector.svelte`, `LeagueCard.svelte`, `PlayerCard.svelte`, `CreateLeagueModal.svelte`
- **Scoreboard**: `StatsTable.svelte`, `ScoringBreakdown.svelte`, `PerformanceChart.svelte`, `AddGameModal.svelte`

## 🔧 Configuration

- **SvelteKit**: `svelte.config.js` - Node adapter, build output: `build/`
- **Vite**: `vite.config.js` - SvelteKit plugin
- **TypeScript**: `tsconfig.json` - Strict mode, module resolution: bundler
- **Tailwind**: `tailwind.config.js` - DaisyUI integration
- **PostCSS**: `postcss.config.js` - Autoprefixer
- **Docker**: `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`, `docker-compose.prod.yml`

## 📚 Documentation

- **README.md** - Project overview and design system
- **DESIGN.md** - System architecture and design decisions
- **API_DOCUMENTATION.md** - Complete API endpoint reference
- **DATABASE_SCHEMA.md** - Database schema and relationships
- **COMPONENT_SPECS.md** - Component specifications and usage
- **USER_FLOWS.md** - User flow diagrams
- **SETUP.md** - Setup instructions
- **DOCKER_README.md** - Docker deployment guide

## 🧪 Scripts

- **Database**: `npm run seed` - Seed database
- **Migration**: `npm run migrate` - Run migrations
- **Utilities**: `scripts/check-database.ts`, `scripts/cleanup-duplicates.ts`, `scripts/fix-league-1.ts`
- **User Management**: `scripts/add-users.ts`, `scripts/add-admin-users.ts`, `scripts/list-users.ts`
- **Data Import**: `scripts/import-new-game-data.ts`, `scripts/associate-game-to-league.ts`

## 🔗 Key Dependencies

### Runtime
- `@sveltejs/kit` (^2.50.1) - Framework
- `svelte` (^4.2.20) - UI framework
- `better-sqlite3` (^12.6.2) - SQLite database
- `bcryptjs` (^2.4.3) - Password hashing
- `jsonwebtoken` (^9.0.3) - JWT tokens
- `chart.js` (^4.5.1) - Charts
- `svelte-chartjs` (^3.1.5) - Chart.js Svelte wrapper

### Development
- `@sveltejs/adapter-node` (^5.2.0) - Node.js adapter
- `typescript` (^5.7.2) - Type checking
- `tailwindcss` (^3.4.17) - CSS framework
- `daisyui` (^4.12.24) - Tailwind component library
- `vite` (^5.4.21) - Build tool
- `tsx` (^4.19.2) - TypeScript execution

## 📝 Quick Start

1. **Install**: `npm install`
2. **Database**: Database auto-initializes on first server start
3. **Dev Server**: `npm run dev`
4. **Seed Data**: `npm run seed` (optional)
5. **Build**: `npm run build`
6. **Preview**: `npm run preview`

## 🎯 Key Features

- **Authentication**: JWT-based with httpOnly cookies
- **Leagues**: Multi-player league management (3+ players per league)
- **Games**: Track game sessions with detailed scoring
- **Statistics**: Average placement, wins/losses, scoring breakdown
- **Visualizations**: Performance charts, scoring breakdown charts
- **Responsive**: Mobile-first design with DaisyUI

## 🗄️ Database Schema

**Tables**:
- `users` - User accounts (id, username, email, password_hash, is_admin)
- `leagues` - League definitions (id, name, created_by)
- `league_players` - Many-to-many (league_id, user_id, player_color)
- `games` - Game sessions (id, league_id, played_at, created_by)
- `scores` - Detailed scores (id, game_id, user_id, placement, total_score, breakdown fields)

**Relationships**:
- Users ↔ Leagues (many-to-many via league_players)
- Leagues → Games (one-to-many)
- Games → Scores (one-to-many, exactly 3 scores per game)

## 🔐 Security

- Password hashing: bcrypt (10 rounds)
- JWT tokens: 7-day expiry, httpOnly cookies
- SQL injection: Parameterized queries
- XSS: Svelte automatic escaping
- CSRF: SameSite strict cookies
- Rate limiting: Auth endpoints (planned)

## 📊 Statistics Tracked

- Average placement (1-5)
- First place finishes
- Average total score
- Average scoring breakdown:
  - Birds, Bonus Cards, End of Round Goals
  - Eggs, Food on Cards, Tucked Cards, Nectar

---

**Index Status**: ✅ Complete  
**Last Updated**: 2026-01-25  
**Token Efficiency**: ~3,000 tokens (vs 58,000+ for full codebase read)
