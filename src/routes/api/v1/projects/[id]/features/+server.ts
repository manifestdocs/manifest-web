import { json } from '@sveltejs/kit';
import { createFeatureSchema } from '$lib/server/api-schemas';
import {
	getDb,
	dbError,
	parseJsonBody,
	parseOptionalEnumSearchParam,
	parseOptionalIntSearchParam
} from '$lib/server/api';
import type { RequestHandler } from './$types';

const FEATURE_STATES = ['proposed', 'blocked', 'in_progress', 'implemented', 'archived'] as const;

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const db = await getDb();

		const opts: { version_id?: string; state?: string; limit?: number; offset?: number } = {};

		const versionId = url.searchParams.get('version_id');
		if (versionId) opts.version_id = versionId;

		const state = parseOptionalEnumSearchParam(url, 'state', FEATURE_STATES);
		if (state) opts.state = state;

		const limit = parseOptionalIntSearchParam(url, 'limit', { min: 1, max: 1000 });
		if (limit !== undefined) opts.limit = limit;

		const offset = parseOptionalIntSearchParam(url, 'offset', { min: 0, max: 100_000 });
		if (offset !== undefined) opts.offset = offset;

		const features = await db.getFeaturesByProject(params.id, opts);
		return json(features);
	} catch (e) {
		return dbError(e);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const body = await parseJsonBody(request, createFeatureSchema);
		const feature = await db.createFeature(params.id, body);
		return json(feature, { status: 201 });
	} catch (e) {
		return dbError(e);
	}
};
