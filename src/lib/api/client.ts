import createClient from 'openapi-fetch';
import type { paths } from './schema';

export const API_BASE_URL = 'http://localhost:17010/api/v1';

export const api = createClient<paths>({
	baseUrl: API_BASE_URL
});

/**
 * Subscribe to feature change events for a project via SSE.
 * Returns an EventSource that emits 'change' events when features are modified.
 */
export function subscribeToProject(projectId: string): EventSource {
	return new EventSource(`${API_BASE_URL}/projects/${projectId}/subscribe`);
}

// Re-export types for convenience
export type { paths, components } from './schema';
