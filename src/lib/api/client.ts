import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { env } from '$env/dynamic/public';

function getDefaultApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1`;
  }
  return 'http://localhost:17010/api/v1';
}

export const API_BASE_URL =
  env.PUBLIC_MANIFEST_API_URL || getDefaultApiBaseUrl();

/**
 * API client instance.
 * Use this for all API requests in self-hosted mode.
 */
export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
});

/**
 * Create an API client with a bearer token.
 * Used when API key authentication is configured via MANIFEST_API_KEY.
 */
export function createAuthenticatedClient(token: string | null | undefined) {
  return createClient<paths>({
    baseUrl: API_BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

/**
 * Subscribe to feature change events for a project via SSE.
 * Returns an EventSource that emits 'change' events when features are modified.
 *
 * @param projectId - The project UUID to subscribe to
 */
export function subscribeToProject(projectId: string): EventSource {
  const url = new URL(`${API_BASE_URL}/projects/${projectId}/subscribe`);
  return new EventSource(url.toString());
}

/**
 * Get the API base URL (used by components that need the raw URL).
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Get the WebSocket base URL for terminal connections.
 * Converts http(s) to ws(s) protocol.
 */
export function getWsBaseUrl(): string {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.origin;
}

// Re-export types for convenience
export type { paths, components } from './schema';
