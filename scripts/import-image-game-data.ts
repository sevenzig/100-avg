import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Standalone database utilities (no SvelteKit dependencies)
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
}

async function importGameData() {
	console.log('🔗 Importing game data from extracted image...');

	const database = getDb();

	// Read the extracted game data
	const dataPath = join(__dirname, '..', 'extracted-game-data-image.json');
	const gameData: GameData = JSON.parse(readFileSync(dataPath, 'utf-8'));

	const players = gameData.gameData.players;
	
	// Use league ID 1 (same as existing script)
	const targetLeagueId = 1;
	
	// Get league name from database or use default
	const league = database
		.prepare('SELECT id, name, created_by FROM leagues WHERE id = ?')
		.get(targetLeagueId) as { id: number; name: string; created_by: number } | undefined;

	if (!league) {
		console.error(`❌ League ID ${targetLeagueId} does not exist. Please create a league first.`);
		process.exit(1);
	}

	const targetLeagueName = league.name;
	const creatorId = league.created_by;

	try {
		const importTransaction = database.transaction(() => {
			console.log(`🏆 Using league ID ${targetLeagueId} ("${targetLeagueName}")...`);

			// Step 1: Get or create users for each player
			console.log('👥 Ensuring players exist...');
			const userIds: Map<string, number> = new Map();

			for (const player of players) {
				// Find user by name, checking username and all platform aliases
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

			// Step 2: Ensure all players are in the league
			console.log('👥 Adding players to league...');
			const colorOptions: Array<'player_1' | 'player_2' | 'player_3'> = [
				'player_1',
				'player_2',
				'player_3'
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

			// Step 3: Create new game
			console.log('🎮 Creating new game...');
			const gameResult = database
				.prepare('INSERT INTO games (league_id, played_at, created_by) VALUES (?, ?, ?)')
				.run(targetLeagueId, new Date().toISOString(), creatorId);
			const gameId = gameResult.lastInsertRowid as number;
			console.log(`   ✓ Created new game ID ${gameId}`);

			// Step 4: Insert scores
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

		// Execute transaction
		const result = importTransaction();
		console.log('\n✅ Game data imported successfully!');
		console.log(`\n📋 Summary:`);
		console.log(`   - League ID: ${result.leagueId} ("${targetLeagueName}")`);
		console.log(`   - Game ID: ${result.gameId}`);
		console.log(`   - Players: ${players.length}`);
	} catch (error) {
		console.error('❌ Error importing game data:', error);
		throw error;
	}
}

function getOrdinalSuffix(n: number): string {
	const j = n % 10;
	const k = n % 100;
	if (j === 1 && k !== 11) return 'st';
	if (j === 2 && k !== 12) return 'nd';
	if (j === 3 && k !== 13) return 'rd';
	return 'th';
}

// Run the import function
importGameData()
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
