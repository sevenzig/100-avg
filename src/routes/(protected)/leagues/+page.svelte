<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { leagues } from '$lib/stores/league';
	import { activeModal } from '$lib/stores/ui';
	import LeagueCard from '$lib/components/league/LeagueCard.svelte';
	import CreateLeagueModal from '$lib/components/league/CreateLeagueModal.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Card from '$lib/components/shared/Card.svelte';

	let loading = true;
	let error = '';
	let availablePlayers: Array<{ id: number; username: string; email: string }> = [];

	onMount(async () => {
		await Promise.all([loadLeagues(), loadAvailablePlayers()]);
	});

	async function loadAvailablePlayers() {
		try {
			const response = await fetch('/api/users');
			if (response.ok) {
				const data = await response.json();
				availablePlayers = data.users;
			}
		} catch (e) {
			console.error('Failed to load users:', e);
		}
	}

	async function loadLeagues() {
		loading = true;
		error = '';
		try {
			const response = await fetch('/api/leagues');
			if (response.ok) {
				const data = await response.json();
				leagues.set(data.leagues);
			} else {
				error = 'Failed to load leagues';
			}
		} catch (e) {
			error = 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function handleLeagueClick(event: CustomEvent<number>) {
		const leagueId = event.detail;
		if (leagueId) {
			goto(`/leagues/${leagueId}`);
		}
	}

	function handleCreateClick() {
		activeModal.set('create-league');
	}

	async function handleCreateLeague(event: CustomEvent<{ name: string; playerIds: number[] }>) {
		try {
			const response = await fetch('/api/leagues', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(event.detail)
			});

			if (response.ok) {
				await loadLeagues();
				activeModal.set(null);
			} else {
				const data = await response.json();
				error = data.error || 'Failed to create league';
			}
		} catch (e) {
			error = 'An error occurred';
		}
	}

	function handleCloseModal() {
		activeModal.set(null);
	}
</script>

<div>
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold text-slate-900">My Leagues</h1>
		<Button variant="primary" on:click={handleCreateClick}>+ Create League</Button>
	</div>

	{#if loading}
		<div class="flex justify-center items-center h-64">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
			<span>{error}</span>
		</div>
	{:else if $leagues.length === 0}
		<Card>
			<div class="text-center py-12">
				<p class="text-slate-600 mb-4">You don't have any leagues yet.</p>
				<Button variant="primary" on:click={handleCreateClick}>Create Your First League</Button>
			</div>
		</Card>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each $leagues as league}
				<LeagueCard {league} on:click={handleLeagueClick} />
			{/each}
		</div>
	{/if}
</div>

<CreateLeagueModal
	open={$activeModal === 'create-league'}
	{availablePlayers}
	on:close={handleCloseModal}
	on:create={handleCreateLeague}
/>
