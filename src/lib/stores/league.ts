import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface Player {
	id: number;
	username: string;
	color: 'player_1' | 'player_2' | 'player_3';
}

export interface League {
	id: number;
	name: string;
	playerCount?: number;
	lastGameDate?: string;
	players: Player[];
	createdBy?: number;
	createdAt?: string;
	games?: Array<{ id: number; playedAt: string }>;
}

export interface LeagueStats {
	userId: number;
	username: string;
	color: string;
	avgPlacement: number;
	firstPlaceFinishes: number;
	averageScore: number;
	highestScore: number;
	lowestScore: number;
	avgBreakdown: {
		birds: number;
		bonusCards: number;
		endOfRoundGoals: number;
		eggs: number;
		foodOnCards: number;
		tuckedCards: number;
		nectar: number;
	};
	totalGames: number;
	wins: number;
	losses: number;
}

export const currentLeague: Writable<League | null> = writable(null);
export const leagues: Writable<League[]> = writable([]);
export const leagueStats: Writable<LeagueStats[] | null> = writable(null);
