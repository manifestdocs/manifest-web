import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { env } from '$env/dynamic/public';

export const API_BASE_URL = env.PUBLIC_MANIFEST_API_URL || 'http://localhost:17010/api/v1';

/**
 * API client instance for use without authentication.
 * Use this for local development or public endpoints.
 */
export const api = createClient<paths>({
	baseUrl: API_BASE_URL
});

/**
 * Create an authenticated API client with a Clerk session token.
 * Call this with the token obtained from `useClerkContext().session.getToken()`.
 *
 * Example usage in a Svelte component:
 * ```svelte
 * <script lang="ts">
 *   import { useClerkContext } from 'svelte-clerk/client';
 *   import { createAuthenticatedClient } from '$lib/api/client';
 *
 *   const ctx = useClerkContext();
 *
 *   async function fetchData() {
 *     const token = await ctx.session?.getToken();
 *     const client = createAuthenticatedClient(token);
 *     const { data, error } = await client.GET('/projects');
 *   }
 * </script>
 * ```
 */
export function createAuthenticatedClient(token: string | null | undefined) {
	return createClient<paths>({
		baseUrl: API_BASE_URL,
		headers: token ? { Authorization: `Bearer ${token}` } : undefined
	});
}

/**
 * Subscribe to feature change events for a project via SSE.
 * Returns an EventSource that emits 'change' events when features are modified.
 *
 * @param projectId - The project UUID to subscribe to
 * @param token - Optional JWT token for cloud mode authentication.
 *                Required in cloud mode since EventSource doesn't support Authorization headers.
 */
export function subscribeToProject(projectId: string, token?: string | null): EventSource {
	const url = new URL(`${API_BASE_URL}/projects/${projectId}/subscribe`);
	if (token) {
		url.searchParams.set('token', token);
	}
	return new EventSource(url.toString());
}

// Re-export types for convenience
export type { paths, components } from './schema';
