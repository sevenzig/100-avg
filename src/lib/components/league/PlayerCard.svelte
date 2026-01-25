<script lang="ts">
	import Card from '$lib/components/shared/Card.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';

	export interface Player {
		id: number;
		username: string;
		color: 'player_1' | 'player_2' | 'player_3';
		stats?: {
			wins: number;
			losses: number;
			avgScore: number;
		};
	}

	export let player: Player;
	export let active = false;

	function getPlayerColor(color: string): string {
		const colorMap: Record<string, string> = {
			player_1: '#3B82F6',
			player_2: '#F59E0B',
			player_3: '#8B5CF6'
		};
		return colorMap[color] || '#475569';
	}
</script>

<Card hover={true} className="border-l-4 {active ? 'ring-2 ring-blue-500 ring-offset-2' : ''}" style="border-left-color: {getPlayerColor(player.color)};">
	<div class="flex justify-between items-start">
		<div>
			<h4 class="text-lg font-semibold text-slate-900" style="color: {getPlayerColor(player.color)};">
				{player.username}
			</h4>
			{#if player.stats}
				<div class="mt-2 space-y-1 text-sm">
					<div class="flex gap-4">
						<span class="text-slate-600">W: <span class="text-emerald-600 font-medium">{player.stats.wins}</span></span>
						<span class="text-slate-600">L: <span class="text-red-500 font-medium">{player.stats.losses}</span></span>
					</div>
					<div class="text-slate-600">
						Avg: <span class="text-slate-900 font-semibold font-mono">{player.stats.avgScore.toFixed(1)}</span>
					</div>
				</div>
			{/if}
		</div>
		{#if active}
			<div class="w-3 h-3 rounded-full bg-emerald-500"></div>
		{/if}
	</div>
</Card>
