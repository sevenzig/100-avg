import { initDatabase } from '$lib/utils/db';
import type { Handle } from '@sveltejs/kit';

// Initialize database on server start
initDatabase();

export const handle: Handle = async ({ event, resolve }) => {
	// Increase body size limit for file uploads (10MB + buffer = 12MB)
	// Default is 512KB, which is too small for image uploads
	if (event.url.pathname.includes('/api/games/upload-screenshot')) {
		return resolve(event, {
			maxBodySize: 12 * 1024 * 1024 // 12MB
		});
	}
	return resolve(event);
};
