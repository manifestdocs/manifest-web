import createClient from 'openapi-fetch';
import type { paths } from './schema';

const API_BASE_URL = 'http://localhost:17010/api/v1';

export const api = createClient<paths>({
	baseUrl: API_BASE_URL
});

// Re-export types for convenience
export type { paths, components } from './schema';
