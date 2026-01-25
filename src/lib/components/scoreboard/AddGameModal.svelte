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
	<div class="space-y-3 max-h-[80vh] overflow-y-auto">
		{#if error}
			<div class="bg-red-50 border border-red-200 rounded-md p-2 text-red-800 text-xs">
				<span>{error}</span>
			</div>
		{/if}

		<Input type="date" label="Date Played" bind:value={playedAt} required />

		<div class="border-t border-slate-200 pt-2">
			<div class="flex items-center justify-between mb-2">
				<p class="text-slate-600 text-xs font-medium">
					Players ({selectedPlayers.length}/5)
				</p>
				{#if selectedPlayers.length < 5}
					<Button variant="ghost" size="sm" on:click={addPlayer}>+ Add Player</Button>
				{/if}
			</div>
		</div>

		{#each selectedPlayers as player, index}
			{@const playerColor = playerColors[index % playerColors.length]}
			<Card>
				<div class="flex items-center justify-between mb-2">
					<h4 class="text-sm font-semibold" style="color: {playerColor};">
						Player {index + 1}
					</h4>
					{#if selectedPlayers.length > 1}
						<Button variant="ghost" size="sm" on:click={() => removePlayer(index)}>Remove</Button>
					{/if}
				</div>

				<div class="space-y-2">
					<!-- Player Selection - Compact with colored button on right -->
					<div>
						{#if !player.isNew}
							<label class="block text-xs font-medium text-slate-700 mb-1">
								Select Player
							</label>
							<div class="flex gap-2">
								<select
									bind:value={player.userId}
									on:change={(e) => handleSelectChange(index, e)}
									class="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">-- Select player --</option>
									{#each allUsers as user}
										<option value={user.id}>{user.username}</option>
									{/each}
								</select>
								<Button
									variant="primary"
									size="sm"
									on:click={() => handleNewPlayerToggle(index)}
									class="shrink-0 whitespace-nowrap"
									style="background-color: {playerColor}; border-color: {playerColor};"
								>
									+ New
								</Button>
							</div>
						{:else}
							<label class="block text-xs font-medium text-slate-700 mb-1">
								New Player Username
							</label>
							<div class="flex gap-2">
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
									class="shrink-0 whitespace-nowrap"
								>
									Select
								</Button>
							</div>
						{/if}
					</div>

					<!-- Score Inputs - 1 row on desktop, 3 columns on mobile -->
					<div class="grid grid-cols-3 md:grid-cols-9 gap-1.5">
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

	<div slot="footer" class="flex gap-2">
		<Button variant="ghost" on:click={handleClose}>Cancel</Button>
		<Button variant="primary" {loading} on:click={handleSubmit}>Add Game</Button>
	</div>
</Modal>
