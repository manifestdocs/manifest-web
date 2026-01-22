import createClient from 'openapi-fetch';
import type { paths } from './schema';

export const API_BASE_URL = 'http://localhost:17010/api/v1';

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
 */
export function subscribeToProject(projectId: string): EventSource {
	return new EventSource(`${API_BASE_URL}/projects/${projectId}/subscribe`);
}

// Re-export types for convenience
export type { paths, components } from './schema';
