import type { SeasonsDb } from '$lib/utils/seasons';

export interface LeaguePlayerStatsRow {
	user_id: number;
	username: string;
	color: string;
	avg_placement: number | null;
	first_place_finishes: number;
	average_score: number | null;
	career_average_score: number | null;
	highest_score: number | null;
	lowest_score: number | null;
	avg_birds: number | null;
	avg_bonus_cards: number | null;
	avg_end_of_round_goals: number | null;
	avg_eggs: number | null;
	avg_food_on_cards: number | null;
	avg_tucked_cards: number | null;
	avg_nectar: number | null;
	total_games: number;
	career_total_games: number;
	wins: number;
	losses: number;
}

export function queryLeagueStats(
	db: SeasonsDb,
	leagueId: number,
	seasonId: number
): LeaguePlayerStatsRow[] {
	return db
		.prepare(
			`
		SELECT 
			u.id as user_id,
			u.username,
			lp.player_color as color,
			AVG(CASE WHEN g.season_id = ? THEN s.placement END) as avg_placement,
			COUNT(DISTINCT CASE WHEN g.season_id = ? AND s.placement = 1 THEN g.id END) as first_place_finishes,
			AVG(CASE WHEN g.season_id = ? THEN s.total_score END) as average_score,
			AVG(s.total_score) as career_average_score,
			MAX(CASE WHEN g.season_id = ? THEN s.total_score END) as highest_score,
			MIN(CASE WHEN g.season_id = ? THEN s.total_score END) as lowest_score,
			AVG(CASE WHEN g.season_id = ? THEN s.birds END) as avg_birds,
			AVG(CASE WHEN g.season_id = ? THEN s.bonus_cards END) as avg_bonus_cards,
			AVG(CASE WHEN g.season_id = ? THEN s.end_of_round_goals END) as avg_end_of_round_goals,
			AVG(CASE WHEN g.season_id = ? THEN s.eggs END) as avg_eggs,
			AVG(CASE WHEN g.season_id = ? THEN s.food_on_cards END) as avg_food_on_cards,
			AVG(CASE WHEN g.season_id = ? THEN s.tucked_cards END) as avg_tucked_cards,
			AVG(CASE WHEN g.season_id = ? THEN s.nectar END) as avg_nectar,
			COUNT(DISTINCT CASE WHEN g.season_id = ? AND s.id IS NOT NULL THEN g.id END) as total_games,
			COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN g.id END) as career_total_games,
			COUNT(DISTINCT CASE WHEN g.season_id = ? AND s.placement = 1 THEN g.id END) as wins,
			COUNT(DISTINCT CASE WHEN g.season_id = ? AND s.placement > 1 THEN g.id END) as losses
		FROM 
			league_players lp
			JOIN users u ON lp.user_id = u.id
			LEFT JOIN games g ON g.league_id = lp.league_id
			LEFT JOIN scores s ON s.game_id = g.id AND s.user_id = u.id
		WHERE 
			lp.league_id = ?
		GROUP BY 
			u.id, u.username, lp.player_color
		ORDER BY 
			avg_placement ASC, average_score DESC
	`
		)
		.all(
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			seasonId,
			leagueId
		) as LeaguePlayerStatsRow[];
}
