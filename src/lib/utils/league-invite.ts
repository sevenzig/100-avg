import { randomBytes } from 'node:crypto';

export const LEAGUE_PLAYER_COLORS = [
	'player_1',
	'player_2',
	'player_3',
	'player_4',
	'player_5'
] as const;

export type LeaguePlayerColor = (typeof LEAGUE_PLAYER_COLORS)[number];

/** Minimal sqlite-like surface used by invite helpers (keeps tests off better-sqlite3). */
export interface InviteDb {
	prepare(sql: string): {
		get(...args: unknown[]): unknown;
		run(...args: unknown[]): unknown;
		all(...args: unknown[]): unknown;
	};
}

export function generateInviteCode(): string {
	return randomBytes(9).toString('base64url');
}

export function nextPlayerColor(usedColors: string[]): LeaguePlayerColor {
	const unused = LEAGUE_PLAYER_COLORS.find((color) => !usedColors.includes(color));
	if (unused) return unused;
	return LEAGUE_PLAYER_COLORS[usedColors.length % LEAGUE_PLAYER_COLORS.length];
}

export function ensureInviteCode(db: InviteDb, leagueId: number): string | null {
	const row = db.prepare('SELECT invite_code FROM leagues WHERE id = ?').get(leagueId) as
		| { invite_code: string | null }
		| undefined;
	if (!row) return null;
	if (row.invite_code) return row.invite_code;

	for (let attempt = 0; attempt < 5; attempt++) {
		const code = generateInviteCode();
		try {
			db.prepare('UPDATE leagues SET invite_code = ? WHERE id = ? AND invite_code IS NULL').run(
				code,
				leagueId
			);
			const saved = db.prepare('SELECT invite_code FROM leagues WHERE id = ?').get(leagueId) as {
				invite_code: string | null;
			};
			if (saved.invite_code) return saved.invite_code;
		} catch {
			// unique collision — retry
		}
	}
	throw new Error('Could not generate invite code');
}

export function joinLeagueByCode(
	db: InviteDb,
	code: string,
	userId: number
): { leagueId: number; name: string; alreadyMember: boolean } | null {
	const league = db.prepare('SELECT id, name FROM leagues WHERE invite_code = ?').get(code) as
		| { id: number; name: string }
		| undefined;
	if (!league) return null;

	const membership = db
		.prepare('SELECT user_id FROM league_players WHERE league_id = ? AND user_id = ?')
		.get(league.id, userId);
	if (membership) {
		return { leagueId: league.id, name: league.name, alreadyMember: true };
	}

	const used = db
		.prepare('SELECT player_color FROM league_players WHERE league_id = ?')
		.all(league.id) as Array<{ player_color: string }>;
	const color = nextPlayerColor(used.map((row) => row.player_color));
	db.prepare('INSERT INTO league_players (league_id, user_id, player_color) VALUES (?, ?, ?)').run(
		league.id,
		userId,
		color
	);

	return { leagueId: league.id, name: league.name, alreadyMember: false };
}
