<script lang="ts">
	export let variant: 'primary' | 'secondary' | 'ghost' | 'accent' = 'primary';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let loading = false;
	export let disabled = false;
	export let type: 'button' | 'submit' | 'reset' = 'button';
	export let className: string = '';

	$: variantClass = {
		primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
		secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2',
		ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2',
		accent: 'bg-violet-600 text-white hover:bg-violet-700 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2'
	}[variant];

	$: sizeClass = {
		sm: 'px-3 py-1.5 text-sm',
		md: 'px-4 py-2 text-base',
		lg: 'px-6 py-3 text-lg'
	}[size];
</script>

<button
	type={type}
	class="font-medium rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed {variantClass} {sizeClass} {className}"
	disabled={disabled || loading}
	on:click
>
	{#if loading}
		<span class="loading loading-spinner loading-sm mr-2"></span>
	{/if}
	<slot />
</button>
