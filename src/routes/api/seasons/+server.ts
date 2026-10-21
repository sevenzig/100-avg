import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';
import {
	ensureSeasons,
	getCurrentSeason,
	getSettings,
	listSeasons,
	seasonToJson
} from '$lib/utils/seasons';

export const GET: RequestHandler = async ({ cookies }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDb();
	ensureSeasons(db);
	const settings = getSettings(db);
	const current = getCurrentSeason(db);
	const seasons = listSeasons(db);

	return json({
		epoch: settings?.season_epoch ?? null,
		lengthDays: settings?.season_length_days ?? 91,
		currentSeasonId: current?.id ?? null,
		seasons: seasons.map(seasonToJson)
	});
};
