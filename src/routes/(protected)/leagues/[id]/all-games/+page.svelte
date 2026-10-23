<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { currentLeague } from '$lib/stores/league';
	import { user } from '$lib/stores/auth';
	import EditGameModal from '$lib/components/scoreboard/EditGameModal.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import SeasonSelect from '$lib/components/shared/SeasonSelect.svelte';
	import { loadSeasonList, type Season } from '$lib/utils/season-client';

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
	let selectedGameId: number | null = null;
	let detailedGames: Map<number, GameDetails> = new Map();

	const CATEGORIES = [
		{ key: 'birds', label: 'Birds', chip: 'bg-blue-50 text-blue-700' },
		{ key: 'bonusCards', label: 'Bonus', chip: 'bg-green-50 text-green-700' },
		{ key: 'endOfRoundGoals', label: 'Goals', chip: 'bg-yellow-50 text-yellow-700' },
		{ key: 'eggs', label: 'Eggs', chip: 'bg-amber-50 text-amber-700' },
		{ key: 'foodOnCards', label: 'Cache', chip: 'bg-red-50 text-red-700' },
		{ key: 'tuckedCards', label: 'Tucked', chip: 'bg-purple-50 text-purple-700' },
		{ key: 'nectar', label: 'Nectar', chip: 'bg-pink-50 text-pink-700' }
	] as const;

	// Edit/Delete state
	let editModalOpen = false;
	let editingGame: GameDetails | null = null;
	let deleteConfirmGameId: number | null = null;
	let deleteLoading = false;
	let actionError = '';
	let seasons: Season[] = [];
	let selectedSeasonNumber: number | null = null;
	let selectedSeason: Season | null = null;

	// Check if current user can manage games in this league
	$: canManageGames = $user?.isSuperAdmin || ($user?.id && $currentLeague?.createdBy === $user.id);

	// Derive league ID from URL path so it's correct on this nested route (/leagues/5/all-games)
	$: leagueId = (() => {
		const m = $page.url.pathname.match(/^\/leagues\/(\d+)/);
		return m ? parseInt(m[1], 10) : 0;
	})();

	onMount(async () => {
		if (leagueId > 0) {
			await loadSeasons();
			await loadLeague();
			await loadGames();
		} else {
			loading = false;
			error = 'Invalid league';
		}
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
		return selectedSeasonNumber ? `season=${selectedSeasonNumber}` : '';
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
		await loadGames();
	}

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

	async function loadGames(keepId?: number) {
		if (leagueId <= 0) return;
		loading = true;
		error = '';
		const season = seasonQs();
		const pageSize = 100;
		const collected: GameSummary[] = [];
		try {
			let offset = 0;
			let total = 0;
			do {
				const res = await fetch(
					`/api/leagues/${leagueId}/games?limit=${pageSize}&offset=${offset}${season ? `&${season}` : ''}`
				);
				if (!res.ok) {
					error = 'Failed to load games';
					return;
				}
				const data = await res.json();
				const batch = data.games as GameSummary[];
				collected.push(...batch);
				total = data.total;
				if (data.season) selectedSeason = data.season;
				if (batch.length === 0) break;
				offset += batch.length;
			} while (collected.length < total);
			games = collected;
			const nextId = keepId && games.some((g) => g.id === keepId) ? keepId : games[0]?.id;
			if (nextId) await selectGame(nextId);
			else selectedGameId = null;
		} catch (e) {
			error = 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function selectGame(gameId: number) {
		selectedGameId = gameId;
		if (detailedGames.has(gameId)) return;
		try {
			const res = await fetch(`/api/games/${gameId}`);
			if (res.ok) {
				const data = await res.json();
				detailedGames.set(gameId, data.game);
				detailedGames = new Map(detailedGames);
			}
		} catch (e) {
			console.error('Failed to load game details', e);
		}
	}

	function placeSuffix(n: number) {
		if (n === 1) return 'st';
		if (n === 2) return 'nd';
		if (n === 3) return 'rd';
		return 'th';
	}

	function medalClass(placement: number) {
		if (placement === 1) return 'bg-[#F6E3A1]';
		if (placement === 2) return 'bg-[#E4E7EC]';
		if (placement === 3) return 'bg-[#E8C9A8]';
		return '';
	}

	function scrollSelected(node: HTMLElement, selected: boolean) {
		if (selected) node.scrollIntoView({ inline: 'center', block: 'nearest' });
		return {
			update(next: boolean) {
				if (next) node.scrollIntoView({ inline: 'center', block: 'nearest' });
			}
		};
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

	function formatListDate(dateString: string) {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
				await loadGames();
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
				detailedGames = new Map(detailedGames);
				editModalOpen = false;
				editingGame = null;
				await loadGames(gameId);
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
				<h3 class="type-title mb-2 text-slate-900">Delete Game?</h3>
				<p class="type-body mb-4 text-slate-600">
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

<div class="flex h-[calc(100dvh-6rem)] flex-col bg-slate-50 sm:h-[calc(100dvh-8rem)]">
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
		<div class="flex items-center justify-between gap-3 px-3 sm:px-6 py-3 bg-white border-b border-slate-200 shrink-0 flex-wrap">
			<div class="flex items-center gap-3 min-w-0">
				<a
					href="/leagues/{leagueId}{selectedSeasonNumber ? `?season=${selectedSeasonNumber}` : ''}"
					class="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm font-medium shrink-0"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
						<path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					Back to league
				</a>
				<h1 class="type-title truncate text-slate-900">{$currentLeague.name} – All Games</h1>
			</div>
			<SeasonSelect
				seasons={seasons}
				selectedNumber={selectedSeasonNumber}
				onchange={handleSeasonChange}
			/>
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
				<p class="type-body mb-4 text-slate-600">
					{#if selectedSeason?.status === 'archived'}
						No games in Season {selectedSeason.number} for this league.
					{:else}
						No games this season yet.
					{/if}
				</p>
				<a href="/leagues/{leagueId}" class="text-blue-600 hover:text-blue-700 font-medium">Back to league</a>
			</div>
		</div>
	{:else}
		{@const details = selectedGameId != null ? detailedGames.get(selectedGameId) : undefined}
		<div class="flex min-h-0 flex-1 flex-col">
			<div class="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden" aria-label="Games">
				{#each games as game}
					{@const top = game.scores.slice().sort((a, b) => b.totalScore - a.totalScore || a.userId - b.userId)[0]}
					{@const player = $currentLeague?.players?.find((p: { id: number }) => p.id === top?.userId)}
					{@const playerColor = player ? getPlayerColor(player.color) : '#94A3B8'}
					{@const on = game.id === selectedGameId}
					<button
						type="button"
						class="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 {on ? 'border-blue-300 bg-blue-100' : 'border-slate-200 bg-white'}"
						aria-pressed={on}
						use:scrollSelected={on}
						on:click={() => selectGame(game.id)}
					>
						<time datetime={game.playedAt} title={formatDateTime(game.playedAt)} class="type-caption text-slate-500">{formatListDate(game.playedAt)}</time>
						<span class="type-caption inline-flex items-center gap-1 font-semibold text-slate-900">
							<span class="h-2 w-2 rounded-full" style="background-color: {playerColor}"></span>
							{player?.username ?? 'Unknown'}
						</span>
						<span class="type-data font-semibold text-slate-900">{top?.totalScore ?? ''}</span>
					</button>
				{/each}
			</div>

			<div class="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-3 lg:p-3">
				<div class="hidden min-h-0 overflow-y-auto rounded-lg border border-slate-200 bg-white lg:block">
					{#each games as game}
						{@const top = game.scores.slice().sort((a, b) => b.totalScore - a.totalScore || a.userId - b.userId)[0]}
						{@const player = $currentLeague?.players?.find((p: { id: number }) => p.id === top?.userId)}
						{@const playerColor = player ? getPlayerColor(player.color) : '#94A3B8'}
						{@const on = game.id === selectedGameId}
						<button
							type="button"
							class="flex w-full items-center gap-2 border-b border-slate-200 px-3 py-2.5 text-left {on ? 'bg-blue-100' : 'hover:bg-slate-50'}"
							aria-pressed={on}
							use:scrollSelected={on}
							on:click={() => selectGame(game.id)}
						>
							<time datetime={game.playedAt} title={formatDateTime(game.playedAt)} class="type-caption w-16 shrink-0 text-slate-500">{formatListDate(game.playedAt)}</time>
							<span class="inline-flex min-w-0 flex-1 items-center gap-2 font-semibold text-slate-900">
								<span class="h-2 w-2 shrink-0 rounded-full" style="background-color: {playerColor}"></span>
								<span class="truncate">{player?.username ?? 'Unknown'}</span>
							</span>
							<span class="type-data font-semibold text-slate-900">{top?.totalScore ?? ''}</span>
						</button>
					{/each}
				</div>

				<section class="min-h-0 overflow-y-auto bg-white lg:rounded-lg lg:border lg:border-slate-200" aria-live="polite">
					{#if details}
						<div class="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
							<h2 class="type-heading text-slate-900" title={formatDateTime(details.playedAt)}>
								{formatListDate(details.playedAt)}
								<span class="type-micro ml-1.5 font-medium text-slate-500">Game #{details.id}</span>
							</h2>
							{#if canManageGames}
								<div class="flex items-center">
									<button type="button" class="min-h-11 rounded px-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50" on:click={(e) => handleEditClick(e, details.id)}>Edit</button>
									<button type="button" class="min-h-11 rounded px-2.5 text-sm font-semibold text-red-600 hover:bg-red-50" on:click={(e) => handleDeleteClick(e, details.id)}>Delete</button>
								</div>
							{/if}
						</div>

						<div class="hidden overflow-x-auto lg:block">
							<table class="type-body w-full table-fixed border-collapse">
								<colgroup>
									<col style="width: 240px" />
									<col style="width: 64px" />
									{#each CATEGORIES as cat}
										<col data-cat={cat.key} />
									{/each}
								</colgroup>
								<thead>
									<tr class="border-b border-slate-200">
										<th scope="col" class="type-overline px-2 py-2 text-left align-bottom text-slate-600">Player</th>
										<th scope="col" class="type-overline px-1 py-2 text-center align-bottom text-slate-600">Total</th>
										{#each CATEGORIES as cat}
											<th scope="col" class="type-overline h-[76px] px-0 py-1 text-center align-bottom text-slate-600" title={cat.label}>
												<span class="inline-block [writing-mode:vertical-rl] rotate-180">{cat.label}</span>
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each details.scores.slice().sort((a, b) => a.placement - b.placement) as scoreDetail}
										{@const player = $currentLeague?.players?.find((p: { id: number }) => p.id === scoreDetail.userId)}
										{@const playerColor = player ? getPlayerColor(player.color) : '#94A3B8'}
										<tr class="border-b border-slate-200">
											<th scope="row" class="overflow-hidden px-2 py-2 text-left font-normal {medalClass(scoreDetail.placement)}">
												<span class="inline-flex max-w-full items-center gap-2">
													<span class="type-micro type-data w-7 shrink-0 font-medium text-slate-500">{scoreDetail.placement}{placeSuffix(scoreDetail.placement)}</span>
													<span class="h-2 w-2 shrink-0 rounded-full" style="background-color: {playerColor}"></span>
													<span class="truncate font-semibold text-slate-900">{scoreDetail.username}</span>
												</span>
											</th>
											<td class="type-data text-center font-semibold text-slate-900">{scoreDetail.totalScore}</td>
											{#each CATEGORIES as cat}
												<td class="px-0.5 py-2 text-center">
													<span class="type-micro type-data inline-flex min-w-7 items-center justify-center rounded px-1 py-0.5 font-semibold {cat.chip}">{scoreDetail.breakdown[cat.key]}</span>
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<div class="lg:hidden">
							{#each details.scores.slice().sort((a, b) => a.placement - b.placement) as scoreDetail}
								{@const player = $currentLeague?.players?.find((p: { id: number }) => p.id === scoreDetail.userId)}
								{@const playerColor = player ? getPlayerColor(player.color) : '#94A3B8'}
								<article class="border-b border-slate-200 bg-white px-3 py-2">
									<header class="flex items-center justify-between gap-2 rounded-md px-2 py-1 {medalClass(scoreDetail.placement)}">
										<span class="inline-flex items-center gap-2 font-semibold text-slate-900">
											<span class="type-micro type-data w-7 font-medium text-slate-500">{scoreDetail.placement}{placeSuffix(scoreDetail.placement)}</span>
											<span class="h-2 w-2 shrink-0 rounded-full" style="background-color: {playerColor}"></span>
											{scoreDetail.username}
										</span>
										<span class="type-data font-semibold text-slate-900">{scoreDetail.totalScore}</span>
									</header>
									<div class="mt-1 grid grid-cols-7 gap-1">
										{#each CATEGORIES as cat}
											<div class="flex flex-col items-center rounded px-0.5 py-0.5 {cat.chip}" title={cat.label}>
												<span class="type-chip-label">{cat.label}</span>
												<span class="type-chip-value font-semibold">{scoreDetail.breakdown[cat.key]}</span>
											</div>
										{/each}
									</div>
								</article>
							{/each}
						</div>
					{:else}
						<div class="type-body flex h-full items-center justify-center p-6 text-slate-500">Loading game…</div>
					{/if}
				</section>
			</div>

		</div>
	{/if}
</div>

