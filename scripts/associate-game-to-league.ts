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

async function associateGameToLeague() {
	console.log('🔗 Associating game data with league "madd ladd\'s"...');

	const database = getDb();

	// Read the extracted game data
	const dataPath = join(__dirname, '..', 'extracted-game-data.json');
	const gameData: GameData = JSON.parse(readFileSync(dataPath, 'utf-8'));

	const players = gameData.gameData.players;
	const targetLeagueId = 1;
	const targetLeagueName = "madd ladd's";

	try {
		const associateTransaction = database.transaction(() => {
			// Step 1: Check if league ID 1 exists, create or update it
			console.log(`🏆 Checking league ID ${targetLeagueId}...`);
			const existingLeague = database
				.prepare('SELECT id, name, created_by FROM leagues WHERE id = ?')
				.get(targetLeagueId) as { id: number; name: string; created_by: number } | undefined;

			let leagueId: number;
			let creatorId: number;

			if (existingLeague) {
				// Update league name if it's different
				if (existingLeague.name !== targetLeagueName) {
					database.prepare('UPDATE leagues SET name = ? WHERE id = ?').run(targetLeagueName, targetLeagueId);
					console.log(`   ✓ Updated league ID ${targetLeagueId} name to "${targetLeagueName}"`);
				} else {
					console.log(`   ✓ League ID ${targetLeagueId} already exists with name "${targetLeagueName}"`);
				}
				leagueId = targetLeagueId;
				creatorId = existingLeague.created_by;
			} else {
				// Need to create league, but we need a creator user
				// First, get or create a user for the first player
				const firstPlayer = players[0];
				let user = database
					.prepare('SELECT id FROM users WHERE username = ?')
					.get(firstPlayer.playerName) as { id: number } | undefined;

				if (!user) {
					// Create a temporary user (will need password hash, but we'll use a placeholder)
					// Actually, let's just get the first user that exists
					const anyUser = database.prepare('SELECT id FROM users LIMIT 1').get() as { id: number } | undefined;
					if (!anyUser) {
						throw new Error('No users exist in database. Please run seed script first.');
					}
					creatorId = anyUser.id;
				} else {
					creatorId = user.id;
				}

				database
					.prepare('INSERT INTO leagues (id, name, created_by) VALUES (?, ?, ?)')
					.run(targetLeagueId, targetLeagueName, creatorId);
				leagueId = targetLeagueId;
				console.log(`   ✓ Created league ID ${targetLeagueId} with name "${targetLeagueName}"`);
			}

			// Step 2: Get or create users for each player
			console.log('👥 Ensuring players exist...');
			const userIds: Map<string, number> = new Map();

			for (const player of players) {
				const existingUser = database
					.prepare('SELECT id FROM users WHERE username = ?')
					.get(player.playerName) as { id: number } | undefined;

				if (existingUser) {
					userIds.set(player.playerName, existingUser.id);
					console.log(`   ✓ User "${player.playerName}" exists (ID: ${existingUser.id})`);
				} else {
					// Create user (we'll need to handle password, but for now use a placeholder)
					// Actually, let's throw an error - users should exist
					throw new Error(
						`User "${player.playerName}" does not exist. Please run seed script first to create users.`
					);
				}
			}

			// Step 3: Ensure all players are in the league
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
				insertPlayer.run(leagueId, userId, color);
				console.log(`   ✓ Added "${player.playerName}" to league as ${color}`);
				index++;
			}

			// Step 4: Check if a game already exists for this league with these players
			// If so, update it; otherwise create a new one
			console.log('🎮 Checking for existing game...');
			const existingGame = database
				.prepare(
					`
				SELECT g.id 
				FROM games g
				JOIN scores s ON s.game_id = g.id
				WHERE g.league_id = ?
				GROUP BY g.id
				HAVING COUNT(DISTINCT s.user_id) = ?
				ORDER BY g.id DESC
				LIMIT 1
			`
				)
				.get(leagueId, players.length) as { id: number } | undefined;

			let gameId: number;

			if (existingGame) {
				// Delete existing scores for this game
				database.prepare('DELETE FROM scores WHERE game_id = ?').run(existingGame.id);
				gameId = existingGame.id;
				console.log(`   ✓ Using existing game ID ${gameId}`);
			} else {
				// Create new game
				const gameResult = database
					.prepare('INSERT INTO games (league_id, played_at, created_by) VALUES (?, ?, ?)')
					.run(leagueId, new Date().toISOString(), creatorId);
				gameId = gameResult.lastInsertRowid as number;
				console.log(`   ✓ Created new game ID ${gameId}`);
			}

			// Step 5: Insert/update scores
			console.log('📊 Inserting scores...');
			const insertScore = database.prepare(
				`INSERT OR REPLACE INTO scores (
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

			return { leagueId, gameId, userIds };
		});

		// Execute transaction
		const result = associateTransaction();
		console.log('\n✅ Game data associated successfully!');
		console.log(`\n📋 Summary:`);
		console.log(`   - League ID: ${result.leagueId} ("${targetLeagueName}")`);
		console.log(`   - Game ID: ${result.gameId}`);
		console.log(`   - Players: ${players.length}`);
	} catch (error) {
		console.error('❌ Error associating game data:', error);
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

// Run the association function
associateGameToLeague()
	.then(() => {
		console.log('\n🎉 Association complete!');
		if (db) {
			db.close();
		}
		process.exit(0);
	})
	.catch((error) => {
		console.error('💥 Association failed:', error);
		if (db) {
			db.close();
		}
		process.exit(1);
	});
