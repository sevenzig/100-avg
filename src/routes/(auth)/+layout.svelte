<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth';

	onMount(async () => {
		// Check if user is already authenticated
		const currentUser = $user;
		if (currentUser) {
			goto('/leagues');
		}
	});
</script>

<div class="min-h-screen bg-bg-primary flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<slot />
	</div>
</div>
