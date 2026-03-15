import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const tree = await db.getFeatureTree(params.id);
		return json(tree);
	} catch (e) {
		return dbError(e);
	}
};
