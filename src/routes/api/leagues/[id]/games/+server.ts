import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { requireLeagueMember } from '$lib/utils/auth';

export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const leagueId = parseInt(params.id);
	if (isNaN(leagueId)) {
		return json({ error: 'Invalid league ID' }, { status: 400 });
	}

	const db = getDb();
	let userId: number;
	try {
		userId = requireLeagueMember(leagueId, cookies, db);
	} catch (r) {
		return r;
	}

	// Pagination by games (not rows): limit = games per page
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
	const offset = parseInt(url.searchParams.get('offset') || '0');

	// Get total count of games
	const totalResult = db
		.prepare('SELECT COUNT(*) as total FROM games WHERE league_id = ?')
		.get(leagueId) as { total: number };

	// Get game IDs for this page (paginate by games), sequential order of upload (id ASC)
	const gameRows = db
		.prepare(
			`
		SELECT id, played_at as playedAt
		FROM games
		WHERE league_id = ?
		ORDER BY id ASC
		LIMIT ? OFFSET ?
	`
		)
		.all(leagueId, limit, offset) as Array<{ id: number; playedAt: string }>;

	if (gameRows.length === 0) {
		return json({
			games: [],
			total: totalResult.total,
			limit,
			offset
		});
	}

	// Get all scores for these games (one query, preserves order via game id list)
	const placeholders = gameRows.map(() => '?').join(',');
	const gameIds = gameRows.map((r) => r.id);
	const scoresRows = db
		.prepare(
			`
		SELECT game_id as gameId, user_id as userId, total_score as totalScore
		FROM scores
		WHERE game_id IN (${placeholders})
		ORDER BY game_id, placement
	`
		)
		.all(...gameIds) as Array<{ gameId: number; userId: number; totalScore: number }>;

	// Build games list with playedAt from gameRows, scores from scoresRows
	const gamesMap = new Map<number, { id: number; playedAt: string; scores: Array<{ userId: number; totalScore: number }> }>();
	for (const g of gameRows) {
		gamesMap.set(g.id, { id: g.id, playedAt: g.playedAt, scores: [] });
	}
	for (const s of scoresRows) {
		gamesMap.get(s.gameId)!.scores.push({ userId: s.userId, totalScore: s.totalScore });
	}

	const games = gameRows.map((r) => gamesMap.get(r.id)!);

	return json({
		games,
		total: totalResult.total,
		limit,
		offset
	});
};
