import { initDatabase } from '$lib/utils/db';
import type { Handle } from '@sveltejs/kit';

// Initialize database on server start
initDatabase();

// Common bot scan patterns (WordPress, CMS, etc.) - return quick 404 without logging
const BOT_SCAN_PATTERNS = [
	'/xmlrpc.php',
	'/wp-includes/',
	'/wp-admin/',
	'/wp-content/',
	'/wordpress/',
	'/wp/',
	'/blog/',
	'/cms/',
	'/shop/',
	'/test/',
	'/wp2/',
	'/2018/',
	'/phpmyadmin',
	'/adminer',
	'/administrator',
	'/.env',
	'/.git/',
	'/config.php',
	'/wp-config.php',
	'/readme.html'
];

function isBotScan(pathname: string): boolean {
	return BOT_SCAN_PATTERNS.some((pattern) => pathname.toLowerCase().includes(pattern.toLowerCase()));
}

export const handle: Handle = async ({ event, resolve }) => {
	// Quick 404 for known bot scan patterns (reduces log noise and server load)
	if (isBotScan(event.url.pathname)) {
		return new Response('Not Found', { status: 404 });
	}

	// Increase body size limit for file uploads (10MB + buffer = 12MB)
	// Default is 512KB, which is too small for image uploads
	if (event.url.pathname.includes('/api/games/upload-screenshot')) {
		return resolve(event, {
			maxBodySize: 12 * 1024 * 1024 // 12MB
		});
	}
	return resolve(event);
};
