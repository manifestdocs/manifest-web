import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const roots = await db.getRootFeatures(params.id);
		return json(roots);
	} catch (e) {
		return dbError(e);
	}
};
