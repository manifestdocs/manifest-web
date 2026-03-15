import { json } from '@sveltejs/kit';
import {
	getDb,
	dbError,
	parseOptionalEnumSearchParam,
	parseOptionalIntSearchParam,
	parseRequiredStringSearchParam
} from '$lib/server/api';
import type { RequestHandler } from './$types';

const FEATURE_STATES = ['proposed', 'blocked', 'in_progress', 'implemented', 'archived'] as const;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const q = parseRequiredStringSearchParam(url, 'q', { maxLength: 1000 });
		const db = await getDb();
		const project_id = url.searchParams.get('project_id') ?? undefined;
		const state = parseOptionalEnumSearchParam(url, 'state', FEATURE_STATES);
		const limit = parseOptionalIntSearchParam(url, 'limit', { min: 1, max: 100 });

		const results = await db.searchFeatures(q, { project_id, state, limit });
		return json(results);
	} catch (e) {
		return dbError(e);
	}
};
