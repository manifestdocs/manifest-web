import { json } from '@sveltejs/kit';
import { upsertTemplateSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const template = await db.getDefaultTemplate(params.id);

		if (!template) {
			return json({ error: 'No default template found' }, { status: 404 });
		}

		return json(template);
	} catch (e) {
		return dbError(e);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const body = await parseJsonBody(request, upsertTemplateSchema);
		const template = await db.upsertTemplate(params.id, {
			name: body.name,
			description: body.description ?? undefined,
			content: body.content,
		});
		return json(template);
	} catch (e) {
		return dbError(e);
	}
};
