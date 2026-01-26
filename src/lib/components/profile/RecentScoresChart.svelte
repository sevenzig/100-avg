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

	export let recentScores: Array<{
		gameId: number;
		date: string;
		totalScore: number;
	}> | undefined;

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		if (!chartCanvas || !recentScores || recentScores.length === 0) return;

		const labels = recentScores
			.map((score) => {
				const date = new Date(score.date);
				return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			})
			.reverse();

		const scores = recentScores.map((score) => score.totalScore).reverse();

		chart = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Total Score',
						data: scores,
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
								return `Score: ${context.parsed.y}`;
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
	<h3 class="text-lg font-semibold text-slate-900">Recent Scores</h3>
	<p class="text-sm text-slate-600">Last 10 games</p>
	<div class="h-64 sm:h-48 md:h-64">
		{#if recentScores && recentScores.length > 0}
			<canvas bind:this={chartCanvas}></canvas>
		{:else}
			<div class="flex items-center justify-center h-full text-slate-500">
				No recent scores available
			</div>
		{/if}
	</div>
</div>
