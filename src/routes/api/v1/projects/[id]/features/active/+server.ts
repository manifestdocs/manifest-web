import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const id = params.id;

		const focus = await db.getFocus(id);
		if (focus) {
			const context = await db.getFeatureContext(focus.feature_id);
			if (context) {
				return json(context);
			}
		}

		return json({ error: 'No active or focused feature found' }, { status: 404 });
	} catch (e) {
		return dbError(e);
	}
};
