<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/shared/Button.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Input from '$lib/components/shared/Input.svelte';
	import Card from '$lib/components/shared/Card.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';

	interface League {
		id: number;
		name: string;
		createdBy: number;
		createdByUsername: string | null;
		createdAt: string;
		playerCount: number;
		gameCount: number;
		lastGameDate?: string;
		players: Array<{ id: number; username: string; color: string }>;
	}

	interface User {
		id: number;
		username: string;
	}

	interface AdminUser {
		id: number;
		username: string;
		email: string;
		createdAt: string;
		isAdmin: boolean;
		leagueCount: number;
		gameCount: number;
	}

	type Tab = 'leagues' | 'users';

	let activeTab: Tab = 'leagues';
	let leagues: League[] = [];
	let users: User[] = [];
	let adminUsers: AdminUser[] = [];
	let loading = true;
	let error = '';
	let showCreateModal = false;
	let showEditModal = false;
	let showDeleteModal = false;
	let showEditUserModal = false;
	let showDeleteUserModal = false;
	let selectedLeague: League | null = null;
	let selectedUser: AdminUser | null = null;

	// Form state
	let leagueName = '';
	let selectedPlayerIds: number[] = [];
	let formError = '';

	// User form state
	let editUsername = '';
	let editEmail = '';
	let editIsAdmin = false;

	let dataLoaded = false;

	async function loadData() {
		if (dataLoaded) return;
		dataLoaded = true;
		await Promise.all([loadLeagues(), loadUsers(), loadAdminUsers()]);
		loading = false;
	}

	// Reactive check - wait for user to be loaded, then check admin status
	$: if ($user !== null && $user !== undefined && !dataLoaded) {
		// Check admin status
		if ($user.isAdmin !== true) {
			console.log('User is not admin, redirecting...', { 
				userId: $user.id, 
				username: $user.username, 
				isAdmin: $user.isAdmin 
			});
			goto('/leagues');
			return;
		}
		// User is admin, load data
		if ($user.isAdmin === true && loading) {
			loadData();
		}
	}

	onMount(async () => {
		// Wait for user to be loaded from the protected layout
		// The layout loads user asynchronously, so we need to wait
		let attempts = 0;
		while (($user === null || $user === undefined) && attempts < 10) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			attempts++;
		}
		
		// Check if user was loaded
		if ($user === null || $user === undefined) {
			console.error('User not loaded after waiting');
			error = 'Unable to verify authentication';
			loading = false;
			return;
		}
		
		// Check admin status
		if ($user.isAdmin !== true) {
			console.log('User is not admin:', { 
				userId: $user.id, 
				username: $user.username, 
				isAdmin: $user.isAdmin 
			});
			goto('/leagues');
			return;
		}
		
		// User is admin, load data if not already loaded
		if (loading && !dataLoaded) {
			await loadData();
		}
	});

	async function loadLeagues() {
		try {
			const response = await fetch('/api/admin/leagues');
			if (!response.ok) {
				if (response.status === 403) {
					error = 'Admin access required';
					return;
				}
				throw new Error('Failed to load leagues');
			}
			const data = await response.json();
			leagues = data.leagues || [];
		} catch (e: any) {
			error = e.message || 'Failed to load leagues';
			console.error('Error loading leagues:', e);
		}
	}

	async function loadUsers() {
		try {
			const response = await fetch('/api/users');
			if (!response.ok) {
				throw new Error('Failed to load users');
			}
			const data = await response.json();
			users = data.users || [];
		} catch (e: any) {
			console.error('Error loading users:', e);
		}
	}

	async function loadAdminUsers() {
		try {
			const response = await fetch('/api/admin/users');
			if (!response.ok) {
				if (response.status === 403) {
					error = 'Admin access required';
					return;
				}
				throw new Error('Failed to load users');
			}
			const data = await response.json();
			adminUsers = data.users || [];
		} catch (e: any) {
			error = e.message || 'Failed to load users';
			console.error('Error loading admin users:', e);
		}
	}

	function openCreateModal() {
		leagueName = '';
		selectedPlayerIds = [];
		formError = '';
		showCreateModal = true;
	}

	function openEditModal(league: League) {
		selectedLeague = league;
		leagueName = league.name;
		selectedPlayerIds = league.players.map((p) => p.id);
		formError = '';
		showEditModal = true;
	}

	function openDeleteModal(league: League) {
		selectedLeague = league;
		showDeleteModal = true;
	}

	function openEditUserModal(userData: AdminUser) {
		selectedUser = userData;
		editUsername = userData.username;
		editEmail = userData.email;
		editIsAdmin = userData.isAdmin;
		formError = '';
		showEditUserModal = true;
	}

	function openDeleteUserModal(userData: AdminUser) {
		selectedUser = userData;
		showDeleteUserModal = true;
	}

	function togglePlayer(playerId: number) {
		if (selectedPlayerIds.includes(playerId)) {
			selectedPlayerIds = selectedPlayerIds.filter((id) => id !== playerId);
		} else {
			selectedPlayerIds = [...selectedPlayerIds, playerId];
		}
	}

	async function handleCreate() {
		formError = '';

		if (!leagueName.trim()) {
			formError = 'League name is required';
			return;
		}

		if (selectedPlayerIds.length === 0) {
			formError = 'At least one player is required';
			return;
		}

		try {
			const response = await fetch('/api/admin/leagues', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: leagueName.trim(),
					playerIds: selectedPlayerIds
				})
			});

			const data = await response.json();

			if (!response.ok) {
				formError = data.error || 'Failed to create league';
				return;
			}

			showCreateModal = false;
			await loadLeagues();
		} catch (e: any) {
			formError = e.message || 'Failed to create league';
			console.error('Error creating league:', e);
		}
	}

	async function handleUpdate() {
		if (!selectedLeague) return;

		formError = '';

		if (!leagueName.trim()) {
			formError = 'League name is required';
			return;
		}

		if (selectedPlayerIds.length === 0) {
			formError = 'At least one player is required';
			return;
		}

		try {
			const response = await fetch('/api/admin/leagues', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: selectedLeague.id,
					name: leagueName.trim(),
					playerIds: selectedPlayerIds
				})
			});

			const data = await response.json();

			if (!response.ok) {
				formError = data.error || 'Failed to update league';
				return;
			}

			showEditModal = false;
			selectedLeague = null;
			await loadLeagues();
		} catch (e: any) {
			formError = e.message || 'Failed to update league';
			console.error('Error updating league:', e);
		}
	}

	async function handleDelete() {
		if (!selectedLeague) return;

		try {
			const response = await fetch('/api/admin/leagues', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: selectedLeague.id })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Failed to delete league';
				return;
			}

			showDeleteModal = false;
			selectedLeague = null;
			await loadLeagues();
		} catch (e: any) {
			error = e.message || 'Failed to delete league';
			console.error('Error deleting league:', e);
		}
	}

	async function handleUpdateUser() {
		if (!selectedUser) return;

		formError = '';

		if (!editUsername.trim()) {
			formError = 'Username is required';
			return;
		}

		if (!editEmail.trim()) {
			formError = 'Email is required';
			return;
		}

		try {
			const response = await fetch('/api/admin/users', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: selectedUser.id,
					username: editUsername.trim(),
					email: editEmail.trim(),
					isAdmin: editIsAdmin
				})
			});

			const data = await response.json();

			if (!response.ok) {
				formError = data.error || 'Failed to update user';
				return;
			}

			showEditUserModal = false;
			selectedUser = null;
			await loadAdminUsers();
		} catch (e: any) {
			formError = e.message || 'Failed to update user';
			console.error('Error updating user:', e);
		}
	}

	async function handleDeleteUser() {
		if (!selectedUser) return;

		try {
			const response = await fetch('/api/admin/users', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: selectedUser.id })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Failed to delete user';
				return;
			}

			showDeleteUserModal = false;
			selectedUser = null;
			await loadAdminUsers();
		} catch (e: any) {
			error = e.message || 'Failed to delete user';
			console.error('Error deleting user:', e);
		}
	}

	function formatDate(dateString: string | undefined): string {
		if (!dateString) return 'Never';
		const date = new Date(dateString);
		return date.toLocaleDateString();
	}
</script>

<svelte:head>
	<title>Admin - Management</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-slate-900">Admin Management</h1>
			<p class="mt-1 text-sm text-slate-600">Manage leagues and users in the system</p>
		</div>
	</div>

	<!-- Tabs -->
	<div class="tabs tabs-boxed">
		<button
			class="tab {activeTab === 'leagues' ? 'tab-active' : ''}"
			on:click={() => (activeTab = 'leagues')}
		>
			Leagues
		</button>
		<button
			class="tab {activeTab === 'users' ? 'tab-active' : ''}"
			on:click={() => (activeTab = 'users')}
		>
			Users
		</button>
	</div>

	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="text-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
			<p class="mt-4 text-slate-600">Loading...</p>
		</div>
	{:else if activeTab === 'leagues'}
		<!-- Leagues Tab -->
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-2xl font-semibold text-slate-900">League Management</h2>
			<Button on:click={openCreateModal}>Create League</Button>
		</div>

		{#if leagues.length === 0}
			<Card>
				<div class="text-center py-12">
					<p class="text-slate-600">No leagues found. Create your first league to get started.</p>
				</div>
			</Card>
		{:else}
			<div class="grid gap-4">
				{#each leagues as league (league.id)}
					{@const leagueData = league}
					<Card>
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-3 mb-2">
									<h3 class="text-xl font-semibold text-slate-900">{leagueData.name}</h3>
									<Badge variant="default">ID: {leagueData.id}</Badge>
								</div>
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600 mb-4">
									<div>
										<span class="font-medium">Players:</span> {leagueData.playerCount}
									</div>
									<div>
										<span class="font-medium">Games:</span> {leagueData.gameCount}
									</div>
									<div>
										<span class="font-medium">Created:</span> {formatDate(leagueData.createdAt)}
									</div>
									<div>
										<span class="font-medium">Last Game:</span> {formatDate(leagueData.lastGameDate)}
									</div>
								</div>
								<div class="mb-2">
									<span class="text-sm font-medium text-slate-700">Players:</span>
									<div class="mt-1 flex flex-wrap gap-2">
										{#each leagueData.players as player}
											{@const playerData = player}
											<Badge variant="default">{playerData.username}</Badge>
										{/each}
									</div>
								</div>
								{#if leagueData.createdByUsername}
									<p class="text-sm text-slate-500">Created by: {leagueData.createdByUsername}</p>
								{/if}
							</div>
							<div class="flex gap-2 ml-4">
								<Button variant="secondary" size="sm" on:click={() => openEditModal(leagueData)}>
									Edit
								</Button>
								<Button variant="accent" size="sm" on:click={() => openDeleteModal(leagueData)}>
									Delete
								</Button>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	{:else if activeTab === 'users'}
		<!-- Users Tab -->
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-2xl font-semibold text-slate-900">User Management</h2>
		</div>

		{#if adminUsers.length === 0}
			<Card>
				<div class="text-center py-12">
					<p class="text-slate-600">No users found.</p>
				</div>
			</Card>
		{:else}
			<div class="grid gap-4">
				{#each adminUsers as userData (userData.id)}
					{@const currentUserData = userData}
					<Card>
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-3 mb-2">
									<h3 class="text-xl font-semibold text-slate-900">{currentUserData.username}</h3>
									{#if currentUserData.isAdmin}
										<Badge variant="default">Admin</Badge>
									{/if}
									<Badge variant="default">ID: {currentUserData.id}</Badge>
								</div>
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600 mb-4">
									<div>
										<span class="font-medium">Email:</span> {currentUserData.email}
									</div>
									<div>
										<span class="font-medium">Leagues:</span> {currentUserData.leagueCount}
									</div>
									<div>
										<span class="font-medium">Games:</span> {currentUserData.gameCount}
									</div>
									<div>
										<span class="font-medium">Created:</span> {formatDate(currentUserData.createdAt)}
									</div>
								</div>
							</div>
							<div class="flex gap-2 ml-4">
								<Button
									variant="secondary"
									size="sm"
									on:click={() => openEditUserModal(currentUserData)}
								>
									Edit
								</Button>
								{#if $user && $user.id !== currentUserData.id}
									<Button
										variant="accent"
										size="sm"
										on:click={() => openDeleteUserModal(currentUserData)}
									>
										Delete
									</Button>
								{/if}
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Create League Modal -->
<Modal open={showCreateModal} title="Create League" on:close={() => (showCreateModal = false)}>
	<div class="space-y-4">
		<Input
			label="League Name"
			bind:value={leagueName}
			placeholder="Enter league name"
			required
		/>

		<div>
			<label class="block text-sm font-medium text-slate-700 mb-2">
				Players <span class="text-red-500">*</span>
			</label>
			<div class="border border-slate-300 rounded-md p-3 max-h-64 overflow-y-auto">
				{#if users.length === 0}
					<p class="text-sm text-slate-500">No users available</p>
				{:else}
					<div class="space-y-2">
						{#each users as userItem}
							{@const userData = userItem}
							<label class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
								<input
									type="checkbox"
									checked={selectedPlayerIds.includes(userData.id)}
									on:change={() => togglePlayer(userData.id)}
									class="checkbox checkbox-sm"
								/>
								<span class="text-sm text-slate-700">{userData.username}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>
			{#if selectedPlayerIds.length > 0}
				<p class="mt-2 text-sm text-slate-600">
					{selectedPlayerIds.length} player{selectedPlayerIds.length !== 1 ? 's' : ''} selected
				</p>
			{/if}
		</div>

		{#if formError}
			<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
				{formError}
			</div>
		{/if}
	</div>

	<div slot="footer">
		<Button variant="secondary" on:click={() => (showCreateModal = false)}>Cancel</Button>
		<Button on:click={handleCreate}>Create League</Button>
	</div>
</Modal>

<!-- Edit League Modal -->
<Modal open={showEditModal} title="Edit League" on:close={() => (showEditModal = false)}>
	<div class="space-y-4">
		<Input
			label="League Name"
			bind:value={leagueName}
			placeholder="Enter league name"
			required
		/>

		<div>
			<label class="block text-sm font-medium text-slate-700 mb-2">
				Players <span class="text-red-500">*</span>
			</label>
			<div class="border border-slate-300 rounded-md p-3 max-h-64 overflow-y-auto">
				{#if users.length === 0}
					<p class="text-sm text-slate-500">No users available</p>
				{:else}
					<div class="space-y-2">
						{#each users as userItem}
							{@const userData = userItem}
							<label class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
								<input
									type="checkbox"
									checked={selectedPlayerIds.includes(userData.id)}
									on:change={() => togglePlayer(userData.id)}
									class="checkbox checkbox-sm"
								/>
								<span class="text-sm text-slate-700">{userData.username}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>
			{#if selectedPlayerIds.length > 0}
				<p class="mt-2 text-sm text-slate-600">
					{selectedPlayerIds.length} player{selectedPlayerIds.length !== 1 ? 's' : ''} selected
				</p>
			{/if}
		</div>

		{#if formError}
			<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
				{formError}
			</div>
		{/if}
	</div>

	<div slot="footer">
		<Button variant="secondary" on:click={() => (showEditModal = false)}>Cancel</Button>
		<Button on:click={handleUpdate}>Update League</Button>
	</div>
</Modal>

<!-- Delete League Modal -->
<Modal open={showDeleteModal} title="Delete League" on:close={() => (showDeleteModal = false)}>
	<div class="space-y-4">
		{#if selectedLeague}
			<p class="text-slate-700">
				Are you sure you want to delete the league <strong>"{selectedLeague.name}"</strong>?
			</p>
			<p class="text-sm text-slate-600">
				This will permanently delete the league, all associated games, scores, and player memberships.
				This action cannot be undone.
			</p>
			<div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
				<strong>Warning:</strong> This league has {selectedLeague.gameCount} game(s) and{' '}
				{selectedLeague.playerCount} player(s). All of this data will be deleted.
			</div>
		{/if}
	</div>

	<div slot="footer">
		<Button variant="secondary" on:click={() => (showDeleteModal = false)}>Cancel</Button>
		<Button variant="accent" on:click={handleDelete}>Delete League</Button>
	</div>
</Modal>

<!-- Edit User Modal -->
<Modal open={showEditUserModal} title="Edit User" on:close={() => (showEditUserModal = false)}>
	<div class="space-y-4">
		<Input
			label="Username"
			bind:value={editUsername}
			placeholder="Enter username"
			required
		/>

		<Input
			label="Email"
			type="email"
			bind:value={editEmail}
			placeholder="Enter email"
			required
		/>

		<div>
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={editIsAdmin}
					class="checkbox checkbox-sm"
					disabled={$user && selectedUser && $user.id === selectedUser.id}
				/>
				<span class="text-sm text-slate-700">Admin User</span>
			</label>
			{#if $user && selectedUser && $user.id === selectedUser.id}
				<p class="mt-1 text-xs text-slate-500">You cannot change your own admin status</p>
			{/if}
		</div>

		{#if formError}
			<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
				{formError}
			</div>
		{/if}
	</div>

	<div slot="footer">
		<Button variant="secondary" on:click={() => (showEditUserModal = false)}>Cancel</Button>
		<Button on:click={handleUpdateUser}>Update User</Button>
	</div>
</Modal>

<!-- Delete User Modal -->
<Modal open={showDeleteUserModal} title="Delete User" on:close={() => (showDeleteUserModal = false)}>
	<div class="space-y-4">
		{#if selectedUser}
			<p class="text-slate-700">
				Are you sure you want to delete the user <strong>"{selectedUser.username}"</strong>?
			</p>
			<p class="text-sm text-slate-600">
				This will permanently delete the user, all associated league memberships, games, and scores.
				This action cannot be undone.
			</p>
			<div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
				<strong>Warning:</strong> This user has {selectedUser.leagueCount} league(s) and{' '}
				{selectedUser.gameCount} game(s). All of this data will be deleted.
			</div>
		{/if}
	</div>

	<div slot="footer">
		<Button variant="secondary" on:click={() => (showDeleteUserModal = false)}>Cancel</Button>
		<Button variant="accent" on:click={handleDeleteUser}>Delete User</Button>
	</div>
</Modal>
