<script lang="ts">
	import type { LeagueStats } from '$lib/stores/league';

	export let breakdown: LeagueStats[] = [];

	const categories = [
		{ key: 'birds', label: 'Birds' },
		{ key: 'bonusCards', label: 'Bonus Cards' },
		{ key: 'endOfRoundGoals', label: 'End of Round Goals' },
		{ key: 'eggs', label: 'Eggs' },
		{ key: 'foodOnCards', label: 'Food on Cards' },
		{ key: 'tuckedCards', label: 'Tucked Cards' },
		{ key: 'nectar', label: 'Nectar' }
	] as const;

	function getMaxValue(category: string) {
		return Math.max(
			...breakdown.map((stat) => stat.avgBreakdown[category as keyof typeof stat.avgBreakdown] || 0)
		);
	}

	function getColor(playerColor: string) {
		const colors: Record<string, string> = {
			player_1: '#3B82F6',
			player_2: '#F59E0B',
			player_3: '#8B5CF6'
		};
		return colors[playerColor] || '#94A3B8';
	}

	function getCategoryValue(
		player: LeagueStats,
		categoryKey: string
	): number {
		return (player.avgBreakdown[categoryKey as keyof typeof player.avgBreakdown] || 0) as number;
	}
</script>

<div class="space-y-6">
	{#each categories as category}
		{@const maxValue = getMaxValue(category.key)}
		<div class="space-y-2">
			<div class="flex justify-between items-center">
				<span class="text-slate-600 text-sm font-medium">{category.label}</span>
				<span class="text-slate-400 text-xs">Max: {maxValue.toFixed(1)}</span>
			</div>
			<div class="space-y-2">
				{#each breakdown as player}
					{@const value = getCategoryValue(player, category.key)}
					{@const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0}
					<div class="flex items-center gap-3">
						<span class="text-sm text-slate-700 w-24 truncate font-medium">{player.username}</span>
						<div class="flex-1 relative bg-slate-100 rounded-full h-8 overflow-hidden">
							<div
								class="h-full rounded-full transition-all duration-300"
								style="width: {percentage}%; background-color: {getColor(player.color)};"
							></div>
							<span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-900 font-semibold font-mono">
								{value.toFixed(1)}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>
