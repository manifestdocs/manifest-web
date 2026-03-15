import { json } from '@sveltejs/kit';
import {
	getDb,
	dbError,
	parseOptionalIntSearchParam,
	parseOptionalIsoDateTimeSearchParam
} from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const db = await getDb();

		const opts: { version_id?: string; limit?: number; offset?: number; since?: string } = {};

		const versionId = url.searchParams.get('version_id');
		if (versionId) opts.version_id = versionId;

		const limit = parseOptionalIntSearchParam(url, 'limit', { min: 1, max: 1000 });
		if (limit !== undefined) opts.limit = limit;

		const offset = parseOptionalIntSearchParam(url, 'offset', { min: 0, max: 100_000 });
		if (offset !== undefined) opts.offset = offset;

		const since = parseOptionalIsoDateTimeSearchParam(url, 'since');
		if (since) opts.since = since;

		const history = await db.getProjectHistory(params.id, opts);
		return json(history);
	} catch (e) {
		return dbError(e);
	}
};
