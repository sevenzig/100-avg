import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/utils/db';
import { getUserId, isAdmin, type CookieGetter, type DbLike } from '$lib/utils/auth';

// Helper to check admin access
function requireAdmin(cookies: CookieGetter, db: DbLike): number {
	const userId = getUserId(cookies);
	if (!userId) {
		throw { status: 401, body: { error: 'Not authenticated' } };
	}

	if (!isAdmin(userId, db)) {
		throw { status: 403, body: { error: 'Admin access required' } };
	}

	return userId;
}

// GET: List all users with details (admin only)
export const GET: RequestHandler = async ({ cookies }) => {
	const db = getDb();
	try {
		requireAdmin(cookies, db);

		// Get all users with additional info
		const users = db
			.prepare(
				`
			SELECT 
				u.id,
				u.username,
				u.email,
				u.created_at,
				u.is_admin,
				COUNT(DISTINCT lp.league_id) as league_count,
				COUNT(DISTINCT g.id) as game_count
			FROM users u
			LEFT JOIN league_players lp ON u.id = lp.user_id
			LEFT JOIN games g ON u.id = g.created_by
			GROUP BY u.id, u.username, u.email, u.created_at, u.is_admin
			ORDER BY u.id DESC
		`
			)
			.all() as Array<{
			id: number;
			username: string;
			email: string;
			created_at: string;
			is_admin: number | null;
			league_count: number;
			game_count: number;
		}>;

		const formattedUsers = users.map((user) => ({
			id: user.id,
			username: user.username,
			email: user.email,
			createdAt: user.created_at,
			isAdmin: user.is_admin === 1,
			leagueCount: user.league_count,
			gameCount: user.game_count
		}));

		return json({ users: formattedUsers });
	} catch (error: any) {
		if (error.status) {
			return json(error.body, { status: error.status });
		}
		console.error('Admin users GET error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// PUT: Update user (admin only)
export const PUT: RequestHandler = async ({ request, cookies }) => {
	const db = getDb();
	try {
		requireAdmin(cookies, db);

		const { id, username, email, isAdmin: newIsAdmin } = await request.json();

		if (!id || typeof id !== 'number') {
			return json({ success: false, error: 'Invalid user ID' }, { status: 400 });
		}

		// Check if user exists
		const user = db
			.prepare('SELECT id, username FROM users WHERE id = ?')
			.get(id) as { id: number; username: string } | undefined;

		if (!user) {
			return json({ success: false, error: 'User not found' }, { status: 404 });
		}

		// Prevent admin from removing their own admin status
		const currentUserId = getUserId(cookies);
		if (currentUserId === id && newIsAdmin === false) {
			return json(
				{ success: false, error: 'You cannot remove your own admin status' },
				{ status: 400 }
			);
		}

		// Update username if provided
		if (username !== undefined) {
			if (username.length < 1 || username.length > 50) {
				return json({ success: false, error: 'Username must be 1-50 characters' }, {
					status: 400
				});
			}

			// Check for duplicate username
			const existingUser = db
				.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
				.get(username, id) as { id: number } | undefined;

			if (existingUser) {
				return json({ success: false, error: 'Username already taken' }, { status: 400 });
			}

			db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id);
		}

		// Update email if provided
		if (email !== undefined) {
			if (email.length < 1 || email.length > 255) {
				return json({ success: false, error: 'Email must be 1-255 characters' }, {
					status: 400
				});
			}

			// Check for duplicate email
			const existingUser = db
				.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
				.get(email, id) as { id: number } | undefined;

			if (existingUser) {
				return json({ success: false, error: 'Email already taken' }, { status: 400 });
			}

			db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, id);
		}

		// Update admin status if provided
		if (newIsAdmin !== undefined) {
			const adminValue = newIsAdmin ? 1 : 0;
			db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(adminValue, id);
		}

		// Get updated user
		const updatedUser = db
			.prepare('SELECT id, username, email, created_at, is_admin FROM users WHERE id = ?')
			.get(id) as {
			id: number;
			username: string;
			email: string;
			created_at: string;
			is_admin: number | null;
		};

		return json({
			success: true,
			user: {
				id: updatedUser.id,
				username: updatedUser.username,
				email: updatedUser.email,
				createdAt: updatedUser.created_at,
				isAdmin: updatedUser.is_admin === 1
			}
		});
	} catch (error: any) {
		if (error.status) {
			return json(error.body, { status: error.status });
		}
		console.error('Admin user PUT error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};

// DELETE: Delete user (admin only)
export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const db = getDb();
	try {
		requireAdmin(cookies, db);

		const { id } = await request.json();

		if (!id || typeof id !== 'number') {
			return json({ success: false, error: 'Invalid user ID' }, { status: 400 });
		}

		// Prevent admin from deleting themselves
		const currentUserId = getUserId(cookies);
		if (currentUserId === id) {
			return json({ success: false, error: 'You cannot delete your own account' }, {
				status: 400
			});
		}

		// Check if user exists
		const user = db
			.prepare('SELECT id, username FROM users WHERE id = ?')
			.get(id) as { id: number; username: string } | undefined;

		if (!user) {
			return json({ success: false, error: 'User not found' }, { status: 404 });
		}

		// Delete user (CASCADE will handle related data: league_players, games, scores)
		// Note: We need to manually delete related data first due to foreign key constraints
		const deleteUser = db.transaction(() => {
			// Delete user's league memberships
			db.prepare('DELETE FROM league_players WHERE user_id = ?').run(id);

			// Delete games created by user (this will cascade to scores)
			db.prepare('DELETE FROM games WHERE created_by = ?').run(id);

			// Delete user
			const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);

			return result;
		});

		const result = deleteUser();

		if (result.changes === 0) {
			return json({ success: false, error: 'Failed to delete user' }, { status: 500 });
		}

		return json({
			success: true,
			message: `User "${user.username}" deleted successfully`
		});
	} catch (error: any) {
		if (error.status) {
			return json(error.body, { status: error.status });
		}
		console.error('Admin user DELETE error:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
