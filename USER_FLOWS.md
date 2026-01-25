# User Flow Diagrams

## 1. Authentication Flow

```
┌─────────────┐
│ User visits │
│   app       │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Check auth      │
│ status          │
└──────┬──────────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────────┐
│ Auth │ │ Not Auth     │
└──┬───┘ └──────┬───────┘
   │            │
   │            ▼
   │      ┌─────────────┐
   │      │ /login      │
   │      │   page      │
   │      └──────┬──────┘
   │             │
   │             ▼
   │      ┌─────────────┐
   │      │ User enters │
   │      │ credentials │
   │      └──────┬──────┘
   │             │
   │             ▼
   │      ┌─────────────┐
   │      │ POST /api/  │
   │      │ auth/login  │
   │      └──────┬──────┘
   │             │
   │        ┌────┴────┐
   │        │         │
   │        ▼         ▼
   │   ┌────────┐ ┌──────────┐
   │   │Success │ │  Error   │
   │   └───┬────┘ └────┬─────┘
   │       │          │
   │       │          ▼
   │       │    ┌─────────────┐
   │       │    │ Show error  │
   │       │    │ message     │
   │       │    └─────────────┘
   │       │
   │       ▼
   └───────┼──────────┐
           │          │
           ▼          ▼
      ┌─────────┐ ┌──────────┐
      │ Set     │ │ Redirect │
      │ token   │ │ to       │
      │ cookie  │ │ /leagues │
      └─────────┘ └──────────┘
```

## 2. League Selection Flow

```
┌─────────────┐
│ User on      │
│ /leagues     │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ GET /api/   │
│ leagues     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Display     │
│ league list │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────────┐
│Click │ │ Click        │
│league│ │ "Create New" │
└───┬──┘ └──────┬───────┘
    │           │
    │           ▼
    │      ┌─────────────┐
    │      │ Open Create │
    │      │ League Modal │
    │      └──────┬───────┘
    │             │
    │             ▼
    │      ┌─────────────┐
    │      │ Enter league │
    │      │ name & select│
    │      │ 3 players    │
    │      └──────┬───────┘
    │             │
    │             ▼
    │      ┌─────────────┐
    │      │ POST /api/   │
    │      │ leagues      │
    │      └──────┬───────┘
    │             │
    │        ┌────┴────┐
    │        │         │
    │        ▼         ▼
    │   ┌────────┐ ┌──────────┐
    │   │Success │ │  Error   │
    │   └───┬────┘ └────┬─────┘
    │       │          │
    │       │          ▼
    │       │    ┌─────────────┐
    │       │    │ Show error  │
    │       │    └─────────────┘
    │       │
    │       ▼
    │   ┌─────────────┐
    │   │ Close modal │
    │   │ Refresh     │
    │   │ league list │
    │   └─────────────┘
    │
    ▼
┌─────────────┐
│ Navigate to │
│ /leagues/   │
│ [id]        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ GET /api/   │
│ leagues/[id]│
│ /stats      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Display     │
│ scoreboard  │
└─────────────┘
```

## 3. Add Game Flow

```
┌─────────────┐
│ User on     │
│ league      │
│ scoreboard  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Click "Add  │
│ Game" button│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Open Add    │
│ Game Modal  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Form fields:│
│ - Date      │
│ - Player 1: │
│   Placement │
│   Score     │
│   Breakdown │
│ - Player 2: │
│   ...       │
│ - Player 3: │
│   ...       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ User fills  │
│ in data     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Click       │
│ "Submit"    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Client-side │
│ validation  │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────────┐
│Valid │ │ Invalid      │
└───┬──┘ └──────┬───────┘
    │           │
    │           ▼
    │      ┌─────────────┐
    │      │ Show        │
    │      │ validation  │
    │      │ errors      │
    │      └─────────────┘
    │
    ▼
┌─────────────┐
│ POST /api/  │
│ games       │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────────┐
│Success│ │ Error        │
└───┬───┘ └──────┬───────┘
    │            │
    │            ▼
    │      ┌─────────────┐
    │      │ Show error  │
    │      │ message     │
    │      └─────────────┘
    │
    ▼
┌─────────────┐
│ Close modal │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Refresh     │
│ scoreboard  │
│ data        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ GET /api/   │
│ leagues/[id]│
│ /stats      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Update UI   │
│ with new    │
│ stats       │
└─────────────┘
```

## 4. View Statistics Flow

```
┌─────────────┐
│ User selects │
│ league       │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ Load league │
│ data        │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ GET /api/   │
│ leagues/[id]│
│ /stats      │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ Calculate   │
│ statistics  │
│ (server)    │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ Return stats│
│ data        │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ Display:    │
│ 1. Stats    │
│    Table    │
│ 2. Scoring  │
│    Breakdown│
│ 3. Perf.    │
│    Chart    │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────────┐
│View  │ │ Click on     │
│table │ │ game in      │
│      │ │ history      │
└──────┘ └──────┬───────┘
                │
                ▼
         ┌─────────────┐
         │ GET /api/    │
         │ games/[id]   │
         └──────┬───────┘
                │
                ▼
         ┌─────────────┐
         │ Show game   │
         │ details     │
         │ modal       │
         └─────────────┘
```

## 5. Registration Flow

```
┌─────────────┐
│ User clicks  │
│ "Register"   │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ Navigate to │
│ /register   │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ Display     │
│ Register    │
│ Form        │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ User enters:│
│ - Username  │
│ - Email     │
│ - Password  │
│ - Confirm   │
│   Password  │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ Client      │
│ validation  │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────────┐
│Valid │ │ Invalid      │
└───┬──┘ └──────┬───────┘
    │           │
    │           ▼
    │      ┌─────────────┐
    │      │ Show errors │
    │      └─────────────┘
    │
    ▼
┌─────────────┐
│ POST /api/  │
│ auth/       │
│ register    │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────────┐
│Success│ │ Error        │
└───┬───┘ └──────┬───────┘
    │            │
    │            ▼
    │      ┌─────────────┐
    │      │ Show error  │
    │      │ (username/  │
    │      │ email taken)│
    │      └─────────────┘
    │
    ▼
┌─────────────┐
│ Auto-login  │
│ user        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Redirect to │
│ /leagues    │
└─────────────┘
```

## 6. Navigation Flow

```
┌─────────────┐
│ App Layout  │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────────┐
│Navbar│ │ Main Content│
└───┬──┘ └──────┬───────┘
    │           │
    │      ┌────┴────┐
    │      │         │
    │      ▼         ▼
    │ ┌────────┐ ┌──────────┐
    │ │Leagues │ │Scoreboard│
    │ │List    │ │View      │
    │ └────────┘ └──────────┘
    │
    ▼
┌─────────────┐
│ User Menu   │
│ Dropdown    │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────────┐
│View  │ │ Logout       │
│Profile│ │              │
└──────┘ └──────┬───────┘
                │
                ▼
         ┌─────────────┐
         │ POST /api/   │
         │ auth/logout  │
         └──────┬───────┘
                │
                ▼
         ┌─────────────┐
         │ Clear token │
         │ Redirect to │
         │ /login      │
         └─────────────┘
```

## State Transitions

### Authentication States
```
unauthenticated → logging_in → authenticated
authenticated → logging_out → unauthenticated
```

### League States
```
no_league_selected → loading_league → league_loaded
league_loaded → adding_game → game_added → league_loaded
league_loaded → creating_league → league_created → league_loaded
```

### UI States
```
idle → loading → success | error
```

---

These user flow diagrams illustrate the complete navigation and interaction patterns for the Wingspan Score Tracker application.
