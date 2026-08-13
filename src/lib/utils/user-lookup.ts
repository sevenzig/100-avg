import { getDb } from './db';
import type { Platform } from '$lib/types/platform';
import { PLATFORMS } from '$lib/types/platform';

export interface LookupUser {
	id: number;
	username: string;
	steam_alias?: string | null;
	android_alias?: string | null;
	iphone_alias?: string | null;
}

export interface UserLookupResult {
	id: number;
	username: string;
}

export interface FindUserByNameOptions {
	/** Prefer this platform's alias, then username, then other aliases */
	platform?: Platform;
	/** If provided, search this list instead of the database */
	users?: LookupUser[];
}

const ALIAS_COLUMNS: Record<Platform, 'steam_alias' | 'android_alias' | 'iphone_alias'> = {
	steam: 'steam_alias',
	android: 'android_alias',
	iphone: 'iphone_alias'
};

function normalize(value: string | null | undefined): string {
	return (value ?? '').toLowerCase().trim();
}

function getAlias(user: LookupUser, platform: Platform): string {
	return normalize(user[ALIAS_COLUMNS[platform]]);
}

function toResult(user: LookupUser): UserLookupResult {
	return { id: user.id, username: user.username };
}

function matchInUsers(
	searchName: string,
	users: LookupUser[],
	platform?: Platform
): UserLookupResult | null {
	if (platform) {
		const preferred = users.find((u) => getAlias(u, platform) === searchName);
		if (preferred) return toResult(preferred);

		const byUsername = users.find((u) => normalize(u.username) === searchName);
		if (byUsername) return toResult(byUsername);

		for (const other of PLATFORMS) {
			if (other === platform) continue;
			const hit = users.find((u) => getAlias(u, other) === searchName);
			if (hit) return toResult(hit);
		}

		return null;
	}

	const anyMatch = users.find(
		(u) =>
			normalize(u.username) === searchName ||
			getAlias(u, 'steam') === searchName ||
			getAlias(u, 'android') === searchName ||
			getAlias(u, 'iphone') === searchName
	);

	return anyMatch ? toResult(anyMatch) : null;
}

function matchInDatabase(searchName: string, platform?: Platform): UserLookupResult | null {
	const db = getDb();

	if (platform) {
		const preferredCol = ALIAS_COLUMNS[platform];
		const preferred = db
			.prepare(
				`SELECT id, username FROM users WHERE LOWER(TRIM(${preferredCol})) = ? LIMIT 1`
			)
			.get(searchName) as { id: number; username: string } | undefined;
		if (preferred) return preferred;

		const byUsername = db
			.prepare('SELECT id, username FROM users WHERE LOWER(TRIM(username)) = ? LIMIT 1')
			.get(searchName) as { id: number; username: string } | undefined;
		if (byUsername) return byUsername;

		const others = PLATFORMS.filter((p) => p !== platform);
		const firstOther = others[0];
		const secondOther = others[1];
		if (!firstOther || !secondOther) {
			return null;
		}
		const other = db
			.prepare(
				`
				SELECT id, username
				FROM users
				WHERE LOWER(TRIM(${ALIAS_COLUMNS[firstOther]})) = ?
				   OR LOWER(TRIM(${ALIAS_COLUMNS[secondOther]})) = ?
				LIMIT 1
			`
			)
			.get(searchName, searchName) as { id: number; username: string } | undefined;

		return other || null;
	}

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

/**
 * Finds a user by name, checking username and platform aliases (case-insensitive).
 * With `platform`, prefers that alias, then username, then other aliases.
 * With `users`, searches that list (e.g. league members) instead of the database.
 */
export function findUserByName(
	name: string,
	options: FindUserByNameOptions = {}
): UserLookupResult | null {
	const searchName = normalize(name);

	if (!searchName) {
		return null;
	}

	if (options.users) {
		return matchInUsers(searchName, options.users, options.platform);
	}

	return matchInDatabase(searchName, options.platform);
}
