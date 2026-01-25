import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { mkdirSync } from 'fs';
import { join } from 'path';

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

async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

interface UserToAdd {
	username: string;
	password: string;
	email: string;
}

async function addUsers() {
	console.log('👥 Adding users to database...');

	const db = getDb();

	const usersToAdd: UserToAdd[] = [
		{
			username: 'blabberman23',
			password: 'aaaaaaa',
			email: 'blabberman23@example.com'
		},
		{
			username: 'skycondition',
			password: 'aaaaaaa',
			email: 'skycondition@example.com'
		}
	];

	try {
		// Hash passwords before transaction (can't use await in transaction)
		console.log('🔐 Hashing passwords...');
		const passwordHashes = await Promise.all(
			usersToAdd.map((user) => hashPassword(user.password))
		);

		// Process each user
		for (let i = 0; i < usersToAdd.length; i++) {
			const user = usersToAdd[i];
			const passwordHash = passwordHashes[i];

			// Check if user already exists (case-insensitive)
			const existingUser = db
				.prepare('SELECT id, username, email FROM users WHERE username = ? COLLATE NOCASE')
				.get(user.username) as { id: number; username: string; email: string } | undefined;

			if (existingUser) {
				// User exists - update username (if case differs) and password
				if (existingUser.username !== user.username) {
					// Update username to match requested casing
					db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(
						user.username,
						passwordHash,
						existingUser.id
					);
					console.log(
						`   ✓ Updated user "${existingUser.username}" → "${user.username}" and password (ID: ${existingUser.id})`
					);
				} else {
					// Just update password
					db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
						passwordHash,
						existingUser.id
					);
					console.log(
						`   ✓ Updated password for existing user "${user.username}" (ID: ${existingUser.id})`
					);
				}
				continue;
			}

			// Check if email already exists
			const existingEmail = db
				.prepare('SELECT id, username FROM users WHERE email = ?')
				.get(user.email) as { id: number; username: string } | undefined;

			if (existingEmail) {
				// Email exists but username is different - update that user's password
				db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
					passwordHash,
					existingEmail.id
				);
				console.log(
					`   ✓ Updated password for user "${existingEmail.username}" (ID: ${existingEmail.id}) with email "${user.email}"`
				);
				continue;
			}

			// Insert new user
			const result = db
				.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
				.run(user.username, user.email, passwordHash);

			const userId = result.lastInsertRowid as number;
			console.log(`   ✓ Created user "${user.username}" (ID: ${userId}, email: ${user.email})`);
		}

		console.log('\n✅ Users added successfully!');
	} catch (error) {
		console.error('❌ Error adding users:', error);
		throw error;
	}
}

// Run the function
addUsers()
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
