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

function fixLeaguePlayers() {
	console.log('🔧 Fixing league_players table...\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		// Start transaction
		const transaction = db.transaction(() => {
			// Get all leagues
			const leagues = db
				.prepare('SELECT id, name FROM leagues ORDER BY id')
				.all() as Array<{ id: number; name: string }>;

			for (const league of leagues) {
				console.log(`\n${'='.repeat(60)}`);
				console.log(`🏆 League ${league.id}: ${league.name}`);
				console.log('='.repeat(60));

				// Get current players ordered by joined_at
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
					ORDER BY lp.joined_at ASC
				`
					)
					.all(league.id) as Array<{
					league_id: number;
					user_id: number;
					username: string;
					player_color: string;
					joined_at: string;
				}>;

				console.log(`\n👥 Current players (${players.length}):`);
				players.forEach((player, index) => {
					console.log(
						`   ${index + 1}. ${player.username} (ID: ${player.user_id}): ${player.player_color}, joined ${player.joined_at}`
					);
				});

				// Validate player count (2-5 players allowed)
				if (players.length < 2 || players.length > 5) {
					console.log(`\n⚠️  Invalid player count: ${players.length} (must be 2-5)`);
				}

				// Check for duplicates
				const colorCounts = new Map<string, number>();
				players.forEach((p) => {
					colorCounts.set(p.player_color, (colorCounts.get(p.player_color) || 0) + 1);
				});

				const duplicates = Array.from(colorCounts.entries()).filter(([_, count]) => count > 1);
				if (duplicates.length > 0) {
					console.log(`\n⚠️  Found duplicate player colors - fixing...`);

					// Assign correct colors based on join order
					const correctColors = ['player_1', 'player_2', 'player_3', 'player_4', 'player_5'];
					
					// Update each player with correct color
					for (let i = 0; i < players.length; i++) {
						const player = players[i];
						const correctColor = correctColors[i] || `player_${i + 1}`;
						
						if (player.player_color !== correctColor) {
							console.log(
								`   🔄 Updating ${player.username} (ID: ${player.user_id}): ${player.player_color} → ${correctColor}`
							);
							db.prepare(
								`
								UPDATE league_players
								SET player_color = ?
								WHERE league_id = ? AND user_id = ?
							`
							).run(correctColor, league.id, player.user_id);
						} else {
							console.log(
								`   ✅ ${player.username} (ID: ${player.user_id}) already has correct color: ${correctColor}`
							);
						}
					}

					// Verify fix
					const updatedPlayers = db
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
						ORDER BY lp.player_color
					`
						)
						.all(league.id) as Array<{
						league_id: number;
						user_id: number;
						username: string;
						player_color: string;
						joined_at: string;
					}>;

					console.log(`\n✅ Updated players:`);
					updatedPlayers.forEach((player) => {
						console.log(
							`   ${player.username} (ID: ${player.user_id}): ${player.player_color}`
						);
					});
				} else {
					console.log(`\n✅ No issues found - all players have unique colors`);
				}
			}
		});

		transaction();

		// Final verification
		console.log(`\n${'='.repeat(60)}`);
		console.log('📊 Final Verification');
		console.log('='.repeat(60));

		const allLeagues = db
			.prepare('SELECT id, name FROM leagues ORDER BY id')
			.all() as Array<{ id: number; name: string }>;

		for (const league of allLeagues) {
			const players = db
				.prepare(
					`
				SELECT 
					u.username,
					lp.player_color
				FROM league_players lp
				JOIN users u ON lp.user_id = u.id
				WHERE lp.league_id = ?
				ORDER BY lp.player_color
			`
				)
				.all(league.id) as Array<{ username: string; player_color: string }>;

			const colors = players.map((p) => p.player_color);
			const uniqueColors = new Set(colors);
			const hasDuplicates = colors.length !== uniqueColors.size;

			if (hasDuplicates) {
				console.log(`\n❌ League ${league.id} (${league.name}) still has duplicate colors!`);
			} else {
				console.log(`\n✅ League ${league.id} (${league.name}): All colors unique`);
				players.forEach((p) => {
					console.log(`   ${p.username}: ${p.player_color}`);
				});
			}
		}
	} catch (error) {
		console.error('❌ Error fixing league players:', error);
		throw error;
	} finally {
		db.close();
	}
}

try {
	fixLeaguePlayers();
	console.log('\n✅ League players fix complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 League players fix failed:', error);
	process.exit(1);
}
