<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Input from '$lib/components/shared/Input.svelte';

	const dispatch = createEventDispatcher();

	let username = '';
	let password = '';
	let error = '';
	let loading = false;

	async function handleSubmit() {
		error = '';
		loading = true;

		try {
			dispatch('submit', { username, password });
		} catch (e) {
			error = 'An error occurred';
		} finally {
			loading = false;
		}
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4">
	{#if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{/if}

	<Input
		type="text"
		label="Username or Email"
		bind:value={username}
		required
		placeholder="Enter username or email"
	/>
	<Input
		type="password"
		label="Password"
		bind:value={password}
		required
		placeholder="Enter password"
	/>

	<Button type="submit" variant="primary" {loading} className="w-full">
		Login
	</Button>
</form>
