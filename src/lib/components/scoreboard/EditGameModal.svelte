<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Input from '$lib/components/shared/Input.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Card from '$lib/components/shared/Card.svelte';

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

	export let open = false;
	export let game: GameDetails | null = null;

	const dispatch = createEventDispatcher();

	let editedPlayers: Array<{
		userId: number;
		username: string;
		placement: number;
		totalScore: number;
		birds: number;
		bonusCards: number;
		endOfRoundGoals: number;
		eggs: number;
		foodOnCards: number;
		tuckedCards: number;
		nectar: number;
	}> = [];

	let playedAt = '';
	let error = '';
	let loading = false;

	const playerColors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444'];

	function initFromGame() {
		if (!game) return;

		playedAt = game.playedAt.split('T')[0];
		editedPlayers = game.scores.map((s) => ({
			userId: s.userId,
			username: s.username,
			placement: s.placement,
			totalScore: s.totalScore,
			birds: s.breakdown.birds,
			bonusCards: s.breakdown.bonusCards,
			endOfRoundGoals: s.breakdown.endOfRoundGoals,
			eggs: s.breakdown.eggs,
			foodOnCards: s.breakdown.foodOnCards,
			tuckedCards: s.breakdown.tuckedCards,
			nectar: s.breakdown.nectar
		}));
	}

	function calculateTotal(playerIndex: number) {
		const player = editedPlayers[playerIndex];
		player.totalScore =
			(player.birds || 0) +
			(player.bonusCards || 0) +
			(player.endOfRoundGoals || 0) +
			(player.eggs || 0) +
			(player.foodOnCards || 0) +
			(player.tuckedCards || 0) +
			(player.nectar || 0);
	}

	function updatePlacements() {
		// Sort by total score and update placements (ties get same placement)
		const sorted = [...editedPlayers].sort((a, b) => b.totalScore - a.totalScore);
		let rank = 1;
		sorted.forEach((player, index) => {
			if (index > 0 && player.totalScore !== sorted[index - 1].totalScore) {
				rank = index + 1;
			}
			const originalIndex = editedPlayers.findIndex((p) => p === player);
			if (originalIndex !== -1) {
				editedPlayers[originalIndex].placement = rank;
			}
		});
	}

	function validate(): boolean {
		// Check placements are rank-consistent with totalScore (ties allowed)
		const sorted = [...editedPlayers].sort((a, b) => b.totalScore - a.totalScore);
		let expectedRank = 1;
		for (let i = 0; i < sorted.length; i++) {
			if (i > 0 && sorted[i].totalScore !== sorted[i - 1].totalScore) {
				expectedRank = i + 1;
			}
			if (sorted[i].placement !== expectedRank) {
				error = 'Placements must match score order. Tied scores should have the same placement.';
				return false;
			}
		}

		// Validate score totals
		for (let i = 0; i < editedPlayers.length; i++) {
			calculateTotal(i);
			const player = editedPlayers[i];
			const sum =
				(player.birds || 0) +
				(player.bonusCards || 0) +
				(player.endOfRoundGoals || 0) +
				(player.eggs || 0) +
				(player.foodOnCards || 0) +
				(player.tuckedCards || 0) +
				(player.nectar || 0);

			if (sum !== player.totalScore) {
				error = `Total score does not match breakdown for ${player.username}`;
				return false;
			}
		}

		return true;
	}

	function handleClose() {
		playedAt = '';
		editedPlayers = [];
		error = '';
		dispatch('close');
	}

	$: if (open && game) {
		initFromGame();
	}

	async function handleSubmit() {
		error = '';

		if (!validate()) {
			return;
		}

		loading = true;
		try {
			const scores = editedPlayers.map((player) => ({
				userId: player.userId,
				placement: player.placement,
				totalScore: player.totalScore,
				birds: player.birds,
				bonusCards: player.bonusCards,
				endOfRoundGoals: player.endOfRoundGoals,
				eggs: player.eggs,
				foodOnCards: player.foodOnCards,
				tuckedCards: player.tuckedCards,
				nectar: player.nectar
			}));

			dispatch('submit', {
				gameId: game?.id,
				playedAt: new Date(playedAt).toISOString(),
				scores
			});
		} catch (e) {
			error = 'Failed to update game';
		} finally {
			loading = false;
		}
	}
</script>

<Modal {open} title="Edit Game" size="xl" on:close={handleClose}>
	<div class="space-y-4 pb-2">
		{#if error}
			<div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-red-800 text-sm flex items-center gap-2 shrink-0" role="alert">
				<svg class="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		<Input type="date" label="Date Played" bind:value={playedAt} required />

		<div class="border-t border-slate-200 pt-3 mb-2">
			<p class="text-slate-600 text-sm font-medium">Players ({editedPlayers.length})</p>
		</div>

		{#each editedPlayers as player, index}
			{@const playerColor = playerColors[index % playerColors.length]}
			<Card padding="p-3 sm:p-4">
				<div class="flex items-center justify-between mb-3">
					<h4 class="text-sm font-semibold" style="color: {playerColor};">
						{player.username}
					</h4>
				</div>

				<div class="space-y-3">
					<!-- Score Inputs - 2 rows -->
					<div class="grid grid-cols-4 sm:grid-cols-5 gap-2 min-w-0">
						<Input
							type="number"
							label="Place"
							bind:value={player.placement}
							required
							min="1"
							max={editedPlayers.length}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Total"
							bind:value={player.totalScore}
							required
							disabled
							className="bg-slate-100 text-sm"
						/>
						<Input
							type="number"
							label="Birds"
							bind:value={player.birds}
							min="0"
							on:input={() => { calculateTotal(index); updatePlacements(); }}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Cards"
							bind:value={player.bonusCards}
							min="0"
							on:input={() => { calculateTotal(index); updatePlacements(); }}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Goals"
							bind:value={player.endOfRoundGoals}
							min="0"
							on:input={() => { calculateTotal(index); updatePlacements(); }}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Eggs"
							bind:value={player.eggs}
							min="0"
							on:input={() => { calculateTotal(index); updatePlacements(); }}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Food"
							bind:value={player.foodOnCards}
							min="0"
							on:input={() => { calculateTotal(index); updatePlacements(); }}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Tucked"
							bind:value={player.tuckedCards}
							min="0"
							on:input={() => { calculateTotal(index); updatePlacements(); }}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Nectar"
							bind:value={player.nectar}
							min="0"
							on:input={() => { calculateTotal(index); updatePlacements(); }}
							className="text-sm"
						/>
					</div>
				</div>
			</Card>
		{/each}
	</div>

	<div slot="footer" class="flex flex-col-reverse sm:flex-row gap-2 w-full">
		<Button variant="ghost" on:click={handleClose} className="w-full sm:w-auto">Cancel</Button>
		<Button variant="primary" {loading} on:click={handleSubmit} className="w-full sm:w-auto">Save Changes</Button>
	</div>
</Modal>
