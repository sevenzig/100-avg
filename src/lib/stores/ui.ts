import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export const isLoading = writable(false);
export const error = writable<string | null>(null);
export const activeModal = writable<string | null>(null);
