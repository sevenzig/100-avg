<script lang="ts">
	import { goto } from '$app/navigation';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Input from '$lib/components/shared/Input.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { user, isAuthenticated } from '$lib/stores/auth';
	import type { Platform, PlatformAliases } from '$lib/types/platform';
	import { PLATFORM_CONFIGS, PLATFORMS } from '$lib/types/platform';
	import { validateRequiredOnboardingPlatforms } from '$lib/utils/validation';

	let platforms = $state<Platform[]>([]);
	let steamAlias = $state('');
	let androidAlias = $state('');
	let iphoneAlias = $state('');
	let formError = $state('');
	let saving = $state(false);

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

	function togglePlatform(platform: Platform) {
		if (platforms.includes(platform)) {
			platforms = platforms.filter((p) => p !== platform);
			if (platform === 'steam') steamAlias = '';
			if (platform === 'android') androidAlias = '';
			if (platform === 'iphone') iphoneAlias = '';
		} else {
			platforms = [...platforms, platform];
		}
		formError = '';
	}

	function buildAliases(): PlatformAliases {
		const aliases: PlatformAliases = {};
		for (const platform of PLATFORMS) {
			if (platforms.includes(platform)) {
				aliases[platform] = getAlias(platform).trim();
			}
		}
		return aliases;
	}

	async function handleSave() {
		formError = '';

		const platformAliases = buildAliases();
		const result = validateRequiredOnboardingPlatforms(platforms, platformAliases);
		if (!result.valid) {
			formError = result.error || 'Select at least one platform';
			return;
		}

		saving = true;
		try {
			const response = await fetch('/api/profile/onboarding', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ platforms, platformAliases })
			});
			const data = await response.json();
			if (!response.ok) {
				formError = data.error || 'Failed to save platform names';
				return;
			}
			user.update((current) => (current ? { ...current, onboardingCompleted: true } : current));
		} catch {
			formError = 'Failed to save platform names';
		} finally {
			saving = false;
		}
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		user.set(null);
		isAuthenticated.set(false);
		goto('/login');
	}
</script>

<div class="relative z-[60]">
	<Modal open={true} title="Set your platform names" size="md" closeOnBackdrop={false}>
		<div class="space-y-4 pb-4">
			<p class="text-sm text-slate-600">
				Enter the names you use in Wingspan on Steam, Android, and iPhone so screenshot scores can be
				matched to you.
			</p>

			<fieldset class="form-control">
				<legend class="block text-sm font-medium text-slate-700 mb-1.5">Platforms</legend>
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
									onchange={() => togglePlatform(platform)}
									class="checkbox checkbox-sm"
									aria-describedby={isSelected ? `first-login-alias-${platform}` : undefined}
								/>
								<span class="text-sm text-slate-700 whitespace-nowrap">{config.label}</span>
							</label>
							{#if isSelected}
								<div class="flex-1 min-w-0" id="first-login-alias-{platform}">
									{#if platform === 'steam'}
										<Input
											label=""
											bind:value={steamAlias}
											placeholder={config.placeholder}
											max="100"
										/>
									{:else if platform === 'android'}
										<Input
											label=""
											bind:value={androidAlias}
											placeholder={config.placeholder}
											max="100"
										/>
									{:else if platform === 'iphone'}
										<Input
											label=""
											bind:value={iphoneAlias}
											placeholder={config.placeholder}
											max="100"
										/>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</fieldset>

			{#if formError}
				<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
					{formError}
				</div>
			{/if}
		</div>

		<div slot="footer" class="flex w-full items-center justify-between gap-2">
			<button
				type="button"
				class="text-sm text-slate-600 hover:text-slate-900 min-h-[2.75rem] px-1 touch-manipulation"
				onclick={handleLogout}
			>
				Log out
			</button>
			<Button variant="primary" loading={saving} disabled={saving} size="sm" on:click={handleSave}>
				{saving ? 'Saving...' : 'Save'}
			</Button>
		</div>
	</Modal>
</div>
