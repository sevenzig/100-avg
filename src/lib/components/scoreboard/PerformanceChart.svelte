<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Chart,
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		CategoryScale,
		Tooltip,
		Legend
	} from 'chart.js';

	Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

	export interface Game {
		id: number;
		playedAt: string;
		scores: Array<{
			userId: number;
			totalScore: number;
		}>;
	}

	export interface Player {
		id: number;
		username: string;
		color: string;
	}

	export let games: Game[] = [];
	export let players: Player[] = [];

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	function getColor(playerColor: string) {
		const colors: Record<string, string> = {
			player_1: '#3B82F6',
			player_2: '#F59E0B',
			player_3: '#8B5CF6'
		};
		return colors[playerColor] || '#94A3B8';
	}

	onMount(() => {
		if (!chartCanvas || games.length === 0 || players.length === 0) return;

		const labels = games.map((g) => new Date(g.playedAt).toLocaleDateString()).reverse();
		const datasets = players.map((player) => {
			const scores = games
				.map((game) => {
					const score = game.scores.find((s) => s.userId === player.id);
					return score?.totalScore || 0;
				})
				.reverse();

			return {
				label: player.username,
				data: scores,
				borderColor: getColor(player.color),
				backgroundColor: getColor(player.color) + '40',
				tension: 0.1,
				pointRadius: 5,
				pointHoverRadius: 7
			};
		});

		chart = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels,
				datasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						labels: {
							color: '#ffffff'
						}
					},
					tooltip: {
						backgroundColor: '#1f1f1f',
						titleColor: '#ffffff',
						bodyColor: '#ffffff',
						borderColor: '#333333',
						borderWidth: 1
					}
				},
				scales: {
					x: {
						ticks: {
							color: '#666666'
						},
						grid: {
							color: '#2a2a2a'
						}
					},
					y: {
						ticks: {
							color: '#666666'
						},
						grid: {
							color: '#2a2a2a'
						}
					}
				}
			}
		});

		return () => {
			if (chart) {
				chart.destroy();
			}
		};
	});
</script>

<div class="w-full h-64">
	<canvas bind:this={chartCanvas}></canvas>
</div>
