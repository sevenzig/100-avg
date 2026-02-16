# Project Improvement Guide

Prioritized, actionable improvements for the Wingspan Score codebase. Use this as a roadmap from here.

**Implemented (see git history):** 1 – consolidate getUserId. 2 – auth types (CookieGetter, DbLike). 3 – Vitest + validation tests. 4 – requireAuth / requireLeagueMember helpers; league games route refactored. 5 – ARCHITECTURE.md and README dev section.

---

## 1. Maintainability: Remove duplicate auth helpers (quick win) ✅ Done

**Problem**: Several API routes define their own `getUserId(cookies)` instead of using the shared helper.

**Files with local `getUserId`** (should import from `$lib/utils/auth` instead):

| File | Action |
|------|--------|
| `src/routes/api/leagues/[id]/games/+server.ts` | Remove local `getUserId`, add `import { getUserId } from '$lib/utils/auth'` |
| `src/routes/api/games/[id]/+server.ts` | Same |
| `src/routes/api/leagues/[id]/stats/+server.ts` | Same |
| `src/routes/api/users/+server.ts` | Same |
| `src/routes/api/leagues/[id]/+server.ts` | Same |
| `src/routes/api/leagues/+server.ts` | Same |

**Benefit**: Single source of truth; future auth changes (e.g. cookie name, token handling) only need to be updated in one place.

---

## 2. Type safety: Tighten auth and DB types ✅ Done

**Problem**: `getUserId(cookies: any)` and `db: any` in auth helpers lose type safety.

**Implemented**: `CookieGetter` and `DbLike` interfaces added in `$lib/utils/auth.ts`; auth helpers and admin `requireAdmin` now use these types (no dependency on better-sqlite3 type declarations).

**Benefit**: Fewer runtime bugs and better editor support.

---

## 3. Quality: Add tests ✅ Done

**Problem**: No test files found; refactors and new features are not guarded by tests.

**Implemented**: Vitest added with standalone `vitest.config.ts` (so tests run without loading SvelteKit). `tests/validation.test.ts` has 15 unit tests for `validateUsername`, `validateDisplayName`, `placementsFromTotalScores`, and `validatePlacementsConsistentWithScores`. Run with `npm run test` or `npm run test:watch`.

**Next**: Add API tests for critical routes and/or component tests as needed.

**Benefit**: Safer refactors and regression prevention.

---

## 4. Performance: Keep an eye on queries

**Current state**: Single SQLite DB, indexed on `league_id`, `game_id`, `user_id`. Fits current scale.

**When you add features**:

- For league “all games” or stats, ensure lists are ordered and paginated in the DB (you already use `ORDER BY id ASC` and `LIMIT`/`OFFSET`).
- If you add filters (e.g. by date range, by player), add indexes that match `WHERE`/`ORDER BY` (e.g. `(league_id, played_at)` if you filter by date).
- Avoid N+1: you already batch scores per page in `leagues/[id]/games`; keep that pattern for other list endpoints.

---

## 5. Security and robustness

**Already in good shape**:

- JWT with `JWT_SECRET` (and dev fallback only in dev).
- Rate limiting on upload.
- Body size limit for upload route.
- Bot-scan 404 in hooks.
- Admin/superadmin and league-membership checks on sensitive routes.

**Optional improvements**:

- **Centralize “require auth” and “require league member/admin”**: A small helper (e.g. `requireLeagueMember(leagueId, cookies, db)`) that returns `userId` or throws a typed response could replace repeated blocks and reduce mistakes.
- **Audit mutation endpoints**: Ensure every POST/PUT/DELETE validates membership or admin; migrate more routes to `requireAuth` / `requireLeagueMember` where applicable.

---

## 6. Documentation and structure

**Already in good shape**:

- `docs/development/` with design docs and component specs.
- Clear route layout: `(protected)`, `(auth)`, API under `routes/api`.

**Implemented**: `docs/development/ARCHITECTURE.md` added (stack, auth, data model, tests, env). README updated with a short Development section (env, dev, seed, test).

---

## Suggested order of work

1. **This week**: (1) Replace duplicate `getUserId` with imports from `$lib/utils/auth` in the six files above.
2. **Next**: (2) Add proper types for `cookies` and `db` in auth helpers.
3. **Then**: (3) Introduce Vitest and a few tests for validation and one critical API route.
4. **Ongoing**: Use (4)–(6) when touching those areas (new queries, new endpoints, onboarding).

If you tell me which area you want to tackle first (auth consolidation, types, or tests), I can outline the exact code changes step by step.
