import { initDatabase } from '$lib/utils/db';
import type { Handle } from '@sveltejs/kit';

// Initialize database on server start
initDatabase();

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
