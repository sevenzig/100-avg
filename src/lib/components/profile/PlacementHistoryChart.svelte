<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		LineController,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Legend
	} from 'chart.js';

	Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

	export let placementHistory: Array<{
		gameId: number;
		date: string;
		placement: number;
		totalScore: number;
	}> | undefined;
	export let hideTitle = false;

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
			type: 'line',
			data: {
				labels: ['1st', '2nd', '3rd', '4th', '5th'],
				datasets: [
					{
						label: 'Placements',
						data: placementCounts,
						borderColor: '#3B82F6',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						borderWidth: 2,
						fill: true,
						tension: 0.4,
						pointBackgroundColor: '#3B82F6',
						pointBorderColor: '#ffffff',
						pointBorderWidth: 2,
						pointRadius: 4,
						pointHoverRadius: 6
					}
				]
			},
			options: {
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
								const count = context.parsed.y;
								return `${count} game${count !== 1 ? 's' : ''}`;
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							color: '#666666'
						},
						grid: {
							color: '#e5e7eb'
						}
					},
					y: {
						beginAtZero: true,
						ticks: {
							stepSize: 1,
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
	{#if !hideTitle}
		<h3 class="text-lg font-semibold text-slate-900">Placement History</h3>
		<p class="text-sm text-slate-600">Last {placementHistory?.length || 0} matches</p>
	{/if}
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
