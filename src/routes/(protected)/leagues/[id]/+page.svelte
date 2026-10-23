<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { currentLeague, leagueStats, leagues } from '$lib/stores/league';
	import { activeModal } from '$lib/stores/ui';
	import AddGameModal from '$lib/components/scoreboard/AddGameModal.svelte';
	import UploadScreenshotModal from '$lib/components/scoreboard/UploadScreenshotModal.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import SeasonSelect from '$lib/components/shared/SeasonSelect.svelte';
	import type { LeagueStats } from '$lib/stores/league';
	import { formatAvg, loadSeasonList, seasonQuery, type Season } from '$lib/utils/season-client';

	let loading = true;
	let error = '';
	let gameHistory: any[] = [];
	let detailedGames: Map<number, any> = new Map();
	let hoveredPlayerId: number | null = null;
	let hoveredGameId: number | null = null;
	let inviteCopied = false;
	let inviteLink = '';
	let inviteError = '';
	let seasons: Season[] = [];
	let selectedSeasonNumber: number | null = null;
	let selectedSeason: Season | null = null;

	// Sorting state
	type SortField = 'rank' | 'player' | 'avgPlacement' | 'firstPlace' | 'avgScore' | 'wins' | 'losses' | 'games' | 'birds' | 'bonusCards' | 'endOfRoundGoals' | 'eggs' | 'foodOnCards' | 'tuckedCards' | 'nectar';
	type SortDirection = 'asc' | 'desc';
	let sortField: SortField = 'rank';
	let sortDirection: SortDirection = 'asc';

	$: leagueId = parseInt($page.params.id);

	onMount(async () => {
		await loadSeasons();
		await loadLeagueData();
	});

	async function loadSeasons() {
		const data = await loadSeasonList();
		seasons = data.seasons;
		const fromUrl = parseInt($page.url.searchParams.get('season') || '', 10);
		if (!Number.isNaN(fromUrl) && seasons.some((s) => s.number === fromUrl)) {
			selectedSeasonNumber = fromUrl;
		} else {
			selectedSeasonNumber = seasons.find((s) => s.status === 'active')?.number ?? seasons[0]?.number ?? null;
		}
		selectedSeason = seasons.find((s) => s.number === selectedSeasonNumber) ?? null;
	}

	function seasonQs() {
		const qs = seasonQuery($page.url.searchParams);
		return qs ? `?${qs}` : selectedSeasonNumber ? `?season=${selectedSeasonNumber}` : '';
	}

	async function handleSeasonChange(number: number) {
		selectedSeasonNumber = number;
		selectedSeason = seasons.find((s) => s.number === number) ?? null;
		const params = new URLSearchParams($page.url.searchParams);
		params.set('season', String(number));
		await goto(`${$page.url.pathname}?${params.toString()}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
		await loadLeagueData();
	}

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

			const qs = seasonQs();
			// Load stats
			const statsResponse = await fetch(`/api/leagues/${leagueId}/stats${qs}`);
			if (statsResponse.ok) {
				const statsData = await statsResponse.json();
				leagueStats.set(statsData.stats);
				if (statsData.season) selectedSeason = statsData.season;
			}

			// Most recently played games. The all-games page keeps upload order.
			const gamesQuery = `${qs}${qs ? '&' : '?'}limit=3&order=desc`;
			const gamesResponse = await fetch(`/api/leagues/${leagueId}/games${gamesQuery}`);
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

	function handleUploadScreenshot() {
		activeModal.set('upload-screenshot');
	}

	async function handleInvite() {
		inviteError = '';
		try {
			const response = await fetch(`/api/leagues/${leagueId}/invite`);
			const data = await response.json();
			if (!response.ok) {
				inviteError = data.error || 'Could not create invite link';
				return;
			}
			const url = `${window.location.origin}/join/${data.code}`;
			inviteLink = url;
			try {
				await navigator.clipboard.writeText(url);
				inviteCopied = true;
				setTimeout(() => {
					inviteCopied = false;
				}, 2500);
			} catch {
				inviteCopied = false;
			}
		} catch {
			inviteError = 'Could not create invite link';
		}
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

	async function handleScreenshotSaved() {
		await loadLeagueData();
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
	function getSortValue(value: number | null | undefined): { value: number; isZero: boolean } {
		return {
			value: value || 0,
			isZero: value === 0 || value == null || Number.isNaN(value)
		};
	}

	$: sortedStats = $leagueStats ? (() => {
		// Filter out players with 0 games (no stats)
		const stats = [...$leagueStats].filter(stat => stat.totalGames > 0);
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
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-6 py-3 bg-white border-b border-slate-200 shrink-0">
			<h1 class="type-title truncate text-slate-900">{$currentLeague.name}</h1>
			<div class="flex gap-2 flex-shrink-0 flex-wrap items-center">
				<SeasonSelect
					seasons={seasons}
					selectedNumber={selectedSeasonNumber}
					onchange={handleSeasonChange}
				/>
				<Button variant="ghost" size="sm" on:click={handleInvite} className="flex-1 sm:flex-initial">
					{inviteCopied ? 'Link copied' : 'Invite players'}
				</Button>
				<a href="/leagues/{leagueId}/compare{seasonQs()}" class="inline-flex items-center justify-center font-medium rounded-md transition-colors px-3 py-1.5 text-sm min-h-[2.75rem] bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 flex-1 sm:flex-initial">Compare players</a>
				<Button variant="ghost" size="sm" on:click={handleUploadScreenshot} className="flex-1 sm:flex-initial">📷 Upload Screenshot</Button>
				<Button variant="primary" size="sm" on:click={handleAddGame} className="flex-1 sm:flex-initial">+ Add Game</Button>
			</div>
		</div>
		{#if selectedSeason?.status === 'archived'}
			<div class="px-3 sm:px-6 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
				Viewing archived Season {selectedSeason.number}. New games still use the play date.
			</div>
		{/if}
		{#if inviteError || (inviteLink && !inviteCopied)}
			<div class="px-3 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 text-sm text-slate-700">
				{#if inviteError}
					<span class="text-red-700">{inviteError}</span>
				{:else}
					<span>Copy this invite link: <code class="break-all">{inviteLink}</code></span>
				{/if}
			</div>
		{/if}
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
		<div class="flex-1 overflow-hidden flex flex-col p-2 sm:p-4 gap-4">
			<!-- Leaderboard - Top Left -->
			<div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0" style="max-height: 50%;">
				<!-- Table Header -->
				<div class="bg-slate-50 border-b border-slate-200 px-2 sm:px-4 py-2 shrink-0">
					<div class="type-overline grid min-h-[2.75rem] grid-cols-12 items-center gap-1 text-slate-600 sm:gap-2">
						<button
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-0.5 px-1 min-h-[2.75rem] touch-manipulation rounded"
							on:click={() => handleSort('rank')}
						>
							<span>Rank</span>
							<svg class="w-3 h-3 sm:w-2.5 sm:h-2.5 {getSortIcon('rank') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-2 text-left hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							on:click={() => handleSort('player')}
						>
							Player
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('player') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							on:click={() => handleSort('avgPlacement')}
						>
							Avg Pl
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('avgPlacement') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							on:click={() => handleSort('avgScore')}
						>
							Avg
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('avgScore') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							title="Birds - Average points from bird cards played"
							on:click={() => handleSort('birds')}
						>
							<span>Birds</span>
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('birds') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							title="Bonus Cards - Average points from bonus card objectives"
							on:click={() => handleSort('bonusCards')}
						>
							<span>Bonus</span>
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('bonusCards') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							title="End of Round Goals - Average points from round-end goal achievements"
							on:click={() => handleSort('endOfRoundGoals')}
						>
							<span>Goals</span>
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('endOfRoundGoals') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							title="Eggs - Average points from eggs laid on bird cards"
							on:click={() => handleSort('eggs')}
						>
							<span>Eggs</span>
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('eggs') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							title="Food on Cards - Average points from food tokens on bird cards"
							on:click={() => handleSort('foodOnCards')}
						>
							<span>Cache</span>
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('foodOnCards') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							title="Tucked Cards - Average points from cards tucked under bird cards"
							on:click={() => handleSort('tuckedCards')}
						>
							<span>Tucked</span>
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('tuckedCards') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="col-span-1 text-center hover:text-slate-900 active:text-slate-900 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[2.75rem] touch-manipulation rounded"
							title="Nectar - Average points from nectar tokens (Oceania expansion)"
							on:click={() => handleSort('nectar')}
						>
							<span>Nectar</span>
							<svg class="w-4 h-4 sm:w-3 sm:h-3 {getSortIcon('nectar') === 'neutral' ? 'text-slate-400' : 'text-slate-900'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

				<!-- Table Body - Scrollable if needed -->
				<div class="flex-1 overflow-y-auto">
					<div class="divide-y divide-slate-100">
						{#each sortedStats as stat, index}
							{@const playerColor = getPlayerColor(stat.color)}
							<div
								role="button"
								tabindex="0"
								class="px-2 sm:px-4 py-3 min-h-[2.75rem] hover:bg-slate-50 active:bg-slate-100 transition-colors duration-150 cursor-pointer group touch-manipulation"
								on:click={() => (hoveredPlayerId = hoveredPlayerId === stat.userId ? null : stat.userId)}
								on:keydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										hoveredPlayerId = hoveredPlayerId === stat.userId ? null : stat.userId;
									}
								}}
							>
								<div class="type-body grid grid-cols-12 items-center gap-1 sm:gap-2">
									<!-- Rank -->
									<div class="col-span-1 text-center px-1">
										<span class="type-rank text-slate-700">{getRankBadge(index)}</span>
									</div>

									<!-- Player Name -->
									<div class="col-span-2 min-w-0">
										<div class="flex items-center gap-2 min-w-0">
											<div
												class="w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full shrink-0"
												style="background-color: {playerColor};"
											></div>
											<span class="font-semibold text-slate-900 truncate" style="color: {playerColor};">
												{stat.username}
												{#if stat.careerAverageScore != null}
													<span class="ml-1 font-normal text-slate-500">Career {formatAvg(stat.careerAverageScore)}</span>
												{/if}
											</span>
										</div>
									</div>

									<!-- Avg Placement -->
									<div class="type-data col-span-1 text-center text-slate-900">
										{formatAvg(stat.avgPlacement, 2)}
									</div>

									<!-- Avg Score -->
									<div class="type-data col-span-1 text-center font-semibold text-slate-900">
										{formatAvg(stat.averageScore)}
									</div>

									<!-- Scoring Breakdown - Compact with visible labels -->
									<div class="col-span-7 px-0 sm:px-0">
										<div class="grid grid-cols-7 gap-0.5">
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-blue-50 text-blue-700 group-hover:bg-blue-100 active:bg-blue-200 transition-colors cursor-pointer"
												title={`Birds - Average points from bird cards played (Avg: ${formatAvg(stat.avgBreakdown.birds)} pts)`}
											>
												<div class="type-chip-label">Birds</div>
												<div class="type-chip-value mt-0.5">
													{formatAvg(stat.avgBreakdown.birds)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-green-50 text-green-700 group-hover:bg-green-100 active:bg-green-200 transition-colors cursor-pointer"
												title={`Bonus Cards - Average points from bonus card objectives (Avg: ${formatAvg(stat.avgBreakdown.bonusCards)} pts)`}
											>
												<div class="type-chip-label">Bonus</div>
												<div class="type-chip-value mt-0.5">
													{formatAvg(stat.avgBreakdown.bonusCards)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-yellow-50 text-yellow-700 group-hover:bg-yellow-100 active:bg-yellow-200 transition-colors cursor-pointer"
												title={`End of Round Goals - Average points from round-end goal achievements (Avg: ${formatAvg(stat.avgBreakdown.endOfRoundGoals)} pts)`}
											>
												<div class="type-chip-label">Goals</div>
												<div class="type-chip-value mt-0.5">
													{formatAvg(stat.avgBreakdown.endOfRoundGoals)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-amber-50 text-amber-700 group-hover:bg-amber-100 active:bg-amber-200 transition-colors cursor-pointer"
												title={`Eggs - Average points from eggs laid on bird cards (Avg: ${formatAvg(stat.avgBreakdown.eggs)} pts)`}
											>
												<div class="type-chip-label">Eggs</div>
												<div class="type-chip-value mt-0.5">
													{formatAvg(stat.avgBreakdown.eggs)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-red-50 text-red-700 group-hover:bg-red-100 active:bg-red-200 transition-colors cursor-pointer"
												title={`Food on Cards - Average points from food tokens on bird cards (Avg: ${formatAvg(stat.avgBreakdown.foodOnCards)} pts)`}
											>
												<div class="type-chip-label">Cache</div>
												<div class="type-chip-value mt-0.5">
													{formatAvg(stat.avgBreakdown.foodOnCards)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-purple-50 text-purple-700 group-hover:bg-purple-100 active:bg-purple-200 transition-colors cursor-pointer"
												title={`Tucked Cards - Average points from cards tucked under bird cards (Avg: ${formatAvg(stat.avgBreakdown.tuckedCards)} pts)`}
											>
												<div class="type-chip-label">Tucked</div>
												<div class="type-chip-value mt-0.5">
													{formatAvg(stat.avgBreakdown.tuckedCards)}
												</div>
											</div>
											<div
												class="flex flex-col items-center px-0.5 py-0.5 rounded bg-pink-50 text-pink-700 group-hover:bg-pink-100 active:bg-pink-200 transition-colors cursor-pointer"
												title={`Nectar - Average points from nectar tokens, Oceania expansion (Avg: ${formatAvg(stat.avgBreakdown.nectar)} pts)`}
											>
												<div class="type-chip-label">Nectar</div>
												<div class="type-chip-value mt-0.5">
													{formatAvg(stat.avgBreakdown.nectar)}
												</div>
											</div>
										</div>
									</div>
								</div>

								<!-- Expanded Breakdown on Click -->
								{#if hoveredPlayerId === stat.userId}
									<div class="mt-2 pt-2 border-t border-slate-200 animate-in fade-in duration-200">
										<!-- Combined Stats Row -->
										<div class="type-micro mb-3 grid grid-cols-4 gap-4">
											<div class="text-center">
												<div class="text-slate-500 mb-1">Total Games</div>
												<div class="type-data font-semibold text-slate-900">
													{stat.totalGames}
												</div>
											</div>
											<div class="text-center">
												<div class="text-slate-500 mb-1">W/L</div>
												<div class="type-data font-semibold text-slate-900">
													<span class="text-emerald-600">{stat.wins}</span>/
													<span class="text-red-500">{stat.losses}</span>
												</div>
											</div>
											<div class="text-center">
												<div class="text-slate-500 mb-1">Highest Score</div>
												<div class="type-data font-semibold text-emerald-600">
													{stat.highestScore > 0 ? stat.highestScore : '—'}
												</div>
											</div>
											<div class="text-center">
												<div class="text-slate-500 mb-1">Lowest Score</div>
												<div class="type-data font-semibold text-red-500">
													{stat.lowestScore > 0 ? stat.lowestScore : '—'}
												</div>
											</div>
										</div>
										<!-- Category Breakdown -->
										<div class="type-micro grid grid-cols-7 gap-2">
											<div class="text-center">
												<div class="text-slate-500 mb-1">Birds</div>
												<div class="type-data font-semibold text-slate-900">
													{formatAvg(stat.avgBreakdown.birds)}
												</div>
											</div>
											<div class="text-center">
												<div class="text-slate-500 mb-1">Bonus</div>
												<div class="type-data font-semibold text-slate-900">
													{formatAvg(stat.avgBreakdown.bonusCards)}
												</div>
											</div>
											<div class="text-center">
												<div class="text-slate-500 mb-1">Goals</div>
												<div class="type-data font-semibold text-slate-900">
													{formatAvg(stat.avgBreakdown.endOfRoundGoals)}
												</div>
											</div>
											<div class="text-center">
												<div class="text-slate-500 mb-1">Eggs</div>
												<div class="type-data font-semibold text-slate-900">
													{formatAvg(stat.avgBreakdown.eggs)}
												</div>
											</div>
											<div class="text-center">
												<div class="text-slate-500 mb-1">Food</div>
												<div class="type-data font-semibold text-slate-900">
													{formatAvg(stat.avgBreakdown.foodOnCards)}
												</div>
											</div>
											<div class="text-center">
												<div class="text-slate-500 mb-1">Tucked</div>
												<div class="type-data font-semibold text-slate-900">
													{formatAvg(stat.avgBreakdown.tuckedCards)}
												</div>
											</div>
											<div class="text-center">
												<div class="text-slate-500 mb-1">Nectar</div>
												<div class="type-data font-semibold text-slate-900">
													{formatAvg(stat.avgBreakdown.nectar)}
												</div>
											</div>
										</div>
										<!-- View Profile Link -->
										<div class="mt-3 pt-3 border-t border-slate-200">
											<a
												href="/profile/{stat.userId}"
												class="flex items-center justify-center min-h-[2.75rem] text-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors touch-manipulation"
												on:click|stopPropagation={(e) => {
													// Allow navigation, but prevent row toggle
												}}
											>
												View Full User Profile →
											</a>
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
				<div class="bg-slate-50 border-b border-slate-200 px-2 sm:px-4 py-2 shrink-0 flex items-center justify-between">
					<h3 class="type-overline text-slate-600">Recent Games</h3>
					{#if gameHistory.length > 0}
						<a
							href="/leagues/{leagueId}/all-games{seasonQs()}"
							class="type-micro inline-flex min-h-[2.75rem] items-center px-2 font-medium text-blue-600 touch-manipulation hover:text-blue-700"
						>
							View all games →
						</a>
					{/if}
				</div>
				<div class="p-2 sm:p-4">
					{#if gameHistory.length > 0}
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
							{#each gameHistory.slice(0, 3) as game}
								{@const sortedScores = game.scores.sort((a, b) => b.totalScore - a.totalScore)}
								<div
									role="button"
									tabindex="0"
									class="border border-slate-200 rounded-lg p-3 sm:p-4 min-h-[2.75rem] hover:border-slate-300 hover:shadow-md active:border-slate-400 active:shadow-lg transition-all duration-150 cursor-pointer relative group touch-manipulation"
									on:mouseenter={() => {
										hoveredGameId = game.id;
										loadGameDetails(game.id);
									}}
									on:mouseleave={() => (hoveredGameId = null)}
									on:touchstart={() => {
										hoveredGameId = game.id;
										loadGameDetails(game.id);
									}}
								>
									<!-- Game Header -->
									<div class="flex items-center justify-between mb-2">
										<div class="type-caption font-medium text-slate-500">
											{formatDate(game.playedAt)}
										</div>
										<div class="type-caption text-slate-400">
											Game #{game.id}
										</div>
									</div>

									<!-- Player Scores -->
									<div class="space-y-1.5">
										{#each sortedScores as score, idx}
											{@const player = $currentLeague?.players.find((p) => p.id === score.userId)}
											{@const playerColor = player ? getPlayerColor(player.color) : '#94A3B8'}
											<div class="type-body flex items-center justify-between">
												<div class="flex items-center gap-2">
													<span class="type-caption type-data w-5 text-slate-400 sm:w-4">{idx + 1}.</span>
													<div
														class="w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full shrink-0"
														style="background-color: {playerColor};"
													></div>
													<span class="font-medium text-slate-900 truncate" style="color: {playerColor};">
														{player?.username || 'Unknown'}
													</span>
												</div>
												<span class="type-data font-semibold text-slate-900">
													{score.totalScore}
												</span>
											</div>
										{/each}
									</div>

									<!-- Detailed Breakdown on Hover -->
									{#if hoveredGameId === game.id && detailedGames.has(game.id)}
										{@const gameDetails = detailedGames.get(game.id)}
										<div class="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 animate-in fade-in duration-200">
											<div class="type-micro mb-3 font-medium text-slate-500">
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
																<span class="type-body font-semibold" style="color: {playerColor};">
																	{scoreDetail.username}
																</span>
																<span class="type-micro text-slate-500">
																	({scoreDetail.placement}{placementSuffix})
																</span>
															</div>
															<span class="type-data font-bold text-slate-900">
																{scoreDetail.totalScore} pts
															</span>
														</div>
														<div class="mt-1.5 grid grid-cols-7 gap-1">
															<div class="text-center">
																<div class="type-chip-label text-slate-500">Birds</div>
																<div class="type-chip-value font-semibold text-blue-700">{scoreDetail.breakdown.birds}</div>
															</div>
															<div class="text-center">
																<div class="type-chip-label text-slate-500">Bonus</div>
																<div class="type-chip-value font-semibold text-green-700">{scoreDetail.breakdown.bonusCards}</div>
															</div>
															<div class="text-center">
																<div class="type-chip-label text-slate-500">Goals</div>
																<div class="type-chip-value font-semibold text-yellow-700">{scoreDetail.breakdown.endOfRoundGoals}</div>
															</div>
															<div class="text-center">
																<div class="type-chip-label text-slate-500">Eggs</div>
																<div class="type-chip-value font-semibold text-amber-700">{scoreDetail.breakdown.eggs}</div>
															</div>
															<div class="text-center">
																<div class="type-chip-label text-slate-500">Cache</div>
																<div class="type-chip-value font-semibold text-red-700">{scoreDetail.breakdown.foodOnCards}</div>
															</div>
															<div class="text-center">
																<div class="type-chip-label text-slate-500">Tucked</div>
																<div class="type-chip-value font-semibold text-purple-700">{scoreDetail.breakdown.tuckedCards}</div>
															</div>
															<div class="text-center">
																<div class="type-chip-label text-slate-500">Nectar</div>
																<div class="type-chip-value font-semibold text-pink-700">{scoreDetail.breakdown.nectar}</div>
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
						<div class="type-body py-8 text-center text-slate-500">
							{#if selectedSeason?.status === 'archived'}
								No games in Season {selectedSeason.number} for this league.
							{:else}
								No games this season yet.
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<p class="type-body mb-4 text-slate-600">
					{#if selectedSeason?.status === 'archived'}
						No games in Season {selectedSeason.number} for this league.
					{:else}
						No games this season yet.
					{/if}
				</p>
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
	<UploadScreenshotModal
		open={$activeModal === 'upload-screenshot'}
		leagueId={leagueId}
		leaguePlayers={$currentLeague.players}
		on:close={handleCloseModal}
		on:saved={handleScreenshotSaved}
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
