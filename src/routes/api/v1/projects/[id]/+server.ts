import { json } from '@sveltejs/kit';
import { updateProjectSchema } from '$lib/server/api-schemas';
import { getDb, dbError, parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const project = await db.getProjectWithDirectories(params.id);

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		return json(project);
	} catch (e) {
		return dbError(e);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const body = await parseJsonBody(request, updateProjectSchema);
		const project = await db.updateProject(params.id, body);

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		return json(project);
	} catch (e) {
		return dbError(e);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const deleted = await db.deleteProject(params.id);

		if (!deleted) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		return new Response(null, { status: 204 });
	} catch (e) {
		return dbError(e);
	}
};
