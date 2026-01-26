import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';

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

async function addAdminUsers() {
	console.log('👑 Adding admin users to database...\n');

	const db = getDb();

	// First, add is_admin column if it doesn't exist
	try {
		console.log('📋 Checking database schema...');
		db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
		console.log('   ✓ Added is_admin column to users table');
	} catch (error: any) {
		if (error.code === 'SQLITE_ERROR' && error.message.includes('duplicate column')) {
			console.log('   ✓ is_admin column already exists');
		} else {
			throw error;
		}
	}

	const adminUsernames = ['sevenzig', 'blabberman23', 'skycondition'];

	try {
		for (const username of adminUsernames) {
			// Check if user exists
			const user = db
				.prepare('SELECT id, username, is_admin FROM users WHERE username = ?')
				.get(username) as { id: number; username: string; is_admin: number | null } | undefined;

			if (user) {
				// Update user to be admin
				db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
				console.log(`   ✓ Set "${username}" (ID: ${user.id}) as admin`);
			} else {
				console.log(`   ⚠️  User "${username}" not found in database`);
			}
		}

		// Also check sevenzig to see if they're an admin
		const sevenzig = db
			.prepare('SELECT id, username, is_admin FROM users WHERE username = ?')
			.get('sevenzig') as { id: number; username: string; is_admin: number | null } | undefined;

		if (sevenzig) {
			console.log(`\n   ℹ️  sevenzig (ID: ${sevenzig.id}) is_admin: ${sevenzig.is_admin || 0}`);
		}

		console.log('\n✅ Admin users configured successfully!');
	} catch (error) {
		console.error('❌ Error adding admin users:', error);
		throw error;
	}
}

// Run the function
addAdminUsers()
	.then(() => {
		console.log('\n🎉 Complete!');
		if (db) {
			db.close();
		}
		process.exit(0);
	})
	.catch((error) => {
		console.error('💥 Failed:', error);
		if (db) {
			db.close();
		}
		process.exit(1);
	});
