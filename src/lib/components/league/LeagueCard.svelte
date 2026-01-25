<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Card from '$lib/components/shared/Card.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import type { League } from '$lib/stores/league';

	export let league: League;
	export let active = false;

	const dispatch = createEventDispatcher();

	function handleClick() {
		dispatch('click', league.id);
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

<Card hover={true} className="cursor-pointer {active ? 'border-blue-600 border-2' : ''}" on:click={handleClick}>
	<div slot="header" class="flex justify-between items-center">
		<h3 class="text-lg font-semibold text-slate-900">{league.name}</h3>
		{#if active}
			<Badge variant="info" size="sm">Active</Badge>
		{/if}
	</div>
	<div class="space-y-3">
		<div class="flex items-center gap-2 flex-wrap">
			<Badge variant="default" size="sm">{league.playerCount || league.players.length} Players</Badge>
			{#if league.lastGameDate}
				<span class="text-sm text-slate-600">
					Last game: {new Date(league.lastGameDate).toLocaleDateString()}
				</span>
			{/if}
		</div>
		<div class="flex gap-2 flex-wrap">
			{#each league.players as player}
				<span
					class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
					style="background-color: {getPlayerColor(player.color)};"
				>
					{player.username}
				</span>
			{/each}
		</div>
	</div>
</Card>
