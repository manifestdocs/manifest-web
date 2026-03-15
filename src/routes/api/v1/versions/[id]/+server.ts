import { json } from '@sveltejs/kit';
import { updateVersionSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const version = await db.getVersion(params.id);
		if (!version) return json({ error: 'Version not found' }, { status: 404 });

		return json(version);
	} catch (e) {
		return dbError(e);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const body = await parseJsonBody(request, updateVersionSchema);
		const version = await db.updateVersion(params.id, {
			name: body.name,
			description: body.description,
			released_at: body.released_at,
		});

		if (!version) return json({ error: 'Version not found' }, { status: 404 });
		return json(version);
	} catch (e) {
		return dbError(e);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const deleted = await db.deleteVersion(params.id);
		if (!deleted) return json({ error: 'Version not found' }, { status: 404 });

		return new Response(null, { status: 204 });
	} catch (e) {
		return dbError(e);
	}
};
