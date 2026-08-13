/** Only `/join/<code>` relative paths — blocks open redirects after login. */
export function safeJoinRedirect(candidate: string | null | undefined): string | null {
	if (!candidate) return null;
	const path = candidate.split('?')[0];
	if (/^\/join\/[A-Za-z0-9_-]{8,32}$/.test(path)) return path;
	return null;
}
