import { describe, it, expect } from 'vitest';
import { generateInviteCode, nextPlayerColor, joinLeagueByCode } from '$lib/utils/league-invite';
import { safeJoinRedirect } from '$lib/utils/safe-redirect';

describe('generateInviteCode', () => {
	it('returns a URL-safe code of usable length', () => {
		const code = generateInviteCode();
		expect(code).toMatch(/^[A-Za-z0-9_-]{8,32}$/);
		expect(generateInviteCode()).not.toBe(code);
	});
});

describe('safeJoinRedirect', () => {
	it('allows a relative /join/<code> path', () => {
		expect(safeJoinRedirect('/join/AbC123_-xyZZ')).toBe('/join/AbC123_-xyZZ');
	});

	it('rejects open redirects and junk', () => {
		expect(safeJoinRedirect('https://evil.example/join/AbC123_-xyZZ')).toBeNull();
		expect(safeJoinRedirect('/leagues/1')).toBeNull();
		expect(safeJoinRedirect('/join/../admin')).toBeNull();
		expect(safeJoinRedirect('/join/short')).toBeNull();
		expect(safeJoinRedirect(null)).toBeNull();
	});
});

describe('nextPlayerColor', () => {
	it('picks the first unused color', () => {
		expect(nextPlayerColor([])).toBe('player_1');
		expect(nextPlayerColor(['player_1', 'player_2'])).toBe('player_3');
	});

	it('cycles after all five colors are taken', () => {
		expect(
			nextPlayerColor(['player_1', 'player_2', 'player_3', 'player_4', 'player_5'])
		).toBe('player_1');
	});
});

describe('joinLeagueByCode', () => {
	it('returns null for an unknown code', () => {
		const db = {
			prepare: () => ({
				get: () => undefined,
				run: () => undefined,
				all: () => []
			})
		};
		expect(joinLeagueByCode(db, 'nope-code', 1)).toBeNull();
	});

	it('skips insert when already a member', () => {
		let inserted = false;
		const db = {
			prepare: (sql: string) => ({
				get: () => {
					if (sql.includes('FROM leagues')) return { id: 1, name: 'Nest Cup' };
					if (sql.includes('league_players') && sql.includes('user_id')) return { user_id: 9 };
					return undefined;
				},
				run: () => {
					inserted = true;
				},
				all: () => []
			})
		};
		expect(joinLeagueByCode(db, 'AbC123_-xyZZ', 9)).toEqual({
			leagueId: 1,
			name: 'Nest Cup',
			alreadyMember: true
		});
		expect(inserted).toBe(false);
	});

	it('inserts a new member with the next color', () => {
		let inserted: unknown[] = [];
		const db = {
			prepare: (sql: string) => ({
				get: () => {
					if (sql.includes('FROM leagues')) return { id: 1, name: 'Nest Cup' };
					return undefined;
				},
				run: (...args: unknown[]) => {
					inserted = args;
				},
				all: () => [{ player_color: 'player_1' }]
			})
		};
		expect(joinLeagueByCode(db, 'AbC123_-xyZZ', 4)).toEqual({
			leagueId: 1,
			name: 'Nest Cup',
			alreadyMember: false
		});
		expect(inserted).toEqual([1, 4, 'player_2']);
	});
});
