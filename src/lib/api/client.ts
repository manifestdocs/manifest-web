import createClient from 'openapi-fetch';
import type { paths } from './schema';

export const API_BASE_URL = 'http://localhost:17010/api/v1';

/**
 * Get the access token from storage (client-side only).
 * In cloud mode, this is stored after OAuth login.
 */
function getAccessToken(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('manifest_access_token');
}

/**
 * Set the access token in storage.
 */
export function setAccessToken(token: string): void {
	if (typeof window !== 'undefined') {
		localStorage.setItem('manifest_access_token', token);
	}
}

/**
 * Clear the access token from storage.
 */
export function clearAccessToken(): void {
	if (typeof window !== 'undefined') {
		localStorage.removeItem('manifest_access_token');
		localStorage.removeItem('manifest_refresh_token');
	}
}

/**
 * Get auth headers for API requests.
 */
function getAuthHeaders(): HeadersInit {
	const token = getAccessToken();
	const csrfToken = typeof document !== 'undefined'
		? document.cookie.split('; ').find(row => row.startsWith('csrf_token='))?.split('=')[1]
		: null;

	const headers: HeadersInit = {};

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	if (csrfToken) {
		headers['X-CSRF-Token'] = csrfToken;
	}

	return headers;
}

/**
 * Create an authenticated API client.
 * Automatically includes auth headers when available.
 */
export const api = createClient<paths>({
	baseUrl: API_BASE_URL,
	headers: getAuthHeaders()
});

/**
 * Create a fresh API client with current auth headers.
 * Use this when the auth state may have changed.
 */
export function createAuthenticatedClient() {
	return createClient<paths>({
		baseUrl: API_BASE_URL,
		headers: getAuthHeaders()
	});
}

/**
 * Subscribe to feature change events for a project via SSE.
 * Returns an EventSource that emits 'change' events when features are modified.
 */
export function subscribeToProject(projectId: string): EventSource {
	return new EventSource(`${API_BASE_URL}/projects/${projectId}/subscribe`);
}

// Re-export types for convenience
export type { paths, components } from './schema';
