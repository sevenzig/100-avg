<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Input from '$lib/components/shared/Input.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import type { Platform, PlatformAliases } from '$lib/types/platform';
	import { PLATFORM_CONFIGS, PLATFORMS } from '$lib/types/platform';
	import { validateUsername, validateDisplayName, validatePlatforms } from '$lib/utils/validation';
	import { validatePlatformAlias, getPlatformAliasError } from '$lib/types/platform';

	export let profile: {
		id: number;
		username: string;
		email: string;
		displayName?: string | null;
		platforms: string[];
		platformAliases?: PlatformAliases;
	};

	export let loading = false;

	const dispatch = createEventDispatcher<{
		save: {
			profile: {
				displayName?: string | null;
				username?: string;
				platforms?: string[];
				platformAliases?: PlatformAliases;
			};
		};
		cancel: void;
	}>();

	let displayName = '';
	let username = '';
	let platforms: Platform[] = [];
	let steamAlias = '';
	let androidAlias = '';
	let iphoneAlias = '';
	let formError = '';
	let usernameError = '';
	let checkingUsername = false;
	let lastProfileId: number | null = null;
	const aliasErrors: Record<Platform, string> = {
		steam: '',
		android: '',
		iphone: ''
	};

	$: {
		// Only initialize/update when profile ID changes (new profile or after save)
		if (profile && profile.id !== lastProfileId) {
			displayName = profile.displayName || '';
			username = profile.username;
			platforms = [...(profile.platforms as Platform[])];
			steamAlias = profile.platformAliases?.steam || '';
			androidAlias = profile.platformAliases?.android || '';
			iphoneAlias = profile.platformAliases?.iphone || '';
			lastProfileId = profile.id;
		}
	}

	// Get alias value for a platform
	function getAlias(platform: Platform): string {
		switch (platform) {
			case 'steam':
				return steamAlias;
			case 'android':
				return androidAlias;
			case 'iphone':
				return iphoneAlias;
		}
	}

	// Validate aliases on blur or when they change (debounced)
	$: {
		if (platforms.includes('steam')) {
			aliasErrors.steam = validateAlias('steam', steamAlias);
		}
		if (platforms.includes('android')) {
			aliasErrors.android = validateAlias('android', androidAlias);
		}
		if (platforms.includes('iphone')) {
			aliasErrors.iphone = validateAlias('iphone', iphoneAlias);
		}
	}

	function validateAlias(platform: Platform, alias: string): string {
		if (!alias) return '';
		if (!validatePlatformAlias(alias, 100)) {
			return getPlatformAliasError(platform, alias, 100);
		}
		return '';
	}

	function validateForm(): boolean {
		formError = '';
		usernameError = '';
		// Clear alias errors
		aliasErrors.steam = '';
		aliasErrors.android = '';
		aliasErrors.iphone = '';

		// Validate username
		const usernameResult = validateUsername(username);
		if (!usernameResult.valid) {
			formError = usernameResult.error || 'Invalid username';
			return false;
		}

		// Validate display name
		const displayNameResult = validateDisplayName(displayName);
		if (!displayNameResult.valid) {
			formError = displayNameResult.error || 'Invalid display name';
			return false;
		}

		// Validate platforms
		const platformsResult = validatePlatforms(platforms);
		if (!platformsResult.valid) {
			formError = platformsResult.error || 'Invalid platforms';
			return false;
		}

		// Validate platform aliases
		let hasAliasError = false;
		for (const platform of PLATFORMS) {
			if (platforms.includes(platform)) {
				const error = validateAlias(platform, getAlias(platform));
				if (error) {
					aliasErrors[platform] = error;
					hasAliasError = true;
				}
			}
		}

		if (hasAliasError) {
			formError = 'Please fix platform alias errors';
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

	function togglePlatform(platform: Platform) {
		if (platforms.includes(platform)) {
			platforms = platforms.filter((p) => p !== platform);
			// Clear alias and error when platform is unchecked
			switch (platform) {
				case 'steam':
					steamAlias = '';
					break;
				case 'android':
					androidAlias = '';
					break;
				case 'iphone':
					iphoneAlias = '';
					break;
			}
			aliasErrors[platform] = '';
		} else {
			platforms = [...platforms, platform];
		}
	}

	function handleSubmit() {
		if (!validateForm()) {
			return;
		}

		// Build platform aliases object only for selected platforms
		const aliasesToSave: PlatformAliases = {};
		for (const platform of PLATFORMS) {
			if (platforms.includes(platform)) {
				const alias = getAlias(platform).trim() || null;
				if (alias) {
					aliasesToSave[platform] = alias;
				}
			}
		}

		dispatch('save', {
			profile: {
				displayName: displayName.trim() || null,
				username: username.trim(),
				platforms: [...platforms],
				platformAliases: aliasesToSave
			}
		});
	}

	function handleCancel() {
		// Reset to original values by forcing a re-initialization
		if (profile) {
			lastProfileId = null; // Force reactive statement to run again
			displayName = profile.displayName || '';
			username = profile.username;
			platforms = [...(profile.platforms as Platform[])];
			steamAlias = profile.platformAliases?.steam || '';
			androidAlias = profile.platformAliases?.android || '';
			iphoneAlias = profile.platformAliases?.iphone || '';
			lastProfileId = profile.id; // Set it back so reactive doesn't override
		}
		formError = '';
		usernameError = '';
		aliasErrors.steam = '';
		aliasErrors.android = '';
		aliasErrors.iphone = '';
		dispatch('cancel');
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-3">
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
		<legend class="block text-sm font-medium text-slate-700 mb-1.5">
			Platforms
		</legend>
		<div class="space-y-2">
			{#each PLATFORMS as platform (platform)}
				{@const config = PLATFORM_CONFIGS[platform]}
				{@const isSelected = platforms.includes(platform)}
				<div class="flex items-start gap-3">
					<label
						class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors flex-shrink-0"
						aria-label="Select {config.label} platform"
					>
						<input
							type="checkbox"
							checked={isSelected}
							on:change={() => togglePlatform(platform)}
							class="checkbox checkbox-sm"
							aria-describedby={isSelected ? `alias-${platform}` : undefined}
						/>
						<span class="text-sm text-slate-700 whitespace-nowrap">{config.label}</span>
					</label>
					{#if isSelected}
						<div class="flex-1 min-w-0" id="alias-{platform}">
							{#if platform === 'steam'}
								<Input
									label=""
									bind:value={steamAlias}
									placeholder={config.placeholder}
									error={aliasErrors[platform]}
									max="100"
								/>
							{:else if platform === 'android'}
								<Input
									label=""
									bind:value={androidAlias}
									placeholder={config.placeholder}
									error={aliasErrors[platform]}
									max="100"
								/>
							{:else if platform === 'iphone'}
								<Input
									label=""
									bind:value={iphoneAlias}
									placeholder={config.placeholder}
									error={aliasErrors[platform]}
									max="100"
								/>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
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

	<div class="flex gap-2 justify-end pt-1">
		<Button variant="secondary" on:click={handleCancel} disabled={loading} size="sm">
			Cancel
		</Button>
		<Button type="submit" disabled={loading || !!usernameError} size="sm">
			{loading ? 'Saving...' : 'Save Changes'}
		</Button>
	</div>
</form>
