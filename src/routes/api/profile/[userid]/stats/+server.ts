import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';

interface PlacementRow {
	game_id: number;
	date: string;
	placement: number;
	total_score: number;
}

interface CategoryAvgRow {
	matches: number;
	avg_birds: number;
	avg_bonus_cards: number;
	avg_end_of_round_goals: number;
	avg_eggs: number;
	avg_food_on_cards: number;
	avg_tucked_cards: number;
	avg_nectar: number;
}

interface RecentScoreRow {
	game_id: number;
	date: string;
	total_score: number;
}

interface GameScoreRow {
	game_id: number;
	date: string;
	birds: number;
	bonus_cards: number;
	end_of_round_goals: number;
	eggs: number;
	food_on_cards: number;
	tucked_cards: number;
	nectar: number;
	total_score: number;
}

// GET: Get comprehensive statistics for a specific user
export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const currentUserId = getUserId(cookies);
	if (!currentUserId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const targetUserId = parseInt(params.userid);
	if (isNaN(targetUserId)) {
		return json({ error: 'Invalid user ID' }, { status: 400 });
	}

	const matches = Math.min(parseInt(url.searchParams.get('matches') || '10'), 50);
	const leagueIdParam = url.searchParams.get('leagueId');
	const leagueId = leagueIdParam ? parseInt(leagueIdParam) : null;

	const db = getDb();

	// Get placement history
	const placementHistory = db
		.prepare(
			`
			SELECT 
				g.id as game_id,
				DATE(g.played_at) as date,
				s.placement,
				s.total_score
			FROM scores s
			JOIN games g ON s.game_id = g.id
			WHERE s.user_id = ?
				AND (? IS NULL OR g.league_id = ?)
			ORDER BY g.played_at DESC
			LIMIT ?
		`
		)
		.all(targetUserId, leagueId, leagueId, matches) as PlacementRow[];

	// Get category averages
	const categoryAverages = db
		.prepare(
			`
			SELECT 
				COUNT(*) as matches,
				AVG(s.birds) as avg_birds,
				AVG(s.bonus_cards) as avg_bonus_cards,
				AVG(s.end_of_round_goals) as avg_end_of_round_goals,
				AVG(s.eggs) as avg_eggs,
				AVG(s.food_on_cards) as avg_food_on_cards,
				AVG(s.tucked_cards) as avg_tucked_cards,
				AVG(s.nectar) as avg_nectar
			FROM scores s
			JOIN games g ON s.game_id = g.id
			WHERE s.user_id = ?
				AND (? IS NULL OR g.league_id = ?)
			ORDER BY g.played_at DESC
			LIMIT ?
		`
		)
		.get(targetUserId, leagueId, leagueId, matches) as CategoryAvgRow | undefined;

	// Get recent scores
	const recentScores = db
		.prepare(
			`
			SELECT 
				g.id as game_id,
				DATE(g.played_at) as date,
				s.total_score
			FROM scores s
			JOIN games g ON s.game_id = g.id
			WHERE s.user_id = ?
				AND (? IS NULL OR g.league_id = ?)
			ORDER BY g.played_at DESC
			LIMIT 10
		`
		)
		.all(targetUserId, leagueId, leagueId) as RecentScoreRow[];

	// Get detailed game scores with breakdown
	const gameScores = db
		.prepare(
			`
			SELECT 
				g.id as game_id,
				DATE(g.played_at) as date,
				s.birds,
				s.bonus_cards,
				s.end_of_round_goals,
				s.eggs,
				s.food_on_cards,
				s.tucked_cards,
				s.nectar,
				s.total_score
			FROM scores s
			JOIN games g ON s.game_id = g.id
			WHERE s.user_id = ?
				AND (? IS NULL OR g.league_id = ?)
			ORDER BY g.played_at ASC
			LIMIT ?
		`
		)
		.all(targetUserId, leagueId, leagueId, matches) as GameScoreRow[];

	// Add game numbers (1, 2, 3, ...)
	const gameScoresWithNumbers = gameScores.map((row, index) => ({
		gameId: row.game_id,
		date: row.date,
		gameNumber: index + 1,
		birds: row.birds,
		bonusCards: row.bonus_cards,
		endOfRoundGoals: row.end_of_round_goals,
		eggs: row.eggs,
		foodOnCards: row.food_on_cards,
		tuckedCards: row.tucked_cards,
		nectar: row.nectar,
		totalScore: row.total_score
	}));

	return json({
		stats: {
			placementHistory: placementHistory.map((row) => ({
				gameId: row.game_id,
				date: row.date,
				placement: row.placement,
				totalScore: row.total_score
			})),
			categoryAverages: {
				matches: categoryAverages?.matches || 0,
				birds: categoryAverages?.avg_birds || 0,
				bonusCards: categoryAverages?.avg_bonus_cards || 0,
				endOfRoundGoals: categoryAverages?.avg_end_of_round_goals || 0,
				eggs: categoryAverages?.avg_eggs || 0,
				foodOnCards: categoryAverages?.avg_food_on_cards || 0,
				tuckedCards: categoryAverages?.avg_tucked_cards || 0,
				nectar: categoryAverages?.avg_nectar || 0
			},
			recentScores: recentScores.map((row) => ({
				gameId: row.game_id,
				date: row.date,
				totalScore: row.total_score
			})),
			gameScores: gameScoresWithNumbers
		}
	});
};
