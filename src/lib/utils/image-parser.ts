import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { env } from '$env/dynamic/private';
import type { ExtractedGameData, ExtractedPlayer } from '$lib/types/screenshot-upload';

/** Anthropic limits base64 images to 5 MB. Raw buffer must stay under ~3.75 MB to fit. */
const ANTHROPIC_MAX_BASE64_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_RAW_BYTES = Math.floor((ANTHROPIC_MAX_BASE64_BYTES * 3) / 4) - 1024 * 100; // ~3.65 MB with margin

/** Vision requests can take 30–90+ seconds; use 2 minutes so the SDK doesn’t time out. */
const VISION_REQUEST_TIMEOUT_MS = 120000;

// Initialize Anthropic client with API key validation
function getAnthropicClient() {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY environment variable is not set');
	}
	return new Anthropic({ apiKey, timeout: VISION_REQUEST_TIMEOUT_MS });
}

/** Resize/compress image so raw size is under MAX_RAW_BYTES for Claude API. */
async function resizeToFitLimit(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
	const meta = await sharp(buffer).metadata();
	let width = meta.width ?? 1920;
	let height = meta.height ?? 1080;
	let quality = 85;

	for (let attempt = 0; attempt < 8; attempt++) {
		const out = await sharp(buffer)
			.resize(Math.min(width, 2048), Math.min(height, 2048), { fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality, mozjpeg: true })
			.toBuffer();
		if (out.length <= MAX_RAW_BYTES) {
			console.log(
				`[ImageParser] Resized image from ${buffer.length} to ${out.length} bytes (${width}x${height}, q${quality})`
			);
			return { buffer: out, mimeType: 'image/jpeg' };
		}
		width = Math.floor(width * 0.75);
		height = Math.floor(height * 0.75);
		quality = Math.max(50, quality - 10);
	}
	// Last resort: aggressive shrink
	const out = await sharp(buffer).resize(1280, 720, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
	console.log(`[ImageParser] Aggressive resize to ${out.length} bytes`);
	return { buffer: out, mimeType: 'image/jpeg' };
}

export async function parseScreenshot(imageBuffer: Buffer): Promise<ExtractedGameData> {
	const startTime = Date.now();
	try {
		// Ensure image is under Claude's 5 MB base64 limit by resizing if needed
		let buffer = imageBuffer;
		let mimeType: string =
			imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 ? 'image/png' : 'image/jpeg';
		if (imageBuffer.length > MAX_RAW_BYTES) {
			const resized = await resizeToFitLimit(imageBuffer);
			buffer = resized.buffer;
			mimeType = resized.mimeType;
		}

		// Get Anthropic client (validates API key)
		const anthropic = getAnthropicClient();

		const base64Image = buffer.toString('base64');
		console.log(`[ImageParser] Starting Claude API request (image size: ${buffer.length} bytes, base64: ${base64Image.length} chars)`);

		const apiStartTime = Date.now();
		// Use current vision-capable Sonnet model (claude-3-5-sonnet-20241022 is deprecated/404)
		const response = await anthropic.messages.create(
			{
				model: 'claude-sonnet-4-5-20250929',
				max_tokens: 4096,
				messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image',
							source: {
								type: 'base64',
								media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
								data: base64Image
							}
						},
						{
							type: 'text',
							text: `You are extracting final scores from a Wingspan board game end-of-game screenshot.

WINGSPAN SCORING LAYOUT:
The score screen shows a table with players as columns and scoring categories as rows:
- Row order (top to bottom): Birds, Bonus Cards, End-of-Round Goals, Eggs, Food on Cards, Tucked Cards, Nectar (if Oceania expansion)
- The TOTAL score is shown prominently for each player
- Player names appear at the top of each column
- Some versions label categories differently:
  - "Bonus Cards" may appear as "Bonus" or "End-of-game bonuses"
  - "End-of-Round Goals" may appear as "Round goals" or "Goals"
  - "Food on Cards" may appear as "Cached food" or "Food cached"
  - "Tucked Cards" may appear as "Tucked" or "Cards tucked"

EXTRACTION INSTRUCTIONS:
1. Identify each player's column by their username at the top
2. For each player, read down their column to get each scoring category value
3. The displayed total should equal: birds + bonusCards + endOfRoundGoals + eggs + foodOnCards + tuckedCards + nectar
4. If nectar column is missing (base game without Oceania), use 0 for nectar

CRITICAL VERIFICATION:
- Double-check that the sum of breakdown values equals the displayed total for each player
- If they don't match, re-read the values carefully - OCR errors are common with similar-looking digits (0/8, 1/7, 3/8, 5/6)
- Player names are case-sensitive - preserve exact capitalization

Return ONLY valid JSON (no markdown, no explanation):
{
  "players": [
    {
      "playerName": "ExactPlayerName",
      "totalScore": 0,
      "scoringBreakdown": {
        "birds": 0,
        "bonusCards": 0,
        "endOfRoundGoals": 0,
        "eggs": 0,
        "foodOnCards": 0,
        "tuckedCards": 0,
        "nectar": 0
      }
    }
  ],
  "extractionNotes": "Any uncertainty or issues noticed during extraction"
}`
						}
					]
				}
			]
			},
			{ timeout: VISION_REQUEST_TIMEOUT_MS }
		);
		const apiTime = Date.now() - apiStartTime;
		console.log(`[ImageParser] Claude API responded in ${apiTime}ms`);

		const content = response.content[0];
		if (content.type !== 'text') {
			throw new Error('Unexpected response type from Claude API');
		}

		const textContent = content.text;
		if (!textContent) {
			throw new Error('No content returned from Claude API');
		}

		// Extract JSON from response (Claude may wrap it in markdown code blocks)
		const jsonMatch =
			textContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
			textContent.match(/(\{[\s\S]*\})/);

		if (!jsonMatch) {
			throw new Error('Could not extract JSON from Claude response');
		}

		const parsedData = JSON.parse(jsonMatch[1]) as ExtractedGameData;

		// Validate and calculate placements
		if (!parsedData.players || !Array.isArray(parsedData.players)) {
			throw new Error('Invalid data structure: players array missing');
		}

		// Sort by total score and assign placements (ties get same placement)
		const sortedPlayers = [...parsedData.players].sort((a, b) => b.totalScore - a.totalScore);
		let rank = 1;
		sortedPlayers.forEach((player, index) => {
			if (index > 0 && player.totalScore !== sortedPlayers[index - 1].totalScore) {
				rank = index + 1;
			}
			player.placement = rank;
		});

		// Ensure all scoring breakdown values are numbers
		for (const player of parsedData.players) {
			if (!player.scoringBreakdown) {
				player.scoringBreakdown = {
					birds: 0,
					bonusCards: 0,
					endOfRoundGoals: 0,
					eggs: 0,
					foodOnCards: 0,
					tuckedCards: 0,
					nectar: 0
				};
			} else {
				// Ensure all values are numbers
				player.scoringBreakdown = {
					birds: Number(player.scoringBreakdown.birds) || 0,
					bonusCards: Number(player.scoringBreakdown.bonusCards) || 0,
					endOfRoundGoals: Number(player.scoringBreakdown.endOfRoundGoals) || 0,
					eggs: Number(player.scoringBreakdown.eggs) || 0,
					foodOnCards: Number(player.scoringBreakdown.foodOnCards) || 0,
					tuckedCards: Number(player.scoringBreakdown.tuckedCards) || 0,
					nectar: Number(player.scoringBreakdown.nectar) || 0
				};
			}

			// Recalculate total score from breakdown
			player.totalScore =
				player.scoringBreakdown.birds +
				player.scoringBreakdown.bonusCards +
				player.scoringBreakdown.endOfRoundGoals +
				player.scoringBreakdown.eggs +
				player.scoringBreakdown.foodOnCards +
				player.scoringBreakdown.tuckedCards +
				player.scoringBreakdown.nectar;
		}

		// Re-sort after recalculating totals and assign placements (ties get same placement)
		const finalSorted = [...parsedData.players].sort((a, b) => b.totalScore - a.totalScore);
		let finalRank = 1;
		finalSorted.forEach((player, index) => {
			if (index > 0 && player.totalScore !== finalSorted[index - 1].totalScore) {
				finalRank = index + 1;
			}
			player.placement = finalRank;
		});

		return parsedData;
	} catch (error) {
		if (error instanceof Error) {
			// Handle image size limit (5 MB base64) — should be prevented by resize; surface clear message if it slips through
			if (
				error.message.includes('exceeds 5 MB') ||
				error.message.includes('5242880') ||
				error.message.includes('image exceeds')
			) {
				throw new Error(
					'Image is too large for processing. Please try a smaller screenshot or a different image.'
				);
			}
			// Handle API key errors
			if (error.message.includes('ANTHROPIC_API_KEY') || error.message.includes('api key')) {
				throw new Error('API key not configured. Please contact the administrator.');
			}
			// Handle API rate limits
			if (error.message.includes('rate limit') || error.message.includes('429')) {
				throw new Error('API rate limit exceeded. Please try again later.');
			}
			// Handle timeouts
			if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
				throw new Error('Request timed out. The image processing is taking too long. Please try again.');
			}
			// Handle authentication errors
			if (error.message.includes('401') || error.message.includes('authentication')) {
				throw new Error('API authentication failed. Please contact the administrator.');
			}
			// Handle model not found (404 — model ID may be deprecated)
			if (
				error.message.includes('not_found_error') ||
				(error.message.includes('404') && error.message.includes('model'))
			) {
				throw new Error(
					'Screenshot processing model is unavailable. Please contact the administrator to update the app.'
				);
			}
			// Handle network errors
			if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
				throw new Error('Cannot connect to API service. Please check your connection and try again.');
			}
		}
		// Re-throw with original error for logging
		console.error('Image parsing error:', error);
		throw error;
	}
}

/** Calculate breakdown sum for a player */
function getBreakdownSum(p: ExtractedPlayer): number {
	return (
		p.scoringBreakdown.birds +
		p.scoringBreakdown.bonusCards +
		p.scoringBreakdown.endOfRoundGoals +
		p.scoringBreakdown.eggs +
		p.scoringBreakdown.foodOnCards +
		p.scoringBreakdown.tuckedCards +
		p.scoringBreakdown.nectar
	);
}

/** Wingspan-specific scoring constraints for validation */
const WINGSPAN_CONSTRAINTS = {
	// Typical score ranges based on game data analysis
	minTotalScore: 30, // Very low scores are suspicious
	maxTotalScore: 180, // Very high scores are rare but possible
	maxBirds: 100, // 15 birds max * ~7 points average
	maxBonusCards: 50, // Typically 2 bonus cards, max ~25 each
	maxEndOfRoundGoals: 25, // 4 rounds * max 6-7 points
	maxEggs: 40, // Many eggs possible with egg-laying strategies
	maxFoodOnCards: 50, // Food caching strategies can accumulate
	maxTuckedCards: 40, // Tucking strategies can accumulate
	maxNectar: 20, // Oceania expansion nectar scoring
	// Player count constraints
	minPlayers: 1,
	maxPlayers: 5
};

export function calculateConfidence(data: ExtractedGameData): number {
	if (!data.players || data.players.length === 0) {
		return 0;
	}

	let confidence = 0.4; // Base confidence (lower starting point for more granular scoring)
	const playerCount = data.players.length;

	// Player count validity (+0.1)
	if (playerCount >= WINGSPAN_CONSTRAINTS.minPlayers && playerCount <= WINGSPAN_CONSTRAINTS.maxPlayers) {
		confidence += 0.1;
	}

	// All players have non-empty names (+0.15)
	const allHaveNames = data.players.every((p) => p.playerName && p.playerName.trim().length > 0);
	if (allHaveNames) confidence += 0.15;

	// Names look like valid usernames (not placeholder text) (+0.05)
	const namesLookValid = data.players.every((p) => {
		const name = p.playerName?.trim() || '';
		// Check it's not a common placeholder or label
		const placeholders = ['player', 'name', 'total', 'score', 'unknown', '???', '...'];
		return name.length >= 2 && !placeholders.includes(name.toLowerCase());
	});
	if (namesLookValid) confidence += 0.05;

	// All total scores in reasonable range (+0.1)
	const scoresInRange = data.players.every(
		(p) =>
			p.totalScore >= WINGSPAN_CONSTRAINTS.minTotalScore &&
			p.totalScore <= WINGSPAN_CONSTRAINTS.maxTotalScore &&
			Number.isInteger(p.totalScore)
	);
	if (scoresInRange) confidence += 0.1;

	// All breakdown values are non-negative integers (+0.05)
	const breakdownsValid = data.players.every((p) => {
		const b = p.scoringBreakdown;
		return (
			Object.values(b).every((v) => typeof v === 'number' && v >= 0 && Number.isInteger(v))
		);
	});
	if (breakdownsValid) confidence += 0.05;

	// Breakdown sums match totals exactly (+0.15)
	const breakdownsMatchExact = data.players.every((p) => getBreakdownSum(p) === p.totalScore);
	if (breakdownsMatchExact) {
		confidence += 0.15;
	} else {
		// Partial credit if within 1 point (rounding tolerance)
		const breakdownsMatchClose = data.players.every(
			(p) => Math.abs(getBreakdownSum(p) - p.totalScore) <= 1
		);
		if (breakdownsMatchClose) confidence += 0.08;
	}

	// Individual category values within realistic ranges (+0.1)
	const categoriesInRange = data.players.every((p) => {
		const b = p.scoringBreakdown;
		return (
			b.birds <= WINGSPAN_CONSTRAINTS.maxBirds &&
			b.bonusCards <= WINGSPAN_CONSTRAINTS.maxBonusCards &&
			b.endOfRoundGoals <= WINGSPAN_CONSTRAINTS.maxEndOfRoundGoals &&
			b.eggs <= WINGSPAN_CONSTRAINTS.maxEggs &&
			b.foodOnCards <= WINGSPAN_CONSTRAINTS.maxFoodOnCards &&
			b.tuckedCards <= WINGSPAN_CONSTRAINTS.maxTuckedCards &&
			b.nectar <= WINGSPAN_CONSTRAINTS.maxNectar
		);
	});
	if (categoriesInRange) confidence += 0.1;

	// Scores are distinct OR ties have same total (proper ranking possible) (+0.05)
	const sortedScores = [...data.players].sort((a, b) => b.totalScore - a.totalScore);
	const rankingValid = sortedScores.every((p, i) => {
		if (i === 0) return true;
		// Either different score or tied with previous
		return p.totalScore <= sortedScores[i - 1].totalScore;
	});
	if (rankingValid) confidence += 0.05;

	return Math.min(confidence, 1.0);
}

export function extractWarnings(data: ExtractedGameData): string[] {
	const warnings: string[] = [];

	if (!data.players || data.players.length === 0) {
		warnings.push('No players detected in screenshot');
		return warnings;
	}

	// Check player count
	if (data.players.length > WINGSPAN_CONSTRAINTS.maxPlayers) {
		warnings.push(`Detected ${data.players.length} players (max is ${WINGSPAN_CONSTRAINTS.maxPlayers})`);
	}

	// Check for missing or suspicious player names
	for (let i = 0; i < data.players.length; i++) {
		const p = data.players[i];
		const name = p.playerName?.trim() || '';
		if (!name) {
			warnings.push(`Player ${i + 1}: Missing name`);
		} else if (name.length < 2) {
			warnings.push(`Player ${i + 1}: Name "${name}" seems too short`);
		}
	}

	// Check for score breakdown mismatches (critical validation)
	for (const p of data.players) {
		const sum = getBreakdownSum(p);
		const diff = Math.abs(sum - p.totalScore);
		if (diff > 0) {
			warnings.push(
				`${p.playerName}: Breakdown sum (${sum}) differs from total (${p.totalScore}) by ${diff} points - please verify`
			);
		}
	}

	// Check for unusual total scores
	for (const p of data.players) {
		if (p.totalScore < WINGSPAN_CONSTRAINTS.minTotalScore) {
			warnings.push(`${p.playerName}: Score ${p.totalScore} is unusually low - please verify`);
		}
		if (p.totalScore > WINGSPAN_CONSTRAINTS.maxTotalScore) {
			warnings.push(`${p.playerName}: Score ${p.totalScore} is unusually high - please verify`);
		}
	}

	// Check for category values outside normal ranges
	for (const p of data.players) {
		const b = p.scoringBreakdown;
		if (b.birds > WINGSPAN_CONSTRAINTS.maxBirds) {
			warnings.push(`${p.playerName}: Birds score ${b.birds} exceeds typical maximum`);
		}
		if (b.bonusCards > WINGSPAN_CONSTRAINTS.maxBonusCards) {
			warnings.push(`${p.playerName}: Bonus cards ${b.bonusCards} exceeds typical maximum`);
		}
		if (b.endOfRoundGoals > WINGSPAN_CONSTRAINTS.maxEndOfRoundGoals) {
			warnings.push(`${p.playerName}: End-of-round goals ${b.endOfRoundGoals} exceeds typical maximum`);
		}
		if (b.eggs > WINGSPAN_CONSTRAINTS.maxEggs) {
			warnings.push(`${p.playerName}: Eggs ${b.eggs} exceeds typical maximum`);
		}
		if (b.foodOnCards > WINGSPAN_CONSTRAINTS.maxFoodOnCards) {
			warnings.push(`${p.playerName}: Food on cards ${b.foodOnCards} exceeds typical maximum`);
		}
		if (b.tuckedCards > WINGSPAN_CONSTRAINTS.maxTuckedCards) {
			warnings.push(`${p.playerName}: Tucked cards ${b.tuckedCards} exceeds typical maximum`);
		}
		if (b.nectar > WINGSPAN_CONSTRAINTS.maxNectar) {
			warnings.push(`${p.playerName}: Nectar ${b.nectar} exceeds typical maximum`);
		}
	}

	// Check for any negative values
	for (const p of data.players) {
		const b = p.scoringBreakdown;
		const negativeFields = Object.entries(b).filter(([, v]) => typeof v === 'number' && v < 0);
		if (negativeFields.length > 0) {
			warnings.push(
				`${p.playerName}: Negative values detected (${negativeFields.map(([k]) => k).join(', ')})`
			);
		}
	}

	// Check for duplicate player names
	const names = data.players.map((p) => p.playerName?.toLowerCase().trim()).filter(Boolean);
	const uniqueNames = new Set(names);
	if (uniqueNames.size < names.length) {
		warnings.push('Duplicate player names detected - please verify');
	}

	// Include AI extraction notes if present and non-trivial
	if (data.extractionNotes && data.extractionNotes.trim().length > 0) {
		const notes = data.extractionNotes.trim();
		// Skip generic "no issues" type messages
		const skipPhrases = ['no issues', 'no uncertainty', 'extraction successful', 'all clear'];
		const isGeneric = skipPhrases.some((phrase) => notes.toLowerCase().includes(phrase));
		if (!isGeneric) {
			warnings.push(`AI notes: ${notes}`);
		}
	}

	return warnings;
}
