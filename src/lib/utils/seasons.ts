/** Minimal sqlite-like surface so season helpers stay off better-sqlite3 types. */
export interface SeasonsDb {
	exec(sql: string): unknown;
	prepare(sql: string): {
		get(...args: unknown[]): unknown;
		run(...args: unknown[]): unknown;
		all(...args: unknown[]): unknown;
	};
}

export const PLAY_DATE_BEFORE_EPOCH = 'Play date is before Season 1';

export type SeasonStatus = 'active' | 'archived';

export interface Season {
	id: number;
	number: number;
	startAt: string;
	endAt: string;
	status: SeasonStatus;
}

interface SettingsRow {
	season_epoch: string;
	season_length_days: number;
}

interface SeasonRow {
	id: number;
	number: number;
	start_at: string;
	end_at: string;
	status: string;
}

export function parseUtc(value: string): Date {
	const trimmed = value.trim();
	if (/^\d{4}-\d{2}-\d{2} /.test(trimmed) && !trimmed.endsWith('Z')) {
		return new Date(trimmed.replace(' ', 'T') + 'Z');
	}
	return new Date(trimmed);
}

export function utcMidnightIso(input: Date | string): string {
	const d = typeof input === 'string' ? parseUtc(input) : input;
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/** First instant of the even-month pair that contains the date (Dec–Jan, Feb–Mar, …). */
export function bimonthStartIso(input: Date | string): string {
	const d = typeof input === 'string' ? parseUtc(input) : input;
	const year = d.getUTCFullYear();
	const month = d.getUTCMonth();
	if (month === 0) {
		return new Date(Date.UTC(year - 1, 11, 1)).toISOString();
	}
	const startMonth = month % 2 === 1 ? month : month - 1;
	return new Date(Date.UTC(year, startMonth, 1)).toISOString();
}

export function addBimonthsIso(iso: string, periods: number): string {
	const d = parseUtc(iso);
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + periods * 2, 1)).toISOString();
}

export function seasonBounds(epochIso: string, number: number): { startAt: string; endAt: string } {
	const epoch = bimonthStartIso(epochIso);
	return {
		startAt: addBimonthsIso(epoch, number - 1),
		endAt: addBimonthsIso(epoch, number)
	};
}

export function seasonNumberForDate(epochIso: string, playedAt: string): number | null {
	const epoch = parseUtc(bimonthStartIso(epochIso));
	const at = parseUtc(playedAt);
	if (Number.isNaN(epoch.getTime()) || Number.isNaN(at.getTime()) || at < epoch) return null;
	const window = parseUtc(bimonthStartIso(playedAt));
	const months =
		(window.getUTCFullYear() - epoch.getUTCFullYear()) * 12 +
		(window.getUTCMonth() - epoch.getUTCMonth());
	return Math.floor(months / 2) + 1;
}

export function formatSeasonLabel(number: number, startAt: string, endAt: string): string {
	const start = parseUtc(startAt);
	const inclusiveEnd = new Date(parseUtc(endAt).getTime() - 1);
	const monthDay: Intl.DateTimeFormatOptions = {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	};
	const monthDayYear: Intl.DateTimeFormatOptions = {
		...monthDay,
		year: 'numeric'
	};
	if (start.getUTCFullYear() === inclusiveEnd.getUTCFullYear()) {
		return `Season ${number} · ${start.toLocaleDateString('en-US', monthDay)} – ${inclusiveEnd.toLocaleDateString('en-US', monthDay)}, ${inclusiveEnd.getUTCFullYear()}`;
	}
	return `Season ${number} · ${start.toLocaleDateString('en-US', monthDayYear)} – ${inclusiveEnd.toLocaleDateString('en-US', monthDayYear)}`;
}

function mapSeason(row: SeasonRow): Season {
	return {
		id: row.id,
		number: row.number,
		startAt: row.start_at,
		endAt: row.end_at,
		status: row.status === 'active' ? 'active' : 'archived'
	};
}

export function getSettings(db: SeasonsDb): SettingsRow | undefined {
	return db.prepare('SELECT season_epoch, season_length_days FROM app_settings WHERE id = 1').get() as
		| SettingsRow
		| undefined;
}

function hasColumn(db: SeasonsDb, table: string, column: string): boolean {
	const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
	return cols.some((col) => col.name === column);
}

export function ensureSeasonSchema(db: SeasonsDb, now = new Date()): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS app_settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			season_epoch TEXT NOT NULL,
			season_length_days INTEGER NOT NULL DEFAULT 91
		);
	`);
	db.exec(`
		CREATE TABLE IF NOT EXISTS seasons (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			number INTEGER UNIQUE NOT NULL,
			start_at TEXT NOT NULL,
			end_at TEXT NOT NULL,
			status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
	`);
	db.exec('CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);');
	db.exec('CREATE INDEX IF NOT EXISTS idx_seasons_range ON seasons(start_at, end_at);');

	if (!hasColumn(db, 'games', 'season_id')) {
		db.exec('ALTER TABLE games ADD COLUMN season_id INTEGER REFERENCES seasons(id);');
	}
	db.exec('CREATE INDEX IF NOT EXISTS idx_games_season_id ON games(season_id);');
	db.exec('CREATE INDEX IF NOT EXISTS idx_games_league_season ON games(league_id, season_id);');

	if (!getSettings(db)) {
		const minPlayed = db.prepare('SELECT MIN(played_at) as min_played FROM games').get() as
			| { min_played: string | null }
			| undefined;
		const epoch = bimonthStartIso(minPlayed?.min_played ?? now);
		db.prepare(
			'INSERT INTO app_settings (id, season_epoch, season_length_days) VALUES (1, ?, ?)'
		).run(epoch, 0);
	} else {
		const settings = getSettings(db)!;
		const snapped = bimonthStartIso(settings.season_epoch);
		if (snapped !== settings.season_epoch) {
			db.prepare('UPDATE app_settings SET season_epoch = ? WHERE id = 1').run(snapped);
		}
	}

	ensureSeasons(db, now);
	backfillGameSeasons(db, now);
}

export function ensureSeasons(db: SeasonsDb, now = new Date(), through?: Date): Season {
	const settings = getSettings(db);
	if (!settings) {
		throw new Error('app_settings row is missing; call ensureSeasonSchema first');
	}

	const currentNumber = seasonNumberForDate(settings.season_epoch, now.toISOString()) ?? 1;
	const throughDate = through && through.getTime() > now.getTime() ? through : now;
	const throughNumber =
		seasonNumberForDate(settings.season_epoch, throughDate.toISOString()) ?? currentNumber;
	const maxNumber = Math.max(currentNumber, throughNumber);

	const insert = db.prepare(
		`INSERT OR IGNORE INTO seasons (number, start_at, end_at, status) VALUES (?, ?, ?, 'archived')`
	);
	const rewrite = db.prepare(`UPDATE seasons SET start_at = ?, end_at = ? WHERE number = ?`);
	for (let n = 1; n <= maxNumber; n++) {
		const bounds = seasonBounds(settings.season_epoch, n);
		insert.run(n, bounds.startAt, bounds.endAt);
		rewrite.run(bounds.startAt, bounds.endAt, n);
	}

	db.prepare(
		`UPDATE seasons SET status = CASE WHEN number = ? THEN 'active' ELSE 'archived' END`
	).run(currentNumber);

	const current = getCurrentSeason(db);
	if (!current) {
		throw new Error('ensureSeasons did not create a current season');
	}
	backfillGameSeasons(db, now);
	return current;
}

export function listSeasons(db: SeasonsDb): Season[] {
	const rows = db
		.prepare(
			`SELECT id, number, start_at, end_at, status FROM seasons ORDER BY number DESC`
		)
		.all() as SeasonRow[];
	return rows.map(mapSeason);
}

export function getCurrentSeason(db: SeasonsDb): Season | undefined {
	const row = db
		.prepare(
			`SELECT id, number, start_at, end_at, status FROM seasons WHERE status = 'active' ORDER BY number DESC LIMIT 1`
		)
		.get() as SeasonRow | undefined;
	return row ? mapSeason(row) : undefined;
}

export function getSeasonById(db: SeasonsDb, id: number): Season | undefined {
	const row = db
		.prepare(`SELECT id, number, start_at, end_at, status FROM seasons WHERE id = ?`)
		.get(id) as SeasonRow | undefined;
	return row ? mapSeason(row) : undefined;
}

export function getSeasonByNumber(db: SeasonsDb, number: number): Season | undefined {
	const row = db
		.prepare(`SELECT id, number, start_at, end_at, status FROM seasons WHERE number = ?`)
		.get(number) as SeasonRow | undefined;
	return row ? mapSeason(row) : undefined;
}

export function seasonForDate(db: SeasonsDb, playedAt: string, now = new Date()): Season | null {
	const settings = getSettings(db);
	if (!settings) return null;
	const number = seasonNumberForDate(settings.season_epoch, playedAt);
	if (number === null) return null;
	ensureSeasons(db, now, parseUtc(playedAt));
	return getSeasonByNumber(db, number) ?? null;
}

export function resolveSeasonParam(
	db: SeasonsDb,
	searchParams: URLSearchParams,
	now = new Date()
): Season | null {
	ensureSeasons(db, now);
	const seasonIdRaw = searchParams.get('seasonId');
	if (seasonIdRaw) {
		const id = parseInt(seasonIdRaw, 10);
		if (Number.isNaN(id)) return null;
		return getSeasonById(db, id) ?? null;
	}
	const seasonRaw = searchParams.get('season');
	if (seasonRaw) {
		const number = parseInt(seasonRaw, 10);
		if (Number.isNaN(number)) return null;
		return getSeasonByNumber(db, number) ?? null;
	}
	return getCurrentSeason(db) ?? null;
}

export function seasonToJson(season: Season) {
	return {
		id: season.id,
		number: season.number,
		startAt: season.startAt,
		endAt: season.endAt,
		status: season.status
	};
}

function backfillGameSeasons(db: SeasonsDb, now: Date): void {
	const missing = db
		.prepare('SELECT id, played_at FROM games')
		.all() as Array<{ id: number; played_at: string }>;
	if (missing.length === 0) return;

	const settings = getSettings(db);
	if (!settings) return;

	const insert = db.prepare(
		`INSERT OR IGNORE INTO seasons (number, start_at, end_at, status) VALUES (?, ?, ?, 'archived')`
	);
	const rewrite = db.prepare(`UPDATE seasons SET start_at = ?, end_at = ? WHERE number = ?`);
	const update = db.prepare('UPDATE games SET season_id = ? WHERE id = ?');
	const season1 = getSeasonByNumber(db, 1);
	const currentNumber = seasonNumberForDate(settings.season_epoch, now.toISOString()) ?? 1;

	for (const game of missing) {
		const number = seasonNumberForDate(settings.season_epoch, game.played_at);
		if (number && !getSeasonByNumber(db, number)) {
			const bounds = seasonBounds(settings.season_epoch, number);
			insert.run(number, bounds.startAt, bounds.endAt);
			rewrite.run(bounds.startAt, bounds.endAt, number);
		}
		const season = (number ? getSeasonByNumber(db, number) : null) ?? season1;
		if (!season) continue;
		update.run(season.id, game.id);
	}

	db.prepare(
		`UPDATE seasons SET status = CASE WHEN number = ? THEN 'active' ELSE 'archived' END`
	).run(currentNumber);
}
