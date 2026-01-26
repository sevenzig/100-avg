import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { env } from 'process';

const dbDir = join(process.cwd(), 'database');
try {
	mkdirSync(dbDir, { recursive: true });
} catch (e) {
	// Directory might already exist
}

const dbPath = env.DATABASE_PATH || join(dbDir, 'wingspan.db');

function checkGameDetails() {
	console.log('🔍 Checking all games for completeness...\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// Get all games
		const games = db
			.prepare('SELECT id, league_id, played_at, created_by FROM games ORDER BY id')
			.all() as Array<{ id: number; league_id: number; played_at: string; created_by: number }>;

		for (const game of games) {
			console.log(`\n${'='.repeat(60)}`);
			console.log(`🎮 Game ${game.id} (League ${game.league_id}, ${game.played_at})`);
			console.log('='.repeat(60));

			// Get league players for this game's league
			const leaguePlayers = db
				.prepare(
					`
				SELECT 
					u.id,
					u.username,
					lp.player_color
				FROM league_players lp
				JOIN users u ON lp.user_id = u.id
				WHERE lp.league_id = ?
				ORDER BY lp.player_color
			`
				)
				.all(game.league_id) as Array<{
				id: number;
				username: string;
				player_color: string;
			}>;

			console.log(`\n👥 League players (${leaguePlayers.length}):`);
			leaguePlayers.forEach((player) => {
				console.log(`   ${player.username} (ID: ${player.id}, ${player.player_color})`);
			});

			// Get scores for this game
			const scores = db
				.prepare(
					`
				SELECT 
					s.id as score_id,
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
				score_id: number;
				user_id: number;
				username: string;
				placement: number;
				total_score: number;
			}>;

			console.log(`\n📊 Scores (${scores.length}):`);
			if (scores.length === 0) {
				console.log('   ❌ No scores found for this game!');
			} else {
				scores.forEach((score) => {
					console.log(
						`   ${score.username} (ID: ${score.user_id}): Placement ${score.placement}, Score ${score.total_score}`
					);
				});
			}

			// Check for missing players
			const playersWithScores = new Set(scores.map((s) => s.user_id));
			const missingPlayers = leaguePlayers.filter((p) => !playersWithScores.has(p.id));

			if (missingPlayers.length > 0) {
				console.log(`\n⚠️  Missing scores for ${missingPlayers.length} league player(s):`);
				missingPlayers.forEach((player) => {
					console.log(`   ❌ ${player.username} (ID: ${player.id}, ${player.player_color})`);
				});
			} else if (scores.length !== leaguePlayers.length) {
				console.log(
					`\n⚠️  Score count (${scores.length}) doesn't match league player count (${leaguePlayers.length})`
				);
			} else {
				console.log(`\n✅ All league players have scores (${scores.length} players)`);
			}

			// Check for extra scores (users not in league)
			const leaguePlayerIds = new Set(leaguePlayers.map((p) => p.id));
			const extraScores = scores.filter((s) => !leaguePlayerIds.has(s.user_id));

			if (extraScores.length > 0) {
				console.log(`\n⚠️  Scores from users NOT in this league:`);
				extraScores.forEach((score) => {
					console.log(`   ❌ ${score.username} (ID: ${score.user_id}): Placement ${score.placement}`);
				});
			}
		}

		// Summary
		console.log(`\n${'='.repeat(60)}`);
		console.log('📊 Summary');
		console.log('='.repeat(60));

		const incompleteGames = db
			.prepare(
				`
			SELECT 
				g.id as game_id,
				g.league_id,
				g.played_at,
				COUNT(DISTINCT lp.user_id) as league_player_count,
				COUNT(DISTINCT s.user_id) as score_count
			FROM games g
			JOIN league_players lp ON g.league_id = lp.league_id
			LEFT JOIN scores s ON s.game_id = g.id
			GROUP BY g.id, g.league_id, g.played_at
			HAVING league_player_count != score_count
			ORDER BY g.id
		`
			)
			.all() as Array<{
			game_id: number;
			league_id: number;
			played_at: string;
			league_player_count: number;
			score_count: number;
		}>;

		if (incompleteGames.length > 0) {
			console.log(`\n⚠️  Games with incomplete scores: ${incompleteGames.length}`);
			incompleteGames.forEach((game) => {
				console.log(
					`   Game ${game.game_id} (League ${game.league_id}): ${game.league_player_count} players, ${game.score_count} scores`
				);
			});
		} else {
			console.log(`\n✅ All games have complete scores`);
		}
	} catch (error) {
		console.error('❌ Error checking game details:', error);
		throw error;
	} finally {
		db.close();
	}
}

try {
	checkGameDetails();
	console.log('\n✅ Game details check complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 Game details check failed:', error);
	process.exit(1);
}
