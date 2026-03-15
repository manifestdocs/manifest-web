import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const prefix = url.searchParams.get('prefix');
		if (!prefix) {
			return json({ error: 'Missing required query parameter: prefix' }, { status: 400 });
		}

		const db = await getDb();
		const project_id = url.searchParams.get('project_id') ?? undefined;

		// Try exact resolve first (UUID, display ID, UUID prefix)
		const resolvedId = await db.resolveFeatureId(prefix);
		if (resolvedId) {
			const feature = await db.getFeature(resolvedId);
			if (feature) return json(feature);
		}

		// Fall back to prefix search
		const feature = await db.resolveFeatureByPrefix(prefix, project_id);
		if (feature) return json(feature);

		return json({ error: 'Feature not found' }, { status: 404 });
	} catch (e) {
		return dbError(e);
	}
};
