<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user } from '$lib/stores/auth';
	import { safeJoinRedirect } from '$lib/utils/safe-redirect';

	onMount(async () => {
		const currentUser = $user;
		if (currentUser) {
			goto(safeJoinRedirect($page.url.searchParams.get('redirect')) ?? '/leagues');
		}
	});
</script>

<div class="min-h-screen bg-bg-primary flex items-center justify-center p-4 sm:p-6">
	<div class="w-full max-w-md min-w-0">
		<slot />
	</div>
</div>
