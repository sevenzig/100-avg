<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user, isAuthenticated } from '$lib/stores/auth';
	import RegisterForm from '$lib/components/auth/RegisterForm.svelte';
	import Card from '$lib/components/shared/Card.svelte';
	import { safeJoinRedirect } from '$lib/utils/safe-redirect';

	let error = '';
	$: joinRedirect = safeJoinRedirect($page.url.searchParams.get('redirect'));

	async function handleRegister(event: CustomEvent<{ username: string; email: string; password: string }>) {
		error = '';

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(event.detail)
			});

			const data = await response.json();

			if (data.success) {
				user.set(data.user);
				isAuthenticated.set(true);
				goto(joinRedirect ?? '/leagues');
			} else {
				error = data.error || 'Registration failed';
			}
		} catch (e) {
			error = 'An error occurred during registration';
		}
	}
</script>

<Card padding="p-12">
	<h1 class="text-3xl font-bold text-center mb-8 text-slate-900">Create Account</h1>
	<RegisterForm on:submit={handleRegister} />
	{#if error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mt-4">
			<span>{error}</span>
		</div>
	{/if}
	<div class="text-center mt-4">
		<a
			href={joinRedirect ? `/login?redirect=${encodeURIComponent(joinRedirect)}` : '/login'}
			class="text-sm text-blue-600 hover:text-blue-700 font-medium"
		>Already have an account? Login</a>
	</div>
</Card>
