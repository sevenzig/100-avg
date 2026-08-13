<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Input from '$lib/components/shared/Input.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Card from '$lib/components/shared/Card.svelte';
	import type { ExtractedGameData } from '$lib/types/screenshot-upload';
	import type { Platform } from '$lib/types/platform';
	import { PLATFORMS, PLATFORM_LABELS, isValidPlatform } from '$lib/types/platform';
	import type { Player } from '$lib/stores/league';
	import { findUserByName } from '$lib/utils/user-lookup';

	interface EditedPlayer {
		rowId: string;
		playerName: string;
		placement: number;
		totalScore: number;
		birds: number;
		bonusCards: number;
		endOfRoundGoals: number;
		eggs: number;
		foodOnCards: number;
		tuckedCards: number;
		nectar: number;
		userId: number | null;
		isNew: boolean;
		matchOverridden: boolean;
	}

	let {
		open = false,
		leagueId,
		leaguePlayers = []
	}: {
		open?: boolean;
		leagueId: number;
		leaguePlayers?: Player[];
	} = $props();

	const dispatch = createEventDispatcher();

	let selectedFile = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let uploading = $state(false);
	let processing = $state(false);
	let extractedData = $state<ExtractedGameData | null>(null);
	let confidence = $state(0);
	let warnings = $state<string[]>([]);
	let error = $state('');
	let dragOver = $state(false);
	let selectedPlatform = $state('');
	let editedPlayers = $state<EditedPlayer[]>([]);
	let playedAt = $state(new Date().toISOString().split('T')[0]);

	const playerColors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444'];
	const selectClass =
		'w-full min-h-[2.75rem] px-4 py-2.5 text-base border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation';

	function lookupOptions() {
		return {
			platform: isValidPlatform(selectedPlatform) ? (selectedPlatform as Platform) : undefined,
			users: leaguePlayers
		};
	}

	function applyAutoMatch(forceAll = false) {
		for (const player of editedPlayers) {
			if (!forceAll && player.matchOverridden) continue;
			const match = findUserByName(player.playerName, lookupOptions());
			player.userId = match?.id ?? null;
			player.isNew = false;
			if (forceAll) {
				player.matchOverridden = false;
			}
		}
	}

	function matchedUsername(userId: number | null): string {
		if (!userId) return '';
		return leaguePlayers.find((p) => p.id === userId)?.username ?? '';
	}

	function handlePlatformChange() {
		applyAutoMatch(false);
	}

	function handlePlayerNameInput(index: number) {
		const player = editedPlayers[index];
		if (player.matchOverridden) return;
		const match = findUserByName(player.playerName, lookupOptions());
		player.userId = match?.id ?? null;
		player.isNew = false;
	}

	function handlePlayerSelect(index: number, event: Event) {
		const target = event.target as HTMLSelectElement;
		const player = editedPlayers[index];
		player.matchOverridden = true;
		player.isNew = false;
		player.userId = target.value ? parseInt(target.value, 10) : null;
		error = '';
	}

	function handleNewPlayerToggle(index: number) {
		const player = editedPlayers[index];
		player.matchOverridden = true;
		player.isNew = !player.isNew;
		if (player.isNew) {
			player.userId = null;
		}
		error = '';
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			processFile(file);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		const file = event.dataTransfer?.files[0];
		if (file) {
			processFile(file);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function processFile(file: File) {
		error = '';
		selectedFile = file;
		extractedData = null;
		editedPlayers = [];

		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	async function handlePaste(event: ClipboardEvent) {
		if (!open || extractedData) {
			return;
		}

		const target = event.target as HTMLElement;
		const modalElement = document.querySelector('[role="dialog"]');
		if (modalElement && !modalElement.contains(target)) {
			return;
		}

		event.preventDefault();
		const items = event.clipboardData?.items;

		if (!items) {
			return;
		}

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.indexOf('image') !== -1) {
				const blob = item.getAsFile();
				if (blob) {
					if (!blob.type.match(/^image\/(png|jpeg|jpg)$/i)) {
						error = 'Only PNG and JPEG images are supported';
						return;
					}

					if (blob.size > 10 * 1024 * 1024) {
						error = 'Image size exceeds 10MB limit';
						return;
					}

					const file = new File([blob], `pasted-image-${Date.now()}.png`, {
						type: blob.type || 'image/png'
					});
					processFile(file);
					return;
				}
			}
		}
	}

	async function uploadAndParse() {
		if (!selectedFile) {
			error = 'Please select a file first';
			return;
		}

		uploading = true;
		processing = true;
		error = '';

		try {
			const formData = new FormData();
			formData.append('image', selectedFile);
			formData.append('leagueId', leagueId.toString());

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 60000);

			let response: Response;
			try {
				response = await fetch('/api/games/upload-screenshot', {
					method: 'POST',
					body: formData,
					signal: controller.signal
				});
			} catch (fetchError: any) {
				clearTimeout(timeoutId);
				if (fetchError.name === 'AbortError') {
					error =
						'Request timed out. The image may be too large or the server is taking too long to process. Please try again.';
				} else if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
					error = 'Network error. Please check your connection and try again.';
				} else {
					error = `Upload failed: ${fetchError.message || 'Unknown error'}`;
				}
				console.error('Fetch error:', fetchError);
				return;
			} finally {
				clearTimeout(timeoutId);
			}

			if (!response.ok) {
				let errorMessage = 'Failed to process screenshot';
				try {
					const errorData = await response.json();
					errorMessage = errorData.error || errorMessage;
				} catch {
					errorMessage = response.statusText || `Server error (${response.status})`;
				}
				error = errorMessage;
				return;
			}

			let data: any;
			try {
				data = await response.json();
			} catch (parseError) {
				error = 'Invalid response from server. Please try again.';
				console.error('JSON parse error:', parseError);
				return;
			}

			if (!data.success) {
				error = data.error || 'Failed to process screenshot';
				return;
			}

			extractedData = data.extractedData;
			confidence = data.confidence || 0;
			warnings = data.warnings || [];

			if (!extractedData) {
				error = 'No data extracted from screenshot';
				return;
			}

			if (!selectedPlatform && extractedData.detectedPlatform && isValidPlatform(extractedData.detectedPlatform)) {
				selectedPlatform = extractedData.detectedPlatform;
			}

			editedPlayers = extractedData.players.map((player) => ({
				rowId: crypto.randomUUID(),
				playerName: player.playerName,
				placement: player.placement,
				totalScore: player.totalScore,
				birds: player.scoringBreakdown.birds,
				bonusCards: player.scoringBreakdown.bonusCards,
				endOfRoundGoals: player.scoringBreakdown.endOfRoundGoals,
				eggs: player.scoringBreakdown.eggs,
				foodOnCards: player.scoringBreakdown.foodOnCards,
				tuckedCards: player.scoringBreakdown.tuckedCards,
				nectar: player.scoringBreakdown.nectar,
				userId: null,
				isNew: false,
				matchOverridden: false
			}));

			applyAutoMatch(true);
		} catch (e: any) {
			if (e.name === 'AbortError') {
				error = 'Request timed out. Please try again.';
			} else if (e.name === 'TypeError' && e.message.includes('fetch')) {
				error = 'Network error. Please check your connection and try again.';
			} else {
				error = `Upload failed: ${e.message || 'Unknown error'}. Please try again.`;
			}
			console.error('Upload error:', e);
		} finally {
			uploading = false;
			processing = false;
		}
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
		if (!isValidPlatform(selectedPlatform)) {
			error = 'Please select a platform';
			return false;
		}

		if (editedPlayers.length === 0) {
			error = 'No players to save';
			return false;
		}

		for (let i = 0; i < editedPlayers.length; i++) {
			const player = editedPlayers[i];
			if (!player.playerName || player.playerName.trim().length === 0) {
				error = `Player ${i + 1} must have a name`;
				return false;
			}
			if (!player.isNew && !player.userId) {
				error = `Player ${i + 1}: pick a league player or create new`;
				return false;
			}
		}

		const pickedIds = editedPlayers.filter((p) => !p.isNew && p.userId).map((p) => p.userId);
		if (new Set(pickedIds).size !== pickedIds.length) {
			error = 'Each league player can only appear once';
			return false;
		}

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

			if (Math.abs(sum - player.totalScore) > 1) {
				error = `Total score does not match breakdown for ${player.playerName}`;
				return false;
			}
		}

		return true;
	}

	async function handleSave() {
		error = '';

		if (!validate()) {
			return;
		}

		uploading = true;
		try {
			const scores = editedPlayers.map((player) => ({
				userId: player.isNew ? null : player.userId,
				username: player.playerName,
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

			const response = await fetch('/api/games', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					leagueId,
					playedAt: new Date(playedAt).toISOString(),
					scores
				})
			});

			if (!response.ok) {
				const data = await response.json();
				error = data.error || 'Failed to save game';
				return;
			}

			handleClose();
			dispatch('saved');
		} catch (e) {
			error = 'Failed to save game';
			console.error('Save error:', e);
		} finally {
			uploading = false;
		}
	}

	function handleClose() {
		selectedFile = null;
		imagePreview = null;
		extractedData = null;
		editedPlayers = [];
		error = '';
		warnings = [];
		confidence = 0;
		selectedPlatform = '';
		playedAt = new Date().toISOString().split('T')[0];
		dispatch('close');
	}

	function getConfidenceColor(conf: number): string {
		if (conf >= 0.8) return 'text-green-600';
		if (conf >= 0.6) return 'text-yellow-600';
		return 'text-red-600';
	}

	function getConfidenceLabel(conf: number): string {
		if (conf >= 0.8) return 'High';
		if (conf >= 0.6) return 'Medium';
		return 'Low';
	}

	function cyclePlayerToEnd(index: number) {
		if (index < 0 || index >= editedPlayers.length) return;
		const player = editedPlayers[index];
		editedPlayers = [...editedPlayers.filter((_, i) => i !== index), player];
	}

	function handleWindowPaste(event: ClipboardEvent) {
		if (!open || extractedData) return;
		handlePaste(event);
	}
</script>

<svelte:window onpaste={handleWindowPaste} />

<Modal {open} title="Upload End of Game Screenshot" size="xl" on:close={handleClose}>
	<div class="space-y-4 max-h-[80vh] overflow-y-auto">
		{#if error}
			<div class="bg-red-50 border border-red-200 rounded-md p-3 text-red-800 text-sm">
				{error}
			</div>
		{/if}

		{#if warnings.length > 0}
			<div class="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-yellow-800 text-sm">
				<p class="font-semibold mb-1">Warnings:</p>
				<ul class="list-disc list-inside space-y-1">
					{#each warnings as warning, i (`${i}-${warning}`)}
						<li>{warning}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<Input type="date" label="Date Played" bind:value={playedAt} required />
			<div class="form-control w-full">
				<label for="screenshot-platform" class="block text-sm font-medium text-slate-700 mb-1.5">
					Platform
					<span class="text-red-500 ml-1">*</span>
				</label>
				<select
					id="screenshot-platform"
					class={selectClass}
					bind:value={selectedPlatform}
					onchange={handlePlatformChange}
				>
					<option value="">Auto-detect</option>
					{#each PLATFORMS as platform (platform)}
						<option value={platform}>{PLATFORM_LABELS[platform]}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if !extractedData}
			<div>
				<div
					class="mt-0 border-2 border-dashed rounded-lg p-8 text-center transition-colors {dragOver
						? 'border-blue-500 bg-blue-50'
						: 'border-slate-300 bg-slate-50'}"
					role="button"
					tabindex="0"
					ondrop={handleDrop}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
				>
					{#if imagePreview}
						<div class="space-y-4">
							<img
								src={imagePreview}
								alt="Preview"
								class="max-h-64 mx-auto rounded-lg shadow-md"
							/>
							<div class="text-sm text-slate-600">
								{selectedFile?.name} ({(selectedFile?.size || 0) / 1024 / 1024} MB)
							</div>
							<Button
								variant="ghost"
								size="sm"
								on:click={() => {
									selectedFile = null;
									imagePreview = null;
								}}>Remove</Button
							>
						</div>
					{:else}
						<div class="space-y-4">
							<svg
								class="mx-auto h-12 w-12 text-slate-400"
								stroke="currentColor"
								fill="none"
								viewBox="0 0 48 48"
							>
								<path
									d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							<div>
								<label
									for="file-upload"
									class="cursor-pointer inline-flex items-center justify-center min-h-[2.75rem] px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 touch-manipulation"
								>
									Select a file
								</label>
								<input
									id="file-upload"
									name="file-upload"
									type="file"
									class="sr-only"
									accept="image/png,image/jpeg,image/jpg"
									onchange={handleFileSelect}
								/>
								<p class="mt-2 text-sm text-slate-600">or drag and drop</p>
								<p class="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB • Or paste (Ctrl+V / Cmd+V)</p>
							</div>
						</div>
					{/if}
				</div>

				{#if selectedFile && !processing}
					<div class="mt-4 flex justify-end">
						<Button variant="primary" on:click={uploadAndParse} loading={uploading}>
							{uploading ? 'Processing...' : 'Extract Game Data'}
						</Button>
					</div>
				{/if}
			</div>
		{:else}
			<div class="space-y-4">
				{#if imagePreview}
					<div class="rounded-lg border border-slate-200 overflow-hidden bg-slate-50 shrink-0">
						<img
							src={imagePreview}
							alt="Screenshot to validate scores"
							class="w-full max-h-48 object-contain object-top"
						/>
					</div>
				{/if}

				<div class="flex flex-wrap items-start gap-4">
					<div class="shrink-0">
						<h4 class="text-sm font-semibold text-slate-900">Extracted Game Data</h4>
						<p class="text-xs text-slate-600 mt-1">
							Confidence: <span class="font-semibold {getConfidenceColor(confidence)}">
								{getConfidenceLabel(confidence)} ({(confidence * 100).toFixed(0)}%)
							</span>
						</p>
					</div>
					<div class="flex-1 min-w-0 flex justify-center">
						<div
							class="grid gap-x-4 gap-y-1 text-center"
							style="grid-template-columns: repeat({editedPlayers.length}, minmax(0, 1fr));"
						>
							{#each editedPlayers as player (player.rowId)}
								{@const isWinner = player.placement === 1}
								<span
									class="text-sm font-medium truncate {isWinner ? 'text-green-600' : 'text-red-600'}"
									title={player.playerName || 'Player'}
								>
									{player.playerName || 'Player'}
								</span>
							{/each}
							{#each editedPlayers as player (player.rowId)}
								<span class="text-sm font-mono font-semibold text-slate-900 tabular-nums">
									{player.totalScore ?? 0}
								</span>
							{/each}
						</div>
					</div>
					<div class="shrink-0">
						<Button
							variant="ghost"
							size="sm"
							on:click={() => {
								extractedData = null;
								editedPlayers = [];
							}}>Start Over</Button
						>
					</div>
				</div>

				{#each editedPlayers as player, index (player.rowId)}
					{@const playerColor = playerColors[index % playerColors.length]}
					<Card>
						<div class="flex items-center justify-between mb-3">
							<h4 class="text-sm font-semibold" style="color: {playerColor};">
								Player {index + 1}
							</h4>
							<Button variant="ghost" size="sm" on:click={() => cyclePlayerToEnd(index)}>
								Validate
							</Button>
						</div>

						<div class="space-y-3">
							<Input
								type="text"
								label="Player Name"
								bind:value={player.playerName}
								placeholder="Enter player name"
								required
								on:input={() => handlePlayerNameInput(index)}
							/>

							<div>
								<p class="text-xs mb-1.5 {player.isNew || player.userId ? 'text-slate-600' : 'text-amber-700'}">
									{#if player.isNew}
										Creating new user from "{player.playerName}"
									{:else if player.userId}
										Matched: {matchedUsername(player.userId)}
									{:else}
										No match — pick a league player or create new
									{/if}
								</p>
								{#if player.isNew}
									<div class="flex flex-col sm:flex-row gap-2">
										<Input
											type="text"
											bind:value={player.playerName}
											placeholder="New username"
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
								{:else}
									<div class="flex flex-row gap-2 items-stretch">
										<Button
											variant="primary"
											size="sm"
											on:click={() => handleNewPlayerToggle(index)}
											className="shrink-0 whitespace-nowrap"
										>
											+ New
										</Button>
										<select
											value={player.userId ?? ''}
											onchange={(e) => handlePlayerSelect(index, e)}
											class="flex-1 min-h-[2.75rem] px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 touch-manipulation min-w-0"
										>
											<option value="">— Select player —</option>
											{#each leaguePlayers as leaguePlayer (leaguePlayer.id)}
												<option value={leaguePlayer.id}>{leaguePlayer.username}</option>
											{/each}
										</select>
									</div>
								{/if}
							</div>

							<div class="grid grid-cols-3 md:grid-cols-9 gap-2">
								<Input
									type="number"
									label="Place"
									bind:value={player.placement}
									on:input={() => updatePlacements()}
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
									on:input={() => {
										calculateTotal(index);
										updatePlacements();
									}}
									min="0"
									className="text-sm rounded-md bg-blue-50 text-blue-700 border-blue-200"
								/>
								<Input
									type="number"
									label="Cards"
									bind:value={player.bonusCards}
									on:input={() => {
										calculateTotal(index);
										updatePlacements();
									}}
									min="0"
									className="text-sm rounded-md bg-green-50 text-green-700 border-green-200"
								/>
								<Input
									type="number"
									label="Goals"
									bind:value={player.endOfRoundGoals}
									on:input={() => {
										calculateTotal(index);
										updatePlacements();
									}}
									min="0"
									className="text-sm rounded-md bg-yellow-50 text-yellow-700 border-yellow-200"
								/>
								<Input
									type="number"
									label="Eggs"
									bind:value={player.eggs}
									on:input={() => {
										calculateTotal(index);
										updatePlacements();
									}}
									min="0"
									className="text-sm rounded-md bg-amber-50 text-amber-700 border-amber-200"
								/>
								<Input
									type="number"
									label="Food"
									bind:value={player.foodOnCards}
									on:input={() => {
										calculateTotal(index);
										updatePlacements();
									}}
									min="0"
									className="text-sm rounded-md bg-red-50 text-red-700 border-red-200"
								/>
								<Input
									type="number"
									label="Tucked"
									bind:value={player.tuckedCards}
									on:input={() => {
										calculateTotal(index);
										updatePlacements();
									}}
									min="0"
									className="text-sm rounded-md bg-purple-50 text-purple-700 border-purple-200"
								/>
								<Input
									type="number"
									label="Nectar"
									bind:value={player.nectar}
									on:input={() => {
										calculateTotal(index);
										updatePlacements();
									}}
									min="0"
									className="text-sm rounded-md bg-pink-50 text-pink-700 border-pink-200"
								/>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex gap-2">
		<Button variant="ghost" on:click={handleClose}>Cancel</Button>
		{#if extractedData}
			<Button variant="primary" loading={uploading} on:click={handleSave}>
				{uploading ? 'Saving...' : 'Confirm & Save'}
			</Button>
		{/if}
	</div>
</Modal>
