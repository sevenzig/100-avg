import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId } from '$lib/utils/auth';
import { queryLeagueStats } from '$lib/utils/league-stats';
import { resolveSeasonParam, seasonToJson } from '$lib/utils/seasons';

export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const userId = getUserId(cookies);
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const leagueId = parseInt(params.id);
	if (isNaN(leagueId)) {
		return json({ error: 'Invalid league ID' }, { status: 400 });
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
			return json({ error: 'You are not a member of this league' }, { status: 403 });
		}
	}

	const requested = url.searchParams.has('season') || url.searchParams.has('seasonId');
	const season = resolveSeasonParam(db, url.searchParams);
	if (!season) {
		return json({ error: requested ? 'Invalid season' : 'No active season' }, { status: 400 });
	}

	const stats = queryLeagueStats(db, leagueId, season.id);

	const formattedStats = stats.map((stat) => ({
		userId: stat.user_id,
		username: stat.username,
		color: stat.color,
		avgPlacement: stat.avg_placement,
		firstPlaceFinishes: stat.first_place_finishes || 0,
		averageScore: stat.average_score,
		careerAverageScore: stat.career_average_score,
		careerTotalGames: stat.career_total_games || 0,
		highestScore: stat.highest_score || 0,
		lowestScore: stat.lowest_score || 0,
		avgBreakdown: {
			birds: stat.avg_birds,
			bonusCards: stat.avg_bonus_cards,
			endOfRoundGoals: stat.avg_end_of_round_goals,
			eggs: stat.avg_eggs,
			foodOnCards: stat.avg_food_on_cards,
			tuckedCards: stat.avg_tucked_cards,
			nectar: stat.avg_nectar
		},
		totalGames: stat.total_games || 0,
		wins: stat.wins || 0,
		losses: stat.losses || 0
	}));

	return json({ season: seasonToJson(season), stats: formattedStats });
};
