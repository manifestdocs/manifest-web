import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const version = await db.releaseVersion(params.id);
		if (!version) return json({ error: 'Version not found' }, { status: 404 });

		return json(version);
	} catch (e) {
		return dbError(e);
	}
};
