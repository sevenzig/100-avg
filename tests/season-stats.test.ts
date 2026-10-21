import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { queryLeagueStats } from '$lib/utils/league-stats';
import {
	addDaysIso,
	ensureSeasonSchema,
	ensureSeasons,
	getSeasonByNumber,
	type SeasonsDb
} from '$lib/utils/seasons';

function statsDb(): SeasonsDb {
	const db = new DatabaseSync(':memory:');
	db.exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL
		);
		CREATE TABLE leagues (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			created_by INTEGER NOT NULL
		);
		CREATE TABLE league_players (
			league_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			player_color TEXT,
			PRIMARY KEY (league_id, user_id)
		);
		CREATE TABLE games (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			league_id INTEGER NOT NULL,
			played_at TEXT NOT NULL,
			created_by INTEGER NOT NULL
		);
		CREATE TABLE scores (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			game_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			placement INTEGER NOT NULL,
			total_score INTEGER NOT NULL,
			birds INTEGER DEFAULT 0,
			bonus_cards INTEGER DEFAULT 0,
			end_of_round_goals INTEGER DEFAULT 0,
			eggs INTEGER DEFAULT 0,
			food_on_cards INTEGER DEFAULT 0,
			tucked_cards INTEGER DEFAULT 0,
			nectar INTEGER DEFAULT 0
		);
	`);
	return db as unknown as SeasonsDb;
}

describe('queryLeagueStats', () => {
	it('keeps a season-1 game out of season-2 standings and includes it in career avg', () => {
		const db = statsDb();
		const epoch = '2026-01-15T00:00:00.000Z';
		db.exec(`
			INSERT INTO users (id, username) VALUES (1, 'alice'), (2, 'bob');
			INSERT INTO leagues (id, name, created_by) VALUES (1, 'Nest Cup', 1);
			INSERT INTO league_players (league_id, user_id, player_color)
				VALUES (1, 1, 'player_1'), (1, 2, 'player_2');
		`);
		db.prepare('INSERT INTO games (league_id, played_at, created_by) VALUES (1, ?, 1)').run(epoch);
		db.prepare(
			'INSERT INTO scores (game_id, user_id, placement, total_score) VALUES (1, 1, 1, 80)'
		).run();
		db.prepare(
			'INSERT INTO scores (game_id, user_id, placement, total_score) VALUES (1, 2, 2, 70)'
		).run();

		const season2Start = addDaysIso(epoch, 91);
		db.prepare('INSERT INTO games (league_id, played_at, created_by) VALUES (1, ?, 1)').run(
			season2Start
		);
		db.prepare(
			'INSERT INTO scores (game_id, user_id, placement, total_score) VALUES (2, 1, 1, 100)'
		).run();
		db.prepare(
			'INSERT INTO scores (game_id, user_id, placement, total_score) VALUES (2, 2, 2, 90)'
		).run();

		ensureSeasonSchema(db, new Date(season2Start));
		ensureSeasons(db, new Date(season2Start));
		const s1 = getSeasonByNumber(db, 1)!;
		const s2 = getSeasonByNumber(db, 2)!;

		const season2 = queryLeagueStats(db, 1, s2.id);
		const alice2 = season2.find((row) => row.user_id === 1)!;
		expect(alice2.total_games).toBe(1);
		expect(alice2.average_score).toBe(100);
		expect(alice2.career_total_games).toBe(2);
		expect(alice2.career_average_score).toBe(90);

		const season1 = queryLeagueStats(db, 1, s1.id);
		const alice1 = season1.find((row) => row.user_id === 1)!;
		expect(alice1.total_games).toBe(1);
		expect(alice1.average_score).toBe(80);
	});

	it('returns null season average when a player has no games this season', () => {
		const db = statsDb();
		db.exec(`
			INSERT INTO users (id, username) VALUES (1, 'alice'), (2, 'bob');
			INSERT INTO leagues (id, name, created_by) VALUES (1, 'Nest Cup', 1);
			INSERT INTO league_players (league_id, user_id, player_color)
				VALUES (1, 1, 'player_1'), (1, 2, 'player_2');
			INSERT INTO games (id, league_id, played_at, created_by)
				VALUES (1, 1, '2026-01-15T00:00:00.000Z', 1);
			INSERT INTO scores (game_id, user_id, placement, total_score)
				VALUES (1, 1, 1, 80);
		`);
		ensureSeasonSchema(db, new Date('2026-01-15T00:00:00.000Z'));
		const s1 = getSeasonByNumber(db, 1)!;
		const stats = queryLeagueStats(db, 1, s1.id);
		const bob = stats.find((row) => row.user_id === 2)!;
		expect(bob.average_score).toBeNull();
		expect(bob.career_average_score).toBeNull();
		expect(bob.total_games).toBe(0);
	});
});
