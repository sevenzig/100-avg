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

export const GET: RequestHandler = async ({ cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDb();

	// Get all leagues where user is a member
	const userLeagues = db
		.prepare(
			`
		SELECT 
			l.id,
			l.name,
			l.created_at,
			COUNT(DISTINCT lp.user_id) as player_count,
			MAX(g.played_at) as last_game_date
		FROM 
			leagues l
			JOIN league_players lp ON l.id = lp.league_id
			LEFT JOIN games g ON g.league_id = l.id
		WHERE 
			lp.user_id = ?
		GROUP BY 
			l.id, l.name, l.created_at
		ORDER BY 
			last_game_date DESC NULLS LAST
	`
		)
		.all(userId) as Array<{
		id: number;
		name: string;
		created_at: string;
		player_count: number;
		last_game_date: string | null;
	}>;

	// Get players for each league
	const leagues = await Promise.all(
		userLeagues.map(async (league) => {
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
				.all(league.id) as Array<{ id: number; username: string; color: string }>;

			return {
				id: league.id,
				name: league.name,
				playerCount: league.player_count,
				lastGameDate: league.last_game_date || undefined,
				players: players.map((p) => ({
					id: p.id,
					username: p.username,
					color: p.color
				}))
			};
		})
	);

	return json({ leagues });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ success: false, error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { name, playerIds } = await request.json();

		// Validation
		if (!name || name.length < 1 || name.length > 50) {
			return json({ success: false, error: 'League name must be 1-50 characters' }, {
				status: 400
			});
		}

		if (!Array.isArray(playerIds) || playerIds.length < 1) {
			return json({ success: false, error: 'League must have at least one player' }, {
				status: 400
			});
		}

		// Check for unique player IDs
		const uniqueIds = new Set(playerIds);
		if (uniqueIds.size !== playerIds.length) {
			return json({ success: false, error: 'All players must be unique' }, { status: 400 });
		}

		// Verify creator is one of the players
		if (!playerIds.includes(userId)) {
			return json({ success: false, error: 'Creator must be one of the players' }, {
				status: 400
			});
		}

		const db = getDb();

		// Verify all player IDs exist
		const placeholders = playerIds.map(() => '?').join(',');
		const existingPlayers = db
			.prepare(`SELECT id FROM users WHERE id IN (${placeholders})`)
			.all(...playerIds) as Array<{ id: number }>;

		if (existingPlayers.length !== playerIds.length) {
			return json({ success: false, error: 'One or more players not found' }, { status: 400 });
		}

		// Create league in transaction
		const createLeague = db.transaction(() => {
			// Insert league
			const leagueResult = db
				.prepare('INSERT INTO leagues (name, created_by) VALUES (?, ?)')
				.run(name, userId);
			const leagueId = leagueResult.lastInsertRowid as number;

			// Insert league players with colors
			// Cycle through player_1, player_2, player_3 for any number of players
			const colorOptions: Array<'player_1' | 'player_2' | 'player_3'> = [
				'player_1',
				'player_2',
				'player_3'
			];
			const insertPlayer = db.prepare(
				'INSERT INTO league_players (league_id, user_id, player_color) VALUES (?, ?, ?)'
			);

			playerIds.forEach((playerId: number, index: number) => {
				const color = colorOptions[index % colorOptions.length];
				insertPlayer.run(leagueId, playerId, color);
			});

			return leagueId;
		});

		const leagueId = createLeague();

		return json(
			{
				success: true,
				league: {
					id: leagueId,
					name,
					createdBy: userId,
					createdAt: new Date().toISOString()
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Create league error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
