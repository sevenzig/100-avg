<script lang="ts">
	export let headers: string[] = [];
	export let data: any[] = [];
	export let sortable = false;
	export let className: string = '';
</script>

<div class="overflow-x-auto {className}">
	<table class="w-full border-collapse">
		<thead class="sticky top-0 z-10 bg-slate-100 border-b-2 border-slate-200">
			<tr>
				{#each headers as header}
					<th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
						{header}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody class="bg-white divide-y divide-slate-200">
			{#each data as row, i}
				<tr class="hover:bg-slate-50 transition-colors duration-150 {i % 2 === 1 ? 'bg-slate-50/50' : ''}">
					<slot name="row" {row} index={i} />
				</tr>
			{/each}
		</tbody>
	</table>
</div>
