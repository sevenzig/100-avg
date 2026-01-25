<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { currentLeague, leagueStats, leagues } from '$lib/stores/league';
	import { activeModal } from '$lib/stores/ui';
	import AddGameModal from '$lib/components/scoreboard/AddGameModal.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import type { LeagueStats } from '$lib/stores/league';

	let loading = true;
	let error = '';
	let gameHistory: any[] = [];
	let detailedGames: Map<number, any> = new Map();
	let hoveredPlayerId: number | null = null;
	let hoveredGameId: number | null = null;

	// Sorting state
	type SortField = 'rank' | 'player' | 'avgPlacement' | 'firstPlace' | 'avgScore' | 'wins' | 'losses' | 'games' | 'birds' | 'bonusCards' | 'endOfRoundGoals' | 'eggs' | 'foodOnCards' | 'tuckedCards' | 'nectar';
	type SortDirection = 'asc' | 'desc';
	let sortField: SortField = 'rank';
	let sortDirection: SortDirection = 'asc';

	$: leagueId = parseInt($page.params.id);

	onMount(async () => {
		await loadLeagueData();
	});

	async function loadLeagueData() {
		loading = true;
		error = '';
		try {
			// Load league details
			const leagueResponse = await fetch(`/api/leagues/${leagueId}`);
			if (!leagueResponse.ok) {
				error = 'Failed to load league';
				return;
			}
			const leagueData = await leagueResponse.json();
			currentLeague.set(leagueData.league);

			// Load stats
			const statsResponse = await fetch(`/api/leagues/${leagueId}/stats`);
			if (statsResponse.ok) {
				const statsData = await statsResponse.json();
				leagueStats.set(statsData.stats);
			}

			// Load game history
			const gamesResponse = await fetch(`/api/leagues/${leagueId}/games`);
			if (gamesResponse.ok) {
				const gamesData = await gamesResponse.json();
				gameHistory = gamesData.games;
			}
		} catch (e) {
			error = 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function loadGameDetails(gameId: number) {
		if (detailedGames.has(gameId)) return;
		
		try {
			const response = await fetch(`/api/games/${gameId}`);
			if (response.ok) {
				const data = await response.json();
				detailedGames.set(gameId, data.game);
			}
		} catch (e) {
			console.error('Failed to load game details:', e);
		}
	}

	function handleAddGame() {
		activeModal.set('add-game');
	}

	async function handleGameSubmit(event: CustomEvent<{ playedAt: string; scores: any[] }>) {
		try {
			const response = await fetch('/api/games', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					leagueId,
					playedAt: event.detail.playedAt,
					scores: event.detail.scores
				})
			});

			if (response.ok) {
				await loadLeagueData();
				activeModal.set(null);
			} else {
				const data = await response.json();
				error = data.error || 'Failed to add game';
			}
		} catch (e) {
			error = 'An error occurred';
		}
	}

	function handleCloseModal() {
		activeModal.set(null);
	}

	function getPlayerColor(color: string): string {
		const colorMap: Record<string, string> = {
			player_1: '#3B82F6',
			player_2: '#F59E0B',
			player_3: '#8B5CF6',
			player_4: '#10B981',
			player_5: '#EF4444'
		};
		return colorMap[color] || '#475569';
	}

	function getRankBadge(index: number) {
		const medals = ['🥇', '🥈', '🥉'];
		return medals[index] || `${index + 1}`;
	}

	function formatDate(dateString: string) {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatDateTime(dateString: string) {
		const date = new Date(dateString);
		return date.toLocaleString('en-US', { 
			month: 'short', 
			day: 'numeric', 
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function handleSort(field: SortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	// Helper function to get numeric value for sorting with zero detection
	function getSortValue(value: number): { value: number; isZero: boolean } {
		return {
			value: value || 0,
			isZero: value === 0 || isNaN(value) || value === null || value === undefined
		};
	}

	$: sortedStats = $leagueStats ? (() => {
		const stats = [...$leagueStats];
		const isDesc = sortDirection === 'desc';
		
		// Pre-compute rank indices for performance
		const rankMap = new Map(stats.map((stat, idx) => [stat.userId, idx]));
		
		return stats.sort((a, b) => {
			let comparison = 0;
			let aVal: number | string = 0;
			let bVal: number | string = 0;
			let aIsZero = false;
			let bIsZero = false;
			
			switch (sortField) {
				case 'rank':
					// Use pre-computed rank map instead of indexOf
					comparison = (rankMap.get(a.userId) || 0) - (rankMap.get(b.userId) || 0);
					break;
				case 'player':
					comparison = a.username.localeCompare(b.username);
					break;
				case 'avgPlacement':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.avgPlacement));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.avgPlacement));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'firstPlace':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.firstPlaceFinishes));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.firstPlaceFinishes));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'avgScore':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.averageScore));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.averageScore));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'wins':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.wins));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.wins));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'losses':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.losses));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.losses));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'games':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.totalGames));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.totalGames));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'birds':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.avgBreakdown.birds));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.avgBreakdown.birds));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'bonusCards':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.avgBreakdown.bonusCards));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.avgBreakdown.bonusCards));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'endOfRoundGoals':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.avgBreakdown.endOfRoundGoals));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.avgBreakdown.endOfRoundGoals));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'eggs':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.avgBreakdown.eggs));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.avgBreakdown.eggs));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'foodOnCards':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.avgBreakdown.foodOnCards));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.avgBreakdown.foodOnCards));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'tuckedCards':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.avgBreakdown.tuckedCards));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.avgBreakdown.tuckedCards));
					comparison = (aVal as number) - (bVal as number);
					break;
				case 'nectar':
					({ value: aVal, isZero: aIsZero } = getSortValue(a.avgBreakdown.nectar));
					({ value: bVal, isZero: bIsZero } = getSortValue(b.avgBreakdown.nectar));
					comparison = (aVal as number) - (bVal as number);
					break;
			}
			
			// Handle zeros: always put them last regardless of sort direction
			if (aIsZero && bIsZero) return 0;
			if (aIsZero) return 1; // a goes after b
			if (bIsZero) return -1; // b goes after a
			
			// Apply sort direction for non-zero values
			return isDesc ? -comparison : comparison;
		});
	})() : [];

	function getSortIcon(field: SortField) {
		if (sortField !== field) {
			return 'neutral'; // Show neutral chevron when not sorted
		}
		return sortDirection === 'asc' ? 'asc' : 'desc';
	}

	// Reusable chevron component - ensures all chevrons are identical (^/v)-shaped
	// Properly centered chevron paths for 24x24 viewBox
	const chevronUp = 'M5 15l7-7 7 7';
	const chevronDown = 'M19 9l-7 7-7-7';
</script>

<div class="h-screen flex flex-col bg-slate-50">
	<!-- Compact Header -->
	{#if $currentLeague}
		<div class="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
			<h1 class="text-xl font-bold text-slate-900">{$currentLeague.name}</h1>
			<Button variant="primary" size="sm" on:click={handleAddGame}>+ Add Game</Button>
		</div>
	{/if}

	{#if loading}
		<div class="flex-1 flex justify-center items-center">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="flex-1 flex items-center justify-center">
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
		</div>
	{:else if $leagueStats && $leagueStats.length > 0}
		<!-- Main Content - No Scroll Container -->
		<div class="flex-1 overflow-hidden flex flex-col p-4 gap-4">
			<!-- Leaderboard - Top Left -->
			<div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0" style="max-height: 50%;">
				<!-- Table Header -->
				<div class="bg-slate-50 border-b border-slate-200 px-4 py-2 shrink-0">
					<div class="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
						<button
							class="col-span-1 text-center hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-1"
							on:click={() => handleSort('rank')}
						>
							Rank
							<svg class="w-3 h-3 {getSortIcon('rank') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if getSortIcon('rank') === 'asc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
								{:else if getSortIcon('rank') === 'desc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								{:else}
									<g opacity="0.5">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</g>
								{/if}
							</svg>
						</button>
						<button
							class="col-span-2 text-left hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1"
							on:click={() => handleSort('player')}
						>
							Player
							<svg class="w-3 h-3 {getSortIcon('player') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if getSortIcon('player') === 'asc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
								{:else if getSortIcon('player') === 'desc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								{:else}
									<g opacity="0.5">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</g>
								{/if}
							</svg>
						</button>
						<button
							class="col-span-1 text-right hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-end gap-1"
							on:click={() => handleSort('avgPlacement')}
						>
							Avg Pl
							<svg class="w-3 h-3 {getSortIcon('avgPlacement') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if getSortIcon('avgPlacement') === 'asc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
								{:else if getSortIcon('avgPlacement') === 'desc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								{:else}
									<g opacity="0.5">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</g>
								{/if}
							</svg>
						</button>
						<button
							class="col-span-1 text-right hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-end gap-1"
							on:click={() => handleSort('firstPlace')}
						>
							1st
							<svg class="w-3 h-3 {getSortIcon('firstPlace') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if getSortIcon('firstPlace') === 'asc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
								{:else if getSortIcon('firstPlace') === 'desc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								{:else}
									<g opacity="0.5">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</g>
								{/if}
							</svg>
						</button>
						<button
							class="col-span-1 text-right hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-end gap-1"
							on:click={() => handleSort('avgScore')}
						>
							Avg
							<svg class="w-3 h-3 {getSortIcon('avgScore') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if getSortIcon('avgScore') === 'asc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
								{:else if getSortIcon('avgScore') === 'desc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								{:else}
									<g opacity="0.5">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</g>
								{/if}
							</svg>
						</button>
						<button
							class="col-span-1 text-right hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-end gap-1"
							on:click={() => handleSort('wins')}
						>
							W/L
							<svg class="w-3 h-3 {getSortIcon('wins') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if getSortIcon('wins') === 'asc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
								{:else if getSortIcon('wins') === 'desc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								{:else}
									<g opacity="0.5">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</g>
								{/if}
							</svg>
						</button>
						<button
							class="col-span-1 text-right hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-end gap-1"
							on:click={() => handleSort('games')}
						>
							Games
							<svg class="w-3 h-3 {getSortIcon('games') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if getSortIcon('games') === 'asc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
								{:else if getSortIcon('games') === 'desc'}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								{:else}
									<g opacity="0.5">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</g>
								{/if}
							</svg>
						</button>
						<div class="col-span-4">
							<div class="grid grid-cols-7 gap-0.5 text-[10px]">
								<button
									class="text-center hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-0.5"
									title="Birds"
									on:click={() => handleSort('birds')}
								>
									B
									<svg class="w-3 h-3 {getSortIcon('birds') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if getSortIcon('birds') === 'asc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										{:else if getSortIcon('birds') === 'desc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										{:else}
											<g opacity="0.5">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</g>
										{/if}
									</svg>
								</button>
								<button
									class="text-center hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-0.5"
									title="Bonus Cards"
									on:click={() => handleSort('bonusCards')}
								>
									C
									<svg class="w-3 h-3 {getSortIcon('bonusCards') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if getSortIcon('bonusCards') === 'asc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										{:else if getSortIcon('bonusCards') === 'desc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										{:else}
											<g opacity="0.5">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</g>
										{/if}
									</svg>
								</button>
								<button
									class="text-center hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-0.5"
									title="End of Round Goals"
									on:click={() => handleSort('endOfRoundGoals')}
								>
									G
									<svg class="w-2.5 h-2.5 {getSortIcon('endOfRoundGoals') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if getSortIcon('endOfRoundGoals') === 'asc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										{:else if getSortIcon('endOfRoundGoals') === 'desc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										{:else}
											<g opacity="0.5">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</g>
										{/if}
									</svg>
								</button>
								<button
									class="text-center hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-0.5"
									title="Eggs"
									on:click={() => handleSort('eggs')}
								>
									E
									<svg class="w-2.5 h-2.5 {getSortIcon('eggs') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if getSortIcon('eggs') === 'asc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										{:else if getSortIcon('eggs') === 'desc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										{:else}
											<g opacity="0.5">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</g>
										{/if}
									</svg>
								</button>
								<button
									class="text-center hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-0.5"
									title="Food on Cards"
									on:click={() => handleSort('foodOnCards')}
								>
									F
									<svg class="w-2.5 h-2.5 {getSortIcon('foodOnCards') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if getSortIcon('foodOnCards') === 'asc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										{:else if getSortIcon('foodOnCards') === 'desc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										{:else}
											<g opacity="0.5">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</g>
										{/if}
									</svg>
								</button>
								<button
									class="text-center hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-0.5"
									title="Tucked Cards"
									on:click={() => handleSort('tuckedCards')}
								>
									T
									<svg class="w-2.5 h-2.5 {getSortIcon('tuckedCards') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if getSortIcon('tuckedCards') === 'asc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										{:else if getSortIcon('tuckedCards') === 'desc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										{:else}
											<g opacity="0.5">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</g>
										{/if}
									</svg>
								</button>
								<button
									class="text-center hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-0.5"
									title="Nectar"
									on:click={() => handleSort('nectar')}
								>
									N
									<svg class="w-2.5 h-2.5 {getSortIcon('nectar') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if getSortIcon('nectar') === 'asc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										{:else if getSortIcon('nectar') === 'desc'}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										{:else}
											<g opacity="0.5">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</g>
										{/if}
									</svg>
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Table Body - Scrollable if needed -->
				<div class="flex-1 overflow-y-auto">
					<div class="divide-y divide-slate-100">
						{#each sortedStats as stat, index}
							{@const playerColor = getPlayerColor(stat.color)}
							<div
								class="px-4 py-2 hover:bg-slate-50 transition-colors duration-150 cursor-pointer group"
								on:mouseenter={() => (hoveredPlayerId = stat.userId)}
								on:mouseleave={() => (hoveredPlayerId = null)}
							>
								<div class="grid grid-cols-12 gap-2 items-center text-sm">
									<!-- Rank -->
									<div class="col-span-1 text-center">
										<span class="text-lg font-bold text-slate-700">{getRankBadge(index)}</span>
									</div>

									<!-- Player Name -->
									<div class="col-span-2">
										<div class="flex items-center gap-2">
											<div
												class="w-2 h-2 rounded-full shrink-0"
												style="background-color: {playerColor};"
											></div>
											<span class="font-semibold text-slate-900 truncate" style="color: {playerColor};">
												{stat.username}
											</span>
										</div>
									</div>

									<!-- Avg Placement -->
									<div class="col-span-1 text-right font-mono text-slate-900 tabular-nums">
										{stat.avgPlacement.toFixed(2)}
									</div>

									<!-- First Place -->
									<div class="col-span-1 text-right font-mono text-slate-900 tabular-nums">
										{stat.firstPlaceFinishes}
									</div>

									<!-- Avg Score -->
									<div class="col-span-1 text-right font-mono font-semibold text-slate-900 tabular-nums">
										{stat.averageScore.toFixed(1)}
									</div>

									<!-- W/L Record -->
									<div class="col-span-1 text-right font-mono text-xs tabular-nums">
										<span class="text-emerald-600 font-semibold">{stat.wins}</span>/
										<span class="text-red-500">{stat.losses}</span>
									</div>

									<!-- Total Games -->
									<div class="col-span-1 text-right font-mono text-slate-600 tabular-nums text-xs">
										{stat.totalGames}
									</div>

									<!-- Scoring Breakdown - Compact with visible labels -->
									<div class="col-span-4">
										<div class="grid grid-cols-7 gap-0.5 text-[10px]">
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-blue-50 text-blue-700 group-hover:bg-blue-100 transition-colors cursor-help"
												title="Birds"
											>
												<div class="font-semibold leading-tight">B</div>
												<div class="font-mono tabular-nums text-[9px] leading-tight mt-0.5">
													{stat.avgBreakdown.birds.toFixed(1)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-green-50 text-green-700 group-hover:bg-green-100 transition-colors cursor-help"
												title="Bonus Cards"
											>
												<div class="font-semibold leading-tight">C</div>
												<div class="font-mono tabular-nums text-[9px] leading-tight mt-0.5">
													{stat.avgBreakdown.bonusCards.toFixed(1)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-yellow-50 text-yellow-700 group-hover:bg-yellow-100 transition-colors cursor-help"
												title="End of Round Goals"
											>
												<div class="font-semibold leading-tight">G</div>
												<div class="font-mono tabular-nums text-[9px] leading-tight mt-0.5">
													{stat.avgBreakdown.endOfRoundGoals.toFixed(1)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-amber-50 text-amber-700 group-hover:bg-amber-100 transition-colors cursor-help"
												title="Eggs"
											>
												<div class="font-semibold leading-tight">E</div>
												<div class="font-mono tabular-nums text-[9px] leading-tight mt-0.5">
													{stat.avgBreakdown.eggs.toFixed(1)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-red-50 text-red-700 group-hover:bg-red-100 transition-colors cursor-help"
												title="Food on Cards"
											>
												<div class="font-semibold leading-tight">F</div>
												<div class="font-mono tabular-nums text-[9px] leading-tight mt-0.5">
													{stat.avgBreakdown.foodOnCards.toFixed(1)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-purple-50 text-purple-700 group-hover:bg-purple-100 transition-colors cursor-help"
												title="Tucked Cards"
											>
												<div class="font-semibold leading-tight">T</div>
												<div class="font-mono tabular-nums text-[9px] leading-tight mt-0.5">
													{stat.avgBreakdown.tuckedCards.toFixed(1)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-pink-50 text-pink-700 group-hover:bg-pink-100 transition-colors cursor-help"
												title="Nectar"
											>
												<div class="font-semibold leading-tight">N</div>
												<div class="font-mono tabular-nums text-[9px] leading-tight mt-0.5">
													{stat.avgBreakdown.nectar.toFixed(1)}
												</div>
											</div>
										</div>
									</div>
								</div>

								<!-- Expanded Breakdown on Hover -->
								{#if hoveredPlayerId === stat.userId}
									<div
										class="mt-2 pt-2 border-t border-slate-200 grid grid-cols-7 gap-2 text-xs animate-in fade-in duration-200"
									>
										<div class="text-center">
											<div class="text-slate-500 mb-1">Birds</div>
											<div class="font-mono font-semibold text-slate-900">
												{stat.avgBreakdown.birds.toFixed(1)}
											</div>
										</div>
										<div class="text-center">
											<div class="text-slate-500 mb-1">Bonus</div>
											<div class="font-mono font-semibold text-slate-900">
												{stat.avgBreakdown.bonusCards.toFixed(1)}
											</div>
										</div>
										<div class="text-center">
											<div class="text-slate-500 mb-1">Goals</div>
											<div class="font-mono font-semibold text-slate-900">
												{stat.avgBreakdown.endOfRoundGoals.toFixed(1)}
											</div>
										</div>
										<div class="text-center">
											<div class="text-slate-500 mb-1">Eggs</div>
											<div class="font-mono font-semibold text-slate-900">
												{stat.avgBreakdown.eggs.toFixed(1)}
											</div>
										</div>
										<div class="text-center">
											<div class="text-slate-500 mb-1">Food</div>
											<div class="font-mono font-semibold text-slate-900">
												{stat.avgBreakdown.foodOnCards.toFixed(1)}
											</div>
										</div>
										<div class="text-center">
											<div class="text-slate-500 mb-1">Tucked</div>
											<div class="font-mono font-semibold text-slate-900">
												{stat.avgBreakdown.tuckedCards.toFixed(1)}
											</div>
										</div>
										<div class="text-center">
											<div class="text-slate-500 mb-1">Nectar</div>
											<div class="font-mono font-semibold text-slate-900">
												{stat.avgBreakdown.nectar.toFixed(1)}
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Recent Games - Full Width -->
			<div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden shrink-0">
				<div class="bg-slate-50 border-b border-slate-200 px-4 py-2 shrink-0">
					<h3 class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Recent Games</h3>
				</div>
				<div class="p-4">
					{#if gameHistory.length > 0}
						<div class="grid grid-cols-3 gap-4">
							{#each gameHistory.slice(0, 3) as game}
								{@const sortedScores = game.scores.sort((a, b) => b.totalScore - a.totalScore)}
								<div
									class="border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:shadow-md transition-all duration-150 cursor-pointer relative group"
									on:mouseenter={() => {
										hoveredGameId = game.id;
										loadGameDetails(game.id);
									}}
									on:mouseleave={() => (hoveredGameId = null)}
								>
									<!-- Game Header -->
									<div class="flex items-center justify-between mb-2">
										<div class="text-xs text-slate-500 font-medium">
											{formatDate(game.playedAt)}
										</div>
										<div class="text-xs text-slate-400">
											Game #{game.id}
										</div>
									</div>

									<!-- Player Scores -->
									<div class="space-y-1.5">
										{#each sortedScores as score, idx}
											{@const player = $currentLeague?.players.find((p) => p.id === score.userId)}
											{@const playerColor = player ? getPlayerColor(player.color) : '#94A3B8'}
											<div class="flex items-center justify-between text-sm">
												<div class="flex items-center gap-2">
													<span class="text-slate-400 font-mono text-xs w-4">{idx + 1}.</span>
													<div
														class="w-2 h-2 rounded-full shrink-0"
														style="background-color: {playerColor};"
													></div>
													<span class="font-medium text-slate-900 truncate" style="color: {playerColor};">
														{player?.username || 'Unknown'}
													</span>
												</div>
												<span class="font-mono font-semibold text-slate-900 tabular-nums">
													{score.totalScore}
												</span>
											</div>
										{/each}
									</div>

									<!-- Detailed Breakdown on Hover -->
									{#if hoveredGameId === game.id && detailedGames.has(game.id)}
										{@const gameDetails = detailedGames.get(game.id)}
										<div class="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 animate-in fade-in duration-200">
											<div class="text-xs text-slate-500 mb-3 font-medium">
												{formatDateTime(gameDetails.playedAt)}
											</div>
											<div class="space-y-2">
													{#each gameDetails.scores.sort((a, b) => a.placement - b.placement) as scoreDetail}
													{@const player = $currentLeague?.players.find((p) => p.id === scoreDetail.userId)}
													{@const playerColor = player ? getPlayerColor(player.color) : '#94A3B8'}
													{@const placementSuffix = scoreDetail.placement === 1 ? 'st' : scoreDetail.placement === 2 ? 'nd' : scoreDetail.placement === 3 ? 'rd' : 'th'}
													<div class="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
														<div class="flex items-center justify-between mb-1.5">
															<div class="flex items-center gap-2">
																<div
																	class="w-2 h-2 rounded-full"
																	style="background-color: {playerColor};"
																></div>
																<span class="font-semibold text-sm" style="color: {playerColor};">
																	{scoreDetail.username}
																</span>
																<span class="text-xs text-slate-500">
																	({scoreDetail.placement}{placementSuffix})
																</span>
															</div>
															<span class="font-mono font-bold text-slate-900">
																{scoreDetail.totalScore} pts
															</span>
														</div>
														<div class="grid grid-cols-7 gap-1 text-[10px] mt-1.5">
															<div class="text-center">
																<div class="text-slate-500">B</div>
																<div class="font-mono font-semibold text-blue-700">{scoreDetail.breakdown.birds}</div>
															</div>
															<div class="text-center">
																<div class="text-slate-500">C</div>
																<div class="font-mono font-semibold text-green-700">{scoreDetail.breakdown.bonusCards}</div>
															</div>
															<div class="text-center">
																<div class="text-slate-500">G</div>
																<div class="font-mono font-semibold text-yellow-700">{scoreDetail.breakdown.endOfRoundGoals}</div>
															</div>
															<div class="text-center">
																<div class="text-slate-500">E</div>
																<div class="font-mono font-semibold text-amber-700">{scoreDetail.breakdown.eggs}</div>
															</div>
															<div class="text-center">
																<div class="text-slate-500">F</div>
																<div class="font-mono font-semibold text-red-700">{scoreDetail.breakdown.foodOnCards}</div>
															</div>
															<div class="text-center">
																<div class="text-slate-500">T</div>
																<div class="font-mono font-semibold text-purple-700">{scoreDetail.breakdown.tuckedCards}</div>
															</div>
															<div class="text-center">
																<div class="text-slate-500">N</div>
																<div class="font-mono font-semibold text-pink-700">{scoreDetail.breakdown.nectar}</div>
															</div>
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center py-8 text-sm text-slate-500">No games yet</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<p class="text-slate-600 mb-4">No games recorded yet.</p>
				<Button variant="primary" on:click={handleAddGame}>Add First Game</Button>
			</div>
		</div>
	{/if}
</div>

{#if $currentLeague}
	<AddGameModal
		open={$activeModal === 'add-game'}
		leaguePlayers={$currentLeague.players}
		on:close={handleCloseModal}
		on:submit={handleGameSubmit}
	/>
{/if}

<style>
	/* Custom scrollbar for compact design */
	:global(.overflow-y-auto)::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	:global(.overflow-y-auto)::-webkit-scrollbar-track {
		background: transparent;
	}

	:global(.overflow-y-auto)::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 3px;
	}

	:global(.overflow-y-auto)::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>
