# Past Games CRUD – System & Component Design

## 1. Overview

This document specifies the design for **CRUD operations on past league games**, restricted to:

- **Superadmins**: full CRUD on past games in **all leagues**.
- **League admins**: full CRUD on past games in **leagues they administer** (i.e., leagues they created).

All other users retain read-only access to games in leagues they belong to (no create/update/delete of past games via this feature).

### 1.1 Requirements Summary

| Requirement | Description |
|-------------|-------------|
| **Create** | Already supported: any league member (or global admin) can add games. No change. |
| **Read** | Already supported: league members can view games. No change. |
| **Update** | New: superadmin or league admin can update a past game (date, scores, breakdown). |
| **Delete** | New: superadmin or league admin can delete a past game (and its scores). |
| **Scoping** | Superadmin: any league. League admin: only leagues where `leagues.created_by = userId`. |

### 1.2 Out of Scope

- Changing who can **create** new games (unchanged).
- A separate “league admins” table; league admin = league creator (`leagues.created_by`).
- Audit log or soft-delete (can be added later).

---

## 2. Authorization Model

### 2.1 Roles

| Role | Definition | Source |
|------|------------|--------|
| **Superadmin** | Global app admin | `users.is_super_admin = 1` (to be added if not present) |
| **League admin** | Creator/owner of a league | `leagues.created_by = userId` |
| **League member** | In `league_players` for that league | Read-only for games; no edit/delete |

### 2.2 Permission Matrix

| Action | League member | League admin (that league) | Superadmin |
|--------|----------------|----------------------------|------------|
| List/read games in league | ✅ | ✅ | ✅ |
| Read single game | ✅ | ✅ | ✅ |
| Create game in league | ✅ (existing) | ✅ | ✅ |
| **Update past game** | ❌ | ✅ | ✅ |
| **Delete past game** | ❌ | ✅ | ✅ |

### 2.3 Authorization Helpers

Centralize checks in `src/lib/utils/auth.ts`:

```ts
// Superadmin: full access to all leagues (requires users.is_super_admin column)
export function isSuperAdmin(userId: number, db: any): boolean {
  const user = db
    .prepare('SELECT is_super_admin FROM users WHERE id = ?')
    .get(userId) as { is_super_admin: number | null } | undefined;
  return user?.is_super_admin === 1;
}

// League admin: user created this league
export function isLeagueAdmin(userId: number, leagueId: number, db: any): boolean {
  const league = db
    .prepare('SELECT created_by FROM leagues WHERE id = ?')
    .get(leagueId) as { created_by: number } | undefined;
  return league?.created_by === userId;
}

// Can perform update/delete on games in this league
export function canManageLeagueGames(userId: number, leagueId: number, db: any): boolean {
  return isSuperAdmin(userId, db) || isLeagueAdmin(userId, leagueId, db);
}
```

- Use `canManageLeagueGames(userId, leagueId, db)` for **PUT** and **DELETE** on a game (after resolving `game.league_id`).
- **Backward compatibility**: If `is_super_admin` column does not exist, `isSuperAdmin` can fall back to `isAdmin(userId, db)` until migration is applied, or we add a one-time migration (see §4).

---

## 3. API Specification

### 3.1 Existing Endpoints (unchanged behavior)

- **GET /api/leagues/[id]/games** – List games (league member or admin).
- **GET /api/games/[id]** – Get one game (league member or admin).
- **POST /api/games** – Create game (league member or admin; existing rules).

### 3.2 New/Updated Endpoints

#### PUT /api/games/[id] – Update a past game

**Authorization**: Caller must be authenticated and `canManageLeagueGames(userId, game.league_id, db)`.

**Request**

- Path: `id` – game ID.
- Body (JSON): same shape as create; all fields optional for partial update, or require full scores for replace semantics (recommended: full replace for simplicity).

```json
{
  "playedAt": "2024-02-01T19:00:00Z",
  "scores": [
    {
      "userId": 1,
      "placement": 1,
      "totalScore": 95,
      "birds": 48,
      "bonusCards": 15,
      "endOfRoundGoals": 10,
      "eggs": 8,
      "foodOnCards": 5,
      "tuckedCards": 4,
      "nectar": 5
    }
  ]
}
```

**Validation**

- `playedAt`: valid ISO date/time.
- `scores`: array, 1–5 entries; each with `userId`, `placement` (1–5), `totalScore`, and same breakdown fields as POST (defaults 0).
- All `userId` in scores must exist and, for consistency, should be league players (optional strict check).

**Response**

- **200 OK**: `{ "success": true, "game": { ... } }` – same game shape as GET /api/games/[id].
- **400** – Invalid body or validation error.
- **401** – Not authenticated.
- **403** – Not superadmin and not league admin for this game’s league.
- **404** – Game not found.

**Implementation note**: Resolve game by id, get `league_id`, then enforce `canManageLeagueGames`. Update `games.played_at` and replace all rows in `scores` for that `game_id` (delete existing, insert new) in a transaction.

---

#### DELETE /api/games/[id] – Delete a past game

**Authorization**: Same as PUT – `canManageLeagueGames(userId, game.league_id, db)`.

**Request**

- Path: `id` – game ID.
- No body required.

**Response**

- **200 OK**: `{ "success": true }`.
- **401** – Not authenticated.
- **403** – Not superadmin and not league admin for this game’s league.
- **404** – Game not found.

**Implementation note**: Resolve game, check `canManageLeagueGames`, then delete scores for that game and then the game row (or rely on FK CASCADE if configured).

---

## 4. Data Model & Migration

### 4.1 Existing Schema (no change for games/scores)

- **games**: `id`, `league_id`, `played_at`, `created_by`.
- **scores**: `id`, `game_id`, `user_id`, `placement`, `total_score`, breakdown columns, `created_at`.

### 4.2 Optional: Superadmin column

If the app does not yet have a distinct superadmin role:

```sql
-- Add superadmin flag (if not present)
ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0;
```

- **0** = not superadmin, **1** = superadmin.
- Existing `is_admin` can remain for backward compatibility; admin endpoints can be updated to use `isSuperAdmin` where “superadmin” is intended.

---

## 5. Component & UI Design

### 5.1 Where to show Edit/Delete

- **Primary**: League “All Games” page – `src/routes/(protected)/leagues/[id]/all-games/+page.svelte`.
- **Optional**: League detail page (`/leagues/[id]`) if it lists recent games with actions.

Edit/Delete controls must be visible only when the current user can manage that league’s games:

- **Superadmin**: `$user.isSuperAdmin === true`.
- **League admin**: `$user.id === $currentLeague.createdBy`.

So: show Edit/Delete when `$user.isSuperAdmin || $user.id === $currentLeague?.createdBy`.

### 5.2 Data needed on the client

- **GET /api/leagues/[id]** already returns `league.createdBy`.
- **GET /api/auth/me** must expose `isSuperAdmin` (and optionally `isAdmin`) so the client can show/hide actions without extra round-trips.

### 5.3 Edit flow

1. User clicks **Edit** on a game row (e.g. on All Games page).
2. Open a **modal** (or navigate to a dedicated edit page) that:
   - Loads game details via **GET /api/games/[id]** (already available).
   - Shows editable fields: date/time, and per-player scores (placement, total, breakdown).
3. On save:
   - Call **PUT /api/games/[id]** with the same payload shape as create (full scores array).
   - On success: close modal, refresh game list (and optionally update local cache).
4. Reuse existing score-input patterns from the “add game” flow where possible (same breakdown fields and validation).

### 5.4 Delete flow

1. User clicks **Delete** on a game row.
2. Show confirmation: e.g. “Delete this game? This cannot be undone.”
3. On confirm: **DELETE /api/games/[id]**; on success refresh the list and remove the row from the UI.

### 5.5 Accessibility & UX

- Buttons: “Edit” and “Delete” with clear labels (and optional icons).
- Delete: destructive styling and confirmation to avoid accidental removal.
- After update/delete: brief success feedback (toast or inline message) and refreshed list.

---

## 6. File & Route Summary

| Area | File / Route | Change |
|------|----------------|--------|
| Auth | `src/lib/utils/auth.ts` | Add `isSuperAdmin`, `isLeagueAdmin`, `canManageLeagueGames`; ensure DB has `is_super_admin` or fallback. |
| API – games | `src/routes/api/games/[id]/+server.ts` | Add **PUT** and **DELETE** handlers; use `canManageLeagueGames` for both. |
| API – me | `src/routes/api/auth/me/+server.ts` | Return `isSuperAdmin` (and keep `isAdmin` if used elsewhere). |
| UI – All Games | `src/routes/(protected)/leagues/[id]/all-games/+page.svelte` | Show Edit/Delete when user is superadmin or league admin; wire to edit modal and delete + confirm. |
| UI – Edit game | New modal or `src/lib/components/` | Edit form reusing score breakdown fields; submit via PUT /api/games/[id]. |
| Optional | `scripts/` or migration | Add `is_super_admin` to `users` if not present. |

---

## 7. Validation & Error Handling

- **401**: Missing or invalid JWT → “Please log in again.”
- **403**: Authenticated but not allowed → “You don’t have permission to edit or delete games in this league.”
- **404**: Invalid game id or deleted → “Game not found.”
- **400**: Invalid body (bad date, wrong score count, invalid breakdown) → return specific validation message in response body.

Use consistent JSON error shape, e.g. `{ "error": "string" }` or `{ "success": false, "error": "string" }`.

---

## 8. Security Checklist

- [ ] PUT/DELETE require authentication.
- [ ] PUT/DELETE enforce `canManageLeagueGames(userId, game.league_id, db)` after loading the game.
- [ ] No reliance on client-only checks; server always verifies league_id from DB.
- [ ] Update uses transaction (update game + replace scores) so no partial writes.
- [ ] Input validation: placement 1–5, totals and breakdown non-negative, user IDs exist.

---

## 9. Diagram (Authorization Flow)

```
                    ┌─────────────────┐
                    │  Request        │
                    │  PUT/DELETE     │
                    │  /api/games/:id │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Auth JWT       │
                    │  → userId       │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │  Load game by id            │
              │  → league_id                │
              └──────────────┬──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ canManageLeague │
                    │ Games(userId,   │
                    │ league_id, db) │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │  Yes: isSuperAdmin OR       │
              │       isLeagueAdmin        │
              └──────────────┬──────────────┘
                             │
                    ┌────────┴────────┐
                    │                │
                    ▼                ▼
              ┌──────────┐    ┌──────────┐
              │  Allow   │    │  403     │
              │  (200)   │    │  Forbid  │
              └──────────┘    └──────────┘
```

This design gives superadmins and league admins full CRUD on past games while keeping the existing read/create behavior for league members and a clear, maintainable authorization model.
