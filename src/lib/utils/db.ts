import Database from 'better-sqlite3';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { join } from 'path';
import { mkdirSync } from 'fs';

// Get database path - use absolute path for better-sqlite3
const dbDir = join(process.cwd(), 'database');
try {
	mkdirSync(dbDir, { recursive: true });
} catch (e) {
	// Directory might already exist
}

const dbPath = env.DATABASE_PATH || join(dbDir, 'wingspan.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (!db) {
		db = new Database(dbPath);
		db.pragma('foreign_keys = ON');
	}
	return db;
}

export function initDatabase() {
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
			player_color TEXT CHECK(player_color IN ('player_1', 'player_2', 'player_3', 'player_4', 'player_5')),
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
			placement INTEGER NOT NULL CHECK (placement IN (1, 2, 3, 4, 5)),
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

	// Add is_admin column if it doesn't exist (for existing databases)
	try {
		database.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
	} catch (error: any) {
		// Column already exists, ignore error
		if (!error.message.includes('duplicate column')) {
			throw error;
		}
	}
}
