import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { env } from '$env/dynamic/private';
import type { ExtractedGameData, ExtractedPlayer } from '$lib/types/screenshot-upload';

/** Anthropic limits base64 images to 5 MB. Raw buffer must stay under ~3.75 MB to fit. */
const ANTHROPIC_MAX_BASE64_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_RAW_BYTES = Math.floor((ANTHROPIC_MAX_BASE64_BYTES * 3) / 4) - 1024 * 100; // ~3.65 MB with margin

// Initialize Anthropic client with API key validation
function getAnthropicClient() {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY environment variable is not set');
	}
	return new Anthropic({ apiKey });
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
		const response = await anthropic.messages.create({
			model: 'claude-3-5-sonnet-20241022',
			max_tokens: 4096,
			timeout: 60000, // Increased to 60 seconds to allow more processing time
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
							text: `Extract game data from this Wingspan score screenshot. 
Return JSON in this exact format (no markdown, just raw JSON):
{
  "players": [
    {
      "playerName": "string",
      "totalScore": number,
      "scoringBreakdown": {
        "birds": number,
        "bonusCards": number,
        "endOfRoundGoals": number,
        "eggs": number,
        "foodOnCards": number,
        "tuckedCards": number,
        "nectar": number
      }
    }
  ]
}

Important:
- Extract all players visible in the screenshot
- Calculate placement based on totalScore (1st = highest score)
- Ensure all scoring breakdown values are numbers
- If a category is not visible or unclear, use 0`
						}
					]
				}
			]
		});
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

		// Sort by total score and assign placements
		const sortedPlayers = [...parsedData.players].sort((a, b) => b.totalScore - a.totalScore);
		sortedPlayers.forEach((player, index) => {
			player.placement = index + 1;
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

		// Re-sort after recalculating totals
		const finalSorted = [...parsedData.players].sort((a, b) => b.totalScore - a.totalScore);
		finalSorted.forEach((player, index) => {
			player.placement = index + 1;
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

export function calculateConfidence(data: ExtractedGameData): number {
	// Simple confidence calculation based on data completeness
	if (!data.players || data.players.length === 0) {
		return 0;
	}

	let confidence = 0.5; // Base confidence

	// Check if all players have names
	const allHaveNames = data.players.every((p) => p.playerName && p.playerName.trim().length > 0);
	if (allHaveNames) confidence += 0.2;

	// Check if all scores are reasonable
	const allScoresValid = data.players.every(
		(p) => p.totalScore >= 0 && p.totalScore <= 200 && p.totalScore === Math.round(p.totalScore)
	);
	if (allScoresValid) confidence += 0.2;

	// Check if breakdown sums match totals
	const breakdownsMatch = data.players.every((p) => {
		const sum =
			p.scoringBreakdown.birds +
			p.scoringBreakdown.bonusCards +
			p.scoringBreakdown.endOfRoundGoals +
			p.scoringBreakdown.eggs +
			p.scoringBreakdown.foodOnCards +
			p.scoringBreakdown.tuckedCards +
			p.scoringBreakdown.nectar;
		return Math.abs(sum - p.totalScore) <= 1; // Allow 1 point difference for rounding
	});
	if (breakdownsMatch) confidence += 0.1;

	return Math.min(confidence, 1.0);
}

export function extractWarnings(data: ExtractedGameData): string[] {
	const warnings: string[] = [];

	if (!data.players || data.players.length === 0) {
		warnings.push('No players detected in screenshot');
		return warnings;
	}

	// Check for missing player names
	const missingNames = data.players.filter((p) => !p.playerName || p.playerName.trim().length === 0);
	if (missingNames.length > 0) {
		warnings.push(`${missingNames.length} player(s) missing names`);
	}

	// Check for score mismatches
	const mismatches = data.players.filter((p) => {
		const sum =
			p.scoringBreakdown.birds +
			p.scoringBreakdown.bonusCards +
			p.scoringBreakdown.endOfRoundGoals +
			p.scoringBreakdown.eggs +
			p.scoringBreakdown.foodOnCards +
			p.scoringBreakdown.tuckedCards +
			p.scoringBreakdown.nectar;
		return Math.abs(sum - p.totalScore) > 1;
	});
	if (mismatches.length > 0) {
		warnings.push(`${mismatches.length} player(s) have score breakdown mismatches`);
	}

	// Check for unusual scores
	const unusualScores = data.players.filter((p) => p.totalScore < 0 || p.totalScore > 200);
	if (unusualScores.length > 0) {
		warnings.push(`${unusualScores.length} player(s) have unusual scores`);
	}

	return warnings;
}
