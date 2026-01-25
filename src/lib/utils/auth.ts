import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '$env/dynamic/private';

const JWT_SECRET = env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
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
