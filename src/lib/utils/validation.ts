/**
 * Shared validation utilities for profile and platform data
 */

import type { Platform } from '$lib/types/platform';
import { PLATFORMS, validatePlatformAlias, getPlatformAliasError } from '$lib/types/platform';

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validates username format and length
 */
export function validateUsername(username: string): ValidationResult {
	if (!username.trim()) {
		return { valid: false, error: 'Username is required' };
	}

	if (username.length < 1 || username.length > 50) {
		return { valid: false, error: 'Username must be between 1 and 50 characters' };
	}

	if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
		return {
			valid: false,
			error: 'Username can only contain letters, numbers, underscores, and hyphens'
		};
	}

	return { valid: true };
}

/**
 * Validates display name length
 */
export function validateDisplayName(displayName: string | null | undefined): ValidationResult {
	if (!displayName) return { valid: true };

	if (displayName.length > 50) {
		return { valid: false, error: 'Display name must be 50 characters or less' };
	}

	return { valid: true };
}

/**
 * Validates platform array
 */
export function validatePlatforms(platforms: unknown): ValidationResult {
	if (!Array.isArray(platforms)) {
		return { valid: false, error: 'Platforms must be an array' };
	}

	for (const platform of platforms) {
		if (!PLATFORMS.includes(platform as Platform)) {
			return { valid: false, error: `Invalid platform: ${platform}` };
		}
	}

	// Check for duplicates
	if (new Set(platforms).size !== platforms.length) {
		return { valid: false, error: 'Platforms cannot contain duplicates' };
	}

	return { valid: true };
}

/**
 * Validates platform aliases object
 */
export function validatePlatformAliases(
	platformAliases: unknown,
	maxLength = 100
): ValidationResult {
	if (platformAliases === undefined) {
		return { valid: true };
	}

	if (typeof platformAliases !== 'object' || platformAliases === null) {
		return { valid: false, error: 'Platform aliases must be an object' };
	}

	for (const [platform, alias] of Object.entries(platformAliases)) {
		if (!PLATFORMS.includes(platform as Platform)) {
			return { valid: false, error: `Invalid platform: ${platform}` };
		}

		if (
			alias !== null &&
			alias !== undefined &&
			typeof alias === 'string' &&
			!validatePlatformAlias(alias, maxLength)
		) {
			return {
				valid: false,
				error: getPlatformAliasError(platform as Platform, alias, maxLength)
			};
		}
	}

	return { valid: true };
}
