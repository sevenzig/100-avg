import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';

export const GET: RequestHandler = async ({ cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDb();

	// Get all users with platform aliases (for league creation and screenshot matching)
	const users = db
		.prepare(
			'SELECT id, username, email, steam_alias, android_alias, iphone_alias FROM users ORDER BY username'
		)
		.all() as Array<{
		id: number;
		username: string;
		email: string;
		steam_alias: string | null;
		android_alias: string | null;
		iphone_alias: string | null;
	}>;

	return json({ users });
};
