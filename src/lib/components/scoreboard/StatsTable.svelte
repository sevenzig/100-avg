<script lang="ts">
	import Table from '$lib/components/shared/Table.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import type { LeagueStats } from '$lib/stores/league';

	export let stats: LeagueStats[] = [];

	const headers = ['Rank', 'Player', 'Avg Placement', 'First Place', 'Avg Score', 'W/L Record'];

	function getRankBadge(index: number) {
		const medals = ['🥇', '🥈', '🥉'];
		return medals[index] || `${index + 1}`;
	}

	function getRankColor(index: number) {
		const colors = ['text-amber-500', 'text-slate-400', 'text-orange-500'];
		return colors[index] || 'text-slate-600';
	}

	function getPlayerColor(color: string): string {
		const colorMap: Record<string, string> = {
			player_1: '#3B82F6',
			player_2: '#F59E0B',
			player_3: '#8B5CF6'
		};
		return colorMap[color] || '#475569';
	}
</script>

<Table {headers} data={stats} className="mt-4">
	<svelte:fragment slot="row" let:row={stat} let:index>
		<td class="px-4 py-4 text-center">
			<span class="type-rank {getRankColor(index)}">{getRankBadge(index)}</span>
		</td>
		<td class="px-4 py-4">
			<span class="font-semibold text-slate-900" style="color: {getPlayerColor(stat.color)};">
				{stat.username}
			</span>
		</td>
		<td class="type-data px-4 py-4 text-right font-medium text-slate-900">
			{stat.avgPlacement.toFixed(2)}
		</td>
		<td class="type-data px-4 py-4 text-right font-medium text-slate-900">
			{stat.firstPlaceFinishes}
		</td>
		<td class="type-data px-4 py-4 text-right font-semibold text-slate-900">
			{stat.averageScore.toFixed(1)}
		</td>
		<td class="type-data px-4 py-4 text-right font-medium text-slate-700">
			<span class="text-emerald-600">{stat.wins}W</span> / <span class="text-red-500">{stat.losses}L</span>
		</td>
	</svelte:fragment>
</Table>
