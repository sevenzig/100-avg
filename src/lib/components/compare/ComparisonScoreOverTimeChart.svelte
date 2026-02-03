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

	export let games: Array<{ gameId: number; date: string; gameNumber: number }> = [];
	export let series: Array<{
		userId: number;
		username: string;
		color: string;
		scores: Array<number | null>;
	}> = [];
	export let currentUserId: number | null = null;
	export let getPlayerColor: (color: string) => string;

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	function buildChart() {
		if (chart) {
			chart.destroy();
			chart = null;
		}
		if (!chartCanvas || games.length === 0 || series.length === 0) return;

		const labels = games.map((g) => {
			const date = new Date(g.date);
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		});

		const datasets = series.map((s) => {
			const color = getPlayerColor(s.color);
			return {
				label: s.userId === currentUserId ? 'You' : s.username,
				data: s.scores,
				borderColor: color,
				backgroundColor: color + '1A',
				borderWidth: 2,
				tension: 0.4,
				pointBackgroundColor: color,
				pointBorderColor: '#ffffff',
				pointBorderWidth: 2,
				pointRadius: 3,
				pointHoverRadius: 5,
				spanGaps: true
			};
		});

		chart = new Chart(chartCanvas, {
			type: 'line',
			data: { labels, datasets },
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
								if (val === null) return '';
								return `${context.dataset.label}: ${val}`;
							}
						}
					}
				},
				scales: {
					x: {
						ticks: { color: '#666666' },
						grid: { color: '#e5e7eb', display: false }
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

	$: if (chartCanvas && (games || series)) {
		buildChart();
	}
</script>

<div class="space-y-2">
	<h3 class="text-sm font-semibold text-slate-700">Score over time</h3>
	<div class="h-64 sm:h-56 md:h-72">
		{#if games.length > 0 && series.length > 0}
			<canvas bind:this={chartCanvas}></canvas>
		{:else}
			<div class="flex items-center justify-center h-full text-slate-500 text-sm">
				No game data available
			</div>
		{/if}
	</div>
</div>
