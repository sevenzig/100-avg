import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { requireLeagueMember } from '$lib/utils/auth';
import { resolveSeasonParam, seasonToJson } from '$lib/utils/seasons';

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

	const requested = url.searchParams.has('season') || url.searchParams.has('seasonId');
	const season = resolveSeasonParam(db, url.searchParams);
	if (!season) {
		return json({ error: requested ? 'Invalid season' : 'No active season' }, { status: 400 });
	}

	// Pagination by games (not rows): limit = games per page
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
	const offset = parseInt(url.searchParams.get('offset') || '0');

	// Get total count of games
	const totalResult = db
		.prepare('SELECT COUNT(*) as total FROM games WHERE league_id = ? AND season_id = ?')
		.get(leagueId, season.id) as { total: number };

	// Default is upload order (id ASC) for the all-games list.
	// order=desc is most recently played first, for the scoreboard's recent games.
	const orderBy = url.searchParams.get('order') === 'desc' ? 'played_at DESC, id DESC' : 'id ASC';
	const gameRows = db
		.prepare(
			`
		SELECT id, played_at as playedAt, season_id as seasonId
		FROM games
		WHERE league_id = ? AND season_id = ?
		ORDER BY ${orderBy}
		LIMIT ? OFFSET ?
	`
		)
		.all(leagueId, season.id, limit, offset) as Array<{
		id: number;
		playedAt: string;
		seasonId: number;
	}>;

	if (gameRows.length === 0) {
		return json({
			season: seasonToJson(season),
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
	const gamesMap = new Map<
		number,
		{ id: number; playedAt: string; seasonId: number; scores: Array<{ userId: number; totalScore: number }> }
	>();
	for (const g of gameRows) {
		gamesMap.set(g.id, { id: g.id, playedAt: g.playedAt, seasonId: g.seasonId, scores: [] });
	}
	for (const s of scoresRows) {
		gamesMap.get(s.gameId)!.scores.push({ userId: s.userId, totalScore: s.totalScore });
	}

	const games = gameRows.map((r) => gamesMap.get(r.id)!);

	return json({
		season: seasonToJson(season),
		games,
		total: totalResult.total,
		limit,
		offset
	});
};
