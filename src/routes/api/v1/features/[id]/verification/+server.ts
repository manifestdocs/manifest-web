import { json } from '@sveltejs/kit';
import { recordVerificationSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const body = await parseJsonBody(request, recordVerificationSchema);
		await db.recordVerification(resolvedId, body.comments);

		const feature = await db.getFeature(resolvedId);
		if (!feature) return json({ error: 'Feature not found' }, { status: 404 });

		return json(feature);
	} catch (e) {
		return dbError(e);
	}
};
