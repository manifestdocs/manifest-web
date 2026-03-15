import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const proof = await db.getLatestProof(resolvedId);
		if (!proof) return json({ error: 'No proofs found' }, { status: 404 });

		return json(proof);
	} catch (e) {
		return dbError(e);
	}
};
