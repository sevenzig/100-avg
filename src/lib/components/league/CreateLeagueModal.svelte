<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Input from '$lib/components/shared/Input.svelte';
	import Button from '$lib/components/shared/Button.svelte';

	export interface User {
		id: number;
		username: string;
		email: string;
	}

	export let open = false;
	export let availablePlayers: User[] = [];

	const dispatch = createEventDispatcher();

	let leagueName = '';
	let selectedPlayerIds: number[] = [];
	let error = '';
	let loading = false;

	function togglePlayer(playerId: number) {
		if (selectedPlayerIds.includes(playerId)) {
			selectedPlayerIds = selectedPlayerIds.filter((id) => id !== playerId);
		} else {
			selectedPlayerIds = [...selectedPlayerIds, playerId];
		}
	}

	function handleClose() {
		leagueName = '';
		selectedPlayerIds = [];
		error = '';
		dispatch('close');
	}

	async function handleCreate() {
		error = '';

		if (!leagueName.trim()) {
			error = 'League name is required';
			return;
		}

		if (selectedPlayerIds.length < 1) {
			error = 'At least one player must be selected';
			return;
		}

		loading = true;
		try {
			dispatch('create', { name: leagueName.trim(), playerIds: selectedPlayerIds });
			handleClose();
		} catch (e) {
			error = 'Failed to create league';
		} finally {
			loading = false;
		}
	}
</script>

<Modal {open} title="Create New League" size="md" on:close={handleClose}>
	<div class="space-y-4">
		{#if error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
				<span>{error}</span>
			</div>
		{/if}

		<Input
			type="text"
			label="League Name"
			bind:value={leagueName}
			required
			placeholder="Enter league name"
		/>

		<div>
			<label class="block text-sm font-medium text-slate-700 mb-2">
				Select Players
				<span class="text-slate-500 font-normal ml-2">({selectedPlayerIds.length} selected)</span>
			</label>
			<div class="space-y-2 mt-2 max-h-64 overflow-y-auto border border-slate-200 rounded-md p-2">
				{#each availablePlayers as player}
					<label class="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer transition-colors">
						<input
							type="checkbox"
							class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
							checked={selectedPlayerIds.includes(player.id)}
							on:change={() => togglePlayer(player.id)}
						/>
						<span class="text-slate-900">{player.username}</span>
					</label>
				{/each}
			</div>
		</div>
	</div>

	<div slot="footer" class="flex gap-2">
		<Button variant="ghost" on:click={handleClose}>Cancel</Button>
		<Button variant="primary" {loading} on:click={handleCreate}>Create League</Button>
	</div>
</Modal>
