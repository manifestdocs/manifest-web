import { json } from '@sveltejs/kit';
import { setFocusSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const focus = await db.getFocus(params.id);

		if (!focus) {
			return json({ error: 'No focus set' }, { status: 404 });
		}

		return json(focus);
	} catch (e) {
		return dbError(e);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const body = await parseJsonBody(request, setFocusSchema);
		await db.setFocus(params.id, body.feature_id ?? null);
		return json({ ok: true });
	} catch (e) {
		return dbError(e);
	}
};
