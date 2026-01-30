import { getDb } from './db';

interface UserLookupResult {
	id: number;
	username: string;
}

/**
 * Finds a user by name, checking username and all platform aliases (case-insensitive)
 * This handles cases where the same player uses different names on different platforms
 * (e.g., "hotnut" matches "sevenzig" if sevenzig has "hotnut" as a steam_alias)
 */
export function findUserByName(name: string): UserLookupResult | null {
	const searchName = name.toLowerCase().trim();

	if (!searchName) {
		return null;
	}

	const db = getDb();

	// Query to find user by username or any platform alias (case-insensitive)
	const user = db
		.prepare(
			`
		SELECT id, username
		FROM users
		WHERE LOWER(TRIM(username)) = ?
		   OR LOWER(TRIM(steam_alias)) = ?
		   OR LOWER(TRIM(android_alias)) = ?
		   OR LOWER(TRIM(iphone_alias)) = ?
		LIMIT 1
	`
		)
		.get(searchName, searchName, searchName, searchName) as
		| { id: number; username: string }
		| undefined;

	return user || null;
}
