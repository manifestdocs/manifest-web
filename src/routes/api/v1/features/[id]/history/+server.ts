import { json } from '@sveltejs/kit';
import { createHistorySchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const history = await db.getFeatureHistory(resolvedId);
		return json(history);
	} catch (e) {
		return dbError(e);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const body = await parseJsonBody(request, createHistorySchema);
		const entry = await db.createHistoryEntry(resolvedId, {
			summary: body.summary,
			commits: body.commits,
			version_id: body.version_id,
		});

		return json(entry, { status: 201 });
	} catch (e) {
		return dbError(e);
	}
};
