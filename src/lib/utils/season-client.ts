import type { Season } from '$lib/utils/seasons';

export type { Season };

export async function loadSeasonList(): Promise<{
	seasons: Season[];
	currentSeasonId: number | null;
}> {
	const res = await fetch('/api/seasons');
	if (!res.ok) return { seasons: [], currentSeasonId: null };
	const data = await res.json();
	return {
		seasons: data.seasons ?? [],
		currentSeasonId: data.currentSeasonId ?? null
	};
}

export function seasonQuery(searchParams: URLSearchParams): string {
	const season = searchParams.get('season');
	return season ? `season=${encodeURIComponent(season)}` : '';
}

export function formatAvg(value: number | null | undefined, digits = 1): string {
	if (value == null || Number.isNaN(Number(value))) return '—';
	return Number(value).toFixed(digits);
}
