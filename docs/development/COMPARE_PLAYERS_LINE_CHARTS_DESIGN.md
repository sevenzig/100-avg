# Compare Players – Line Charts Design

## 1. Overview

This document specifies the design for **line graphs on the league “Compare players” route** that mirror the profile page charts but show **multiple comparison players** (current user + selected players) on the same chart. Each line represents one player’s data over a shared axis (e.g. league games over time or category averages).

**Related:**

- [Scoring Comparison Highlight Design](./SCORING_COMPARISON_HIGHLIGHT_DESIGN.md) – same compare page, table highlight behavior.
- Profile charts: `src/lib/components/profile/ScoringChart.svelte`, `RecentScoresChart.svelte`, `PlacementHistoryChart.svelte`, `CategoryAveragesChart.svelte`.
- Compare page: `src/routes/(protected)/leagues/[id]/compare/+page.svelte`.
- APIs: `GET /api/leagues/[id]/stats`, `GET /api/leagues/[id]/games`, `GET /api/profile/stats` (supports `leagueId`).

### 1.1 Requirements Summary

| Requirement | Description |
|-------------|-------------|
| **Same chart types as profile** | Use the same conceptual chart types as user profile: score over time, placement history, category averages. |
| **Multiple players per chart** | Each chart includes the current user and all selected comparison players (one line per player). |
| **League-scoped data** | All chart data is limited to games in the current league. |
| **Shared x-axis** | Where applicable (e.g. score over time), all players share one timeline so lines are comparable. |
| **Consistent colors** | Use the same player colors as the compare table (e.g. `getPlayerColor(stat.color)`). |

### 1.2 Out of Scope

- Changing profile page charts or their data contracts.
- Charts for leagues the user is not a member of (existing auth applies).
- Export or print styling for comparison charts.

---

## 2. Chart Types to Support

### 2.1 Score Over Time (Primary)

**Profile equivalent:** `RecentScoresChart` (total score over last N games).

**Comparison behavior:**

- **X-axis:** League games in chronological order (oldest → newest), labeled by date (e.g. “Jan 5”, “Jan 12”) or “Game 1”, “Game 2”, …
- **Y-axis:** Total score.
- **Lines:** One line per comparison player. Each point = that player’s total score in that league game. If a player did not participate in a game, the point is omitted or `null` (Chart.js `spanGaps` or segment skip).
- **Data need:** For each league game (ordered by date ASC), each comparison player’s `total_score` in that game (or null if not in game).

This is the main “like profile but multi-player” line chart.

### 2.2 Category Averages (Secondary)

**Profile equivalent:** `CategoryAveragesChart` (one line, x = categories, y = average).

**Comparison behavior:**

- **X-axis:** Category names (Birds, Bonus Cards, End Goals, Eggs, Food, Tucked, Nectar).
- **Y-axis:** Average value for that category.
- **Lines:** One line per comparison player. Each point = that player’s league average for that category (from existing league stats `avgBreakdown`).
- **Data need:** No new API. Use existing `comparisonPlayers` and `stat.avgBreakdown` from league stats already loaded on the compare page.

Easiest to add: same data as the comparison table, different visualization.

### 2.3 Optional: Scoring Breakdown Over Time

**Profile equivalent:** `ScoringChart` (multiple series: Birds, Bonus, Eggs, … + Total over games).

**Comparison behavior (optional / later):**

- Either one chart per category with one line per player (e.g. “Birds over time” with N lines).
- Or keep a single “Total score over time” chart and defer full breakdown-over-time to a later iteration.

Recommendation: implement **Score Over Time** and **Category Averages** first; add scoring breakdown over time later if needed.

### 2.4 Placement History

**Profile equivalent:** `PlacementHistoryChart` (x = 1st/2nd/3rd/4th/5th, y = count of games).

**Comparison behavior:** One line per player; x = placement bucket, y = count of games in that placement (in this league). Data can be derived from league games + scores (count placements per user) or from a small extension of league stats. Lower priority than score-over-time and category averages; can be added in a follow-up.

---

## 3. Data and API

### 3.1 Score Over Time – New League Chart API

**Endpoint:** `GET /api/leagues/[id]/compare-chart-data`

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `userIds` | string (required) | Comma-separated user IDs (e.g. `1,2,3`). Each must be a member of the league. Max count should match compare page (e.g. 6: current user + 5 others). |
| `limit` | string (optional) | Max number of games to return; parsed as integer. Default `30`, max `50`. Invalid values fall back to default. |

**Auth:** Caller must be authenticated and a member of the league (reuse same check as league games/stats). Return **403** if not a member.

**Validation:**

- If `userIds` is missing or empty: return **400** with message e.g. `"userIds is required"`.
- If any parsed ID is not a number or not a league member: return **400** with message e.g. `"All userIds must be league members"`.
- Invalid `leagueId` (NaN or non-existent): return **404**.

**Response (200):**

```ts
{
  games: Array<{
    gameId: number;
    date: string;       // DATE(played_at)
    gameNumber: number; // 1-based order (oldest = 1)
  }>;
  series: Array<{
    userId: number;
    username: string;
    color: string;      // e.g. "player_1"
    scores: Array<number | null>; // aligned to games[]; null if user not in game
  }>;
}
```

- `games` is ordered by `played_at` **ASC** (oldest first) so the chart reads left-to-right as time.
- `series[i].scores[j]` is player `i`’s total score in `games[j]`, or `null` if they did not play in that game. Length of `scores` equals length of `games`.
- If a user is not in the league or not in `userIds`, they are not included in `series`. Order of `series` should match the order of `userIds` for predictable legend order.

**Error responses:**

| Status | When |
|--------|------|
| 400 | Missing or empty `userIds`; or any userId not a league member. |
| 401 | Not authenticated. |
| 403 | Authenticated but not a member of the league. |
| 404 | Invalid or non-existent league ID. |
| 500 | Server/database error. |

**Implementation sketch (server):**

1. Resolve league id and validate membership.
2. Parse `userIds`; validate each user is in the league (e.g. via `league_players`).
3. Query games: `SELECT id, played_at FROM games WHERE league_id = ? ORDER BY played_at ASC LIMIT ?`.
4. For each game, query scores for requested user IDs: `SELECT user_id, total_score FROM scores WHERE game_id IN (...) AND user_id IN (...)` (batch or per-game).
5. Build `games` (with `date`, `gameNumber`) and `series` (one entry per userId with `scores` array aligned to games; null where no score). Use `league_players.player_color` for each user when building `series` (fallback e.g. `'player_1'` if missing).

**Data alignment (diagram):**

```
games:    [ { gameId: 1, date: "2025-01-05", gameNumber: 1 }, { gameId: 2, date: "2025-01-12", gameNumber: 2 }, ... ]
series[0]:  scores: [ 85, null, 92, ... ]   ← player A: played game 1 and 3, missed game 2
series[1]:  scores: [ 90, 88, 91, ... ]     ← player B: played all
```

### 3.2 Category Averages – No New API

Use existing compare page data:

- `comparisonPlayers` (from league stats) already has `avgBreakdown` and `color`.
- Build datasets: for each player, one dataset with `data: [birds, bonusCards, endOfRoundGoals, eggs, foodOnCards, tuckedCards, nectar]`, `label: username`, `borderColor: getPlayerColor(stat.color)`.

### 3.3 Placement History (Optional / Later)

Either:

- Extend league stats response to include per-user placement counts (e.g. `placementCounts: { 1: n1, 2: n2, … }`), or
- Dedicated query in compare-chart-data or league stats: for each userId, count games by placement in this league.

---

## 4. UI and Components

### 4.1 Placement on Compare Page

- Add a **charts section** below the existing comparison table (or in a collapsible/tabbed block).
- When `comparisonPlayers.length >= 1`:
  - Show at least **Score over time** (league) and **Category averages** (multi-player).
- When no players selected (and no “me”): show empty state or hide charts.

### 4.2 Chart Selector (Profile-like)

- Reuse the profile pattern: dropdown or tabs to switch between chart types (e.g. “Score over time”, “Category averages”, and later “Placement history”).
- Default selection: e.g. “Score over time”.

### 4.3 New Components (Recommended)

| Component | Purpose | Data |
|-----------|--------|------|
| `ComparisonScoreOverTimeChart.svelte` | Multi-player score over league games | From `GET /api/leagues/[id]/compare-chart-data` |
| `ComparisonCategoryAveragesChart.svelte` | Multi-player category averages | From `comparisonPlayers` + `avgBreakdown` |

- Both use **Chart.js** (same as profile charts): `LineController`, `LineElement`, `PointElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Legend`.
- **Legend:** Show one line per player (label = username or “You” for current user); colors from `getPlayerColor(stat.color)`.
- **Tooltip:** Same style as profile (e.g. dark background, white text); show value and player label.

Keeping profile chart components single-player avoids branching and keeps comparison logic in dedicated components.

### 4.4 Score Over Time – Chart Details

- **Labels:** `games.map(g => formatDate(g.date))` or `Game ${g.gameNumber}`.
- **Datasets:** One per `series` entry:
  - `label`: `username` or “You” when `userId === currentUserId`.
  - `data`: `series[i].scores` (may contain `null`; set `spanGaps: true` or false per product preference).
  - `borderColor`: from `getPlayerColor(series[i].color)`.
  - `pointRadius` / `tension`: match profile line charts (e.g. 3–4, 0.4).
- **Scales:** x = category (dates or game numbers), y = linear, `beginAtZero: true`.
- **spanGaps:** Set `spanGaps: true` on line datasets so missing points (null) do not break the line segment; or `false` to show a visible gap. Recommendation: `true` for a cleaner look when a player missed a game.

### 4.5 Category Averages – Chart Details

- **Labels:** `['Birds', 'Bonus Cards', 'End Goals', 'Eggs', 'Food', 'Tucked', 'Nectar']` (match `CategoryAveragesChart`).
- **Datasets:** One per comparison player:
  - `label`: username or “You”.
  - `data`: `[avgBreakdown.birds, avgBreakdown.bonusCards, …]`.
  - `borderColor`: `getPlayerColor(stat.color)`.
- Same scales and tooltip/legend behavior as profile.

### 4.6 Accessibility

- **Chart labels:** Ensure x/y axis labels and legend are readable; use sufficient contrast (match profile chart styles).
- **Screen readers:** Chart.js canvas is not natively announced; consider a brief visually hidden summary (e.g. “Score over time: N players, M games”) or rely on the surrounding heading and legend. Optional: expose a small “Data table” link that shows the same data in a table for accessibility.
- **Color:** Do not rely on color alone to distinguish players; legend labels (username / “You”) provide the distinction.

### 4.7 Shared Color Helper

Use the same `getPlayerColor(color: string)` as the compare table (defined on the compare page or extracted to a shared util). Map `stat.color` / `series[i].color` (e.g. `'player_1'`, `'player_2'`) to hex for Chart.js `borderColor` and `backgroundColor`.

---

## 5. Data Flow (Compare Page)

1. **Existing:** Page loads league and league stats; user selects comparison players; `comparisonPlayers` = [me, …selected].
2. **Score over time:** When comparison players exist, call `GET /api/leagues/[id]/compare-chart-data?userIds=${ids}&limit=30`. Pass response into `ComparisonScoreOverTimeChart`.
3. **Category averages:** Pass `comparisonPlayers` (and `currentUserId` for “You” label) into `ComparisonCategoryAveragesChart`; no extra request.
4. **Loading / empty:** Show spinner while chart data is loading; if no games in league or no data, show “No data” message in chart area.

---

## 6. File and Implementation Summary

| Area | File | Change |
|------|------|--------|
| API | `src/routes/api/leagues/[id]/compare-chart-data/+server.ts` | **New.** GET with `userIds`, `limit`; return `games` + `series`. |
| Component | `src/lib/components/compare/ComparisonScoreOverTimeChart.svelte` | **New.** Line chart, multi-player, league score over time. |
| Component | `src/lib/components/compare/ComparisonCategoryAveragesChart.svelte` | **New.** Line chart, multi-player, category averages from league stats. |
| Page | `src/routes/(protected)/leagues/[id]/compare/+page.svelte` | Add chart section; fetch compare-chart-data when `comparisonPlayers` set; render chart selector and the two charts. |

Optional later:

- `ComparisonPlacementHistoryChart.svelte` + data from league stats or compare-chart-data.
- Breakdown-over-time (e.g. Birds over time per player) if product requests it.

---

## 7. Implementation Order

1. **API:** Implement `GET /api/leagues/[id]/compare-chart-data` (validate league membership and requested userIds; return games ASC + series).
2. **ComparisonScoreOverTimeChart:** Implement component; consume new API; use shared player colors and “You” label.
3. **ComparisonCategoryAveragesChart:** Implement from `comparisonPlayers` and `avgBreakdown`; same colors and “You” label.
4. **Compare page:** Add charts section, chart type selector, and wire up both charts; load chart data when `comparisonPlayers` changes (and optionally when league loads).

**Implementation notes:**

- Reuse Chart.js options from profile charts (`RecentScoresChart.svelte`, `CategoryAveragesChart.svelte`) for `responsive`, `maintainAspectRatio`, `scales`, and tooltip/legend styling so comparison charts look consistent with profile.
- Use `onMount` / `onDestroy` (or Svelte `$effect` if migrating to runes) to create/destroy Chart instance when data or selected chart type changes; destroy previous instance before creating a new one to avoid leaks.

---

## 8. Edge Cases

| Case | Behavior |
|------|----------|
| 0 or 1 comparison player | Show charts (one line) so user still sees their own trend; or hide “Score over time” until at least 2 players. **Recommendation:** show charts with one line when only one player (consistent with profile). |
| Player not in a game | Score over time: `null` for that game; use `spanGaps: true` so the line continues across the gap. |
| No games in league | Return empty `games` and `series`; chart shows “No data” or empty state. |
| League member only has 1 game | Chart shows one point per player; still valid (single point per line). |
| API returns 400 (invalid userIds) | Compare page should not send invalid IDs (IDs come from league stats); if it happens, show error message and do not render chart. |

---

## 9. Validation and Acceptance

| Criterion | Pass |
|-----------|------|
| Score-over-time chart shows one line per comparison player over league games (ASC). | ✓ |
| Category-averages chart uses existing league stats; no new API. | ✓ |
| New API validates league membership and userIds; returns 400/401/403/404 as specified. | ✓ |
| Colors and “You” label match compare table; legend and tooltip are clear. | ✓ |
| Empty / no-data states are handled (spinner, “No data” message). | ✓ |
| Optional: accessibility (labels, legend, optional data table). | ✓ |

---

## 10. Error Messages

| Context | Message (example) |
|--------|-------------------|
| API 400 – missing userIds | `"userIds is required"` |
| API 400 – invalid userIds | `"All userIds must be league members"` |
| API 403 | `"You are not a member of this league"` |
| API 404 | `"League not found"` |
| Compare page – chart load failed | `"Failed to load chart data"` or show inline error in chart area. |
| Chart empty state | `"No data available"` or `"Select players above to compare over time."` |

---

## 11. Dependencies

- **Chart.js** (already used by profile charts): `LineController`, `LineElement`, `PointElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Legend`. No new packages.
- **League stats** and **LeagueStats** type from `$lib/stores/league` and league stats API; compare page already loads this.
- **Auth:** Same as league games/stats (cookie/token; league membership check).

---

## 12. Summary

- **Score over time:** New league endpoint returns games (ASC) and per-user score arrays; new line chart component with one line per comparison player, shared x-axis (league games), same styling and colors as compare table.
- **Category averages:** Use existing league stats on the compare page; new line chart component with one line per player over category labels; no new API.
- **Placement history / breakdown over time:** Optional follow-ups; design above leaves room for both.

This yields profile-style line graphs on the player comparison route with the chosen comparison players included in each chart.

---

## 13. Glossary

| Term | Meaning |
|------|---------|
| **Comparison players** | The set of players currently shown on the compare page: current user (if in league) plus up to N selected others from league stats. |
| **League-scoped** | Data filtered to games where `games.league_id` equals the current league. |
| **Series** | One line per player in the chart; each series has a `scores` array aligned to the shared `games` array. |
| **spanGaps** | Chart.js option: when `data` contains `null`, whether to draw a line segment across the gap (`true`) or leave a visible gap (`false`). |
