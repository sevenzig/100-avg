import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId, isAdmin, type CookieGetter, type DbLike } from '$lib/utils/auth';

// Helper to check admin access
function requireAdmin(cookies: CookieGetter, db: DbLike): number {
	const userId = getUserId(cookies);
	if (!userId) {
		throw { status: 401, body: { error: 'Not authenticated' } };
	}

	if (!isAdmin(userId, db)) {
		throw { status: 403, body: { error: 'Admin access required' } };
	}

	return userId;
}

// GET: List all leagues (admin only)
export const GET: RequestHandler = async ({ cookies }) => {
	const db = getDb();
	try {
		requireAdmin(cookies, db);

		// Get all leagues with player counts and game counts
		const leagues = db
			.prepare(
				`
			SELECT 
				l.id,
				l.name,
				l.created_by,
				l.created_at,
				u.username as creator_username,
				COUNT(DISTINCT lp.user_id) as player_count,
				COUNT(DISTINCT g.id) as game_count,
				MAX(g.played_at) as last_game_date
			FROM leagues l
			LEFT JOIN users u ON l.created_by = u.id
			LEFT JOIN league_players lp ON l.id = lp.league_id
			LEFT JOIN games g ON l.id = g.league_id
			GROUP BY l.id, l.name, l.created_by, l.created_at, u.username
			ORDER BY l.id DESC
		`
			)
			.all() as Array<{
			id: number;
			name: string;
			created_by: number;
			created_at: string;
			creator_username: string | null;
			player_count: number;
			game_count: number;
			last_game_date: string | null;
		}>;

		// Get players for each league
		const leaguesWithPlayers = leagues.map((league) => {
			const players = db
				.prepare(
					`
				SELECT 
					u.id,
					u.username,
					lp.player_color as color
				FROM league_players lp
				JOIN users u ON lp.user_id = u.id
				WHERE lp.league_id = ?
				ORDER BY lp.player_color
			`
				)
				.all(league.id) as Array<{ id: number; username: string; color: string }>;

			return {
				id: league.id,
				name: league.name,
				createdBy: league.created_by,
				createdByUsername: league.creator_username,
				createdAt: league.created_at,
				playerCount: league.player_count,
				gameCount: league.game_count,
				lastGameDate: league.last_game_date || undefined,
				players: players.map((p) => ({
					id: p.id,
					username: p.username,
					color: p.color
				}))
			};
		});

		return json({ leagues: leaguesWithPlayers });
	} catch (error: any) {
		if (error.status) {
			return json(error.body, { status: error.status });
		}
		console.error('Admin leagues GET error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// POST: Create league (admin only)
export const POST: RequestHandler = async ({ request, cookies }) => {
	const db = getDb();
	try {
		requireAdmin(cookies, db);

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
			// Insert league (admin can create for any user, use first player as creator)
			const leagueResult = db
				.prepare('INSERT INTO leagues (name, created_by) VALUES (?, ?)')
				.run(name, playerIds[0]);
			const leagueId = leagueResult.lastInsertRowid as number;

			// Insert league players with colors
			const colorOptions: Array<'player_1' | 'player_2' | 'player_3' | 'player_4' | 'player_5'> = [
				'player_1',
				'player_2',
				'player_3',
				'player_4',
				'player_5'
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
					createdBy: playerIds[0],
					createdAt: new Date().toISOString()
				}
			},
			{ status: 201 }
		);
	} catch (error: any) {
		if (error.status) {
			return json(error.body, { status: error.status });
		}
		console.error('Admin league POST error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};

// PUT: Update league (admin only)
export const PUT: RequestHandler = async ({ request, cookies }) => {
	const db = getDb();
	try {
		requireAdmin(cookies, db);

		const { id, name, playerIds } = await request.json();

		if (!id || typeof id !== 'number') {
			return json({ success: false, error: 'Invalid league ID' }, { status: 400 });
		}

		// Check if league exists
		const league = db
			.prepare('SELECT id FROM leagues WHERE id = ?')
			.get(id) as { id: number } | undefined;

		if (!league) {
			return json({ success: false, error: 'League not found' }, { status: 404 });
		}

		// Update league name if provided
		if (name !== undefined) {
			if (name.length < 1 || name.length > 50) {
				return json({ success: false, error: 'League name must be 1-50 characters' }, {
					status: 400
				});
			}
			db.prepare('UPDATE leagues SET name = ? WHERE id = ?').run(name, id);
		}

		// Update players if provided
		if (Array.isArray(playerIds)) {
			if (playerIds.length < 1) {
				return json({ success: false, error: 'League must have at least one player' }, {
					status: 400
				});
			}

			// Check for unique player IDs
			const uniqueIds = new Set(playerIds);
			if (uniqueIds.size !== playerIds.length) {
				return json({ success: false, error: 'All players must be unique' }, { status: 400 });
			}

			// Verify all player IDs exist
			const placeholders = playerIds.map(() => '?').join(',');
			const existingPlayers = db
				.prepare(`SELECT id FROM users WHERE id IN (${placeholders})`)
				.all(...playerIds) as Array<{ id: number }>;

			if (existingPlayers.length !== playerIds.length) {
				return json({ success: false, error: 'One or more players not found' }, { status: 400 });
			}

			// Update players in transaction
			const updatePlayers = db.transaction(() => {
				// Delete existing players
				db.prepare('DELETE FROM league_players WHERE league_id = ?').run(id);

				// Insert new players
				const colorOptions: Array<'player_1' | 'player_2' | 'player_3' | 'player_4' | 'player_5'> = [
					'player_1',
					'player_2',
					'player_3',
					'player_4',
					'player_5'
				];
				const insertPlayer = db.prepare(
					'INSERT INTO league_players (league_id, user_id, player_color) VALUES (?, ?, ?)'
				);

				playerIds.forEach((playerId: number, index: number) => {
					const color = colorOptions[index % colorOptions.length];
					insertPlayer.run(id, playerId, color);
				});
			});

			updatePlayers();
		}

		// Get updated league
		const updatedLeague = db
			.prepare('SELECT id, name, created_by, created_at FROM leagues WHERE id = ?')
			.get(id) as { id: number; name: string; created_by: number; created_at: string };

		return json({
			success: true,
			league: {
				id: updatedLeague.id,
				name: updatedLeague.name,
				createdBy: updatedLeague.created_by,
				createdAt: updatedLeague.created_at
			}
		});
	} catch (error: any) {
		if (error.status) {
			return json(error.body, { status: error.status });
		}
		console.error('Admin league PUT error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};

// DELETE: Delete league (admin only)
export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const db = getDb();
	try {
		requireAdmin(cookies, db);

		const { id } = await request.json();

		if (!id || typeof id !== 'number') {
			return json({ success: false, error: 'Invalid league ID' }, { status: 400 });
		}

		// Check if league exists
		const league = db
			.prepare('SELECT id, name FROM leagues WHERE id = ?')
			.get(id) as { id: number; name: string } | undefined;

		if (!league) {
			return json({ success: false, error: 'League not found' }, { status: 404 });
		}

		// Delete league (CASCADE will handle related data: league_players, games, scores)
		const result = db.prepare('DELETE FROM leagues WHERE id = ?').run(id);

		if (result.changes === 0) {
			return json({ success: false, error: 'Failed to delete league' }, { status: 500 });
		}

		return json({
			success: true,
			message: `League "${league.name}" deleted successfully`
		});
	} catch (error: any) {
		if (error.status) {
			return json(error.body, { status: error.status });
		}
		console.error('Admin league DELETE error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
