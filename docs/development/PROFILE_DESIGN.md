# User Profile & Statistics Design Document

## 1. Overview

This document outlines the design for user profile editing tools and player statistics visualizations. The system will allow users to manage their profile information (name, username, platforms) and view comprehensive statistics through interactive bar charts.

## 2. Database Schema Changes

### 2.1 Users Table Extensions

Add new columns to the `users` table:

```sql
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN platforms TEXT; -- JSON array: ["steam", "android", "iphone"]
```

**Schema Details:**
- `display_name`: Optional friendly name (defaults to username if not set)
- `platforms`: JSON array of platform identifiers
  - Valid values: `"steam"`, `"android"`, `"iphone"`
  - Stored as TEXT in SQLite (JSON parsing handled in application layer)
  - Default: `[]` (empty array)

**Migration Script:**
```sql
-- Add profile columns
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN platforms TEXT DEFAULT '[]';

-- Update existing users to have empty platforms array
UPDATE users SET platforms = '[]' WHERE platforms IS NULL;
```

## 3. API Design

### 3.1 Profile Endpoints

#### GET `/api/profile`
Get current user's profile information.

**Request:**
- Headers: Cookie with authentication token

**Response:**
```json
{
  "profile": {
    "id": 1,
    "username": "sevenzig",
    "email": "sevenzig@gmail.com",
    "displayName": "Seven Zig",
    "platforms": ["steam", "android"],
    "createdAt": "2026-01-25T04:21:08.000Z"
  }
}
```

**Status Codes:**
- `200 OK`: Profile retrieved successfully
- `401 Unauthorized`: Not authenticated

#### PUT `/api/profile`
Update current user's profile.

**Request:**
```json
{
  "displayName": "Seven Zig",
  "username": "sevenzig",
  "platforms": ["steam", "android", "iphone"]
}
```

**Validation:**
- `displayName`: Optional, 1-50 characters
- `username`: Required, 1-50 characters, unique (if changed)
- `platforms`: Array of strings, each must be one of: `"steam"`, `"android"`, `"iphone"`

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": 1,
    "username": "sevenzig",
    "email": "sevenzig@gmail.com",
    "displayName": "Seven Zig",
    "platforms": ["steam", "android", "iphone"],
    "createdAt": "2026-01-25T04:21:08.000Z"
  }
}
```

**Status Codes:**
- `200 OK`: Profile updated successfully
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Not authenticated
- `409 Conflict`: Username already taken

### 3.2 Statistics Endpoints

#### GET `/api/profile/stats`
Get comprehensive statistics for the current user.

**Query Parameters:**
- `matches` (optional): Number of recent matches to include (default: 10, max: 50)
- `leagueId` (optional): Filter stats by specific league

**Response:**
```json
{
  "stats": {
    "placementHistory": [
      { "gameId": 123, "date": "2026-01-25", "placement": 1, "totalScore": 95 },
      { "gameId": 122, "date": "2026-01-24", "placement": 2, "totalScore": 87 },
      // ... last X matches
    ],
    "categoryAverages": {
      "matches": 10,
      "birds": 12.5,
      "bonusCards": 8.2,
      "endOfRoundGoals": 6.0,
      "eggs": 15.3,
      "foodOnCards": 9.1,
      "tuckedCards": 4.2,
      "nectar": 2.5
    },
    "recentScores": [
      { "gameId": 123, "date": "2026-01-25", "totalScore": 95 },
      { "gameId": 122, "date": "2026-01-24", "totalScore": 87 },
      // ... last 10 games
    ]
  }
}
```

**Status Codes:**
- `200 OK`: Statistics retrieved successfully
- `401 Unauthorized`: Not authenticated

## 4. Component Design

### 4.1 Profile Page Route

**Location:** `src/routes/(protected)/profile/+page.svelte`

**Structure:**
```
Profile Page
├── Profile Information Section
│   ├── Profile Edit Form
│   │   ├── Display Name Input
│   │   ├── Username Input
│   │   └── Platform Multi-Select
│   └── Save/Cancel Buttons
└── Statistics Section
    ├── Placement History Chart
    ├── Category Averages Chart
    └── Recent Scores Chart
```

### 4.2 ProfileEditForm Component

**Location:** `src/lib/components/profile/ProfileEditForm.svelte`

**Props:**
```typescript
export let profile: {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  platforms: string[];
};
```

**Features:**
- Form validation
- Real-time username availability check (if username changed)
- Platform multi-select with checkboxes
- Save/Cancel actions
- Loading states
- Error handling

**UI Elements:**
- Display Name: Text input (optional)
- Username: Text input (required, unique validation)
- Platforms: Checkbox group
  - ☐ Steam
  - ☐ Android
  - ☐ iPhone

### 4.3 Statistics Chart Components

#### PlacementHistoryChart

**Location:** `src/lib/components/profile/PlacementHistoryChart.svelte`

**Props:**
```typescript
export let placementHistory: Array<{
  gameId: number;
  date: string;
  placement: number;
  totalScore: number;
}>;
```

**Chart Type:** Horizontal Bar Chart
- X-axis: Placement (1, 2, 3, 4, 5)
- Y-axis: Game count
- Color coding:
  - 1st place: Gold (#F59E0B)
  - 2nd place: Silver (#94A3B8)
  - 3rd place: Bronze (#CD7F32)
  - 4th place: Gray (#6B7280)
  - 5th place: Dark Gray (#4B5563)

**Features:**
- Rolling history (last X matches)
- Tooltip showing game date and score
- Responsive design

#### CategoryAveragesChart

**Location:** `src/lib/components/profile/CategoryAveragesChart.svelte`

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
};
```

**Chart Type:** Vertical Bar Chart
- X-axis: Category names
- Y-axis: Average score
- Categories:
  - Birds
  - Bonus Cards
  - End of Round Goals
  - Eggs
  - Food on Cards
  - Tucked Cards
  - Nectar

**Features:**
- Color-coded bars by category
- Tooltip showing exact average value
- Configurable match count (last X matches)

#### RecentScoresChart

**Location:** `src/lib/components/profile/RecentScoresChart.svelte`

**Props:**
```typescript
export let recentScores: Array<{
  gameId: number;
  date: string;
  totalScore: number;
}>;
```

**Chart Type:** Vertical Bar Chart (Line overlay optional)
- X-axis: Game dates (last 10 games)
- Y-axis: Total score
- Bar color: Gradient based on score (higher = darker blue)

**Features:**
- Shows last 10 games
- Date labels on X-axis
- Score values on bars
- Optional trend line overlay

## 5. Implementation Details

### 5.1 Database Queries

#### Get User Profile
```sql
SELECT 
  id,
  username,
  email,
  display_name,
  platforms,
  created_at
FROM users
WHERE id = ?;
```

#### Update User Profile
```sql
UPDATE users
SET 
  display_name = ?,
  username = ?,
  platforms = ?,
  updated_at = CURRENT_TIMESTAMP
WHERE id = ?;
```

#### Get Placement History
```sql
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
LIMIT ?;
```

#### Get Category Averages
```sql
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
LIMIT ?;
```

#### Get Recent Scores
```sql
SELECT 
  g.id as game_id,
  DATE(g.played_at) as date,
  s.total_score
FROM scores s
JOIN games g ON s.game_id = g.id
WHERE s.user_id = ?
  AND (? IS NULL OR g.league_id = ?)
ORDER BY g.played_at DESC
LIMIT 10;
```

### 5.2 Chart.js Configuration

All charts use Chart.js (already in use via `PerformanceChart.svelte`).

**Common Chart Configuration:**
```typescript
{
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top'
    },
    tooltip: {
      backgroundColor: '#1f1f1f',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      borderColor: '#333333',
      borderWidth: 1
    }
  }
}
```

### 5.3 Form Validation

**Display Name:**
- Optional
- 1-50 characters if provided
- Trimmed whitespace

**Username:**
- Required
- 1-50 characters
- Alphanumeric, underscores, hyphens only
- Unique check on server
- Cannot be changed to existing username

**Platforms:**
- Array of strings
- Each platform must be one of: `"steam"`, `"android"`, `"iphone"`
- No duplicates
- Stored as JSON array in database

## 6. User Interface Design

### 6.1 Profile Page Layout

```
┌─────────────────────────────────────────┐
│  Profile Settings                        │
├─────────────────────────────────────────┤
│                                          │
│  Display Name: [________________]       │
│  Username:     [sevenzig_______]        │
│                                          │
│  Platforms:                              │
│    ☑ Steam                               │
│    ☑ Android                             │
│    ☐ iPhone                              │
│                                          │
│  [Cancel]  [Save Changes]                │
│                                          │
├─────────────────────────────────────────┤
│  Player Statistics                       │
├─────────────────────────────────────────┤
│                                          │
│  Placement History (Last 20 matches)     │
│  ┌─────────────────────────────────┐   │
│  │  [Bar Chart]                     │   │
│  └─────────────────────────────────┘   │
│                                          │
│  Category Averages (Last 10 matches)    │
│  ┌─────────────────────────────────┐   │
│  │  [Bar Chart]                     │   │
│  └─────────────────────────────────┘   │
│                                          │
│  Recent Scores (Last 10 games)           │
│  ┌─────────────────────────────────┐   │
│  │  [Bar Chart]                     │   │
│  └─────────────────────────────────┘   │
│                                          │
└─────────────────────────────────────────┘
```

### 6.2 Responsive Design

- **Mobile (< 640px):**
  - Single column layout
  - Stacked form fields
  - Full-width charts
  - Reduced chart height (h-48 instead of h-64)

- **Tablet (640px - 1024px):**
  - Two-column layout for charts
  - Form remains single column

- **Desktop (> 1024px):**
  - Full layout as shown above
  - Charts side-by-side where appropriate

## 7. File Structure

```
src/
├── routes/
│   └── (protected)/
│       └── profile/
│           └── +page.svelte          # Main profile page
├── lib/
│   ├── components/
│   │   └── profile/
│   │       ├── ProfileEditForm.svelte
│   │       ├── PlacementHistoryChart.svelte
│   │       ├── CategoryAveragesChart.svelte
│   │       └── RecentScoresChart.svelte
│   └── utils/
│       └── profile.ts                # Profile utility functions
└── routes/
    └── api/
        └── profile/
            ├── +server.ts            # GET/PUT profile
            └── stats/
                └── +server.ts        # GET statistics
```

## 8. Security Considerations

1. **Authentication:** All endpoints require valid JWT token
2. **Authorization:** Users can only update their own profile
3. **Username Uniqueness:** Server-side validation prevents duplicate usernames
4. **Input Sanitization:** All user inputs validated and sanitized
5. **SQL Injection:** Parameterized queries for all database operations
6. **XSS Prevention:** Svelte's built-in XSS protection for rendered content

## 9. Error Handling

### Client-Side
- Form validation errors displayed inline
- API errors shown in toast notifications
- Loading states during async operations
- Optimistic UI updates where appropriate

### Server-Side
- Validation errors return 400 with error details
- Authentication errors return 401
- Authorization errors return 403
- Not found errors return 404
- Server errors return 500 with generic message

## 10. Testing Considerations

### Unit Tests
- Form validation logic
- Platform array parsing/serialization
- Chart data transformation functions

### Integration Tests
- Profile update flow
- Statistics retrieval
- Username uniqueness validation

### E2E Tests
- Complete profile editing workflow
- Chart rendering with various data sets
- Responsive layout behavior

## 11. Future Enhancements

1. **Profile Picture Upload:** Add avatar/image support
2. **Privacy Settings:** Control visibility of statistics
3. **Export Statistics:** Download stats as CSV/PDF
4. **Comparison Mode:** Compare stats with other players
5. **Achievement System:** Badges for milestones
6. **Custom Date Ranges:** Filter stats by custom date ranges
7. **League-Specific Stats:** Separate stats per league
8. **Trend Analysis:** Show improvement/decline trends over time

---

## Implementation Checklist

### Phase 1: Database & API
- [ ] Add database migration for profile columns
- [ ] Create `/api/profile` GET endpoint
- [ ] Create `/api/profile` PUT endpoint
- [ ] Create `/api/profile/stats` GET endpoint
- [ ] Add validation and error handling

### Phase 2: UI Components
- [ ] Create ProfileEditForm component
- [ ] Create PlacementHistoryChart component
- [ ] Create CategoryAveragesChart component
- [ ] Create RecentScoresChart component
- [ ] Create profile page route

### Phase 3: Integration
- [ ] Integrate components into profile page
- [ ] Add navigation link to profile page
- [ ] Test responsive design
- [ ] Add loading and error states

### Phase 4: Polish
- [ ] Add animations and transitions
- [ ] Optimize chart rendering performance
- [ ] Add accessibility features
- [ ] Write documentation
