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
	created_at: string;
}

// GET: Get current user's profile
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDb();
	const user = db
		.prepare(
			`
			SELECT 
				id,
				username,
				email,
				display_name,
				platforms,
				created_at
			FROM users
			WHERE id = ?
		`
		)
		.get(userId) as UserRow | undefined;

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	return json({
		profile: {
			id: user.id,
			username: user.username,
			email: user.email,
			displayName: user.display_name || null,
			platforms: JSON.parse(user.platforms || '[]'),
			createdAt: user.created_at
		}
	});
};

// PUT: Update current user's profile
export const PUT: RequestHandler = async ({ request, cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const { displayName, username, platforms } = await request.json();

	// Validation
	if (username !== undefined) {
		if (username.length < 1 || username.length > 50) {
			return json({ error: 'Username must be 1-50 characters' }, { status: 400 });
		}

		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			return json(
				{ error: 'Username can only contain letters, numbers, underscores, and hyphens' },
				{ status: 400 }
			);
		}
	}

	if (displayName !== undefined && displayName !== null && displayName.length > 50) {
		return json({ error: 'Display name must be 50 characters or less' }, { status: 400 });
	}

	if (platforms !== undefined) {
		if (!Array.isArray(platforms)) {
			return json({ error: 'Platforms must be an array' }, { status: 400 });
		}

		const validPlatforms = ['steam', 'android', 'iphone'];
		for (const platform of platforms) {
			if (!validPlatforms.includes(platform)) {
				return json({ error: `Invalid platform: ${platform}` }, { status: 400 });
			}
		}

		// Check for duplicates
		if (new Set(platforms).size !== platforms.length) {
			return json({ error: 'Platforms cannot contain duplicates' }, { status: 400 });
		}
	}

	const db = getDb();

	// Check username uniqueness if changed
	if (username !== undefined) {
		const existing = db
			.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
			.get(username, userId) as { id: number } | undefined;

		if (existing) {
			return json({ error: 'Username already taken' }, { status: 409 });
		}
	}

	// Update profile
	const updateFields: string[] = [];
	const updateValues: any[] = [];

	if (displayName !== undefined) {
		updateFields.push('display_name = ?');
		updateValues.push(displayName || null);
	}

	if (username !== undefined) {
		updateFields.push('username = ?');
		updateValues.push(username);
	}

	if (platforms !== undefined) {
		updateFields.push('platforms = ?');
		updateValues.push(JSON.stringify(platforms));
	}

	if (updateFields.length > 0) {
		updateFields.push('updated_at = CURRENT_TIMESTAMP');
		updateValues.push(userId);

		db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
	}

	// Return updated profile
	const updated = db
		.prepare(
			'SELECT id, username, email, display_name, platforms, created_at FROM users WHERE id = ?'
		)
		.get(userId) as UserRow;

	return json({
		success: true,
		profile: {
			id: updated.id,
			username: updated.username,
			email: updated.email,
			displayName: updated.display_name || null,
			platforms: JSON.parse(updated.platforms || '[]'),
			createdAt: updated.created_at
		}
	});
};
