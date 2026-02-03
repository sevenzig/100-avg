# Uploaded Scoring – Allow for Ties

## 1. Overview

This document specifies the design for **allowing tied placements** in uploaded/screenshot-based scoring and across the game scoring system. When two or more players have the same total score, they share the same placement (e.g. two players with 95 points both get placement 1; the next player gets placement 3).

**Related:** [Past Games CRUD Design](./PAST_GAMES_CRUD_DESIGN.md) (edit/delete permissions); game APIs and score schema are shared.

### 1.1 Requirements Summary

| Requirement | Description |
|-------------|-------------|
| **Tied placements** | Multiple players may have the same `placement` value (e.g. 1, 1, 3, 4 for a 4-player game with a tie for first). |
| **Upload/screenshot flow** | Image parser and upload modal assign placement by score rank, with ties getting the same placement. |
| **Manual create/edit** | POST/PUT game APIs accept tied placements; validation allows non-unique, non-sequential placements that are “rank-consistent”. |
| **Stats** | Wins/first-place and avg placement remain well-defined (ties for 1st count as wins; avg placement uses numeric value). |
| **UI** | Display placement (e.g. “1st”, “T-1st”) and support editing placement when manually entering/editing games. |

### 1.2 Out of Scope

- Changing who can create or edit games (unchanged from existing and [Past Games CRUD Design](./PAST_GAMES_CRUD_DESIGN.md)).
- Tie-breaker rules (e.g. by birds, then eggs). Only total score determines placement for ties.
- Historical migration of existing games (existing data remains valid; new/edited games may use ties).

---

## 2. Placement Semantics (Ties Allowed)

### 2.1 Rules

- **Placement** is an integer 1–5 (per game, 1 = best).
- **Ties**: Players with the same total score share the same placement.
- **Rank sequence**: Placements must be “rank-consistent”:
  - Sorted by (totalScore desc, then any stable order), the *ordinal* rank is 1, 2, 3, … (no gaps for ties).
  - Stored `placement` values can repeat and can have “gaps” (e.g. 1, 1, 3, 4).
- **Examples** (4 players, scores 100, 100, 90, 80):
  - Valid: placements [1, 1, 3, 4] or [1, 1, 2, 2] if we treated 90 and 80 as tie (they’re not; so 1,1,3,4).
  - Invalid: [1, 2, 3, 4] (ignores tie), [1, 1, 2, 4] (gap without tie at 2).

**Quick reference (same 4 players, scores 100, 100, 90, 80):**

| Placements   | Valid? | Reason |
|-------------|--------|--------|
| `[1, 1, 3, 4]` | Yes   | Matches rank by score (tie for first; next rank 3, then 4). |
| `[1, 2, 3, 4]` | No    | Ignores tie: both 100-point players must have placement 1. |
| `[1, 1, 2, 4]` | No    | Orphan gap: no one has placement 2 with score 90; 90 should be rank 3. |

**Edge cases:** One player → placement `[1]`. All players tied → all placements `1`.

### 2.2 Validation Rule (Replace “Unique Sequential”)

**Current (no ties):** Placements must be exactly `[1, 2, …, N]` for N players.

**New (ties allowed):**

1. Every value is in 1–5.
2. For each distinct total score (descending), all players with that score have the *same* placement.
3. That placement equals the rank when ordering by totalScore descending (ties get same rank; next lower score gets next rank).
4. No “orphan” gaps: if any player has placement `k`, then for every `j` in 1..k-1 there is at least one player with placement `j`.

So: **placements are consistent with ranking by totalScore**, and the set of placements is exactly `{1, 2, …, R}` for some R ≤ N with possible repeats.

---

## 3. Data Model & Schema

### 3.1 Current Schema

- **scores**: `placement INTEGER NOT NULL CHECK (placement IN (1, 2, 3, 4, 5))`
- No uniqueness on `(game_id, placement)`; only `UNIQUE(game_id, user_id)` (one row per user per game).

The DB already allows multiple rows per game with the same `placement`. The only change needed is **validation** (API and optionally a looser or no CHECK if we ever wanted placement &gt; 5 for “expansion” games—out of scope here).

### 3.2 Schema Change (Optional)

- **Option A (recommended):** Keep `CHECK (placement IN (1, 2, 3, 4, 5))`. No migration.
- **Option B:** If we later support more than 5 players, we could change to `CHECK (placement >= 1 AND placement <= 5)` or drop the CHECK and enforce in app. Not required for ties.

**Conclusion:** No DB migration required for ties. Existing schema supports multiple scores with the same `placement` per game.

---

## 4. API Specification

### 4.1 POST /api/games (Create Game)

**Request body:** Unchanged shape; `scores[].placement` may now have ties.

**Validation (replace unique-sequential check):**

- 1 ≤ `placement` ≤ 5 for each score.
- **Rank-consistency:**  
  - Sort scores by `totalScore` descending (stable).  
  - Assign ordinal rank 1, 2, 3, … (same rank for same totalScore).  
  - Require that each score’s `placement` equals this ordinal rank.  
- All other checks unchanged (user ids, breakdown sum, league membership, etc.).

**Example:** Scores with totalScore [100, 100, 90, 80] must have placements [1, 1, 3, 4]. Reject [1, 2, 3, 4] or [1, 1, 2, 4].

### 4.2 PUT /api/games/[id] (Update Game)

Same placement validation as POST: rank-consistent placements in 1–5, no unique-sequential requirement.

### 4.3 GET /api/games/[id] and List Games

No change. Response already returns `scores[].placement`; clients can show “1st”, “T-1st”, etc.

### 4.4 Helper: Compute Expected Placements from Scores

Use a single shared helper (e.g. in `src/lib/utils/validation.ts`):

```ts
/**
 * Returns placement for each score when ordered by totalScore descending.
 * Ties (same totalScore) get the same placement; next lower score gets next ordinal.
 * Example: [100, 100, 90, 80] -> [1, 1, 3, 4].
 */
export function placementsFromTotalScores(
  scores: Array<{ totalScore: number }>
): number[] {
  const sorted = [...scores]
    .map((s, i) => ({ totalScore: s.totalScore, index: i }))
    .sort((a, b) => b.totalScore - a.totalScore);
  const result: number[] = new Array(scores.length);
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].totalScore !== sorted[i - 1].totalScore) rank = i + 1;
    result[sorted[i].index] = rank;
  }
  return result;
}
```

**Validation:** Compute `expected = placementsFromTotalScores(scores)` and require `scores[i].placement === expected[i]` for every index `i`. Reject with 400 if any mismatch.

---

## 5. Image Parser (Upload Flow)

### 5.1 Current Behavior

- Sort players by `totalScore` descending.
- Assign `placement = index + 1` (so 1, 2, 3, … with no ties).

### 5.2 New Behavior

- Sort players by `totalScore` descending (stable).
- Assign placement by **rank**: same totalScore → same placement; next lower score gets next ordinal rank.

**Implementation (in `src/lib/utils/image-parser.ts`):**

Replace the two blocks that do:

```ts
sortedPlayers.forEach((player, index) => {
  player.placement = index + 1;
});
```

and:

```ts
finalSorted.forEach((player, index) => {
  player.placement = index + 1;
});
```

with a single rank-based assignment: iterate in sorted order; when `totalScore` drops, set `rank = i + 1`; assign `player.placement = rank`. Reuse the same logic as `placementsFromTotalScores` (or call a shared helper) so ties get the same placement (e.g. 1, 1, 3, 4).

---

## 6. Upload Modal & Edit Game Modal

### 6.1 UploadScreenshotModal

- **Initial assignment:** Already using parsed data; parser will now set tied placements (e.g. 1, 1, 3, 4).
- **updatePlacements():** Change to rank-based assignment (same as image parser): sort by totalScore desc, assign same placement for same totalScore, next rank for next lower score.
- **validate():** Replace “unique and sequential” check with rank-consistency check: compute expected placements from `totalScore` and compare to `editedPlayers[].placement`.
- **Submit:** Payload already sends `placement` per player; API will validate rank-consistency.

### 6.2 EditGameModal

- **Load:** Display existing placements (may include ties).
- **Validation:** Same as upload modal: placements must be rank-consistent with totalScore.
- **Save:** PUT with rank-consistent placements.

### 6.3 AddGameModal (Manual Add)

- **Placement input:** Keep per-player placement field; allow ties (e.g. two players with 1).
- **Validation:** Rank-consistency instead of unique sequential.
- **Optional:** “Auto-fill placements from scores” button that runs the same rank logic so users don’t have to type ties manually.

---

## 7. Stats & Aggregations

### 7.1 League Stats (e.g. `/api/leagues/[id]/stats`)

- **first_place_finishes / wins:** `COUNT(DISTINCT CASE WHEN s.placement = 1 THEN g.id END)`  
  **Unchanged.** A player with placement 1 (including tied first) still has “placement = 1”, so they count as a win. Correct for ties.
- **losses:** `COUNT(DISTINCT CASE WHEN s.placement > 1 THEN g.id END)`  
  **Unchanged.** Only non-first places.
- **avg_placement:** `AVG(s.placement)`  
  **Unchanged.** Tied first still has placement 1; avg remains meaningful (e.g. two 1sts and one 3rd → avg 5/3).

No SQL or response shape changes required for league stats.

### 7.2 Profile Stats

Same as above: placement history and averages already use `placement`; ties for 1st are still placement 1. PlacementHistoryChart buckets by 1–5; ties for 1st all go into “1st”. No change required.

---

## 8. UI Display of Placement

### 8.1 Where Placement Is Shown

- League game lists, game detail, upload/edit modals, profile placement history.
- Current pattern: numeric (1, 2, 3) or ordinals (“1st”, “2nd”) from a helper.

### 8.2 Ties Display (Optional Enhancement)

- **Option A:** Show numeric placement only (1, 1, 3, 4). No UI change.
- **Option B:** Show “T-1st” when there is more than one player with placement 1 in that game (and similarly “T-2nd” if desired). Requires passing “game context” (other scores) into the display component or computing “isTied” when rendering a score row (e.g. same game, same placement, count > 1).

Recommendation: implement Option A first (numeric or “1st” from placement only); add “T-” prefix later if desired (Option B).

---

## 9. Validation Summary

| Layer | Current | New (Ties Allowed) |
|-------|---------|--------------------|
| DB | `placement` 1–5 | No change |
| POST/PUT games | Unique sequential 1..N | Rank-consistent with totalScore, 1–5 |
| Image parser | placement = index + 1 | placement = rank (same score → same rank) |
| Upload modal | Unique sequential | Rank-consistent |
| Edit modal | Unique sequential | Rank-consistent |
| Add game modal | Unique sequential | Rank-consistent |

---

## 10. File & Component Summary

| Area | File | Change |
|------|------|--------|
| Validation | `src/lib/utils/validation.ts` | Add `placementsFromTotalScores()`; add `validatePlacementsConsistentWithScores(scores)` (or inline in API). |
| API – create | `src/routes/api/games/+server.ts` | Replace unique-sequential check with rank-consistency using totalScore. |
| API – update | `src/routes/api/games/[id]/+server.ts` | Same as create. |
| Image parser | `src/lib/utils/image-parser.ts` | Assign placement by rank (ties get same placement). |
| Upload modal | `src/lib/components/scoreboard/UploadScreenshotModal.svelte` | `updatePlacements()` rank-based; validate rank-consistent. |
| Edit modal | `src/lib/components/scoreboard/EditGameModal.svelte` | Validate rank-consistent; optional auto-fill from scores. |
| Add game modal | `src/lib/components/scoreboard/AddGameModal.svelte` | Validate rank-consistent; optional auto-fill. |
| Stats | League/Profile stats APIs | No change (placement = 1 still means win; avg placement correct). |
| UI display | Any component showing “1st” | Optional: “T-1st” when tied (game-scoped). |

---

## 11. Implementation Order

Recommended sequence to avoid partial states:

1. **Validation helper** – Add `placementsFromTotalScores()` (and optionally `validatePlacementsConsistentWithScores()`) in `src/lib/utils/validation.ts`.
2. **API** – Update POST and PUT in games API to use rank-consistency validation; remove unique-sequential check.
3. **Image parser** – Assign placement by rank (reuse or mirror helper logic) in both placement-assignment blocks.
4. **Modals** – Update Upload, Edit, and Add Game modals: rank-based `updatePlacements()` (where applicable) and rank-consistency validation.
5. **Optional** – T-1st UI and auto-fill placements button.

---

## 12. Error Messages

- **API (400):** e.g. “Placements must be consistent with ranking by total score (ties share the same placement).”
- **Modals:** e.g. “Placements must match score order. Tied scores should have the same placement.”

---

## 13. Diagram (Placement Rank Logic)

```
Scores (totalScore):  [100, 100, 90, 80]
Sort desc:            [100, 100, 90, 80]
Ordinal rank:          rank 1   rank 1  rank 3  rank 4
Stored placement:      [  1,      1,      3,      4   ]
```

This design allows uploaded scoring and manual create/edit to support ties while keeping the data model and stats semantics unchanged and backward compatible.

---

## 14. Glossary

| Term | Meaning |
|------|--------|
| **Rank-consistent** | Placements match the ordinal rank when scores are sorted descending; ties share the same placement (e.g. 1, 1, 3, 4). |
| **Ordinal rank** | Position in order (1st, 2nd, …) with ties sharing the same position; the next distinct score gets the next position. |
| **Orphan gap** | A placement value `k` appears but some smaller placement 1..k-1 has no player—invalid. |
