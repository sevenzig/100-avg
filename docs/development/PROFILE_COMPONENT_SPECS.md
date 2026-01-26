# Profile Components - Technical Specifications

## Component Architecture

```
ProfilePage (+page.svelte)
│
├── ProfileEditForm
│   ├── Input (displayName)
│   ├── Input (username)
│   └── PlatformSelector
│       ├── Checkbox (steam)
│       ├── Checkbox (android)
│       └── Checkbox (iphone)
│
└── StatisticsSection
    ├── PlacementHistoryChart
    ├── CategoryAveragesChart
    └── RecentScoresChart
```

## Component Specifications

### 1. ProfilePage Component

**File:** `src/routes/(protected)/profile/+page.svelte`

**Responsibilities:**
- Fetch user profile data on mount
- Fetch statistics data on mount
- Manage edit mode state
- Handle profile updates
- Display loading and error states

**State Management:**
```typescript
let profile: Profile | null = null;
let stats: UserStats | null = null;
let loading = true;
let error = '';
let editMode = false;
let saving = false;
```

**Data Fetching:**
```typescript
async function loadProfile() {
  const response = await fetch('/api/profile');
  if (response.ok) {
    const data = await response.json();
    profile = data.profile;
  }
}

async function loadStats() {
  const response = await fetch('/api/profile/stats?matches=20');
  if (response.ok) {
    const data = await response.json();
    stats = data.stats;
  }
}
```

**Layout Structure:**
```svelte
<div class="space-y-6">
  <!-- Profile Section -->
  <Card>
    <ProfileEditForm 
      {profile} 
      on:save={handleSave}
      on:cancel={handleCancel}
    />
  </Card>

  <!-- Statistics Section -->
  <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    <Card>
      <PlacementHistoryChart data={stats?.placementHistory} />
    </Card>
    <Card>
      <CategoryAveragesChart data={stats?.categoryAverages} />
    </Card>
    <Card>
      <RecentScoresChart data={stats?.recentScores} />
    </Card>
  </div>
</div>
```

---

### 2. ProfileEditForm Component

**File:** `src/lib/components/profile/ProfileEditForm.svelte`

**Props:**
```typescript
export let profile: {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  platforms: string[];
};

export let loading = false;
```

**Events:**
```typescript
createEventDispatcher<{
  save: { profile: ProfileUpdate };
  cancel: void;
}>();
```

**State:**
```typescript
let displayName = '';
let username = '';
let platforms: string[] = [];
let formError = '';
let usernameError = '';
let checkingUsername = false;
```

**Validation:**
```typescript
function validateForm(): boolean {
  formError = '';
  usernameError = '';

  if (!username.trim()) {
    formError = 'Username is required';
    return false;
  }

  if (username.length < 1 || username.length > 50) {
    formError = 'Username must be between 1 and 50 characters';
    return false;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    formError = 'Username can only contain letters, numbers, underscores, and hyphens';
    return false;
  }

  if (displayName && displayName.length > 50) {
    formError = 'Display name must be 50 characters or less';
    return false;
  }

  // Validate platforms
  const validPlatforms = ['steam', 'android', 'iphone'];
  for (const platform of platforms) {
    if (!validPlatforms.includes(platform)) {
      formError = `Invalid platform: ${platform}`;
      return false;
    }
  }

  return true;
}
```

**Username Availability Check:**
```typescript
async function checkUsernameAvailability(newUsername: string) {
  if (newUsername === profile.username) {
    usernameError = '';
    return;
  }

  checkingUsername = true;
  try {
    const response = await fetch(`/api/users/check-username?username=${encodeURIComponent(newUsername)}`);
    const data = await response.json();
    if (!data.available) {
      usernameError = 'Username is already taken';
    } else {
      usernameError = '';
    }
  } catch (e) {
    // Silently fail - will be caught on save
  } finally {
    checkingUsername = false;
  }
}
```

**Platform Toggle:**
```typescript
function togglePlatform(platform: string) {
  if (platforms.includes(platform)) {
    platforms = platforms.filter(p => p !== platform);
  } else {
    platforms = [...platforms, platform];
  }
}
```

**UI Structure:**
```svelte
<form on:submit|preventDefault={handleSubmit}>
  <Input
    label="Display Name"
    bind:value={displayName}
    placeholder="Optional friendly name"
    error={formError}
  />

  <Input
    label="Username"
    bind:value={username}
    placeholder="Your username"
    required
    error={usernameError || formError}
    on:input={() => checkUsernameAvailability(username)}
  />
  {#if checkingUsername}
    <span class="text-sm text-slate-500">Checking availability...</span>
  {/if}

  <div class="form-control">
    <label class="block text-sm font-medium text-slate-700 mb-2">
      Platforms
    </label>
    <div class="space-y-2">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={platforms.includes('steam')}
          on:change={() => togglePlatform('steam')}
          class="checkbox checkbox-sm"
        />
        <span>Steam</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={platforms.includes('android')}
          on:change={() => togglePlatform('android')}
          class="checkbox checkbox-sm"
        />
        <span>Android</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={platforms.includes('iphone')}
          on:change={() => togglePlatform('iphone')}
          class="checkbox checkbox-sm"
        />
        <span>iPhone</span>
      </label>
    </div>
  </div>

  <div class="flex gap-2 justify-end">
    <Button variant="secondary" on:click={handleCancel} disabled={loading}>
      Cancel
    </Button>
    <Button type="submit" disabled={loading || !!usernameError}>
      {loading ? 'Saving...' : 'Save Changes'}
    </Button>
  </div>
</form>
```

---

### 3. PlacementHistoryChart Component

**File:** `src/lib/components/profile/PlacementHistoryChart.svelte`

**Props:**
```typescript
export let placementHistory: Array<{
  gameId: number;
  date: string;
  placement: number;
  totalScore: number;
}> | undefined;
```

**Chart Configuration:**
```typescript
const chartConfig = {
  type: 'bar' as const,
  data: {
    labels: ['1st', '2nd', '3rd', '4th', '5th'],
    datasets: [{
      label: 'Placements',
      data: [
        placementHistory.filter(p => p.placement === 1).length,
        placementHistory.filter(p => p.placement === 2).length,
        placementHistory.filter(p => p.placement === 3).length,
        placementHistory.filter(p => p.placement === 4).length,
        placementHistory.filter(p => p.placement === 5).length,
      ],
      backgroundColor: [
        '#F59E0B', // Gold
        '#94A3B8', // Silver
        '#CD7F32', // Bronze
        '#6B7280', // Gray
        '#4B5563', // Dark Gray
      ],
    }]
  },
  options: {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const count = context.parsed.x;
            return `${count} game${count !== 1 ? 's' : ''}`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1 }
      }
    }
  }
};
```

**UI Structure:**
```svelte
<div class="space-y-2">
  <h3 class="text-lg font-semibold text-slate-900">
    Placement History
  </h3>
  <p class="text-sm text-slate-600">
    Last {placementHistory?.length || 0} matches
  </p>
  <div class="h-64">
    {#if placementHistory && placementHistory.length > 0}
      <canvas bind:this={chartCanvas}></canvas>
    {:else}
      <div class="flex items-center justify-center h-full text-slate-500">
        No placement data available
      </div>
    {/if}
  </div>
</div>
```

---

### 4. CategoryAveragesChart Component

**File:** `src/lib/components/profile/CategoryAveragesChart.svelte`

**Props:**
```typescript
export let categoryAverages: {
  matches: number;
  birds: number;
  bonusCards: number;
  endOfRoundGoals: number;
  eggs: number;
  foodOnCards: number;
  tuckedCards: number;
  nectar: number;
} | undefined;
```

**Chart Configuration:**
```typescript
const chartConfig = {
  type: 'bar' as const,
  data: {
    labels: [
      'Birds',
      'Bonus Cards',
      'End Goals',
      'Eggs',
      'Food',
      'Tucked',
      'Nectar'
    ],
    datasets: [{
      label: 'Average Score',
      data: [
        categoryAverages.birds,
        categoryAverages.bonusCards,
        categoryAverages.endOfRoundGoals,
        categoryAverages.eggs,
        categoryAverages.foodOnCards,
        categoryAverages.tuckedCards,
        categoryAverages.nectar,
      ],
      backgroundColor: '#3B82F6',
      borderColor: '#2563EB',
      borderWidth: 1,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `Average: ${context.parsed.y.toFixed(1)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  }
};
```

**UI Structure:**
```svelte
<div class="space-y-2">
  <h3 class="text-lg font-semibold text-slate-900">
    Category Averages
  </h3>
  <p class="text-sm text-slate-600">
    Last {categoryAverages?.matches || 0} matches
  </p>
  <div class="h-64">
    {#if categoryAverages && categoryAverages.matches > 0}
      <canvas bind:this={chartCanvas}></canvas>
    {:else}
      <div class="flex items-center justify-center h-full text-slate-500">
        No category data available
      </div>
    {/if}
  </div>
</div>
```

---

### 5. RecentScoresChart Component

**File:** `src/lib/components/profile/RecentScoresChart.svelte`

**Props:**
```typescript
export let recentScores: Array<{
  gameId: number;
  date: string;
  totalScore: number;
}> | undefined;
```

**Chart Configuration:**
```typescript
const chartConfig = {
  type: 'bar' as const,
  data: {
    labels: recentScores.map(score => {
      const date = new Date(score.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }).reverse(),
    datasets: [{
      label: 'Total Score',
      data: recentScores.map(score => score.totalScore).reverse(),
      backgroundColor: recentScores.map(score => {
        // Gradient: higher scores = darker blue
        const maxScore = Math.max(...recentScores.map(s => s.totalScore));
        const intensity = score.totalScore / maxScore;
        return `rgba(59, 130, 246, ${0.5 + intensity * 0.5})`;
      }).reverse(),
      borderColor: '#3B82F6',
      borderWidth: 1,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `Score: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  }
};
```

**UI Structure:**
```svelte
<div class="space-y-2">
  <h3 class="text-lg font-semibold text-slate-900">
    Recent Scores
  </h3>
  <p class="text-sm text-slate-600">
    Last 10 games
  </p>
  <div class="h-64">
    {#if recentScores && recentScores.length > 0}
      <canvas bind:this={chartCanvas}></canvas>
    {:else}
      <div class="flex items-center justify-center h-full text-slate-500">
        No recent scores available
      </div>
    {/if}
  </div>
</div>
```

---

## API Endpoint Specifications

### GET /api/profile

**Implementation:** `src/routes/api/profile/+server.ts`

```typescript
export const GET: RequestHandler = async ({ cookies }) => {
  const userId = getUserId(cookies);
  if (!userId) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const db = getDb();
  const user = db
    .prepare(`
      SELECT 
        id,
        username,
        email,
        display_name,
        platforms,
        created_at
      FROM users
      WHERE id = ?
    `)
    .get(userId) as UserRow | undefined;

  if (!user) {
    return json({ error: 'User not found' }, { status: 404 });
  }

  return json({
    profile: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name || null,
      platforms: JSON.parse(user.platforms || '[]'),
      createdAt: user.created_at
    }
  });
};
```

### PUT /api/profile

**Implementation:** `src/routes/api/profile/+server.ts`

```typescript
export const PUT: RequestHandler = async ({ request, cookies }) => {
  const userId = getUserId(cookies);
  if (!userId) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { displayName, username, platforms } = await request.json();

  // Validation
  if (username && (username.length < 1 || username.length > 50)) {
    return json({ error: 'Username must be 1-50 characters' }, { status: 400 });
  }

  if (displayName && displayName.length > 50) {
    return json({ error: 'Display name must be 50 characters or less' }, { status: 400 });
  }

  if (platforms && !Array.isArray(platforms)) {
    return json({ error: 'Platforms must be an array' }, { status: 400 });
  }

  const validPlatforms = ['steam', 'android', 'iphone'];
  if (platforms) {
    for (const platform of platforms) {
      if (!validPlatforms.includes(platform)) {
        return json({ error: `Invalid platform: ${platform}` }, { status: 400 });
      }
    }
  }

  const db = getDb();

  // Check username uniqueness if changed
  if (username) {
    const existing = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(username, userId);
    
    if (existing) {
      return json({ error: 'Username already taken' }, { status: 409 });
    }
  }

  // Update profile
  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (displayName !== undefined) {
    updateFields.push('display_name = ?');
    updateValues.push(displayName || null);
  }

  if (username !== undefined) {
    updateFields.push('username = ?');
    updateValues.push(username);
  }

  if (platforms !== undefined) {
    updateFields.push('platforms = ?');
    updateValues.push(JSON.stringify(platforms));
  }

  if (updateFields.length > 0) {
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(userId);

    db.prepare(`
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...updateValues);
  }

  // Return updated profile
  const updated = db
    .prepare('SELECT id, username, email, display_name, platforms, created_at FROM users WHERE id = ?')
    .get(userId) as UserRow;

  return json({
    success: true,
    profile: {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      displayName: updated.display_name || null,
      platforms: JSON.parse(updated.platforms || '[]'),
      createdAt: updated.created_at
    }
  });
};
```

### GET /api/profile/stats

**Implementation:** `src/routes/api/profile/stats/+server.ts`

```typescript
export const GET: RequestHandler = async ({ cookies, url }) => {
  const userId = getUserId(cookies);
  if (!userId) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const matches = Math.min(parseInt(url.searchParams.get('matches') || '10'), 50);
  const leagueId = url.searchParams.get('leagueId') 
    ? parseInt(url.searchParams.get('leagueId')!) 
    : null;

  const db = getDb();

  // Get placement history
  const placementHistory = db
    .prepare(`
      SELECT 
        g.id as game_id,
        DATE(g.played_at) as date,
        s.placement,
        s.total_score
      FROM scores s
      JOIN games g ON s.game_id = g.id
      WHERE s.user_id = ?
        AND (? IS NULL OR g.league_id = ?)
      ORDER BY g.played_at DESC
      LIMIT ?
    `)
    .all(userId, leagueId, leagueId, matches) as PlacementRow[];

  // Get category averages
  const categoryAverages = db
    .prepare(`
      SELECT 
        COUNT(*) as matches,
        AVG(s.birds) as avg_birds,
        AVG(s.bonus_cards) as avg_bonus_cards,
        AVG(s.end_of_round_goals) as avg_end_of_round_goals,
        AVG(s.eggs) as avg_eggs,
        AVG(s.food_on_cards) as avg_food_on_cards,
        AVG(s.tucked_cards) as avg_tucked_cards,
        AVG(s.nectar) as avg_nectar
      FROM scores s
      JOIN games g ON s.game_id = g.id
      WHERE s.user_id = ?
        AND (? IS NULL OR g.league_id = ?)
      ORDER BY g.played_at DESC
      LIMIT ?
    `)
    .get(userId, leagueId, leagueId, matches) as CategoryAvgRow;

  // Get recent scores
  const recentScores = db
    .prepare(`
      SELECT 
        g.id as game_id,
        DATE(g.played_at) as date,
        s.total_score
      FROM scores s
      JOIN games g ON s.game_id = g.id
      WHERE s.user_id = ?
        AND (? IS NULL OR g.league_id = ?)
      ORDER BY g.played_at DESC
      LIMIT 10
    `)
    .all(userId, leagueId, leagueId) as RecentScoreRow[];

  return json({
    stats: {
      placementHistory: placementHistory.map(row => ({
        gameId: row.game_id,
        date: row.date,
        placement: row.placement,
        totalScore: row.total_score
      })),
      categoryAverages: {
        matches: categoryAverages.matches || 0,
        birds: categoryAverages.avg_birds || 0,
        bonusCards: categoryAverages.avg_bonus_cards || 0,
        endOfRoundGoals: categoryAverages.avg_end_of_round_goals || 0,
        eggs: categoryAverages.avg_eggs || 0,
        foodOnCards: categoryAverages.avg_food_on_cards || 0,
        tuckedCards: categoryAverages.avg_tucked_cards || 0,
        nectar: categoryAverages.avg_nectar || 0
      },
      recentScores: recentScores.map(row => ({
        gameId: row.game_id,
        date: row.date,
        totalScore: row.total_score
      }))
    }
  });
};
```

---

## Type Definitions

```typescript
// Profile Types
interface Profile {
  id: number;
  username: string;
  email: string;
  displayName?: string | null;
  platforms: string[];
  createdAt: string;
}

interface ProfileUpdate {
  displayName?: string | null;
  username?: string;
  platforms?: string[];
}

// Statistics Types
interface PlacementHistoryItem {
  gameId: number;
  date: string;
  placement: number;
  totalScore: number;
}

interface CategoryAverages {
  matches: number;
  birds: number;
  bonusCards: number;
  endOfRoundGoals: number;
  eggs: number;
  foodOnCards: number;
  tuckedCards: number;
  nectar: number;
}

interface RecentScore {
  gameId: number;
  date: string;
  totalScore: number;
}

interface UserStats {
  placementHistory: PlacementHistoryItem[];
  categoryAverages: CategoryAverages;
  recentScores: RecentScore[];
}

// Database Row Types
interface UserRow {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  platforms: string;
  created_at: string;
}

interface PlacementRow {
  game_id: number;
  date: string;
  placement: number;
  total_score: number;
}

interface CategoryAvgRow {
  matches: number;
  avg_birds: number;
  avg_bonus_cards: number;
  avg_end_of_round_goals: number;
  avg_eggs: number;
  avg_food_on_cards: number;
  avg_tucked_cards: number;
  avg_nectar: number;
}

interface RecentScoreRow {
  game_id: number;
  date: string;
  total_score: number;
}
```

---

## Styling Guidelines

### Color Palette
- Primary: `#3B82F6` (Blue)
- Secondary: `#94A3B8` (Slate)
- Success: `#10B981` (Green)
- Warning: `#F59E0B` (Amber)
- Error: `#EF4444` (Red)

### Chart Colors
- Placement 1st: `#F59E0B` (Gold)
- Placement 2nd: `#94A3B8` (Silver)
- Placement 3rd: `#CD7F32` (Bronze)
- Category Bars: `#3B82F6` (Blue)
- Score Gradient: Blue with opacity based on score

### Spacing
- Section spacing: `space-y-6` (1.5rem)
- Card padding: `p-6` (1.5rem)
- Form field spacing: `space-y-4` (1rem)
- Chart height: `h-64` (16rem) on desktop, `h-48` (12rem) on mobile

---

This specification provides complete implementation details for all profile editing and statistics visualization components.
