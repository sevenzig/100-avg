import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

// Security constants
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';

// In production, JWT_SECRET must be set - fail fast if missing
const JWT_SECRET = (() => {
	if (env.JWT_SECRET) {
		return env.JWT_SECRET;
	}
	if (dev) {
		console.warn('Warning: JWT_SECRET not set, using development fallback');
		return 'dev-only-secret-do-not-use-in-production';
	}
	throw new Error('JWT_SECRET environment variable is required in production');
})();

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export function generateToken(userId: number): string {
	return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: number } | null {
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
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
