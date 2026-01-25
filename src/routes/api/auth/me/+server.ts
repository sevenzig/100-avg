import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { verifyToken } from '$lib/utils/auth';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('token');

	if (!token) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const decoded = verifyToken(token);
	if (!decoded) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDb();
	const user = db
		.prepare('SELECT id, username, email, created_at as createdAt FROM users WHERE id = ?')
		.get(decoded.userId) as
		| { id: number; username: string; email: string; createdAt: string }
		| undefined;

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	return json({ user });
};
