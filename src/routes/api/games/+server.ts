import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { verifyToken, hashPassword } from '$lib/utils/auth';

function getUserId(cookies: any): number | null {
	const token = cookies.get('token');
	if (!token) return null;
	const decoded = verifyToken(token);
	return decoded?.userId || null;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
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

		// Validate each score
		for (const score of processedScores) {
			const sum =
				(score.birds || 0) +
				(score.bonusCards || 0) +
				(score.endOfRoundGoals || 0) +
				(score.eggs || 0) +
				(score.foodOnCards || 0) +
				(score.tuckedCards || 0) +
				(score.nectar || 0);

			if (sum !== score.totalScore) {
				return json(
					{ success: false, error: 'Total score does not match sum of breakdown' },
					{ status: 400 }
				);
			}
		}

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
				return json({ success: false, error: 'You are not a member of this league' }, {
					status: 403
				});
			}
		}

		// Process players: create new users if needed, get existing user IDs
		const processedScores: Array<{
			userId: number;
			placement: number;
			totalScore: number;
			birds: number;
			bonusCards: number;
			endOfRoundGoals: number;
			eggs: number;
			foodOnCards: number;
			tuckedCards: number;
			nectar: number;
		}> = [];

		for (const score of scores) {
			let userId: number;

			if (score.isNew && score.username) {
				// Create new user
				// Check if username already exists
				const existingUser = db
					.prepare('SELECT id FROM users WHERE username = ?')
					.get(score.username) as { id: number } | undefined;

				if (existingUser) {
					userId = existingUser.id;
				} else {
					// Create new user with a default password (users can change it later)
					// Generate a random password hash
					const defaultPassword = `temp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
					const passwordHash = await hashPassword(defaultPassword);
					const email = `${score.username.toLowerCase().replace(/\s+/g, '')}@wingspan.local`;

					const userResult = db
						.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
						.run(score.username, email, passwordHash);
					userId = userResult.lastInsertRowid as number;
				}
			} else if (score.userId) {
				userId = score.userId;
			} else if (score.username) {
				// Try to find user by username
				const user = db
					.prepare('SELECT id FROM users WHERE username = ?')
					.get(score.username) as { id: number } | undefined;

				if (!user) {
					return json(
						{ success: false, error: `User "${score.username}" not found` },
						{ status: 400 }
					);
				}
				userId = user.id;
			} else {
				return json(
					{ success: false, error: 'Each player must have a userId or username' },
					{ status: 400 }
				);
			}

			processedScores.push({
				userId,
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

		// Create game and scores in transaction
		const createGame = db.transaction(() => {
			// Insert game
			const gameResult = db
				.prepare('INSERT INTO games (league_id, played_at, created_by) VALUES (?, ?, ?)')
				.run(leagueId, playedAt, userId);
			const gameId = gameResult.lastInsertRowid as number;

			// Insert scores
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
					score.userId,
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
					createdBy: userId
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Create game error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
