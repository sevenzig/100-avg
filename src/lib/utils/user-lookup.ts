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
	/** League members (or other in-memory users) to search */
	users: LookupUser[];
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

/**
 * Finds a user by name, checking username and platform aliases (case-insensitive).
 * With `platform`, prefers that alias, then username, then other aliases.
 * Searches the provided `users` list (e.g. league members).
 */
export function findUserByName(
	name: string,
	options: FindUserByNameOptions
): UserLookupResult | null {
	const searchName = normalize(name);

	if (!searchName) {
		return null;
	}

	return matchInUsers(searchName, options.users, options.platform);
}
