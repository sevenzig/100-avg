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

function checkLeaguePlayers() {
	console.log('🔍 Checking league_players table for issues...\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// Get all leagues
		const leagues = db
			.prepare('SELECT id, name, created_by FROM leagues ORDER BY id')
			.all() as Array<{ id: number; name: string; created_by: number }>;

		for (const league of leagues) {
			console.log(`\n${'='.repeat(60)}`);
			console.log(`🏆 League ${league.id}: ${league.name}`);
			console.log('='.repeat(60));

			const players = db
				.prepare(
					`
				SELECT 
					lp.league_id,
					lp.user_id,
					u.username,
					lp.player_color,
					lp.joined_at
				FROM league_players lp
				JOIN users u ON lp.user_id = u.id
				WHERE lp.league_id = ?
				ORDER BY lp.player_color, lp.joined_at
			`
				)
				.all(league.id) as Array<{
				league_id: number;
				user_id: number;
				username: string;
				player_color: string;
				joined_at: string;
			}>;

			console.log(`\n👥 League players (${players.length}):`);
			players.forEach((player) => {
				console.log(
					`   ${player.username} (ID: ${player.user_id}): ${player.player_color}, joined ${player.joined_at}`
				);
			});

			// Check for duplicate player colors
			const colorCounts = new Map<string, number>();
			players.forEach((p) => {
				colorCounts.set(p.player_color, (colorCounts.get(p.player_color) || 0) + 1);
			});

			const duplicates = Array.from(colorCounts.entries()).filter(([_, count]) => count > 1);
			if (duplicates.length > 0) {
				console.log(`\n⚠️  Duplicate player colors found:`);
				duplicates.forEach(([color, count]) => {
					console.log(`   ${color}: ${count} players`);
					const playersWithColor = players.filter((p) => p.player_color === color);
					playersWithColor.forEach((p) => {
						console.log(`      - ${p.username} (ID: ${p.user_id})`);
					});
				});
			} else {
				console.log(`\n✅ All player colors are unique`);
			}

			// Validate player count (2-5 players allowed)
			if (players.length < 2 || players.length > 5) {
				console.log(`\n⚠️  Invalid player count: ${players.length} (must be 2-5)`);
			} else {
				console.log(`\n✅ Valid player count: ${players.length}`);
			}
		}

		// Check for users that appear in multiple leagues with same color
		console.log(`\n${'='.repeat(60)}`);
		console.log('📊 Cross-league analysis');
		console.log('='.repeat(60));

		const allPlayers = db
			.prepare(
				`
			SELECT 
				lp.league_id,
				l.name as league_name,
				lp.user_id,
				u.username,
				lp.player_color
			FROM league_players lp
			JOIN users u ON lp.user_id = u.id
			JOIN leagues l ON lp.league_id = l.id
			ORDER BY u.username, lp.league_id
		`
			)
			.all() as Array<{
			league_id: number;
			league_name: string;
			user_id: number;
			username: string;
			player_color: string;
		}>;

		const usersByLeague = new Map<number, Map<number, typeof allPlayers[0]>>();
		allPlayers.forEach((p) => {
			if (!usersByLeague.has(p.league_id)) {
				usersByLeague.set(p.league_id, new Map());
			}
			usersByLeague.get(p.league_id)!.set(p.user_id, p);
		});

		// Check specific users
		const targetUsernames = ['blabberman23', 'skycondition'];
		for (const username of targetUsernames) {
			const userPlayers = allPlayers.filter((p) => p.username === username);
			if (userPlayers.length > 0) {
				console.log(`\n👤 ${username}:`);
				userPlayers.forEach((p) => {
					console.log(
						`   League ${p.league_id} (${p.league_name}): ${p.player_color}`
					);
				});
			}
		}
	} catch (error) {
		console.error('❌ Error checking league players:', error);
		throw error;
	} finally {
		db.close();
	}
}

try {
	checkLeaguePlayers();
	console.log('\n✅ League players check complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 League players check failed:', error);
	process.exit(1);
}
