<script lang="ts">
	import { formatSeasonLabel, type Season } from '$lib/utils/seasons';

	let {
		seasons = [],
		selectedNumber = null,
		onchange
	}: {
		seasons?: Season[];
		selectedNumber?: number | null;
		onchange?: (number: number) => void;
	} = $props();

	function handleChange(event: Event) {
		const value = parseInt((event.currentTarget as HTMLSelectElement).value, 10);
		if (!Number.isNaN(value)) onchange?.(value);
	}
</script>

<label class="flex items-center gap-2 text-sm text-slate-700 min-w-0">
	<span class="sr-only">Season</span>
	<select
		class="select select-bordered select-sm w-full max-w-[18rem] text-sm min-h-[2.75rem]"
		value={selectedNumber ?? ''}
		onchange={handleChange}
	>
		{#each seasons as season (season.id)}
			<option value={season.number}>
				{formatSeasonLabel(season.number, season.startAt, season.endAt)}{season.status === 'archived'
					? ' · Archived'
					: ''}
			</option>
		{/each}
	</select>
</label>
