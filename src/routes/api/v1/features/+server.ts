import { json } from '@sveltejs/kit';
import { getDb, dbError, parseOptionalIntSearchParam } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const db = await getDb();
		const version_id = url.searchParams.get('version_id') ?? undefined;
		const limit = parseOptionalIntSearchParam(url, 'limit', { min: 1, max: 1000 });
		const offset = parseOptionalIntSearchParam(url, 'offset', { min: 0, max: 100_000 });

		const features = await db.getAllFeatures({ version_id, limit, offset });
		return json(features);
	} catch (e) {
		return dbError(e);
	}
};
