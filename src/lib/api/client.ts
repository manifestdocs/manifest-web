import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { env } from '$env/dynamic/public';

function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const override = env.PUBLIC_MANIFEST_API_URL;
    // Only use the env var if it points to a different origin (cloud mode).
    // For same-origin (local/embedded), always use window.location.origin
    // so requests match CSP 'self' regardless of localhost vs 127.0.0.1.
    if (override) {
      try {
        if (new URL(override).origin !== window.location.origin) {
          return override;
        }
      } catch { /* invalid URL, ignore */ }
    }
    return `${window.location.origin}/api/v1`;
  }
  // SSR/prerender fallback
  return env.PUBLIC_MANIFEST_API_URL || 'http://localhost:17010/api/v1';
}

export const API_BASE_URL = resolveApiBaseUrl();

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

// Re-export types for convenience
export type { paths, components } from './schema';
