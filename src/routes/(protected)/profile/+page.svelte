<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/shared/Card.svelte';
	import ProfileEditForm from '$lib/components/profile/ProfileEditForm.svelte';
	import PlacementHistoryChart from '$lib/components/profile/PlacementHistoryChart.svelte';
	import CategoryAveragesChart from '$lib/components/profile/CategoryAveragesChart.svelte';
	import RecentScoresChart from '$lib/components/profile/RecentScoresChart.svelte';

	interface Profile {
		id: number;
		username: string;
		email: string;
		displayName?: string | null;
		platforms: string[];
		createdAt: string;
	}

	interface UserStats {
		placementHistory: Array<{
			gameId: number;
			date: string;
			placement: number;
			totalScore: number;
		}>;
		categoryAverages: {
			matches: number;
			birds: number;
			bonusCards: number;
			endOfRoundGoals: number;
			eggs: number;
			foodOnCards: number;
			tuckedCards: number;
			nectar: number;
		};
		recentScores: Array<{
			gameId: number;
			date: string;
			totalScore: number;
		}>;
	}

	let profile: Profile | null = null;
	let stats: UserStats | null = null;
	let loading = true;
	let saving = false;
	let error = '';

	async function loadProfile() {
		try {
			const response = await fetch('/api/profile');
			if (response.ok) {
				const data = await response.json();
				profile = data.profile;
			} else if (response.status === 401) {
				error = 'Not authenticated';
			} else {
				error = 'Failed to load profile';
			}
		} catch (e: any) {
			error = e.message || 'Failed to load profile';
			console.error('Error loading profile:', e);
		}
	}

	async function loadStats() {
		try {
			const response = await fetch('/api/profile/stats?matches=20');
			if (response.ok) {
				const data = await response.json();
				stats = data.stats;
			}
		} catch (e: any) {
			console.error('Error loading stats:', e);
		}
	}

	async function handleSave(event: CustomEvent<{ profile: any }>) {
		saving = true;
		error = '';

		try {
			const response = await fetch('/api/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(event.detail.profile)
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Failed to update profile';
				return;
			}

			// Update local profile state
			profile = data.profile;
		} catch (e: any) {
			error = e.message || 'Failed to update profile';
			console.error('Error updating profile:', e);
		} finally {
			saving = false;
		}
	}

	function handleCancel() {
		// Form will reset itself
		error = '';
	}

	onMount(async () => {
		await Promise.all([loadProfile(), loadStats()]);
		loading = false;
	});
</script>

<svelte:head>
	<title>Profile - Wingspan Score Tracker</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-slate-900">Profile Settings</h1>
			<p class="mt-1 text-sm text-slate-600">Manage your profile information and view statistics</p>
		</div>
	</div>

	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="text-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
			<p class="mt-4 text-slate-600">Loading profile...</p>
		</div>
	{:else if profile}
		<!-- Profile Information Section -->
		<Card>
			<div slot="header">
				<h2 class="text-xl font-semibold text-slate-900">Profile Information</h2>
			</div>
			<ProfileEditForm {profile} {saving} on:save={handleSave} on:cancel={handleCancel} />
		</Card>

		<!-- Statistics Section -->
		<div>
			<h2 class="text-2xl font-semibold text-slate-900 mb-4">Player Statistics</h2>
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				<Card>
					<PlacementHistoryChart placementHistory={stats?.placementHistory} />
				</Card>
				<Card>
					<CategoryAveragesChart categoryAverages={stats?.categoryAverages} />
				</Card>
				<Card>
					<RecentScoresChart recentScores={stats?.recentScores} />
				</Card>
			</div>
		</div>
	{/if}
</div>
