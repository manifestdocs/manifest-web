import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const deleted = await db.deleteDirectory(params.id);
		if (!deleted) return json({ error: 'Directory not found' }, { status: 404 });

		return new Response(null, { status: 204 });
	} catch (e) {
		return dbError(e);
	}
};
