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
		.prepare('SELECT id, username, email, created_at as createdAt, is_admin, is_super_admin FROM users WHERE id = ?')
		.get(decoded.userId) as
		| { id: number; username: string; email: string; createdAt: string; is_admin: number | null; is_super_admin: number | null }
		| undefined;

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	return json({
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			createdAt: user.createdAt,
			isAdmin: user.is_admin === 1,
			isSuperAdmin: user.is_super_admin === 1
		}
	});
};
