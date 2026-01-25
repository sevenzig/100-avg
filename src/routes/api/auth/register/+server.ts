import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { hashPassword, generateToken } from '$lib/utils/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { username, email, password } = await request.json();

		// Validation
		if (!username || username.length < 3 || username.length > 20) {
			return json({ success: false, error: 'Username must be 3-20 characters' }, { status: 400 });
		}

		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return json({ success: false, error: 'Invalid email format' }, { status: 400 });
		}

		if (!password || password.length < 8) {
			return json({ success: false, error: 'Password must be at least 8 characters' }, {
				status: 400
			});
		}

		const db = getDb();

		// Check if username exists
		const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
		if (existingUser) {
			return json({ success: false, error: 'Username already exists' }, { status: 400 });
		}

		// Check if email exists
		const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
		if (existingEmail) {
			return json({ success: false, error: 'Email already exists' }, { status: 400 });
		}

		// Hash password and create user
		const passwordHash = await hashPassword(password);
		const result = db
			.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
			.run(username, email, passwordHash);

		const userId = result.lastInsertRowid as number;

		// Generate token
		const token = generateToken(userId);

		// Set httpOnly cookie
		cookies.set('token', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		return json({
			success: true,
			user: {
				id: userId,
				username,
				email
			}
		});
	} catch (error) {
		console.error('Registration error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
