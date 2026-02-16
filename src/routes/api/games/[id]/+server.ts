import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId, canManageLeagueGames } from '$lib/utils/auth';
import { validatePlacementsConsistentWithScores } from '$lib/utils/validation';

interface ScoreInput {
	userId: number;
	placement: number;
	totalScore: number;
	birds?: number;
	bonusCards?: number;
	endOfRoundGoals?: number;
	eggs?: number;
	foodOnCards?: number;
	tuckedCards?: number;
	nectar?: number;
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

export const PUT: RequestHandler = async ({ params, cookies, request }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const gameId = parseInt(params.id);
	if (isNaN(gameId)) {
		return json({ error: 'Invalid game ID' }, { status: 400 });
	}

	const db = getDb();

	// Get game to check league_id
	const game = db
		.prepare('SELECT id, league_id FROM games WHERE id = ?')
		.get(gameId) as { id: number; league_id: number } | undefined;

	if (!game) {
		return json({ error: 'Game not found' }, { status: 404 });
	}

	// Check authorization
	if (!canManageLeagueGames(userId, game.league_id, db)) {
		return json({ error: "You don't have permission to edit games in this league" }, { status: 403 });
	}

	try {
		const { playedAt, scores } = await request.json();

		// Validation
		if (!playedAt || !Date.parse(playedAt)) {
			return json({ error: 'Invalid date' }, { status: 400 });
		}

		if (!Array.isArray(scores) || scores.length < 1 || scores.length > 5) {
			return json({ error: 'Game must have between 1 and 5 players' }, { status: 400 });
		}

		// Validate placements - must be rank-consistent with totalScore (ties allowed)
		const scoresWithTotals = (scores as ScoreInput[]).map((s) => ({
			placement: s.placement,
			totalScore: s.totalScore
		}));
		const placementValidation = validatePlacementsConsistentWithScores(scoresWithTotals);
		if (!placementValidation.valid) {
			return json({ error: placementValidation.error }, { status: 400 });
		}

		// Validate each score
		for (const score of scores as ScoreInput[]) {
			if (!score.userId || typeof score.userId !== 'number') {
				return json({ error: 'Each player must have a valid userId' }, { status: 400 });
			}

			// Check user exists
			const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(score.userId);
			if (!userExists) {
				return json({ error: `User with ID ${score.userId} not found` }, { status: 400 });
			}

			// Validate score breakdown matches total
			const sum =
				(score.birds || 0) +
				(score.bonusCards || 0) +
				(score.endOfRoundGoals || 0) +
				(score.eggs || 0) +
				(score.foodOnCards || 0) +
				(score.tuckedCards || 0) +
				(score.nectar || 0);

			if (sum !== score.totalScore) {
				return json({ error: 'Total score does not match sum of breakdown' }, { status: 400 });
			}
		}

		// Update game and scores in transaction
		const updateGame = db.transaction(() => {
			// Update game played_at
			db.prepare('UPDATE games SET played_at = ? WHERE id = ?').run(playedAt, gameId);

			// Delete existing scores
			db.prepare('DELETE FROM scores WHERE game_id = ?').run(gameId);

			// Insert new scores
			const insertScore = db.prepare(
				`INSERT INTO scores (
					game_id, user_id, placement, total_score,
					birds, bonus_cards, end_of_round_goals, eggs,
					food_on_cards, tucked_cards, nectar
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			);

			for (const score of scores as ScoreInput[]) {
				insertScore.run(
					gameId,
					score.userId,
					score.placement,
					score.totalScore,
					score.birds || 0,
					score.bonusCards || 0,
					score.endOfRoundGoals || 0,
					score.eggs || 0,
					score.foodOnCards || 0,
					score.tuckedCards || 0,
					score.nectar || 0
				);
			}
		});

		updateGame();

		// Get updated game with scores
		const updatedGame = db
			.prepare('SELECT id, league_id, played_at, created_by FROM games WHERE id = ?')
			.get(gameId) as { id: number; league_id: number; played_at: string; created_by: number };

		const updatedScores = db
			.prepare(
				`SELECT
					s.user_id, u.username, s.placement, s.total_score,
					s.birds, s.bonus_cards, s.end_of_round_goals, s.eggs,
					s.food_on_cards, s.tucked_cards, s.nectar
				FROM scores s
				JOIN users u ON s.user_id = u.id
				WHERE s.game_id = ?
				ORDER BY s.placement`
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
			success: true,
			game: {
				id: updatedGame.id,
				leagueId: updatedGame.league_id,
				playedAt: updatedGame.played_at,
				createdBy: updatedGame.created_by,
				scores: updatedScores.map((s) => ({
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
	} catch (error) {
		console.error('Update game error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const gameId = parseInt(params.id);
	if (isNaN(gameId)) {
		return json({ error: 'Invalid game ID' }, { status: 400 });
	}

	const db = getDb();

	// Get game to check league_id
	const game = db
		.prepare('SELECT id, league_id FROM games WHERE id = ?')
		.get(gameId) as { id: number; league_id: number } | undefined;

	if (!game) {
		return json({ error: 'Game not found' }, { status: 404 });
	}

	// Check authorization
	if (!canManageLeagueGames(userId, game.league_id, db)) {
		return json({ error: "You don't have permission to delete games in this league" }, { status: 403 });
	}

	try {
		// Delete game (scores will be cascade deleted due to FK)
		db.prepare('DELETE FROM games WHERE id = ?').run(gameId);

		return json({ success: true });
	} catch (error) {
		console.error('Delete game error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
