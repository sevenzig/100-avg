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

/**
 * Returns placement for each score when ordered by totalScore descending.
 * Ties (same totalScore) get the same placement; next lower score gets next ordinal.
 * Example: [100, 100, 90, 80] -> [1, 1, 3, 4].
 */
export function placementsFromTotalScores(scores: Array<{ totalScore: number }>): number[] {
	const sorted = [...scores]
		.map((s, i) => ({ totalScore: s.totalScore, index: i }))
		.sort((a, b) => b.totalScore - a.totalScore);
	const result: number[] = new Array(scores.length);
	let rank = 1;
	for (let i = 0; i < sorted.length; i++) {
		if (i > 0 && sorted[i].totalScore !== sorted[i - 1].totalScore) {
			rank = i + 1;
		}
		result[sorted[i].index] = rank;
	}
	return result;
}

/**
 * Validates that placements are consistent with ranking by totalScore.
 * Ties must share the same placement; next lower score gets next ordinal rank.
 * Returns validation result with error message if invalid.
 */
export function validatePlacementsConsistentWithScores(
	scores: Array<{ placement: number; totalScore: number }>
): ValidationResult {
	if (scores.length === 0) {
		return { valid: true };
	}

	// Check all placements are in valid range (1-5)
	for (const score of scores) {
		if (score.placement < 1 || score.placement > 5) {
			return { valid: false, error: 'Placements must be between 1 and 5' };
		}
	}

	// Compute expected placements from total scores
	const expected = placementsFromTotalScores(scores);

	// Compare each score's placement with expected
	for (let i = 0; i < scores.length; i++) {
		if (scores[i].placement !== expected[i]) {
			return {
				valid: false,
				error: 'Placements must be consistent with ranking by total score (ties share the same placement)'
			};
		}
	}

	return { valid: true };
}
