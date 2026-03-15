import { json } from '@sveltejs/kit';
import { claimFeatureSchema } from '$lib/server/api-schemas';
import { getDb, dbError, parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const body = await parseJsonBody(request, claimFeatureSchema);
		const result = await db.claimFeature(resolvedId, {
			agent_type: body.agent_type ?? 'unknown',
			force: body.force ?? false,
			metadata: body.claim_metadata ?? undefined,
		});

		return json(result);
	} catch (e) {
		return dbError(e);
	}
};
