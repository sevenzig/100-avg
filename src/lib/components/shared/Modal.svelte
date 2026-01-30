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
			<div class="relative bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col {sizeClass === 'modal-sm' ? 'max-w-sm' : sizeClass === 'modal-lg' ? 'max-w-3xl' : sizeClass === 'modal-xl' ? 'max-w-5xl' : 'max-w-md'} w-full">
				<div class="p-4 sm:p-6 shrink-0">
					{#if title}
						<h3 class="font-bold text-lg text-slate-900">{title}</h3>
					{/if}
				</div>
				<div class="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6">
					<slot />
				</div>
				{#if $$slots.footer}
					<div class="shrink-0 py-5 px-4 sm:py-6 sm:px-6 border-t border-slate-200 bg-white flex items-center justify-end gap-2 rounded-b-lg">
						<slot name="footer" />
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
