import { json } from '@sveltejs/kit';
import { completeFeatureSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const body = await parseJsonBody(request, completeFeatureSchema);
		const result = await db.completeFeature(resolvedId, {
			summary: body.summary,
			commits: body.commits,
			backfill: body.backfill,
		});

		return json(result);
	} catch (e) {
		return dbError(e);
	}
};
