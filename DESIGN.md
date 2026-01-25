# Wingspan Score Tracker - System Design Document

## 1. Overview

A Svelte-based web application for tracking Wingspan game statistics across multiple players and leagues. The app provides a fantasy football-like experience for board game statistics, allowing users to track performance metrics, view leaderboards, and analyze scoring breakdowns.

### 1.1 Core Requirements
- **Authentication**: Basic login system for user access
- **Multi-Player Tracking**: Support for 3-player game sessions
- **League System**: Users can belong to multiple leagues (player combinations)
- **Statistics Dashboard**: Comprehensive stats including placement, wins, and scoring breakdowns
- **Lightweight Database**: Minimal database footprint with efficient queries

### 1.2 Technology Stack
- **Frontend**: SvelteKit
- **UI Library**: DaisyUI (Tailwind CSS)
- **Database**: SQLite (lightweight, file-based)
- **Authentication**: Session-based auth with JWT tokens
- **Backend**: SvelteKit API routes

---

## 2. Database Schema Design

### 2.1 Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id`: Primary key
- `username`: Unique username for login
- `email`: Unique email address
- `password_hash`: Bcrypt hashed password
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp

### 2.2 Leagues Table
```sql
CREATE TABLE leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Fields:**
- `id`: Primary key
- `name`: League name (e.g., "Weekend Warriors")
- `created_by`: User who created the league
- `created_at`: League creation timestamp

### 2.3 League Players Table (Many-to-Many)
```sql
CREATE TABLE league_players (
    league_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    player_color TEXT, -- 'player_1', 'player_2', 'player_3'
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (league_id, user_id),
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Fields:**
- `league_id`: Reference to league
- `user_id`: Reference to user/player
- `player_color`: Visual identifier for the player
- `joined_at`: When player joined the league

### 2.4 Games Table
```sql
CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Fields:**
- `id`: Primary key
- `league_id`: Which league this game belongs to
- `played_at`: When the game was played
- `created_by`: Who recorded this game

### 2.5 Scores Table (Core Scoring Data)
```sql
CREATE TABLE scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    placement INTEGER NOT NULL CHECK (placement IN (1, 2, 3)),
    total_score INTEGER NOT NULL,
    -- Scoring breakdown
    birds INTEGER DEFAULT 0,
    bonus_cards INTEGER DEFAULT 0,
    end_of_round_goals INTEGER DEFAULT 0,
    eggs INTEGER DEFAULT 0,
    food_on_cards INTEGER DEFAULT 0,
    tucked_cards INTEGER DEFAULT 0,
    nectar INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(game_id, user_id) -- One score per user per game
);
```

**Fields:**
- `id`: Primary key
- `game_id`: Reference to the game
- `user_id`: Player who scored
- `placement`: Final placement (1st, 2nd, 3rd)
- `total_score`: Sum of all scoring categories
- `birds`: Points from bird cards
- `bonus_cards`: Points from bonus cards
- `end_of_round_goals`: Points from round goals
- `eggs`: Points from eggs
- `food_on_cards`: Points from food on cards
- `tucked_cards`: Points from tucked cards
- `nectar`: Points from nectar
- `created_at`: When score was recorded

### 2.6 Database Indexes
```sql
CREATE INDEX idx_scores_user_id ON scores(user_id);
CREATE INDEX idx_scores_game_id ON scores(game_id);
CREATE INDEX idx_scores_league_games ON games(league_id);
CREATE INDEX idx_league_players_league ON league_players(league_id);
CREATE INDEX idx_league_players_user ON league_players(user_id);
```

---

## 3. System Architecture

### 3.1 Application Structure
```
wingspan-score/
├── src/
│   ├── lib/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── auth/
│   │   │   ├── league/
│   │   │   ├── scoreboard/
│   │   │   └── shared/
│   │   ├── stores/              # Svelte stores
│   │   │   ├── auth.js
│   │   │   ├── league.js
│   │   │   └── stats.js
│   │   ├── utils/               # Utility functions
│   │   │   ├── db.js            # Database utilities
│   │   │   ├── auth.js          # Auth utilities
│   │   │   └── calculations.js  # Stats calculations
│   │   └── styles/              # Global styles
│   ├── routes/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (protected)/
│   │   │   ├── leagues/
│   │   │   ├── leagues/[id]/
│   │   │   └── scoreboard/
│   │   └── +layout.svelte
│   ├── app.html
│   └── app.d.ts
├── database/
│   └── wingspan.db              # SQLite database
├── static/
│   └── favicon.ico
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

### 3.2 Authentication Flow
```
1. User visits app → Redirected to /login if not authenticated
2. User enters credentials → POST /api/auth/login
3. Server validates → Returns JWT token
4. Token stored in httpOnly cookie + Svelte store
5. User redirected to /leagues
6. All protected routes check authentication via middleware
```

### 3.3 Data Flow
```
User Action → Svelte Component → API Route → Database → Response → Store Update → UI Update
```

---

## 4. Component Architecture

### 4.1 Component Hierarchy
```
App Layout
├── AuthLayout (for login/register)
│   ├── LoginForm
│   └── RegisterForm
└── MainLayout (for authenticated users)
    ├── Navigation
    ├── LeagueSelector
    ├── PlayerCards
    └── Scoreboard
        ├── StatsTable
        ├── ScoringBreakdown
        └── PerformanceChart
```

### 4.2 Reusable Components (DaisyUI Integration)

#### 4.2.1 Shared Components

**Button Component** (`Button.svelte`)
- Variants: primary, secondary, ghost
- Sizes: sm, md, lg
- States: loading, disabled
- Uses DaisyUI button classes

**Card Component** (`Card.svelte`)
- Consistent card styling
- Optional header, body, footer slots
- Hover effects
- Uses DaisyUI card classes

**Input Component** (`Input.svelte`)
- Text, number, email types
- Error states
- Label support
- Uses DaisyUI input classes

**Table Component** (`Table.svelte`)
- Sortable columns
- Responsive design
- Row hover effects
- Uses DaisyUI table classes

**Badge Component** (`Badge.svelte`)
- Status indicators
- Color variants
- Uses DaisyUI badge classes

**Modal Component** (`Modal.svelte`)
- Reusable modal wrapper
- Close on backdrop click
- Uses DaisyUI modal classes

#### 4.2.2 Auth Components

**LoginForm** (`auth/LoginForm.svelte`)
- Username/email input
- Password input
- Submit button
- Error display
- Uses Button, Input components

**RegisterForm** (`auth/RegisterForm.svelte`)
- Username input
- Email input
- Password input
- Confirm password
- Submit button
- Uses Button, Input components

#### 4.2.3 League Components

**LeagueSelector** (`league/LeagueSelector.svelte`)
- Dropdown/select for league selection
- Create new league button
- Active league indicator
- Uses DaisyUI select, Button

**LeagueCard** (`league/LeagueCard.svelte`)
- League name
- Player count
- Last game date
- Quick stats preview
- Uses Card, Badge components

**PlayerCard** (`league/PlayerCard.svelte`)
- Player name/avatar
- Status indicator (active/inactive)
- Quick stats (W/L, avg score)
- Player color accent
- Uses Card, Badge components

**CreateLeagueModal** (`league/CreateLeagueModal.svelte`)
- League name input
- Player selection (multi-select)
- Submit button
- Uses Modal, Input, Button components

#### 4.2.4 Scoreboard Components

**StatsTable** (`scoreboard/StatsTable.svelte`)
- Rank column
- Player name
- Avg placement
- First place finishes
- Average score
- Uses Table, Badge components

**ScoringBreakdown** (`scoreboard/ScoringBreakdown.svelte`)
- Horizontal bar chart for each category
- Player comparison
- Average values
- Uses custom bar chart component

**PerformanceChart** (`scoreboard/PerformanceChart.svelte`)
- Line chart showing score over time
- Multiple player lines
- Interactive tooltips
- Uses Chart.js or similar

**AddGameModal** (`scoreboard/AddGameModal.svelte`)
- Date picker
- Score inputs for each player
- Breakdown inputs (birds, bonus, etc.)
- Submit button
- Uses Modal, Input, Button components

---

## 5. API Design

### 5.1 Authentication Endpoints

**POST /api/auth/register**
```typescript
Request: {
  username: string;
  email: string;
  password: string;
}

Response: {
  success: boolean;
  user?: { id: number; username: string; email: string };
  error?: string;
}
```

**POST /api/auth/login**
```typescript
Request: {
  username: string; // or email
  password: string;
}

Response: {
  success: boolean;
  token?: string;
  user?: { id: number; username: string; email: string };
  error?: string;
}
```

**POST /api/auth/logout**
```typescript
Response: {
  success: boolean;
}
```

**GET /api/auth/me**
```typescript
Response: {
  user?: { id: number; username: string; email: string };
  error?: string;
}
```

### 5.2 League Endpoints

**GET /api/leagues**
```typescript
Response: {
  leagues: Array<{
    id: number;
    name: string;
    playerCount: number;
    lastGameDate?: string;
    players: Array<{ id: number; username: string; color: string }>;
  }>;
}
```

**POST /api/leagues**
```typescript
Request: {
  name: string;
  playerIds: number[]; // Array of user IDs (max 3)
}

Response: {
  success: boolean;
  league?: { id: number; name: string };
  error?: string;
}
```

**GET /api/leagues/[id]**
```typescript
Response: {
  league: {
    id: number;
    name: string;
    players: Array<{ id: number; username: string; color: string }>;
    games: Array<{ id: number; playedAt: string }>;
  };
}
```

### 5.3 Scoreboard Endpoints

**GET /api/leagues/[id]/stats**
```typescript
Response: {
  stats: Array<{
    userId: number;
    username: string;
    color: string;
    avgPlacement: number;
    firstPlaceFinishes: number;
    averageScore: number;
    avgBreakdown: {
      birds: number;
      bonusCards: number;
      endOfRoundGoals: number;
      eggs: number;
      foodOnCards: number;
      tuckedCards: number;
      nectar: number;
    };
    totalGames: number;
    wins: number;
    losses: number;
  }>;
}
```

**POST /api/games**
```typescript
Request: {
  leagueId: number;
  playedAt: string; // ISO date string
  scores: Array<{
    userId: number;
    placement: number;
    totalScore: number;
    birds: number;
    bonusCards: number;
    endOfRoundGoals: number;
    eggs: number;
    foodOnCards: number;
    tuckedCards: number;
    nectar: number;
  }>;
}

Response: {
  success: boolean;
  game?: { id: number };
  error?: string;
}
```

**GET /api/games/[id]**
```typescript
Response: {
  game: {
    id: number;
    leagueId: number;
    playedAt: string;
    scores: Array<{
      userId: number;
      username: string;
      placement: number;
      totalScore: number;
      breakdown: {
        birds: number;
        bonusCards: number;
        endOfRoundGoals: number;
        eggs: number;
        foodOnCards: number;
        tuckedCards: number;
        nectar: number;
      };
    }>;
  };
}
```

---

## 6. User Flow Diagrams

### 6.1 Initial User Flow
```
1. User visits app
   ↓
2. Check authentication
   ├─ Not authenticated → /login
   └─ Authenticated → /leagues
   ↓
3. User logs in
   ↓
4. Redirect to /leagues
   ↓
5. Display user's leagues
   ├─ Select league → /leagues/[id]
   └─ Create new league → Modal
   ↓
6. View league scoreboard
   ├─ View stats table
   ├─ View scoring breakdown
   └─ Add new game → Modal
```

### 6.2 League Selection Flow
```
1. User on /leagues page
   ↓
2. See list of leagues (cards or dropdown)
   ↓
3. Click on league
   ↓
4. Navigate to /leagues/[id]
   ↓
5. Load league stats
   ↓
6. Display scoreboard with:
   - Stats table (avg placement, wins, avg score)
   - Scoring breakdown chart
   - Performance over time graph
```

### 6.3 Add Game Flow
```
1. User clicks "Add Game" button
   ↓
2. Modal opens with form
   ↓
3. User enters:
   - Date (defaults to today)
   - Scores for each player
   - Breakdown for each player
   ↓
4. Submit form
   ↓
5. API validates (3 players, valid scores)
   ↓
6. Save to database
   ↓
7. Update stats
   ↓
8. Refresh scoreboard display
```

---

## 7. Styling Guide (DaisyUI + Custom)

### 7.1 Theme Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Custom color palette
        'bg-primary': '#0a0a0a',
        'bg-secondary': '#1a1a1a',
        'bg-panel': '#141414',
        'bg-card': '#1f1f1f',
        'text-primary': '#ffffff',
        'text-secondary': '#888888',
        'text-tertiary': '#666666',
        'player-1': '#4A90E2',
        'player-2': '#FF6B35',
        'player-3': '#9B59B6',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        dark: {
          ...require('daisyui/src/theming/themes')['dark'],
          'base-100': '#0a0a0a',
          'base-200': '#1a1a1a',
          'base-300': '#141414',
          'primary': '#4A90E2',
          'secondary': '#FF6B35',
          'accent': '#9B59B6',
        },
      },
    ],
    darkTheme: 'dark',
  },
};
```

### 7.2 Component Styling Patterns

**Card Styling**
```svelte
<!-- Uses DaisyUI card with custom colors -->
<div class="card bg-card border border-base-300 rounded-lg p-6 hover:shadow-xl transition-all">
  <!-- Card content -->
</div>
```

**Button Styling**
```svelte
<!-- Primary button -->
<button class="btn btn-primary bg-player-1 hover:bg-blue-600 text-white">
  Submit
</button>

<!-- Secondary button -->
<button class="btn btn-secondary bg-base-300 hover:bg-base-200">
  Cancel
</button>
```

**Table Styling**
```svelte
<!-- Uses DaisyUI table with custom styling -->
<table class="table w-full">
  <thead class="bg-base-200">
    <tr>
      <th class="text-text-secondary uppercase text-xs">Rank</th>
      <!-- More headers -->
    </tr>
  </thead>
  <tbody>
    <tr class="hover:bg-base-200 transition-colors">
      <!-- Table rows -->
    </tr>
  </tbody>
</table>
```

**Input Styling**
```svelte
<!-- Uses DaisyUI input -->
<input 
  type="text" 
  class="input input-bordered w-full bg-base-200 border-base-300 text-text-primary"
  placeholder="Enter username"
/>
```

### 7.3 Layout Styling

**Two-Column Layout**
```svelte
<div class="flex h-screen bg-bg-primary">
  <!-- Left Panel (40%) -->
  <aside class="w-2/5 bg-bg-secondary p-8">
    <!-- League selector and player cards -->
  </aside>
  
  <!-- Right Panel (60%) -->
  <main class="flex-1 bg-bg-primary p-8">
    <!-- Scoreboard and stats -->
  </main>
</div>
```

---

## 8. State Management

### 8.1 Svelte Stores

**Auth Store** (`stores/auth.js`)
```javascript
import { writable } from 'svelte/store';

export const user = writable(null);
export const isAuthenticated = writable(false);
export const token = writable(null);
```

**League Store** (`stores/league.js`)
```javascript
import { writable } from 'svelte/store';

export const currentLeague = writable(null);
export const leagues = writable([]);
export const leagueStats = writable(null);
```

**UI Store** (`stores/ui.js`)
```javascript
import { writable } from 'svelte/store';

export const isLoading = writable(false);
export const error = writable(null);
export const activeModal = writable(null);
```

---

## 9. Security Considerations

### 9.1 Authentication
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens stored in httpOnly cookies
- Token expiration: 7 days
- Refresh token mechanism for extended sessions

### 9.2 Authorization
- Users can only view/edit their own leagues
- League creators have admin rights
- Score validation: exactly 3 players per game
- Placement validation: 1, 2, 3 only

### 9.3 Input Validation
- SQL injection prevention via parameterized queries
- XSS prevention via Svelte's built-in escaping
- CSRF protection via SameSite cookies
- Rate limiting on auth endpoints

---

## 10. Performance Considerations

### 10.1 Database Optimization
- Indexes on frequently queried columns
- Efficient JOIN queries for stats calculation
- Caching of computed statistics
- Pagination for large game histories

### 10.2 Frontend Optimization
- Lazy loading of league data
- Memoization of calculated stats
- Virtual scrolling for large tables
- Image optimization and lazy loading

### 10.3 API Optimization
- Response caching for static data
- Batch requests where possible
- Compression for large responses
- Database query optimization

---

## 11. Testing Strategy

### 11.1 Unit Tests
- Component rendering tests
- Store logic tests
- Utility function tests
- Calculation accuracy tests

### 11.2 Integration Tests
- Authentication flow
- League creation flow
- Score submission flow
- Stats calculation accuracy

### 11.3 E2E Tests
- Complete user journey
- Multi-user scenarios
- Error handling flows
- Edge cases

---

## 12. Deployment Considerations

### 12.1 Database
- SQLite file-based database (lightweight)
- Backup strategy for database file
- Migration scripts for schema updates

### 12.2 Environment Variables
```
DATABASE_PATH=./database/wingspan.db
JWT_SECRET=your-secret-key
NODE_ENV=production
```

### 12.3 Build Process
- SvelteKit build for production
- Static asset optimization
- Environment-specific configurations

---

## 13. Future Enhancements

### 13.1 Phase 2 Features
- Game history timeline
- Player comparison charts
- Achievement system
- Export statistics to CSV/PDF

### 13.2 Phase 3 Features
- Multi-league tournaments
- Player rankings across all leagues
- Social features (comments, reactions)
- Mobile app version

---

## 14. Component Specifications

### 14.1 Button Component
**File**: `src/lib/components/shared/Button.svelte`
**Props**:
- `variant`: 'primary' | 'secondary' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `loading`: boolean
- `disabled`: boolean
**Slots**: default (button text)
**DaisyUI Classes**: `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`

### 14.2 Card Component
**File**: `src/lib/components/shared/Card.svelte`
**Props**:
- `hover`: boolean (enable hover effects)
- `padding`: string (custom padding)
**Slots**: `header`, `default`, `footer`
**DaisyUI Classes**: `card`, `card-body`

### 14.3 Input Component
**File**: `src/lib/components/shared/Input.svelte`
**Props**:
- `type`: string (text, number, email, etc.)
- `label`: string
- `error`: string
- `placeholder`: string
- `value`: string (bindable)
**DaisyUI Classes**: `input`, `input-bordered`, `label`

### 14.4 Table Component
**File**: `src/lib/components/shared/Table.svelte`
**Props**:
- `headers`: string[]
- `data`: any[]
- `sortable`: boolean
**Slots**: `row` (for custom row rendering)
**DaisyUI Classes**: `table`, `table-zebra`

### 14.5 StatsTable Component
**File**: `src/lib/components/scoreboard/StatsTable.svelte`
**Props**:
- `stats`: Array<PlayerStats>
**Features**:
- Rank indicators (1st, 2nd, 3rd badges)
- Sortable columns
- Responsive design
**Uses**: Table, Badge components

### 14.6 ScoringBreakdown Component
**File**: `src/lib/components/scoreboard/ScoringBreakdown.svelte`
**Props**:
- `breakdown`: Array<PlayerBreakdown>
**Features**:
- Horizontal bar charts
- Category labels
- Player color coding
**Custom**: Chart rendering (Chart.js or custom SVG)

---

## 15. Implementation Checklist

### Phase 1: Foundation
- [ ] Project setup (SvelteKit, Tailwind, DaisyUI)
- [ ] Database schema creation
- [ ] Authentication system
- [ ] Basic routing structure

### Phase 2: Core Features
- [ ] User registration/login
- [ ] League creation/selection
- [ ] Player management
- [ ] Game score entry

### Phase 3: Statistics
- [ ] Stats calculation logic
- [ ] Scoreboard display
- [ ] Scoring breakdown visualization
- [ ] Performance charts

### Phase 4: Polish
- [ ] Responsive design
- [ ] Error handling
- [ ] Loading states
- [ ] Animations/transitions

---

## 16. Design System Integration

### 16.1 Color Usage
- **Player 1**: `#4A90E2` (Blue) - Primary actions, Player 1 indicators
- **Player 2**: `#FF6B35` (Orange) - Secondary actions, Player 2 indicators
- **Player 3**: `#9B59B6` (Purple) - Accent actions, Player 3 indicators
- **Success**: `#4CAF50` (Green) - Wins, positive indicators
- **Warning**: `#FFC107` (Yellow) - Cautions, warnings

### 16.2 Typography
- **Display**: 48px, semibold (600)
- **H1**: 32px, semibold (600)
- **H2**: 24px, semibold (600)
- **Body**: 15px, regular (400)
- **Small**: 13px, regular (400)
- **Tiny**: 11px, medium (500) - Labels, badges

### 16.3 Spacing
- **Card Padding**: 24px
- **Section Padding**: 32px
- **Component Gap**: 16px
- **Input Height**: 48px
- **Button Height**: 44px

---

This design document provides a comprehensive blueprint for implementing the Wingspan Score Tracker application with a focus on reusable components, clean architecture, and the specified dark tactical aesthetic using DaisyUI.
