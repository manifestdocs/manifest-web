import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const context = await db.getFeatureContext(resolvedId);
		if (!context) return json({ error: 'Feature not found' }, { status: 404 });

		return json(context);
	} catch (e) {
		return dbError(e);
	}
};
