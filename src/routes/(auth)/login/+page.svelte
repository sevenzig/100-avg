<script lang="ts">
	import { goto } from '$app/navigation';
	import { user, isAuthenticated } from '$lib/stores/auth';
	import LoginForm from '$lib/components/auth/LoginForm.svelte';
	import Card from '$lib/components/shared/Card.svelte';

	let error = '';

	async function handleLogin(event: CustomEvent<{ username: string; password: string }>) {
		error = '';

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(event.detail)
			});

			const data = await response.json();

			if (data.success) {
				user.set(data.user);
				isAuthenticated.set(true);
				goto('/leagues');
			} else {
				error = data.error || 'Login failed';
			}
		} catch (e) {
			error = 'An error occurred during login';
		}
	}
</script>

<Card padding="p-12">
	<h1 class="text-3xl font-bold text-center mb-8 text-slate-900">Wingspan Score Tracker</h1>
	<LoginForm on:submit={handleLogin} />
	{#if error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mt-4">
			<span>{error}</span>
		</div>
	{/if}
	<div class="text-center mt-4">
		<a href="/register" class="text-sm text-blue-600 hover:text-blue-700 font-medium">Don't have an account? Register</a>
		</div>
</Card>
