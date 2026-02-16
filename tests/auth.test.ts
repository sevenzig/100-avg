import { describe, it, expect, beforeAll } from 'vitest';
import { requireAuth, requireLeagueMember, generateToken } from '$lib/utils/auth';

describe('requireAuth', () => {
	it('throws 401 when cookie has no token', () => {
		const cookies = { get: () => undefined };
		try {
			requireAuth(cookies);
			expect.fail('should have thrown');
		} catch (r: unknown) {
			expect(r).toBeInstanceOf(Response);
			expect((r as Response).status).toBe(401);
		}
	});

	it('throws 401 when cookie has empty token', () => {
		const cookies = { get: () => '' };
		try {
			requireAuth(cookies);
			expect.fail('should have thrown');
		} catch (r: unknown) {
			expect(r).toBeInstanceOf(Response);
			expect((r as Response).status).toBe(401);
		}
	});

	it('throws 401 when token is invalid', () => {
		const cookies = { get: () => 'invalid-jwt' };
		try {
			requireAuth(cookies);
			expect.fail('should have thrown');
		} catch (r: unknown) {
			expect(r).toBeInstanceOf(Response);
			expect((r as Response).status).toBe(401);
		}
	});

	it('returns userId when token is valid', () => {
		const token = generateToken(42);
		const cookies = { get: () => token };
		expect(requireAuth(cookies)).toBe(42);
	});
});

describe('requireLeagueMember', () => {
	it('throws 401 when not authenticated', () => {
		const cookies = { get: () => undefined };
		const db = {
			prepare: () => ({ get: () => undefined })
		};
		try {
			requireLeagueMember(1, cookies, db);
			expect.fail('should have thrown');
		} catch (r: unknown) {
			expect(r).toBeInstanceOf(Response);
			expect((r as Response).status).toBe(401);
		}
	});

	it('throws 403 when authenticated but not admin and not in league', () => {
		const token = generateToken(99);
		const cookies = { get: () => token };
		// is_admin = 0, no league_players row
		const db = {
			prepare: (sql: string) => ({
				get: (..._args: unknown[]) => {
					if (sql.includes('is_admin')) return { is_admin: 0 };
					if (sql.includes('league_players')) return undefined;
					return undefined;
				}
			})
		};
		try {
			requireLeagueMember(1, cookies, db);
			expect.fail('should have thrown');
		} catch (r: unknown) {
			expect(r).toBeInstanceOf(Response);
			expect((r as Response).status).toBe(403);
		}
	});

	it('returns userId when user is admin', () => {
		const token = generateToken(7);
		const cookies = { get: () => token };
		const db = {
			prepare: (sql: string) => ({
				get: (..._args: unknown[]) => {
					if (sql.includes('is_admin')) return { is_admin: 1 };
					return undefined;
				}
			})
		};
		expect(requireLeagueMember(1, cookies, db)).toBe(7);
	});

	it('returns userId when user is league member', () => {
		const token = generateToken(3);
		const cookies = { get: () => token };
		const db = {
			prepare: (sql: string) => ({
				get: (...args: unknown[]) => {
					if (sql.includes('is_admin')) return { is_admin: 0 };
					if (sql.includes('league_players')) return { user_id: 3 };
					return undefined;
				}
			})
		};
		expect(requireLeagueMember(1, cookies, db)).toBe(3);
	});
});
