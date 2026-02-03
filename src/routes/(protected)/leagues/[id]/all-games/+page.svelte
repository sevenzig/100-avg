<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { currentLeague } from '$lib/stores/league';
	import { user } from '$lib/stores/auth';
	import EditGameModal from '$lib/components/scoreboard/EditGameModal.svelte';
	import Button from '$lib/components/shared/Button.svelte';

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

	// Edit/Delete state
	let editModalOpen = false;
	let editingGame: GameDetails | null = null;
	let deleteConfirmGameId: number | null = null;
	let deleteLoading = false;
	let actionError = '';

	// Check if current user can manage games in this league
	$: canManageGames = $user?.isSuperAdmin || ($user?.id && $currentLeague?.createdBy === $user.id);

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

	function handleEditClick(e: Event, gameId: number) {
		e.stopPropagation();
		const gameDetails = detailedGames.get(gameId);
		if (gameDetails) {
			editingGame = gameDetails;
			editModalOpen = true;
		} else {
			// Fetch game details first
			fetch(`/api/games/${gameId}`)
				.then((res) => res.json())
				.then((data) => {
					if (data.game) {
						detailedGames.set(gameId, data.game);
						editingGame = data.game;
						editModalOpen = true;
					}
				})
				.catch((err) => {
					console.error('Failed to load game for editing:', err);
					actionError = 'Failed to load game details';
				});
		}
	}

	function handleDeleteClick(e: Event, gameId: number) {
		e.stopPropagation();
		deleteConfirmGameId = gameId;
	}

	function cancelDelete() {
		deleteConfirmGameId = null;
	}

	async function confirmDelete() {
		if (!deleteConfirmGameId) return;

		deleteLoading = true;
		actionError = '';

		try {
			const res = await fetch(`/api/games/${deleteConfirmGameId}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				// Remove from local state and refresh
				detailedGames.delete(deleteConfirmGameId);
				deleteConfirmGameId = null;
				await loadPage(currentPage);
			} else {
				const data = await res.json();
				actionError = data.error || 'Failed to delete game';
			}
		} catch (err) {
			console.error('Delete game error:', err);
			actionError = 'Failed to delete game';
		} finally {
			deleteLoading = false;
		}
	}

	async function handleEditSubmit(e: CustomEvent) {
		const { gameId, playedAt, scores } = e.detail;
		actionError = '';

		try {
			const res = await fetch(`/api/games/${gameId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playedAt, scores })
			});

			if (res.ok) {
				const data = await res.json();
				// Update local cache
				detailedGames.set(gameId, data.game);
				editModalOpen = false;
				editingGame = null;
				await loadPage(currentPage);
			} else {
				const data = await res.json();
				actionError = data.error || 'Failed to update game';
			}
		} catch (err) {
			console.error('Update game error:', err);
			actionError = 'Failed to update game';
		}
	}

	function closeEditModal() {
		editModalOpen = false;
		editingGame = null;
	}
</script>

<EditGameModal
	open={editModalOpen}
	game={editingGame}
	on:close={closeEditModal}
	on:submit={handleEditSubmit}
/>

<!-- Delete Confirmation Modal -->
{#if deleteConfirmGameId !== null}
	<div class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
		<div class="flex min-h-full items-center justify-center p-4 sm:p-6">
			<div class="fixed inset-0 bg-black/30 transition-opacity" aria-hidden="true" on:click={cancelDelete}></div>
			<div class="relative bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
				<h3 class="text-lg font-semibold text-slate-900 mb-2">Delete Game?</h3>
				<p class="text-slate-600 text-sm mb-4">
					This will permanently delete game #{deleteConfirmGameId} and all its scores. This action cannot be undone.
				</p>
				<div class="flex gap-2 justify-end">
					<Button variant="ghost" on:click={cancelDelete} disabled={deleteLoading}>Cancel</Button>
					<Button
						variant="primary"
						on:click={confirmDelete}
						loading={deleteLoading}
						className="bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700"
					>
						Delete
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}

<div class="h-screen flex flex-col bg-slate-50">
	{#if actionError}
		<div class="bg-red-50 border-b border-red-200 px-4 py-2 text-red-800 text-sm flex items-center gap-2">
			<svg class="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
			</svg>
			<span>{actionError}</span>
			<button class="ml-auto text-red-600 hover:text-red-800" aria-label="Dismiss error" on:click={() => actionError = ''}>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
				</svg>
			</button>
		</div>
	{/if}

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
								<div class="flex items-center gap-2">
									{#if canManageGames}
										<button
											class="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
											on:click={(e) => handleEditClick(e, game.id)}
										>
											Edit
										</button>
										<button
											class="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
											on:click={(e) => handleDeleteClick(e, game.id)}
										>
											Delete
										</button>
									{/if}
									<div class="text-sm sm:text-xs text-slate-400">
										Game #{game.id}
									</div>
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
