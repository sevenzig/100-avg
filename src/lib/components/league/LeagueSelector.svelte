<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import type { League } from '$lib/stores/league';

	export let leagues: League[] = [];
	export let selectedLeagueId: number | undefined = undefined;

	const dispatch = createEventDispatcher();

	function handleSelect(e: Event) {
		const target = e.target as HTMLSelectElement;
		const leagueId = parseInt(target.value);
		if (!isNaN(leagueId)) {
			dispatch('select', leagueId);
		}
	}

	function handleCreate() {
		dispatch('create');
	}
</script>

<div class="flex gap-2">
	<select
		class="select select-bordered w-full bg-base-200 text-text-primary"
		value={selectedLeagueId}
		on:change={handleSelect}
	>
		<option value="">Select a league...</option>
		{#each leagues as league}
			<option value={league.id}>{league.name}</option>
		{/each}
	</select>
	<Button variant="ghost" size="sm" on:click={handleCreate}>+ New</Button>
</div>
