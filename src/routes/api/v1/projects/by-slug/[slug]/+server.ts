import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const project = await db.getProjectBySlug(params.slug);

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		return json(project);
	} catch (e) {
		return dbError(e);
	}
};
