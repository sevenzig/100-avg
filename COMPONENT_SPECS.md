# Component Specifications

## Reusable Component Library

All components follow DaisyUI patterns and the dark tactical design system.

---

## Shared Components

### Button.svelte
**Location**: `src/lib/components/shared/Button.svelte`

**Purpose**: Reusable button component with variants and states

**Props**:
```typescript
{
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  class?: string;
}
```

**Slots**:
- `default`: Button text/content

**Usage**:
```svelte
<Button variant="primary" size="md" on:click={handleClick}>
  Submit
</Button>
```

**Styling**:
- Primary: `btn-primary` (DaisyUI) + custom `bg-player-1`
- Secondary: `btn-secondary` (DaisyUI) + custom `bg-base-300`
- Ghost: `btn-ghost` (DaisyUI) + custom border
- Loading state: DaisyUI `loading` class

---

### Card.svelte
**Location**: `src/lib/components/shared/Card.svelte`

**Purpose**: Consistent card container with optional sections

**Props**:
```typescript
{
  hover?: boolean;
  padding?: string;
  class?: string;
}
```

**Slots**:
- `header`: Optional header section
- `default`: Main card content
- `footer`: Optional footer section

**Usage**:
```svelte
<Card hover={true}>
  <div slot="header">Card Title</div>
  <p>Card content goes here</p>
  <div slot="footer">Footer content</div>
</Card>
```

**Styling**:
- Base: `card bg-card border border-base-300 rounded-lg`
- Hover: `hover:shadow-xl hover:-translate-y-0.5 transition-all`
- Padding: Default `p-6`, customizable via prop

---

### Input.svelte
**Location**: `src/lib/components/shared/Input.svelte`

**Purpose**: Form input with label and error handling

**Props**:
```typescript
{
  type?: string; // 'text' | 'number' | 'email' | 'password'
  label?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  class?: string;
}
```

**Events**:
- `input`: Standard input event
- `blur`: Standard blur event

**Usage**:
```svelte
<Input
  type="text"
  label="Username"
  bind:value={username}
  error={usernameError}
  placeholder="Enter username"
/>
```

**Styling**:
- Base: `input input-bordered w-full bg-base-200 border-base-300 text-text-primary`
- Error state: `input-error` (DaisyUI) + error message display
- Label: `label` (DaisyUI) with `text-text-secondary`

---

### Table.svelte
**Location**: `src/lib/components/shared/Table.svelte`

**Purpose**: Data table with sorting and responsive design

**Props**:
```typescript
{
  headers: string[];
  data: any[];
  sortable?: boolean;
  class?: string;
}
```

**Slots**:
- `row`: Custom row rendering (receives row data and index)

**Usage**:
```svelte
<Table headers={['Name', 'Score', 'Place']} data={players} sortable={true}>
  <div slot="row" let:row let:i>
    <tr>
      <td>{row.name}</td>
      <td>{row.score}</td>
      <td>{row.place}</td>
    </tr>
  </div>
</Table>
```

**Styling**:
- Base: `table w-full` (DaisyUI)
- Header: `bg-base-200 text-text-secondary uppercase text-xs`
- Row: `hover:bg-base-200 transition-colors`
- Zebra: `table-zebra` (DaisyUI) optional

---

### Badge.svelte
**Location**: `src/lib/components/shared/Badge.svelte`

**Purpose**: Status indicators and labels

**Props**:
```typescript
{
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}
```

**Slots**:
- `default`: Badge content

**Usage**:
```svelte
<Badge variant="success">Winner</Badge>
<Badge variant="info" size="sm">Active</Badge>
```

**Styling**:
- Base: `badge` (DaisyUI) + custom colors
- Success: `badge-success` (DaisyUI) or custom green
- Warning: `badge-warning` (DaisyUI) or custom yellow
- Size: `badge-sm`, `badge-md`, `badge-lg` (DaisyUI)

---

### Modal.svelte
**Location**: `src/lib/components/shared/Modal.svelte`

**Purpose**: Reusable modal dialog

**Props**:
```typescript
{
  open: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
}
```

**Events**:
- `close`: Emitted when modal should close

**Slots**:
- `default`: Modal content
- `footer`: Optional footer with actions

**Usage**:
```svelte
<Modal bind:open={isOpen} title="Add Game" size="lg">
  <p>Modal content</p>
  <div slot="footer">
    <Button on:click={handleSubmit}>Submit</Button>
  </div>
</Modal>
```

**Styling**:
- Base: `modal` (DaisyUI)
- Backdrop: `modal-backdrop` (DaisyUI)
- Box: `modal-box bg-card` (DaisyUI + custom)
- Size: `modal-{size}` (DaisyUI)

---

## Auth Components

### LoginForm.svelte
**Location**: `src/lib/components/auth/LoginForm.svelte`

**Purpose**: User authentication form

**Props**: None

**Events**:
- `submit`: Emitted with `{ username, password }`

**Usage**:
```svelte
<LoginForm on:submit={handleLogin} />
```

**Components Used**:
- `Input` (username/email)
- `Input` (password)
- `Button` (submit)

**Layout**:
- Centered card layout
- Max width: 420px
- Padding: 48px
- Dark background with card styling

---

### RegisterForm.svelte
**Location**: `src/lib/components/auth/RegisterForm.svelte`

**Purpose**: New user registration form

**Props**: None

**Events**:
- `submit`: Emitted with `{ username, email, password }`

**Usage**:
```svelte
<RegisterForm on:submit={handleRegister} />
```

**Components Used**:
- `Input` (username)
- `Input` (email)
- `Input` (password)
- `Input` (confirm password)
- `Button` (submit)

**Validation**:
- Password match validation
- Email format validation
- Username length validation

---

## League Components

### LeagueSelector.svelte
**Location**: `src/lib/components/league/LeagueSelector.svelte`

**Purpose**: Dropdown/select for choosing active league

**Props**:
```typescript
{
  leagues: League[];
  selectedLeagueId?: number;
}
```

**Events**:
- `select`: Emitted with selected league ID
- `create`: Emitted when "Create League" is clicked

**Usage**:
```svelte
<LeagueSelector
  leagues={$leagues}
  selectedLeagueId={$currentLeague?.id}
  on:select={handleLeagueSelect}
  on:create={handleCreateLeague}
/>
```

**Components Used**:
- `Button` (create new)
- DaisyUI `select` component

**Styling**:
- Dropdown: `select select-bordered w-full bg-base-200`
- Create button: `btn btn-ghost btn-sm`

---

### LeagueCard.svelte
**Location**: `src/lib/components/league/LeagueCard.svelte`

**Purpose**: Display league information in card format

**Props**:
```typescript
{
  league: {
    id: number;
    name: string;
    playerCount: number;
    lastGameDate?: string;
    players: Player[];
  };
  active?: boolean;
}
```

**Events**:
- `click`: Emitted when card is clicked

**Usage**:
```svelte
<LeagueCard league={league} active={league.id === currentId} on:click={selectLeague} />
```

**Components Used**:
- `Card`
- `Badge` (player count, active indicator)

**Styling**:
- Active state: Border color change to `player-1`
- Hover: Elevation effect
- Player avatars/initials

---

### PlayerCard.svelte
**Location**: `src/lib/components/league/PlayerCard.svelte`

**Purpose**: Display player information with quick stats

**Props**:
```typescript
{
  player: {
    id: number;
    username: string;
    color: 'player_1' | 'player_2' | 'player_3';
    stats?: {
      wins: number;
      losses: number;
      avgScore: number;
    };
  };
  active?: boolean;
}
```

**Usage**:
```svelte
<PlayerCard player={player} active={player.id === currentPlayerId} />
```

**Components Used**:
- `Card`
- `Badge` (status indicator)

**Styling**:
- Color accent border based on `player.color`
- Status dot (active/inactive)
- Quick stats grid layout
- Player name prominent

**Layout**:
```
┌─────────────────────┐
│ Player Name    [●]  │
│                     │
│ W: 5  L: 3          │
│ Avg: 87.5           │
└─────────────────────┘
```

---

### CreateLeagueModal.svelte
**Location**: `src/lib/components/league/CreateLeagueModal.svelte`

**Purpose**: Modal form for creating new leagues

**Props**:
```typescript
{
  open: boolean;
  availablePlayers: User[];
}
```

**Events**:
- `close`: Emitted when modal closes
- `create`: Emitted with `{ name: string, playerIds: number[] }`

**Usage**:
```svelte
<CreateLeagueModal
  bind:open={showCreateModal}
  availablePlayers={availablePlayers}
  on:create={handleCreateLeague}
/>
```

**Components Used**:
- `Modal`
- `Input` (league name)
- Multi-select for players (max 3)
- `Button` (submit, cancel)

**Validation**:
- League name required
- Exactly 3 players required
- Player uniqueness

---

## Scoreboard Components

### StatsTable.svelte
**Location**: `src/lib/components/scoreboard/StatsTable.svelte`

**Purpose**: Display league statistics in table format

**Props**:
```typescript
{
  stats: Array<{
    userId: number;
    username: string;
    color: string;
    avgPlacement: number;
    firstPlaceFinishes: number;
    averageScore: number;
    totalGames: number;
    wins: number;
    losses: number;
  }>;
}
```

**Usage**:
```svelte
<StatsTable stats={$leagueStats} />
```

**Components Used**:
- `Table`
- `Badge` (rank indicators)

**Columns**:
1. Rank (with medal indicators: 🥇 🥈 🥉)
2. Player Name
3. Avg Placement
4. First Place Finishes
5. Average Score
6. W/L Record

**Styling**:
- Rank column: Circular badge with rank number
- First place: Gold color (#FFD700)
- Second place: Silver color (#C0C0C0)
- Third place: Bronze color (#CD7F32)
- Player name: Color-coded by player color
- Numeric columns: Tabular numbers, right-aligned

---

### ScoringBreakdown.svelte
**Location**: `src/lib/components/scoreboard/ScoringBreakdown.svelte`

**Purpose**: Visual breakdown of average scoring by category

**Props**:
```typescript
{
  breakdown: Array<{
    userId: number;
    username: string;
    color: string;
    averages: {
      birds: number;
      bonusCards: number;
      endOfRoundGoals: number;
      eggs: number;
      foodOnCards: number;
      tuckedCards: number;
      nectar: number;
    };
  }>;
}
```

**Usage**:
```svelte
<ScoringBreakdown breakdown={$breakdownData} />
```

**Layout**:
- Horizontal bar chart for each category
- Each category shows all 3 players side-by-side
- Bars colored by player color
- Value labels on bars

**Categories**:
1. Birds
2. Bonus Cards
3. End of Round Goals
4. Eggs
5. Food on Cards
6. Tucked Cards
7. Nectar

**Styling**:
- Bar height: 40px
- Bar spacing: 8px
- Category label: Left side, `text-text-secondary`
- Value label: Right side of bar, `text-text-primary`
- Max width calculation for bar length

---

### PerformanceChart.svelte
**Location**: `src/lib/components/scoreboard/PerformanceChart.svelte`

**Purpose**: Line chart showing score trends over time

**Props**:
```typescript
{
  games: Array<{
    id: number;
    playedAt: string;
    scores: Array<{
      userId: number;
      totalScore: number;
    }>;
  }>;
  players: Array<{
    id: number;
    username: string;
    color: string;
  }>;
}
```

**Usage**:
```svelte
<PerformanceChart games={$gameHistory} players={$leaguePlayers} />
```

**Features**:
- Line chart with 3 lines (one per player)
- X-axis: Game dates
- Y-axis: Total scores
- Interactive tooltips
- Player color-coded lines
- Grid lines for readability

**Library**: Chart.js or similar (lightweight)

**Styling**:
- Background: Transparent
- Grid lines: `#2a2a2a`
- Axis labels: `#666666`
- Line width: 3px
- Point radius: 5px
- Tooltip: Dark card with border

---

### AddGameModal.svelte
**Location**: `src/lib/components/scoreboard/AddGameModal.svelte`

**Purpose**: Form for entering new game scores

**Props**:
```typescript
{
  open: boolean;
  players: Array<{
    id: number;
    username: string;
    color: string;
  }>;
}
```

**Events**:
- `close`: Emitted when modal closes
- `submit`: Emitted with game data

**Usage**:
```svelte
<AddGameModal
  bind:open={showAddGame}
  players={$leaguePlayers}
  on:submit={handleAddGame}
/>
```

**Components Used**:
- `Modal`
- `Input` (date picker)
- Score inputs for each player
- Breakdown inputs for each player
- `Button` (submit, cancel)

**Form Structure**:
```
Date: [Date Picker]

Player 1 (username):
  Placement: [1/2/3]
  Total Score: [number]
  Breakdown:
    Birds: [number]
    Bonus Cards: [number]
    End of Round Goals: [number]
    Eggs: [number]
    Food on Cards: [number]
    Tucked Cards: [number]
    Nectar: [number]

[Repeat for Player 2 and Player 3]
```

**Validation**:
- Exactly 3 players with scores
- Placements must be 1, 2, 3 (unique)
- Total score must match sum of breakdown
- Date required

---

## Layout Components

### AuthLayout.svelte
**Location**: `src/routes/(auth)/+layout.svelte`

**Purpose**: Layout wrapper for authentication pages

**Features**:
- Centered card layout
- Dark background
- No navigation
- Full viewport height

**Styling**:
- Background: `bg-bg-primary`
- Centered: Flexbox center
- Card: Max width 420px, padding 48px

---

### MainLayout.svelte
**Location**: `src/routes/(protected)/+layout.svelte`

**Purpose**: Main application layout for authenticated users

**Features**:
- Navigation bar
- Two-column layout (40/60 split)
- User menu/logout
- League context

**Slots**:
- `default`: Main content area

**Components Used**:
- Navigation component
- User menu dropdown

**Styling**:
- Navbar: `navbar bg-base-200` (DaisyUI)
- Layout: Flex row for desktop, column for mobile

---

## Component Dependencies

```
Button
  └─ (No dependencies)

Card
  └─ (No dependencies)

Input
  └─ (No dependencies)

Table
  └─ (No dependencies)

Badge
  └─ (No dependencies)

Modal
  └─ (No dependencies)

LoginForm
  ├─ Input (2x)
  └─ Button

RegisterForm
  ├─ Input (4x)
  └─ Button

LeagueSelector
  └─ Button

LeagueCard
  ├─ Card
  └─ Badge

PlayerCard
  ├─ Card
  └─ Badge

CreateLeagueModal
  ├─ Modal
  ├─ Input
  └─ Button

StatsTable
  ├─ Table
  └─ Badge

ScoringBreakdown
  └─ (Custom chart rendering)

PerformanceChart
  └─ (Chart.js or similar)

AddGameModal
  ├─ Modal
  ├─ Input (many)
  └─ Button
```

---

## Component Testing Checklist

For each component:
- [ ] Renders correctly with required props
- [ ] Handles optional props gracefully
- [ ] Emits events correctly
- [ ] Applies correct styling classes
- [ ] Handles edge cases (empty data, null values)
- [ ] Responsive design works
- [ ] Accessibility (keyboard navigation, ARIA labels)
- [ ] Loading/error states

---

This specification provides detailed interface contracts for all reusable components in the application.
