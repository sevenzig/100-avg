import { describe, it, expect } from 'vitest';
import { findUserByName } from '$lib/utils/user-lookup';
import type { LookupUser } from '$lib/utils/user-lookup';

const league: LookupUser[] = [
	{
		id: 1,
		username: 'sevenzig',
		steam_alias: 'hotnut',
		android_alias: 'zig_mobile',
		iphone_alias: null
	},
	{
		id: 2,
		username: 'blabber',
		steam_alias: 'Blabberman23',
		android_alias: null,
		iphone_alias: 'blab_ios'
	}
];

const outsider: LookupUser = {
	id: 99,
	username: 'outsider',
	steam_alias: 'hotnut',
	android_alias: null,
	iphone_alias: null
};

describe('findUserByName with league users', () => {
	it('prefers the selected platform alias over username', () => {
		const match = findUserByName('hotnut', { platform: 'steam', users: league });
		expect(match).toEqual({ id: 1, username: 'sevenzig' });
	});

	it('falls back to username when platform alias does not match', () => {
		const match = findUserByName('sevenzig', { platform: 'steam', users: league });
		expect(match).toEqual({ id: 1, username: 'sevenzig' });
	});

	it('falls back to other platform aliases when preferred alias misses', () => {
		const match = findUserByName('zig_mobile', { platform: 'steam', users: league });
		expect(match).toEqual({ id: 1, username: 'sevenzig' });
	});

	it('is case-insensitive and trims whitespace', () => {
		const match = findUserByName('  HOTNUT  ', { platform: 'steam', users: league });
		expect(match).toEqual({ id: 1, username: 'sevenzig' });
	});

	it('does not match users outside the provided league list', () => {
		const match = findUserByName('hotnut', { platform: 'steam', users: league });
		expect(match?.id).toBe(1);
		expect(findUserByName('outsider', { platform: 'steam', users: league })).toBeNull();
		expect(findUserByName('hotnut', { platform: 'steam', users: [outsider] })?.id).toBe(99);
	});

	it('returns null for unmatched names', () => {
		expect(findUserByName('unknown', { platform: 'iphone', users: league })).toBeNull();
		expect(findUserByName('', { users: league })).toBeNull();
	});

	it('without platform, matches any username or alias', () => {
		expect(findUserByName('blab_ios', { users: league })).toEqual({ id: 2, username: 'blabber' });
		expect(findUserByName('Blabberman23', { users: league })).toEqual({ id: 2, username: 'blabber' });
	});
});
