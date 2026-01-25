import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
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

function initDatabase() {
	const database = getDb();

	// Users table
	database.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`);

	// Leagues table
	database.exec(`
		CREATE TABLE IF NOT EXISTS leagues (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			created_by INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
		);
	`);

	// League players junction table
	database.exec(`
		CREATE TABLE IF NOT EXISTS league_players (
			league_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			player_color TEXT CHECK(player_color IN ('player_1', 'player_2', 'player_3')),
			joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (league_id, user_id),
			FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);
	`);

	// Games table
	database.exec(`
		CREATE TABLE IF NOT EXISTS games (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			league_id INTEGER NOT NULL,
			played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			created_by INTEGER NOT NULL,
			FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
			FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
		);
	`);

	// Scores table
	database.exec(`
		CREATE TABLE IF NOT EXISTS scores (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			game_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			placement INTEGER NOT NULL CHECK (placement IN (1, 2, 3)),
			total_score INTEGER NOT NULL,
			birds INTEGER DEFAULT 0,
			bonus_cards INTEGER DEFAULT 0,
			end_of_round_goals INTEGER DEFAULT 0,
			eggs INTEGER DEFAULT 0,
			food_on_cards INTEGER DEFAULT 0,
			tucked_cards INTEGER DEFAULT 0,
			nectar INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			UNIQUE(game_id, user_id)
		);
	`);

	// Create indexes
	database.exec(`
		CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
		CREATE INDEX IF NOT EXISTS idx_scores_game_id ON scores(game_id);
		CREATE INDEX IF NOT EXISTS idx_games_league_id ON games(league_id);
		CREATE INDEX IF NOT EXISTS idx_league_players_league ON league_players(league_id);
		CREATE INDEX IF NOT EXISTS idx_league_players_user ON league_players(user_id);
		CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
		CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	`);
}

async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
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

async function seedDatabase() {
	console.log('🌱 Starting database seed...');

	// Initialize database
	initDatabase();
	const db = getDb();

	// Read the extracted game data
	const dataPath = join(__dirname, '..', 'extracted-game-data.json');
	const gameData: GameData = JSON.parse(readFileSync(dataPath, 'utf-8'));

	const players = gameData.gameData.players;

	try {
		// Hash password before transaction (can't use await in transaction)
		console.log('🔐 Preparing password hash...');
		const defaultPassword = 'password123'; // Default password for seeded users
		const passwordHash = await hashPassword(defaultPassword);

		// Start transaction for all operations
		const seedTransaction = db.transaction(() => {
			// Step 1: Create users for each player
			console.log('👥 Creating users...');
			const userIds: Map<string, number> = new Map();

			for (const player of players) {
				// Check if user already exists
				const existingUser = db
					.prepare('SELECT id FROM users WHERE username = ?')
					.get(player.playerName) as { id: number } | undefined;

				if (existingUser) {
					console.log(`   ✓ User "${player.playerName}" already exists (ID: ${existingUser.id})`);
					userIds.set(player.playerName, existingUser.id);
				} else {
					// Create user with email based on username
					const email = `${player.playerName.toLowerCase().replace(/\s+/g, '')}@example.com`;
					const result = db
						.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
						.run(player.playerName, email, passwordHash);
					const userId = result.lastInsertRowid as number;
					userIds.set(player.playerName, userId);
					console.log(`   ✓ Created user "${player.playerName}" (ID: ${userId})`);
				}
			}

			// Step 2: Create a league
			console.log('🏆 Creating league...');
			const firstUserId = Array.from(userIds.values())[0];
			const leagueResult = db
				.prepare('INSERT INTO leagues (name, created_by) VALUES (?, ?)')
				.run('Wingspan League', firstUserId);
			const leagueId = leagueResult.lastInsertRowid as number;
			console.log(`   ✓ Created league "Wingspan League" (ID: ${leagueId})`);

			// Step 3: Add players to league
			console.log('👥 Adding players to league...');
			const colorOptions: Array<'player_1' | 'player_2' | 'player_3'> = [
				'player_1',
				'player_2',
				'player_3'
			];
			const insertPlayer = db.prepare(
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

			// Step 4: Create game
			console.log('🎮 Creating game...');
			const gameResult = db
				.prepare('INSERT INTO games (league_id, played_at, created_by) VALUES (?, ?, ?)')
				.run(leagueId, new Date().toISOString(), firstUserId);
			const gameId = gameResult.lastInsertRowid as number;
			console.log(`   ✓ Created game (ID: ${gameId})`);

			// Step 5: Insert scores
			console.log('📊 Inserting scores...');
			const insertScore = db.prepare(
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

			return { leagueId, gameId, userIds };
		});

		// Execute transaction
		const result = seedTransaction();
		console.log('\n✅ Database seeded successfully!');
		console.log(`\n📋 Summary:`);
		console.log(`   - League ID: ${result.leagueId}`);
		console.log(`   - Game ID: ${result.gameId}`);
		console.log(`   - Players: ${players.length}`);
		console.log(`\n💡 Default password for all seeded users: "password123"`);
	} catch (error) {
		console.error('❌ Error seeding database:', error);
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

// Run the seed function
seedDatabase()
	.then(() => {
		console.log('\n🎉 Seed complete!');
		if (db) {
			db.close();
		}
		process.exit(0);
	})
	.catch((error) => {
		console.error('💥 Seed failed:', error);
		if (db) {
			db.close();
		}
		process.exit(1);
	});
