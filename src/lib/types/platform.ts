/**
 * Platform types and constants for the Wingspan Score Tracker
 */

export type Platform = 'steam' | 'android' | 'iphone';

export const PLATFORMS: readonly Platform[] = ['steam', 'android', 'iphone'] as const;

export const PLATFORM_LABELS: Record<Platform, string> = {
	steam: 'Steam',
	android: 'Android',
	iphone: 'iPhone'
} as const;

export interface PlatformAliases {
	steam?: string | null;
	android?: string | null;
	iphone?: string | null;
}

export interface PlatformConfig {
	id: Platform;
	label: string;
	aliasLabel: string;
	placeholder: string;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
	steam: {
		id: 'steam',
		label: 'Steam',
		aliasLabel: 'Steam Name',
		placeholder: 'Your Steam username/alias'
	},
	android: {
		id: 'android',
		label: 'Android',
		aliasLabel: 'Android Name',
		placeholder: 'Your Android username/alias'
	},
	iphone: {
		id: 'iphone',
		label: 'iPhone',
		aliasLabel: 'iPhone Name',
		placeholder: 'Your iPhone username/alias'
	}
} as const;

/**
 * Validates if a string is a valid platform
 */
export function isValidPlatform(value: string): value is Platform {
	return PLATFORMS.includes(value as Platform);
}

/**
 * Validates platform alias length
 */
export function validatePlatformAlias(alias: string | null | undefined, maxLength = 100): boolean {
	if (!alias) return true;
	return alias.length <= maxLength;
}

/**
 * Gets the error message for an invalid platform alias
 */
export function getPlatformAliasError(platform: Platform, alias: string, maxLength = 100): string {
	if (alias.length > maxLength) {
		return `${PLATFORM_LABELS[platform]} alias must be ${maxLength} characters or less`;
	}
	return '';
}
