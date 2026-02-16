import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { json } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

/** Minimal cookies interface for server-side auth (e.g. SvelteKit request event cookies). */
export type CookieGetter = { get(name: string): string | undefined };

/** Minimal DB interface for auth helpers (avoids depending on better-sqlite3 types). */
export interface DbLike {
	prepare(sql: string): { get(...args: unknown[]): unknown };
}

// Security constants
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';

// Lazy JWT_SECRET getter - only evaluated at runtime, not build time
function getJwtSecret(): string {
	if (env.JWT_SECRET) {
		return env.JWT_SECRET;
	}
	if (dev) {
		console.warn('Warning: JWT_SECRET not set, using development fallback');
		return 'dev-only-secret-do-not-use-in-production';
	}
	throw new Error('JWT_SECRET environment variable is required in production');
}

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export function generateToken(userId: number): string {
	return jwt.sign({ userId }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: number } | null {
	try {
		const decoded = jwt.verify(token, getJwtSecret()) as { userId: number };
		return decoded;
	} catch (error) {
		return null;
	}
}

export function getUserIdFromRequest(request: Request): number | null {
	const cookies = request.headers.get('cookie');
	if (!cookies) return null;

	const tokenMatch = cookies.match(/token=([^;]+)/);
	if (!tokenMatch) return null;

	const token = tokenMatch[1];
	const decoded = verifyToken(token);
	return decoded?.userId || null;
}

export function getUserId(cookies: CookieGetter): number | null {
	const token = cookies.get('token');
	if (!token) return null;
	const decoded = verifyToken(token);
	return decoded?.userId || null;
}

export function isAdmin(userId: number, db: DbLike): boolean {
	const user = db
		.prepare('SELECT is_admin FROM users WHERE id = ?')
		.get(userId) as { is_admin: number | null } | undefined;
	return user?.is_admin === 1;
}

// Superadmin: full access to all leagues
export function isSuperAdmin(userId: number, db: DbLike): boolean {
	const user = db
		.prepare('SELECT is_super_admin FROM users WHERE id = ?')
		.get(userId) as { is_super_admin: number | null } | undefined;
	// Fall back to isAdmin if is_super_admin column doesn't exist yet
	if (user === undefined) {
		return isAdmin(userId, db);
	}
	return user?.is_super_admin === 1;
}

// League admin: user created this league
export function isLeagueAdmin(userId: number, leagueId: number, db: DbLike): boolean {
	const league = db
		.prepare('SELECT created_by FROM leagues WHERE id = ?')
		.get(leagueId) as { created_by: number } | undefined;
	return league?.created_by === userId;
}

// Can perform update/delete on games in this league
export function canManageLeagueGames(userId: number, leagueId: number, db: DbLike): boolean {
	return isSuperAdmin(userId, db) || isLeagueAdmin(userId, leagueId, db);
}

/** Throws a 401 JSON Response if not authenticated. Use in API routes: try { const userId = requireAuth(cookies); } catch (r) { return r; } */
export function requireAuth(cookies: CookieGetter): number {
	const userId = getUserId(cookies);
	if (!userId) throw json({ error: 'Not authenticated' }, { status: 401 });
	return userId;
}

/** Ensures user is authenticated and a member of the league (or admin). Throws 401 or 403 Response. Returns userId. */
export function requireLeagueMember(
	leagueId: number,
	cookies: CookieGetter,
	db: DbLike
): number {
	const userId = requireAuth(cookies);
	if (isAdmin(userId, db)) return userId;
	const membership = db
		.prepare('SELECT user_id FROM league_players WHERE league_id = ? AND user_id = ?')
		.get(leagueId, userId);
	if (!membership) throw json({ error: 'You are not a member of this league' }, { status: 403 });
	return userId;
}
