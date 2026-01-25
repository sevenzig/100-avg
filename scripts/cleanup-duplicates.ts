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

function cleanupDuplicates() {
	console.log('🧹 Cleaning up duplicate games...\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// Find duplicate games (same league, same players, same scores)
		console.log('🔍 Finding duplicate games...');
		
		const duplicates = db
			.prepare(
				`
			SELECT 
				g1.id as game1_id,
				g2.id as game2_id,
				g1.league_id,
				g1.played_at as game1_date,
				g2.played_at as game2_date
			FROM games g1
			JOIN games g2 ON g1.league_id = g2.league_id 
				AND g1.id < g2.id
			WHERE (
				SELECT COUNT(DISTINCT s1.user_id)
				FROM scores s1
				WHERE s1.game_id = g1.id
			) = (
				SELECT COUNT(DISTINCT s2.user_id)
				FROM scores s2
				WHERE s2.game_id = g2.id
			)
			AND (
				SELECT COUNT(*)
				FROM scores s1
				JOIN scores s2 ON s1.user_id = s2.user_id 
					AND s1.placement = s2.placement
					AND s1.total_score = s2.total_score
				WHERE s1.game_id = g1.id AND s2.game_id = g2.id
			) = (
				SELECT COUNT(DISTINCT user_id) FROM scores WHERE game_id = g1.id
			)
		`
			)
			.all() as Array<{
			game1_id: number;
			game2_id: number;
			league_id: number;
			game1_date: string;
			game2_date: string;
		}>;

		if (duplicates.length === 0) {
			console.log('   ✓ No duplicate games found');
		} else {
			console.log(`   ⚠️  Found ${duplicates.length} duplicate game pair(s):`);
			duplicates.forEach((dup) => {
				console.log(
					`      Games ${dup.game1_id} and ${dup.game2_id} (League ${dup.league_id})`
				);
			});

			// Delete the newer duplicate games (keep the older one)
			const cleanupTransaction = db.transaction(() => {
				for (const dup of duplicates) {
					console.log(`\n   🗑️  Deleting game ${dup.game2_id} (keeping ${dup.game1_id})...`);
					
					// Delete scores first (foreign key constraint)
					const scoresDeleted = db.prepare('DELETE FROM scores WHERE game_id = ?').run(dup.game2_id);
					console.log(`      Deleted ${scoresDeleted.changes} scores`);
					
					// Delete game
					const gameDeleted = db.prepare('DELETE FROM games WHERE id = ?').run(dup.game2_id);
					console.log(`      Deleted game ${dup.game2_id}`);
				}
			});

			cleanupTransaction();
			console.log('\n   ✅ Duplicate games cleaned up');
		}

		// Show final state
		console.log('\n📊 Final Game Count:');
		const finalGames = db
			.prepare('SELECT id, league_id, played_at FROM games ORDER BY league_id, id')
			.all() as Array<{ id: number; league_id: number; played_at: string }>;

		finalGames.forEach((game) => {
			const scoreCount = db
				.prepare('SELECT COUNT(*) as count FROM scores WHERE game_id = ?')
				.get(game.id) as { count: number };
			console.log(`   Game ${game.id}: League ${game.league_id}, ${scoreCount.count} scores`);
		});

		// Verify W/L records for league 1
		console.log('\n📊 W/L Records for League 1 (after cleanup):');
		const stats = db
			.prepare(
				`
			SELECT 
				u.id as user_id,
				u.username,
				COUNT(DISTINCT g.id) as total_games,
				SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) as wins,
				SUM(CASE WHEN s.placement > 1 THEN 1 ELSE 0 END) as losses
			FROM users u
			JOIN scores s ON s.user_id = u.id
			JOIN games g ON s.game_id = g.id
			WHERE g.league_id = 1
			GROUP BY u.id, u.username
			ORDER BY wins DESC, losses ASC
		`
			)
			.all() as Array<{ user_id: number; username: string; total_games: number; wins: number; losses: number }>;

		stats.forEach((stat) => {
			console.log(
				`   ${stat.username}: ${stat.wins}W / ${stat.losses}L (${stat.total_games} games)`
			);
		});
	} catch (error) {
		console.error('❌ Error cleaning up duplicates:', error);
		throw error;
	} finally {
		db.close();
	}
}

// Run cleanup
try {
	cleanupDuplicates();
	console.log('\n✅ Cleanup complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 Cleanup failed:', error);
	process.exit(1);
}
