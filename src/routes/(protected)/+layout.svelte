<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, isAuthenticated } from '$lib/stores/auth';
	import { page } from '$app/stores';

	onMount(async () => {
		// Check authentication
		try {
			const response = await fetch('/api/auth/me');
			if (response.ok) {
				const data = await response.json();
				user.set(data.user);
				isAuthenticated.set(true);
			} else {
				isAuthenticated.set(false);
				goto('/login');
			}
		} catch (e) {
			isAuthenticated.set(false);
			goto('/login');
		}
	});

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		user.set(null);
		isAuthenticated.set(false);
		goto('/login');
	}
</script>

<div class="min-h-screen bg-bg-primary">
	<nav class="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between h-16">
				<div class="flex-1">
					<a href="/leagues" class="text-xl font-bold text-slate-900 hover:text-blue-600 transition-colors">
						Wingspan Score Tracker
					</a>
				</div>
				<div class="flex-none gap-2">
					{#if $user}
						<div class="dropdown dropdown-end">
							<label tabindex="0" class="btn btn-ghost text-slate-700 hover:text-slate-900">
								<span>{$user.username}</span>
							</label>
							<ul tabindex="0" class="dropdown-content menu bg-white border border-slate-200 rounded-lg w-52 p-2 shadow-lg mt-2 z-50">
								<li>
									<a 
										href="/profile" 
										class="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-md transition-colors {$page.url.pathname === '/profile' ? 'bg-slate-100 font-medium' : ''}"
									>
										Profile
									</a>
								</li>
								{#if $user.isAdmin}
									<li>
										<a 
											href="/admin" 
											class="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-md transition-colors {$page.url.pathname === '/admin' ? 'bg-slate-100 font-medium' : ''}"
										>
											Admin
										</a>
									</li>
								{/if}
								<li>
									<button 
										on:click={handleLogout} 
										class="block w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
									>
										Logout
									</button>
								</li>
							</ul>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</nav>
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<slot />
	</main>
</div>
