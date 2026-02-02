/**
 * Auth-aware API context for use throughout the app.
 * Provides an authenticated API client using session tokens.
 */

import { getContext, setContext } from 'svelte';
import { createAuthenticatedClient, api as unauthenticatedApi } from './client';
import type { paths } from './schema';
import type createClient from 'openapi-fetch';

const AUTH_API_CONTEXT_KEY = 'auth-api';

type ApiClient = ReturnType<typeof createClient<paths>>;

export interface AuthApiContext {
  /**
   * Get an authenticated API client.
   * Returns the unauthenticated client if no token is available.
   */
  getClient: () => Promise<ApiClient>;

  /**
   * Check if auth is ready.
   * Use this to gate API calls until auth is available.
   */
  isReady: () => boolean;
}

/**
 * Set up the auth API context. Call this in the root app layout.
 */
export function setAuthApiContext(
  getToken: () => Promise<string | null | undefined>,
  isReady: () => boolean,
): void {
  const context: AuthApiContext = {
    async getClient() {
      const token = await getToken();
      if (token) {
        return createAuthenticatedClient(token);
      }
      return unauthenticatedApi;
    },
    isReady,
  };
  setContext(AUTH_API_CONTEXT_KEY, context);
}

/**
 * Get the auth API context. Call this in any component that needs to make API calls.
 */
export function getAuthApiContext(): AuthApiContext {
  return getContext<AuthApiContext>(AUTH_API_CONTEXT_KEY);
}
