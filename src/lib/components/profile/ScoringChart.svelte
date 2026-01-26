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

	export let gameScores: Array<{
		gameId: number;
		date: string;
		gameNumber: number;
		birds: number;
		bonusCards: number;
		endOfRoundGoals: number;
		eggs: number;
		foodOnCards: number;
		tuckedCards: number;
		nectar: number;
		totalScore: number;
	}> | undefined;
	export let hideTitle = false;

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		if (!chartCanvas || !gameScores || gameScores.length === 0) return;

		// Sort by date ascending
		const sortedScores = [...gameScores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

		const labels = sortedScores.map((score) => {
			const date = new Date(score.date);
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		});

		chart = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Birds',
						data: sortedScores.map((score) => score.birds),
						borderColor: '#3B82F6',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5
					},
					{
						label: 'Bonus Cards',
						data: sortedScores.map((score) => score.bonusCards),
						borderColor: '#10B981',
						backgroundColor: 'rgba(16, 185, 129, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5
					},
					{
						label: 'End Goals',
						data: sortedScores.map((score) => score.endOfRoundGoals),
						borderColor: '#F59E0B',
						backgroundColor: 'rgba(245, 158, 11, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5
					},
					{
						label: 'Eggs',
						data: sortedScores.map((score) => score.eggs),
						borderColor: '#EF4444',
						backgroundColor: 'rgba(239, 68, 68, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5
					},
					{
						label: 'Food',
						data: sortedScores.map((score) => score.foodOnCards),
						borderColor: '#8B5CF6',
						backgroundColor: 'rgba(139, 92, 246, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5
					},
					{
						label: 'Tucked',
						data: sortedScores.map((score) => score.tuckedCards),
						borderColor: '#EC4899',
						backgroundColor: 'rgba(236, 72, 153, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5
					},
					{
						label: 'Nectar',
						data: sortedScores.map((score) => score.nectar),
						borderColor: '#14B8A6',
						backgroundColor: 'rgba(20, 184, 166, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5
					},
					{
						label: 'Total Score',
						data: sortedScores.map((score) => score.totalScore),
						borderColor: '#1F2937',
						backgroundColor: 'rgba(31, 41, 55, 0.1)',
						borderWidth: 3,
						fill: false,
						tension: 0.4,
						pointRadius: 4,
						pointHoverRadius: 6,
						pointBackgroundColor: '#1F2937',
						pointBorderColor: '#ffffff',
						pointBorderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						display: true,
						position: 'bottom',
						labels: {
							usePointStyle: true,
							padding: 15,
							font: {
								size: 11
							}
						}
					},
					tooltip: {
						backgroundColor: '#1f1f1f',
						titleColor: '#ffffff',
						bodyColor: '#ffffff',
						borderColor: '#333333',
						borderWidth: 1,
						padding: 12,
						callbacks: {
							label: (context) => {
								return `${context.dataset.label}: ${context.parsed.y}`;
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							color: '#666666',
							maxRotation: 45,
							minRotation: 45
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
	{#if !hideTitle}
		<h3 class="text-lg font-semibold text-slate-900">Scoring Breakdown</h3>
		<p class="text-sm text-slate-600">Last {gameScores?.length || 0} games</p>
	{/if}
	<div class="h-96 sm:h-80 md:h-96">
		{#if gameScores && gameScores.length > 0}
			<canvas bind:this={chartCanvas}></canvas>
		{:else}
			<div class="flex items-center justify-center h-full text-slate-500">
				No scoring data available
			</div>
		{/if}
	</div>
</div>
