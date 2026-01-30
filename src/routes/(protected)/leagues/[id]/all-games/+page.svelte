<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { currentLeague } from '$lib/stores/league';

	type GameSummary = {
		id: number;
		playedAt: string;
		scores: Array<{ userId: number; totalScore: number }>;
	};

	type GameDetails = {
		id: number;
		playedAt: string;
		scores: Array<{
			userId: number;
			username: string;
			placement: number;
			totalScore: number;
			breakdown: {
				birds: number;
				bonusCards: number;
				endOfRoundGoals: number;
				eggs: number;
				foodOnCards: number;
				tuckedCards: number;
				nectar: number;
			};
		}>;
	};

	let loading = true;
	let error = '';
	let games: GameSummary[] = [];
	let totalGames = 0;
	const limit = 10;
	let currentPage = 1;
	let totalPages = 1;
	let expandedGameId: number | null = null;
	let detailedGames: Map<number, GameDetails> = new Map();

	// Derive league ID from URL path so it's correct on this nested route (/leagues/5/all-games)
	$: leagueId = (() => {
		const m = $page.url.pathname.match(/^\/leagues\/(\d+)/);
		return m ? parseInt(m[1], 10) : 0;
	})();
	$: totalPages = Math.max(1, Math.ceil(totalGames / limit));

	onMount(async () => {
		if (leagueId > 0) {
			await loadLeague();
			await loadPage(1);
		} else {
			loading = false;
			error = 'Invalid league';
		}
	});

	async function loadLeague() {
		try {
			const res = await fetch(`/api/leagues/${leagueId}`);
			if (res.ok) {
				const data = await res.json();
				currentLeague.set(data.league);
			}
		} catch (e) {
			error = 'Failed to load league';
		}
	}

	async function loadPage(pageNum: number) {
		if (leagueId <= 0) return;
		loading = true;
		error = '';
		const offset = (pageNum - 1) * limit;
		try {
			const res = await fetch(`/api/leagues/${leagueId}/games?limit=${limit}&offset=${offset}`);
			if (!res.ok) {
				error = 'Failed to load games';
				return;
			}
			const data = await res.json();
			games = data.games;
			totalGames = data.total;
			currentPage = pageNum;
			expandedGameId = null;
		} catch (e) {
			error = 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function handleToggleGame(gameId: number) {
		if (expandedGameId === gameId) {
			expandedGameId = null;
			return;
		}
		expandedGameId = gameId;
		if (!detailedGames.has(gameId)) {
			try {
				const res = await fetch(`/api/games/${gameId}`);
				if (res.ok) {
					const data = await res.json();
					detailedGames.set(gameId, data.game);
				}
			} catch (e) {
				console.error('Failed to load game details', e);
			}
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
</script>

<div class="h-screen flex flex-col bg-slate-50">
	{#if $currentLeague}
		<div class="flex items-center justify-between px-3 sm:px-6 py-3 bg-white border-b border-slate-200 shrink-0">
			<div class="flex items-center gap-3">
				<a
					href="/leagues/{leagueId}"
					class="text-slate-600 hover:text-slate-900 text-sm font-medium"
				>
					← Back to league
				</a>
				<h1 class="text-lg sm:text-xl font-bold text-slate-900">{$currentLeague.name} – All Games</h1>
			</div>
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
	{:else if games.length === 0}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<p class="text-slate-600 mb-4">No games recorded yet in this league.</p>
				<a href="/leagues/{leagueId}" class="text-blue-600 hover:text-blue-700 font-medium">← Back to league</a>
			</div>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto p-2 sm:p-4">
			<div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
				<div class="bg-slate-50 border-b border-slate-200 px-2 sm:px-4 py-2">
					<h2 class="text-sm sm:text-xs font-semibold text-slate-600 uppercase tracking-wider">All Games</h2>
				</div>
				<div class="p-2 sm:p-4 space-y-3">
					{#each games as game}
						{@const sortedScores = game.scores.slice().sort((a, b) => b.totalScore - a.totalScore)}
						<div
							role="button"
							tabindex="0"
							class="border border-slate-200 rounded-lg p-3 sm:p-4 hover:border-slate-300 hover:shadow-sm cursor-pointer transition"
							on:click={() => handleToggleGame(game.id)}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleToggleGame(game.id);
								}
							}}
						>
							<div class="flex items-center justify-between mb-2">
								<div class="text-sm sm:text-xs text-slate-500 font-medium">
									{formatDate(game.playedAt)}
								</div>
								<div class="text-sm sm:text-xs text-slate-400">
									Game #{game.id}
								</div>
							</div>

							<div class="space-y-1.5">
								{#each sortedScores as score, idx}
									{@const player = $currentLeague?.players?.find((p: { id: number }) => p.id === score.userId)}
									{@const playerColor = player ? getPlayerColor(player.color) : '#94A3B8'}
									<div class="flex items-center justify-between text-base sm:text-sm">
										<div class="flex items-center gap-2">
											<span class="text-slate-400 font-mono text-sm sm:text-xs w-5 sm:w-4">{idx + 1}.</span>
											<div
												class="w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full shrink-0"
												style="background-color: {playerColor};"
											></div>
											<span class="font-medium text-slate-900 truncate" style="color: {playerColor};">
												{player?.username ?? 'Unknown'}
											</span>
										</div>
										<span class="font-mono font-semibold text-slate-900 tabular-nums">
											{score.totalScore}
										</span>
									</div>
								{/each}
							</div>

							{#if expandedGameId === game.id && detailedGames.has(game.id)}
								{@const gameDetails = detailedGames.get(game.id)!}
								<div class="mt-3 pt-3 border-t border-slate-200">
									<div class="text-xs text-slate-500 mb-3 font-medium">
										{formatDateTime(gameDetails.playedAt)}
									</div>
									<div class="space-y-2">
										{#each gameDetails.scores.slice().sort((a, b) => a.placement - b.placement) as scoreDetail}
											{@const player = $currentLeague?.players?.find((p: { id: number }) => p.id === scoreDetail.userId)}
											{@const playerColor = player ? getPlayerColor(player.color) : '#94A3B8'}
											{@const suffix = scoreDetail.placement === 1 ? 'st' : scoreDetail.placement === 2 ? 'nd' : scoreDetail.placement === 3 ? 'rd' : 'th'}
											<div class="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
												<div class="flex items-center justify-between mb-1.5">
													<div class="flex items-center gap-2">
														<div
															class="w-2 h-2 rounded-full shrink-0"
															style="background-color: {playerColor};"
														></div>
														<span class="font-semibold text-sm" style="color: {playerColor};">
															{scoreDetail.username}
														</span>
														<span class="text-xs text-slate-500">
															({scoreDetail.placement}{suffix})
														</span>
													</div>
													<span class="font-mono font-bold text-slate-900">
														{scoreDetail.totalScore} pts
													</span>
												</div>
												<div class="grid grid-cols-7 gap-1 text-[10px] mt-1.5">
													<div class="text-center">
														<div class="text-slate-500 text-[9px]">Birds</div>
														<div class="font-mono font-semibold text-blue-700">{scoreDetail.breakdown.birds}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-500 text-[9px]">Bonus</div>
														<div class="font-mono font-semibold text-green-700">{scoreDetail.breakdown.bonusCards}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-500 text-[9px]">Goals</div>
														<div class="font-mono font-semibold text-yellow-700">{scoreDetail.breakdown.endOfRoundGoals}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-500 text-[9px]">Eggs</div>
														<div class="font-mono font-semibold text-amber-700">{scoreDetail.breakdown.eggs}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-500 text-[9px]">Cache</div>
														<div class="font-mono font-semibold text-red-700">{scoreDetail.breakdown.foodOnCards}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-500 text-[9px]">Tucked</div>
														<div class="font-mono font-semibold text-purple-700">{scoreDetail.breakdown.tuckedCards}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-500 text-[9px]">Nectar</div>
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

				<div class="border-t border-slate-200 px-2 sm:px-4 py-3 flex items-center justify-between">
					<span class="text-sm text-slate-600">
						Page {currentPage} of {totalPages}
					</span>
					<div class="flex gap-2">
						<button
							class="px-3 py-1.5 text-sm font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={currentPage <= 1}
							on:click={() => loadPage(currentPage - 1)}
						>
							Previous
						</button>
						<button
							class="px-3 py-1.5 text-sm font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={currentPage >= totalPages}
							on:click={() => loadPage(currentPage + 1)}
						>
							Next
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
