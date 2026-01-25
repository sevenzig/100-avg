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

export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const leagueId = parseInt(params.id);
	if (isNaN(leagueId)) {
		return json({ error: 'Invalid league ID' }, { status: 400 });
	}

	const db = getDb();

	// Check if user is an admin
	const user = db
		.prepare('SELECT is_admin FROM users WHERE id = ?')
		.get(userId) as { is_admin: number | null } | undefined;

	const isAdmin = user?.is_admin === 1;

	// If not admin, check if user is a member of this league
	if (!isAdmin) {
		const membership = db
			.prepare('SELECT user_id FROM league_players WHERE league_id = ? AND user_id = ?')
			.get(leagueId, userId);

		if (!membership) {
			return json({ error: 'You are not a member of this league' }, { status: 403 });
		}
	}

	// Get league details
	const league = db
		.prepare('SELECT id, name, created_by, created_at FROM leagues WHERE id = ?')
		.get(leagueId) as
		| { id: number; name: string; created_by: number; created_at: string }
		| undefined;

	if (!league) {
		return json({ error: 'League not found' }, { status: 404 });
	}

	// Get players
	const players = db
		.prepare(
			`
		SELECT 
			u.id,
			u.username,
			lp.player_color as color
		FROM 
			league_players lp
			JOIN users u ON lp.user_id = u.id
		WHERE 
			lp.league_id = ?
		ORDER BY 
			lp.player_color
	`
		)
		.all(leagueId) as Array<{ id: number; username: string; color: string }>;

	// Get games
	const games = db
		.prepare('SELECT id, played_at as playedAt FROM games WHERE league_id = ? ORDER BY played_at DESC')
		.all(leagueId) as Array<{ id: number; playedAt: string }>;

	return json({
		league: {
			id: league.id,
			name: league.name,
			createdBy: league.created_by,
			createdAt: league.created_at,
			players: players.map((p) => ({
				id: p.id,
				username: p.username,
				color: p.color
			})),
			games: games.map((g) => ({
				id: g.id,
				playedAt: g.playedAt
			}))
		}
	});
};
