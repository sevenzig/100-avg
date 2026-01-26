interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const rateLimitStore = new Map<number, RateLimitEntry>();
const RATE_LIMIT = 10; // uploads per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

export function checkRateLimit(userId: number): { allowed: boolean; remaining: number } {
	const now = Date.now();
	const entry = rateLimitStore.get(userId);

	if (!entry || now > entry.resetTime) {
		// Reset or create new entry
		rateLimitStore.set(userId, {
			count: 1,
			resetTime: now + RATE_LIMIT_WINDOW
		});
		return { allowed: true, remaining: RATE_LIMIT - 1 };
	}

	if (entry.count >= RATE_LIMIT) {
		return { allowed: false, remaining: 0 };
	}

	entry.count++;
	return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

// Cleanup old entries periodically (optional)
setInterval(() => {
	const now = Date.now();
	for (const [userId, entry] of rateLimitStore.entries()) {
		if (now > entry.resetTime) {
			rateLimitStore.delete(userId);
		}
	}
}, 5 * 60 * 1000); // Every 5 minutes
