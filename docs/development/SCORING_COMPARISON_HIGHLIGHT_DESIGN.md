# Scoring Comparison – Highlight Best per Row

## 1. Overview

This document specifies the design for **highlighting the player(s) with the best value in each row** on the league “Compare players” page. Each row is a metric (e.g. Avg score, Birds, Eggs); among the compared players, the one(s) with the best value for that metric are visually highlighted.

**Related:** League stats API (`/api/leagues/[id]/stats`), `LeagueStats` type, compare page at `/leagues/[id]/compare`.

### 1.1 Requirements Summary

| Requirement | Description |
|-------------|-------------|
| **Per-row best** | For each metric row, identify which of the compared players have the “best” value for that metric. |
| **Highlight** | Visually highlight the cell(s) for the best value(s) so users can quickly see who leads in each category. |
| **Ties** | If two or more players tie for the best value in a row, all of them are highlighted. |
| **Metric semantics** | “Best” = highest numeric value for most metrics; “Best” = lowest value for Avg place (lower is better). |

### 1.2 Out of Scope

- Changing which metrics are shown or their order.
- Tooltips or secondary breakdowns within the comparison table.
- Export or print styling for the highlight.

---

## 2. Semantics: “Best” per Metric

### 2.1 Metrics and Direction

| Metric key | Label | “Best” = |
|------------|--------|----------|
| `avgPlacement` | Avg place | **Lowest** value (1st is best) |
| `averageScore` | Avg score | **Highest** value |
| `birds` | Birds | **Highest** |
| `bonusCards` | Bonus | **Highest** |
| `endOfRoundGoals` | Goals | **Highest** |
| `eggs` | Eggs | **Highest** |
| `foodOnCards` | Cache | **Highest** |
| `tuckedCards` | Tucked | **Highest** |
| `nectar` | Nectar | **Highest** |

### 2.2 Rule

- **Lower-is-better:** Only `avgPlacement`. Best = `min(values)`.
- **Higher-is-better:** All other metrics. Best = `max(values)`.

### 2.3 Ties

- If multiple players have the same best value (e.g. two players both have 42 Birds), **all** of them are considered “best” for that row and **all** receive the highlight.
- No tie-breaker; the UI does not distinguish “first among ties.”

---

## 3. Data and Computation

### 3.1 Input

- **Compared players:** The set of `LeagueStats` currently on the compare view (current user’s stat + up to N selected others).
- **Per metric:** A numeric value from each player (e.g. `stat.averageScore`, `stat.avgBreakdown.birds`). Use a single helper that, given `(stat, metricKey)`, returns the numeric value so “best” is computed consistently.

### 3.2 Algorithm (per row)

1. For the given metric key, collect `values = comparisonPlayers.map(s => getNumericValue(s, key))`.
2. Determine “best”:
   - If key is `avgPlacement`: `bestValue = min(values)`.
   - Else: `bestValue = max(values)`.
3. For each player in `comparisonPlayers`, highlight iff `getNumericValue(stat, key) === bestValue`.

### 3.3 Edge Cases

| Case | Behavior |
|------|----------|
| 0 or 1 player in comparison | No highlight (nothing to compare). |
| All players tie in a row | All cells in that row are highlighted. |
| NaN / missing value | Treat as not best (do not highlight); prefer normalizing data so values are always numeric. |

---

## 4. Visual Design

### 4.1 Current Implementation (Reference)

- **Target:** The `<td>` content (the numeric value) only.
- **Style when best:** `font-bold text-emerald-700`.
- **Style when not best:** `text-slate-900` (no bold).

Highlight is applied to the **text** of the value, not the entire cell background.

### 4.2 Recommended Standard

- **Element:** Apply the highlight to the **value** (e.g. the `<span>` that wraps the number).
- **When best:** Bold + distinct color (e.g. `font-bold text-emerald-700` or design-system equivalent).
- **When not best:** Normal weight and default text color.
- **Ties:** Same highlight style for every player who has the best value in that row.

### 4.3 Optional Enhancements

| Option | Description | Pros / Cons |
|--------|-------------|-------------|
| **Cell background** | Light background on the whole `<td>` for best (e.g. `bg-emerald-50`). | More visible at a glance; may conflict with row hover. |
| **Icon** | Small “best” icon (e.g. trophy or star) next to the value when best. | Clear semantics; uses more horizontal space. |
| **Both** | Background + bold text (and optional icon). | Strongest emphasis; ensure contrast and accessibility. |

Recommendation: keep **text-only** (bold + color) as the default to avoid clutter; add cell background or icon only if product/UX asks for stronger emphasis.

### 4.4 Accessibility

- **Color:** Ensure highlighted color (e.g. emerald-700) meets contrast requirements against the background (WCAG AA).
- **Not color alone:** The “best” state is also indicated by **bold**, so it’s not conveyed by color only.
- **Screen readers:** No change required for correctness; optional: add `aria-describedby` or a small visually hidden “(best)” label for the cell when highlighted.

---

## 5. Component and Implementation

### 5.1 Location

- **Page:** `src/routes/(protected)/leagues/[id]/compare/+page.svelte`
- **Logic:** Pure function `isBestInRow(stat: LeagueStats, key: string): boolean` (or equivalent) that:
  - Takes the list of compared players from reactive state.
  - Uses a single `getNumericValue(stat, key)` for consistency.
  - Implements “lower is better” only for `avgPlacement`; otherwise “higher is better.”
  - Returns `true` iff this `stat`’s value equals the computed best for that `key`.

### 5.2 Structure

- **Constants:** `LOWER_IS_BETTER = new Set(['avgPlacement'])` (or equivalent) so adding future “lower is better” metrics is one place.
- **Table:** For each metric row, for each player cell, compute `best = isBestInRow(stat, key)` and apply the highlight class to the value when `best` is true.

### 5.3 No API Changes

- Highlight is derived entirely from existing `LeagueStats` and metric keys; no new endpoints or response fields.

---

## 6. Validation and Acceptance

| Criterion | Pass |
|----------|------|
| For each metric row, exactly the player(s) with the best value for that metric are highlighted. | ✓ |
| “Best” = max for all metrics except Avg place; “Best” = min for Avg place. | ✓ |
| Ties: all players with the best value in a row are highlighted. | ✓ |
| When 0 or 1 player is in the comparison, no cells are highlighted. | ✓ |
| Highlight is visible (bold + color) and accessible (not color-only). | ✓ |

---

## 7. Summary

- **What:** Highlight the person(s) with the best value in each row of the scoring comparison table.
- **Where:** Compare players page; per-metric row; per-player cell.
- **How:** Compute best per row (max or min by metric), then apply bold + accent color to the value when it equals best; ties all get the same highlight.
- **Visual:** Bold + emerald (or design-system) text on the value; optional cell background or icon can be added later if desired.

This design keeps behavior and semantics explicit and leaves room for small visual enhancements without changing the core rule: **highlight the player(s) with the highest score (or lowest for Avg place) in each row among all compared players.**
