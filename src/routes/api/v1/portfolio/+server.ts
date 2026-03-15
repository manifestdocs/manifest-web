import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const db = await getDb();
		const projects = await db.getPortfolio();
		return json({ projects });
	} catch (e) {
		return dbError(e);
	}
};
