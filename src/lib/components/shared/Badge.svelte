<script lang="ts">
	export let variant: 'default' | 'success' | 'warning' | 'error' | 'info' = 'default';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let className: string = '';

	$: variantClass = {
		default: 'bg-slate-100 text-slate-700',
		success: 'bg-emerald-100 text-emerald-700',
		warning: 'bg-amber-100 text-amber-700',
		error: 'bg-red-100 text-red-700',
		info: 'bg-blue-100 text-blue-700'
	}[variant];

	$: sizeClass = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm',
		lg: 'px-3 py-1.5 text-base'
	}[size];
</script>

<span class="inline-flex items-center font-medium rounded-full {variantClass} {sizeClass} {className}">
	<slot />
</span>
