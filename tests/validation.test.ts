import { describe, it, expect } from 'vitest';
import {
	validateUsername,
	validateDisplayName,
	validatePlatforms,
	validatePlatformAliases,
	validatePlacementsConsistentWithScores,
	placementsFromTotalScores
} from '$lib/utils/validation';

describe('validateUsername', () => {
	it('rejects empty or whitespace-only', () => {
		expect(validateUsername('').valid).toBe(false);
		expect(validateUsername('   ').valid).toBe(false);
	});

	it('rejects out-of-range length', () => {
		expect(validateUsername('ab').valid).toBe(true); // 2 chars ok (1-50)
		expect(validateUsername('a'.repeat(51)).valid).toBe(false);
	});

	it('rejects invalid characters', () => {
		expect(validateUsername('user name').valid).toBe(false);
		expect(validateUsername('user@name').valid).toBe(false);
		expect(validateUsername('user_name').valid).toBe(true);
		expect(validateUsername('user-name').valid).toBe(true);
		expect(validateUsername('User123').valid).toBe(true);
	});

	it('accepts valid usernames', () => {
		expect(validateUsername('sevenzig').valid).toBe(true);
		expect(validateUsername('hotnut').valid).toBe(true);
		expect(validateUsername('a').valid).toBe(true);
	});
});

describe('validateDisplayName', () => {
	it('accepts null/undefined/empty', () => {
		expect(validateDisplayName(null).valid).toBe(true);
		expect(validateDisplayName(undefined).valid).toBe(true);
	});

	it('rejects over 50 characters', () => {
		expect(validateDisplayName('a'.repeat(51)).valid).toBe(false);
	});

	it('accepts up to 50 characters', () => {
		expect(validateDisplayName('a'.repeat(50)).valid).toBe(true);
	});
});

describe('validatePlatforms', () => {
	it('rejects non-array', () => {
		expect(validatePlatforms(null).valid).toBe(false);
		expect(validatePlatforms({}).valid).toBe(false);
		expect(validatePlatforms('steam').valid).toBe(false);
	});

	it('accepts valid platform arrays', () => {
		expect(validatePlatforms([]).valid).toBe(true);
		expect(validatePlatforms(['steam']).valid).toBe(true);
		expect(validatePlatforms(['steam', 'android', 'iphone']).valid).toBe(true);
	});

	it('rejects invalid platform values', () => {
		expect(validatePlatforms(['xbox']).valid).toBe(false);
		expect(validatePlatforms(['steam', 'pc']).valid).toBe(false);
	});

	it('rejects duplicate platforms', () => {
		expect(validatePlatforms(['steam', 'steam']).valid).toBe(false);
	});
});

describe('validatePlatformAliases', () => {
	it('accepts undefined', () => {
		expect(validatePlatformAliases(undefined).valid).toBe(true);
	});

	it('rejects null', () => {
		expect(validatePlatformAliases(null).valid).toBe(false);
	});

	it('accepts valid aliases object', () => {
		expect(validatePlatformAliases({}).valid).toBe(true);
		expect(validatePlatformAliases({ steam: 'hotnut', android: null }).valid).toBe(true);
	});

	it('rejects alias over max length', () => {
		expect(validatePlatformAliases({ steam: 'a'.repeat(101) }, 100).valid).toBe(false);
	});

	it('rejects invalid platform keys', () => {
		expect(validatePlatformAliases({ xbox: 'gamer' }).valid).toBe(false);
	});
});

describe('placementsFromTotalScores', () => {
	it('assigns same placement for ties', () => {
		const scores = [{ totalScore: 100 }, { totalScore: 100 }, { totalScore: 90 }];
		expect(placementsFromTotalScores(scores)).toEqual([1, 1, 3]);
	});

	it('assigns sequential ranks when no ties', () => {
		const scores = [{ totalScore: 100 }, { totalScore: 90 }, { totalScore: 80 }];
		expect(placementsFromTotalScores(scores)).toEqual([1, 2, 3]);
	});

	it('handles single score', () => {
		expect(placementsFromTotalScores([{ totalScore: 50 }])).toEqual([1]);
	});

	it('handles all ties', () => {
		const scores = [
			{ totalScore: 80 },
			{ totalScore: 80 },
			{ totalScore: 80 },
			{ totalScore: 80 }
		];
		expect(placementsFromTotalScores(scores)).toEqual([1, 1, 1, 1]);
	});

	it('handles 5 players with mixed ties', () => {
		const scores = [
			{ totalScore: 100 },
			{ totalScore: 100 },
			{ totalScore: 90 },
			{ totalScore: 80 },
			{ totalScore: 80 }
		];
		expect(placementsFromTotalScores(scores)).toEqual([1, 1, 3, 4, 4]);
	});
});

describe('validatePlacementsConsistentWithScores', () => {
	it('accepts valid placements matching score order', () => {
		const scores = [
			{ placement: 1, totalScore: 100 },
			{ placement: 2, totalScore: 90 },
			{ placement: 3, totalScore: 80 }
		];
		expect(validatePlacementsConsistentWithScores(scores).valid).toBe(true);
	});

	it('accepts ties with same placement', () => {
		const scores = [
			{ placement: 1, totalScore: 100 },
			{ placement: 1, totalScore: 100 },
			{ placement: 3, totalScore: 80 }
		];
		expect(validatePlacementsConsistentWithScores(scores).valid).toBe(true);
	});

	it('rejects placement out of range 1-5', () => {
		const scores = [{ placement: 0, totalScore: 100 }];
		expect(validatePlacementsConsistentWithScores(scores).valid).toBe(false);
		const scores2 = [{ placement: 6, totalScore: 100 }];
		expect(validatePlacementsConsistentWithScores(scores2).valid).toBe(false);
	});

	it('rejects placements inconsistent with score order', () => {
		const scores = [
			{ placement: 2, totalScore: 100 },
			{ placement: 1, totalScore: 90 }
		];
		expect(validatePlacementsConsistentWithScores(scores).valid).toBe(false);
	});

	it('accepts empty array', () => {
		expect(validatePlacementsConsistentWithScores([]).valid).toBe(true);
	});

	it('rejects when tie has wrong placement', () => {
		const scores = [
			{ placement: 1, totalScore: 100 },
			{ placement: 2, totalScore: 100 },
			{ placement: 3, totalScore: 80 }
		];
		expect(validatePlacementsConsistentWithScores(scores).valid).toBe(false);
	});

	it('accepts 5 players with valid placements', () => {
		const scores = [
			{ placement: 1, totalScore: 95 },
			{ placement: 2, totalScore: 90 },
			{ placement: 3, totalScore: 85 },
			{ placement: 4, totalScore: 80 },
			{ placement: 5, totalScore: 75 }
		];
		expect(validatePlacementsConsistentWithScores(scores).valid).toBe(true);
	});
});
