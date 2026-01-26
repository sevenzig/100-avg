import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

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

export function getUserId(cookies: any): number | null {
	const token = cookies.get('token');
	if (!token) return null;
	const decoded = verifyToken(token);
	return decoded?.userId || null;
}

export function isAdmin(userId: number, db: any): boolean {
	const user = db
		.prepare('SELECT is_admin FROM users WHERE id = ?')
		.get(userId) as { is_admin: number | null } | undefined;
	return user?.is_admin === 1;
}
