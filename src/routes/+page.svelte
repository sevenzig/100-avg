<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth';

	onMount(async () => {
		// Check if user is authenticated
		try {
			const response = await fetch('/api/auth/me');
			if (response.ok) {
				const data = await response.json();
				user.set(data.user);
				goto('/leagues');
			} else {
				goto('/login');
			}
		} catch (e) {
			goto('/login');
		}
	});
</script>

<div class="flex justify-center items-center h-screen">
	<span class="loading loading-spinner loading-lg"></span>
</div>
