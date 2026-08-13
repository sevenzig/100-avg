import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';
import type { Platform, PlatformAliases } from '$lib/types/platform';
import { validateRequiredOnboardingPlatforms } from '$lib/utils/validation';

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

export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const { platforms, platformAliases } = await request.json();

	const onboardingResult = validateRequiredOnboardingPlatforms(platforms, platformAliases);
	if (!onboardingResult.valid) {
		return json({ error: onboardingResult.error || 'Invalid platform names' }, { status: 400 });
	}

	const selected = platforms as Platform[];
	const aliases = platformAliases as PlatformAliases;

	const db = getDb();
	db.prepare(
		`
		UPDATE users SET
			platforms = ?,
			steam_alias = ?,
			android_alias = ?,
			iphone_alias = ?,
			onboarding_completed = 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
		`
	).run(
		JSON.stringify(selected),
		selected.includes('steam') ? aliases.steam?.trim() || null : null,
		selected.includes('android') ? aliases.android?.trim() || null : null,
		selected.includes('iphone') ? aliases.iphone?.trim() || null : null,
		userId
	);

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
