# Seasons — Product Requirements

status: draft
last-updated: 2026-10-21

91-day seasons for Wingspan Score Tracker. When a season ends, it archives. Users can review every past season. Every player has a career average and a season average.

This is the spec to implement against. Do not add features listed under Out of scope.

---

## 1. Problem

The league page and profile stats treat every game as one endless season. Averages drift toward career numbers. A hot streak, a new expansion, or a long break all wash together.

Players need a clock that resets standings on a fixed cadence, without losing history.

## 2. Goals

1. Start a new season every **91 days**, on a shared app-wide calendar.
2. Archive the season that just ended. Keep every game. Make the archive available for review.
3. Show two averages for every player in a given context (league or profile):
   - **Career average** — mean `total_score` across all of that player's games in that context.
   - **Season average** — mean `total_score` across that player's games in the selected season.
4. Default the league standings, game list, and charts to the **current** season.

## 3. Decisions

These are product calls. Change them here before writing code.

| Topic | Decision | Rejected |
|---|---|---|
| Scope of the clock | **One global calendar.** Every league shares Season 1, Season 2, … | A clock per league. That makes "what season is it?" a per-league question. |
| What "archive" means | **Close the date window.** Games stay in `games`. Stats for a past season are computed from games in that window. | Copy standings into a snapshot table. Extra tables, and later game edits would disagree with the snapshot. |
| How the clock ticks | **Compute on demand.** No cron. First request after a boundary creates the next season row and marks the previous one archived. | A scheduled job. This app is a single SQLite process with no job runner. |
| Season of a game | **`played_at`**, not upload time. Editing the date can move the game to another season. | Freeze `season_id` forever after insert. A corrected date would sit in the wrong season. |
| League table "Avg" | **Season average** for the selected season. Career average sits under the player name on the same row. | A second numeric column. The league grid is already 12 columns. |
| Empty seasons | **Still exist.** A season with zero games is reviewable and shows empty standings. | Skip unused seasons. That would leave holes in the numbering. |

## 4. Open questions

Answer these before implementation. Defaults are listed so work can start if they stay unanswered.

| # | Question | Default if unanswered |
|---|---|---|
| Q1 | Season 1 start date? | UTC midnight of `MIN(games.played_at)` at migration. If there are no games, UTC midnight of the migration day. Freeze that value. Do not recompute it later. |
| Q2 | Time zone for the 91-day boundary? | UTC. Display dates in the user's locale. |
| Q3 | Can admins still edit games in an archived season? | Yes. Existing create/update/delete rules stay. Recompute stats from current rows. |
| Q4 | Do profile charts default to the current season or to the last N games across all seasons? | Current season. Career average remains visible as a number, not as the chart window. |

## 5. Out of scope

- Per-league season clocks
- Season names, themes, or trophies
- Frozen snapshot tables
- Admin UI to create, rename, shorten, or skip a season
- Push/email at rollover
- Resetting league membership when a season starts
- Changing the 91-day length after launch
- Deleting games at rollover

## 6. Users and stories

**League member**

- Opens a league and sees current-season standings, including season average.
- Sees career average next to each player without leaving the table.
- Picks a past season and reviews that season's standings, category averages, and games.
- Adds a game. The game joins the season that contains its play date.

**League admin / superadmin**

- Edits or deletes a past game. If `played_at` moves across a boundary, the game changes season. Standings in both seasons update.

**Any authenticated user on a profile**

- Sees career average and current-season average as two distinct figures.
- Picks a past season to review charts and game history for that window.

## 7. Season clock

### 7.1 Length and bounds

- Length: **91 days**.
- Season `n` (1-based) occupies the half-open interval:

```
start_at(n) = epoch + (n - 1) * 91 days
end_at(n)   = epoch + n * 91 days
season n    = [start_at(n), end_at(n))
```

- A game with `played_at == end_at(n)` belongs to season `n + 1`.
- Store `start_at` and `end_at` as UTC ISO datetimes.

### 7.2 Labels

- Number: `1`, `2`, `3`, …
- Display: `Season {n}` plus the date range, e.g. `Season 3 · Jul 2 – Oct 1, 2026`.
- Status: `active` if `now < end_at`, else `archived`.
- Exactly one season is `active`.

### 7.3 Rollover

On any request that needs season data:

1. Read `epoch` from `app_settings`.
2. Compute which season number `now` falls in.
3. Insert any missing season rows from 1 through that number.
4. Set `status = 'archived'` where `end_at <= now`.
5. Set `status = 'active'` on the current row.

This is a few SQLite writes at a boundary, then no-ops. No background worker.

### 7.4 Assignment

```
season_id(game) = season whose [start_at, end_at) contains game.played_at
```

Set `games.season_id` on insert and on any update that changes `played_at`.

A play date before the epoch is invalid for new games. Existing rows before the epoch (should not happen if epoch is `MIN(played_at)`) clamp into Season 1.

## 8. Data model

Add three things. Do not snapshot scores.

### 8.1 `app_settings`

Single-row config. Use a one-row table so the epoch is data, not a redeploy.

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  season_epoch TEXT NOT NULL,
  season_length_days INTEGER NOT NULL DEFAULT 91
);
```

`season_length_days` is stored so the number is explicit. Do not expose a UI to change it.

### 8.2 `seasons`

```sql
CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER UNIQUE NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);
CREATE INDEX IF NOT EXISTS idx_seasons_range ON seasons(start_at, end_at);
```

### 8.3 `games.season_id`

```sql
ALTER TABLE games ADD COLUMN season_id INTEGER REFERENCES seasons(id);
CREATE INDEX IF NOT EXISTS idx_games_season_id ON games(season_id);
CREATE INDEX IF NOT EXISTS idx_games_league_season ON games(league_id, season_id);
```

Keep `league_id` and `played_at`. Season is a label on a game, not a replacement for the league.

### 8.4 What does not change

- `users`, `leagues`, `league_players`, `scores` stay as they are.
- League membership carries across seasons.
- Foreign keys and existing game CRUD stay.

### 8.5 Migration

Run from `initDatabase()` in the same style as invite codes and profile columns.

1. Create `app_settings` and `seasons` if missing.
2. If `app_settings` is empty, set `season_epoch` from Q1's default.
3. Ensure seasons exist through `now`.
4. `UPDATE games SET season_id = …` from `played_at` for any null `season_id`.
5. After backfill, every game has a `season_id`.

Verify: count of games with `season_id IS NULL` is 0. Every season's game dates fall inside its range.

## 9. Averages

Compute live. Do not store running averages.

**Career average** (league context):

```sql
AVG(s.total_score)
FROM scores s
JOIN games g ON g.id = s.game_id
WHERE s.user_id = ? AND g.league_id = ?
```

**Season average** (league context):

```sql
AVG(s.total_score)
FROM scores s
JOIN games g ON g.id = s.game_id
WHERE s.user_id = ? AND g.league_id = ? AND g.season_id = ?
```

**Career / season average** (profile, all leagues): drop the `league_id` predicate. If the profile is already filtered to a league, keep it.

A player with zero games in the window: average is `null`, render as `—`. Do not render `0.0`.

Wins, losses, placement, and category averages on a season view use the same season filter. Career counterparts stay available where the UI shows them (profile summary and the player-name subtitle on the league table).

## 10. Product surfaces

### 10.1 League page (`/leagues/[id]`)

Default: current season.

Add a season control in the header, to the left of the action buttons:

- Label: `Season 3 · Jul 2 – Oct 1`
- Options: every season, newest first, archived seasons marked `Archived`
- Changing it reloads stats and the game list for that season only

Leaderboard:

- Rank, placement, wins, losses, games, and category columns use the **selected season**
- The existing **Avg** column is the season average
- Under the player name, on the same row: `Career 87.4` in secondary text
- Desktop: keep the row on one line (see wiki `ui_layout.md`, draft)
- Archived banner when the selected season is not active: `Viewing archived Season 2. New games still use the play date.`

Add Game / Upload Screenshot stay available while viewing an archive. The new game's season follows `played_at`, not the selector.

### 10.2 All games (`/leagues/[id]/all-games`)

Same season selector. Paginate inside the selected season. Query param: `?season=3` (season number, stable in URLs).

### 10.3 Compare (`/leagues/[id]/compare`)

Same selector and query param. Charts and the comparison table use the selected season.

### 10.4 Profile (`/profile` and `/profile/[userid]`)

Above the charts, two summary figures:

- **Career avg** — all games in the profile's current league filter (or all leagues if unfiltered)
- **Season avg** — current season, same filter

Season selector next to the chart picker. Charts and the "last N games" windows read from the selected season. Career avg does not change when the selector changes.

### 10.5 Empty states

- Current season, no games yet: `No games this season yet.` Keep Add Game.
- Archived season, no games in this league: `No games in Season {n} for this league.`
- Player in the league with no season games: show the row, averages as `—`.

## 11. API

### 11.1 `GET /api/seasons`

Auth required.

```json
{
  "epoch": "2026-01-15T00:00:00.000Z",
  "lengthDays": 91,
  "currentSeasonId": 4,
  "seasons": [
    {
      "id": 4,
      "number": 4,
      "startAt": "2026-10-13T00:00:00.000Z",
      "endAt": "2027-01-12T00:00:00.000Z",
      "status": "active"
    },
    {
      "id": 3,
      "number": 3,
      "startAt": "2026-07-14T00:00:00.000Z",
      "endAt": "2026-10-13T00:00:00.000Z",
      "status": "archived"
    }
  ]
}
```

Newest first. Triggers rollover.

### 11.2 League stats — `GET /api/leagues/[id]/stats`

New query param: `seasonId` (database id) or `season` (number). Default: current season.

Response adds:

```json
{
  "season": { "id": 4, "number": 4, "status": "active", "startAt": "...", "endAt": "..." },
  "stats": [
    {
      "userId": 1,
      "username": "sevenzig",
      "averageScore": 91.2,
      "careerAverageScore": 87.4,
      "totalGames": 12,
      "careerTotalGames": 48
    }
  ]
}
```

`averageScore` is the season figure. Keep the rest of the current payload; filter those fields to the season.

### 11.3 League games — `GET /api/leagues/[id]/games`

Same `seasonId` / `season` param. Default: current season. Pagination counts games in that season.

### 11.4 Profile stats — `GET /api/profile/stats` and `GET /api/profile/[userid]/stats`

Add `seasonId` / `season`. Default: current season.

Response adds:

```json
{
  "careerAverageScore": 87.4,
  "seasonAverageScore": 91.2,
  "careerTotalGames": 48,
  "seasonTotalGames": 12,
  "season": { "id": 4, "number": 4, "status": "active", "startAt": "...", "endAt": "..." }
}
```

Existing chart arrays (`gameScores`, `placementHistory`, `categoryAverages`, `recentScores`) filter to the selected season.

### 11.5 Compare chart data

Same season param. Default: current season.

### 11.6 Create / update game

No new request fields. Server sets `season_id` from `played_at`. Return `seasonId` on the game payload so the UI can stay on the season the user was viewing, or refresh if the game landed elsewhere.

Reject `played_at` before the epoch with `400` and `Play date is before Season 1`.

## 12. Authorization

Unchanged.

- League members read their leagues, including archived seasons.
- League admin / superadmin edit and delete games in any season of a league they can manage.
- Profile stats: current rules (self, or whatever `[userid]` already allows).

There is no extra "season admin" role.

## 13. Implementation plan

Each step has a check. Do not start the next step until the check passes.

### Phase 1 — Data and clock

1. Settings row, `seasons` table, `games.season_id`, backfill.
   Verify: `season_id IS NULL` count is 0. Seasons cover epoch → now with no gaps and no overlaps.
2. Helper: `ensureSeasons(now)`, `seasonForDate(playedAt)`.
   Verify: unit tests for boundaries (`end_at - 1s` → season n, `end_at` → season n+1), 91-day length, missing-row insert.
3. `GET /api/seasons`.
   Verify: one `active` season; archived seasons have `end_at <= now`.

### Phase 2 — League

4. Filter `/api/leagues/[id]/stats` and `/games` by season; add career fields.
   Verify: a game dated in season 1 never appears in season 2 stats. Career average includes both.
5. Season selector on the league page. Avg column = season. Career avg under the name.
   Verify: switching seasons changes the table and the game list. Desktop row stays one line.
6. All-games page respects `?season=`.
   Verify: pagination totals match the season's game count.

### Phase 3 — Profile and compare

7. Profile summary figures + season-filtered charts.
   Verify: career avg stays put when the selector changes; charts swap.
8. Compare page season filter.
   Verify: two players' series only include games from the selected season.

### Phase 4 — Write path

9. Insert and update set `season_id` from `played_at`.
   Verify: backdated create lands in the matching archive. Date edit across a boundary moves the game. Both seasons' stats change.

Do not ship UI before Phase 1. Phases 2–4 can merge in one PR if the tests from each phase are present.

## 14. Success criteria

The feature is done when all of these are true:

1. A season ends 91 days after it starts, in UTC, without a scheduled job.
2. The next season is active on the first request after that instant.
3. Every game belongs to exactly one season, from `played_at`.
4. League default view is the current season.
5. A member can open every archived season and see that season's standings and games.
6. Each player row (league) and each profile shows career average and season average as two different numbers when the player has games outside the selected season.
7. Existing games survive rollover. Nothing is deleted.
8. Existing auth and game CRUD still pass.

## 15. Test cases

| Case | Expect |
|---|---|
| `played_at` one second before `end_at` | Season n |
| `played_at` equal to `end_at` | Season n+1 |
| First request after boundary | New season row, previous `archived` |
| League stats, current season | Only current-season games |
| Career average after two seasons | Mean of all league games for that user |
| Player with no games this season | `—` for season avg; career avg still shows |
| Backdated POST into an archive | Game appears in that archive's list and stats |
| PUT `played_at` across boundary | Leaves old season, joins new one |
| All-games `?season=1` | Does not list season 2 games |
| Epoch with no games | Season 1 starts at migration UTC midnight |
| Two concurrent requests at rollover | One extra season row, not two (unique `number`) |

## 16. Risks

- **Packed league header.** The season control shares a row with Invite, Compare, Upload, and Add Game. On small screens it wraps under the title; on desktop it must not wrap the leaderboard row.
- **Career vs season confusion.** Label them `Career` and `Season` in the UI. Do not use "total average" on screen. This spec uses "career" because "total" reads as a sum.
- **Backfill epoch.** If Q1's default (earliest game) is far in the past, the current season number may already be > 1. That is correct. Do not force a fake Season 1 that starts today and orphan old games.
- **`ui_layout.md` is draft.** Confirm the one-line desktop row rule before Phase 2, or accept wrapping on the player subtitle.

## 17. Files likely to change

Not a complete list. Touch only what the phase needs.

- `src/lib/utils/db.ts` — schema, backfill
- `src/lib/utils/seasons.ts` — new: clock helpers (keep it small)
- `src/routes/api/seasons/+server.ts` — new
- `src/routes/api/leagues/[id]/stats/+server.ts`
- `src/routes/api/leagues/[id]/games/+server.ts`
- `src/routes/api/leagues/[id]/compare-chart-data/+server.ts`
- `src/routes/api/games/+server.ts`, `src/routes/api/games/[id]/+server.ts`
- `src/routes/api/profile/stats/+server.ts`, `src/routes/api/profile/[userid]/stats/+server.ts`
- `src/lib/stores/league.ts` — stats type
- `src/routes/(protected)/leagues/[id]/+page.svelte`
- `src/routes/(protected)/leagues/[id]/all-games/+page.svelte`
- `src/routes/(protected)/leagues/[id]/compare/+page.svelte`
- `src/routes/(protected)/profile/+page.svelte`
- `src/routes/(protected)/profile/[userid]/+page.svelte`
- `tests/` — season clock and stats filter tests

## 18. Assumptions

1. "User data" in the request means profile stats and per-player league stats, not a new user-level table of cached averages.
2. "Available for user review" means the same league, profile, all-games, and compare screens with a season selector, not a separate archive area.
3. 91 days is exact, not "about a quarter."
4. The existing all-time league view goes away as the default. Career numbers remain, but standings rank by the selected season.
