<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Card from '$lib/components/shared/Card.svelte';
	import ScoringChart from '$lib/components/profile/ScoringChart.svelte';
	import PlacementHistoryChart from '$lib/components/profile/PlacementHistoryChart.svelte';
	import CategoryAveragesChart from '$lib/components/profile/CategoryAveragesChart.svelte';
	import RecentScoresChart from '$lib/components/profile/RecentScoresChart.svelte';

	interface Profile {
		id: number;
		username: string;
		displayName?: string | null;
		platforms: string[];
		platformAliases?: {
			steam?: string | null;
			android?: string | null;
			iphone?: string | null;
		};
		createdAt: string;
		isOwnProfile: boolean;
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

	$: userId = parseInt($page.params.userid);

	let profile: Profile | null = null;
	let stats: UserStats | null = null;
	let loading = true;
	let error = '';
	let selectedChart: 'scoring' | 'placement' | 'category' | 'recent' = 'scoring';

	async function loadProfile() {
		try {
			const response = await fetch(`/api/profile/${userId}`);
			if (response.ok) {
				const data = await response.json();
				profile = data.profile;
			} else if (response.status === 401) {
				error = 'Not authenticated';
			} else if (response.status === 404) {
				error = 'User not found';
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
			const response = await fetch(`/api/profile/${userId}/stats?matches=20`);
			if (response.ok) {
				const data = await response.json();
				stats = data.stats;
			}
		} catch (e: any) {
			console.error('Error loading stats:', e);
		}
	}

	onMount(async () => {
		await Promise.all([loadProfile(), loadStats()]);
		loading = false;
	});
</script>

<svelte:head>
	<title>{profile ? `${profile.username}'s Profile` : 'User Profile'} - Wingspan Score Tracker</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-900">
				{profile ? `${profile.displayName || profile.username}'s Profile` : 'User Profile'}
			</h1>
			<p class="mt-0.5 text-xs text-slate-600">
				{#if profile?.isOwnProfile}
					Your profile and statistics
				{:else if profile}
					View {profile.username}'s statistics and scoring breakdown
				{:else}
					Loading profile...
				{/if}
			</p>
		</div>
		{#if profile?.isOwnProfile}
			<a
				href="/profile"
				class="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
			>
				Edit Profile →
			</a>
		{/if}
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
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-slate-700 mb-1">Username</label>
							<div class="text-base text-slate-900">{profile.username}</div>
						</div>
						{#if profile.displayName}
							<div>
								<label class="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
								<div class="text-base text-slate-900">{profile.displayName}</div>
							</div>
						{/if}
						{#if profile.platforms && profile.platforms.length > 0}
							<div>
								<label class="block text-sm font-medium text-slate-700 mb-2">Platforms</label>
								<div class="flex flex-wrap gap-2">
									{#each profile.platforms as platform}
										<span
											class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
										>
											{platform}
										</span>
									{/each}
								</div>
							</div>
						{/if}
						{#if profile.platformAliases && (profile.platformAliases.steam || profile.platformAliases.android || profile.platformAliases.iphone)}
							<div>
								<label class="block text-sm font-medium text-slate-700 mb-2">Platform Aliases</label>
								<div class="space-y-1.5">
									{#if profile.platformAliases.steam}
										<div class="text-sm">
											<span class="font-medium text-slate-600">Steam:</span>
											<span class="ml-2 text-slate-900">{profile.platformAliases.steam}</span>
										</div>
									{/if}
									{#if profile.platformAliases.android}
										<div class="text-sm">
											<span class="font-medium text-slate-600">Android:</span>
											<span class="ml-2 text-slate-900">{profile.platformAliases.android}</span>
										</div>
									{/if}
									{#if profile.platformAliases.iphone}
										<div class="text-sm">
											<span class="font-medium text-slate-600">iPhone:</span>
											<span class="ml-2 text-slate-900">{profile.platformAliases.iphone}</span>
										</div>
									{/if}
								</div>
							</div>
						{/if}
						<div>
							<label class="block text-sm font-medium text-slate-700 mb-1">Member Since</label>
							<div class="text-sm text-slate-600">
								{new Date(profile.createdAt).toLocaleDateString('en-US', {
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})}
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	{/if}
</div>
