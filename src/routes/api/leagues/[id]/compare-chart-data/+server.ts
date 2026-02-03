import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';

export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const leagueId = parseInt(params.id);
	if (isNaN(leagueId)) {
		return json({ error: 'League not found' }, { status: 404 });
	}

	const db = getDb();

	// Check league exists
	const league = db.prepare('SELECT id FROM leagues WHERE id = ?').get(leagueId);
	if (!league) {
		return json({ error: 'League not found' }, { status: 404 });
	}

	// Check if user is an admin
	const userRow = db
		.prepare('SELECT is_admin FROM users WHERE id = ?')
		.get(userId) as { is_admin: number | null } | undefined;
	const isAdmin = userRow?.is_admin === 1;

	// If not admin, check membership
	if (!isAdmin) {
		const membership = db
			.prepare('SELECT user_id FROM league_players WHERE league_id = ? AND user_id = ?')
			.get(leagueId, userId);
		if (!membership) {
			return json({ error: 'You are not a member of this league' }, { status: 403 });
		}
	}

	// Parse and validate userIds
	const userIdsParam = url.searchParams.get('userIds');
	if (!userIdsParam || userIdsParam.trim() === '') {
		return json({ error: 'userIds is required' }, { status: 400 });
	}

	const requestedIds = userIdsParam.split(',').map((s) => parseInt(s.trim(), 10));
	if (requestedIds.some((id) => isNaN(id))) {
		return json({ error: 'All userIds must be league members' }, { status: 400 });
	}

	// Validate all requested users are league members
	const placeholders = requestedIds.map(() => '?').join(',');
	const members = db
		.prepare(
			`SELECT user_id FROM league_players WHERE league_id = ? AND user_id IN (${placeholders})`
		)
		.all(leagueId, ...requestedIds) as Array<{ user_id: number }>;

	const memberIds = new Set(members.map((m) => m.user_id));
	if (requestedIds.some((id) => !memberIds.has(id))) {
		return json({ error: 'All userIds must be league members' }, { status: 400 });
	}

	// Parse limit
	const limitParam = url.searchParams.get('limit');
	let limit = 30;
	if (limitParam) {
		const parsed = parseInt(limitParam, 10);
		if (!isNaN(parsed) && parsed > 0) {
			limit = Math.min(parsed, 50);
		}
	}

	// Get games ordered by played_at ASC (oldest first)
	const gameRows = db
		.prepare(
			`SELECT id, DATE(played_at) as date, played_at
			FROM games
			WHERE league_id = ?
			ORDER BY played_at ASC
			LIMIT ?`
		)
		.all(leagueId, limit) as Array<{ id: number; date: string; played_at: string }>;

	if (gameRows.length === 0) {
		return json({ games: [], series: [] });
	}

	const gameIds = gameRows.map((g) => g.id);
	const gamePlaceholders = gameIds.map(() => '?').join(',');
	const userPlaceholders = requestedIds.map(() => '?').join(',');

	// Get scores for requested users in these games
	const scoreRows = db
		.prepare(
			`SELECT game_id, user_id, total_score
			FROM scores
			WHERE game_id IN (${gamePlaceholders}) AND user_id IN (${userPlaceholders})`
		)
		.all(...gameIds, ...requestedIds) as Array<{
		game_id: number;
		user_id: number;
		total_score: number;
	}>;

	// Index scores by (game_id, user_id)
	const scoreMap = new Map<string, number>();
	for (const row of scoreRows) {
		scoreMap.set(`${row.game_id}_${row.user_id}`, row.total_score);
	}

	// Get user info (username, color) for requested users
	const userInfoRows = db
		.prepare(
			`SELECT u.id as user_id, u.username, lp.player_color as color
			FROM users u
			JOIN league_players lp ON lp.user_id = u.id AND lp.league_id = ?
			WHERE u.id IN (${userPlaceholders})`
		)
		.all(leagueId, ...requestedIds) as Array<{
		user_id: number;
		username: string;
		color: string;
	}>;

	const userInfoMap = new Map(userInfoRows.map((u) => [u.user_id, u]));

	// Build response
	const games = gameRows.map((g, i) => ({
		gameId: g.id,
		date: g.date,
		gameNumber: i + 1
	}));

	// Build series in the order of requestedIds for predictable legend order
	const series = requestedIds
		.map((uid) => {
			const info = userInfoMap.get(uid);
			if (!info) return null;
			return {
				userId: uid,
				username: info.username,
				color: info.color || 'player_1',
				scores: gameRows.map((g) => {
					const key = `${g.id}_${uid}`;
					return scoreMap.has(key) ? scoreMap.get(key)! : null;
				})
			};
		})
		.filter(Boolean);

	return json({ games, series });
};
