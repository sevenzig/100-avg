import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';

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

	// Get statistics for all players in the league
	// Use DISTINCT to ensure we only count each game once per player
	const stats = db
		.prepare(
			`
		SELECT 
			u.id as user_id,
			u.username,
			lp.player_color as color,
			COALESCE(AVG(s.placement), 0) as avg_placement,
			COUNT(DISTINCT CASE WHEN s.placement = 1 THEN g.id END) as first_place_finishes,
			COALESCE(AVG(s.total_score), 0) as average_score,
			COALESCE(MAX(s.total_score), 0) as highest_score,
			COALESCE(MIN(s.total_score), 0) as lowest_score,
			COALESCE(AVG(s.birds), 0) as avg_birds,
			COALESCE(AVG(s.bonus_cards), 0) as avg_bonus_cards,
			COALESCE(AVG(s.end_of_round_goals), 0) as avg_end_of_round_goals,
			COALESCE(AVG(s.eggs), 0) as avg_eggs,
			COALESCE(AVG(s.food_on_cards), 0) as avg_food_on_cards,
			COALESCE(AVG(s.tucked_cards), 0) as avg_tucked_cards,
			COALESCE(AVG(s.nectar), 0) as avg_nectar,
			COUNT(DISTINCT g.id) as total_games,
			COUNT(DISTINCT CASE WHEN s.placement = 1 THEN g.id END) as wins,
			COUNT(DISTINCT CASE WHEN s.placement > 1 THEN g.id END) as losses
		FROM 
			league_players lp
			JOIN users u ON lp.user_id = u.id
			LEFT JOIN scores s ON s.user_id = u.id
			LEFT JOIN games g ON s.game_id = g.id AND g.league_id = lp.league_id
		WHERE 
			lp.league_id = ?
		GROUP BY 
			u.id, u.username, lp.player_color
		ORDER BY 
			avg_placement ASC, average_score DESC
	`
		)
		.all(leagueId) as Array<{
		user_id: number;
		username: string;
		color: string;
		avg_placement: number;
		first_place_finishes: number;
		average_score: number;
		highest_score: number;
		lowest_score: number;
		avg_birds: number;
		avg_bonus_cards: number;
		avg_end_of_round_goals: number;
		avg_eggs: number;
		avg_food_on_cards: number;
		avg_tucked_cards: number;
		avg_nectar: number;
		total_games: number;
		wins: number;
		losses: number;
	}>;

	const formattedStats = stats.map((stat) => ({
		userId: stat.user_id,
		username: stat.username,
		color: stat.color,
		avgPlacement: stat.avg_placement || 0,
		firstPlaceFinishes: stat.first_place_finishes || 0,
		averageScore: stat.average_score || 0,
		highestScore: stat.highest_score || 0,
		lowestScore: stat.lowest_score || 0,
		avgBreakdown: {
			birds: stat.avg_birds || 0,
			bonusCards: stat.avg_bonus_cards || 0,
			endOfRoundGoals: stat.avg_end_of_round_goals || 0,
			eggs: stat.avg_eggs || 0,
			foodOnCards: stat.avg_food_on_cards || 0,
			tuckedCards: stat.avg_tucked_cards || 0,
			nectar: stat.avg_nectar || 0
		},
		totalGames: stat.total_games || 0,
		wins: stat.wins || 0,
		losses: stat.losses || 0
	}));

	return json({ stats: formattedStats });
};
