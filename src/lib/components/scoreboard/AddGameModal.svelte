<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Input from '$lib/components/shared/Input.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Card from '$lib/components/shared/Card.svelte';

	export interface Player {
		id: number;
		username: string;
		color?: string;
	}

	export let open = false;
	export let leaguePlayers: Player[] = []; // Players already in the league

	const dispatch = createEventDispatcher();

	let allUsers: Array<{ id: number; username: string }> = [];
	let selectedPlayers: Array<{
		userId: number | null;
		username: string;
		isNew: boolean;
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

	let playedAt = new Date().toISOString().split('T')[0];
	let error = '';
	let loading = false;
	let loadingUsers = false;

	const playerColors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444'];

	onMount(async () => {
		await loadAllUsers();
	});

	async function loadAllUsers() {
		loadingUsers = true;
		try {
			const response = await fetch('/api/users');
			if (response.ok) {
				const data = await response.json();
				allUsers = data.users || [];
			}
		} catch (e) {
			console.error('Failed to load users:', e);
		} finally {
			loadingUsers = false;
		}
	}

	function initPlayers() {
		// Start with league players if available, otherwise start with one empty slot
		if (leaguePlayers.length > 0) {
			selectedPlayers = leaguePlayers.slice(0, Math.min(leaguePlayers.length, 5)).map((player, index) => ({
				userId: player.id,
				username: player.username,
				isNew: false,
				placement: 0,
				totalScore: 0,
				birds: 0,
				bonusCards: 0,
				endOfRoundGoals: 0,
				eggs: 0,
				foodOnCards: 0,
				tuckedCards: 0,
				nectar: 0
			}));
		} else {
			selectedPlayers = [
				{
					userId: null,
					username: '',
					isNew: false,
					placement: 0,
					totalScore: 0,
					birds: 0,
					bonusCards: 0,
					endOfRoundGoals: 0,
					eggs: 0,
					foodOnCards: 0,
					tuckedCards: 0,
					nectar: 0
				}
			];
		}
	}

	function addPlayer() {
		if (selectedPlayers.length >= 5) {
			error = 'Maximum 5 players allowed per game';
			return;
		}
		selectedPlayers.push({
			userId: null,
			username: '',
			isNew: false,
			placement: 0,
			totalScore: 0,
			birds: 0,
			bonusCards: 0,
			endOfRoundGoals: 0,
			eggs: 0,
			foodOnCards: 0,
			tuckedCards: 0,
			nectar: 0
		});
	}

	function removePlayer(index: number) {
		if (selectedPlayers.length <= 1) {
			error = 'Game must have at least 1 player';
			return;
		}
		selectedPlayers = selectedPlayers.filter((_, i) => i !== index);
		error = '';
	}

	function handlePlayerSelect(index: number, userId: number | null) {
		if (userId === null) {
			selectedPlayers[index].userId = null;
			selectedPlayers[index].username = '';
			selectedPlayers[index].isNew = false;
		} else {
			const user = allUsers.find((u) => u.id === userId);
			if (user) {
				selectedPlayers[index].userId = user.id;
				selectedPlayers[index].username = user.username;
				selectedPlayers[index].isNew = false;
			}
		}
		error = '';
	}

	function handleSelectChange(index: number, event: Event) {
		const target = event.target as HTMLSelectElement;
		const value = target.value;
		handlePlayerSelect(index, value ? parseInt(value) : null);
	}

	function handleNewPlayerToggle(index: number) {
		selectedPlayers[index].isNew = !selectedPlayers[index].isNew;
		if (selectedPlayers[index].isNew) {
			selectedPlayers[index].userId = null;
			selectedPlayers[index].username = '';
		}
		error = '';
	}

	function calculateTotal(playerIndex: number) {
		const player = selectedPlayers[playerIndex];
		player.totalScore =
			(player.birds || 0) +
			(player.bonusCards || 0) +
			(player.endOfRoundGoals || 0) +
			(player.eggs || 0) +
			(player.foodOnCards || 0) +
			(player.tuckedCards || 0) +
			(player.nectar || 0);
	}

	function validate(): boolean {
		// Check that all players have a username
		for (let i = 0; i < selectedPlayers.length; i++) {
			const player = selectedPlayers[i];
			if (!player.username || player.username.trim().length === 0) {
				error = `Player ${i + 1} must have a username`;
				return false;
			}
			if (player.username.length < 3 || player.username.length > 20) {
				error = `Player ${i + 1} username must be 3-20 characters`;
				return false;
			}
		}

		// Check placements
		const placements = selectedPlayers.map((p) => p.placement).sort((a, b) => a - b);
		const expectedPlacements = Array.from({ length: selectedPlayers.length }, (_, i) => i + 1);
		if (JSON.stringify(placements) !== JSON.stringify(expectedPlacements)) {
			error = `Placements must be unique and sequential from 1 to ${selectedPlayers.length}`;
			return false;
		}

		// Validate score totals
		for (let i = 0; i < selectedPlayers.length; i++) {
			calculateTotal(i);
			const player = selectedPlayers[i];
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
		playedAt = new Date().toISOString().split('T')[0];
		selectedPlayers = [];
		error = '';
		dispatch('close');
	}

	function handleOpen() {
		if (open) {
			initPlayers();
		}
	}

	$: if (open) {
		handleOpen();
	}

	async function handleSubmit() {
		error = '';

		if (!validate()) {
			return;
		}

		loading = true;
		try {
			// Prepare scores with user info
			const scores = selectedPlayers.map((player) => ({
				userId: player.userId,
				username: player.username,
				isNew: player.isNew,
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
				playedAt: new Date(playedAt).toISOString(),
				scores
			});
			handleClose();
		} catch (e) {
			error = 'Failed to add game';
		} finally {
			loading = false;
		}
	}
</script>

<Modal {open} title="Add Game" size="xl" on:close={handleClose}>
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
			{#if selectedPlayers.length < 5}
				<Button variant="primary" size="md" on:click={addPlayer} className="w-full font-semibold">+ Add Player ({selectedPlayers.length}/5)</Button>
			{:else}
				<p class="text-slate-600 text-sm font-medium">Players ({selectedPlayers.length}/5)</p>
			{/if}
		</div>

		{#each selectedPlayers as player, index}
			{@const playerColor = playerColors[index % playerColors.length]}
			<Card padding="p-3 sm:p-4">
				<div class="flex items-center justify-between mb-3">
					<h4 class="text-sm font-semibold" style="color: {playerColor};">
						Player {index + 1}
					</h4>
					{#if selectedPlayers.length > 1}
						<Button variant="secondary" size="sm" on:click={() => removePlayer(index)} className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 font-medium">Remove</Button>
					{/if}
				</div>

				<div class="space-y-3">
					<!-- Player Selection -->
					<div>
						{#if !player.isNew}
							<label class="block text-sm font-medium text-slate-700 mb-1.5">
								Select Player
							</label>
							<div class="flex flex-row gap-2 items-stretch">
								<Button
									variant="primary"
									size="sm"
									on:click={() => handleNewPlayerToggle(index)}
									className="shrink-0 whitespace-nowrap"
									style="background-color: {playerColor}; border-color: {playerColor};"
								>
									+ New
								</Button>
								<select
									bind:value={player.userId}
									on:change={(e) => handleSelectChange(index, e)}
									class="flex-1 min-h-[2.75rem] px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 touch-manipulation min-w-0"
								>
									<option value="">— Select player —</option>
									{#each allUsers as user}
										<option value={user.id}>{user.username}</option>
									{/each}
								</select>
							</div>
						{:else}
							<label class="block text-sm font-medium text-slate-700 mb-1.5">
								New Player Username
							</label>
							<div class="flex flex-col sm:flex-row gap-2">
								<Input
									type="text"
									bind:value={player.username}
									placeholder="Username (3-20 chars)"
									required
									className="flex-1"
								/>
								<Button
									variant="ghost"
									size="sm"
									on:click={() => handleNewPlayerToggle(index)}
									className="shrink-0 whitespace-nowrap w-full sm:w-auto"
								>
									Select
								</Button>
							</div>
						{/if}
					</div>

					<!-- Score Inputs - 2 rows: Place/Total/Birds/Cards/Goals, then Eggs/Food/Tucked/Nectar -->
					<div class="grid grid-cols-4 sm:grid-cols-5 gap-2 min-w-0">
						<Input
							type="number"
							label="Place"
							bind:value={player.placement}
							required
							min="1"
							max={selectedPlayers.length}
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
							on:input={() => calculateTotal(index)}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Cards"
							bind:value={player.bonusCards}
							min="0"
							on:input={() => calculateTotal(index)}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Goals"
							bind:value={player.endOfRoundGoals}
							min="0"
							on:input={() => calculateTotal(index)}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Eggs"
							bind:value={player.eggs}
							min="0"
							on:input={() => calculateTotal(index)}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Food"
							bind:value={player.foodOnCards}
							min="0"
							on:input={() => calculateTotal(index)}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Tucked"
							bind:value={player.tuckedCards}
							min="0"
							on:input={() => calculateTotal(index)}
							className="text-sm"
						/>
						<Input
							type="number"
							label="Nectar"
							bind:value={player.nectar}
							min="0"
							on:input={() => calculateTotal(index)}
							className="text-sm"
						/>
					</div>
				</div>
			</Card>
		{/each}
	</div>

	<div slot="footer" class="flex flex-col-reverse sm:flex-row gap-2 w-full">
		<Button variant="ghost" on:click={handleClose} className="w-full sm:w-auto">Cancel</Button>
		<Button variant="primary" {loading} on:click={handleSubmit} className="w-full sm:w-auto">Add Game</Button>
	</div>
</Modal>
