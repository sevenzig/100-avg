import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';

interface UserRow {
	id: number;
	username: string;
	email: string;
	display_name: string | null;
	platforms: string;
	steam_alias: string | null;
	android_alias: string | null;
	iphone_alias: string | null;
	created_at: string;
}

// GET: Get a specific user's profile (public info only)
export const GET: RequestHandler = async ({ params, cookies }) => {
	const currentUserId = getUserId(cookies);
	if (!currentUserId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const targetUserId = parseInt(params.userid);
	if (isNaN(targetUserId)) {
		return json({ error: 'Invalid user ID' }, { status: 400 });
	}

	const db = getDb();

	// Get user profile (public info only - no email for other users)
	const user = db
		.prepare(
			`
			SELECT 
				id,
				username,
				display_name,
				platforms,
				steam_alias,
				android_alias,
				iphone_alias,
				created_at
			FROM users
			WHERE id = ?
		`
		)
		.get(targetUserId) as Omit<UserRow, 'email'> | undefined;

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	return json({
		profile: {
			id: user.id,
			username: user.username,
			displayName: user.display_name || null,
			platforms: JSON.parse(user.platforms || '[]'),
			platformAliases: {
				steam: user.steam_alias || null,
				android: user.android_alias || null,
				iphone: user.iphone_alias || null
			},
			createdAt: user.created_at,
			isOwnProfile: currentUserId === targetUserId
		}
	});
};
