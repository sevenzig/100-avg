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

function checkLeagues() {
	console.log('🏆 Checking leagues and memberships...\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// Get all leagues
		const leagues = db
			.prepare('SELECT id, name, created_by FROM leagues ORDER BY id')
			.all() as Array<{ id: number; name: string; created_by: number }>;

		console.log(`Found ${leagues.length} league(s):\n`);

		for (const league of leagues) {
			console.log(`League ID: ${league.id} - "${league.name}"`);
			console.log(`Created by user ID: ${league.created_by}`);

			// Get creator username
			const creator = db
				.prepare('SELECT username FROM users WHERE id = ?')
				.get(league.created_by) as { username: string } | undefined;
			console.log(`Creator: ${creator?.username || 'Unknown'}`);

			// Get all members
			const members = db
				.prepare(
					`
				SELECT 
					u.id,
					u.username,
					lp.player_color,
					lp.joined_at
				FROM league_players lp
				JOIN users u ON lp.user_id = u.id
				WHERE lp.league_id = ?
				ORDER BY lp.joined_at
			`
				)
				.all(league.id) as Array<{
				id: number;
				username: string;
				player_color: string;
				joined_at: string;
			}>;

			console.log(`Members (${members.length}):`);
			members.forEach((member) => {
				console.log(`   - ${member.username} (ID: ${member.id}, ${member.player_color})`);
			});
			console.log('');
		}

		// Check sevenzig specifically
		console.log('\n👤 Checking sevenzig memberships:');
		const sevenzig = db
			.prepare('SELECT id FROM users WHERE username = ?')
			.get('sevenzig') as { id: number } | undefined;

		if (sevenzig) {
			const sevenzigLeagues = db
				.prepare(
					`
				SELECT 
					l.id,
					l.name,
					lp.player_color
				FROM league_players lp
				JOIN leagues l ON lp.league_id = l.id
				WHERE lp.user_id = ?
			`
				)
				.all(sevenzig.id) as Array<{ id: number; name: string; player_color: string }>;

			console.log(`   sevenzig (ID: ${sevenzig.id}) is a member of ${sevenzigLeagues.length} league(s):`);
			sevenzigLeagues.forEach((league) => {
				console.log(`   - League "${league.name}" (ID: ${league.id}, ${league.player_color})`);
			});
		} else {
			console.log('   sevenzig not found in database');
		}
	} catch (error) {
		console.error('❌ Error checking leagues:', error);
		throw error;
	} finally {
		db.close();
	}
}

checkLeagues();
process.exit(0);
