import { json } from '@sveltejs/kit';
import { updateFeatureSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const feature = await db.getFeature(resolvedId);
		if (!feature) return json({ error: 'Feature not found' }, { status: 404 });

		return json(feature);
	} catch (e) {
		return dbError(e);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const body = await parseJsonBody(request, updateFeatureSchema);
		const result = await db.updateFeature(resolvedId, {
			parent_id: body.parent_id,
			title: body.title,
			details: body.details,
			desired_details: body.desired_details,
			details_summary: body.details_summary,
			state: body.state,
			priority: body.priority,
			target_version_id: body.target_version_id,
			clear_version: body.clear_version,
			blocked_by: body.blocked_by,
		});

		if (!result) return json({ error: 'Feature not found' }, { status: 404 });
		return json(result);
	} catch (e) {
		return dbError(e);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const deleted = await db.deleteFeature(resolvedId);
		if (!deleted) return json({ error: 'Feature not found' }, { status: 404 });

		return new Response(null, { status: 204 });
	} catch (e) {
		return dbError(e);
	}
};
