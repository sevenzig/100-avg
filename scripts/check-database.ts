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

function checkDatabase() {
	console.log('🔍 Checking database for duplicate games and W/L records...\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// Check all games
		console.log('📊 All Games:');
		const games = db
			.prepare('SELECT id, league_id, played_at, created_by FROM games ORDER BY id')
			.all() as Array<{ id: number; league_id: number; played_at: string; created_by: number }>;

		games.forEach((game) => {
			console.log(`   Game ID: ${game.id}, League: ${game.league_id}, Date: ${game.played_at}`);
		});

		console.log(`\n   Total games: ${games.length}\n`);

		// Check scores for each game
		console.log('📈 Scores by Game:');
		for (const game of games) {
			const scores = db
				.prepare(
					`
				SELECT 
					s.id,
					s.user_id,
					u.username,
					s.placement,
					s.total_score
				FROM scores s
				JOIN users u ON s.user_id = u.id
				WHERE s.game_id = ?
				ORDER BY s.placement
			`
				)
				.all(game.id) as Array<{
				id: number;
				user_id: number;
				username: string;
				placement: number;
				total_score: number;
			}>;

			console.log(`   Game ${game.id}:`);
			scores.forEach((score) => {
				console.log(
					`      ${score.username}: Placement ${score.placement}, Score ${score.total_score}`
				);
			});
		}

		// Check for duplicate games (same league, same date, same players)
		console.log('\n🔍 Checking for duplicate games...');
		const duplicates = db
			.prepare(
				`
			SELECT 
				g1.id as game1_id,
				g2.id as game2_id,
				g1.league_id,
				g1.played_at,
				COUNT(DISTINCT s1.user_id) as player_count
			FROM games g1
			JOIN games g2 ON g1.league_id = g2.league_id 
				AND g1.played_at = g2.played_at
				AND g1.id < g2.id
			JOIN scores s1 ON s1.game_id = g1.id
			JOIN scores s2 ON s2.game_id = g2.id AND s1.user_id = s2.user_id
			GROUP BY g1.id, g2.id
			HAVING COUNT(DISTINCT s1.user_id) >= 3
		`
			)
			.all() as Array<{
			game1_id: number;
			game2_id: number;
			league_id: number;
			played_at: string;
			player_count: number;
		}>;

		if (duplicates.length > 0) {
			console.log(`   ⚠️  Found ${duplicates.length} potential duplicate game pairs:`);
			duplicates.forEach((dup) => {
				console.log(
					`      Games ${dup.game1_id} and ${dup.game2_id} (League ${dup.league_id}, ${dup.played_at})`
				);
			});
		} else {
			console.log('   ✓ No duplicate games found');
		}

		// Check W/L calculation for league 1
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

		stats.forEach((stat) => {
			console.log(
				`   ${stat.username}: ${stat.wins}W / ${stat.losses}L (${stat.total_games} games)`
			);
		});
	} catch (error) {
		console.error('❌ Error checking database:', error);
		throw error;
	} finally {
		db.close();
	}
}

// Run check
try {
	checkDatabase();
	console.log('\n✅ Database check complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 Database check failed:', error);
	process.exit(1);
}
