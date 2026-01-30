/**
 * One-off fix: Update game ID 21 to correct scores (skycondition 97, Blabberman23 119).
 * User IDs from league 1: skycondition=2, Blabberman23=3.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';

const dbDir = join(process.cwd(), 'database');
try {
	mkdirSync(dbDir, { recursive: true });
} catch (e) {}

const dbPath = process.env.DATABASE_PATH || join(dbDir, 'wingspan.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const GAME_ID = 21;
const SKYCONDITION_USER_ID = 2;
const BLABBERMAN_USER_ID = 3;

db.transaction(() => {
	// Blabberman23: 1st, 119 — birds 45, bonus 24, eor 10, eggs 12, food 0, tucked 13, nectar 15
	db.prepare(
		`UPDATE scores SET
			placement = 1, total_score = 119,
			birds = 45, bonus_cards = 24, end_of_round_goals = 10, eggs = 12,
			food_on_cards = 0, tucked_cards = 13, nectar = 15
		WHERE game_id = ? AND user_id = ?`
	).run(GAME_ID, BLABBERMAN_USER_ID);

	// skycondition: 2nd, 97 — birds 63, bonus 3, eor 16, eggs 0, food 9, tucked 0, nectar 6
	db.prepare(
		`UPDATE scores SET
			placement = 2, total_score = 97,
			birds = 63, bonus_cards = 3, end_of_round_goals = 16, eggs = 0,
			food_on_cards = 9, tucked_cards = 0, nectar = 6
		WHERE game_id = ? AND user_id = ?`
	).run(GAME_ID, SKYCONDITION_USER_ID);
})();

console.log('✅ Game 21 updated: Blabberman23 119 (1st), skycondition 97 (2nd)');
db.close();
