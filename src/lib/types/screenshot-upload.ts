export interface ExtractedPlayer {
	playerName: string;
	placement: number;
	totalScore: number;
	scoringBreakdown: {
		birds: number;
		bonusCards: number;
		endOfRoundGoals: number;
		eggs: number;
		foodOnCards: number;
		tuckedCards: number;
		nectar: number;
	};
}

export interface ExtractedGameData {
	players: ExtractedPlayer[];
}

export interface ParsingResult {
	success: boolean;
	extractedData?: ExtractedGameData;
	confidence?: number;
	warnings?: string[];
	error?: string;
}

export interface ValidationResult {
	valid: boolean;
	error?: string;
}
