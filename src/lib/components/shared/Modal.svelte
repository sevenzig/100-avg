<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let open = false;
	export let title: string = '';
	export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
	export let closeOnBackdrop = true;

	const dispatch = createEventDispatcher();

	$: sizeClass = {
		sm: 'modal-sm',
		md: '',
		lg: 'modal-lg',
		xl: 'modal-xl'
	}[size];

	function handleBackdropClick(e: MouseEvent) {
		if (closeOnBackdrop && (e.target as HTMLElement).classList.contains('modal-backdrop')) {
			dispatch('close');
		}
	}

	function handleClose() {
		dispatch('close');
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 overflow-y-auto" on:click={handleBackdropClick} role="dialog" aria-modal="true">
		<div class="flex min-h-full items-center justify-center p-4 sm:p-6">
			<div class="fixed inset-0 bg-black/30 transition-opacity" aria-hidden="true"></div>
			<div class="relative bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto {sizeClass === 'modal-sm' ? 'max-w-sm' : sizeClass === 'modal-lg' ? 'max-w-3xl' : sizeClass === 'modal-xl' ? 'max-w-5xl' : 'max-w-md'} w-full p-4 sm:p-6">
				{#if title}
					<h3 class="font-bold text-lg text-slate-900 mb-4">{title}</h3>
				{/if}
				<slot />
				{#if $$slots.footer}
					<div class="mt-6 flex justify-end gap-2">
						<slot name="footer" />
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
