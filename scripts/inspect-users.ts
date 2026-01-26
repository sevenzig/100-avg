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

function inspectUsers() {
	console.log('🔍 Inspecting users: blabberman23 and skycondition\n');

	const db = new Database(dbPath);
	db.pragma('foreign_keys = ON');

	try {
		const usernames = ['blabberman23', 'skycondition'];

		for (const username of usernames) {
			console.log(`\n${'='.repeat(60)}`);
			console.log(`📋 User: ${username}`);
			console.log('='.repeat(60));

			// Check if user exists in users table
			const user = db
				.prepare('SELECT id, username, email, created_at FROM users WHERE username = ?')
				.get(username) as
				| { id: number; username: string; email: string; created_at: string }
				| undefined;

			if (!user) {
				console.log(`❌ User "${username}" does NOT exist in users table`);
				
				// Check if this username appears in scores (orphaned references)
				const orphanedScores = db
					.prepare(`
					SELECT 
						s.id as score_id,
						s.game_id,
						s.user_id,
						s.placement,
						s.total_score,
						g.league_id,
						g.played_at
					FROM scores s
					JOIN games g ON s.game_id = g.id
					WHERE s.user_id NOT IN (SELECT id FROM users)
					ORDER BY g.played_at DESC
				`)
					.all() as Array<{
					score_id: number;
					game_id: number;
					user_id: number;
					placement: number;
					total_score: number;
					league_id: number;
					played_at: string;
				}>;

				if (orphanedScores.length > 0) {
					console.log(`\n⚠️  Found ${orphanedScores.length} orphaned scores with invalid user_id:`);
					orphanedScores.slice(0, 10).forEach((score) => {
						console.log(
							`   Score ID: ${score.score_id}, Game ID: ${score.game_id}, User ID: ${score.user_id}, League: ${score.league_id}, Date: ${score.played_at}`
						);
					});
					if (orphanedScores.length > 10) {
						console.log(`   ... and ${orphanedScores.length - 10} more`);
					}
				}

				// Check all games to see if this username appears in any way
				console.log(`\n🔍 Checking all games for references to "${username}"...`);
				const allGames = db
					.prepare(`
					SELECT 
						g.id as game_id,
						g.league_id,
						g.played_at,
						s.user_id,
						u.username,
						s.placement,
						s.total_score
					FROM games g
					JOIN scores s ON s.game_id = g.id
					LEFT JOIN users u ON s.user_id = u.id
					ORDER BY g.played_at DESC
				`)
					.all() as Array<{
					game_id: number;
					league_id: number;
					played_at: string;
					user_id: number;
					username: string | null;
					placement: number;
					total_score: number;
				}>;

				const gamesWithNullUsernames = allGames.filter((g) => g.username === null);
				if (gamesWithNullUsernames.length > 0) {
					console.log(
						`\n⚠️  Found ${gamesWithNullUsernames.length} scores with null usernames (orphaned user_ids):`
					);
					const uniqueGameIds = new Set(gamesWithNullUsernames.map((g) => g.game_id));
					console.log(`   Affected games: ${Array.from(uniqueGameIds).join(', ')}`);
				}
			} else {
				console.log(`✅ User exists:`);
				console.log(`   ID: ${user.id}`);
				console.log(`   Email: ${user.email}`);
				console.log(`   Created: ${user.created_at}`);

				// Check scores for this user
				const scores = db
					.prepare(
						`
					SELECT 
						s.id as score_id,
						s.game_id,
						s.placement,
						s.total_score,
						g.league_id,
						g.played_at
					FROM scores s
					JOIN games g ON s.game_id = g.id
					WHERE s.user_id = ?
					ORDER BY g.played_at DESC
				`
					)
					.all(user.id) as Array<{
					score_id: number;
					game_id: number;
					placement: number;
					total_score: number;
					league_id: number;
					played_at: string;
				}>;

				console.log(`\n📊 Scores for ${username}:`);
				if (scores.length === 0) {
					console.log(`   ❌ No scores found for this user`);
				} else {
					console.log(`   ✅ Found ${scores.length} score(s):`);
					scores.forEach((score) => {
						console.log(
							`      Game ${score.game_id} (League ${score.league_id}, ${score.played_at}): Placement ${score.placement}, Score ${score.total_score}`
						);
					});
				}

				// Check league_players for this user
				const leagueMemberships = db
					.prepare(
						`
					SELECT 
						lp.league_id,
						l.name as league_name,
						lp.player_color,
						lp.joined_at
					FROM league_players lp
					JOIN leagues l ON lp.league_id = l.id
					WHERE lp.user_id = ?
				`
					)
					.all(user.id) as Array<{
					league_id: number;
					league_name: string;
					player_color: string;
					joined_at: string;
				}>;

				console.log(`\n🏆 League memberships for ${username}:`);
				if (leagueMemberships.length === 0) {
					console.log(`   ❌ Not a member of any leagues`);
				} else {
					console.log(`   ✅ Member of ${leagueMemberships.length} league(s):`);
					leagueMemberships.forEach((membership) => {
						console.log(
							`      League ${membership.league_id} (${membership.league_name}): ${membership.player_color}, joined ${membership.joined_at}`
						);
					});
				}

				// Check if user appears in games but has no scores
				const gamesInLeagues = db
					.prepare(
						`
					SELECT DISTINCT
						g.id as game_id,
						g.league_id,
						g.played_at
					FROM games g
					JOIN league_players lp ON g.league_id = lp.league_id
					WHERE lp.user_id = ?
					ORDER BY g.played_at DESC
				`
					)
					.all(user.id) as Array<{
					game_id: number;
					league_id: number;
					played_at: string;
				}>;

				const gamesWithoutScores = gamesInLeagues.filter(
					(game) => !scores.some((score) => score.game_id === game.game_id)
				);

				if (gamesWithoutScores.length > 0) {
					console.log(
						`\n⚠️  Found ${gamesWithoutScores.length} game(s) in user's leagues where user has no score:`
					);
					gamesWithoutScores.slice(0, 10).forEach((game) => {
						console.log(
							`      Game ${game.game_id} (League ${game.league_id}, ${game.played_at})`
						);
					});
					if (gamesWithoutScores.length > 10) {
						console.log(`      ... and ${gamesWithoutScores.length - 10} more`);
					}
				}
			}
		}

		// Summary: Check all games to see which users appear
		console.log(`\n${'='.repeat(60)}`);
		console.log('📊 Summary: All users appearing in games');
		console.log('='.repeat(60));

		const allUsersInGames = db
			.prepare(
				`
			SELECT 
				u.id,
				u.username,
				COUNT(DISTINCT s.game_id) as game_count,
				COUNT(s.id) as score_count
			FROM users u
			JOIN scores s ON s.user_id = u.id
			GROUP BY u.id, u.username
			ORDER BY game_count DESC
		`
			)
			.all() as Array<{
			id: number;
			username: string;
			game_count: number;
			score_count: number;
		}>;

		console.log(`\nTotal users with scores: ${allUsersInGames.length}`);
		allUsersInGames.forEach((user) => {
			console.log(
				`   ${user.username} (ID: ${user.id}): ${user.game_count} games, ${user.score_count} scores`
			);
		});

		// Check for users that exist but have no scores
		const usersWithoutScores = db
			.prepare(
				`
			SELECT 
				u.id,
				u.username,
				u.email,
				u.created_at
			FROM users u
			LEFT JOIN scores s ON s.user_id = u.id
			WHERE s.id IS NULL
			ORDER BY u.id
		`
			)
			.all() as Array<{
			id: number;
			username: string;
			email: string;
			created_at: string;
		}>;

		if (usersWithoutScores.length > 0) {
			console.log(`\n⚠️  Users with no scores: ${usersWithoutScores.length}`);
			usersWithoutScores.forEach((user) => {
				console.log(`   ${user.username} (ID: ${user.id}, Email: ${user.email}, Created: ${user.created_at})`);
			});
		}
	} catch (error) {
		console.error('❌ Error inspecting users:', error);
		throw error;
	} finally {
		db.close();
	}
}

// Run inspection
try {
	inspectUsers();
	console.log('\n✅ User inspection complete!');
	process.exit(0);
} catch (error) {
	console.error('💥 User inspection failed:', error);
	process.exit(1);
}
