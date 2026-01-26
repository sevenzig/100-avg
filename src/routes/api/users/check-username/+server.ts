import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';

// GET: Check if username is available
export const GET: RequestHandler = async ({ cookies, url }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const username = url.searchParams.get('username');
	if (!username) {
		return json({ error: 'Username parameter is required' }, { status: 400 });
	}

	const db = getDb();

	// Check if username exists (excluding current user)
	const existing = db
		.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
		.get(username, userId) as { id: number } | undefined;

	return json({
		available: !existing
	});
};
