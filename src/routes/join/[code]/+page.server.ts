import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';
import { joinLeagueByCode } from '$lib/utils/league-invite';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const db = getDb();
	const userId = getUserId(cookies);
	const joinPath = `/join/${params.code}`;

	if (!userId) {
		const league = db
			.prepare('SELECT name FROM leagues WHERE invite_code = ?')
			.get(params.code) as { name: string } | undefined;
		if (!league) {
			error(404, 'This invite link is invalid');
		}
		const redirectParam = encodeURIComponent(joinPath);
		return {
			leagueName: league.name,
			loginHref: `/login?redirect=${redirectParam}`,
			registerHref: `/register?redirect=${redirectParam}`
		};
	}

	const result = joinLeagueByCode(db, params.code, userId);
	if (!result) {
		error(404, 'This invite link is invalid');
	}

	redirect(303, `/leagues/${result.leagueId}`);
};
