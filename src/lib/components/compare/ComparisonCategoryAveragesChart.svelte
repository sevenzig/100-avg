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

	import type { LeagueStats } from '$lib/stores/league';

	export let comparisonPlayers: LeagueStats[] = [];
	export let currentUserId: number | null = null;
	export let getPlayerColor: (color: string) => string;

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	const CATEGORY_LABELS = ['Birds', 'Bonus Cards', 'End Goals', 'Eggs', 'Food', 'Tucked', 'Nectar'];

	function buildChart() {
		if (chart) {
			chart.destroy();
			chart = null;
		}
		if (!chartCanvas || comparisonPlayers.length === 0) return;

		const datasets = comparisonPlayers.map((stat) => {
			const color = getPlayerColor(stat.color);
			const b = stat.avgBreakdown;
			return {
				label: stat.userId === currentUserId ? 'You' : stat.username,
				data: [
					b.birds || 0,
					b.bonusCards || 0,
					b.endOfRoundGoals || 0,
					b.eggs || 0,
					b.foodOnCards || 0,
					b.tuckedCards || 0,
					b.nectar || 0
				],
				borderColor: color,
				backgroundColor: color + '1A',
				borderWidth: 2,
				tension: 0.4,
				pointBackgroundColor: color,
				pointBorderColor: '#ffffff',
				pointBorderWidth: 2,
				pointRadius: 3,
				pointHoverRadius: 5
			};
		});

		chart = new Chart(chartCanvas, {
			type: 'line',
			data: { labels: CATEGORY_LABELS, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top',
						labels: {
							usePointStyle: true,
							pointStyle: 'circle',
							padding: 16,
							font: { size: 12 }
						}
					},
					tooltip: {
						backgroundColor: '#1f1f1f',
						titleColor: '#ffffff',
						bodyColor: '#ffffff',
						borderColor: '#333333',
						borderWidth: 1,
						callbacks: {
							label: (context) => {
								const val = context.parsed.y;
								if (val === null || val === undefined) return '';
								return `${context.dataset.label}: ${val.toFixed(1)}`;
							}
						}
					}
				},
				scales: {
					x: {
						ticks: { color: '#666666' },
						grid: { color: '#e5e7eb' }
					},
					y: {
						beginAtZero: true,
						ticks: { precision: 0, color: '#666666' },
						grid: { color: '#e5e7eb' }
					}
				}
			}
		});
	}

	onMount(() => {
		buildChart();
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});

	$: if (chartCanvas && comparisonPlayers) {
		buildChart();
	}
</script>

<div class="space-y-2">
	<h3 class="text-sm font-semibold text-slate-700">Category averages</h3>
	<div class="h-64 sm:h-56 md:h-72">
		{#if comparisonPlayers.length > 0}
			<canvas bind:this={chartCanvas}></canvas>
		{:else}
			<div class="flex items-center justify-center h-full text-slate-500 text-sm">
				No category data available
			</div>
		{/if}
	</div>
</div>
