/**
 * SvelteKit server hooks for security headers.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { Handle, HandleServerError, RequestEvent } from '@sveltejs/kit';

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
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const PUBLIC_API_PATHS = new Set([
  '/api/v1/health',
  '/api/v1/version',
  '/api/v1/portfolio/events',
]);
const PROJECT_SUBSCRIBE_PATH = /^\/api\/v1\/projects\/[^/]+\/subscribe$/;

const DEFAULT_RATE_LIMIT = 100;
const DEFAULT_RATE_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_CLIENTS = 2_048;

const requestBuckets = new Map<string, number[]>();

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function isProtectedApiPath(pathname: string): boolean {
  if (!pathname.startsWith('/api/v1')) return false;
  if (PUBLIC_API_PATHS.has(pathname)) return false;
  if (PROJECT_SUBSCRIBE_PATH.test(pathname)) return false;
  return true;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function constantTimeCompare(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

function jsonError(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function applySecurityHeaders(response: Response): Response {
	for (const [key, value] of Object.entries(securityHeaders)) {
		response.headers.set(key, value);
	}
	return response;
}

function extractClientIp(event: RequestEvent): string {
  const trustProxy = ['true', '1'].includes((process.env.MANIFEST_TRUST_PROXY ?? '').toLowerCase());
  if (trustProxy) {
    const forwarded = event.request.headers.get('x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = event.request.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
  }
  return '127.0.0.1';
}

function evictStalestBucket(): void {
  let stalestIp: string | null = null;
  let stalestTs = Number.POSITIVE_INFINITY;

  for (const [ip, timestamps] of requestBuckets.entries()) {
    const latest = timestamps[timestamps.length - 1];
    if (latest !== undefined && latest < stalestTs) {
      stalestTs = latest;
      stalestIp = ip;
    }
  }

  if (stalestIp) {
    requestBuckets.delete(stalestIp);
  }
}

function checkRateLimit(ip: string): boolean {
  const maxRequests = parsePositiveInt(process.env.MANIFEST_RATE_LIMIT, DEFAULT_RATE_LIMIT);
  const windowMs = parsePositiveInt(process.env.MANIFEST_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_WINDOW_MS);
  const maxClients = parsePositiveInt(
    process.env.MANIFEST_RATE_LIMIT_MAX_CLIENTS,
    DEFAULT_RATE_LIMIT_MAX_CLIENTS,
  );

  const now = Date.now();
  const cutoff = now - windowMs;

  for (const [client, timestamps] of requestBuckets.entries()) {
    const fresh = timestamps.filter((ts) => ts > cutoff);
    if (fresh.length === 0) {
      requestBuckets.delete(client);
    } else {
      requestBuckets.set(client, fresh);
    }
  }

  let timestamps = requestBuckets.get(ip);
  if (!timestamps) {
    if (requestBuckets.size >= maxClients) {
      evictStalestBucket();
    }
    if (requestBuckets.size >= maxClients) {
      return false;
    }
    timestamps = [];
    requestBuckets.set(ip, timestamps);
  }

  if (timestamps.length >= maxRequests) {
    return false;
  }

  timestamps.push(now);
  return true;
}

/**
 * Security headers hook - adds security headers to all responses.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (isProtectedApiPath(event.url.pathname)) {
		const expectedApiKey = process.env.MANIFEST_API_KEY;
		if (expectedApiKey) {
			const authHeader = event.request.headers.get('authorization');
			if (!authHeader?.startsWith('Bearer ')) {
				return applySecurityHeaders(jsonError(401, 'Unauthorized'));
			}
			const token = authHeader.slice('Bearer '.length);
			if (!constantTimeCompare(token, expectedApiKey)) {
				return applySecurityHeaders(jsonError(401, 'Unauthorized'));
			}
		}

    const isCloudMode = (process.env.MANIFEST_MODE ?? '').toLowerCase() === 'cloud';
		if (expectedApiKey || isCloudMode) {
			const clientIp = extractClientIp(event);
			if (!checkRateLimit(clientIp)) {
				return applySecurityHeaders(jsonError(429, 'Too many requests'));
			}
		}
	}

	return applySecurityHeaders(await resolve(event));
};

/**
 * Error handler - logs errors without exposing internals.
 */
export const handleError: HandleServerError = async ({
  error,
  event,
  status,
  message,
}) => {
  // Log the full error server-side
  console.error('[Server Error]', {
    status,
    message,
    path: event.url.pathname,
    error: error instanceof Error ? error.stack : error,
  });

  const response = {
    message,
    code: status.toString(),
  };

  if (process.env.NODE_ENV === 'development') {
    return {
      ...response,
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  return response;
};
