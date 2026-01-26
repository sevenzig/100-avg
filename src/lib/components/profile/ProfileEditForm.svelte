<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Input from '$lib/components/shared/Input.svelte';
	import Button from '$lib/components/shared/Button.svelte';

	export let profile: {
		id: number;
		username: string;
		email: string;
		displayName?: string | null;
		platforms: string[];
	};

	export let loading = false;

	const dispatch = createEventDispatcher<{
		save: { profile: { displayName?: string | null; username?: string; platforms?: string[] } };
		cancel: void;
	}>();

	let displayName = '';
	let username = '';
	let platforms: string[] = [];
	let formError = '';
	let usernameError = '';
	let checkingUsername = false;

	$: {
		if (profile) {
			displayName = profile.displayName || '';
			username = profile.username;
			platforms = [...profile.platforms];
		}
	}

	function validateForm(): boolean {
		formError = '';
		usernameError = '';

		if (!username.trim()) {
			formError = 'Username is required';
			return false;
		}

		if (username.length < 1 || username.length > 50) {
			formError = 'Username must be between 1 and 50 characters';
			return false;
		}

		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			formError = 'Username can only contain letters, numbers, underscores, and hyphens';
			return false;
		}

		if (displayName && displayName.length > 50) {
			formError = 'Display name must be 50 characters or less';
			return false;
		}

		// Validate platforms
		const validPlatforms = ['steam', 'android', 'iphone'];
		for (const platform of platforms) {
			if (!validPlatforms.includes(platform)) {
				formError = `Invalid platform: ${platform}`;
				return false;
			}
		}

		// Check for duplicates
		if (new Set(platforms).size !== platforms.length) {
			formError = 'Platforms cannot contain duplicates';
			return false;
		}

		return true;
	}

	async function checkUsernameAvailability(newUsername: string) {
		if (newUsername === profile.username) {
			usernameError = '';
			return;
		}

		// Don't check if username is empty or invalid format
		if (!newUsername.trim() || !/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
			usernameError = '';
			return;
		}

		checkingUsername = true;
		try {
			const response = await fetch(
				`/api/users/check-username?username=${encodeURIComponent(newUsername)}`
			);
			if (response.ok) {
				const data = await response.json();
				if (!data.available) {
					usernameError = 'Username is already taken';
				} else {
					usernameError = '';
				}
			}
		} catch (e) {
			// Silently fail - will be caught on save
		} finally {
			checkingUsername = false;
		}
	}

	function togglePlatform(platform: string) {
		if (platforms.includes(platform)) {
			platforms = platforms.filter((p) => p !== platform);
		} else {
			platforms = [...platforms, platform];
		}
	}

	function handleSubmit() {
		if (!validateForm()) {
			return;
		}

		dispatch('save', {
			profile: {
				displayName: displayName.trim() || null,
				username: username.trim(),
				platforms: [...platforms]
			}
		});
	}

	function handleCancel() {
		// Reset to original values
		if (profile) {
			displayName = profile.displayName || '';
			username = profile.username;
			platforms = [...profile.platforms];
		}
		formError = '';
		usernameError = '';
		dispatch('cancel');
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4">
	<Input
		label="Display Name"
		bind:value={displayName}
		placeholder="Optional friendly name"
		error={formError && formError.includes('Display name') ? formError : ''}
	/>

	<Input
		label="Username"
		bind:value={username}
		placeholder="Your username"
		required
		error={usernameError || (formError && formError.includes('Username') ? formError : '')}
		on:input={() => checkUsernameAvailability(username)}
	/>
	{#if checkingUsername}
		<span class="text-sm text-slate-500">Checking availability...</span>
	{/if}

	<fieldset class="form-control">
		<legend class="block text-sm font-medium text-slate-700 mb-2">
			Platforms
		</legend>
		<div class="space-y-2">
			<label class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
				<input
					type="checkbox"
					checked={platforms.includes('steam')}
					on:change={() => togglePlatform('steam')}
					class="checkbox checkbox-sm"
				/>
				<span class="text-sm text-slate-700">Steam</span>
			</label>
			<label class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
				<input
					type="checkbox"
					checked={platforms.includes('android')}
					on:change={() => togglePlatform('android')}
					class="checkbox checkbox-sm"
				/>
				<span class="text-sm text-slate-700">Android</span>
			</label>
			<label class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
				<input
					type="checkbox"
					checked={platforms.includes('iphone')}
					on:change={() => togglePlatform('iphone')}
					class="checkbox checkbox-sm"
				/>
				<span class="text-sm text-slate-700">iPhone</span>
			</label>
		</div>
		{#if formError && formError.includes('platform')}
			<p class="mt-1.5 text-sm text-red-600">{formError}</p>
		{/if}
	</fieldset>

	{#if formError && !formError.includes('Display name') && !formError.includes('Username') && !formError.includes('platform')}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
			{formError}
		</div>
	{/if}

	<div class="flex gap-2 justify-end pt-2">
		<Button variant="secondary" on:click={handleCancel} disabled={loading}>
			Cancel
		</Button>
		<Button type="submit" disabled={loading || !!usernameError}>
			{loading ? 'Saving...' : 'Save Changes'}
		</Button>
	</div>
</form>
