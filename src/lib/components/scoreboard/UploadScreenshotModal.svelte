<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Input from '$lib/components/shared/Input.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Card from '$lib/components/shared/Card.svelte';
	import type { ExtractedGameData, ExtractedPlayer } from '$lib/types/screenshot-upload';

	interface Player {
		id: number;
		username: string;
		color?: string;
	}

	export let open = false;
	export let leagueId: number;
	export let leaguePlayers: Player[] = []; // Reserved for future player validation features

	const dispatch = createEventDispatcher();

	// Reference leaguePlayers to satisfy linter (reserved for future validation)
	$: _leaguePlayersAvailable = leaguePlayers.length >= 0;

	let selectedFile: File | null = null;
	let imagePreview: string | null = null;
	let uploading = false;
	let processing = false;
	let extractedData: ExtractedGameData | null = null;
	let confidence = 0;
	let warnings: string[] = [];
	let error = '';
	let dragOver = false;

	let editedPlayers: Array<{
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
	}> = [];

	let playedAt = new Date().toISOString().split('T')[0];
	let allUsers: Array<{
		id: number;
		username: string;
		steam_alias?: string | null;
		android_alias?: string | null;
		iphone_alias?: string | null;
	}> = [];

	const playerColors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444'];

	// Set up paste event listener when modal is open and in upload phase
	$: {
		if (open && !extractedData) {
			window.addEventListener('paste', handlePaste);
		} else {
			window.removeEventListener('paste', handlePaste);
		}
	}

	onDestroy(() => {
		window.removeEventListener('paste', handlePaste);
	});

	async function loadAllUsers() {
		try {
			const response = await fetch('/api/users');
			if (response.ok) {
				const data = await response.json();
				allUsers = data.users || [];
			}
		} catch (e) {
			console.error('Failed to load users:', e);
		}
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

		// Create preview
		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	async function handlePaste(event: ClipboardEvent) {
		// Only handle paste when modal is open and we're in upload phase
		if (!open || extractedData) {
			return;
		}

		// Check if the paste is happening within our modal
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

		// Find image in clipboard
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.indexOf('image') !== -1) {
				const blob = item.getAsFile();
				if (blob) {
					// Validate the blob is an image
					if (!blob.type.match(/^image\/(png|jpeg|jpg)$/i)) {
						error = 'Only PNG and JPEG images are supported';
						return;
					}

					// Validate file size (10MB limit)
					if (blob.size > 10 * 1024 * 1024) {
						error = 'Image size exceeds 10MB limit';
						return;
					}

					// Convert blob to File with a proper name
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

			// Create AbortController for timeout handling
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

			let response: Response;
			try {
				response = await fetch('/api/games/upload-screenshot', {
					method: 'POST',
					body: formData,
					signal: controller.signal
				});
			} catch (fetchError: any) {
				clearTimeout(timeoutId);
				// Handle network errors, timeouts, and abort errors
				if (fetchError.name === 'AbortError') {
					error = 'Request timed out. The image may be too large or the server is taking too long to process. Please try again.';
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

			// Check if response is ok before parsing
			if (!response.ok) {
				// Try to parse error response, but handle non-JSON responses
				let errorMessage = 'Failed to process screenshot';
				try {
					const errorData = await response.json();
					errorMessage = errorData.error || errorMessage;
				} catch {
					// If response isn't JSON, use status text
					errorMessage = response.statusText || `Server error (${response.status})`;
				}
				error = errorMessage;
				return;
			}

			// Parse JSON response
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

			// Initialize edited players from extracted data
			if (!extractedData) {
				error = 'No data extracted from screenshot';
				return;
			}

			editedPlayers = extractedData.players.map((player) => ({
				playerName: player.playerName,
				placement: player.placement,
				totalScore: player.totalScore,
				birds: player.scoringBreakdown.birds,
				bonusCards: player.scoringBreakdown.bonusCards,
				endOfRoundGoals: player.scoringBreakdown.endOfRoundGoals,
				eggs: player.scoringBreakdown.eggs,
				foodOnCards: player.scoringBreakdown.foodOnCards,
				tuckedCards: player.scoringBreakdown.tuckedCards,
				nectar: player.scoringBreakdown.nectar
			}));

			// Load users for player matching
			await loadAllUsers();
		} catch (e: any) {
			// Catch any other unexpected errors
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
		// Sort by total score and update placements
		const sorted = [...editedPlayers].sort((a, b) => b.totalScore - a.totalScore);
		sorted.forEach((player, index) => {
			const originalIndex = editedPlayers.findIndex((p) => p === player);
			if (originalIndex !== -1) {
				editedPlayers[originalIndex].placement = index + 1;
			}
		});
	}

	function findUserByName(name: string): { id: number; username: string } | null {
		const searchName = name.toLowerCase().trim();
		
		if (!searchName) {
			return null;
		}
		
		// Match against username and all platform aliases (case-insensitive)
		const matchedUser = allUsers.find((u) => {
			// Check username
			if (u.username && u.username.toLowerCase().trim() === searchName) {
				return true;
			}
			
			// Check Steam alias
			if (u.steam_alias && u.steam_alias.toLowerCase().trim() === searchName) {
				return true;
			}
			
			// Check Android alias
			if (u.android_alias && u.android_alias.toLowerCase().trim() === searchName) {
				return true;
			}
			
			// Check iPhone alias
			if (u.iphone_alias && u.iphone_alias.toLowerCase().trim() === searchName) {
				return true;
			}
			
			return false;
		});
		
		return matchedUser ? { id: matchedUser.id, username: matchedUser.username } : null;
	}

	function validate(): boolean {
		if (editedPlayers.length === 0) {
			error = 'No players to save';
			return false;
		}

		// Check that all players have names
		for (let i = 0; i < editedPlayers.length; i++) {
			const player = editedPlayers[i];
			if (!player.playerName || player.playerName.trim().length === 0) {
				error = `Player ${i + 1} must have a name`;
				return false;
			}
		}

		// Check placements
		const placements = editedPlayers.map((p) => p.placement).sort((a, b) => a - b);
		const expectedPlacements = Array.from({ length: editedPlayers.length }, (_, i) => i + 1);
		if (JSON.stringify(placements) !== JSON.stringify(expectedPlacements)) {
			error = `Placements must be unique and sequential from 1 to ${editedPlayers.length}`;
			return false;
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
			// Prepare scores - match players to users
			const scores = editedPlayers.map((player) => {
				const user = findUserByName(player.playerName);
				return {
					userId: user?.id || null,
					username: player.playerName,
					isNew: !user,
					placement: player.placement,
					totalScore: player.totalScore,
					birds: player.birds,
					bonusCards: player.bonusCards,
					endOfRoundGoals: player.endOfRoundGoals,
					eggs: player.eggs,
					foodOnCards: player.foodOnCards,
					tuckedCards: player.tuckedCards,
					nectar: player.nectar
				};
			});

			// Save game using existing endpoint
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

			// Success - close modal and refresh
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
</script>

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
					{#each warnings as warning}
						<li>{warning}</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if !extractedData}
			<!-- File Upload Section -->
			<div>
				<Input type="date" label="Date Played" bind:value={playedAt} required />

				<div
					class="mt-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors {dragOver
						? 'border-blue-500 bg-blue-50'
						: 'border-slate-300 bg-slate-50'}"
					role="button"
					tabindex="0"
					on:drop={handleDrop}
					on:dragover={handleDragOver}
					on:dragleave={handleDragLeave}
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
							<Button variant="ghost" size="sm" on:click={() => {
								selectedFile = null;
								imagePreview = null;
							}}>Remove</Button>
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
									class="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
								>
									Select a file
								</label>
								<input
									id="file-upload"
									name="file-upload"
									type="file"
									class="sr-only"
									accept="image/png,image/jpeg,image/jpg"
									on:change={handleFileSelect}
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
			<!-- Extracted Data Review Section -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h4 class="text-sm font-semibold text-slate-900">Extracted Game Data</h4>
						<p class="text-xs text-slate-600 mt-1">
							Confidence: <span class="font-semibold {getConfidenceColor(confidence)}">
								{getConfidenceLabel(confidence)} ({(confidence * 100).toFixed(0)}%)
							</span>
						</p>
					</div>
					<Button variant="ghost" size="sm" on:click={() => {
						extractedData = null;
						editedPlayers = [];
					}}>Start Over</Button>
				</div>

				{#each editedPlayers as player, index}
					{@const playerColor = playerColors[index % playerColors.length]}
					<Card>
						<div class="flex items-center justify-between mb-3">
							<h4 class="text-sm font-semibold" style="color: {playerColor};">
								Player {index + 1}
							</h4>
						</div>

						<div class="space-y-3">
							<Input
								type="text"
								label="Player Name"
								bind:value={player.playerName}
								placeholder="Enter player name"
								required
							/>

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
									className="text-sm"
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
									className="text-sm"
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
									className="text-sm"
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
									className="text-sm"
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
									className="text-sm"
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
									className="text-sm"
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
									className="text-sm"
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
