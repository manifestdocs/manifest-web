import { json } from '@sveltejs/kit';
import { createVersionSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const id = params.id;

		const versions = await db.getVersionsByProject(id);
		const nextVersionId = await db.getNextVersionId(id);
		const features = await db.getFeaturesByProject(id);
		const backlogCount = features.filter(
			(f) => !f.target_version_id && f.feature_number != null
		).length;

		const versionInfos = versions.map((v) => ({
			...v,
			status: v.released_at ? 'released' : v.id === nextVersionId ? 'next' : 'planned'
		}));

		return json({ versions: versionInfos, next: nextVersionId, backlog_count: backlogCount });
	} catch (e) {
		return dbError(e);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const body = await parseJsonBody(request, createVersionSchema);
		const version = await db.createVersion(params.id, body);
		return json(version, { status: 201 });
	} catch (e) {
		return dbError(e);
	}
};
