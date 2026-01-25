import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface User {
	id: number;
	username: string;
	email: string;
	createdAt?: string;
}

export const user: Writable<User | null> = writable(null);
export const isAuthenticated = writable(false);
export const token = writable<string | null>(null);
