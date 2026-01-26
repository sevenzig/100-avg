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

	export let categoryAverages: {
		matches: number;
		birds: number;
		bonusCards: number;
		endOfRoundGoals: number;
		eggs: number;
		foodOnCards: number;
		tuckedCards: number;
		nectar: number;
	} | undefined;

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		if (!chartCanvas || !categoryAverages || categoryAverages.matches === 0) return;

		chart = new Chart(chartCanvas, {
			type: 'bar',
			data: {
				labels: ['Birds', 'Bonus Cards', 'End Goals', 'Eggs', 'Food', 'Tucked', 'Nectar'],
				datasets: [
					{
						label: 'Average Score',
						data: [
							categoryAverages.birds || 0,
							categoryAverages.bonusCards || 0,
							categoryAverages.endOfRoundGoals || 0,
							categoryAverages.eggs || 0,
							categoryAverages.foodOnCards || 0,
							categoryAverages.tuckedCards || 0,
							categoryAverages.nectar || 0
						],
						backgroundColor: '#3B82F6',
						borderColor: '#2563EB',
						borderWidth: 1
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
								return `Average: ${context.parsed.y.toFixed(1)}`;
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
							color: '#e5e7eb',
							display: false
						}
					},
					y: {
						beginAtZero: true,
						ticks: {
							precision: 0,
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
	<h3 class="text-lg font-semibold text-slate-900">Category Averages</h3>
	<p class="text-sm text-slate-600">Last {categoryAverages?.matches || 0} matches</p>
	<div class="h-64 sm:h-48 md:h-64">
		{#if categoryAverages && categoryAverages.matches > 0}
			<canvas bind:this={chartCanvas}></canvas>
		{:else}
			<div class="flex items-center justify-center h-full text-slate-500">
				No category data available
			</div>
		{/if}
	</div>
</div>
