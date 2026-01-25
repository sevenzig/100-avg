<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let hover = false;
	export let padding = 'p-6';
	export let className: string = '';

	const dispatch = createEventDispatcher();

	$: hoverClass = hover ? 'hover:shadow-md transition-all duration-150 cursor-pointer' : '';

	function handleClick(event: MouseEvent) {
		dispatch('click', event);
	}
</script>

<div class="bg-white border border-slate-200 rounded-lg shadow-sm {padding} {hoverClass} {className}" on:click={handleClick}>
	{#if $$slots.header}
		<div class="mb-4 pb-4 border-b border-slate-200">
			<slot name="header" />
		</div>
	{/if}
	<div>
		<slot />
	</div>
	{#if $$slots.footer}
		<div class="mt-4 pt-4 border-t border-slate-200">
			<slot name="footer" />
		</div>
	{/if}
</div>
