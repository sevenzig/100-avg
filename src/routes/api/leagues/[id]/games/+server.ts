import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { verifyToken } from '$lib/utils/auth';

function getUserId(cookies: any): number | null {
	const token = cookies.get('token');
	if (!token) return null;
	const decoded = verifyToken(token);
	return decoded?.userId || null;
}

export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const leagueId = parseInt(params.id);
	if (isNaN(leagueId)) {
		return json({ error: 'Invalid league ID' }, { status: 400 });
	}

	const db = getDb();

	// Check if user is a member of this league
	const membership = db
		.prepare('SELECT user_id FROM league_players WHERE league_id = ? AND user_id = ?')
		.get(leagueId, userId);

	if (!membership) {
		return json({ error: 'You are not a member of this league' }, { status: 403 });
	}

	// Get pagination params
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
	const offset = parseInt(url.searchParams.get('offset') || '0');

	// Get total count
	const totalResult = db
		.prepare('SELECT COUNT(*) as total FROM games WHERE league_id = ?')
		.get(leagueId) as { total: number };

	// Get games with scores
	const games = db
		.prepare(
			`
		SELECT 
			g.id,
			g.played_at as playedAt,
			s.user_id,
			s.total_score as totalScore
		FROM 
			games g
			JOIN scores s ON s.game_id = g.id
		WHERE 
			g.league_id = ?
		ORDER BY 
			g.played_at DESC
		LIMIT ? OFFSET ?
	`
		)
		.all(leagueId, limit, offset) as Array<{
		id: number;
		playedAt: string;
		user_id: number;
		totalScore: number;
	}>;

	// Group scores by game
	const gamesMap = new Map<
		number,
		{ id: number; playedAt: string; scores: Array<{ userId: number; totalScore: number }> }
	>();

	games.forEach((row) => {
		if (!gamesMap.has(row.id)) {
			gamesMap.set(row.id, {
				id: row.id,
				playedAt: row.playedAt,
				scores: []
			});
		}
		gamesMap.get(row.id)!.scores.push({
			userId: row.user_id,
			totalScore: row.totalScore
		});
	});

	return json({
		games: Array.from(gamesMap.values()),
		total: totalResult.total,
		limit,
		offset
	});
};
