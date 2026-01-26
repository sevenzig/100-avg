<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/shared/Card.svelte';
	import ProfileEditForm from '$lib/components/profile/ProfileEditForm.svelte';
	import ScoringChart from '$lib/components/profile/ScoringChart.svelte';
	import PlacementHistoryChart from '$lib/components/profile/PlacementHistoryChart.svelte';
	import CategoryAveragesChart from '$lib/components/profile/CategoryAveragesChart.svelte';
	import RecentScoresChart from '$lib/components/profile/RecentScoresChart.svelte';

	interface Profile {
		id: number;
		username: string;
		email: string;
		displayName?: string | null;
		platforms: string[];
		platformAliases?: {
			steam?: string | null;
			android?: string | null;
			iphone?: string | null;
		};
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
		gameScores: Array<{
			gameId: number;
			date: string;
			gameNumber: number;
			birds: number;
			bonusCards: number;
			endOfRoundGoals: number;
			eggs: number;
			foodOnCards: number;
			tuckedCards: number;
			nectar: number;
			totalScore: number;
		}>;
	}

	let profile: Profile | null = null;
	let stats: UserStats | null = null;
	let loading = true;
	let saving = false;
	let error = '';
	let selectedChart: 'scoring' | 'placement' | 'category' | 'recent' = 'scoring';

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

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-900">Profile Settings</h1>
			<p class="mt-0.5 text-xs text-slate-600">Manage your profile information and view statistics</p>
		</div>
	</div>

	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="text-center py-8">
			<span class="loading loading-spinner loading-lg"></span>
			<p class="mt-2 text-sm text-slate-600">Loading profile...</p>
		</div>
	{:else if profile}
		<!-- Two-column layout: Chart 60% left, Profile 40% right -->
		<div class="flex flex-col lg:flex-row gap-4">
			<!-- Statistics Section - 60% width -->
			<div class="w-full lg:w-[60%]">
				<Card padding="p-4">
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<div>
								{#if selectedChart === 'scoring'}
									<h3 class="text-lg font-semibold text-slate-900">Scoring Breakdown</h3>
									<p class="text-sm text-slate-600">Last {stats?.gameScores?.length || 0} games</p>
								{:else if selectedChart === 'placement'}
									<h3 class="text-lg font-semibold text-slate-900">Placement History</h3>
									<p class="text-sm text-slate-600">Last {stats?.placementHistory?.length || 0} matches</p>
								{:else if selectedChart === 'category'}
									<h3 class="text-lg font-semibold text-slate-900">Category Averages</h3>
									<p class="text-sm text-slate-600">Last {stats?.categoryAverages?.matches || 0} matches</p>
								{:else if selectedChart === 'recent'}
									<h3 class="text-lg font-semibold text-slate-900">Recent Scores</h3>
									<p class="text-sm text-slate-600">Last 10 games</p>
								{/if}
							</div>
							<select
								bind:value={selectedChart}
								class="select select-bordered select-sm w-48 text-sm"
							>
								<option value="scoring">Scoring Breakdown</option>
								<option value="placement">Placement History</option>
								<option value="category">Category Averages</option>
								<option value="recent">Recent Scores</option>
							</select>
						</div>
						{#if selectedChart === 'scoring'}
							<ScoringChart gameScores={stats?.gameScores} hideTitle={true} />
						{:else if selectedChart === 'placement'}
							<PlacementHistoryChart placementHistory={stats?.placementHistory} hideTitle={true} />
						{:else if selectedChart === 'category'}
							<CategoryAveragesChart categoryAverages={stats?.categoryAverages} hideTitle={true} />
						{:else if selectedChart === 'recent'}
							<RecentScoresChart recentScores={stats?.recentScores} hideTitle={true} />
						{/if}
					</div>
				</Card>
			</div>

			<!-- Profile Information Section - 40% width -->
			<div class="w-full lg:w-[40%]">
				<Card padding="p-4">
					<div slot="header" class="mb-3 pb-2">
						<h2 class="text-lg font-semibold text-slate-900">Profile Information</h2>
					</div>
					<ProfileEditForm {profile} loading={saving} on:save={handleSave} on:cancel={handleCancel} />
				</Card>
			</div>
		</div>
	{/if}
</div>
