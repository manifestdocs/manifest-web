import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const path = url.searchParams.get('path');
		if (!path) {
			return json({ error: 'path query parameter is required' }, { status: 422 });
		}

		const db = await getDb();
		const project = await db.getProjectByDirectory(path);

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		return json(project);
	} catch (e) {
		return dbError(e);
	}
};
