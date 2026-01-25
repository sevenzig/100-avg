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

	const gameId = parseInt(params.id);
	if (isNaN(gameId)) {
		return json({ error: 'Invalid game ID' }, { status: 400 });
	}

	const db = getDb();

	// Get game details
	const game = db
		.prepare('SELECT id, league_id, played_at, created_by FROM games WHERE id = ?')
		.get(gameId) as
		| { id: number; league_id: number; played_at: string; created_by: number }
		| undefined;

	if (!game) {
		return json({ error: 'Game not found' }, { status: 404 });
	}

	// Check if user is a member of this league
	const membership = db
		.prepare('SELECT user_id FROM league_players WHERE league_id = ? AND user_id = ?')
		.get(game.league_id, userId);

	if (!membership) {
		return json({ error: 'You are not a member of this league' }, { status: 403 });
	}

	// Get scores with user info
	const scores = db
		.prepare(
			`
		SELECT 
			s.user_id,
			u.username,
			s.placement,
			s.total_score,
			s.birds,
			s.bonus_cards,
			s.end_of_round_goals,
			s.eggs,
			s.food_on_cards,
			s.tucked_cards,
			s.nectar
		FROM 
			scores s
			JOIN users u ON s.user_id = u.id
		WHERE 
			s.game_id = ?
		ORDER BY 
			s.placement
	`
		)
		.all(gameId) as Array<{
		user_id: number;
		username: string;
		placement: number;
		total_score: number;
		birds: number;
		bonus_cards: number;
		end_of_round_goals: number;
		eggs: number;
		food_on_cards: number;
		tucked_cards: number;
		nectar: number;
	}>;

	return json({
		game: {
			id: game.id,
			leagueId: game.league_id,
			playedAt: game.played_at,
			createdBy: game.created_by,
			scores: scores.map((s) => ({
				userId: s.user_id,
				username: s.username,
				placement: s.placement,
				totalScore: s.total_score,
				breakdown: {
					birds: s.birds,
					bonusCards: s.bonus_cards,
					endOfRoundGoals: s.end_of_round_goals,
					eggs: s.eggs,
					foodOnCards: s.food_on_cards,
					tuckedCards: s.tucked_cards,
					nectar: s.nectar
				}
			}))
		}
	});
};
