import { json } from '@sveltejs/kit';
import { setFeatureVersionSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const body = await parseJsonBody(request, setFeatureVersionSchema);
		await db.setFeatureVersion(resolvedId, body.version_id ?? null);

		return new Response(null, { status: 204 });
	} catch (e) {
		return dbError(e);
	}
};
