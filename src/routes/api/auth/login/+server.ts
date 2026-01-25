import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { verifyPassword, generateToken } from '$lib/utils/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { username, password } = await request.json();

		if (!username || !password) {
			return json({ success: false, error: 'Username and password required' }, { status: 400 });
		}

		const db = getDb();

		// Find user by username or email
		const user = db
			.prepare('SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?')
			.get(username, username) as
			| { id: number; username: string; email: string; password_hash: string }
			| undefined;

		if (!user) {
			return json({ success: false, error: 'Invalid credentials' }, { status: 401 });
		}

		// Verify password
		const isValid = await verifyPassword(password, user.password_hash);
		if (!isValid) {
			return json({ success: false, error: 'Invalid credentials' }, { status: 401 });
		}

		// Generate token
		const token = generateToken(user.id);

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
			token,
			user: {
				id: user.id,
				username: user.username,
				email: user.email
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
