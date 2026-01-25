<script lang="ts">
	export let type: string = 'text';
	export let label: string = '';
	export let error: string = '';
	export let placeholder: string = '';
	export let value: string = '';
	export let required = false;
	export let disabled = false;
	export let className: string = '';
	export let min: string | number | undefined = undefined;
	export let max: string | number | undefined = undefined;

	let inputId = `input-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="form-control w-full {className}">
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-slate-700 mb-1.5">
			{label}
			{#if required}
				<span class="text-red-500 ml-1">*</span>
			{/if}
		</label>
	{/if}
	{#if type === 'password'}
		<input
			type="password"
			id={inputId}
			{placeholder}
			{required}
			{disabled}
			bind:value
			class="w-full px-4 py-2.5 border rounded-md bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed {error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}"
			on:input
			on:blur
		/>
	{:else if type === 'email'}
		<input
			type="email"
			id={inputId}
			{placeholder}
			{required}
			{disabled}
			bind:value
			class="w-full px-4 py-2.5 border rounded-md bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed {error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}"
			on:input
			on:blur
		/>
	{:else if type === 'date'}
		<input
			type="date"
			id={inputId}
			{placeholder}
			{required}
			{disabled}
			bind:value
			class="w-full px-4 py-2.5 border rounded-md bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed {error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}"
			on:input
			on:blur
		/>
	{:else if type === 'number'}
		<input
			type="number"
			id={inputId}
			{placeholder}
			{required}
			{disabled}
			bind:value
			min={min}
			max={max}
			class="w-full px-4 py-2.5 border rounded-md bg-white text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed {error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}"
			on:input
			on:blur
		/>
	{:else}
		<input
			type="text"
			id={inputId}
			{placeholder}
			{required}
			{disabled}
			bind:value
			class="w-full px-4 py-2.5 border rounded-md bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed {error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}"
			on:input
			on:blur
		/>
	{/if}
	{#if error}
		<p class="mt-1.5 text-sm text-red-600">{error}</p>
	{/if}
</div>
