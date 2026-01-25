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

function fixLeague1() {
	console.log('🔧 Fixing League 1 games and W/L records...\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// Check current state
		console.log('📊 Current Games:');
		const allGames = db
			.prepare('SELECT id, league_id, played_at FROM games ORDER BY id')
			.all() as Array<{ id: number; league_id: number; played_at: string }>;

		allGames.forEach((game) => {
			const scoreCount = db
				.prepare('SELECT COUNT(*) as count FROM scores WHERE game_id = ?')
				.get(game.id) as { count: number };
			console.log(`   Game ${game.id}: League ${game.league_id}, ${scoreCount.count} scores`);
		});

		// Find games in league 1
		const league1Games = db
			.prepare('SELECT id FROM games WHERE league_id = 1 ORDER BY id')
			.all() as Array<{ id: number }>;

		console.log(`\n   League 1 has ${league1Games.length} game(s)`);

		// If more than 1 game in league 1, keep only the first one
		if (league1Games.length > 1) {
			console.log('\n🗑️  Removing duplicate games from League 1...');
			const cleanupTransaction = db.transaction(() => {
				// Keep the first game, delete the rest
				for (let i = 1; i < league1Games.length; i++) {
					const gameId = league1Games[i].id;
					console.log(`   Deleting game ${gameId}...`);
					
					// Delete scores first
					db.prepare('DELETE FROM scores WHERE game_id = ?').run(gameId);
					
					// Delete game
					db.prepare('DELETE FROM games WHERE id = ?').run(gameId);
				}
			});

			cleanupTransaction();
			console.log('   ✅ Cleanup complete');
		}

		// Also remove game from league 2 if it's a duplicate
		const league2Games = db
			.prepare('SELECT id FROM games WHERE league_id = 2 ORDER BY id')
			.all() as Array<{ id: number }>;

		if (league2Games.length > 0) {
			console.log(`\n⚠️  Found ${league2Games.length} game(s) in League 2`);
			console.log('   Removing games from League 2 (keeping only League 1)...');
			
			const removeLeague2Transaction = db.transaction(() => {
				for (const game of league2Games) {
					console.log(`   Deleting game ${game.id} from League 2...`);
					db.prepare('DELETE FROM scores WHERE game_id = ?').run(game.id);
					db.prepare('DELETE FROM games WHERE id = ?').run(game.id);
				}
			});

			removeLeague2Transaction();
		}

		// Verify final state
		console.log('\n📊 Final State:');
		const finalGames = db
			.prepare('SELECT id, league_id, played_at FROM games ORDER BY league_id, id')
			.all() as Array<{ id: number; league_id: number; played_at: string }>;

		if (finalGames.length === 0) {
			console.log('   ⚠️  No games found!');
		} else {
			finalGames.forEach((game) => {
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

				console.log(`\n   Game ${game.id} (League ${game.league_id}):`);
				scores.forEach((score) => {
					console.log(`      ${score.username}: ${score.placement}${getOrdinalSuffix(score.placement)} place, ${score.total_score} points`);
				});
			});
		}

		// Verify W/L records for league 1
		console.log('\n📊 W/L Records for League 1:');
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

		if (stats.length === 0) {
			console.log('   ⚠️  No stats found for League 1');
		} else {
			stats.forEach((stat) => {
				console.log(
					`   ${stat.username}: ${stat.wins}W / ${stat.losses}L (${stat.total_games} game${stat.total_games !== 1 ? 's' : ''})`
				);
			});
		}
	} catch (error) {
		console.error('❌ Error fixing League 1:', error);
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

// Run fix
try {
	fixLeague1();
	console.log('\n✅ Fix complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 Fix failed:', error);
	process.exit(1);
}
