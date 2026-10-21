import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
	bimonthStartIso,
	ensureSeasonSchema,
	ensureSeasons,
	formatSeasonLabel,
	getCurrentSeason,
	getSettings,
	listSeasons,
	resolveSeasonParam,
	seasonBounds,
	seasonForDate,
	seasonNumberForDate,
	type SeasonsDb
} from '$lib/utils/seasons';

function memoryDb(): SeasonsDb {
	const db = new DatabaseSync(':memory:');
	db.exec(`
		CREATE TABLE games (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			league_id INTEGER NOT NULL DEFAULT 1,
			played_at TEXT NOT NULL,
			created_by INTEGER NOT NULL DEFAULT 1
		);
	`);
	return db as unknown as SeasonsDb;
}

describe('bimonthStartIso and seasonNumberForDate', () => {
	const epoch = '2025-12-01T00:00:00.000Z';

	it('snaps mid-window dates to the even-month start', () => {
		expect(bimonthStartIso('2026-08-15T12:00:00.000Z')).toBe('2026-08-01T00:00:00.000Z');
		expect(bimonthStartIso('2026-09-30T23:59:59.000Z')).toBe('2026-08-01T00:00:00.000Z');
		expect(bimonthStartIso('2026-10-01T00:00:00.000Z')).toBe('2026-10-01T00:00:00.000Z');
		expect(bimonthStartIso('2026-11-30T23:59:59.000Z')).toBe('2026-10-01T00:00:00.000Z');
		expect(bimonthStartIso('2026-01-15T00:00:00.000Z')).toBe('2025-12-01T00:00:00.000Z');
	});

	it('puts the epoch instant in season 1', () => {
		expect(seasonNumberForDate(epoch, epoch)).toBe(1);
	});

	it('puts one second before end_at in season n', () => {
		expect(seasonNumberForDate(epoch, '2026-01-31T23:59:59.000Z')).toBe(1);
	});

	it('puts played_at equal to end_at in season n+1', () => {
		expect(seasonNumberForDate(epoch, '2026-02-01T00:00:00.000Z')).toBe(2);
	});

	it('returns null before the epoch', () => {
		expect(seasonNumberForDate(epoch, '2025-11-30T23:59:59.000Z')).toBeNull();
	});

	it('uses Aug–Sep then Oct–Nov pairs', () => {
		const aug = seasonBounds(epoch, 5);
		expect(aug.startAt).toBe('2026-08-01T00:00:00.000Z');
		expect(aug.endAt).toBe('2026-10-01T00:00:00.000Z');
		expect(seasonNumberForDate(epoch, '2026-08-01T00:00:00.000Z')).toBe(5);
		expect(seasonNumberForDate(epoch, '2026-10-01T00:00:00.000Z')).toBe(6);
		expect(seasonNumberForDate(epoch, '2026-11-30T23:59:59.000Z')).toBe(6);
	});

	it('keeps Feb 29 in Feb–Mar', () => {
		expect(seasonNumberForDate('2024-02-01T00:00:00.000Z', '2024-02-29T12:00:00.000Z')).toBe(1);
	});
});

describe('formatSeasonLabel', () => {
	it('shows the last inclusive day, not the exclusive end', () => {
		expect(formatSeasonLabel(6, '2026-10-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z')).toBe(
			'Season 6 · Oct 1 – Nov 30, 2026'
		);
	});

	it('names both years on Dec–Jan', () => {
		expect(formatSeasonLabel(1, '2025-12-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')).toBe(
			'Season 1 · Dec 1, 2025 – Jan 31, 2026'
		);
	});
});

describe('ensureSeasonSchema', () => {
	it('freezes epoch to the even-month start that contains the earliest game', () => {
		const db = memoryDb();
		db.prepare('INSERT INTO games (played_at) VALUES (?)').run('2026-01-15 14:30:00');
		db.prepare('INSERT INTO games (played_at) VALUES (?)').run('2026-03-01T00:00:00.000Z');
		ensureSeasonSchema(db, new Date('2026-10-21T12:00:00.000Z'));
		expect(getSettings(db)?.season_epoch).toBe('2025-12-01T00:00:00.000Z');
	});

	it('uses the current pair start when there are no games', () => {
		const db = memoryDb();
		const now = new Date('2026-10-21T15:45:00.000Z');
		ensureSeasonSchema(db, now);
		expect(getSettings(db)?.season_epoch).toBe('2026-10-01T00:00:00.000Z');
	});

	it('does not recompute epoch on later runs', () => {
		const db = memoryDb();
		ensureSeasonSchema(db, new Date('2026-10-21T00:00:00.000Z'));
		const first = getSettings(db)!.season_epoch;
		db.prepare('INSERT INTO games (played_at) VALUES (?)').run('2025-01-01T00:00:00.000Z');
		ensureSeasonSchema(db, new Date('2026-10-22T00:00:00.000Z'));
		expect(getSettings(db)?.season_epoch).toBe(first);
	});

	it('snaps a leftover mid-window epoch down to the pair start', () => {
		const db = memoryDb();
		ensureSeasonSchema(db, new Date('2026-10-21T00:00:00.000Z'));
		db.prepare('UPDATE app_settings SET season_epoch = ? WHERE id = 1').run(
			'2026-01-15T00:00:00.000Z'
		);
		ensureSeasonSchema(db, new Date('2026-10-21T00:00:00.000Z'));
		expect(getSettings(db)?.season_epoch).toBe('2025-12-01T00:00:00.000Z');
	});

	it('backfills season_id on every game', () => {
		const db = memoryDb();
		db.prepare('INSERT INTO games (played_at) VALUES (?)').run('2026-01-15T00:00:00.000Z');
		db.prepare('INSERT INTO games (played_at) VALUES (?)').run('2026-02-01T00:00:00.000Z');
		ensureSeasonSchema(db, new Date('2026-10-21T00:00:00.000Z'));
		const rows = db
			.prepare(
				`SELECT g.id, g.season_id, s.number
				 FROM games g JOIN seasons s ON s.id = g.season_id
				 ORDER BY g.id`
			)
			.all() as Array<{ season_id: number | null; number: number }>;
		expect(rows.every((row) => row.season_id !== null)).toBe(true);
		expect(rows.map((row) => row.number)).toEqual([1, 2]);
		const nulls = db.prepare('SELECT COUNT(*) as n FROM games WHERE season_id IS NULL').get() as {
			n: number;
		};
		expect(nulls.n).toBe(0);
	});
});

describe('ensureSeasons', () => {
	it('creates one active season and archives the rest', () => {
		const db = memoryDb();
		ensureSeasonSchema(db, new Date('2026-01-15T00:00:00.000Z'));
		const later = '2026-02-01T00:00:00.000Z';
		const current = ensureSeasons(db, new Date(later));
		expect(current.number).toBe(2);
		expect(current.status).toBe('active');
		const seasons = listSeasons(db);
		expect(seasons.filter((s) => s.status === 'active')).toHaveLength(1);
		expect(seasons.find((s) => s.number === 1)?.status).toBe('archived');
		expect(new Date(seasons.find((s) => s.number === 1)!.endAt).getTime()).toBeLessThanOrEqual(
			new Date(later).getTime()
		);
	});

	it('inserts a single extra row when called twice at a boundary', () => {
		const db = memoryDb();
		const epoch = new Date('2026-01-15T00:00:00.000Z');
		ensureSeasonSchema(db, epoch);
		const boundary = new Date('2026-02-01T00:00:00.000Z');
		ensureSeasons(db, boundary);
		ensureSeasons(db, boundary);
		const rows = db.prepare('SELECT number FROM seasons ORDER BY number').all() as Array<{
			number: number;
		}>;
		expect(rows.map((r) => r.number)).toEqual([1, 2]);
		expect(getCurrentSeason(db)?.number).toBe(2);
	});
});

describe('seasonForDate and resolveSeasonParam', () => {
	it('assigns a backdated game to the matching archive', () => {
		const db = memoryDb();
		const epoch = new Date('2026-01-15T00:00:00.000Z');
		ensureSeasonSchema(db, epoch);
		const now = new Date('2026-02-01T00:00:00.000Z');
		ensureSeasons(db, now);
		const season = seasonForDate(db, '2026-01-15T00:00:00.000Z', now);
		expect(season?.number).toBe(1);
		expect(season?.status).toBe('archived');
	});

	it('returns null for dates before the epoch', () => {
		const db = memoryDb();
		ensureSeasonSchema(db, new Date('2026-10-21T00:00:00.000Z'));
		const settings = getSettings(db)!;
		const before = new Date(new Date(settings.season_epoch).getTime() - 1000).toISOString();
		expect(seasonForDate(db, before)).toBeNull();
	});

	it('moves a game to the next season when played_at crosses the boundary', () => {
		const db = memoryDb();
		const epoch = '2026-01-15T00:00:00.000Z';
		ensureSeasonSchema(db, new Date(epoch));
		const now = new Date('2026-02-01T00:00:00.000Z');
		ensureSeasons(db, now);
		db.prepare('INSERT INTO games (played_at) VALUES (?)').run(epoch);
		ensureSeasons(db, now);
		const first = db.prepare('SELECT season_id FROM games WHERE id = 1').get() as {
			season_id: number;
		};
		const season1 = db.prepare('SELECT id FROM seasons WHERE number = 1').get() as { id: number };
		const season2 = db.prepare('SELECT id FROM seasons WHERE number = 2').get() as { id: number };
		expect(first.season_id).toBe(season1.id);

		const season = seasonForDate(db, '2026-02-01T00:00:00.000Z', now)!;
		db.prepare('UPDATE games SET played_at = ?, season_id = ? WHERE id = 1').run(
			'2026-02-01T00:00:00.000Z',
			season.id
		);
		const moved = db.prepare('SELECT season_id FROM games WHERE id = 1').get() as {
			season_id: number;
		};
		expect(moved.season_id).toBe(season2.id);
	});

	it('defaults to the current season and resolves ?season=', () => {
		const db = memoryDb();
		ensureSeasonSchema(db, new Date('2026-01-15T00:00:00.000Z'));
		ensureSeasons(db, new Date('2026-02-01T00:00:00.000Z'));
		const current = resolveSeasonParam(db, new URLSearchParams(), new Date('2026-02-01T00:00:00.000Z'));
		expect(current?.number).toBe(2);
		const archived = resolveSeasonParam(
			db,
			new URLSearchParams('season=1'),
			new Date('2026-02-01T00:00:00.000Z')
		);
		expect(archived?.number).toBe(1);
		expect(resolveSeasonParam(db, new URLSearchParams('season=nope'))).toBeNull();
	});
});
