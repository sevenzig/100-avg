import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(process.cwd(), 'database');
try {
	mkdirSync(dbDir, { recursive: true });
} catch (e) {
	// Directory might already exist
}

const dbPath = process.env.DATABASE_PATH || join(dbDir, 'wingspan.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
	if (!db) {
		db = new Database(dbPath);
		db.pragma('foreign_keys = ON');
	}
	return db;
}

interface PlayerData {
	playerName: string;
	placement: number;
	totalScore: number;
	scoringBreakdown: {
		birds: number;
		bonusCards: number;
		endOfRoundGoals: number;
		eggs: number;
		foodOnCards: number;
		tuckedCards: number;
		nectar: number;
	};
}

interface GameData {
	gameData: {
		players: PlayerData[];
	};
	metadata?: {
		extractedAt?: string;
		source?: string;
		notes?: string;
	};
}

interface MultiGameData {
	games: GameData[];
}

async function importGames() {
	console.log('🔗 Importing two screenshot games (Jan 2026)...\n');

	const database = getDb();

	const dataPath = join(__dirname, '..', 'extracted-game-data-screenshot-jan.json');
	const multiGameData: MultiGameData = JSON.parse(readFileSync(dataPath, 'utf-8'));

	if (!multiGameData.games || !Array.isArray(multiGameData.games)) {
		console.error('❌ Invalid data structure: games array missing');
		process.exit(1);
	}

	const targetLeagueId = parseInt(process.env.LEAGUE_ID || '1', 10);

	const league = database
		.prepare('SELECT id, name, created_by FROM leagues WHERE id = ?')
		.get(targetLeagueId) as { id: number; name: string; created_by: number } | undefined;

	if (!league) {
		console.error(`❌ League ID ${targetLeagueId} does not exist. Set LEAGUE_ID or create a league.`);
		process.exit(1);
	}

	const targetLeagueName = league.name;
	const creatorId = league.created_by;

	for (let gameIndex = 0; gameIndex < multiGameData.games.length; gameIndex++) {
		const gameData = multiGameData.games[gameIndex];
		const players = gameData.gameData.players;

		console.log(`\n${'='.repeat(60)}`);
		console.log(`🎮 Processing Game ${gameIndex + 1} of ${multiGameData.games.length}`);
		console.log(`${'='.repeat(60)}`);

		try {
			const importTransaction = database.transaction(() => {
				console.log(`🏆 Using league ID ${targetLeagueId} ("${targetLeagueName}")...`);

				console.log('👥 Ensuring players exist...');
				const userIds: Map<string, number> = new Map();

				for (const player of players) {
					const existingUser = database
						.prepare(
							`
							SELECT id, username
							FROM users
							WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
							   OR LOWER(TRIM(steam_alias)) = LOWER(TRIM(?))
							   OR LOWER(TRIM(android_alias)) = LOWER(TRIM(?))
							   OR LOWER(TRIM(iphone_alias)) = LOWER(TRIM(?))
							LIMIT 1
						`
						)
						.get(
							player.playerName,
							player.playerName,
							player.playerName,
							player.playerName
						) as { id: number; username: string } | undefined;

					if (existingUser) {
						userIds.set(player.playerName, existingUser.id);
						const matchedName =
							existingUser.username.toLowerCase() === player.playerName.toLowerCase()
								? existingUser.username
								: `${existingUser.username} (matched via alias)`;
						console.log(
							`   ✓ User "${player.playerName}" found (ID: ${existingUser.id}, username: "${matchedName}")`
						);
					} else {
						throw new Error(
							`User "${player.playerName}" does not exist. Please create users first.`
						);
					}
				}

				console.log('👥 Adding players to league...');
				const colorOptions: Array<'player_1' | 'player_2' | 'player_3' | 'player_4' | 'player_5'> = [
					'player_1',
					'player_2',
					'player_3',
					'player_4',
					'player_5'
				];
				const insertPlayer = database.prepare(
					'INSERT OR IGNORE INTO league_players (league_id, user_id, player_color) VALUES (?, ?, ?)'
				);

				let index = 0;
				for (const player of players) {
					const userId = userIds.get(player.playerName)!;
					const color = colorOptions[index % colorOptions.length];
					insertPlayer.run(targetLeagueId, userId, color);
					console.log(`   ✓ Added "${player.playerName}" to league as ${color}`);
					index++;
				}

				console.log('🎮 Creating new game...');
				const gameResult = database
					.prepare('INSERT INTO games (league_id, played_at, created_by) VALUES (?, ?, ?)')
					.run(targetLeagueId, new Date().toISOString(), creatorId);
				const gameId = gameResult.lastInsertRowid as number;
				console.log(`   ✓ Created new game ID ${gameId}`);

				console.log('📊 Inserting scores...');
				const insertScore = database.prepare(
					`INSERT INTO scores (
					game_id, user_id, placement, total_score,
					birds, bonus_cards, end_of_round_goals, eggs,
					food_on_cards, tucked_cards, nectar
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				);

				for (const player of players) {
					const userId = userIds.get(player.playerName)!;
					const breakdown = player.scoringBreakdown;

					const sum =
						breakdown.birds +
						breakdown.bonusCards +
						breakdown.endOfRoundGoals +
						breakdown.eggs +
						breakdown.foodOnCards +
						breakdown.tuckedCards +
						breakdown.nectar;

					if (sum !== player.totalScore) {
						console.warn(
							`   ⚠️  Warning: Score breakdown for "${player.playerName}" doesn't match total (${sum} vs ${player.totalScore})`
						);
					}

					insertScore.run(
						gameId,
						userId,
						player.placement,
						player.totalScore,
						breakdown.birds,
						breakdown.bonusCards,
						breakdown.endOfRoundGoals,
						breakdown.eggs,
						breakdown.foodOnCards,
						breakdown.tuckedCards,
						breakdown.nectar
					);

					console.log(
						`   ✓ Inserted score for "${player.playerName}": ${player.totalScore} points (${player.placement}${getOrdinalSuffix(player.placement)} place)`
					);
				}

				return { leagueId: targetLeagueId, gameId, userIds };
			});

			const result = importTransaction();
			console.log(`\n✅ Game ${gameIndex + 1} imported successfully!`);
			console.log(`   - Game ID: ${result.gameId}`);
			console.log(`   - Players: ${players.length}`);
		} catch (error) {
			console.error(`❌ Error importing game ${gameIndex + 1}:`, error);
			throw error;
		}
	}

	console.log(`\n${'='.repeat(60)}`);
	console.log('🎉 All games imported successfully!');
	console.log(`${'='.repeat(60)}`);
	console.log(`\n📋 Summary:`);
	console.log(`   - League ID: ${targetLeagueId} ("${targetLeagueName}")`);
	console.log(`   - Total games imported: ${multiGameData.games.length}`);
}

function getOrdinalSuffix(n: number): string {
	const j = n % 10;
	const k = n % 100;
	if (j === 1 && k !== 11) return 'st';
	if (j === 2 && k !== 12) return 'nd';
	if (j === 3 && k !== 13) return 'rd';
	return 'th';
}

importGames()
	.then(() => {
		console.log('\n🎉 Import complete!');
		if (db) {
			db.close();
		}
		process.exit(0);
	})
	.catch((error) => {
		console.error('💥 Import failed:', error);
		if (db) {
			db.close();
		}
		process.exit(1);
	});
