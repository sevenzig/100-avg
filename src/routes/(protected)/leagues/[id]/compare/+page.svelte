<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { user } from '$lib/stores/auth';
	import { currentLeague, leagueStats } from '$lib/stores/league';
	import Button from '$lib/components/shared/Button.svelte';
	import type { LeagueStats } from '$lib/stores/league';

	const MAX_OTHER_PLAYERS = 5;
	const METRIC_LABELS: Record<string, string> = {
		avgPlacement: 'Avg place',
		averageScore: 'Avg score',
		birds: 'Birds',
		bonusCards: 'Bonus',
		endOfRoundGoals: 'Goals',
		eggs: 'Eggs',
		foodOnCards: 'Cache',
		tuckedCards: 'Tucked',
		nectar: 'Nectar'
	};
	/** Lower is better for placement only */
	const LOWER_IS_BETTER = new Set(['avgPlacement']);

	let loading = true;
	let error = '';
	let selectedIds: number[] = [];

	$: leagueId = parseInt($page.params.id, 10);
	$: leagueIdValid = Number.isFinite(leagueId);
	$: if (!leagueIdValid) {
		loading = false;
		error = error || 'Invalid league';
	}

	onMount(async () => {
		if (leagueIdValid) await loadData();
	});

	async function loadData() {
		loading = true;
		error = '';
		try {
			const [leagueRes, statsRes] = await Promise.all([
				fetch(`/api/leagues/${leagueId}`),
				fetch(`/api/leagues/${leagueId}/stats`)
			]);
			if (!leagueRes.ok) {
				error = 'Failed to load league';
				return;
			}
			const leagueData = await leagueRes.json();
			currentLeague.set(leagueData.league);
			if (statsRes.ok) {
				const statsData = await statsRes.json();
				leagueStats.set(statsData.stats);
			}
		} catch (e) {
			error = 'An error occurred';
		} finally {
			loading = false;
		}
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

	$: stats = ($leagueStats ?? []) as LeagueStats[];
	$: currentUserId = $user?.id ?? null;
	$: myStat = currentUserId ? stats.find((s) => s.userId === currentUserId) ?? null : null;
	$: otherPlayers = stats.filter((s) => s.userId !== currentUserId && s.totalGames > 0);
	$: selectedStats = selectedIds
		.map((id) => stats.find((s) => s.userId === id))
		.filter(Boolean) as LeagueStats[];
	$: comparisonPlayers = myStat
		? [myStat, ...selectedStats]
		: selectedStats;
	$: canAddMore = selectedIds.length < MAX_OTHER_PLAYERS;

	function togglePlayer(userId: number) {
		if (selectedIds.includes(userId)) {
			selectedIds = selectedIds.filter((id) => id !== userId);
		} else if (selectedIds.length < MAX_OTHER_PLAYERS) {
			selectedIds = [...selectedIds, userId];
		}
	}

	function getNumericValue(stat: LeagueStats, key: string): number {
		if (key === 'avgPlacement') return stat.avgPlacement;
		if (key === 'averageScore') return stat.averageScore;
		const b = stat.avgBreakdown;
		switch (key) {
			case 'birds':
				return b.birds;
			case 'bonusCards':
				return b.bonusCards;
			case 'endOfRoundGoals':
				return b.endOfRoundGoals;
			case 'eggs':
				return b.eggs;
			case 'foodOnCards':
				return b.foodOnCards;
			case 'tuckedCards':
				return b.tuckedCards;
			case 'nectar':
				return b.nectar;
			default:
				return 0;
		}
	}

	function isBestInRow(stat: LeagueStats, key: string): boolean {
		if (comparisonPlayers.length <= 1) return false;
		const vals = comparisonPlayers.map((s: LeagueStats) => getNumericValue(s, key));
		const lowerBetter = LOWER_IS_BETTER.has(key);
		const best = lowerBetter ? Math.min(...vals) : Math.max(...vals);
		return getNumericValue(stat, key) === best;
	}
</script>

<div class="min-h-screen flex flex-col bg-slate-50">
	<div class="shrink-0 px-3 sm:px-6 py-3 bg-white border-b border-slate-200">
		<div class="flex flex-col gap-3">
			<div class="flex items-center gap-2 text-sm text-slate-600">
				<a href="/leagues" class="hover:text-slate-900">Leagues</a>
				<span aria-hidden="true">/</span>
				{#if leagueIdValid && $currentLeague}
					<a href="/leagues/{leagueId}" class="hover:text-slate-900">{$currentLeague.name}</a>
					<span aria-hidden="true">/</span>
				{/if}
				<span class="text-slate-900 font-medium">Compare players</span>
			</div>
			<h1 class="text-xl font-bold text-slate-900">Compare players</h1>
		</div>
	</div>

	{#if loading}
		<div class="flex-1 flex justify-center items-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="flex-1 flex items-center justify-center py-12">
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
		</div>
	{:else if !$currentLeague}
		<div class="flex-1 flex items-center justify-center py-12">
			<p class="text-slate-600">League not found.</p>
		</div>
	{:else}
		<div class="flex-1 p-3 sm:p-6 overflow-auto">
			<!-- Player selection -->
			<div class="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-6">
				<h2 class="text-sm font-semibold text-slate-700 mb-3">Compare with (up to {MAX_OTHER_PLAYERS})</h2>
				<div class="flex flex-wrap gap-2">
					{#each otherPlayers as stat}
						{@const isSelected = selectedIds.includes(stat.userId)}
						{@const color = getPlayerColor(stat.color)}
						<button
							type="button"
							class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors min-h-[2.75rem] touch-manipulation {isSelected
								? 'border-slate-400 bg-slate-100 text-slate-900'
								: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
							disabled={!isSelected && !canAddMore}
							on:click={() => togglePlayer(stat.userId)}
						>
							<span
								class="w-2.5 h-2.5 rounded-full shrink-0"
								style="background-color: {color};"
							></span>
							{stat.username}
							{#if isSelected}
								<span class="text-slate-500" aria-hidden="true">×</span>
							{/if}
						</button>
					{/each}
					{#if otherPlayers.length === 0}
						<p class="text-slate-500 text-sm">No other players with games in this league.</p>
					{/if}
				</div>
			</div>

			{#if comparisonPlayers.length === 0}
				<div class="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-600">
					{#if !myStat}
						<p>You have no games in this league yet. Add games to see your stats and compare.</p>
					{:else}
						<p>Select one or more players above to compare stats.</p>
					{/if}
				</div>
			{:else}
				<!-- Comparison table -->
				<div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full min-w-[600px] text-sm" role="grid">
							<thead>
								<tr class="bg-slate-50 border-b border-slate-200">
									<th class="text-left py-3 px-4 font-semibold text-slate-700 w-32">Metric</th>
									{#each comparisonPlayers as stat}
										<th class="py-3 px-4 font-semibold text-slate-700 text-center min-w-[100px]">
											<div class="flex flex-col items-center gap-1">
												<span
													class="w-3 h-3 rounded-full shrink-0"
													style="background-color: {getPlayerColor(stat.color)};"
												></span>
												<span class="{stat.userId === currentUserId ? 'font-bold text-blue-700' : ''}">
													{stat.userId === currentUserId ? 'You' : stat.username}
												</span>
											</div>
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each Object.entries(METRIC_LABELS) as [key, label]}
									<tr class="border-b border-slate-100 hover:bg-slate-50/50">
										<td class="py-2.5 px-4 font-medium text-slate-700">{label}</td>
										{#each comparisonPlayers as stat}
											{@const val = getNumericValue(stat, key)}
											{@const best = isBestInRow(stat, key)}
											<td
												class="py-2.5 px-4 text-center {best
													? 'bg-emerald-100 ring-1 ring-emerald-200/80'
													: ''}"
											>
												<span
													class="font-mono tabular-nums {best
														? 'font-bold text-emerald-900'
														: 'text-slate-900'}"
												>
													{key === 'avgPlacement' || key === 'averageScore' ? val.toFixed(2) : val.toFixed(1)}
												</span>
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
