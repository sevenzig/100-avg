import { json } from '@sveltejs/kit';
import type { RequestHandler, Cookies } from './$types';
import { getDb } from '$lib/utils/db';
import { verifyToken, hashPassword } from '$lib/utils/auth';

interface ScoreInput {
	userId?: number;
	username?: string;
	isNew?: boolean;
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

interface ProcessedScore {
	scoreUserId: number;
	placement: number;
	totalScore: number;
	birds: number;
	bonusCards: number;
	endOfRoundGoals: number;
	eggs: number;
	foodOnCards: number;
	tuckedCards: number;
	nectar: number;
}

function getUserId(cookies: Cookies): number | null {
	const token = cookies.get('token');
	if (!token) return null;
	const decoded = verifyToken(token);
	return decoded?.userId || null;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const currentUserId = getUserId(cookies);
	if (!currentUserId) {
		return json({ success: false, error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { leagueId, playedAt, scores } = await request.json();

		// Validation
		if (!leagueId || typeof leagueId !== 'number') {
			return json({ success: false, error: 'Invalid league ID' }, { status: 400 });
		}

		if (!playedAt || !Date.parse(playedAt)) {
			return json({ success: false, error: 'Invalid date' }, { status: 400 });
		}

		if (!Array.isArray(scores) || scores.length < 1 || scores.length > 5) {
			return json(
				{ success: false, error: 'Game must have between 1 and 5 players' },
				{ status: 400 }
			);
		}

		const db = getDb();

		// Check if user is an admin
		const user = db
			.prepare('SELECT is_admin FROM users WHERE id = ?')
			.get(currentUserId) as { is_admin: number | null } | undefined;

		const isAdmin = user?.is_admin === 1;

		// If not admin, check if user is a member of this league
		if (!isAdmin) {
			const membership = db
				.prepare('SELECT user_id FROM league_players WHERE league_id = ? AND user_id = ?')
				.get(leagueId, currentUserId);

			if (!membership) {
				return json({ success: false, error: 'You are not a member of this league' }, {
					status: 403
				});
			}
		}

		// Process players: create new users if needed, get existing user IDs
		const processedScores: ProcessedScore[] = [];

		for (const score of scores as ScoreInput[]) {
			let scoreUserId: number;

			if (score.isNew && score.username) {
				// Check if username already exists
				const existingUser = db
					.prepare('SELECT id FROM users WHERE username = ?')
					.get(score.username) as { id: number } | undefined;

				if (existingUser) {
					scoreUserId = existingUser.id;
				} else {
					// Create new user with a default password
					const defaultPassword = `temp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
					const passwordHash = await hashPassword(defaultPassword);
					const email = `${score.username.toLowerCase().replace(/\s+/g, '')}@wingspan.local`;

					const userResult = db
						.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
						.run(score.username, email, passwordHash);
					scoreUserId = userResult.lastInsertRowid as number;
				}
			} else if (score.userId) {
				scoreUserId = score.userId;
			} else if (score.username) {
				// Try to find user by username
				const foundUser = db
					.prepare('SELECT id FROM users WHERE username = ?')
					.get(score.username) as { id: number } | undefined;

				if (!foundUser) {
					return json(
						{ success: false, error: `User "${score.username}" not found` },
						{ status: 400 }
					);
				}
				scoreUserId = foundUser.id;
			} else {
				return json(
					{ success: false, error: 'Each player must have a userId or username' },
					{ status: 400 }
				);
			}

			processedScores.push({
				scoreUserId,
				placement: score.placement,
				totalScore: score.totalScore,
				birds: score.birds || 0,
				bonusCards: score.bonusCards || 0,
				endOfRoundGoals: score.endOfRoundGoals || 0,
				eggs: score.eggs || 0,
				foodOnCards: score.foodOnCards || 0,
				tuckedCards: score.tuckedCards || 0,
				nectar: score.nectar || 0
			});
		}

		// Validate placements - must be unique and sequential starting from 1
		const placements = processedScores.map((s) => s.placement).sort((a, b) => a - b);
		const expectedPlacements = Array.from({ length: processedScores.length }, (_, i) => i + 1);
		if (JSON.stringify(placements) !== JSON.stringify(expectedPlacements)) {
			return json(
				{
					success: false,
					error: `Placements must be unique and sequential from 1 to ${processedScores.length}`
				},
				{ status: 400 }
			);
		}

		// Validate each score breakdown matches total
		for (const score of processedScores) {
			const sum =
				score.birds +
				score.bonusCards +
				score.endOfRoundGoals +
				score.eggs +
				score.foodOnCards +
				score.tuckedCards +
				score.nectar;

			if (sum !== score.totalScore) {
				return json(
					{ success: false, error: 'Total score does not match sum of breakdown' },
					{ status: 400 }
				);
			}
		}

		// Create game and scores in transaction
		const createGame = db.transaction(() => {
			const gameResult = db
				.prepare('INSERT INTO games (league_id, played_at, created_by) VALUES (?, ?, ?)')
				.run(leagueId, playedAt, currentUserId);
			const gameId = gameResult.lastInsertRowid as number;

			const insertScore = db.prepare(
				`INSERT INTO scores (
					game_id, user_id, placement, total_score,
					birds, bonus_cards, end_of_round_goals, eggs,
					food_on_cards, tucked_cards, nectar
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			);

			for (const score of processedScores) {
				insertScore.run(
					gameId,
					score.scoreUserId,
					score.placement,
					score.totalScore,
					score.birds,
					score.bonusCards,
					score.endOfRoundGoals,
					score.eggs,
					score.foodOnCards,
					score.tuckedCards,
					score.nectar
				);
			}

			return gameId;
		});

		const gameId = createGame();

		return json(
			{
				success: true,
				game: {
					id: gameId,
					leagueId,
					playedAt,
					createdBy: currentUserId
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Create game error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
