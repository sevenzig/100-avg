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

function listUsers() {
	console.log('👥 Listing all users in database...\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		const users = db
			.prepare('SELECT id, username, email, created_at, is_admin FROM users ORDER BY id')
			.all() as Array<{ id: number; username: string; email: string; created_at: string; is_admin: number | null }>;

		if (users.length === 0) {
			console.log('   No users found in database.');
		} else {
			console.log(`   Found ${users.length} user(s):\n`);
			users.forEach((user) => {
				const isAdmin = user.is_admin === 1 ? '👑 Admin' : 'User';
				console.log(`   ID: ${user.id}`);
				console.log(`   Username: ${user.username}`);
				console.log(`   Email: ${user.email}`);
				console.log(`   Role: ${isAdmin}`);
				console.log(`   Created: ${user.created_at}`);
				console.log('');
			});
		}
	} catch (error) {
		console.error('❌ Error listing users:', error);
		throw error;
	} finally {
		db.close();
	}
}

listUsers();
process.exit(0);
