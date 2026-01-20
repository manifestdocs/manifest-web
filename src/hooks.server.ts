/**
 * SvelteKit server hooks for security and authentication.
 *
 * These hooks run on every request and handle:
 * - Security headers (CSP, HSTS, etc.)
 * - CSRF protection
 * - Session validation (in cloud mode)
 * - Rate limiting tracking
 */

import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

/**
 * Deployment mode detection.
 * In production (cloud mode), all security features are enabled.
 * In development (local mode), security is relaxed for easier testing.
 */
function isCloudMode(): boolean {
	return process.env.MANIFEST_MODE === 'cloud';
}

/**
 * API base URL for the Manifest server.
 */
const API_BASE_URL = process.env.MANIFEST_API_URL ?? 'http://localhost:17010/api/v1';

/**
 * Security headers applied to all responses.
 */
function getSecurityHeaders(isCloud: boolean): Record<string, string> {
	const headers: Record<string, string> = {
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

	// Additional headers for cloud mode
	if (isCloud) {
		// HSTS - force HTTPS
		headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';

		// Content Security Policy
		headers['Content-Security-Policy'] = [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline'", // unsafe-inline needed for SvelteKit
			"style-src 'self' 'unsafe-inline'", // unsafe-inline needed for CSS
			`connect-src 'self' ${API_BASE_URL}`,
			"img-src 'self' data: https:",
			"font-src 'self'",
			"object-src 'none'",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'"
		].join('; ');
	} else {
		// Relaxed CSP for local development
		headers['Content-Security-Policy'] = [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"style-src 'self' 'unsafe-inline'",
			"connect-src 'self' http://localhost:* ws://localhost:*",
			"img-src 'self' data: https:",
			"font-src 'self'",
			"frame-ancestors 'none'"
		].join('; ');
	}

	return headers;
}

/**
 * Security headers hook - adds security headers to all responses.
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const isCloud = isCloudMode();
	const headers = getSecurityHeaders(isCloud);

	const response = await resolve(event);

	// Add security headers
	for (const [key, value] of Object.entries(headers)) {
		response.headers.set(key, value);
	}

	return response;
};

/**
 * CSRF token generation and validation.
 * Uses double-submit cookie pattern.
 */
function generateCsrfToken(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * CSRF protection hook - validates tokens on mutation requests.
 */
const csrfProtection: Handle = async ({ event, resolve }) => {
	const isCloud = isCloudMode();

	// Only apply CSRF in cloud mode
	if (!isCloud) {
		return resolve(event);
	}

	// Skip for GET, HEAD, OPTIONS (safe methods)
	const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);
	if (safeMethod) {
		return resolve(event);
	}

	// Skip for API routes (they use bearer tokens)
	if (event.url.pathname.startsWith('/api/')) {
		return resolve(event);
	}

	// Validate CSRF token for mutations
	const cookieToken = event.cookies.get('csrf_token');
	const headerToken = event.request.headers.get('X-CSRF-Token');

	if (!cookieToken || !headerToken || cookieToken !== headerToken) {
		return new Response('Invalid CSRF token', { status: 403 });
	}

	return resolve(event);
};

/**
 * Session validation hook - validates user session from cookie.
 * Only active in cloud mode.
 */
const sessionValidation: Handle = async ({ event, resolve }) => {
	const isCloud = isCloudMode();

	// Skip session validation in local mode
	if (!isCloud) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	// Get session cookie
	const sessionId = event.cookies.get('manifest_session');

	if (sessionId) {
		try {
			// Validate session with backend
			const response = await fetch(`${API_BASE_URL}/auth/session`, {
				headers: {
					Cookie: `manifest_session=${sessionId}`
				}
			});

			if (response.ok) {
				const session = await response.json();
				event.locals.user = session.user;
				event.locals.session = session;
			} else {
				// Invalid session - clear cookie
				event.cookies.delete('manifest_session', { path: '/' });
				event.locals.user = null;
				event.locals.session = null;
			}
		} catch {
			// Backend unavailable
			event.locals.user = null;
			event.locals.session = null;
		}
	} else {
		event.locals.user = null;
		event.locals.session = null;
	}

	// Set/refresh CSRF token cookie
	if (!event.cookies.get('csrf_token')) {
		event.cookies.set('csrf_token', generateCsrfToken(), {
			path: '/',
			httpOnly: false, // JS needs to read this
			secure: isCloud,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 // 24 hours
		});
	}

	return resolve(event);
};

/**
 * Route protection hook - protects routes that require authentication.
 * Only active in cloud mode.
 */
const routeProtection: Handle = async ({ event, resolve }) => {
	const isCloud = isCloudMode();

	// Skip in local mode
	if (!isCloud) {
		return resolve(event);
	}

	// Public routes that don't require auth
	const publicRoutes = ['/', '/login', '/auth', '/api/health'];

	const isPublic = publicRoutes.some(
		(route) => event.url.pathname === route || event.url.pathname.startsWith('/auth/')
	);

	if (isPublic) {
		return resolve(event);
	}

	// Check if user is authenticated
	if (!event.locals.user) {
		// Redirect to login
		const loginUrl = new URL('/login', event.url.origin);
		loginUrl.searchParams.set('redirect', event.url.pathname);
		return new Response(null, {
			status: 302,
			headers: { Location: loginUrl.toString() }
		});
	}

	return resolve(event);
};

/**
 * Error handler - logs errors without exposing internals.
 */
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	const isCloud = isCloudMode();

	// Log the full error server-side
	console.error('[Server Error]', {
		status,
		message,
		path: event.url.pathname,
		error: error instanceof Error ? error.stack : error
	});

	// Return sanitized error to client
	if (isCloud) {
		// Don't expose internal error details in production
		return {
			message: status === 500 ? 'Internal server error' : message,
			code: status.toString()
		};
	}

	// In development, include more details
	return {
		message,
		code: status.toString(),
		stack: error instanceof Error ? error.stack : undefined
	};
};

/**
 * Main handle function - runs all hooks in sequence.
 */
export const handle = sequence(securityHeaders, sessionValidation, csrfProtection, routeProtection);
