<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		BarController,
		BarElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Legend
	} from 'chart.js';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	export let placementHistory: Array<{
		gameId: number;
		date: string;
		placement: number;
		totalScore: number;
	}> | undefined;

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		if (!chartCanvas || !placementHistory || placementHistory.length === 0) return;

		const placementCounts = [0, 0, 0, 0, 0];
		placementHistory.forEach((item) => {
			if (item.placement >= 1 && item.placement <= 5) {
				placementCounts[item.placement - 1]++;
			}
		});

		chart = new Chart(chartCanvas, {
			type: 'bar',
			data: {
				labels: ['1st', '2nd', '3rd', '4th', '5th'],
				datasets: [
					{
						label: 'Placements',
						data: placementCounts,
						backgroundColor: [
							'#F59E0B', // Gold
							'#94A3B8', // Silver
							'#CD7F32', // Bronze
							'#6B7280', // Gray
							'#4B5563' // Dark Gray
						]
					}
				]
			},
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: '#1f1f1f',
						titleColor: '#ffffff',
						bodyColor: '#ffffff',
						borderColor: '#333333',
						borderWidth: 1,
						callbacks: {
							label: (context) => {
								const count = context.parsed.x;
								return `${count} game${count !== 1 ? 's' : ''}`;
							}
						}
					}
				},
				scales: {
					x: {
						beginAtZero: true,
						ticks: {
							stepSize: 1,
							color: '#666666'
						},
						grid: {
							color: '#e5e7eb'
						}
					},
					y: {
						ticks: {
							color: '#666666'
						},
						grid: {
							color: '#e5e7eb'
						}
					}
				}
			}
		});
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});
</script>

<div class="space-y-2">
	<h3 class="text-lg font-semibold text-slate-900">Placement History</h3>
	<p class="text-sm text-slate-600">Last {placementHistory?.length || 0} matches</p>
	<div class="h-64 sm:h-48 md:h-64">
		{#if placementHistory && placementHistory.length > 0}
			<canvas bind:this={chartCanvas}></canvas>
		{:else}
			<div class="flex items-center justify-center h-full text-slate-500">
				No placement data available
			</div>
		{/if}
	</div>
</div>
