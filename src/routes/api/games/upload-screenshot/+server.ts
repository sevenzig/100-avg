import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserId } from '$lib/utils/auth';
import { getDb } from '$lib/utils/db';
import { validateImageFile, validateImageHeader, sanitizePlayerName } from '$lib/utils/file-validation';
import { checkRateLimit } from '$lib/utils/rate-limiter';
import { parseScreenshot, calculateConfidence, extractWarnings } from '$lib/utils/image-parser';
import type { ExtractedGameData } from '$lib/types/screenshot-upload';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ success: false, error: 'Not authenticated' }, { status: 401 });
	}

	// Check rate limit
	const rateLimit = checkRateLimit(userId);
	if (!rateLimit.allowed) {
		return json(
			{
				success: false,
				error: 'Rate limit exceeded. Please try again later.'
			},
			{ status: 429 }
		);
	}

	try {
		// SvelteKit uses request.formData() for multipart/form-data
		const formData = await request.formData();
		const file = formData.get('image') as File;
		const leagueIdStr = formData.get('leagueId') as string;

		if (!file || !leagueIdStr) {
			return json({ success: false, error: 'Missing required fields' }, { status: 400 });
		}

		const leagueId = parseInt(leagueIdStr);
		if (isNaN(leagueId)) {
			return json({ success: false, error: 'Invalid league ID' }, { status: 400 });
		}

		// Validate file
		const validationResult = validateImageFile(file);
		if (!validationResult.valid) {
			return json({ success: false, error: validationResult.error }, { status: 400 });
		}

		// Validate file header (magic number)
		const headerValidation = await validateImageHeader(file);
		if (!headerValidation.valid) {
			return json({ success: false, error: headerValidation.error }, { status: 400 });
		}

		const db = getDb();

		// Check if user is an admin
		const user = db
			.prepare('SELECT is_admin FROM users WHERE id = ?')
			.get(userId) as { is_admin: number | null } | undefined;

		const isAdmin = user?.is_admin === 1;

		// If not admin, check if user is a member of this league
		if (!isAdmin) {
			const membership = db
				.prepare('SELECT user_id FROM league_players WHERE league_id = ? AND user_id = ?')
				.get(leagueId, userId);

			if (!membership) {
				return json(
					{ success: false, error: 'You are not a member of this league' },
					{ status: 403 }
				);
			}
		}

		// Convert File to Buffer for processing
		const arrayBuffer = await file.arrayBuffer();
		const imageBuffer = Buffer.from(arrayBuffer);

		// Parse screenshot
		const extractedData = await parseScreenshot(imageBuffer);

		// Sanitize player names
		for (const player of extractedData.players) {
			player.playerName = sanitizePlayerName(player.playerName);
		}

		// Calculate confidence and warnings
		const confidence = calculateConfidence(extractedData);
		const warnings = extractWarnings(extractedData);

		// Return extracted data for user review
		return json({
			success: true,
			extractedData,
			confidence,
			warnings: warnings.length > 0 ? warnings : undefined
		});
	} catch (error) {
		console.error('Upload screenshot error:', error);
		if (error instanceof Error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
