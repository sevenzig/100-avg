<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Input from '$lib/components/shared/Input.svelte';

	const dispatch = createEventDispatcher();

	let username = '';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let error = '';
	let loading = false;

	function validate(): boolean {
		if (username.length < 3 || username.length > 20) {
			error = 'Username must be 3-20 characters';
			return false;
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			error = 'Invalid email format';
			return false;
		}

		if (password.length < 8) {
			error = 'Password must be at least 8 characters';
			return false;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return false;
		}

		return true;
	}

	async function handleSubmit() {
		error = '';

		if (!validate()) {
			return;
		}

		loading = true;

		try {
			dispatch('submit', { username, email, password });
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
		label="Username"
		bind:value={username}
		required
		placeholder="Enter username (3-20 characters)"
	/>
	<Input
		type="email"
		label="Email"
		bind:value={email}
		required
		placeholder="Enter email"
	/>
	<Input
		type="password"
		label="Password"
		bind:value={password}
		required
		placeholder="Enter password (min 8 characters)"
	/>
	<Input
		type="password"
		label="Confirm Password"
		bind:value={confirmPassword}
		required
		placeholder="Confirm password"
	/>

	<Button type="submit" variant="primary" {loading} className="w-full">
		Register
	</Button>
</form>
