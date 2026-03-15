import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const proof = await db.getProof(params.id);
		if (!proof) return json({ error: 'Proof not found' }, { status: 404 });

		return json(proof);
	} catch (e) {
		return dbError(e);
	}
};
