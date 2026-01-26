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

function removeLeague2() {
	console.log('🗑️  Removing League 2 (wingspan league)...\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// First, check what League 2 contains
		console.log('📊 Checking League 2 contents...\n');

		const league2 = db
			.prepare('SELECT id, name, created_by, created_at FROM leagues WHERE id = 2')
			.get() as { id: number; name: string; created_by: number; created_at: string } | undefined;

		if (!league2) {
			console.log('   ℹ️  League 2 does not exist. Nothing to remove.');
			return;
		}

		console.log(`   League ID: ${league2.id}`);
		console.log(`   Name: "${league2.name}"`);
		console.log(`   Created by user ID: ${league2.created_by}`);
		console.log(`   Created at: ${league2.created_at}\n`);

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
			WHERE lp.league_id = 2
			ORDER BY lp.joined_at
		`
			)
			.all() as Array<{
			id: number;
			username: string;
			player_color: string;
			joined_at: string;
		}>;

		console.log(`   Members (${members.length}):`);
		members.forEach((member) => {
			console.log(`      - ${member.username} (ID: ${member.id}, ${member.player_color})`);
		});

		// Get all games
		const games = db
			.prepare('SELECT id, played_at, created_by FROM games WHERE league_id = 2 ORDER BY id')
			.all() as Array<{ id: number; played_at: string; created_by: number }>;

		console.log(`\n   Games (${games.length}):`);
		if (games.length > 0) {
			games.forEach((game) => {
				const scores = db
					.prepare(
						`
					SELECT 
						u.username,
						s.placement,
						s.total_score
					FROM scores s
					JOIN users u ON s.user_id = u.id
					WHERE s.game_id = ?
					ORDER BY s.placement
				`
					)
					.all(game.id) as Array<{ username: string; placement: number; total_score: number }>;

				console.log(`      Game ${game.id} (${game.played_at}):`);
				scores.forEach((score) => {
					console.log(
						`         ${score.username}: ${score.placement}${getOrdinalSuffix(score.placement)} place, ${score.total_score} points`
					);
				});
			});
		} else {
			console.log('      (no games)');
		}

		// Confirm deletion
		console.log('\n⚠️  This will delete:');
		console.log(`   - League 2 ("${league2.name}")`);
		console.log(`   - ${members.length} player membership(s)`);
		console.log(`   - ${games.length} game(s)`);
		console.log(`   - All scores for those games\n`);

		// Delete League 2 (CASCADE will handle related data)
		console.log('🗑️  Deleting League 2...');
		const deleteTransaction = db.transaction(() => {
			// Delete the league - CASCADE will automatically delete:
			// - league_players entries
			// - games
			// - scores
			const result = db.prepare('DELETE FROM leagues WHERE id = 2').run();
			console.log(`   ✅ Deleted ${result.changes} league(s)`);
		});

		deleteTransaction();

		// Verify deletion
		console.log('\n📊 Verifying deletion...');
		const remainingLeague2 = db
			.prepare('SELECT id FROM leagues WHERE id = 2')
			.get() as { id: number } | undefined;

		if (remainingLeague2) {
			console.log('   ❌ ERROR: League 2 still exists!');
			throw new Error('Failed to delete League 2');
		}

		const remainingGames = db
			.prepare('SELECT COUNT(*) as count FROM games WHERE league_id = 2')
			.get() as { count: number };

		if (remainingGames.count > 0) {
			console.log(`   ⚠️  WARNING: ${remainingGames.count} game(s) still exist for League 2`);
		}

		const remainingMembers = db
			.prepare('SELECT COUNT(*) as count FROM league_players WHERE league_id = 2')
			.get() as { count: number };

		if (remainingMembers.count > 0) {
			console.log(`   ⚠️  WARNING: ${remainingMembers.count} player membership(s) still exist for League 2`);
		}

		console.log('   ✅ League 2 and all related data have been removed');

		// Show remaining leagues
		console.log('\n📊 Remaining leagues:');
		const remainingLeagues = db
			.prepare('SELECT id, name FROM leagues ORDER BY id')
			.all() as Array<{ id: number; name: string }>;

		if (remainingLeagues.length === 0) {
			console.log('   (no leagues remaining)');
		} else {
			remainingLeagues.forEach((league) => {
				console.log(`   - League ${league.id}: "${league.name}"`);
			});
		}
	} catch (error) {
		console.error('❌ Error removing League 2:', error);
		throw error;
	} finally {
		db.close();
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

// Run removal
try {
	removeLeague2();
	console.log('\n✅ League 2 removal complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 League 2 removal failed:', error);
	process.exit(1);
}
