import { describe, it, expect } from 'vitest';
import {
	PLATFORMS,
	PLATFORM_LABELS,
	isValidPlatform,
	validatePlatformAlias,
	getPlatformAliasError
} from '$lib/types/platform';

describe('platform types', () => {
	it('PLATFORMS contains steam, android, iphone', () => {
		expect(PLATFORMS).toContain('steam');
		expect(PLATFORMS).toContain('android');
		expect(PLATFORMS).toContain('iphone');
		expect(PLATFORMS).toHaveLength(3);
	});

	it('PLATFORM_LABELS maps to display names', () => {
		expect(PLATFORM_LABELS.steam).toBe('Steam');
		expect(PLATFORM_LABELS.android).toBe('Android');
		expect(PLATFORM_LABELS.iphone).toBe('iPhone');
	});
});

describe('isValidPlatform', () => {
	it('returns true for valid platforms', () => {
		expect(isValidPlatform('steam')).toBe(true);
		expect(isValidPlatform('android')).toBe(true);
		expect(isValidPlatform('iphone')).toBe(true);
	});

	it('returns false for invalid platforms', () => {
		expect(isValidPlatform('xbox')).toBe(false);
		expect(isValidPlatform('')).toBe(false);
		expect(isValidPlatform('STEAM')).toBe(false);
	});
});

describe('validatePlatformAlias', () => {
	it('accepts null or undefined', () => {
		expect(validatePlatformAlias(null)).toBe(true);
		expect(validatePlatformAlias(undefined)).toBe(true);
	});

	it('accepts short alias', () => {
		expect(validatePlatformAlias('hotnut')).toBe(true);
		expect(validatePlatformAlias('a'.repeat(100), 100)).toBe(true);
	});

	it('rejects alias over max length', () => {
		expect(validatePlatformAlias('a'.repeat(101), 100)).toBe(false);
	});
});

describe('getPlatformAliasError', () => {
	it('returns error when alias too long', () => {
		expect(getPlatformAliasError('steam', 'a'.repeat(101), 100)).toContain('100 characters');
	});

	it('returns empty string when alias valid', () => {
		expect(getPlatformAliasError('steam', 'hotnut', 100)).toBe('');
	});
});
