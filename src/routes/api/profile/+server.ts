import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';
import type { PlatformAliases } from '$lib/types/platform';
import {
	validateUsername,
	validateDisplayName,
	validatePlatforms,
	validatePlatformAliases
} from '$lib/utils/validation';

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
				steam_alias,
				android_alias,
				iphone_alias,
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
			platformAliases: {
				steam: user.steam_alias || null,
				android: user.android_alias || null,
				iphone: user.iphone_alias || null
			},
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

	const { displayName, username, platforms, platformAliases } = await request.json();

	// Validation using shared utilities
	if (username !== undefined) {
		const usernameResult = validateUsername(username);
		if (!usernameResult.valid) {
			return json({ error: usernameResult.error || 'Invalid username' }, { status: 400 });
		}
	}

	if (displayName !== undefined) {
		const displayNameResult = validateDisplayName(displayName);
		if (!displayNameResult.valid) {
			return json({ error: displayNameResult.error || 'Invalid display name' }, { status: 400 });
		}
	}

	if (platforms !== undefined) {
		const platformsResult = validatePlatforms(platforms);
		if (!platformsResult.valid) {
			return json({ error: platformsResult.error || 'Invalid platforms' }, { status: 400 });
		}
	}

	if (platformAliases !== undefined) {
		const aliasesResult = validatePlatformAliases(platformAliases);
		if (!aliasesResult.valid) {
			return json({ error: aliasesResult.error || 'Invalid platform aliases' }, { status: 400 });
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

	if (platformAliases !== undefined) {
		// Only update aliases for platforms that are provided
		// This allows partial updates without clearing other aliases
		const aliases = platformAliases as PlatformAliases;
		if ('steam' in aliases) {
			updateFields.push('steam_alias = ?');
			updateValues.push(aliases.steam || null);
		}
		if ('android' in aliases) {
			updateFields.push('android_alias = ?');
			updateValues.push(aliases.android || null);
		}
		if ('iphone' in aliases) {
			updateFields.push('iphone_alias = ?');
			updateValues.push(aliases.iphone || null);
		}
	}

	if (updateFields.length > 0) {
		updateFields.push('updated_at = CURRENT_TIMESTAMP');
		updateValues.push(userId);

		db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
	}

	// Return updated profile
	const updated = db
		.prepare(
			'SELECT id, username, email, display_name, platforms, steam_alias, android_alias, iphone_alias, created_at FROM users WHERE id = ?'
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
			platformAliases: {
				steam: updated.steam_alias || null,
				android: updated.android_alias || null,
				iphone: updated.iphone_alias || null
			},
			createdAt: updated.created_at
		}
	});
};
