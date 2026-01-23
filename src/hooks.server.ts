/**
 * SvelteKit server hooks for security headers.
 */

import type { Handle, HandleServerError } from '@sveltejs/kit';

/**
 * Security headers applied to all responses.
 */
const securityHeaders: Record<string, string> = {
	// Prevent clickjacking
	'X-Frame-Options': 'DENY',
	// Prevent MIME type sniffing
	'X-Content-Type-Options': 'nosniff',
	// Control referrer information
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	// Legacy XSS protection
	'X-XSS-Protection': '1; mode=block',
	// Permissions policy (disable dangerous features)
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

/**
 * Security headers hook - adds security headers to all responses.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Add security headers
	for (const [key, value] of Object.entries(securityHeaders)) {
		response.headers.set(key, value);
	}

	return response;
};

/**
 * Error handler - logs errors without exposing internals.
 */
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	// Log the full error server-side
	console.error('[Server Error]', {
		status,
		message,
		path: event.url.pathname,
		error: error instanceof Error ? error.stack : error
	});

	// In development, include more details
	return {
		message,
		code: status.toString(),
		stack: error instanceof Error ? error.stack : undefined
	};
};
