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

function migrateProfileColumns() {
	console.log('🔄 Migrating database to add profile columns (display_name, platforms)...');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// Check if columns already exist
		const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{
			cid: number;
			name: string;
			type: string;
			notnull: number;
			dflt_value: any;
			pk: number;
		}>;

		const columnNames = tableInfo.map((col) => col.name);
		let changesMade = false;

		// Add display_name column if it doesn't exist
		if (!columnNames.includes('display_name')) {
			console.log('   ➕ Adding display_name column...');
			db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
			changesMade = true;
			console.log('   ✓ display_name column added');
		} else {
			console.log('   ✓ display_name column already exists');
		}

		// Add platforms column if it doesn't exist
		if (!columnNames.includes('platforms')) {
			console.log('   ➕ Adding platforms column...');
			db.exec("ALTER TABLE users ADD COLUMN platforms TEXT DEFAULT '[]'");
			// Update existing users to have empty platforms array
			db.exec("UPDATE users SET platforms = '[]' WHERE platforms IS NULL");
			changesMade = true;
			console.log('   ✓ platforms column added');
		} else {
			console.log('   ✓ platforms column already exists');
			// Ensure existing users have empty platforms array if NULL
			db.exec("UPDATE users SET platforms = '[]' WHERE platforms IS NULL");
		}

		if (!changesMade) {
			console.log('\n✅ Database already has all profile columns. No migration needed.');
		} else {
			console.log('\n✅ Profile columns migration complete!');
		}

		// Verify the migration
		const updatedTableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{
			cid: number;
			name: string;
			type: string;
		}>;
		const updatedColumnNames = updatedTableInfo.map((col) => col.name);
		
		console.log('\n📋 Current users table columns:');
		updatedTableInfo.forEach((col) => {
			console.log(`   - ${col.name} (${col.type})`);
		});

		if (updatedColumnNames.includes('display_name') && updatedColumnNames.includes('platforms')) {
			console.log('\n✅ Migration verified: All profile columns are present!');
		} else {
			console.log('\n⚠️  Warning: Some columns may be missing. Please check the output above.');
		}
	} catch (error) {
		console.error('❌ Migration error:', error);
		throw error;
	} finally {
		db.close();
	}
}

// Run migration
try {
	migrateProfileColumns();
	console.log('\n🎉 Migration complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 Migration failed:', error);
	process.exit(1);
}
