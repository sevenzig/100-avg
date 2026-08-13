import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { requireLeagueMember } from '$lib/utils/auth';
import { ensureInviteCode } from '$lib/utils/league-invite';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const leagueId = parseInt(params.id, 10);
	if (Number.isNaN(leagueId)) {
		return json({ error: 'Invalid league ID' }, { status: 400 });
	}

	const db = getDb();
	try {
		requireLeagueMember(leagueId, cookies, db);
	} catch (response) {
		return response as Response;
	}

	const code = ensureInviteCode(db, leagueId);
	if (!code) {
		return json({ error: 'League not found' }, { status: 404 });
	}

	return json({ code });
};
