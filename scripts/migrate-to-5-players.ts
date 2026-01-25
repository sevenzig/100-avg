import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { env } from 'process';

// Standalone database utilities (no SvelteKit dependencies)
const dbDir = join(process.cwd(), 'database');
try {
	mkdirSync(dbDir, { recursive: true });
} catch (e) {
	// Directory might already exist
}

const dbPath = env.DATABASE_PATH || join(dbDir, 'wingspan.db');

function migrateDatabase() {
	console.log('🔄 Migrating database to support up to 5 players...');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// SQLite doesn't support ALTER TABLE to modify CHECK constraints directly
		// We need to recreate the tables with new constraints
		// But first, let's check if we need to migrate

		// For league_players, we'll need to drop and recreate the constraint
		// Since SQLite doesn't support modifying CHECK constraints, we'll use a workaround
		// by creating a new table, copying data, dropping old, and renaming

		console.log('   ✓ Checking current schema...');

		// For scores table - update placement constraint
		// SQLite doesn't support ALTER TABLE to modify CHECK constraints
		// We'll need to recreate the table
		console.log('   📊 Migrating scores table...');
		
		// Create new scores table with updated constraint
		db.exec(`
			CREATE TABLE IF NOT EXISTS scores_new (
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

		// Copy data from old table
		db.exec(`
			INSERT INTO scores_new 
			SELECT * FROM scores;
		`);

		// Drop old table
		db.exec(`DROP TABLE scores;`);

		// Rename new table
		db.exec(`ALTER TABLE scores_new RENAME TO scores;`);

		// Recreate indexes
		db.exec(`
			CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
			CREATE INDEX IF NOT EXISTS idx_scores_game_id ON scores(game_id);
		`);

		console.log('   ✓ Scores table migrated');

		// For league_players, we'll do the same
		console.log('   👥 Migrating league_players table...');
		
		db.exec(`
			CREATE TABLE IF NOT EXISTS league_players_new (
				league_id INTEGER NOT NULL,
				user_id INTEGER NOT NULL,
				player_color TEXT CHECK(player_color IN ('player_1', 'player_2', 'player_3', 'player_4', 'player_5')),
				joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (league_id, user_id),
				FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			);
		`);

		// Copy data
		db.exec(`
			INSERT INTO league_players_new 
			SELECT * FROM league_players;
		`);

		// Drop old table
		db.exec(`DROP TABLE league_players;`);

		// Rename new table
		db.exec(`ALTER TABLE league_players_new RENAME TO league_players;`);

		// Recreate indexes
		db.exec(`
			CREATE INDEX IF NOT EXISTS idx_league_players_league ON league_players(league_id);
			CREATE INDEX IF NOT EXISTS idx_league_players_user ON league_players(user_id);
		`);

		console.log('   ✓ League players table migrated');

		console.log('\n✅ Database migration complete!');
	} catch (error) {
		console.error('❌ Migration error:', error);
		throw error;
	} finally {
		db.close();
	}
}

// Run migration
try {
	migrateDatabase();
	console.log('\n🎉 Migration complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 Migration failed:', error);
	process.exit(1);
}
